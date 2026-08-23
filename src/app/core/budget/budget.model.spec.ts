import {
  availableCreateMonths,
  availableCreateYears,
  isCurrentMonth,
  isFutureMonth,
  toYearMonth,
} from './budget.model';

describe('budget month helpers', () => {
  const now = new Date(2026, 7, 24);

  it('treats later months in the same year as future', () => {
    expect(isFutureMonth(2026, 8, now)).toBe(false);
    expect(isFutureMonth(2026, 9, now)).toBe(true);
    expect(isCurrentMonth(2026, 8, now)).toBe(true);
  });

  it('offers only missing past months for create', () => {
    const existing = [toYearMonth(2026, 7), toYearMonth(2025, 12)];
    expect(availableCreateMonths(2026, existing, now)).toEqual([6, 5, 4, 3, 2, 1]);
    expect(availableCreateMonths(2025, existing, now)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(availableCreateMonths(2027, existing, now)).toEqual([]);
  });

  it('lists years that still have a creatable month', () => {
    expect(availableCreateYears([toYearMonth(2026, 7)], now)[0]).toBe(2026);
    expect(availableCreateYears([toYearMonth(2026, 7)], now)).not.toContain(2027);
  });
});
