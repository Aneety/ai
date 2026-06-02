import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  classifyStatus,
  CYCLE_ORDER,
  PRIORITY_RANK,
  controllerBranchPrefix,
  normalizeCycle,
  normalizeStatus,
} from './controller-constants.mjs';
import { getRemoteAutomationKind } from './remote-gate.mjs';

function stripCodeFence(value) {
  const trimmed = String(value ?? '').trim();
  const match = trimmed.match(/^`(.+)`$/);
  return match ? match[1] : trimmed;
}

function dependencyRuleKey(responsibility, cycle) {
  return `${responsibility}/${cycle}`;
}

function parseDependencyDescriptor(value) {
  const raw = stripCodeFence(value);
  const [responsibility, cycle] = String(raw).split('/').map((item) => item?.trim() ?? '');
  return {
    responsibility,
    cycle: normalizeCycle(cycle),
  };
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
  const dependencyRules = new Map();

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

  const dependencyRows = parseTableAfterHeading(markdown, '## Dependências automáveis do scheduler');
  for (const row of dependencyRows) {
    const targetResponsibility = stripCodeFence(row['Responsabilidade alvo'] ?? '');
    const targetCycle = normalizeCycle(stripCodeFence(row['Ciclo alvo'] ?? ''));
    if (!targetResponsibility || !targetCycle) continue;

    const dependencies = String(row['Dependências mínimas'] ?? '')
      .split(',')
      .map((item) => parseDependencyDescriptor(item))
      .filter((item) => item.responsibility && item.cycle);

    dependencyRules.set(dependencyRuleKey(targetResponsibility, targetCycle), {
      responsibility: targetResponsibility,
      cycle: targetCycle,
      dependencies,
      evidenceRule: row['Regra operacional'] ?? '',
    });
  }

  return { responsibilities: map, dependencyRules };
}

