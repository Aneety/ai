import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { CYCLE_ORDER } from '../controller-constants.mjs';
import { loadControllerBacklog, resolveNextBacklogTarget } from '../controller-backlog.mjs';

function row(cycle, status = 'triagem', priority = 'alta', blocker = '—', nextAction = 'Executar.') {
  return `| \`${cycle}\` | \`${status}\` | ${priority} | \`gate\` | — | ${blocker} | ${nextAction} |`;
}

async function createFixture({ indexRows, responsibilityRows }) {
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
  const planningMarkdown = `# Planejamento\n\n| Responsabilidade | Tabelas cobertas | Responsabilidade raiz | Caminho no monorepo | Ciclos obrigatórios | Aceite e evidência base |\n| --- | --- | --- | --- | --- | --- |\n${planningRows}\n`;
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

test('classifica gateway-borda/publicacao bloqueado como remote_automable', async () => {
  const root = await createFixture({
    indexRows: [
      '| `gateway-borda` | Ricardo | alta | `publicacao` | `bloqueado` | [gateway-borda](./gateway-borda.md) | — | Falta URL remota |',
    ],
    responsibilityRows: {
      'gateway-borda': {
        repositorio: { status: 'concluido' },
        deploy: { status: 'concluido' },
        publicacao: { status: 'bloqueado', blocker: 'Aguardando deploy remoto.' },
      },
    },
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
