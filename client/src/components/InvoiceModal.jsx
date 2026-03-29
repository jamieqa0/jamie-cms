// client/src/components/InvoiceModal.jsx

const STATUS_LABEL = { issued: '발행됨', paid: '납부완료', failed: '실패' };
const STATUS_COLOR = {
  issued:  'bg-yellow-50 text-yellow-700',
  paid:    'bg-green-50 text-green-700',
  failed:  'bg-red-50 text-red-700',
};

export default function InvoiceModal({ invoice, onClose }) {
  if (!invoice) return null;

  const invoiceNo = invoice.id.replace(/-/g, '').slice(0, 8).toUpperCase();

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm print:shadow-none print:rounded-none">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">청구서</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 print:hidden text-xl leading-none">✕</button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 space-y-4">
          {/* 청구서 번호 + 상태 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">청구서 번호</span>
            <span className="font-mono text-sm font-semibold text-slate-700">{invoiceNo}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">상태</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[invoice.status]}`}>
              {STATUS_LABEL[invoice.status]}
            </span>
          </div>

          <hr className="border-dashed border-slate-200" />

          {/* 업체/상품 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">업체명</span>
            <span className="text-sm text-slate-800">{invoice.company_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">상품명</span>
            <span className="text-sm text-slate-800">{invoice.product_name}</span>
          </div>

          <hr className="border-dashed border-slate-200" />

          {/* 금액 내역 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">공급가액</span>
            <span className="text-sm text-slate-800">{Number(invoice.supply_amount).toLocaleString()}원</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">부가세 (10%)</span>
            <span className="text-sm text-slate-800">{Number(invoice.vat).toLocaleString()}원</span>
          </div>
          <div className="flex items-center justify-between font-bold">
            <span className="text-sm text-slate-900">합계</span>
            <span className="text-base text-slate-900">{Number(invoice.amount).toLocaleString()}원</span>
          </div>

          <hr className="border-dashed border-slate-200" />

          {/* 날짜 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">청구일</span>
            <span className="text-sm text-slate-600">
              {new Date(invoice.issued_at).toLocaleDateString('ko-KR')}
            </span>
          </div>
          {invoice.paid_at && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">납부일</span>
              <span className="text-sm text-slate-600">
                {new Date(invoice.paid_at).toLocaleDateString('ko-KR')}
              </span>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 pb-6 flex gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition"
          >
            인쇄 / PDF
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
