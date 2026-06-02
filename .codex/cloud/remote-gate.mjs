import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const defaultRepo = process.env.CODEX_CLOUD_GITHUB_REPO ?? 'Aneety/ai';
const remotePollIntervalSeconds = positiveInteger(process.env.CODEX_CLOUD_REMOTE_POLL_INTERVAL, 20);
const remotePollMaxPolls = positiveInteger(process.env.CODEX_CLOUD_REMOTE_MAX_POLLS, 60);
export function shouldUseEnvGhToken(env = process.env) {
  const mode = env.CODEX_CLOUD_PUBLISH_USE_ENV_GH_TOKEN;
  if (mode === '1') return true;
  if (mode === '0') return false;
  return Boolean(env.GH_TOKEN);
}

const useEnvGhToken = shouldUseEnvGhToken();

export const REMOTE_AUTOMATION_KIND = {
  MANUAL_EXTERNAL: 'manual_external',
  REMOTE_AUTOMABLE: 'remote_automable',
};

export const REMOTE_GATE_STATE = {
  NONE: 'none',
  RUNNING_DEPLOY: 'running_remote_deploy',
  RUNNING_DATABASE: 'running_remote_database',
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

function buildWorkerDeployRunbook(responsibility) {
  return Object.freeze({
    responsibility,
    cycle: 'deploy',
    workflowId: 'cloudflare-gate.yml',
    modulePath: `aneety-platform/apps/${responsibility}/worker-${responsibility}`,
    artifactName: 'cloudflare-gate-result',
    responsibilityDoc: `docs/project/${responsibility}.md`,
    commitTitle: `chore(${responsibility}): record deploy evidence`,
  });
}

function buildWorkerPublicationRunbook(responsibility) {
  return Object.freeze({
    responsibility,
    cycle: 'publicacao',
    workflowId: 'cloudflare-gate.yml',
    modulePath: `aneety-platform/apps/${responsibility}/worker-${responsibility}`,
    evidenceFile: `aneety-platform/apps/${responsibility}/worker-${responsibility}/publication-evidence.json`,
    artifactName: 'cloudflare-gate-result',
    responsibilityDoc: `docs/project/${responsibility}.md`,
    commitTitle: `chore(${responsibility}): record publicacao evidence`,
  });
}

export const workerDeployRunbooks = Object.freeze({
  'tenant-white-label': buildWorkerDeployRunbook('tenant-white-label'),
  'identidade-acesso': buildWorkerDeployRunbook('identidade-acesso'),
  'onboarding-acesso': buildWorkerDeployRunbook('onboarding-acesso'),
});

export const workerPublicationRunbooks = Object.freeze({
  'tenant-white-label': buildWorkerPublicationRunbook('tenant-white-label'),
  'identidade-acesso': buildWorkerPublicationRunbook('identidade-acesso'),
  'onboarding-acesso': buildWorkerPublicationRunbook('onboarding-acesso'),
});

function buildDatabaseModulePath(responsibility) {
  return `aneety-platform/apps/${responsibility}/db-${responsibility}`;
}

function readDatabaseContract({ repoRoot = process.cwd(), responsibility }) {
  const modulePath = buildDatabaseModulePath(responsibility);
  const contractPath = path.join(repoRoot, modulePath, 'contracts', 'storage-contract.json');
  if (!existsSync(contractPath)) return null;

  try {
    const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
    const storage = contract?.storage ?? {};
    if (
      contract?.responsibility !== responsibility ||
      contract?.cycle !== 'banco' ||
      contract?.runtime !== 'cloudflare-workers' ||
      storage?.type !== 'd1' ||
      !storage?.binding ||
      !storage?.databaseName ||
      !storage?.migrationDirectory ||
      !storage?.rollbackDirectory ||
      !storage?.seedDirectory
    ) {
      return null;
    }

    return {
      modulePath,
      contract,
      contractPath,
    };
  } catch {
    return null;
  }
}

function listRelativeSqlFilesSync(moduleAbsolutePath, relativeDir) {
  const absoluteDir = path.join(moduleAbsolutePath, relativeDir);
  if (!existsSync(absoluteDir)) return [];
  return readdirSync(absoluteDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => path.posix.join(relativeDir, entry.name))
    .sort();
}

function buildDatabaseValidationRunbook(responsibility, repoRoot = process.cwd()) {
  const dbContract = readDatabaseContract({ repoRoot, responsibility });
  if (!dbContract) return null;

  const moduleAbsolutePath = path.join(repoRoot, dbContract.modulePath);
  const storage = dbContract.contract.storage;
  return Object.freeze({
    responsibility,
    cycle: 'banco',
    workflowId: 'cloudflare-d1-gate.yml',
    modulePath: dbContract.modulePath,
    responsibilityDoc: `docs/project/${responsibility}.md`,
    artifactName: 'cloudflare-d1-gate-result',
    resultFileName: 'cloudflare-d1-gate-result.json',
    evidenceFile: `${dbContract.modulePath}/d1-validation-evidence.json`,
    commitTitle: `chore(${responsibility}): record banco evidence`,
    binding: String(storage.binding).trim(),
    databaseName: String(storage.databaseName).trim(),
    migrationFiles: listRelativeSqlFilesSync(moduleAbsolutePath, String(storage.migrationDirectory).trim()),
    seedFiles: listRelativeSqlFilesSync(moduleAbsolutePath, String(storage.seedDirectory).trim()),
    rollbackFiles: listRelativeSqlFilesSync(moduleAbsolutePath, String(storage.rollbackDirectory).trim()),
    fixtureFiles: listRelativeSqlFilesSync(moduleAbsolutePath, 'tests'),
  });
}

export const MISSING_SERVICE_DEPENDENCY_MAP = Object.freeze({
  'worker-identidade-acesso': Object.freeze({
    responsibility: 'identidade-acesso',
    cycle: 'deploy',
  }),
  'worker-tenant-white-label': Object.freeze({
    responsibility: 'tenant-white-label',
    cycle: 'deploy',
  }),
  'worker-onboarding-acesso': Object.freeze({
    responsibility: 'onboarding-acesso',
    cycle: 'deploy',
  }),
});

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

  const repoRoot = target.repoRoot ?? process.cwd();

  if (target.responsibility === gatewayBordaPublicationRunbook.responsibility && target.cycle === gatewayBordaPublicationRunbook.cycle) {
    return REMOTE_AUTOMATION_KIND.REMOTE_AUTOMABLE;
  }

  if (target.cycle === 'publicacao' && workerPublicationRunbooks[target.responsibility]) {
    return REMOTE_AUTOMATION_KIND.REMOTE_AUTOMABLE;
  }

  if (target.cycle === 'deploy' && workerDeployRunbooks[target.responsibility]) {
    return REMOTE_AUTOMATION_KIND.REMOTE_AUTOMABLE;
  }

  if (target.cycle === 'banco' && buildDatabaseValidationRunbook(target.responsibility, repoRoot)) {
    return REMOTE_AUTOMATION_KIND.REMOTE_AUTOMABLE;
  }

  return REMOTE_AUTOMATION_KIND.MANUAL_EXTERNAL;
}

