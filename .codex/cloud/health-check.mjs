#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { loadControllerBacklog } from './controller-backlog.mjs';

const defaultRepoRoot = process.cwd();
const defaultEnvFile =
  process.env.CODEX_CLOUD_ENV_FILE ??
  path.join(
    process.env.HOME ?? '',
    '.codex',
    'automations',
    'aneety-project-hourly-controller',
    'cloud-env.sh',
  );
const defaultIsolatedWorktree =
  process.env.CODEX_CLOUD_WORKTREE_DIR ??
  path.join(
    process.env.HOME ?? '',
    '.codex',
    'automations',
    'aneety-project-hourly-controller',
    'scheduler-worktree',
    'ai',
  );
const defaultRepo = process.env.CODEX_CLOUD_GITHUB_REPO ?? 'Aneety/ai';

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function parseArgs(argv) {
  return {
    json: argv.includes('--json'),
    quiet: argv.includes('--quiet'),
  };
}

function normalizeText(value) {
  return String(value ?? '').toLowerCase();
}

export function promptReflectsSchedulerOnlyContract(markdown) {
  const text = normalizeText(markdown);
  return (
    text.includes('modelo oficial: **scheduler-only**') &&
    text.includes('não tente criar branch, fazer commit, fazer push, abrir pr ou fazer merge') &&
    text.includes('task_outcome=diff_ready|no_diff|blocked')
  );
}

export function docsReflectSchedulerOnlyContract(markdown) {
  const text = normalizeText(markdown);
  return (
    text.includes('scheduler-only') &&
    text.includes('a task cloud não faz push, não abre pr e não faz merge') &&
    text.includes('o scheduler publica o diff')
  );
}

export function submitScriptReflectsSchedulerOnlyContract(script) {
  return String(script ?? '').includes('mutation_surface=scheduler_only');
}

