import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  CYCLE_ORDER,
  PRIORITY_RANK,
  controllerBranchPrefix,
  isDoneStatus,
  normalizeCycle,
  normalizeStatus,
} from './controller-constants.mjs';

function stripCodeFence(value) {
  const trimmed = String(value ?? '').trim();
  const match = trimmed.match(/^`(.+)`$/);
  return match ? match[1] : trimmed;
}

function splitMarkdownRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;
  return trimmed
    .slice(1, trimmed.endsWith('|') ? -1 : undefined)
    .split('|')
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseTableAfterHeading(markdown, heading) {
  const lines = markdown.split('\n');
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) return [];

  const rows = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const cells = splitMarkdownRow(lines[index]);
    if (!cells) {
      if (rows.length > 0) break;
      continue;
    }
    if (rows.length === 0) {
      rows.push(cells);
      continue;
    }
    if (rows.length === 1 && isSeparatorRow(cells)) {
      rows.push(cells);
      continue;
    }
    rows.push(cells);
  }

  if (rows.length < 3) return [];
  const [header] = rows;
  return rows.slice(2).map((cells) => {
    const row = {};
    for (let index = 0; index < header.length; index += 1) {
      row[header[index]] = cells[index] ?? '';
    }
    return row;
  });
}

async function readMarkdown(filePath) {
  return readFile(filePath, 'utf8');
}

export async function parseProjectIndex(repoRoot) {
  const indexPath = path.join(repoRoot, 'docs', 'project', 'index.md');
  const markdown = await readMarkdown(indexPath);
  const rows = parseTableAfterHeading(markdown, '## Visão executiva');

  return rows.map((row, orderIndex) => {
    const responsibility = stripCodeFence(row.Responsabilidade);
    const fileMatch = String(row.Arquivo ?? '').match(/\]\(([^)]+)\)/);
    return {
      orderIndex,
      responsibility,
      owner: row.Owner ?? '',
      priority: String(row.Prioridade ?? '').trim().toLowerCase(),
      activeCycle: normalizeCycle(stripCodeFence(row['Ciclo ativo'] ?? '')),
      status: normalizeStatus(stripCodeFence(row.Status ?? '')),
      fileLink: fileMatch?.[1] ?? `./${responsibility}.md`,
      evidence: row['Evidência atual'] ?? '',
      blocker: row.Bloqueio ?? '',
      priorityRank: PRIORITY_RANK[String(row.Prioridade ?? '').trim().toLowerCase()] ?? 99,
    };
  });
}

