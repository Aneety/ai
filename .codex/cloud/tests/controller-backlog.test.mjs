import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { CYCLE_ORDER } from '../controller-constants.mjs';
import {
  loadControllerBacklog,
  resolveNextBacklogTarget,
  resolveParallelBacklogTargets,
} from '../controller-backlog.mjs';

function row(cycle, status = 'triagem', priority = 'alta', blocker = '—', nextAction = 'Executar.') {
  return `| \`${cycle}\` | \`${status}\` | ${priority} | \`gate\` | — | ${blocker} | ${nextAction} |`;
}

async function createFixture({ indexRows, responsibilityRows, dependencyRows = [], extraFiles = {} }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aneety-controller-backlog-'));
  await mkdir(path.join(root, 'docs', 'project'), { recursive: true });

  const indexMarkdown = `# Painel\n\n## Visão executiva\n\n| Responsabilidade | Owner | Prioridade | Ciclo ativo | Status | Arquivo | Evidência atual | Bloqueio |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${indexRows.join('\n')}\n`;
  await writeFile(path.join(root, 'docs', 'project', 'index.md'), indexMarkdown);

  const planningRows = Object.keys(responsibilityRows)
    .map(
      (responsibility) =>
        `| \`${responsibility}\` | tabela | \`${responsibility}\` | \`aneety-platform/apps/${responsibility}\` | ${CYCLE_ORDER.map((cycle) => `\`${cycle}\``).join(', ')} | aceite |`,
    )
    .join('\n');
  const dependencySection =
    dependencyRows.length > 0
      ? `\n## Dependências automáveis do scheduler\n\n| Responsabilidade alvo | Ciclo alvo | Dependências mínimas | Regra operacional |\n| --- | --- | --- | --- |\n${dependencyRows.join('\n')}\n`
      : '';
  const planningMarkdown = `# Planejamento\n\n| Responsabilidade | Tabelas cobertas | Responsabilidade raiz | Caminho no monorepo | Ciclos obrigatórios | Aceite e evidência base |\n| --- | --- | --- | --- | --- | --- |\n${planningRows}\n${dependencySection}`;
  await writeFile(path.join(root, 'docs', '08-planejamento-ciclos-implementacao-repositorios.md'), planningMarkdown);

  for (const [responsibility, cycleStatuses] of Object.entries(responsibilityRows)) {
    const rows = CYCLE_ORDER.map((cycle) => {
      const config = cycleStatuses[cycle] ?? {};
      return row(
        cycle,
        config.status ?? 'triagem',
        config.priority ?? 'alta',
        config.blocker ?? '—',
        config.nextAction ?? `Executar ${cycle}.`,
      );
    }).join('\n');

    const markdown = `# ${responsibility}\n\n## Status operacional por ciclo\n\n| Ciclo | Status | Prioridade | Gate | Evidência | Bloqueio | Próxima ação |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows}\n`;
    await writeFile(path.join(root, 'docs', 'project', `${responsibility}.md`), markdown);
  }

  for (const [relativePath, content] of Object.entries(extraFiles)) {
    const targetPath = path.join(root, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content);
  }

  return root;
}

