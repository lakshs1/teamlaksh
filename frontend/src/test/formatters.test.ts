import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatTime,
  formatTimeRange,
  calcDurationHours,
  getInitials,
} from '../utils/formatters';

describe('Formatter Utilities', () => {
  it('formats currency in Dollars', () => {
    expect(formatCurrency(500)).toBe('$500');
    expect(formatCurrency(125000)).toBe('$125,000');
    expect(formatCurrencyCompact(1200000)).toBe('$1.2M');
    expect(formatCurrencyCompact(4500)).toBe('$4.5K');
  });

  it('formats dates in DD MMM YYYY format', () => {
    expect(formatDate('2024-05-15')).toContain('15');
    expect(formatDate('2024-05-15')).toContain('May');
    expect(formatDate('2024-05-15')).toContain('2024');
  });

  it('formats 24-hr time strings into 12-hr format', () => {
    expect(formatTime('06:00')).toBe('06:00 AM');
    expect(formatTime('18:00')).toBe('06:00 PM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTime('00:00')).toBe('12:00 AM');
  });

  it('formats time ranges', () => {
    expect(formatTimeRange('18:00', '19:00')).toBe('06:00 PM – 07:00 PM');
  });

  it('calculates duration in hours', () => {
    expect(calcDurationHours('06:00', '08:00')).toBe(2);
    expect(calcDurationHours('18:00', '19:30')).toBe(1.5);
  });

  it('extracts initials from user name', () => {
    expect(getInitials('Rahul Sharma')).toBe('RS');
    expect(getInitials('Mawiya')).toBe('M');
  });
});
