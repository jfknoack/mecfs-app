export const PACING_DIFFICULTY_MAX = 10;
export const PACING_BUDGET_DEFAULT = 20;
export const PACING_BUDGET_MAX = 80;

export const PACING_KIND_VALUES = [
  'physical',
  'cognitive',
  'social',
  'household',
  'rest',
] as const;

export type PacingKind = (typeof PACING_KIND_VALUES)[number];
export type EnvelopeZone = 'safe' | 'caution' | 'over';

export const PACING_KIND_OPTIONS: ReadonlyArray<{
  value: PacingKind;
  label: string;
  icon: string;
}> = [
  { value: 'physical', label: 'Körper', icon: 'person-walking' },
  { value: 'cognitive', label: 'Kopf', icon: 'brain' },
  { value: 'social', label: 'Sozial', icon: 'users' },
  { value: 'household', label: 'Haushalt', icon: 'house' },
  { value: 'rest', label: 'Ruhe', icon: 'bed' },
];

export interface PacingActivity {
  id: string;
  title: string;
  titleKey: string;
  description: string;
  kind: PacingKind;
  energyCost: number;
  authorUid: string;
  authorName: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface PacingLog {
  id: string;
  date: string;
  time: string;
  activityId: string;
  title: string;
  description: string;
  kind: PacingKind;
  done: boolean;
  difficulty: number;
  authorUid: string;
  authorName: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface PacingDay {
  id: string;
  date: string;
  energy: number;
  pem: boolean;
  budget: number;
  authorUid: string;
  authorName: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreatePacingActivityInput {
  title: string;
  description: string;
  kind: PacingKind;
  energyCost: number;
}

export interface CreatePacingLogInput {
  date: string;
  time: string;
  activity: PacingActivity;
  done: boolean;
  difficulty: number;
}

export interface SavePacingDayInput {
  date: string;
  energy: number;
  pem: boolean;
  budget: number;
}

export interface PacingDayBalance {
  spent: number;
  rest: number;
  net: number;
  budget: number;
  remaining: number;
  ratio: number;
  usedPercent: number;
  zone: EnvelopeZone;
  zoneLabel: string;
}

export function isPacingKind(value: unknown): value is PacingKind {
  return PACING_KIND_VALUES.includes(value as PacingKind);
}

export function normalizePacingKind(value: unknown): PacingKind {
  return isPacingKind(value) ? value : 'household';
}

export function isRestKind(kind: PacingKind): boolean {
  return kind === 'rest';
}

export function pacingKindLabel(kind: PacingKind): string {
  return PACING_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

export function pacingKindIcon(kind: PacingKind): string {
  return PACING_KIND_OPTIONS.find((option) => option.value === kind)?.icon ?? 'list';
}

export function clampDifficulty(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(PACING_DIFFICULTY_MAX, Math.max(0, Math.round(n)));
}

export function clampBudget(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return PACING_BUDGET_DEFAULT;
  }
  return Math.min(PACING_BUDGET_MAX, Math.max(1, Math.round(n)));
}

export function difficultyColor(value: number): string {
  const colors = [
    '#2e7d32',
    '#43a047',
    '#7cb342',
    '#c0ca33',
    '#fdd835',
    '#ffb300',
    '#fb8c00',
    '#f4511e',
    '#e53935',
    '#b71c1c',
    '#7f0000',
  ];
  return colors[clampDifficulty(value)];
}

export function difficultyContrast(value: number): string {
  const n = clampDifficulty(value);
  return n >= 3 && n <= 6 ? '#1a1a1a' : '#ffffff';
}

export function difficultyLabel(value: number): string {
  const n = clampDifficulty(value);
  if (n <= 2) {
    return 'leicht';
  }
  if (n <= 4) {
    return 'machbar';
  }
  if (n <= 6) {
    return 'anstrengend';
  }
  if (n <= 8) {
    return 'schwer';
  }
  return 'sehr schwer';
}

export function restCreditLabel(value: number): string {
  const n = clampDifficulty(value);
  if (n <= 2) {
    return 'kurze Pause';
  }
  if (n <= 4) {
    return 'erholt';
  }
  if (n <= 6) {
    return 'gute Pause';
  }
  if (n <= 8) {
    return 'tiefe Ruhe';
  }
  return 'lange Erholung';
}

export function envelopeZoneLabel(zone: EnvelopeZone): string {
  if (zone === 'safe') {
    return 'im Rahmen';
  }
  if (zone === 'caution') {
    return 'knapp';
  }
  return 'überzogen';
}

export function envelopeZoneColor(zone: EnvelopeZone): string {
  if (zone === 'safe') {
    return '#2e7d32';
  }
  if (zone === 'caution') {
    return '#f9a825';
  }
  return '#c62828';
}

export function dayBalance(logs: PacingLog[], budget: number): PacingDayBalance {
  let spent = 0;
  let rest = 0;
  for (const log of logs) {
    if (isRestKind(log.kind)) {
      rest += log.difficulty;
    } else {
      spent += log.difficulty;
    }
  }
  const safeBudget = Math.max(1, budget);
  const net = Math.max(0, spent - rest);
  const remaining = safeBudget - net;
  const ratio = net / safeBudget;
  const zone: EnvelopeZone = ratio <= 0.75 ? 'safe' : ratio <= 1 ? 'caution' : 'over';
  return {
    spent,
    rest,
    net,
    budget: safeBudget,
    remaining,
    ratio,
    usedPercent: Math.min(100, Math.round(ratio * 100)),
    zone,
    zoneLabel: envelopeZoneLabel(zone),
  };
}

export function costSign(kind: PacingKind): string {
  return isRestKind(kind) ? '+' : '−';
}

export function suggestedCost(activity: PacingActivity, logs: PacingLog[]): number {
  const recent = logs
    .filter((log) => log.activityId === activity.id)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(-8);
  if (!recent.length) {
    return activity.energyCost;
  }
  const total = recent.reduce((sum, log) => sum + log.difficulty, 0);
  return clampDifficulty(total / recent.length);
}

export function frequentActivities(
  activities: PacingActivity[],
  logs: PacingLog[],
  limit = 6,
): PacingActivity[] {
  const counts = new Map<string, number>();
  for (const log of logs) {
    counts.set(log.activityId, (counts.get(log.activityId) ?? 0) + 1);
  }
  const ranked = [...activities].sort((a, b) => {
    const byCount = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
    if (byCount !== 0) {
      return byCount;
    }
    if (a.kind === 'rest' && b.kind !== 'rest') {
      return -1;
    }
    if (b.kind === 'rest' && a.kind !== 'rest') {
      return 1;
    }
    return a.title.localeCompare(b.title, 'de');
  });
  const used = ranked.filter((activity) => (counts.get(activity.id) ?? 0) > 0);
  const source = used.length ? used : ranked;
  return source.slice(0, limit);
}

export function pemPatternHint(input: {
  todayEnergy: number | null;
  todayPem: boolean;
  priorNet: number;
  priorBudget: number;
}): string | null {
  const delayedCrash = input.todayPem || (input.todayEnergy !== null && input.todayEnergy <= 3);
  if (!delayedCrash || input.priorNet <= input.priorBudget * 0.75) {
    return null;
  }
  return 'Vorgestern war der Aufwand hoch. PEM zeigt sich oft erst 24–48 Stunden später.';
}

export const DIFFICULTY_OPTIONS = Array.from({ length: PACING_DIFFICULTY_MAX + 1 }, (_, value) => ({
  value,
  label: String(value),
}));

const TIME_VALUE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function nowTimeKey(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function normalizePacingTime(value: unknown, fallbackDate: Date | null = null): string {
  if (typeof value === 'string' && TIME_VALUE.test(value)) {
    return value;
  }
  if (fallbackDate) {
    return nowTimeKey(fallbackDate);
  }
  return '';
}

export function pacingLogDateTime(log: Pick<PacingLog, 'date' | 'time'>): string | null {
  if (!log.date || !log.time) {
    return null;
  }
  return `${log.date}T${log.time}:00`;
}

export function comparePacingLogs(a: PacingLog, b: PacingLog): number {
  if (a.time !== b.time) {
    if (!a.time) {
      return -1;
    }
    if (!b.time) {
      return 1;
    }
    return a.time.localeCompare(b.time);
  }
  return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
}

export function isPacingLogToday(date: string): boolean {
  return date === todayKey();
}

function todayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
