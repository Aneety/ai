import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const defaultRepo = process.env.CODEX_CLOUD_GITHUB_REPO ?? 'Aneety/ai';
const remotePollIntervalSeconds = positiveInteger(process.env.CODEX_CLOUD_REMOTE_POLL_INTERVAL, 20);
const remotePollMaxPolls = positiveInteger(process.env.CODEX_CLOUD_REMOTE_MAX_POLLS, 60);
const useEnvGhToken = process.env.CODEX_CLOUD_PUBLISH_USE_ENV_GH_TOKEN === '1';

export const REMOTE_AUTOMATION_KIND = {
  MANUAL_EXTERNAL: 'manual_external',
  REMOTE_AUTOMABLE: 'remote_automable',
};

export const REMOTE_GATE_STATE = {
  NONE: 'none',
  RUNNING_DEPLOY: 'running_remote_deploy',
  RUNNING_SMOKE: 'running_remote_smoke',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
};

export const gatewayBordaPublicationRunbook = {
  responsibility: 'gateway-borda',
  cycle: 'publicacao',
  workflowId: 'cloudflare-gate.yml',
  modulePath: 'aneety-platform/apps/gateway-borda/worker-gateway',
  evidenceFile: 'aneety-platform/apps/gateway-borda/worker-gateway/publication-evidence.json',
  artifactName: 'cloudflare-gate-result',
  commitTitle: 'chore(gateway-borda): record publicacao evidence',
};

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function ghCommand(command) {
  return useEnvGhToken ? `gh ${command}` : `env -u GH_TOKEN gh ${command}`;
}

function assertResultOk(result, errorCode) {
  if (result.code !== 0) {
    throw new Error(errorCode);
  }
}

function commandOutput(result) {
  return String(result?.stdout ?? result?.output ?? '');
}

export function getRemoteAutomationKind(target) {
  if (!target || target.state !== 'blocked' || target.blockKind !== 'pause') {
    return REMOTE_AUTOMATION_KIND.MANUAL_EXTERNAL;
  }

  if (target.responsibility === gatewayBordaPublicationRunbook.responsibility && target.cycle === gatewayBordaPublicationRunbook.cycle) {
    return REMOTE_AUTOMATION_KIND.REMOTE_AUTOMABLE;
  }

  return REMOTE_AUTOMATION_KIND.MANUAL_EXTERNAL;
}

export function getRemoteAutomationRunbook(target) {
  if (getRemoteAutomationKind(target) !== REMOTE_AUTOMATION_KIND.REMOTE_AUTOMABLE) {
    return null;
  }
  return gatewayBordaPublicationRunbook;
}

export function buildWorkflowDispatchNonce({ responsibility, cycle, stage, now = new Date() }) {
  const compactIso = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${responsibility}-${cycle}-${stage}-${compactIso}`;
}

export function parseRemoteGateResult(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
  return {
    mode: String(data.mode ?? '').trim(),
    modulePath: String(data.modulePath ?? '').trim(),
    headSha: String(data.headSha ?? '').trim(),
    runId: String(data.runId ?? '').trim(),
    runUrl: String(data.runUrl ?? '').trim(),
    conclusion: String(data.conclusion ?? '').trim(),
    publishedUrl: String(data.publishedUrl ?? '').trim(),
    smokeUrl: String(data.smokeUrl ?? '').trim(),
    smokeStatus: String(data.smokeStatus ?? '').trim(),
    controllerNonce: String(data.controllerNonce ?? '').trim(),
  };
}

export function buildPublicationEvidence({
  publishedUrl,
  headSha,
  deployRunId,
  deployRunUrl,
  smokeRunId,
  smokeRunUrl,
  validatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
}) {
  return {
    responsibility: 'gateway-borda',
    cycle: 'publicacao',
    modulePath: gatewayBordaPublicationRunbook.modulePath,
    deployRunId: String(deployRunId),
    deployRunUrl,
    smokeRunId: String(smokeRunId),
    smokeRunUrl,
    publishedUrl,
    headSha,
    validatedAt,
    result: 'success',
  };
}

export function updateGatewayPublicationDocs({ gatewayMarkdown, indexMarkdown, publishedUrl, headSha, deployRunUrl, smokeRunUrl }) {
  const shortSha = headSha.slice(0, 7);
  const commitUrl = `https://github.com/${defaultRepo}/commit/${headSha}`;
  const deployRunId = deployRunUrl.match(/\/runs\/(\d+)$/)?.[1] ?? 'unknown';
  const smokeRunId = smokeRunUrl.match(/\/runs\/(\d+)$/)?.[1] ?? 'unknown';

  const publicationEvidence =
    `[\`Cloudflare deploy gate\` deploy #${deployRunId}](${deployRunUrl}) publicou a URL real \`${publishedUrl}\`, ` +
    `[\`Cloudflare deploy gate\` smoke #${smokeRunId}](${smokeRunUrl}) validou o endpoint e ` +
    `\`worker-gateway/publication-evidence.json\` registrou o SHA [` +
    `${shortSha}](${commitUrl}).`;
  const publicationNextAction = 'Executar `backend` com evidência objetiva dos BFFs Workers compatíveis com a borda publicada.';
  const backendBlocker = '—';
  const backendNextAction = 'Executar `backend` agora que `publicacao` já ficou verde com URL real publicada.';
  const indexEvidence =
    `\`${publishedUrl}\` foi publicada com sucesso; ` +
    `[\`Cloudflare deploy gate\` deploy #${deployRunId}](${deployRunUrl}) e ` +
    `[\`smoke\` #${smokeRunId}](${smokeRunUrl}) validaram o SHA [` +
    `${shortSha}](${commitUrl}).`;

  const nextGatewayMarkdown = gatewayMarkdown
    .replace(
      /^\| `publicacao` \| .*$/m,
      `| \`publicacao\` | \`concluido\` | alta | \`processo\` | ${publicationEvidence} | — | ${publicationNextAction} |`,
    )
    .replace(
      /^\| `backend` \| .*$/m,
      `| \`backend\` | \`triagem\` | alta | \`backend\` | — | ${backendBlocker} | ${backendNextAction} |`,
    );

  const nextIndexMarkdown = indexMarkdown.replace(
    /^\| `gateway-borda` \| .*$/m,
    `| \`gateway-borda\` | Ricardo Malnati | alta | \`backend\` | \`triagem\` | [gateway-borda](./gateway-borda.md) | ${indexEvidence} | — |`,
  );

  return {
    gatewayMarkdown: nextGatewayMarkdown,
    indexMarkdown: nextIndexMarkdown,
  };
}