export function getRemoteAutomationRunbook(target) {
  if (getRemoteAutomationKind(target) !== REMOTE_AUTOMATION_KIND.REMOTE_AUTOMABLE) {
    return null;
  }
  if (target.cycle === 'publicacao' && workerPublicationRunbooks[target.responsibility]) {
    return workerPublicationRunbooks[target.responsibility];
  }
  if (target.cycle === 'deploy' && workerDeployRunbooks[target.responsibility]) {
    return workerDeployRunbooks[target.responsibility];
  }
  if (target.cycle === 'banco') {
    return buildDatabaseValidationRunbook(target.responsibility, target.repoRoot ?? process.cwd());
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
    failureCode: String(data.failureCode ?? '').trim(),
    failureReason: String(data.failureReason ?? '').trim(),
    missingServices: Array.isArray(data.missingServices)
      ? data.missingServices.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [],
  };
}

function normalizeStepPayload(value) {
  const payload = typeof value === 'object' && value ? value : {};
  return {
    status: String(payload.status ?? '').trim(),
    detail: String(payload.detail ?? '').trim(),
  };
}

export function parseDatabaseGateResult(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const normalizeArray = (value) =>
    Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : [];
  return {
    mode: String(data.mode ?? '').trim(),
    modulePath: String(data.modulePath ?? '').trim(),
    headSha: String(data.headSha ?? '').trim(),
    runId: String(data.runId ?? '').trim(),
    runUrl: String(data.runUrl ?? '').trim(),
    conclusion: String(data.conclusion ?? '').trim(),
    controllerNonce: String(data.controllerNonce ?? '').trim(),
    failureCode: String(data.failureCode ?? '').trim(),
    failureReason: String(data.failureReason ?? '').trim(),
    responsibility: String(data.responsibility ?? '').trim(),
    cycle: String(data.cycle ?? '').trim(),
    runtime: String(data.runtime ?? '').trim(),
    binding: String(data.binding ?? '').trim(),
    databaseName: String(data.databaseName ?? '').trim(),
    ephemeralDatabaseName: String(data.ephemeralDatabaseName ?? '').trim(),
    migrationFiles: normalizeArray(data.migrationFiles),
    seedFiles: normalizeArray(data.seedFiles),
    fixtureFiles: normalizeArray(data.fixtureFiles),
    rollbackFiles: normalizeArray(data.rollbackFiles),
    steps: {
      validate: normalizeStepPayload(data.steps?.validate),
      create: normalizeStepPayload(data.steps?.create),
      migrate: normalizeStepPayload(data.steps?.migrate),
      seed: normalizeStepPayload(data.steps?.seed),
      fixture: normalizeStepPayload(data.steps?.fixture),
      rollback: normalizeStepPayload(data.steps?.rollback),
      cleanup: normalizeStepPayload(data.steps?.cleanup),
    },
    validatedAt: String(data.validatedAt ?? '').trim(),
  };
}

