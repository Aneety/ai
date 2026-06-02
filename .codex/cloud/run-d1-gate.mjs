import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

function assertNonEmptyString(value, label) {
  assert.equal(typeof value, 'string', `${label} must be a string.`);
  assert.ok(value.trim(), `${label} must not be empty.`);
  return value.trim();
}

function toPosixRelative(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

async function listSqlFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => path.join(dirPath, entry.name))
    .sort();
}

export function sanitizeD1DatabaseName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildEphemeralDatabaseName(databaseName, controllerNonce, maxLength = 64) {
  const base = sanitizeD1DatabaseName(databaseName) || 'aneety-d1';
  const sanitizedNonce = sanitizeD1DatabaseName(controllerNonce) || 'validation';
  const nonceHash = createHash('sha256').update(sanitizedNonce).digest('hex').slice(0, 8);
  const humanNonceMaxLength = 24;
  const humanNonce = sanitizedNonce.slice(0, humanNonceMaxLength).replace(/-+$/g, '') || 'validation';
  const suffix = `${humanNonce}-${nonceHash}`;
  const separator = '-';
  const allowedBaseLength = Math.max(maxLength - suffix.length - separator.length, 8);
  const trimmedBase = base.slice(0, allowedBaseLength).replace(/-+$/g, '') || 'aneety-d1';
  return `${trimmedBase}${separator}${suffix}`;
}

export function buildD1DeleteArgs(databaseName) {
  return ['--yes', 'wrangler@latest', 'd1', 'delete', assertNonEmptyString(databaseName, 'databaseName'), '--skip-confirmation'];
}

export function parseD1ListJson(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
  assert.ok(Array.isArray(data), 'D1 list payload must be an array.');
  return data.map((item) => ({
    uuid: String(item.uuid ?? item.id ?? '').trim(),
    name: String(item.name ?? '').trim(),
  }));
}

async function runCommand(command, args, options = {}) {
  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });
    child.on('close', (code) => {
      resolve({ code: code ?? 0, stdout, stderr, output: `${stdout}${stderr}` });
    });
  });
}

function step(status, detail = '') {
  return { status, detail: detail ? String(detail).trim().slice(0, 500) : '' };
}

function setFailure(result, code, reason, stepName) {
  result.conclusion = 'failure';
  result.failureCode = code;
  result.failureReason = reason;
  if (stepName && result.steps[stepName] && result.steps[stepName].status !== 'success') {
    result.steps[stepName] = step('failed', reason);
  }
}

