import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, TrendingUp, Heart, Zap, Target, BookOpen, ShieldCheck, Share2, Globe, MessageCircle, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, AreaChart, Area } from 'recharts';
import { collection, query, orderBy, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

const MOCK_TREND_DATA = [
  { name: '월', positive: 65, negative: 40 },
  { name: '화', positive: 59, negative: 30 },
  { name: '수', positive: 80, negative: 20 },
  { name: '목', positive: 81, negative: 50 },
  { name: '금', positive: 56, negative: 45 },
  { name: '토', positive: 55, negative: 30 },
  { name: '일', positive: 40, negative: 20 },
];

const STYLE_DATA = [
  { name: '공감형', value: 85, color: '#FF7D7D' },
  { name: '논리형', value: 65, color: '#7D9CFF' },
  { name: '직설형', value: 45, color: '#A57DFF' },
  { name: '회피형', value: 30, color: '#FFD97D' },
];

const TOPIC_MAP = [
  { topic: '인간관계', frequency: 78, sentiment: 'positive', description: '친구와 가족에 대한 대화가 많아요' },
  { topic: '자기계발', frequency: 45, sentiment: 'neutral', description: '미래에 대한 고민을 나누고 있어요' },
  { topic: '감정 표현', frequency: 92, sentiment: 'positive', description: '자신의 감정을 솔직하게 표현 중입니다' },
  { topic: '업무/학습', frequency: 32, sentiment: 'negative', description: '스트레스 관리가 필요해 보여요' },
];

export default function InsightsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    const fetchStats = async () => {
      if (!auth.currentUser) {
        // If no user yet, don't stop loading until we're sure
        return;
      }
      try {
        const statsDoc = await getDoc(doc(db, 'users', auth.currentUser.uid, 'stats', 'overall'));
        if (statsDoc.exists()) {
          setStats(statsDoc.data());
        } else {
          setStats({
            level: 12,
            totalPoints: 2450,
            empathyScore: 78,
            clarityScore: 64,
            resilienceScore: 92
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    // Use a small delay if auth might be null briefly
    const interval = setInterval(() => {
      if (auth.currentUser) {
        fetchStats();
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFDFB] flex flex-col items-center justify-center p-8 text-center">
        <div className="relative w-16 h-16 mb-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-4 border-primary/10 border-t-primary rounded-full"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Sparkles className="w-6 h-6 text-primary" />
          </motion.div>
        </div>
        <h3 className="text-base font-display font-bold text-gray-800">마음의 패턴을 분석하는 중</h3>
        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
          과거의 대화들을 되짚어보며<br/>
          당신의 성장을 위한 인사이트를 정리하고 있어요.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFB] pb-24">
      {/* Top Header */}
      <div className="bg-white px-6 pt-12 pb-8 border-b border-[#E5E5D8] sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <h1 className="text-xl font-display font-bold">인사이트 센터</h1>
        </div>

        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          <TabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} title="요약" />
          <TabButton active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')} title="타임라인" />
          <TabButton active={activeTab === 'map'} onClick={() => setActiveTab('map')} title="주제 레이다" />
          <TabButton active={activeTab === 'social'} onClick={() => setActiveTab('social')} title="소셜 인사이트" />
        </div>
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'summary' && (
            <motion.div 
              key="summary"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Growth index (Better presentation) */}
              <div className="bg-primary p-8 rounded-[40px] text-white shadow-xl shadow-primary/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-40 h-40" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">Level {stats?.level || 1}</span>
                  </div>
                  <h2 className="text-3xl font-display font-bold mb-4">마음 성장도</h2>
                  <div className="w-full h-3 bg-white/20 rounded-full mb-4 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '68%' }}
                      className="h-full bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.7)]"
                    />
                  </div>
                  <p className="text-sm font-medium opacity-80 flex items-center gap-2">
                     <Zap className="w-4 h-4" /> 상위 12%의 커뮤니케이터입니다!
                  </p>
                </div>
              </div>

              {/* 2x2 Grid Stats */}
              <div className="grid grid-cols-2 gap-4">
                <StatCard icon={Heart} label="공감 수치" value={`${stats?.empathyScore || 0}%`} color="bg-red-50 text-red-500" />
                <StatCard icon={Target} label="의도 전달" value={`${stats?.clarityScore || 0}%`} color="bg-blue-50 text-blue-500" />
                <StatCard icon={ShieldCheck} label="감정 복원" value={`${stats?.resilienceScore || 0}%`} color="bg-green-50 text-green-500" />
                <StatCard icon={Zap} label="미션 성공" value="82%" color="bg-yellow-50 text-yellow-600" />
              </div>

              {/* Style Radar Preview */}
              <div className="bg-white p-7 rounded-[40px] border border-[#E5E5D8] shadow-sm overflow-hidden relative">
                 <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12">
                   <Globe className="w-24 h-24 text-primary" />
                 </div>
                 <div className="flex justify-between items-center mb-6 relative z-10">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">커뮤니케이션 DNA</h3>
                    <BookOpen className="w-4 h-4 text-gray-300" />
                 </div>
                 <div className="h-48 w-full relative z-10">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={STYLE_DATA} layout="vertical">
                       <XAxis type="number" hide />
                       <YAxis dataKey="name" type="category" fontSize={11} tickLine={false} axisLine={false} width={60} />
                       <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '15px' }} />
                       <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={22}>
                         {STYLE_DATA.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.color} />
                         ))}
                       </Bar>
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
                 <div className="pt-4 mt-2 border-t border-gray-50 flex items-center justify-center gap-2">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <p className="text-[11px] text-gray-500 font-medium">당신은 따뜻한 공감을 전하는 <span className="text-primary font-bold">오아시스</span> 타입입니다.</p>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'timeline' && (
            <motion.div 
              key="timeline"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white p-7 rounded-[40px] border border-[#E5E5D8] shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">감정 에너지 흐름</h3>
                    <p className="text-[10px] text-gray-400">AI가 분석한 주간 대화의 온도</p>
                  </div>
                  <div className="flex gap-2">
                     <span className="w-2 h-2 bg-red-400 rounded-full" />
                     <span className="w-2 h-2 bg-blue-400 rounded-full" />
                  </div>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MOCK_TREND_DATA}>
                      <defs>
                        <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF7D7D" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#FF7D7D" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f0" />
                      <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: '#aaa' }} />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
                      />
                      <Area type="monotone" dataKey="positive" stroke="#FF7D7D" strokeWidth={4} fillOpacity={1} fill="url(#colorPos)" />
                      <Line type="monotone" dataKey="negative" stroke="#7D9CFF" strokeWidth={2} dot={{ r: 4, fill: '#7D9CFF' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                 <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">하이라이트 모먼트</h4>
                 {[
                   { title: '가장 따뜻했던 말', content: '"네가 있어서 정말 다행이야."', date: '어제', color: 'bg-red-50 text-red-500' },
                   { title: '성장의 시작', content: '"그때 내가 조금 서툴렀던 것 같아."', date: '3일 전', color: 'bg-blue-50 text-blue-500' },
                 ].map((item, i) => (
                   <div key={i} className="bg-white p-6 rounded-[32px] border border-[#E5E5D8] flex gap-4">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${item.color}`}>
                         <Heart className="w-5 h-5" />
                      </div>
                      <div>
                         <div className="flex justify-between items-center mb-1">
                           <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{item.title}</span>
                           <span className="text-[9px] font-bold text-gray-300">{item.date}</span>
                         </div>
                         <p className="text-sm font-bold text-gray-700">"{item.content}"</p>
                      </div>
                   </div>
                 ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'map' && (
            <motion.div 
              key="map"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-6"
            >
              {/* Improved Topic Map (Bento Inspired) */}
              <div className="grid grid-cols-2 gap-4">
                {TOPIC_MAP.map((item, i) => (
                  <motion.div 
                    key={i}
                    whileHover={{ y: -5 }}
                    className={`p-6 rounded-[40px] border border-[#E5E5D8] ${i === 0 ? 'col-span-1 row-span-1' : ''} ${i === 2 ? 'col-span-1 bg-primary/5 border-primary/20' : 'bg-white'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                       <div className={`p-2 rounded-xl ${item.sentiment === 'positive' ? 'bg-red-50 text-red-500' : item.sentiment === 'negative' ? 'bg-blue-50 text-blue-500' : 'bg-gray-50 text-gray-500'}`}>
                          <MessageCircle className="w-4 h-4" />
                       </div>
                       <span className="text-[10px] font-bold text-gray-300">#0{i+1}</span>
                    </div>
                    <h3 className="text-lg font-display font-bold mb-1">{item.topic}</h3>
                    <div className="h-1 w-12 bg-gray-100 rounded-full mb-3 overflow-hidden">
                       <div className="h-full bg-primary" style={{ width: `${item.frequency}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 leading-tight font-medium">{item.description}</p>
                  </motion.div>
                ))}
              </div>

              <div className="bg-secondary/10 p-8 rounded-[40px] border border-secondary/20 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-5">
                   <Target className="w-24 h-24" />
                 </div>
                 <h4 className="text-xs font-bold text-secondary uppercase tracking-widest mb-4">AI 키워드 분석</h4>
                 <div className="flex flex-wrap gap-2">
                    {['진심', '응원', '미래', '공감', '성장', '솔직함'].map((word, i) => (
                      <span key={i} className="px-4 py-2 bg-white rounded-full text-[11px] font-bold text-secondary shadow-sm">
                        {word}
                      </span>
                    ))}
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'social' && (
            <motion.div 
              key="social"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Comparison Section (Improved) */}
              <div className="bg-white p-7 rounded-[40px] border border-[#E5E5D8] shadow-sm">
                 <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                       <Globe className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">우주 전체 데이터와 비교</h3>
                 </div>

                 <div className="space-y-8">
                   {[
                     { label: '공감 수치', me: 88, avg: 62, icon: Heart, color: 'primary' },
                     { label: '조율 능력', me: 75, avg: 55, icon: Target, color: 'secondary' },
                     { label: '표현 자신감', me: 42, avg: 58, icon: ShieldCheck, color: 'primary' },
                   ].map((item, i) => (
                     <div key={i} className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                           <div className="flex items-center gap-2">
                              <item.icon className="w-3 h-3 text-gray-300" />
                              <span className="text-[11px] font-bold text-gray-600">{item.label}</span>
                           </div>
                           <span className="text-[10px] font-bold text-primary">상위 {100 - item.me}%</span>
                        </div>
                        <div className="relative h-6 flex items-center">
                           <div className="absolute inset-0 bg-gray-50 rounded-full h-1 my-auto" />
                           {/* Average Marker */}
                           <div 
                             className="absolute w-1 h-3 bg-gray-300 rounded-full z-10"
                             style={{ left: `${item.avg}%` }}
                           />
                           <div className="absolute translate-x-[-50%] top-6 text-[8px] font-bold text-gray-300 uppercase tracking-tighter" style={{ left: `${item.avg}%` }}>Community Avg</div>
                           
                           {/* My Progress */}
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${item.me}%` }}
                             className={`h-2 rounded-full z-20 shadow-sm ${item.color === 'primary' ? 'bg-primary' : 'bg-secondary'}`}
                           >
                             <div className="flex justify-end p-0.5">
                                <div className="w-1 h-1 bg-white rounded-full" />
                             </div>
                           </motion.div>
                        </div>
                     </div>
                   ))}
                 </div>
              </div>

              <div className="bg-primary p-10 rounded-[40px] text-center relative overflow-hidden">
                 <div className="absolute inset-0 opacity-10">
                   <div className="absolute top-[-10%] left-[-10%] w-40 h-40 bg-white rounded-full blur-3xl animate-pulse" />
                   <div className="absolute bottom-[-10%] right-[-10%] w-40 h-40 bg-secondary rounded-full blur-3xl" />
                 </div>
                 <div className="relative z-10">
                    <h4 className="text-xs font-bold text-white/60 uppercase tracking-[0.2em] mb-4">AI 평가 리포트</h4>
                    <p className="text-2xl font-display font-bold text-white leading-snug mb-2">
                      당신은 주변을 밝히는 <br/> 따뜻한 빛과 같은 존재입니다.
                    </p>
                    <p className="text-xs text-white/70 font-medium px-4">
                      공감 능력이 주변 사용자들보다 압도적으로 높습니다. 사람들에게 큰 위로를 주고 계시네요.
                    </p>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Action */}
        <div className="pt-8">
          <button className="w-full py-6 bg-white border border-[#E5E5D8] rounded-[32px] font-bold text-gray-600 flex items-center justify-center gap-3 hover:bg-gray-50 active:scale-95 transition-all text-xs uppercase tracking-widest shadow-sm">
             <Share2 className="w-4 h-4" />
             보고서 저장 및 공유하기
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-white p-5 rounded-[32px] border border-[#E5E5D8] shadow-sm flex flex-col gap-3 group hover:border-primary/30 transition-all">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1.5">{label}</div>
        <div className="text-lg font-display font-bold text-gray-800">{value}</div>
      </div>
    </div>
  );
}

function TabButton({ title, active, onClick }: { title: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`shrink-0 px-6 py-2.5 rounded-2xl text-[11px] font-bold transition-all ${active ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
    >
      {title}
    </button>
  );
}

