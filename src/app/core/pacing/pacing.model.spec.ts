import { budgetFromBellAndEnergy, suggestedBudgetFromBell } from './bell-score.model';
import {
  creditColor,
  dayBalance,
  difficultyColor,
  scaleColor,
  frequentActivities,
  normalizePacingKind,
  PacingActivity,
  PacingLog,
  pemPatternHint,
  suggestedCost,
} from './pacing.model';

function activity(partial: Partial<PacingActivity> & Pick<PacingActivity, 'id' | 'title'>): PacingActivity {
  return {
    titleKey: partial.title.toLowerCase(),
    description: '',
    kind: 'household',
    energyCost: 3,
    authorUid: 'u1',
    authorName: 'Test',
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

function log(partial: Partial<PacingLog> & Pick<PacingLog, 'id' | 'activityId' | 'difficulty'>): PacingLog {
  return {
    date: '2026-08-23',
    time: '12:00',
    title: 'x',
    description: '',
    kind: 'household',
    done: true,
    authorUid: 'u1',
    authorName: 'Test',
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

describe('pacing.model', () => {
  it('normalizes unknown kinds to household', () => {
    expect(normalizePacingKind('physical')).toBe('physical');
    expect(normalizePacingKind('nope')).toBe('household');
  });

  it('treats rest as credit and other kinds as spend', () => {
    const balance = dayBalance(
      [
        log({ id: '1', activityId: 'a', difficulty: 6, kind: 'physical' }),
        log({ id: '2', activityId: 'b', difficulty: 2, kind: 'rest' }),
      ],
      20,
    );
    expect(balance.spent).toBe(6);
    expect(balance.rest).toBe(2);
    expect(balance.net).toBe(4);
    expect(balance.zone).toBe('safe');
  });

  it('marks a day as over when net exceeds the budget', () => {
    const balance = dayBalance([log({ id: '1', activityId: 'a', difficulty: 10, kind: 'physical' })], 8);
    expect(balance.zone).toBe('over');
    expect(balance.usedPercent).toBe(100);
  });

  it('suggests the average of recent logs', () => {
    const item = activity({ id: 'shower', title: 'Duschen', energyCost: 3 });
    const logs = [
      log({ id: '1', activityId: 'shower', difficulty: 6, date: '2026-08-20' }),
      log({ id: '2', activityId: 'shower', difficulty: 4, date: '2026-08-21' }),
    ];
    expect(suggestedCost(item, logs)).toBe(5);
  });

  it('ranks frequent activities first and keeps unused rest nearby', () => {
    const items = [
      activity({ id: 'a', title: 'Duschen' }),
      activity({ id: 'b', title: 'Liegen', kind: 'rest' }),
      activity({ id: 'c', title: 'Telefon' }),
    ];
    const logs = [
      log({ id: '1', activityId: 'c', difficulty: 3 }),
      log({ id: '2', activityId: 'c', difficulty: 3 }),
      log({ id: '3', activityId: 'a', difficulty: 4 }),
    ];
    expect(frequentActivities(items, logs, 2).map((item) => item.id)).toEqual(['c', 'a']);
  });

  it('suggests a smaller budget for a lower Bell score', () => {
    expect(suggestedBudgetFromBell(20)).toBeLessThan(suggestedBudgetFromBell(70));
    expect(suggestedBudgetFromBell(100)).toBeGreaterThan(suggestedBudgetFromBell(50));
  });

  it('scales the Bell budget down when morning energy is low', () => {
    expect(budgetFromBellAndEnergy(70, 10)).toBe(suggestedBudgetFromBell(70));
    expect(budgetFromBellAndEnergy(70, 5)).toBe(Math.round(suggestedBudgetFromBell(70) * 0.5));
    expect(budgetFromBellAndEnergy(70, 0)).toBe(1);
    expect(budgetFromBellAndEnergy(70, 2)).toBeLessThan(budgetFromBellAndEnergy(70, 8));
  });

  it('uses green for high rest credit and red for low rest credit', () => {
    expect(creditColor(10)).toBe(difficultyColor(0));
    expect(creditColor(0)).toBe(difficultyColor(10));
  });

  it('keeps green on the cheap/helpful side of the 0–10 scale', () => {
    expect(scaleColor(0, false)).toBe(difficultyColor(0));
    expect(scaleColor(10, false)).toBe(difficultyColor(10));
    expect(scaleColor(0, true)).toBe(creditColor(0));
    expect(scaleColor(10, true)).toBe(creditColor(10));
  });

  it('hints at delayed PEM after a heavy day', () => {
    expect(
      pemPatternHint({
        todayEnergy: 2,
        todayPem: false,
        priorNet: 18,
        priorBudget: 20,
      }),
    ).toContain('Vorgestern');
    expect(
      pemPatternHint({
        todayEnergy: 7,
        todayPem: false,
        priorNet: 18,
        priorBudget: 20,
      }),
    ).toBeNull();
  });
});