export function mapMissingServicesToDependencies(missingServices = []) {
  const mapped = [];
  const unmapped = [];

  for (const service of missingServices) {
    const normalized = String(service ?? '').trim();
    if (!normalized) continue;
    const dependency = MISSING_SERVICE_DEPENDENCY_MAP[normalized];
    if (dependency) {
      mapped.push({
        service: normalized,
        responsibility: dependency.responsibility,
        cycle: dependency.cycle,
      });
      continue;
    }
    unmapped.push(normalized);
  }

  return { mapped, unmapped };
}

export function buildPublicationEvidence({
  responsibility = 'gateway-borda',
  modulePath = gatewayBordaPublicationRunbook.modulePath,
  publishedUrl,
  headSha,
  deployRunId,
  deployRunUrl,
  smokeRunId,
  smokeRunUrl,
  validatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
}) {
  return {
    responsibility,
    cycle: 'publicacao',
    modulePath,
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

export function buildDatabaseValidationEvidence({
  responsibility,
  modulePath,
  binding,
  databaseName,
  headSha,
  runId,
  runUrl,
  controllerNonce,
  migrationFiles,
  seedFiles,
  fixtureFiles,
  rollbackFiles,
  steps,
  validatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
}) {
  return {
    responsibility,
    cycle: 'banco',
    runtime: 'cloudflare-workers',
    modulePath,
    binding,
    databaseName,
    headSha,
    runId: String(runId),
    runUrl,
    controllerNonce,
    migrationFiles,
    seedFiles,
    fixtureFiles,
    rollbackFiles,
    steps,
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

export function updateWorkerDeployDocs({
  responsibility,
  responsibilityMarkdown,
  indexMarkdown,
  headSha,
  dryRunUrl,
}) {
  const shortSha = headSha.slice(0, 7);
  const commitUrl = `https://github.com/${defaultRepo}/commit/${headSha}`;
  const dryRunId = dryRunUrl.match(/\/runs\/(\d+)$/)?.[1] ?? 'unknown';
  const deployEvidence =
    `[\`Cloudflare deploy gate\` dry-run #${dryRunId}](${dryRunUrl}) validou ` +
    `\`${responsibility}\` no SHA [\`${shortSha}\`](${commitUrl}) sem segredo versionado e com runtime Workers compatível.`;
  const deployNextAction = 'Executar `publicacao` com evidência remota objetiva do ciclo seguinte.';
  const publicacaoNextAction = 'Executar `publicacao` agora que `deploy` já ficou verde com gate remoto comprovado.';

  const nextResponsibilityMarkdown = responsibilityMarkdown
    .replace(
      /^\| `deploy` \| .*$/m,
      `| \`deploy\` | \`concluido\` | alta | \`processo\` | ${deployEvidence} | — | ${deployNextAction} |`,
    )
    .replace(
      /^\| `publicacao` \| .*$/m,
      `| \`publicacao\` | \`triagem\` | alta | \`processo\` | — | — | ${publicacaoNextAction} |`,
    );

  const rowPattern = new RegExp(`^\\| \`${responsibility}\` \\| ([^|]+) \\| ([^|]+) \\| .*?$`, 'm');
  const rowMatch = indexMarkdown.match(rowPattern);
  const owner = rowMatch?.[1]?.trim() ?? 'Ricardo Malnati';
  const priority = rowMatch?.[2]?.trim() ?? 'alta';
  const nextIndexMarkdown = indexMarkdown.replace(
    new RegExp(`^\\| \`${responsibility}\` \\| .*?$`, 'm'),
    `| \`${responsibility}\` | ${owner} | ${priority} | \`publicacao\` | \`triagem\` | [${responsibility}](./${responsibility}.md) | ${deployEvidence} | — |`,
  );

  return {
    responsibilityMarkdown: nextResponsibilityMarkdown,
    indexMarkdown: nextIndexMarkdown,
  };
}

export function updateWorkerPublicationDocs({
  responsibility,
  responsibilityMarkdown,
  indexMarkdown,
  publishedUrl,
  headSha,
  deployRunUrl,
  smokeRunUrl,
}) {
  const shortSha = headSha.slice(0, 7);
  const commitUrl = `https://github.com/${defaultRepo}/commit/${headSha}`;
  const deployRunId = deployRunUrl.match(/\/runs\/(\d+)$/)?.[1] ?? 'unknown';
  const smokeRunId = smokeRunUrl.match(/\/runs\/(\d+)$/)?.[1] ?? 'unknown';
  const publicationEvidence =
    `[\`Cloudflare deploy gate\` deploy #${deployRunId}](${deployRunUrl}) publicou a URL real \`${publishedUrl}\`, ` +
    `[\`Cloudflare deploy gate\` smoke #${smokeRunId}](${smokeRunUrl}) validou o endpoint público e ` +
    `\`worker-${responsibility}/publication-evidence.json\` registrou o SHA [` +
    `${shortSha}](${commitUrl}).`;
  const publicacaoNextAction = 'Executar `banco` com evidência objetiva do primeiro contrato persistido após a URL pública validada.';
  const bancoNextAction = 'Executar `banco` agora que `publicacao` já ficou verde com URL real publicada.';

  const nextResponsibilityMarkdown = responsibilityMarkdown
    .replace(
      /^\| `publicacao` \| .*$/m,
      `| \`publicacao\` | \`concluido\` | alta | \`processo\` | ${publicationEvidence} | — | ${publicacaoNextAction} |`,
    )
    .replace(
      /^\| `banco` \| .*$/m,
      `| \`banco\` | \`triagem\` | alta | \`DB\` | — | — | ${bancoNextAction} |`,
    );

  const rowPattern = new RegExp(`^\\| \`${responsibility}\` \\| ([^|]+) \\| ([^|]+) \\| .*?$`, 'm');
  const rowMatch = indexMarkdown.match(rowPattern);
  const owner = rowMatch?.[1]?.trim() ?? 'Ricardo Malnati';
  const priority = rowMatch?.[2]?.trim() ?? 'alta';
  const nextIndexMarkdown = indexMarkdown.replace(
    new RegExp(`^\\| \`${responsibility}\` \\| .*?$`, 'm'),
    `| \`${responsibility}\` | ${owner} | ${priority} | \`banco\` | \`triagem\` | [${responsibility}](./${responsibility}.md) | ${publicationEvidence} | — |`,
  );

  return {
    responsibilityMarkdown: nextResponsibilityMarkdown,
    indexMarkdown: nextIndexMarkdown,
  };
}

export function updateDatabaseValidationDocs({
  responsibility,
  responsibilityMarkdown,
  indexMarkdown,
  headSha,
  runUrl,
}) {
  const shortSha = headSha.slice(0, 7);
  const commitUrl = `https://github.com/${defaultRepo}/commit/${headSha}`;
  const runId = runUrl.match(/\/runs\/(\d+)$/)?.[1] ?? 'unknown';
  const evidence =
    `[\`Cloudflare D1 gate\` #${runId}](${runUrl}) validou migration, seed, fixture e rollback em banco efêmero D1; ` +
    `\`db-${responsibility}/d1-validation-evidence.json\` registrou o SHA [` +
    `${shortSha}](${commitUrl}).`;
  const bancoNextAction = 'Executar `backend` com contrato HTTP/BFF sobre o banco validado remotamente.';
  const backendNextAction = 'Executar `backend` agora que `banco` já ficou verde com evidência D1-backed remota.';

  const nextResponsibilityMarkdown = responsibilityMarkdown
    .replace(
      /^\| `banco` \| .*$/m,
      `| \`banco\` | \`concluido\` | alta | \`DB\` | ${evidence} | — | ${bancoNextAction} |`,
    )
    .replace(
      /^\| `backend` \| .*$/m,
      `| \`backend\` | \`triagem\` | alta | \`backend\` | — | — | ${backendNextAction} |`,
    );

  const rowPattern = new RegExp(`^\\| \`${responsibility}\` \\| ([^|]+) \\| ([^|]+) \\| .*?$`, 'm');
  const rowMatch = indexMarkdown.match(rowPattern);
  const owner = rowMatch?.[1]?.trim() ?? 'Ricardo Malnati';
  const priority = rowMatch?.[2]?.trim() ?? 'alta';
  const nextIndexMarkdown = indexMarkdown.replace(
    new RegExp(`^\\| \`${responsibility}\` \\| .*?$`, 'm'),
    `| \`${responsibility}\` | ${owner} | ${priority} | \`backend\` | \`triagem\` | [${responsibility}](./${responsibility}.md) | ${evidence} | — |`,
  );

  return {
    responsibilityMarkdown: nextResponsibilityMarkdown,
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
    artifactName: runbook.artifactName,
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
    const dependencyConversion = mapMissingServicesToDependencies(deployRun.result.missingServices);
    return {
      ok: false,
      state: REMOTE_GATE_STATE.FAILED,
      stage: 'deploy',
      runbook,
      deployRun,
      blocker: `remote_deploy_failed run_id=${deployRun.runId} conclusion=${deployRun.result.conclusion || deployRun.runConclusion || 'unknown'}`,
      failureCode: deployRun.result.failureCode || null,
      failureReason: deployRun.result.failureReason || null,
      dependencyTargets: dependencyConversion.mapped,
      unmappedServices: dependencyConversion.unmapped,
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
    artifactName: runbook.artifactName,
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

export async function executeWorkerDeployRemoteGate({
  target,
  repoRoot,
  mainSha,
  run,
  onStateChange = async () => {},
  repo = defaultRepo,
} = {}) {
  const runbook = workerDeployRunbooks[target?.responsibility ?? ''];
  if (!runbook) {
    return { ok: false, state: REMOTE_GATE_STATE.FAILED, blocker: 'remote_gate_unsupported' };
  }

  const dryRunNonce = buildWorkflowDispatchNonce({
    responsibility: runbook.responsibility,
    cycle: runbook.cycle,
    stage: 'dry-run',
  });

  await onStateChange({
    state: REMOTE_GATE_STATE.RUNNING_DEPLOY,
    stage: 'dry-run',
    nonce: dryRunNonce,
  });

  const deployRun = await dispatchAndWaitForWorkflow({
    run,
    repo,
    workflowId: runbook.workflowId,
    artifactName: runbook.artifactName,
    ref: 'main',
    headSha: mainSha,
    inputs: {
      module_path: runbook.modulePath,
      mode: 'dry-run',
      controller_nonce: dryRunNonce,
    },
    nonce: dryRunNonce,
  });

  if (deployRun.result.conclusion !== 'success') {
    return {
      ok: false,
      state: REMOTE_GATE_STATE.FAILED,
      stage: 'dry-run',
      runbook,
      deployRun,
      blocker: `remote_deploy_failed run_id=${deployRun.runId} conclusion=${deployRun.result.conclusion || deployRun.runConclusion || 'unknown'}`,
      failureCode: deployRun.result.failureCode || null,
      failureReason: deployRun.result.failureReason || null,
    };
  }

  const responsibilityPath = path.join(repoRoot, runbook.responsibilityDoc);
  const indexPath = path.join(repoRoot, 'docs', 'project', 'index.md');
  const [responsibilityMarkdown, indexMarkdown] = await Promise.all([
    readFile(responsibilityPath, 'utf8'),
    readFile(indexPath, 'utf8'),
  ]);

  const updatedDocs = updateWorkerDeployDocs({
    responsibility: runbook.responsibility,
    responsibilityMarkdown,
    indexMarkdown,
    headSha: mainSha,
    dryRunUrl: deployRun.runUrl,
  });

  await Promise.all([
    writeFile(responsibilityPath, updatedDocs.responsibilityMarkdown),
    writeFile(indexPath, updatedDocs.indexMarkdown),
  ]);

  return {
    ok: true,
    state: REMOTE_GATE_STATE.SUCCEEDED,
    runbook,
    deployRun,
    headSha: mainSha,
    changedFiles: [runbook.responsibilityDoc, 'docs/project/index.md'],
  };
}

export async function executeWorkerPublicationRemoteGate({
  target,
  repoRoot,
  mainSha,
  run,
  onStateChange = async () => {},
  repo = defaultRepo,
} = {}) {
  const runbook = workerPublicationRunbooks[target?.responsibility ?? ''];
  if (!runbook) {
    return { ok: false, state: REMOTE_GATE_STATE.FAILED, blocker: 'remote_gate_unsupported' };
  }

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
    artifactName: runbook.artifactName,
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
      failureCode: deployRun.result.failureCode || null,
      failureReason: deployRun.result.failureReason || null,
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
    artifactName: runbook.artifactName,
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
    responsibility: runbook.responsibility,
    modulePath: runbook.modulePath,
    publishedUrl: deployRun.result.publishedUrl,
    headSha: mainSha,
    deployRunId: deployRun.runId,
    deployRunUrl: deployRun.runUrl,
    smokeRunId: smokeRun.runId,
    smokeRunUrl: smokeRun.runUrl,
  });

  const evidencePath = path.join(repoRoot, runbook.evidenceFile);
  const responsibilityPath = path.join(repoRoot, runbook.responsibilityDoc);
  const indexPath = path.join(repoRoot, 'docs', 'project', 'index.md');

  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  const [responsibilityMarkdown, indexMarkdown] = await Promise.all([
    readFile(responsibilityPath, 'utf8'),
    readFile(indexPath, 'utf8'),
  ]);
  const updatedDocs = updateWorkerPublicationDocs({
    responsibility: runbook.responsibility,
    responsibilityMarkdown,
    indexMarkdown,
    publishedUrl: evidence.publishedUrl,
    headSha: evidence.headSha,
    deployRunUrl: evidence.deployRunUrl,
    smokeRunUrl: evidence.smokeRunUrl,
  });
  await Promise.all([
    writeFile(responsibilityPath, updatedDocs.responsibilityMarkdown),
    writeFile(indexPath, updatedDocs.indexMarkdown),
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
      runbook.responsibilityDoc,
      'docs/project/index.md',
    ],
  };
}

export async function executeDatabaseValidationRemoteGate({
  target,
  repoRoot,
  mainSha,
  run,
  onStateChange = async () => {},
  repo = defaultRepo,
} = {}) {
  const runbook = buildDatabaseValidationRunbook(target?.responsibility ?? '', repoRoot);
  if (!runbook) {
    return { ok: false, state: REMOTE_GATE_STATE.FAILED, blocker: 'remote_gate_unsupported' };
  }

  const validationNonce = buildWorkflowDispatchNonce({
    responsibility: runbook.responsibility,
    cycle: runbook.cycle,
    stage: 'validate',
  });

  await onStateChange({
    state: REMOTE_GATE_STATE.RUNNING_DATABASE,
    stage: 'validate',
    nonce: validationNonce,
    databaseName: runbook.databaseName,
  });

  const validationRun = await dispatchAndWaitForWorkflow({
    run,
    repo,
    workflowId: runbook.workflowId,
    artifactName: runbook.artifactName,
    resultFileName: runbook.resultFileName,
    resultParser: parseDatabaseGateResult,
    ref: 'main',
    headSha: mainSha,
    inputs: {
      module_path: runbook.modulePath,
      mode: 'validate',
      controller_nonce: validationNonce,
    },
    nonce: validationNonce,
  });

  if (validationRun.result.conclusion !== 'success') {
    return {
      ok: false,
      state: REMOTE_GATE_STATE.FAILED,
      stage: 'validate',
      runbook,
      validationRun,
      blocker: `remote_database_validation_failed run_id=${validationRun.runId} conclusion=${validationRun.result.conclusion || validationRun.runConclusion || 'unknown'}`,
      failureCode: validationRun.result.failureCode || null,
      failureReason: validationRun.result.failureReason || null,
    };
  }

  const evidence = buildDatabaseValidationEvidence({
    responsibility: runbook.responsibility,
    modulePath: runbook.modulePath,
    binding: runbook.binding,
    databaseName: runbook.databaseName,
    headSha: mainSha,
    runId: validationRun.runId,
    runUrl: validationRun.runUrl,
    controllerNonce: validationNonce,
    migrationFiles: validationRun.result.migrationFiles.length > 0 ? validationRun.result.migrationFiles : runbook.migrationFiles,
    seedFiles: validationRun.result.seedFiles.length > 0 ? validationRun.result.seedFiles : runbook.seedFiles,
    fixtureFiles: validationRun.result.fixtureFiles.length > 0 ? validationRun.result.fixtureFiles : runbook.fixtureFiles,
    rollbackFiles: validationRun.result.rollbackFiles.length > 0 ? validationRun.result.rollbackFiles : runbook.rollbackFiles,
    steps: validationRun.result.steps,
    validatedAt: validationRun.result.validatedAt,
  });

  const evidencePath = path.join(repoRoot, runbook.evidenceFile);
  const responsibilityPath = path.join(repoRoot, runbook.responsibilityDoc);
  const indexPath = path.join(repoRoot, 'docs', 'project', 'index.md');
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  const [responsibilityMarkdown, indexMarkdown] = await Promise.all([
    readFile(responsibilityPath, 'utf8'),
    readFile(indexPath, 'utf8'),
  ]);
  const updatedDocs = updateDatabaseValidationDocs({
    responsibility: runbook.responsibility,
    responsibilityMarkdown,
    indexMarkdown,
    headSha: evidence.headSha,
    runUrl: evidence.runUrl,
  });
  await Promise.all([
    writeFile(responsibilityPath, updatedDocs.responsibilityMarkdown),
    writeFile(indexPath, updatedDocs.indexMarkdown),
  ]);

  const validate = await run(
    `cd ${shellQuote(path.join(repoRoot, runbook.modulePath))} && ANEETY_D1_VALIDATION_EVIDENCE_FILE=d1-validation-evidence.json npm run db:evidence:validate`,
  );
  assertResultOk(validate, 'd1_validation_evidence_failed');

  return {
    ok: true,
    state: REMOTE_GATE_STATE.SUCCEEDED,
    runbook,
    validationRun,
    evidence,
    changedFiles: [
      runbook.evidenceFile,
      runbook.responsibilityDoc,
      'docs/project/index.md',
    ],
  };
}

async function dispatchAndWaitForWorkflow({
  run,
  repo,
  workflowId,
  artifactName,
  resultFileName = 'cloudflare-gate-result.json',
  resultParser = parseRemoteGateResult,
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
    artifactName,
    resultFileName,
    resultParser,
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

async function downloadWorkflowArtifactResult({ run, repo, runId, artifactName, resultFileName, resultParser }) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'aneety-cloudflare-gate-'));
  try {
    const download = await run(
      `${ghCommand(`run download ${shellQuote(String(runId))} --repo ${shellQuote(repo)} -n ${shellQuote(artifactName)} -D ${shellQuote(tmpDir)}`)}`,
    );
    assertResultOk(download, `workflow_artifact_download_failed_${runId}`);

    const resultPath = path.join(tmpDir, resultFileName);
    const payload = await readFile(resultPath, 'utf8');
    return resultParser(payload);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function delay(seconds) {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
