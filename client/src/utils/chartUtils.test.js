import { describe, it, expect, beforeEach } from 'vitest';
import { buildMonthlyChart, buildMonthlyTransferChart } from './chartUtils';

describe('buildMonthlyChart', () => {
  let now;

  beforeEach(() => {
    now = new Date();
  });

  it('항상 6개월치 데이터를 반환한다', () => {
    const result = buildMonthlyChart([]);
    expect(result).toHaveLength(6);
  });

  it('데이터가 없으면 모든 금액이 0이다', () => {
    const result = buildMonthlyChart([]);
    result.forEach(entry => expect(entry.amount).toBe(0));
  });

  it('paid 청구서 금액을 해당 월에 합산한다', () => {
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
    const invoices = [
      { status: 'paid', amount: 10000, issued_at: thisMonth },
      { status: 'paid', amount: 5000, issued_at: thisMonth },
    ];
    const result = buildMonthlyChart(invoices);
    const current = result.find(r => r.current);
    expect(current.amount).toBe(15000);
  });

  it('paid가 아닌 청구서는 합산하지 않는다', () => {
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
    const invoices = [
      { status: 'issued', amount: 10000, issued_at: thisMonth },
      { status: 'failed', amount: 5000, issued_at: thisMonth },
    ];
    const result = buildMonthlyChart(invoices);
    const current = result.find(r => r.current);
    expect(current.amount).toBe(0);
  });

  it('6개월 이전 데이터는 포함하지 않는다', () => {
    const oldDate = new Date(now.getFullYear(), now.getMonth() - 6, 15);
    const invoices = [
      { status: 'paid', amount: 99999, issued_at: oldDate.toISOString() },
    ];
    const result = buildMonthlyChart(invoices);
    const total = result.reduce((s, r) => s + r.amount, 0);
    expect(total).toBe(0);
  });

  it('이번 달 항목에 current: true를 붙인다', () => {
    const result = buildMonthlyChart([]);
    const currentItems = result.filter(r => r.current);
    expect(currentItems).toHaveLength(1);
    expect(result[result.length - 1].current).toBe(true);
  });

  it('과거 달 항목에 current: false를 붙인다', () => {
    const result = buildMonthlyChart([]);
    result.slice(0, 5).forEach(r => expect(r.current).toBe(false));
  });
});

describe('buildMonthlyTransferChart', () => {
  it('항상 6개월치 데이터를 반환한다', () => {
    expect(buildMonthlyTransferChart([])).toHaveLength(6);
  });

  it('status가 success인 항목만 집계한다', () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-10T06:00:00Z`;
    const transfers = [
      { status: 'success', amount: 10000, executed_at: thisMonth },
      { status: 'failed',  amount: 5000,  executed_at: thisMonth },
    ];
    const result = buildMonthlyTransferChart(transfers);
    const current = result.find(r => r.current);
    expect(current.amount).toBe(10000);
  });
});
