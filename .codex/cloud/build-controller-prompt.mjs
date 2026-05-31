#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildActionableSignature, loadControllerBacklog, resolveNextBacklogTarget } from './controller-backlog.mjs';

function fail(message) {
  console.error(`[codex-cloud-prompt] ${message}`);
  process.exit(1);
}

function formatMatrix(matrix) {
  if (!matrix) return '- Matriz em `docs/08-planejamento-ciclos-implementacao-repositorios.md`: não encontrada para esta responsabilidade.';
  return [
    `- Caminho canônico previsto: ${matrix.pathInMonorepo}`,
    `- Ciclos obrigatórios: ${matrix.requiredCycles}`,
    `- Aceite base: ${matrix.acceptanceBase}`,
  ].join('\n');
}

function formatBacklogMetrics(metrics) {
  if (!metrics) return '- Métricas de backlog indisponíveis.';
  return [
    `- Ciclos mandatórios concluídos: ${metrics.completedMandatoryCycles}/${metrics.totalMandatoryCycles}`,
    `- Ciclos mandatórios restantes: ${metrics.remainingMandatoryCycles}`,
    `- Ciclos marcados como \`na\`: ${metrics.notApplicableCycles}`,
  ].join('\n');
}

function parseArgs(argv) {
  const args = { output: null };
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--output') {
      args.output = argv[index + 1] ?? null;
      index += 1;
    }
  }
  return args;
}

async function main() {
  const repoRoot = process.cwd();
  const args = parseArgs(process.argv);
  const backlog = await loadControllerBacklog(repoRoot);
  const resolved = resolveNextBacklogTarget(backlog);

  if (resolved.state !== 'actionable') {
    fail(`controller backlog is ${resolved.state}${resolved.reason ? `: ${resolved.reason}` : ''}`);
  }

  const signature = buildActionableSignature(resolved);
  const branchPrefix = resolved.branchPrefix;
  const templatePath = path.join(repoRoot, '.codex', 'cloud', 'controller-prompt.md');
  const template = await readFile(templatePath, 'utf8');

  const replacements = new Map([
    ['__TARGET_CYCLE__', resolved.cycle],
    ['__TARGET_RESPONSIBILITY__', resolved.responsibility],
    ['__TARGET_BRANCH_PREFIX__', branchPrefix],
    ['__TARGET_PROJECT_FILE__', `docs/project/${resolved.responsibility}.md`],
    ['__TARGET_STATUS__', resolved.cycleRow.rawStatus],
    ['__TARGET_GATE__', resolved.cycleRow.gate],
    ['__TARGET_EVIDENCE__', resolved.cycleRow.evidence || '—'],
    ['__TARGET_BLOCKER__', resolved.cycleRow.blocker || '—'],
    ['__TARGET_NEXT_ACTION__', resolved.cycleRow.nextAction || '—'],
    ['__TARGET_SIGNATURE__', signature ?? 'unavailable'],
    ['__BACKLOG_METRICS__', formatBacklogMetrics(resolved.backlogMetrics)],
    ['__TARGET_MATRIX__', formatMatrix(resolved.matrix)],
    ['__TARGET_SUMMARY_PRIORITY__', resolved.summaryRow.priority],
  ]);

  let prompt = template;
  for (const [token, value] of replacements.entries()) {
    prompt = prompt.replaceAll(token, value);
  }

  if (args.output) {
    await writeFile(args.output, prompt);
  } else {
    process.stdout.write(prompt);
  }
}

main().catch((error) => fail(error.message));