export async function executeGatewayBordaPublicationRemoteGate({
  repoRoot,
  mainSha,
  run,
  onStateChange = async () => {},
  repo = defaultRepo,
} = {}) {
  const runbook = gatewayBordaPublicationRunbook;
  const deployNonce = buildWorkflowDispatchNonce({
    responsibility: runbook.responsibility,
    cycle: runbook.cycle,
    stage: 'deploy',
  });

  await onStateChange({
    state: REMOTE_GATE_STATE.RUNNING_DEPLOY,
    stage: 'deploy',
    nonce: deployNonce,
  });

  const deployRun = await dispatchAndWaitForWorkflow({
    run,
    repo,
    workflowId: runbook.workflowId,
    ref: 'main',
    headSha: mainSha,
    inputs: {
      module_path: runbook.modulePath,
      mode: 'deploy',
      controller_nonce: deployNonce,
    },
    nonce: deployNonce,
  });

  if (deployRun.result.conclusion !== 'success' || !deployRun.result.publishedUrl) {
    return {
      ok: false,
      state: REMOTE_GATE_STATE.FAILED,
      stage: 'deploy',
      runbook,
      deployRun,
      blocker: `remote_deploy_failed run_id=${deployRun.runId} conclusion=${deployRun.result.conclusion || deployRun.runConclusion || 'unknown'}`,
    };
  }

  const smokeNonce = buildWorkflowDispatchNonce({
    responsibility: runbook.responsibility,
    cycle: runbook.cycle,
    stage: 'smoke',
  });

  await onStateChange({
    state: REMOTE_GATE_STATE.RUNNING_SMOKE,
    stage: 'smoke',
    nonce: smokeNonce,
    publishedUrl: deployRun.result.publishedUrl,
    deployRunId: deployRun.runId,
    deployRunUrl: deployRun.runUrl,
  });

  const smokeRun = await dispatchAndWaitForWorkflow({
    run,
    repo,
    workflowId: runbook.workflowId,
    ref: 'main',
    headSha: mainSha,
    inputs: {
      module_path: runbook.modulePath,
      mode: 'smoke',
      smoke_url: deployRun.result.publishedUrl,
      controller_nonce: smokeNonce,
    },
    nonce: smokeNonce,
  });

  if (smokeRun.result.conclusion !== 'success') {
    return {
      ok: false,
      state: REMOTE_GATE_STATE.FAILED,
      stage: 'smoke',
      runbook,
      deployRun,
      smokeRun,
      blocker: `remote_smoke_failed run_id=${smokeRun.runId} conclusion=${smokeRun.result.conclusion || smokeRun.runConclusion || 'unknown'}`,
    };
  }

  const evidence = buildPublicationEvidence({
    publishedUrl: deployRun.result.publishedUrl,
    headSha: mainSha,
    deployRunId: deployRun.runId,
    deployRunUrl: deployRun.runUrl,
    smokeRunId: smokeRun.runId,
    smokeRunUrl: smokeRun.runUrl,
  });

  const evidencePath = path.join(repoRoot, runbook.evidenceFile);
  const gatewayPath = path.join(repoRoot, 'docs', 'project', 'gateway-borda.md');
  const indexPath = path.join(repoRoot, 'docs', 'project', 'index.md');

  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  const [gatewayMarkdown, indexMarkdown] = await Promise.all([
    readFile(gatewayPath, 'utf8'),
    readFile(indexPath, 'utf8'),
  ]);
  const updatedMarkdown = updateGatewayPublicationDocs({
    gatewayMarkdown,
    indexMarkdown,
    publishedUrl: evidence.publishedUrl,
    headSha: evidence.headSha,
    deployRunUrl: evidence.deployRunUrl,
    smokeRunUrl: evidence.smokeRunUrl,
  });
  await Promise.all([
    writeFile(gatewayPath, updatedMarkdown.gatewayMarkdown),
    writeFile(indexPath, updatedMarkdown.indexMarkdown),
  ]);

  const validate = await run(
    `cd ${shellQuote(path.join(repoRoot, runbook.modulePath))} && ANEETY_PUBLICATION_EVIDENCE_FILE=publication-evidence.json npm run publication:validate`,
  );
  assertResultOk(validate, 'publication_evidence_validation_failed');

  return {
    ok: true,
    state: REMOTE_GATE_STATE.SUCCEEDED,
    runbook,
    deployRun,
    smokeRun,
    evidence,
    changedFiles: [
      runbook.evidenceFile,
      'docs/project/gateway-borda.md',
      'docs/project/index.md',
    ],
  };
}

