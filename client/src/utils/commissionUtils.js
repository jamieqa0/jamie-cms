/**
 * 수수료 금액에서 공급가액과 부가세(10%)를 계산합니다.
 * @param {number} totalAmount - 총 결제액
 * @param {number} rate - 수수료율 (%)
 * @returns {{ commission: number, supply: number, vat: number }}
 */
export function calculateCommission(totalAmount, rate) {
  const commission = Math.floor(totalAmount * (rate / 100));
  const supply = Math.floor(commission / 1.1);
  const vat = commission - supply;
  return { commission, supply, vat };
}
