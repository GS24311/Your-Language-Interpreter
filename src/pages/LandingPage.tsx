import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { motion } from 'motion/react';
import { Sparkles, Heart, Brain, MessageSquare } from 'lucide-react';

export default function LandingPage() {
  const handleLogin = () => signInWithPopup(auth, googleProvider);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-bg-base">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-sm space-y-12"
      >
        {/* Starting Window Part */}
        <div className="space-y-6">
          <motion.div 
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            className="flex justify-center"
          >
            <div className="w-32 h-32 bg-primary rounded-[40px] flex items-center justify-center text-white shadow-2xl relative">
              <Sparkles className="w-16 h-16" />
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full border-4 border-primary" />
            </div>
          </motion.div>
          <h1 className="text-4xl font-display font-bold tracking-tight text-[#1a1a1a]">
            네 언어 해석기
          </h1>
        </div>

        {/* Log-in / Signup Window Part */}
        <div className="bg-white p-8 rounded-[48px] shadow-sm border border-[#e5e5d8] space-y-6">
          <h2 className="text-xl font-bold font-display underline decoration-primary/30 underline-offset-8">로그인 / 회원가입</h2>
          
          <button
            onClick={handleLogin}
            className="w-full bg-[#f5f5f0] border border-[#e5e5d8] rounded-2xl py-4 flex items-center justify-center gap-3 font-bold text-sm hover:bg-gray-50 transition-all group"
          >
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4 grayscale group-hover:grayscale-0 transition-all" alt="" />
            Google 계정으로 계속하기
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#e5e5d8]"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-gray-400 font-bold">또는 직접 입력</span></div>
          </div>

          <div className="space-y-3">
            <input type="text" placeholder="이름 (ID)" className="w-full bg-[#f9f9f5] border border-[#e5e5d8] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all" />
            <input type="password" placeholder="비밀번호 (pw)" className="w-full bg-[#f9f9f5] border border-[#e5e5d8] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all" />
            <div className="flex items-center gap-2 px-1">
              <input type="checkbox" id="maintain" className="accent-primary" />
              <label htmlFor="maintain" className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">로그인 상태 유지</label>
            </div>
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
          >
            시작하기
          </button>
        </div>

        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          AI 기반 심리 커뮤니케이션 앱
        </p>
      </motion.div>
    </div>
  );
}
