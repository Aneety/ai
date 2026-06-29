import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  extractContractVersionFromWrangler,
  moduleHasPublishedSmokeScript,
  resolveSmokeContext,
  runPublicationSmoke,
} from '../validate-publication-smoke.mjs';

test('extractContractVersionFromWrangler lê a versão pública do wrangler', () => {
  const version = extractContractVersionFromWrangler(`name = "worker-tenant-white-label"\nANEETY_CONTRACT_VERSION = "2026-06-01.tenant-white-label.deploy.v1"\n`);
  assert.equal(version, '2026-06-01.tenant-white-label.deploy.v1');
});

test('resolveSmokeContext monta URLs health/contract a partir da URL publicada', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'aneety-smoke-context-'));
  try {
    const modulePath = 'aneety-platform/apps/tenant-white-label/worker-tenant-white-label';
    const wranglerPath = path.join(tempDir, modulePath, 'wrangler.toml');
    await mkdir(path.dirname(wranglerPath), { recursive: true });
    await writeFile(wranglerPath, 'ANEETY_CONTRACT_VERSION = "2026-06-01.tenant-white-label.deploy.v1"\n');
    const context = await resolveSmokeContext({
      publishedUrl: 'https://worker-tenant-white-label.example.workers.dev/base',
      modulePath,
      repoRoot: tempDir,
    });
    assert.equal(context.contractVersion, '2026-06-01.tenant-white-label.deploy.v1');
    assert.equal(context.healthUrl, 'https://worker-tenant-white-label.example.workers.dev/health');
    assert.equal(context.contractUrl, 'https://worker-tenant-white-label.example.workers.dev/contract');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('runPublicationSmoke valida /health e /contract com header de versão', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'aneety-smoke-run-'));
  try {
    const modulePath = 'aneety-platform/apps/tenant-white-label/worker-tenant-white-label';
    const wranglerDir = path.join(tempDir, modulePath);
    await mkdir(wranglerDir, { recursive: true });
    await writeFile(path.join(wranglerDir, 'wrangler.toml'), 'ANEETY_CONTRACT_VERSION = "2026-06-01.tenant-white-label.deploy.v1"\n');

    const calls = [];
    const fetchImpl = async (url, init = {}) => {
      calls.push({ url, init });
      if (url.endsWith('/health')) {
        return new Response(JSON.stringify({ ok: true, contractVersion: '2026-06-01.tenant-white-label.deploy.v1' }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-aneety-contract-version': '2026-06-01.tenant-white-label.deploy.v1',
            'x-aneety-request-id': 'req-health',
          },
        });
      }
      if (url.endsWith('/contract')) {
        return new Response(JSON.stringify({ contractVersion: '2026-06-01.tenant-white-label.deploy.v1', routes: [] }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-aneety-contract-version': '2026-06-01.tenant-white-label.deploy.v1',
            'x-aneety-request-id': 'req-contract',
          },
        });
      }
      throw new Error(`unexpected_url:${url}`);
    };

    const result = await runPublicationSmoke({
      publishedUrl: 'https://worker-tenant-white-label.example.workers.dev',
      modulePath,
      repoRoot: tempDir,
      fetchImpl,
    });

    assert.equal(result.contractVersion, '2026-06-01.tenant-white-label.deploy.v1');
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://worker-tenant-white-label.example.workers.dev/health');
    assert.equal(calls[1].url, 'https://worker-tenant-white-label.example.workers.dev/contract');
    assert.equal(calls[1].init.headers['x-aneety-contract-version'], '2026-06-01.tenant-white-label.deploy.v1');
    assert.equal(result.routes.health.status, 200);
    assert.equal(result.routes.contract.status, 200);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('moduleHasPublishedSmokeScript detecta smoke funcional específico do módulo PDF', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'aneety-smoke-script-'));
  try {
    const pdfModulePath = 'aneety-platform/apps/relatorios-operacionais/worker-relatorios';
    const genericModulePath = 'aneety-platform/apps/tenant-white-label/worker-tenant-white-label';
    await mkdir(path.join(tempDir, pdfModulePath), { recursive: true });
    await mkdir(path.join(tempDir, genericModulePath), { recursive: true });
    await writeFile(
      path.join(tempDir, pdfModulePath, 'package.json'),
      JSON.stringify({ scripts: { 'smoke:published': 'node scripts/smoke-pdf.mjs' } }),
    );
    await writeFile(path.join(tempDir, genericModulePath, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));

    assert.equal(await moduleHasPublishedSmokeScript({ modulePath: pdfModulePath, repoRoot: tempDir }), true);
    assert.equal(await moduleHasPublishedSmokeScript({ modulePath: genericModulePath, repoRoot: tempDir }), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
