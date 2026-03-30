import { describe, it, expect } from 'vitest';
import { calculateCommission } from './commissionUtils';

describe('calculateCommission', () => {
  it('5% 수수료로 100,000원 결제 시 올바른 수수료를 계산한다', () => {
    const { commission, supply, vat } = calculateCommission(100000, 5);
    expect(commission).toBe(5000);
    expect(supply).toBe(4545);
    expect(vat).toBe(455);
  });

  it('공급가액 + 부가세 = 수수료 총액', () => {
    const { commission, supply, vat } = calculateCommission(200000, 10);
    expect(supply + vat).toBe(commission);
  });

  it('금액이 0이면 모든 값이 0이다', () => {
    const result = calculateCommission(0, 5);
    expect(result).toEqual({ commission: 0, supply: 0, vat: 0 });
  });

  it('수수료율이 0이면 모든 값이 0이다', () => {
    const result = calculateCommission(100000, 0);
    expect(result).toEqual({ commission: 0, supply: 0, vat: 0 });
  });

  it('Math.floor로 소수점을 버린다', () => {
    // 100001 * 3% = 3000.03 → floor → 3000
    const { commission } = calculateCommission(100001, 3);
    expect(commission).toBe(3000);
  });
});
