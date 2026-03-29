/**
 * 거래 내역을 날짜별로 그룹핑
 * @param {Array} transactions - { created_at, ... } 배열
 * @returns {Array} - [[날짜문자열, 거래배열], ...] 형태
 */
export function groupByDate(transactions) {
  const groups = {};

  (transactions || []).forEach(t => {
    const d = new Date(t.created_at || t.executed_at || Date.now());
    const key = d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  return Object.entries(groups);
}
