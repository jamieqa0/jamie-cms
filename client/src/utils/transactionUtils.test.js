import { describe, it, expect } from 'vitest';
import { groupByDate } from './transactionUtils';

describe('groupByDate', () => {
  it('빈 배열이면 빈 결과를 반환한다', () => {
    expect(groupByDate([])).toHaveLength(0);
  });

  it('null/undefined이면 빈 결과를 반환한다', () => {
    expect(groupByDate(null)).toHaveLength(0);
    expect(groupByDate(undefined)).toHaveLength(0);
  });

  it('같은 날짜 거래를 하나의 그룹으로 묶는다', () => {
    const txns = [
      { id: '1', created_at: '2026-03-15T09:00:00Z', type: 'deposit', amount: 1000 },
      { id: '2', created_at: '2026-03-15T14:00:00Z', type: 'withdrawal', amount: 500 },
    ];
    const result = groupByDate(txns);
    expect(result).toHaveLength(1);
    expect(result[0][1]).toHaveLength(2);
  });

  it('다른 날짜 거래는 별도 그룹으로 분리한다', () => {
    const txns = [
      { id: '1', created_at: '2026-03-15T09:00:00Z', type: 'deposit', amount: 1000 },
      { id: '2', created_at: '2026-03-16T09:00:00Z', type: 'deposit', amount: 2000 },
    ];
    const result = groupByDate(txns);
    expect(result).toHaveLength(2);
  });

  it('각 그룹은 [날짜문자열, 거래배열] 형태이다', () => {
    const txns = [
      { id: '1', created_at: '2026-03-15T09:00:00Z', type: 'deposit', amount: 1000 },
    ];
    const result = groupByDate(txns);
    expect(result[0]).toHaveLength(2);
    expect(typeof result[0][0]).toBe('string');
    expect(Array.isArray(result[0][1])).toBe(true);
  });

  it('날짜 그룹 안의 거래는 원본 순서를 유지한다', () => {
    // UTC+9 환경에서도 같은 날로 유지되도록 이른 시각 사용 (T06~T10 UTC = KST 15~19시)
    const txns = [
      { id: '1', created_at: '2026-03-15T06:00:00Z', type: 'deposit', amount: 1000 },
      { id: '2', created_at: '2026-03-15T08:00:00Z', type: 'deposit', amount: 2000 },
      { id: '3', created_at: '2026-03-15T10:00:00Z', type: 'deposit', amount: 3000 },
    ];
    const result = groupByDate(txns);
    const group = result[0][1];
    expect(group[0].id).toBe('1');
    expect(group[1].id).toBe('2');
    expect(group[2].id).toBe('3');
  });
});
