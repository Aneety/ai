#!/usr/bin/env node
import { spawn } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { isControllerBranch } from './controller-constants.mjs';

const repo = process.env.CODEX_CLOUD_GITHUB_REPO ?? 'Aneety/ai';
const autoMerge = process.env.CODEX_CLOUD_AUTO_MERGE !== '0';
const autoMergeMethod = process.env.CODEX_CLOUD_AUTO_MERGE_METHOD ?? 'squash';
const prWatchInterval = positiveInteger(process.env.CODEX_CLOUD_PR_WATCH_INTERVAL, 30);
const prWatchMaxPolls = positiveInteger(process.env.CODEX_CLOUD_PR_WATCH_MAX_POLLS, 60);
const autoDeleteBranch = process.env.CODEX_CLOUD_AUTO_DELETE_BRANCH !== '0';
const useEnvGhToken = process.env.CODEX_CLOUD_PUBLISH_USE_ENV_GH_TOKEN === '1';

const args = new Set(process.argv.slice(2));
const probeOnly = args.has('--probe-only');
const waitForResolution = args.has('--wait');

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function log(message) {
  console.log(`[codex-cloud-reconcile] ${message}`);
}

function fail(message) {
  console.error(`[codex-cloud-reconcile] ${message}`);
  process.exit(1);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function ghCommand(command) {
  return useEnvGhToken ? `gh ${command}` : `env -u GH_TOKEN gh ${command}`;
}

function run(command, options = {}) {
  const childEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith('npm_')),
  );

  return new Promise((resolve) => {
    const child = spawn('bash', ['-c', command], {
      cwd: options.cwd ?? process.cwd(),
      env: {
        ...childEnv,
        PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH ?? ''}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function runGh(command) {
  return run(ghCommand(command), { quiet: true });
}

async function findOpenControllerPr() {
  const result = await runGh(
    `pr list --repo ${shellQuote(repo)} --state open --limit 100 --json number,headRefName,url`,
  );
  if (result.code !== 0) throw new Error('open_controller_pr_list_failed');

  const prs = JSON.parse(result.stdout || '[]');
  const controllerPrs = prs.filter((pr) => isControllerBranch(pr.headRefName));
  log(`open_controller_pr_count=${controllerPrs.length}`);

  if (controllerPrs.length === 0) return null;

  const pr = controllerPrs[0];
  log(`open_controller_pr=#${pr.number} branch=${pr.headRefName} url=${pr.url}`);
  return pr;
}

async function loadPrDetails(prNumber) {
  const result = await runGh(
    `pr view ${shellQuote(String(prNumber))} --repo ${shellQuote(repo)} --json number,url,headRefName,headRefOid,isDraft,mergeable,mergeStateStatus,state,mergedAt,mergeCommit,createdAt,updatedAt`,
  );
  if (result.code !== 0) throw new Error('open_controller_pr_view_failed');
  return JSON.parse(result.stdout || '{}');
}

export function shouldFallbackToAllChecks(stderr) {
  return /no required checks reported/i.test(String(stderr ?? ''));
}

async function loadRequiredChecks(prNumber) {
  let result = await runGh(
    `pr checks ${shellQuote(String(prNumber))} --repo ${shellQuote(repo)} --required --json name,state,workflow,link`,
  );
  if (result.code !== 0 && shouldFallbackToAllChecks(result.stderr)) {
    log('open_controller_pr_checks_scope=all');
    result = await runGh(
      `pr checks ${shellQuote(String(prNumber))} --repo ${shellQuote(repo)} --json name,state,workflow,link`,
    );
  }
  if (result.code !== 0) throw new Error('open_controller_pr_checks_failed');
  return JSON.parse(result.stdout || '[]');
}

function normalizeCheckState(state) {
  return String(state ?? '').trim().toUpperCase();
}

function classifyChecks(checks) {
  const failedStates = new Set([
    'FAILURE',
    'FAILED',
    'ERROR',
    'TIMED_OUT',
    'TIMEDOUT',
    'CANCELLED',
    'ACTION_REQUIRED',
    'STARTUP_FAILURE',
    'STALE',
  ]);
  const pendingStates = new Set([
    'PENDING',
    'IN_PROGRESS',
    'QUEUED',
    'WAITING',
    'REQUESTED',
    'EXPECTED',
    'STARTUP_PENDING',
  ]);
  const successStates = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);

  const failed = [];
  const pending = [];

  for (const check of checks) {
    const state = normalizeCheckState(check.state);
    if (failedStates.has(state)) {
      failed.push(check);
      continue;
    }
    if (pendingStates.has(state) || !successStates.has(state)) {
      pending.push(check);
    }
  }

  return { failed, pending };
}

function hasExceededWatchWindow(details) {
  const reference = details.updatedAt ?? details.createdAt ?? null;
  if (!reference) return false;
  const referenceTime = Date.parse(reference);
  if (Number.isNaN(referenceTime)) return false;
  const maxWindowMs = prWatchInterval * prWatchMaxPolls * 1000;
  return Date.now() - referenceTime > maxWindowMs;
}

function summarizeChecks(checks) {
  return checks
    .slice(0, 5)
    .map((check) => `${check.name ?? check.workflow ?? 'unknown'}:${normalizeCheckState(check.state)}`)
    .join(',');
}

async function inspectOpenPr() {
  const pr = await findOpenControllerPr();
  if (!pr) {
    log('open_controller_pr_state=none');
    return { state: 'none' };
  }

  const details = await loadPrDetails(pr.number);
  if (String(details.state ?? '').toUpperCase() === 'MERGED' || details.mergedAt) {
    const mergedSha = details.mergeCommit?.oid ?? 'unknown';
    log(`open_controller_pr_state=merged`);
    log(`open_controller_pr_merged=#${details.number} sha=${mergedSha}`);
    return { state: 'merged', number: details.number, url: details.url, branch: details.headRefName, mergedSha };
  }

  const checks = await loadRequiredChecks(pr.number);
  const { failed, pending } = classifyChecks(checks);

  if (failed.length > 0) {
    log('open_controller_pr_state=failed');
    log(`open_controller_pr_failed_checks=${summarizeChecks(failed)}`);
    return {
      state: 'failed',
      number: details.number,
      url: details.url,
      branch: details.headRefName,
      headRefOid: details.headRefOid,
      failedChecks: failed,
    };
  }

  if (details.isDraft || pending.length > 0) {
    const state = hasExceededWatchWindow(details) ? 'timeout' : 'pending';
    log(`open_controller_pr_state=${state}`);
    if (pending.length > 0) {
      log(`open_controller_pr_pending_checks=${summarizeChecks(pending)}`);
    }
    return {
      state,
      number: details.number,
      url: details.url,
      branch: details.headRefName,
      headRefOid: details.headRefOid,
      pendingChecks: pending,
    };
  }

  log('open_controller_pr_state=merge_ready');
  return {
    state: 'merge_ready',
    number: details.number,
    url: details.url,
    branch: details.headRefName,
    headRefOid: details.headRefOid,
  };
}

async function mergePr(prInfo) {
  if (!autoMerge) return prInfo;

  const mergeFlag =
    autoMergeMethod === 'merge' ? '--merge' : autoMergeMethod === 'rebase' ? '--rebase' : '--squash';
  const deleteFlag = autoDeleteBranch ? '--delete-branch' : '';
  const result = await runGh(
    `pr merge ${shellQuote(String(prInfo.number))} --repo ${shellQuote(repo)} ${mergeFlag} ${deleteFlag} --match-head-commit ${shellQuote(prInfo.headRefOid)}`,
  );

  if (result.code !== 0) {
    const refreshed = await inspectOpenPr();
    if (refreshed.state === 'merged') return refreshed;
    if (refreshed.headRefOid && refreshed.headRefOid !== prInfo.headRefOid) {
      log('open_controller_pr_state=failed');
      log('open_controller_pr_merge_error=head_drift');
      return {
        ...refreshed,
        state: 'failed',
        mergeError: 'head_drift',
      };
    }
    log('open_controller_pr_state=failed');
    log(`open_controller_pr_merge_error=merge_failed`);
    return {
      ...refreshed,
      state: 'failed',
      mergeError: 'merge_failed',
    };
  }

  const merged = await loadPrDetails(prInfo.number);
  const mergedSha = merged.mergeCommit?.oid ?? 'unknown';
  log('open_controller_pr_state=merged');
  log(`open_controller_pr_merged=#${merged.number} sha=${mergedSha}`);
  return {
    state: 'merged',
    number: merged.number,
    url: merged.url,
    branch: merged.headRefName,
    mergedSha,
  };
}

async function runOnce() {
  const inspected = await inspectOpenPr();
  if (probeOnly || inspected.state !== 'merge_ready') return inspected;
  return mergePr(inspected);
}

async function runWaitLoop() {
  for (let poll = 1; poll <= prWatchMaxPolls; poll += 1) {
    const inspected = await inspectOpenPr();
    if (inspected.state === 'merge_ready' && !probeOnly) {
      return mergePr(inspected);
    }
    if (inspected.state === 'none' || inspected.state === 'merged' || inspected.state === 'failed' || inspected.state === 'timeout') {
      return inspected;
    }
    if (poll < prWatchMaxPolls) {
      await delay(prWatchInterval * 1000);
    }
  }

  log('open_controller_pr_state=timeout');
  return { state: 'timeout' };
}

async function main() {
  const auth = await runGh('auth status --hostname github.com');
  if (auth.code !== 0) fail('gh auth is missing or insufficient');

  if (waitForResolution) {
    await runWaitLoop();
    return;
  }

  await runOnce();
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => fail(error.message));
}
