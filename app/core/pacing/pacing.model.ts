export const PACING_DIFFICULTY_MAX = 10;

export interface PacingActivity {
  id: string;
  title: string;
  titleKey: string;
  description: string;
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
  done: boolean;
  difficulty: number;
  authorUid: string;
  authorName: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreatePacingActivityInput {
  title: string;
  description: string;
}

export interface CreatePacingLogInput {
  date: string;
  time: string;
  activity: PacingActivity;
  done: boolean;
  difficulty: number;
}

export function clampDifficulty(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(PACING_DIFFICULTY_MAX, Math.max(0, Math.round(n)));
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