export function buildActionableSignature(target) {
  if (!target || target.state !== 'actionable') return null;
  const cycleRow = target.cycleRow;
  return JSON.stringify({
    responsibility: target.responsibility,
    cycle: target.cycle,
    status: cycleRow.status,
    gate: cycleRow.gate,
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
    planningMatrix: planningMatrix.responsibilities,
    dependencyRules: planningMatrix.dependencyRules,
    metrics: summarizeBacklog(detailsByResponsibility),
  };
}

function buildDependencyContext(parentResponsibility, parentCycle, dependencyResponsibility, dependencyCycle) {
  return {
    dependencyParentResponsibility: parentResponsibility,
    dependencyParentCycle: parentCycle,
    dependencyReason: `dependency_preemption=${parentResponsibility}/${parentCycle}->${dependencyResponsibility}/${dependencyCycle}`,
    dependencySource: 'planning_matrix',
  };
}

function getOrderedResponsibilities(backlog) {
  return [...backlog.summaryRows].sort((left, right) => {
    if (left.priorityRank !== right.priorityRank) return left.priorityRank - right.priorityRank;
    return left.orderIndex - right.orderIndex;
  });
}

function sortDependencies(backlog, dependencies) {
  const summaryByResponsibility = new Map(backlog.summaryRows.map((row) => [row.responsibility, row]));
  return [...dependencies].sort((left, right) => {
    const leftSummary = summaryByResponsibility.get(left.responsibility);
    const rightSummary = summaryByResponsibility.get(right.responsibility);
    const leftPriority = leftSummary?.priorityRank ?? 99;
    const rightPriority = rightSummary?.priorityRank ?? 99;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return (leftSummary?.orderIndex ?? 99) - (rightSummary?.orderIndex ?? 99);
  });
}

function resolveDependencyPreemption(backlog, parentSummaryRow, parentDetail, parentCycle, parentCycleRow) {
  const rule = backlog.dependencyRules.get(dependencyRuleKey(parentSummaryRow.responsibility, parentCycle));
  if (!rule) return null;

  const orderedDependencies = sortDependencies(backlog, rule.dependencies);

  for (const dependency of orderedDependencies) {
    const dependencySummary = backlog.summaryRows.find((row) => row.responsibility === dependency.responsibility);
    if (!dependencySummary) {
      return {
        state: 'blocked',
        reason: `missing dependency responsibility ${dependency.responsibility} for ${parentSummaryRow.responsibility}/${parentCycle}`,
        blockKind: 'config',
        responsibility: parentSummaryRow.responsibility,
        cycle: parentCycle,
        branchPrefix: controllerBranchPrefix(parentCycle, parentSummaryRow.responsibility),
        summaryRow: parentSummaryRow,
        detail: parentDetail,
        cycleRow: parentCycleRow,
        matrix: backlog.planningMatrix.get(parentSummaryRow.responsibility) ?? null,
        backlogMetrics: backlog.metrics,
      };
    }

    const dependencyDetail = backlog.detailsByResponsibility.get(dependency.responsibility);
    if (!dependencyDetail) {
      return {
        state: 'blocked',
        reason: `missing dependency detail ${dependency.responsibility} for ${parentSummaryRow.responsibility}/${parentCycle}`,
        blockKind: 'config',
        responsibility: parentSummaryRow.responsibility,
        cycle: parentCycle,
        branchPrefix: controllerBranchPrefix(parentCycle, parentSummaryRow.responsibility),
        summaryRow: parentSummaryRow,
        detail: parentDetail,
        cycleRow: parentCycleRow,
        matrix: backlog.planningMatrix.get(parentSummaryRow.responsibility) ?? null,
        backlogMetrics: backlog.metrics,
      };
    }

    const dependencyCycleRow = dependencyDetail.cycles.find((cycleRow) => cycleRow.cycle === dependency.cycle);
    if (!dependencyCycleRow) {
      return {
        state: 'blocked',
        reason: `missing dependency cycle ${dependency.responsibility}/${dependency.cycle} for ${parentSummaryRow.responsibility}/${parentCycle}`,
        blockKind: 'config',
        responsibility: parentSummaryRow.responsibility,
        cycle: parentCycle,
        branchPrefix: controllerBranchPrefix(parentCycle, parentSummaryRow.responsibility),
        summaryRow: parentSummaryRow,
        detail: parentDetail,
        cycleRow: parentCycleRow,
        matrix: backlog.planningMatrix.get(parentSummaryRow.responsibility) ?? null,
        backlogMetrics: backlog.metrics,
      };
    }

    const statusKind = classifyStatus(dependencyCycleRow.status);
    if (statusKind === 'done') continue;

    const dependencyContext = buildDependencyContext(
      parentSummaryRow.responsibility,
      parentCycle,
      dependency.responsibility,
      dependency.cycle,
    );
    const dependencyMatrix = backlog.planningMatrix.get(dependency.responsibility) ?? null;

    if (statusKind === 'pause') {
      const blockerAutomationKind = getRemoteAutomationKind({
        repoRoot: backlog.repoRoot,
        state: 'blocked',
        blockKind: 'pause',
        responsibility: dependency.responsibility,
        cycle: dependency.cycle,
        cycleRow: dependencyCycleRow,
      });
      return {
        state: 'blocked',
        reason: `pause_dependency=${parentSummaryRow.responsibility}/${parentCycle}->${dependency.responsibility}/${dependency.cycle}/${dependencyCycleRow.status}`,
        blockKind: 'pause',
        blockerAutomationKind,
        pauseStatus: dependencyCycleRow.status,
        pauseReason:
          dependencyCycleRow.blocker ||
          dependencyCycleRow.nextAction ||
          dependencyContext.dependencyReason,
        responsibility: dependency.responsibility,
        cycle: dependency.cycle,
        branchPrefix: controllerBranchPrefix(dependency.cycle, dependency.responsibility),
        summaryRow: dependencySummary,
        detail: dependencyDetail,
        cycleRow: dependencyCycleRow,
        matrix: dependencyMatrix,
        backlogMetrics: backlog.metrics,
        ...dependencyContext,
      };
    }

    if (statusKind !== 'actionable') {
      return {
        state: 'blocked',
        reason: `unknown dependency status ${dependencyCycleRow.status} for ${dependency.responsibility}/${dependency.cycle}`,
        blockKind: 'config',
        responsibility: dependency.responsibility,
        cycle: dependency.cycle,
        branchPrefix: controllerBranchPrefix(dependency.cycle, dependency.responsibility),
        summaryRow: dependencySummary,
        detail: dependencyDetail,
        cycleRow: dependencyCycleRow,
        matrix: dependencyMatrix,
        backlogMetrics: backlog.metrics,
        ...dependencyContext,
      };
    }

    return {
      state: 'actionable',
      responsibility: dependency.responsibility,
      cycle: dependency.cycle,
      branchPrefix: controllerBranchPrefix(dependency.cycle, dependency.responsibility),
      summaryRow: dependencySummary,
      detail: dependencyDetail,
      cycleRow: dependencyCycleRow,
      matrix: dependencyMatrix,
      backlogMetrics: backlog.metrics,
      ...dependencyContext,
    };
  }

  return null;
}

function collectDependencyPreemptionTargets(backlog, parentSummaryRow, parentDetail, parentCycle, parentCycleRow) {
  const rule = backlog.dependencyRules.get(dependencyRuleKey(parentSummaryRow.responsibility, parentCycle));
  if (!rule) return [];

  const targets = [];
  const orderedDependencies = sortDependencies(backlog, rule.dependencies);
  for (const dependency of orderedDependencies) {
    const dependencySummary = backlog.summaryRows.find((row) => row.responsibility === dependency.responsibility);
    const dependencyDetail = backlog.detailsByResponsibility.get(dependency.responsibility);
    const dependencyCycleRow = dependencyDetail?.cycles.find((cycleRow) => cycleRow.cycle === dependency.cycle);
    if (!dependencySummary || !dependencyDetail || !dependencyCycleRow) continue;
    const statusKind = classifyStatus(dependencyCycleRow.status);
    if (statusKind === 'done') continue;
    if (statusKind !== 'actionable') continue;

    targets.push({
      state: 'actionable',
      responsibility: dependency.responsibility,
      cycle: dependency.cycle,
      branchPrefix: controllerBranchPrefix(dependency.cycle, dependency.responsibility),
      summaryRow: dependencySummary,
      detail: dependencyDetail,
      cycleRow: dependencyCycleRow,
      matrix: backlog.planningMatrix.get(dependency.responsibility) ?? null,
      backlogMetrics: backlog.metrics,
      ...buildDependencyContext(
        parentSummaryRow.responsibility,
        parentCycle,
        dependency.responsibility,
        dependency.cycle,
      ),
    });
  }

  return targets;
}

export function resolveResponsibilityTarget(backlog, responsibility) {
  const summaryRow = backlog.summaryRows.find((row) => row.responsibility === responsibility);
  if (!summaryRow) {
    return {
      state: 'blocked',
      reason: `missing responsibility summary for ${responsibility}`,
      blockKind: 'config',
      responsibility,
    };
  }

  const detail = backlog.detailsByResponsibility.get(summaryRow.responsibility);
  if (!detail) {
    return {
      state: 'blocked',
      reason: `missing responsibility detail for ${summaryRow.responsibility}`,
      blockKind: 'config',
      responsibility: summaryRow.responsibility,
    };
  }

  const knownCycles = new Map(detail.cycles.map((cycleRow) => [cycleRow.cycle, cycleRow]));
  for (const cycle of CYCLE_ORDER) {
    const cycleRow = knownCycles.get(cycle);
    const matrix = backlog.planningMatrix.get(summaryRow.responsibility) ?? null;
    if (!cycleRow) {
      return {
        state: 'blocked',
        reason: `missing cycle row ${cycle} for ${summaryRow.responsibility}`,
        blockKind: 'config',
        responsibility: summaryRow.responsibility,
        cycle,
        branchPrefix: controllerBranchPrefix(cycle, summaryRow.responsibility),
        summaryRow,
        detail,
        matrix,
        backlogMetrics: backlog.metrics,
      };
    }
    const statusKind = classifyStatus(cycleRow.status);
    if (statusKind === 'done') continue;

    const dependencyTarget = resolveDependencyPreemption(
      backlog,
      summaryRow,
      detail,
      cycle,
      cycleRow,
    );
    if (dependencyTarget) return dependencyTarget;

    if (statusKind === 'pause') {
      const blockerAutomationKind = getRemoteAutomationKind({
        repoRoot: backlog.repoRoot,
        state: 'blocked',
        blockKind: 'pause',
        responsibility: summaryRow.responsibility,
        cycle,
        cycleRow,
      });
      return {
        state: 'blocked',
        reason: `pause_status=${summaryRow.responsibility}/${cycle}/${cycleRow.status}`,
        blockKind: 'pause',
        blockerAutomationKind,
        pauseStatus: cycleRow.status,
        pauseReason: cycleRow.blocker || cycleRow.nextAction || `pause_status=${cycleRow.status}`,
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

    if (statusKind !== 'actionable') {
      return {
        state: 'blocked',
        reason: `unknown_status=${summaryRow.responsibility}/${cycle}/${cycleRow.status}`,
        blockKind: 'unknown_status',
        pauseStatus: 'unknown_status',
        pauseReason: `unknown status '${cycleRow.rawStatus}'`,
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

  return {
    state: 'complete',
    responsibility: summaryRow.responsibility,
    backlogMetrics: backlog.metrics,
  };
}

export function resolveNextBacklogTarget(backlog) {
  const orderedResponsibilities = getOrderedResponsibilities(backlog);
  for (const summaryRow of orderedResponsibilities) {
    const resolved = resolveResponsibilityTarget(backlog, summaryRow.responsibility);
    if (resolved.state === 'complete') continue;
    return resolved;
  }

  return {
    state: 'complete',
    backlogMetrics: backlog.metrics,
  };
}

function targetSelectionKey(target) {
  return `${target.responsibility}/${target.cycle}/${buildActionableSignature(target) ?? 'unknown'}`;
}

function targetConflictKeys(target) {
  const keys = new Set([target.responsibility, targetSelectionKey(target)]);
  if (target.dependencyParentResponsibility && target.dependencyParentCycle) {
    keys.add(`${target.dependencyParentResponsibility}/${target.dependencyParentCycle}`);
  }
  return keys;
}

export function resolveParallelBacklogTargets(backlog, { limit = 4, excludeTargets = [] } = {}) {
  const targets = [];
  const excluded = [];
  const occupiedKeys = new Set();
  const actionableCandidates = [];

  for (const target of excludeTargets) {
    if (!target || target.state !== 'actionable') continue;
    for (const key of targetConflictKeys(target)) occupiedKeys.add(key);
  }

  for (const summaryRow of getOrderedResponsibilities(backlog)) {
    const resolved = resolveResponsibilityTarget(backlog, summaryRow.responsibility);
    if (resolved.state === 'complete') continue;

    if (resolved.state === 'blocked' && resolved.blockKind === 'pause') {
      const dependencyTargets = collectDependencyPreemptionTargets(
        backlog,
        resolved.summaryRow ?? summaryRow,
        resolved.detail ?? backlog.detailsByResponsibility.get(summaryRow.responsibility),
        resolved.cycle,
        resolved.cycleRow,
      );
      actionableCandidates.push(...dependencyTargets);
    }

    if (resolved.state !== 'actionable') {
      excluded.push({
        responsibility: summaryRow.responsibility,
        cycle: resolved.cycle ?? null,
        reason:
          resolved.blockKind === 'pause'
            ? 'paused_status'
            : resolved.blockKind === 'config'
              ? 'config_blocked'
              : resolved.blockKind ?? resolved.state,
      });
      continue;
    }

    actionableCandidates.push(resolved);
  }

  actionableCandidates.sort((left, right) => {
    const leftDependency = left.dependencyParentResponsibility ? 0 : 1;
    const rightDependency = right.dependencyParentResponsibility ? 0 : 1;
    if (leftDependency !== rightDependency) return leftDependency - rightDependency;
    if (left.summaryRow.priorityRank !== right.summaryRow.priorityRank) {
      return left.summaryRow.priorityRank - right.summaryRow.priorityRank;
    }
    return left.summaryRow.orderIndex - right.summaryRow.orderIndex;
  });

  for (const resolved of actionableCandidates) {
    const selectionKey = targetSelectionKey(resolved);
    if (occupiedKeys.has(resolved.responsibility)) {
      excluded.push({
        responsibility: resolved.responsibility,
        cycle: resolved.cycle,
        reason: 'same_responsibility',
      });
      continue;
    }
    if (occupiedKeys.has(selectionKey)) {
      excluded.push({
        responsibility: resolved.responsibility,
        cycle: resolved.cycle,
        reason: 'duplicate_active_task',
      });
      continue;
    }
    if (targets.length >= limit) {
      excluded.push({
        responsibility: resolved.responsibility,
        cycle: resolved.cycle,
        reason: 'pool_full',
      });
      continue;
    }

    targets.push(resolved);
    for (const key of targetConflictKeys(resolved)) occupiedKeys.add(key);
  }

  return {
    state: 'parallel_window',
    limit,
    targets,
    excluded,
  };
}