async function dispatchAndWaitForWorkflow({
  run,
  repo,
  workflowId,
  ref,
  headSha,
  inputs,
  nonce,
}) {
  const dispatchStartedAt = new Date().toISOString();
  const inputArgs = Object.entries(inputs)
    .map(([key, value]) => `-f ${shellQuote(`${key}=${value}`)}`)
    .join(' ');

  const dispatch = await run(
    `${ghCommand(`workflow run ${shellQuote(workflowId)} --repo ${shellQuote(repo)} --ref ${shellQuote(ref)} ${inputArgs}`)}`,
  );
  assertResultOk(dispatch, `workflow_dispatch_failed_${inputs.mode}`);

  const discoveredRun = await waitForWorkflowRun({
    run,
    repo,
    workflowId,
    headSha,
    nonce,
    dispatchStartedAt,
  });

  const completedRun = await waitForWorkflowCompletion({
    run,
    repo,
    runId: discoveredRun.id,
  });
  const result = await downloadWorkflowArtifactResult({
    run,
    repo,
    runId: discoveredRun.id,
    artifactName: gatewayBordaPublicationRunbook.artifactName,
  });

  return {
    runId: String(discoveredRun.id),
    runUrl: completedRun.html_url ?? discoveredRun.html_url,
    runConclusion: completedRun.conclusion ?? '',
    result,
  };
}

async function waitForWorkflowRun({
  run,
  repo,
  workflowId,
  headSha,
  nonce,
  dispatchStartedAt,
}) {
  const sinceMs = Date.parse(dispatchStartedAt);
  for (let poll = 1; poll <= remotePollMaxPolls; poll += 1) {
    const runs = await run(
      `${ghCommand(
        `api repos/${repo}/actions/workflows/${workflowId}/runs?event=workflow_dispatch&branch=main&per_page=20`,
      )}`,
    );
    assertResultOk(runs, 'workflow_run_list_failed');

    const payload = JSON.parse(commandOutput(runs) || '{}');
    const workflowRuns = (Array.isArray(payload.workflow_runs) ? payload.workflow_runs : []).sort(
      (left, right) => Date.parse(right.created_at ?? 0) - Date.parse(left.created_at ?? 0),
    );
    const match = workflowRuns.find((workflowRun) => {
      const title = String(workflowRun.display_title ?? workflowRun.name ?? '');
      const createdAt = Date.parse(workflowRun.created_at ?? 0);
      return title.includes(nonce) && workflowRun.head_sha === headSha && createdAt >= sinceMs;
    });

    if (match) return match;
    if (poll < remotePollMaxPolls) {
      await delay(remotePollIntervalSeconds);
    }
  }

  throw new Error('workflow_run_not_found');
}

async function waitForWorkflowCompletion({ run, repo, runId }) {
  for (let poll = 1; poll <= remotePollMaxPolls; poll += 1) {
    const result = await run(`${ghCommand(`api repos/${repo}/actions/runs/${runId}`)}`);
    assertResultOk(result, `workflow_run_view_failed_${runId}`);
    const payload = JSON.parse(commandOutput(result) || '{}');
    if (String(payload.status ?? '').toLowerCase() === 'completed') {
      return payload;
    }
    if (poll < remotePollMaxPolls) {
      await delay(remotePollIntervalSeconds);
    }
  }

  throw new Error(`workflow_run_timeout_${runId}`);
}

async function downloadWorkflowArtifactResult({ run, repo, runId, artifactName }) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'aneety-cloudflare-gate-'));
  try {
    const download = await run(
      `${ghCommand(`run download ${shellQuote(String(runId))} --repo ${shellQuote(repo)} -n ${shellQuote(artifactName)} -D ${shellQuote(tmpDir)}`)}`,
    );
    assertResultOk(download, `workflow_artifact_download_failed_${runId}`);

    const resultPath = path.join(tmpDir, 'cloudflare-gate-result.json');
    const payload = await readFile(resultPath, 'utf8');
    return parseRemoteGateResult(payload);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function delay(seconds) {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
