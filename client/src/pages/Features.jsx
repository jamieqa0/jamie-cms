import { useNavigate } from 'react-router-dom';

const FEATURES = [
  {
    title: '정기결제 자동화',
    desc: '매달 번거로운 결제 요청은 그만. JamiePay가 약속된 날짜에 자동으로 이체를 도와드려요.',
    icon: '⚡',
    color: 'bg-blue-50 text-blue-600'
  },
  {
    title: '투명한 구독 관리',
    desc: '내가 어떤 서비스를 구독하고 있는지 한눈에 파악하고, 필요할 땐 언제든 쉽게 신청하고 해지하세요.',
    icon: '📊',
    color: 'bg-emerald-50 text-emerald-600'
  },
  {
    title: '스마트한 인보이스',
    desc: '모든 결제 내역을 깔끔한 청구서로 확인하세요. 이메일이나 카카오톡으로도 바로 보내드립니다.',
    icon: '📄',
    color: 'bg-violet-50 text-violet-600'
  },
  {
    title: '강력한 어드민 도구',
    desc: '업체라면 고객의 결제 상태를 실시간으로 모니터링하고 미납 내역을 체계적으로 관리할 수 있습니다.',
    icon: '🛠️',
    color: 'bg-orange-50 text-orange-600'
  }
];

export default function Features() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-20 space-y-16">
        
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <span className="text-sm font-extrabold text-blue-600 uppercase tracking-widest">About JamiePay</span>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">
            결제의 새로운 기준,<br />제이미페이의 주요 기능을 소개합니다.
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
            복잡하고 번거로운 정기 결제 업무, 이제 제이미페이에게 맡겨주세요. 
            고객과 사업자 모두가 만족하는 결제 솔루션을 제공합니다.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {FEATURES.map((f, i) => (
            <div key={i} className="p-8 rounded-3xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5 transition-all group">
              <div className={`w-12 h-12 ${f.color} rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform`}>
                {f.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{f.title}</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="bg-slate-900 rounded-[2.5rem] p-10 md:p-16 text-center text-white space-y-8 shadow-2xl shadow-slate-900/20">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold">지금 바로 시작해보세요</h2>
            <p className="text-slate-400 max-w-md mx-auto">
              수만 명의 사용자가 제이미페이로 결제 스트레스를 날려버리고 있습니다.
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-bold hover:bg-blue-50 transition-colors shadow-lg"
          >
            JamiePay 시작하기
          </button>
        </div>

        <div className="text-center pt-8">
          <button
            onClick={() => navigate(-1)}
            className="text-slate-400 text-sm hover:text-slate-600 transition underline underline-offset-4"
          >
            이전 페이지로
          </button>
        </div>
      </div>
    </div>
  );
}