async function main() {
  const workspace = process.env.GITHUB_WORKSPACE ? path.resolve(process.env.GITHUB_WORKSPACE) : process.cwd();
  const modulePath = assertNonEmptyString(process.env.REQUESTED_MODULE_PATH, 'REQUESTED_MODULE_PATH');
  const controllerNonce = assertNonEmptyString(process.env.CONTROLLER_NONCE || 'manual-validation', 'CONTROLLER_NONCE');
  const gateResultPath = assertNonEmptyString(process.env.GATE_RESULT_PATH, 'GATE_RESULT_PATH');
  const moduleDir = path.resolve(workspace, modulePath);
  const contractPath = path.join(moduleDir, 'contracts', 'storage-contract.json');
  const result = {
    mode: 'validate',
    modulePath,
    headSha: process.env.GITHUB_SHA ?? '',
    runId: process.env.GITHUB_RUN_ID ?? '',
    runUrl: process.env.GITHUB_RUN_ID
      ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
      : '',
    conclusion: 'pending',
    controllerNonce,
    failureCode: '',
    failureReason: '',
    responsibility: '',
    cycle: 'banco',
    runtime: '',
    binding: '',
    databaseName: '',
    ephemeralDatabaseName: '',
    migrationFiles: [],
    seedFiles: [],
    fixtureFiles: [],
    rollbackFiles: [],
    steps: {
      validate: step('skipped'),
      create: step('skipped'),
      migrate: step('skipped'),
      seed: step('skipped'),
      fixture: step('skipped'),
      rollback: step('skipped'),
      cleanup: step('skipped'),
    },
    validatedAt: '',
  };

  let tempDatabaseName = '';
  let tempConfigDir = '';
  let tempConfigPath = '';

  try {
    const contract = JSON.parse(await readFile(contractPath, 'utf8'));
    result.responsibility = assertNonEmptyString(contract.responsibility, 'contract.responsibility');
    assert.equal(contract.cycle, 'banco', 'contract.cycle must be banco.');
    assert.equal(contract.runtime, 'cloudflare-workers', 'contract.runtime must be cloudflare-workers.');
    assert.equal(contract.storage?.type, 'd1', 'contract.storage.type must be d1.');
    result.runtime = contract.runtime;
    result.binding = assertNonEmptyString(contract.storage?.binding, 'contract.storage.binding');
    result.databaseName = assertNonEmptyString(contract.storage?.databaseName, 'contract.storage.databaseName');

    const migrationDir = path.join(moduleDir, assertNonEmptyString(contract.storage?.migrationDirectory, 'contract.storage.migrationDirectory'));
    const seedDir = path.join(moduleDir, assertNonEmptyString(contract.storage?.seedDirectory, 'contract.storage.seedDirectory'));
    const rollbackDir = path.join(moduleDir, assertNonEmptyString(contract.storage?.rollbackDirectory, 'contract.storage.rollbackDirectory'));
    const testsDir = path.join(moduleDir, 'tests');

    const [migrationFiles, seedFiles, rollbackFiles, fixtureFiles] = await Promise.all([
      listSqlFiles(migrationDir),
      listSqlFiles(seedDir),
      listSqlFiles(rollbackDir),
      listSqlFiles(testsDir),
    ]);

    result.migrationFiles = migrationFiles.map((item) => toPosixRelative(moduleDir, item));
    result.seedFiles = seedFiles.map((item) => toPosixRelative(moduleDir, item));
    result.rollbackFiles = rollbackFiles.map((item) => toPosixRelative(moduleDir, item));
    result.fixtureFiles = fixtureFiles
      .filter((item) => item.endsWith('.sql'))
      .map((item) => toPosixRelative(moduleDir, item));

    const installCmd = await runCommand('bash', ['-lc', 'if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then npm ci; else npm install; fi'], {
      cwd: moduleDir,
      env: process.env,
    });
    if (installCmd.code !== 0) {
      setFailure(result, 'db_module_install_failed', 'npm install/ci failed for db module.', 'validate');
      return;
    }

    const validate = await runCommand('npm', ['run', 'db:validate'], {
      cwd: moduleDir,
      env: process.env,
    });
    if (validate.code !== 0) {
      setFailure(result, 'db_contract_validation_failed', 'Local db:validate failed.', 'validate');
      return;
    }
    result.steps.validate = step('success', 'npm run db:validate completed.');

    tempDatabaseName = buildEphemeralDatabaseName(result.databaseName, controllerNonce);
    result.ephemeralDatabaseName = tempDatabaseName;

    const create = await runCommand('npx', ['--yes', 'wrangler@latest', 'd1', 'create', tempDatabaseName], {
      cwd: workspace,
      env: process.env,
    });
    if (create.code !== 0) {
      setFailure(result, 'd1_database_create_failed', `Could not create ephemeral D1 database ${tempDatabaseName}.`, 'create');
      return;
    }

    const list = await runCommand('npx', ['--yes', 'wrangler@latest', 'd1', 'list', '--json'], {
      cwd: workspace,
      env: process.env,
    });
    if (list.code !== 0) {
      setFailure(result, 'd1_database_list_failed', 'Could not list D1 databases after create.', 'create');
      return;
    }

    const database = parseD1ListJson(list.stdout).find((item) => item.name === tempDatabaseName);
    if (!database?.uuid) {
      setFailure(result, 'd1_database_not_found', `Ephemeral D1 database ${tempDatabaseName} not found after create.`, 'create');
      return;
    }
    result.steps.create = step('success', `Ephemeral D1 database ${tempDatabaseName} created.`);

    tempConfigDir = await mkdtemp(path.join(os.tmpdir(), 'aneety-d1-gate-'));
    tempConfigPath = path.join(tempConfigDir, 'wrangler.jsonc');
    await writeFile(
      tempConfigPath,
      `${JSON.stringify({
        name: 'aneety-d1-gate',
        compatibility_date: '2026-06-02',
        d1_databases: [
          {
            binding: result.binding,
            database_name: tempDatabaseName,
            database_id: database.uuid,
            migrations_dir: assertNonEmptyString(contract.storage.migrationDirectory, 'contract.storage.migrationDirectory'),
          },
        ],
      }, null, 2)}\n`,
    );

    const migrate = await runCommand(
      'npx',
      ['--yes', 'wrangler@latest', 'd1', 'migrations', 'apply', tempDatabaseName, '--remote', '--config', tempConfigPath],
      { cwd: moduleDir, env: process.env },
    );
    if (migrate.code !== 0) {
      setFailure(result, 'd1_migrations_apply_failed', 'Remote D1 migration apply failed.', 'migrate');
      return;
    }
    result.steps.migrate = step('success', `Applied ${result.migrationFiles.length} migration file(s).`);

    for (const relativeSeedFile of result.seedFiles) {
      const seed = await runCommand(
        'npx',
        ['--yes', 'wrangler@latest', 'd1', 'execute', tempDatabaseName, '--remote', '--yes', '--file', path.join(moduleDir, relativeSeedFile), '--json'],
        { cwd: moduleDir, env: process.env },
      );
      if (seed.code !== 0) {
        setFailure(result, 'd1_seed_failed', `Remote D1 seed failed for ${relativeSeedFile}.`, 'seed');
        return;
      }
    }
    result.steps.seed = step('success', `Executed ${result.seedFiles.length} seed file(s).`);

    for (const relativeFixtureFile of result.fixtureFiles) {
      const fixture = await runCommand(
        'npx',
        ['--yes', 'wrangler@latest', 'd1', 'execute', tempDatabaseName, '--remote', '--yes', '--file', path.join(moduleDir, relativeFixtureFile), '--json'],
        { cwd: moduleDir, env: process.env },
      );
      if (fixture.code !== 0) {
        setFailure(result, 'd1_fixture_failed', `Remote D1 fixture failed for ${relativeFixtureFile}.`, 'fixture');
        return;
      }
    }
    result.steps.fixture = step('success', `Executed ${result.fixtureFiles.length} fixture file(s).`);

    for (const relativeRollbackFile of result.rollbackFiles) {
      const rollback = await runCommand(
        'npx',
        ['--yes', 'wrangler@latest', 'd1', 'execute', tempDatabaseName, '--remote', '--yes', '--file', path.join(moduleDir, relativeRollbackFile), '--json'],
        { cwd: moduleDir, env: process.env },
      );
      if (rollback.code !== 0) {
        setFailure(result, 'd1_rollback_failed', `Remote D1 rollback failed for ${relativeRollbackFile}.`, 'rollback');
        return;
      }
    }
    result.steps.rollback = step('success', `Executed ${result.rollbackFiles.length} rollback file(s).`);

    result.conclusion = 'success';
  } catch (error) {
    setFailure(result, 'd1_gate_unhandled_error', error instanceof Error ? error.message : String(error), 'validate');
  } finally {
    if (tempDatabaseName) {
      const cleanup = await runCommand('npx', buildD1DeleteArgs(tempDatabaseName), {
        cwd: workspace,
        env: process.env,
      });
      if (cleanup.code === 0) {
        result.steps.cleanup = step('success', `Deleted ephemeral D1 database ${tempDatabaseName}.`);
      } else {
        result.steps.cleanup = step('failed', `Could not delete ephemeral D1 database ${tempDatabaseName}.`);
        if (result.conclusion === 'success') {
          result.conclusion = 'failure';
          result.failureCode = 'd1_cleanup_failed';
          result.failureReason = `Could not delete ephemeral D1 database ${tempDatabaseName}.`;
        }
      }
    }

    result.validatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    if (tempConfigDir) {
      await rm(tempConfigDir, { recursive: true, force: true });
    }
    await writeFile(gateResultPath, `${JSON.stringify(result, null, 2)}\n`);
    if (result.conclusion !== 'success') {
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
