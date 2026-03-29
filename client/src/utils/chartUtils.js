function buildMonthlyBase() {
  const now = new Date();
  const map = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map[key] = { month: `${d.getMonth() + 1}월`, amount: 0, current: i === 0 };
  }
  return map;
}

/**
 * 유저 청구서(invoices) 기반 월별 차트 데이터
 * @param {Array} invoices - { status: 'paid', amount, issued_at } 배열
 */
export function buildMonthlyChart(invoices) {
  const map = buildMonthlyBase();
  (invoices || []).filter(inv => inv.status === 'paid').forEach(inv => {
    const d = new Date(inv.issued_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (map[key]) map[key].amount += Number(inv.amount);
  });
  return Object.values(map);
}

/**
 * 어드민 자동이체(transfers) 기반 월별 차트 데이터
 * @param {Array} transfers - { status: 'success', amount, executed_at } 배열
 */
export function buildMonthlyTransferChart(transfers) {
  const map = buildMonthlyBase();
  (transfers || []).filter(t => t.status === 'success').forEach(t => {
    const d = new Date(t.executed_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (map[key]) map[key].amount += Number(t.amount || 0);
  });
  return Object.values(map);
}