async function run(command, { cwd = defaultRepoRoot } = {}) {
  return new Promise((resolve) => {
    const childEnv = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith('npm_')),
    );
    const child = spawn('bash', ['-c', command], {
      cwd,
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

function commandWithEnvFile(envFile, command) {
  return [
    'set -euo pipefail',
    'export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:${PATH:-}"',
    `if [ -f ${shellQuote(envFile)} ]; then set -a; . ${shellQuote(envFile)}; set +a; fi`,
    'if [ -z "${CODEX_CLOUD_CLI:-}" ] && [ -x /opt/homebrew/bin/codex ]; then export CODEX_CLOUD_CLI=/opt/homebrew/bin/codex; fi',
    command,
  ].join('; ');
}

function addFailure(result, code, details = null) {
  result.status = 'degraded';
  result.errors.push(code);
  if (details != null) {
    result.failureDetails[code] = details;
  }
}

export async function runControllerHealthCheck({
  repoRoot = defaultRepoRoot,
  envFile = defaultEnvFile,
  isolatedWorktree = defaultIsolatedWorktree,
  repo = defaultRepo,
  preferIsolatedWorktree = false,
} = {}) {
  const result = {
    status: 'ready',
    errors: [],
    failureDetails: {},
    checks: {
      envFilePresent: false,
      envFileMode: null,
      envFileModeOk: false,
      cliExec: false,
      cliDiff: false,
      cliList: false,
      ghAuth: false,
      pushPermission: false,
      isolatedWorktreeExists: false,
      isolatedWorktreeClean: false,
      backlogParsed: false,
      promptContract: false,
      docsContract: false,
      submitContract: false,
    },
    evaluatedRefSource: 'repo_root',
    evaluatedSha: null,
  };

  try {
    await access(envFile);
    result.checks.envFilePresent = true;
    const mode = (await stat(envFile)).mode & 0o777;
    result.checks.envFileMode = mode.toString(8);
    result.checks.envFileModeOk = mode === 0o600;
    if (!result.checks.envFileModeOk) {
      addFailure(result, `env_file_mode_expected_600_actual_${mode.toString(8)}`);
    }
  } catch {
    addFailure(result, 'env_file_missing');
  }

  for (const [key, command] of [
    ['cliExec', '${CODEX_CLOUD_CLI:-codex} cloud exec --help >/dev/null 2>&1'],
    ['cliDiff', '${CODEX_CLOUD_CLI:-codex} cloud diff --help >/dev/null 2>&1'],
    ['cliList', '${CODEX_CLOUD_CLI:-codex} cloud list --help >/dev/null 2>&1'],
  ]) {
    const commandResult = await run(commandWithEnvFile(envFile, command), { cwd: repoRoot });
    result.checks[key] = commandResult.code === 0;
    if (commandResult.code !== 0) {
      addFailure(result, `${key}_unavailable`);
    }
  }

  const ghAuth = await run('env -u GH_TOKEN gh auth status --hostname github.com >/dev/null 2>&1', { cwd: repoRoot });
  result.checks.ghAuth = ghAuth.code === 0;
  if (!result.checks.ghAuth) {
    addFailure(result, 'gh_auth_missing');
  }

  const pushPermission = await run(
    `env -u GH_TOKEN gh api repos/${repo} --jq '.permissions.push'`,
    { cwd: repoRoot },
  );
  result.checks.pushPermission = pushPermission.code === 0 && pushPermission.stdout.trim() === 'true';
  if (!result.checks.pushPermission) {
    addFailure(result, 'github_push_permission_missing', pushPermission.stdout.trim() || pushPermission.stderr.trim() || null);
  }

  const worktreeExists = await run(`git -C ${shellQuote(isolatedWorktree)} rev-parse --is-inside-work-tree`, {
    cwd: repoRoot,
  });
  result.checks.isolatedWorktreeExists = worktreeExists.code === 0;
  const inspectionRoot =
    result.checks.isolatedWorktreeExists && preferIsolatedWorktree ? isolatedWorktree : repoRoot;
  if (!result.checks.isolatedWorktreeExists) {
    addFailure(result, 'isolated_worktree_missing');
  } else {
    result.evaluatedRefSource = preferIsolatedWorktree ? 'isolated_worktree' : 'repo_root';
    const status = await run('git status --short', { cwd: isolatedWorktree });
    result.checks.isolatedWorktreeClean = status.code === 0 && status.stdout.trim() === '';
    if (!result.checks.isolatedWorktreeClean) {
      addFailure(result, 'isolated_worktree_dirty');
    }
    const sha = await run('git rev-parse HEAD', { cwd: inspectionRoot });
    if (sha.code === 0) {
      result.evaluatedSha = sha.stdout.trim().split('\n').filter(Boolean).at(-1) ?? null;
    }
  }

  if (!result.checks.isolatedWorktreeExists || !preferIsolatedWorktree) {
    const sha = await run('git rev-parse HEAD', { cwd: inspectionRoot });
    if (sha.code === 0) {
      result.evaluatedSha = sha.stdout.trim().split('\n').filter(Boolean).at(-1) ?? null;
    }
  }

  try {
    await loadControllerBacklog(inspectionRoot);
    result.checks.backlogParsed = true;
  } catch (error) {
    addFailure(result, 'docs_project_parse_failed', String(error.message ?? error));
  }

  const promptText = await readFile(path.join(inspectionRoot, '.codex', 'cloud', 'controller-prompt.md'), 'utf8');
  result.checks.promptContract = promptReflectsSchedulerOnlyContract(promptText);
  if (!result.checks.promptContract) {
    addFailure(result, 'prompt_contract_invalid');
  }

  const docsText = await readFile(
    path.join(inspectionRoot, 'docs', 'operations', 'codex-cloud-controller.md'),
    'utf8',
  );
  result.checks.docsContract = docsReflectSchedulerOnlyContract(docsText);
  if (!result.checks.docsContract) {
    addFailure(result, 'docs_contract_invalid');
  }

  const submitText = await readFile(
    path.join(inspectionRoot, '.codex', 'cloud', 'submit-controller-task.sh'),
    'utf8',
  );
  result.checks.submitContract = submitScriptReflectsSchedulerOnlyContract(submitText);
  if (!result.checks.submitContract) {
    addFailure(result, 'submit_contract_invalid');
  }

  return result;
}

function printHumanReadable(result) {
  console.log(`[codex-cloud-health] health_state=${result.status}`);
  if (result.evaluatedSha) {
    console.log(`[codex-cloud-health] evaluated_ref_source=${result.evaluatedRefSource}`);
    console.log(`[codex-cloud-health] evaluated_sha=${result.evaluatedSha}`);
  }
  for (const [key, value] of Object.entries(result.checks)) {
    console.log(`[codex-cloud-health] ${key}=${value}`);
  }
  for (const error of result.errors) {
    console.log(`[codex-cloud-health] blocker=${error}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const result = await runControllerHealthCheck({ preferIsolatedWorktree: true });
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (!args.quiet) {
    printHumanReadable(result);
  }
  process.exit(result.status === 'ready' ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[codex-cloud-health] blocker=${error.message}`);
    process.exit(1);
  });
}
