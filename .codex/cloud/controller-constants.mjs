export const CYCLE_ORDER = [
  'repositorio',
  'deploy',
  'publicacao',
  'banco',
  'jobs',
  'backend',
  'teste-integracao-api',
  'microfrontend',
  'smoke',
  'teste',
  'documentacao',
  'governanca',
];

export const NORMALIZED_CYCLE_MAP = new Map([
  ['publicação', 'publicacao'],
  ['documentação', 'documentacao'],
  ['governança', 'governanca'],
  ['testes de integração de api', 'teste-integracao-api'],
]);

export const PRIORITY_RANK = {
  alta: 0,
  media: 1,
  média: 1,
  baixa: 2,
};

export function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function normalizeCycle(value) {
  const normalized = normalizeText(value).replace(/\s+/g, ' ');
  return NORMALIZED_CYCLE_MAP.get(normalized) ?? normalized.replace(/\s+/g, '-');
}

export function normalizeStatus(value) {
  return normalizeText(value).replace(/\s+/g, '-');
}

export function isDoneStatus(value) {
  const status = normalizeStatus(value);
  return status === 'concluido' || status === 'na';
}

export function controllerBranchPrefix(cycle, responsibility) {
  return `codex/${cycle}-${responsibility}`;
}

export function isControllerBranch(branchName) {
  const branch = String(branchName ?? '').trim();
  return CYCLE_ORDER.some((cycle) => branch.startsWith(`codex/${cycle}-`));
}
