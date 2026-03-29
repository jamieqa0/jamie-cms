// client/src/components/ReceiptModal.jsx

export default function ReceiptModal({ invoice, onClose }) {
  if (!invoice || invoice.status !== 'paid') return null;

  const approvalNo = invoice.billing_log_id
    ? invoice.billing_log_id.replace(/-/g, '').slice(0, 8).toUpperCase()
    : '--------';

  const paidAt = invoice.paid_at
    ? new Date(invoice.paid_at).toLocaleString('ko-KR')
    : '-';

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 print:bg-white print:inset-auto print:flex print:items-start print:justify-center">
      <div className="bg-white w-full max-w-xs shadow-xl print:shadow-none" style={{ fontFamily: 'monospace' }}>

        {/* 상단 헤더 */}
        <div className="text-center py-4 border-b-2 border-dashed border-slate-300 px-5">
          <div className="text-xs text-slate-400 mb-1">국세청 승인</div>
          <div className="text-2xl font-black tracking-widest text-slate-900">현금영수증</div>
          <div className="text-xs text-slate-500 mt-1">CASH RECEIPT</div>
        </div>

        {/* 승인번호 */}
        <div className="px-5 py-3 border-b border-dashed border-slate-200">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">승인번호</span>
            <span className="font-bold text-slate-800 tracking-widest">{approvalNo}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-400">거래일시</span>
            <span className="text-slate-700">{paidAt}</span>
          </div>
        </div>

        {/* 가맹점 정보 */}
        <div className="px-5 py-3 border-b border-dashed border-slate-200">
          <div className="text-xs text-slate-400 mb-1.5">[ 가맹점 정보 ]</div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">상호</span>
            <span className="font-medium text-slate-800">{invoice.company_name}</span>
          </div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">사업자번호</span>
            <span className="text-slate-700">000-00-00000</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">상품명</span>
            <span className="text-slate-700">{invoice.product_name}</span>
          </div>
        </div>

        {/* 금액 내역 */}
        <div className="px-5 py-3 border-b border-dashed border-slate-200">
          <div className="text-xs text-slate-400 mb-1.5">[ 결제 금액 ]</div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">공급가액</span>
            <span className="text-slate-700">{Number(invoice.supply_amount).toLocaleString()} 원</span>
          </div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-500">부가세(10%)</span>
            <span className="text-slate-700">{Number(invoice.vat).toLocaleString()} 원</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-slate-300 pt-2">
            <span className="text-slate-900">합 계</span>
            <span className="text-slate-900">{Number(invoice.amount).toLocaleString()} 원</span>
          </div>
        </div>

        {/* 하단 안내 + 도장 */}
        <div className="px-5 py-4 relative">
          <p className="text-xs text-slate-400 text-center leading-relaxed">
            현금영수증 문의: 국세청 홈택스 (www.hometax.go.kr)<br />
            현금영수증 상담전화: 126
          </p>
          {/* 승인완료 도장 */}
          <div className="absolute top-3 right-5 w-14 h-14 border-2 border-red-500 rounded-full flex items-center justify-center rotate-12 opacity-70">
            <span className="text-red-500 text-xs font-black text-center leading-tight">승인<br/>완료</span>
          </div>
        </div>

        {/* 버튼 */}
        <div className="px-5 pb-5 flex gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
          >
            인쇄 / PDF
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-700 transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
