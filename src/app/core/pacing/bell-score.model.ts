export const BELL_SCORE_VALUES = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0] as const;

export type BellScore = (typeof BELL_SCORE_VALUES)[number];

export interface BellScoreLevel {
  score: BellScore;
  title: string;
  summary: string;
  detail: string;
}

export const BELL_SCORE_LEVELS: readonly BellScoreLevel[] = [
  {
    score: 100,
    title: 'Keine Einschränkung',
    summary: 'Keine Symptome, volle Aktivität.',
    detail:
      'Keine Symptome in Ruhe und bei Belastung. Die übliche Aktivität ist uneingeschränkt. Beruf, Schule oder Haushalt sind ganztags ohne besondere Mühe möglich.',
  },
  {
    score: 90,
    title: 'Sehr milde Symptome',
    summary: 'In Ruhe unauffällig, leichte Symptome bei Anstrengung.',
    detail:
      'In Ruhe keine Symptome, bei Belastung milde Beschwerden. Die Gesamtaktivität bleibt weitgehend normal. Ganztagsarbeit ist möglich.',
  },
  {
    score: 80,
    title: 'Milde Symptome',
    summary: 'Leichte Ruhebeschwerden, Aktivität etwa 90 Prozent.',
    detail:
      'Milde Symptome in Ruhe, die sich bei Anstrengung verstärken. Die Aktivität liegt bei etwa 90 Prozent. Vormittags oft klarer, nachmittags nachlassend. Ganztagsarbeit ist mit Mühe möglich.',
  },
  {
    score: 70,
    title: 'Milde bis mäßige Einschränkung',
    summary: 'Leichte Arbeit wenige Tage die Woche, Aktivität etwa 70 Prozent.',
    detail:
      'Milde Symptome in Ruhe. Leichte Arbeit ist oft nur an drei bis vier Tagen möglich. Die Gesamtaktivität liegt bei etwa 70 Prozent des früheren Niveaus.',
  },
  {
    score: 60,
    title: 'Mäßige Einschränkung',
    summary: 'Keine Vollzeit mehr, Aktivität 50–70 Prozent.',
    detail:
      'Milde bis mäßige Symptome in Ruhe. Vollzeit ist in der Regel nicht mehr möglich. Leichte Tätigkeit zu Hause oft drei bis vier Stunden am Tag. Aktivität etwa 50–70 Prozent.',
  },
  {
    score: 50,
    title: 'Deutliche Einschränkung',
    summary: 'Hausgebundenere Tage, Aktivität etwa 50 Prozent.',
    detail:
      'Mäßige Symptome in Ruhe. Erwerbsarbeit ist meist nicht mehr möglich. Zu Hause bleiben oft zwei bis drei Stunden leichte Tätigkeit. Die Gesamtaktivität liegt bei etwa 50 Prozent.',
  },
  {
    score: 40,
    title: 'Schwere Einschränkung',
    summary: 'Kaum außer Haus, keine Erwerbsarbeit.',
    detail:
      'Mäßige bis schwere Symptome in Ruhe. Das Haus kann nur selten verlassen werden. Erwerbsarbeit ist nicht möglich. Die Aktivität liegt bei etwa 30–50 Prozent.',
  },
  {
    score: 30,
    title: 'Sehr schwere Einschränkung',
    summary: 'Viel Bett, kurze Sitzphasen.',
    detail:
      'Schwere Symptome in Ruhe. Ein großer Teil des Tages wird im Bett verbracht. Sitzen ist oft nur ein bis zwei Stunden möglich. Die Aktivität liegt bei etwa 20–30 Prozent.',
  },
  {
    score: 20,
    title: 'Überwiegend bettlägerig',
    summary: 'Kaum Konzentration, Aktivität unter 20 Prozent.',
    detail:
      'Fast durchgehend mäßige bis schwere Symptome. Überwiegend bettlägerig. Konzentration und Gespräch sind stark begrenzt. Die Aktivität liegt unter 20 Prozent.',
  },
  {
    score: 10,
    title: 'Durchgehend bettlägerig',
    summary: 'Selbstversorgung kaum möglich.',
    detail:
      'Schwere Symptome ohne nennenswerte Pause. Durchgehend bettlägerig. Die Selbstversorgung ist kaum oder nicht mehr allein möglich.',
  },
  {
    score: 0,
    title: 'Vollständige Pflegebedürftigkeit',
    summary: 'Dauerhaft bettlägerig, Hilfe bei der Körperpflege.',
    detail:
      'Schwere Symptome ohne Unterbrechung. Dauerhaft bettlägerig. Hilfe bei der Körperpflege ist erforderlich.',
  },
];

export const BELL_SCORE_REFERENCE = {
  authors: 'Bell DS',
  title: 'The Doctor’s Guide to Chronic Fatigue Syndrome: Understanding, Treating, and Living with CFIDS',
  place: 'Reading, MA',
  publisher: 'Addison-Wesley',
  year: 1994,
  note: 'CFIDS Disability Scale, häufig zitiert als Bell-Score.',
  citation:
    'Bell DS. The Doctor’s Guide to Chronic Fatigue Syndrome: Understanding, Treating, and Living with CFIDS. Reading, MA: Addison-Wesley; 1994.',
};

export function isBellScore(value: unknown): value is BellScore {
  return BELL_SCORE_VALUES.includes(value as BellScore);
}

export function normalizeBellScore(value: unknown): BellScore | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return null;
  }
  const stepped = Math.round(n / 10) * 10;
  return isBellScore(stepped) ? stepped : null;
}

export function bellScoreLevel(score: BellScore | null): BellScoreLevel | null {
  if (score === null) {
    return null;
  }
  return BELL_SCORE_LEVELS.find((level) => level.score === score) ?? null;
}

/** Vorschlag für das Tagesbudget, abhängig vom funktionalen Niveau. */
export function suggestedBudgetFromBell(score: BellScore | null): number {
  if (score === null) {
    return 20;
  }
  if (score <= 20) {
    return 6;
  }
  if (score <= 40) {
    return 10;
  }
  if (score <= 60) {
    return 16;
  }
  if (score <= 70) {
    return 20;
  }
  if (score <= 90) {
    return 28;
  }
  return 36;
}