export async function parseResponsibilityFile(repoRoot, responsibility, relativePath) {
  const filePath = path.join(repoRoot, 'docs', 'project', relativePath.replace(/^\.\//, ''));
  const markdown = await readMarkdown(filePath);
  const rows = parseTableAfterHeading(markdown, '## Status operacional por ciclo');
  const cycles = rows.map((row, orderIndex) => ({
    orderIndex,
    cycle: normalizeCycle(stripCodeFence(row.Ciclo ?? '')),
    rawCycle: stripCodeFence(row.Ciclo ?? ''),
    status: normalizeStatus(stripCodeFence(row.Status ?? '')),
    rawStatus: stripCodeFence(row.Status ?? ''),
    priority: String(row.Prioridade ?? '').trim().toLowerCase(),
    gate: stripCodeFence(row.Gate ?? ''),
    evidence: row['Evidência'] ?? '',
    blocker: row.Bloqueio ?? '',
    nextAction: row['Próxima ação'] ?? '',
  }));

  return {
    responsibility,
    filePath,
    relativePath,
    markdown,
    cycles,
  };
}

export async function loadPlanningMatrix(repoRoot) {
  const planningPath = path.join(repoRoot, 'docs', '08-planejamento-ciclos-implementacao-repositorios.md');
  const markdown = await readMarkdown(planningPath);
  const lines = markdown.split('\n');
  const map = new Map();

  for (const line of lines) {
    const cells = splitMarkdownRow(line);
    if (!cells || cells.length < 6 || isSeparatorRow(cells)) continue;
    const responsibility = stripCodeFence(cells[0]);
    if (!responsibility || responsibility === 'Responsabilidade') continue;
    map.set(responsibility, {
      responsibility,
      coveredTables: cells[1] ?? '',
      rootResponsibility: stripCodeFence(cells[2] ?? ''),
      pathInMonorepo: cells[3] ?? '',
      requiredCycles: cells[4] ?? '',
      acceptanceBase: cells[5] ?? '',
    });
  }

  return map;
}

export function buildActionableSignature(target) {
  if (!target || target.state !== 'actionable') return null;
  const cycleRow = target.cycleRow;
  return JSON.stringify({
    responsibility: target.responsibility,
    cycle: target.cycle,
    status: cycleRow.status,
    gate: cycleRow.gate,
    evidence: cycleRow.evidence,
    blocker: cycleRow.blocker,
    nextAction: cycleRow.nextAction,
  });
}

export function summarizeBacklog(detailsByResponsibility) {
  let totalMandatoryCycles = 0;
  let completedMandatoryCycles = 0;
  let notApplicableCycles = 0;

  for (const detail of detailsByResponsibility.values()) {
    for (const cycleRow of detail.cycles) {
      if (!CYCLE_ORDER.includes(cycleRow.cycle)) continue;
      if (cycleRow.status === 'na') {
        notApplicableCycles += 1;
        continue;
      }
      totalMandatoryCycles += 1;
      if (cycleRow.status === 'concluido') completedMandatoryCycles += 1;
    }
  }

  return {
    totalMandatoryCycles,
    completedMandatoryCycles,
    remainingMandatoryCycles: Math.max(totalMandatoryCycles - completedMandatoryCycles, 0),
    notApplicableCycles,
  };
}

export async function loadControllerBacklog(repoRoot) {
  const summaryRows = await parseProjectIndex(repoRoot);
  const planningMatrix = await loadPlanningMatrix(repoRoot);
  const detailsByResponsibility = new Map();

  for (const summaryRow of summaryRows) {
    const detail = await parseResponsibilityFile(repoRoot, summaryRow.responsibility, summaryRow.fileLink);
    detailsByResponsibility.set(summaryRow.responsibility, detail);
  }

  return {
    repoRoot,
    summaryRows,
    detailsByResponsibility,
    planningMatrix,
    metrics: summarizeBacklog(detailsByResponsibility),
  };
}

export function resolveNextBacklogTarget(backlog) {
  const orderedResponsibilities = [...backlog.summaryRows].sort((left, right) => {
    if (left.priorityRank !== right.priorityRank) return left.priorityRank - right.priorityRank;
    return left.orderIndex - right.orderIndex;
  });

  for (const summaryRow of orderedResponsibilities) {
    const detail = backlog.detailsByResponsibility.get(summaryRow.responsibility);
    if (!detail) {
      return {
        state: 'blocked',
        reason: `missing responsibility detail for ${summaryRow.responsibility}`,
      };
    }

    const knownCycles = new Map(detail.cycles.map((cycleRow) => [cycleRow.cycle, cycleRow]));
    for (const cycle of CYCLE_ORDER) {
      const cycleRow = knownCycles.get(cycle);
      if (!cycleRow) {
        return {
          state: 'blocked',
          reason: `missing cycle row ${cycle} for ${summaryRow.responsibility}`,
        };
      }
      if (isDoneStatus(cycleRow.status)) continue;

      const matrix = backlog.planningMatrix.get(summaryRow.responsibility) ?? null;
      return {
        state: 'actionable',
        responsibility: summaryRow.responsibility,
        cycle,
        branchPrefix: controllerBranchPrefix(cycle, summaryRow.responsibility),
        summaryRow,
        detail,
        cycleRow,
        matrix,
        backlogMetrics: backlog.metrics,
      };
    }
  }

  return {
    state: 'complete',
    backlogMetrics: backlog.metrics,
  };
}