test('pausa quando encontra ciclo em bloqueado', async () => {
  const root = await createFixture({
    indexRows: [
      '| `alta-a` | Ricardo | alta | `repositorio` | `bloqueado` | [alta-a](./alta-a.md) | — | Estrutural |',
      '| `media-b` | Ricardo | media | `repositorio` | `bloqueado` | [media-b](./media-b.md) | — | Estrutural |',
    ],
    responsibilityRows: {
      'alta-a': {
        repositorio: { status: 'bloqueado', blocker: 'Sem raiz canônica.' },
      },
      'media-b': {
        repositorio: { status: 'bloqueado', blocker: 'Sem raiz canônica.' },
      },
    },
  });

  try {
    const backlog = await loadControllerBacklog(root);
    const target = resolveNextBacklogTarget(backlog);
    assert.equal(target.state, 'blocked');
    assert.equal(target.blockKind, 'pause');
    assert.equal(target.blockerAutomationKind, 'manual_external');
    assert.equal(target.pauseStatus, 'bloqueado');
    assert.equal(target.responsibility, 'alta-a');
    assert.equal(target.cycle, 'repositorio');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('pausa quando encontra ciclo em validacao', async () => {
  const root = await createFixture({
    indexRows: [
      '| `alta-a` | Ricardo | alta | `deploy` | `validacao` | [alta-a](./alta-a.md) | — | Aguardando gate |',
    ],
    responsibilityRows: {
      'alta-a': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'validacao', blocker: 'Aguardando gate remoto.' },
      },
    },
  });

  try {
    const backlog = await loadControllerBacklog(root);
    const target = resolveNextBacklogTarget(backlog);
    assert.equal(target.state, 'blocked');
    assert.equal(target.blockKind, 'pause');
    assert.equal(target.blockerAutomationKind, 'manual_external');
    assert.equal(target.pauseStatus, 'validacao');
    assert.equal(target.responsibility, 'alta-a');
    assert.equal(target.cycle, 'deploy');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('marca banco validacao como remote_automable quando contrato D1 existe', async () => {
  const root = await createFixture({
    indexRows: [
      '| `tenant-white-label` | Ricardo | alta | `banco` | `validacao` | [tenant-white-label](./tenant-white-label.md) | — | Aguardando validação D1-backed |',
    ],
    responsibilityRows: {
      'tenant-white-label': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'concluido' },
        banco: { status: 'validacao', blocker: 'Aguardando validação D1-backed.' },
      },
    },
    extraFiles: {
      'aneety-platform/apps/tenant-white-label/db-tenant-white-label/contracts/storage-contract.json': JSON.stringify({
        responsibility: 'tenant-white-label',
        cycle: 'banco',
        runtime: 'cloudflare-workers',
        storage: {
          type: 'd1',
          binding: 'TENANT_WHITE_LABEL_DB',
          databaseName: 'tenant-white-label-db',
          migrationDirectory: 'migrations',
          rollbackDirectory: 'rollbacks',
          seedDirectory: 'seeds',
        },
      }, null, 2),
    },
  });

  try {
    const backlog = await loadControllerBacklog(root);
    const target = resolveNextBacklogTarget(backlog);
    assert.equal(target.state, 'blocked');
    assert.equal(target.blockKind, 'pause');
    assert.equal(target.blockerAutomationKind, 'remote_automable');
    assert.equal(target.responsibility, 'tenant-white-label');
    assert.equal(target.cycle, 'banco');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('preempta gateway-borda/publicacao para primeira dependencia com publicacao pronta', async () => {
  const root = await createFixture({
    indexRows: [
      '| `gateway-borda` | Ricardo | alta | `publicacao` | `bloqueado` | [gateway-borda](./gateway-borda.md) | — | Falta URL remota |',
      '| `tenant-white-label` | Ricardo | alta | `publicacao` | `pronto` | [tenant-white-label](./tenant-white-label.md) | — | — |',
      '| `identidade-acesso` | Ricardo | alta | `publicacao` | `pronto` | [identidade-acesso](./identidade-acesso.md) | — | — |',
      '| `onboarding-acesso` | Ricardo | alta | `publicacao` | `pronto` | [onboarding-acesso](./onboarding-acesso.md) | — | — |',
    ],
    responsibilityRows: {
      'gateway-borda': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'bloqueado', blocker: 'Aguardando deploy remoto.' },
      },
      'tenant-white-label': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'pronto' },
      },
      'identidade-acesso': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'pronto' },
      },
      'onboarding-acesso': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'pronto' },
      },
    },
    dependencyRows: [
      '| `gateway-borda` | `publicacao` | `tenant-white-label/publicacao`, `identidade-acesso/publicacao`, `onboarding-acesso/publicacao` | Preemptar dependências antes do remote gate. |',
    ],
  });

  try {
    const backlog = await loadControllerBacklog(root);
    const target = resolveNextBacklogTarget(backlog);
    assert.equal(target.state, 'actionable');
    assert.equal(target.responsibility, 'tenant-white-label');
    assert.equal(target.cycle, 'publicacao');
    assert.equal(target.dependencyParentResponsibility, 'gateway-borda');
    assert.equal(target.dependencyParentCycle, 'publicacao');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('avanca para proxima dependencia depois da primeira publicacao concluida', async () => {
  const root = await createFixture({
    indexRows: [
      '| `gateway-borda` | Ricardo | alta | `publicacao` | `bloqueado` | [gateway-borda](./gateway-borda.md) | — | Falta URL remota |',
      '| `tenant-white-label` | Ricardo | alta | `publicacao` | `concluido` | [tenant-white-label](./tenant-white-label.md) | — | — |',
      '| `identidade-acesso` | Ricardo | alta | `publicacao` | `pronto` | [identidade-acesso](./identidade-acesso.md) | — | — |',
      '| `onboarding-acesso` | Ricardo | alta | `publicacao` | `pronto` | [onboarding-acesso](./onboarding-acesso.md) | — | — |',
    ],
    responsibilityRows: {
      'gateway-borda': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'bloqueado', blocker: 'Aguardando deploy remoto.' },
      },
      'tenant-white-label': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'concluido' },
      },
      'identidade-acesso': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'pronto' },
      },
      'onboarding-acesso': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'pronto' },
      },
    },
    dependencyRows: [
      '| `gateway-borda` | `publicacao` | `tenant-white-label/publicacao`, `identidade-acesso/publicacao`, `onboarding-acesso/publicacao` | Preemptar dependências antes do remote gate. |',
    ],
  });

  try {
    const backlog = await loadControllerBacklog(root);
    const target = resolveNextBacklogTarget(backlog);
    assert.equal(target.state, 'actionable');
    assert.equal(target.responsibility, 'identidade-acesso');
    assert.equal(target.cycle, 'publicacao');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('retorna ao gateway/publicacao quando as tres publicacoes dependentes estao concluidas', async () => {
  const root = await createFixture({
    indexRows: [
      '| `gateway-borda` | Ricardo | alta | `publicacao` | `bloqueado` | [gateway-borda](./gateway-borda.md) | — | Falta URL remota |',
      '| `tenant-white-label` | Ricardo | alta | `publicacao` | `concluido` | [tenant-white-label](./tenant-white-label.md) | — | — |',
      '| `identidade-acesso` | Ricardo | alta | `publicacao` | `concluido` | [identidade-acesso](./identidade-acesso.md) | — | — |',
      '| `onboarding-acesso` | Ricardo | alta | `publicacao` | `concluido` | [onboarding-acesso](./onboarding-acesso.md) | — | — |',
    ],
    responsibilityRows: {
      'gateway-borda': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'bloqueado', blocker: 'Aguardando deploy remoto.' },
      },
      'tenant-white-label': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'concluido' },
      },
      'identidade-acesso': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'concluido' },
      },
      'onboarding-acesso': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'concluido' },
      },
    },
    dependencyRows: [
      '| `gateway-borda` | `publicacao` | `tenant-white-label/publicacao`, `identidade-acesso/publicacao`, `onboarding-acesso/publicacao` | Preemptar dependências antes do remote gate. |',
    ],
  });

  try {
    const backlog = await loadControllerBacklog(root);
    const target = resolveNextBacklogTarget(backlog);
    assert.equal(target.state, 'blocked');
    assert.equal(target.blockKind, 'pause');
    assert.equal(target.blockerAutomationKind, 'remote_automable');
    assert.equal(target.responsibility, 'gateway-borda');
    assert.equal(target.cycle, 'publicacao');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('preempta gateway-borda/backend para proximo ciclo pendente da primeira dependencia', async () => {
  const root = await createFixture({
    indexRows: [
      '| `gateway-borda` | Ricardo | alta | `backend` | `bloqueado` | [gateway-borda](./gateway-borda.md) | — | BFFs dependentes ainda não concluíram backend |',
      '| `tenant-white-label` | Ricardo | alta | `banco` | `validacao` | [tenant-white-label](./tenant-white-label.md) | — | Aguardando validação D1-backed |',
      '| `identidade-acesso` | Ricardo | alta | `banco` | `validacao` | [identidade-acesso](./identidade-acesso.md) | — | Aguardando validação D1-backed |',
      '| `onboarding-acesso` | Ricardo | alta | `banco` | `validacao` | [onboarding-acesso](./onboarding-acesso.md) | — | Aguardando validação D1-backed |',
    ],
    responsibilityRows: {
      'gateway-borda': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'concluido' },
        banco: { status: 'concluido' },
        jobs: { status: 'concluido' },
        backend: { status: 'bloqueado', blocker: 'BFFs dependentes ainda não concluíram backend.' },
      },
      'tenant-white-label': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'concluido' },
        banco: { status: 'validacao', blocker: 'Aguardando validação D1-backed.' },
      },
      'identidade-acesso': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'concluido' },
        banco: { status: 'validacao', blocker: 'Aguardando validação D1-backed.' },
      },
      'onboarding-acesso': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'concluido' },
        banco: { status: 'validacao', blocker: 'Aguardando validação D1-backed.' },
      },
    },
    dependencyRows: [
      '| `gateway-borda` | `backend` | `tenant-white-label`, `identidade-acesso`, `onboarding-acesso` | Preemptar proximo ciclo pendente da dependencia antes do backend do gateway. |',
    ],
    extraFiles: {
      'aneety-platform/apps/tenant-white-label/db-tenant-white-label/contracts/storage-contract.json': JSON.stringify({
        responsibility: 'tenant-white-label',
        cycle: 'banco',
        runtime: 'cloudflare-workers',
        storage: { type: 'd1', binding: 'TENANT_WHITE_LABEL_DB', databaseName: 'tenant-white-label-db', migrationDirectory: 'migrations', rollbackDirectory: 'rollbacks', seedDirectory: 'seeds' },
      }, null, 2),
      'aneety-platform/apps/identidade-acesso/db-identidade-acesso/contracts/storage-contract.json': JSON.stringify({
        responsibility: 'identidade-acesso',
        cycle: 'banco',
        runtime: 'cloudflare-workers',
        storage: { type: 'd1', binding: 'IDENTIDADE_ACESSO_DB', databaseName: 'identidade-acesso-db', migrationDirectory: 'migrations', rollbackDirectory: 'rollbacks', seedDirectory: 'seeds' },
      }, null, 2),
      'aneety-platform/apps/onboarding-acesso/db-onboarding-acesso/contracts/storage-contract.json': JSON.stringify({
        responsibility: 'onboarding-acesso',
        cycle: 'banco',
        runtime: 'cloudflare-workers',
        storage: { type: 'd1', binding: 'ONBOARDING_ACESSO_DB', databaseName: 'onboarding-acesso-db', migrationDirectory: 'migrations', rollbackDirectory: 'rollbacks', seedDirectory: 'seeds' },
      }, null, 2),
    },
  });

  try {
    const backlog = await loadControllerBacklog(root);
    const target = resolveNextBacklogTarget(backlog);
    assert.equal(target.state, 'blocked');
    assert.equal(target.responsibility, 'tenant-white-label');
    assert.equal(target.cycle, 'banco');
    assert.equal(target.blockerAutomationKind, 'remote_automable');
    assert.equal(target.dependencyParentResponsibility, 'gateway-borda');
    assert.equal(target.dependencyParentCycle, 'backend');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('depois de banco concluido preempta gateway-borda/backend para backend da mesma dependencia', async () => {
  const root = await createFixture({
    indexRows: [
      '| `gateway-borda` | Ricardo | alta | `backend` | `bloqueado` | [gateway-borda](./gateway-borda.md) | — | BFFs dependentes ainda não concluíram backend |',
      '| `tenant-white-label` | Ricardo | alta | `backend` | `triagem` | [tenant-white-label](./tenant-white-label.md) | — | Aguardando backend |',
      '| `identidade-acesso` | Ricardo | alta | `banco` | `validacao` | [identidade-acesso](./identidade-acesso.md) | — | Aguardando validação D1-backed |',
      '| `onboarding-acesso` | Ricardo | alta | `banco` | `validacao` | [onboarding-acesso](./onboarding-acesso.md) | — | Aguardando validação D1-backed |',
    ],
    responsibilityRows: {
      'gateway-borda': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'concluido' },
        banco: { status: 'concluido' },
        jobs: { status: 'concluido' },
        backend: { status: 'bloqueado', blocker: 'BFFs dependentes ainda não concluíram backend.' },
      },
      'tenant-white-label': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'concluido' },
        banco: { status: 'concluido' },
        jobs: { status: 'na' },
        backend: { status: 'triagem' },
      },
      'identidade-acesso': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'concluido' },
        banco: { status: 'validacao', blocker: 'Aguardando validação D1-backed.' },
      },
      'onboarding-acesso': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'concluido' },
        banco: { status: 'validacao', blocker: 'Aguardando validação D1-backed.' },
      },
    },
    dependencyRows: [
      '| `gateway-borda` | `backend` | `tenant-white-label`, `identidade-acesso`, `onboarding-acesso` | Preemptar proximo ciclo pendente da dependencia antes do backend do gateway. |',
    ],
    extraFiles: {
      'aneety-platform/apps/identidade-acesso/db-identidade-acesso/contracts/storage-contract.json': JSON.stringify({
        responsibility: 'identidade-acesso',
        cycle: 'banco',
        runtime: 'cloudflare-workers',
        storage: { type: 'd1', binding: 'IDENTIDADE_ACESSO_DB', databaseName: 'identidade-acesso-db', migrationDirectory: 'migrations', rollbackDirectory: 'rollbacks', seedDirectory: 'seeds' },
      }, null, 2),
      'aneety-platform/apps/onboarding-acesso/db-onboarding-acesso/contracts/storage-contract.json': JSON.stringify({
        responsibility: 'onboarding-acesso',
        cycle: 'banco',
        runtime: 'cloudflare-workers',
        storage: { type: 'd1', binding: 'ONBOARDING_ACESSO_DB', databaseName: 'onboarding-acesso-db', migrationDirectory: 'migrations', rollbackDirectory: 'rollbacks', seedDirectory: 'seeds' },
      }, null, 2),
    },
  });

  try {
    const backlog = await loadControllerBacklog(root);
    const target = resolveNextBacklogTarget(backlog);
    assert.equal(target.state, 'actionable');
    assert.equal(target.responsibility, 'tenant-white-label');
    assert.equal(target.cycle, 'backend');
    assert.equal(target.dependencyParentResponsibility, 'gateway-borda');
    assert.equal(target.dependencyParentCycle, 'backend');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('avança para deploy quando repositorio já está concluido', async () => {
  const root = await createFixture({
    indexRows: [
      '| `tenant-white-label` | Ricardo | alta | `deploy` | `pronto` | [tenant-white-label](./tenant-white-label.md) | PR mergeada | — |',
    ],
    responsibilityRows: {
      'tenant-white-label': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'pronto', blocker: '—' },
      },
    },
  });

  try {
    const backlog = await loadControllerBacklog(root);
    const target = resolveNextBacklogTarget(backlog);
    assert.equal(target.state, 'actionable');
    assert.equal(target.responsibility, 'tenant-white-label');
    assert.equal(target.cycle, 'deploy');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('pula jobs e microfrontend marcados como na', async () => {
  const root = await createFixture({
    indexRows: [
      '| `gateway-borda` | Ricardo | alta | `smoke` | `pronto` | [gateway-borda](./gateway-borda.md) | — | — |',
    ],
    responsibilityRows: {
      'gateway-borda': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'concluido' },
        banco: { status: 'na' },
        jobs: { status: 'na' },
        backend: { status: 'concluido' },
        'teste-integracao-api': { status: 'concluido' },
        microfrontend: { status: 'na' },
        smoke: { status: 'pronto' },
      },
    },
  });

  try {
    const backlog = await loadControllerBacklog(root);
    const target = resolveNextBacklogTarget(backlog);
    assert.equal(target.state, 'actionable');
    assert.equal(target.cycle, 'smoke');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('retorna complete quando tudo está concluido ou na', async () => {
  const root = await createFixture({
    indexRows: [
      '| `gateway-borda` | Ricardo | alta | `governanca` | `concluido` | [gateway-borda](./gateway-borda.md) | — | — |',
    ],
    responsibilityRows: {
      'gateway-borda': Object.fromEntries(
        CYCLE_ORDER.map((cycle) => [cycle, { status: ['banco', 'jobs', 'microfrontend'].includes(cycle) ? 'na' : 'concluido' }]),
      ),
    },
  });

  try {
    const backlog = await loadControllerBacklog(root);
    const target = resolveNextBacklogTarget(backlog);
    assert.equal(target.state, 'complete');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('janela paralela retorna alvos independentes e deduplica dependencia ja selecionada', async () => {
  const root = await createFixture({
    indexRows: [
      '| `gateway-borda` | Ricardo | alta | `publicacao` | `bloqueado` | [gateway-borda](./gateway-borda.md) | — | Dependências pendentes |',
      '| `tenant-white-label` | Ricardo | alta | `publicacao` | `triagem` | [tenant-white-label](./tenant-white-label.md) | — | — |',
      '| `identidade-acesso` | Ricardo | alta | `deploy` | `pronto` | [identidade-acesso](./identidade-acesso.md) | — | — |',
      '| `onboarding-acesso` | Ricardo | alta | `deploy` | `pronto` | [onboarding-acesso](./onboarding-acesso.md) | — | — |',
    ],
    responsibilityRows: {
      'gateway-borda': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'bloqueado', blocker: 'Dependências pendentes.' },
      },
      'tenant-white-label': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'triagem' },
      },
      'identidade-acesso': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'pronto' },
      },
      'onboarding-acesso': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'pronto' },
      },
    },
    dependencyRows: [
      '| `gateway-borda` | `publicacao` | `tenant-white-label/publicacao`, `identidade-acesso/publicacao`, `onboarding-acesso/publicacao` | Preemptar dependências antes do remote gate. |',
    ],
  });

  try {
    const backlog = await loadControllerBacklog(root);
    const window = resolveParallelBacklogTargets(backlog, { limit: 4 });
    assert.deepEqual(
      window.targets.map((target) => `${target.responsibility}/${target.cycle}`).sort(),
      ['identidade-acesso/publicacao', 'onboarding-acesso/publicacao', 'tenant-white-label/publicacao'].sort(),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('janela paralela respeita targets ocupados e marca exclusao por mesma responsabilidade', async () => {
  const root = await createFixture({
    indexRows: [
      '| `tenant-white-label` | Ricardo | alta | `publicacao` | `triagem` | [tenant-white-label](./tenant-white-label.md) | — | — |',
      '| `identidade-acesso` | Ricardo | alta | `deploy` | `pronto` | [identidade-acesso](./identidade-acesso.md) | — | — |',
      '| `onboarding-acesso` | Ricardo | alta | `deploy` | `pronto` | [onboarding-acesso](./onboarding-acesso.md) | — | — |',
    ],
    responsibilityRows: {
      'tenant-white-label': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'triagem' },
      },
      'identidade-acesso': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'pronto' },
      },
      'onboarding-acesso': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'pronto' },
      },
    },
  });

  try {
    const backlog = await loadControllerBacklog(root);
    const occupiedTarget = {
      state: 'actionable',
      responsibility: 'identidade-acesso',
      cycle: 'publicacao',
      cycleRow: { status: 'pronto', gate: 'processo' },
    };
    const window = resolveParallelBacklogTargets(backlog, {
      limit: 4,
      excludeTargets: [occupiedTarget],
    });
    assert.deepEqual(
      window.targets.map((target) => `${target.responsibility}/${target.cycle}`),
      ['tenant-white-label/publicacao', 'onboarding-acesso/publicacao'],
    );
    assert.match(
      window.excluded.map((item) => `${item.responsibility}/${item.reason}`).join(','),
      /identidade-acesso\/same_responsibility|identidade-acesso\/duplicate_active_task/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('falha fechado quando encontra status desconhecido', async () => {
  const root = await createFixture({
    indexRows: [
      '| `gateway-borda` | Ricardo | alta | `deploy` | `misterioso` | [gateway-borda](./gateway-borda.md) | — | — |',
    ],
    responsibilityRows: {
      'gateway-borda': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'misterioso', blocker: 'Status inválido.' },
      },
    },
  });

  try {
    const backlog = await loadControllerBacklog(root);
    const target = resolveNextBacklogTarget(backlog);
    assert.equal(target.state, 'blocked');
    assert.equal(target.blockKind, 'unknown_status');
    assert.equal(target.pauseStatus, 'unknown_status');
    assert.equal(target.responsibility, 'gateway-borda');
    assert.equal(target.cycle, 'deploy');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
