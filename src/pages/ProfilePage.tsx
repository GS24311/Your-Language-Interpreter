import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { UserProfile, Message } from '../types';
import { getTraitAnalysis } from '../lib/gemini';
import { motion } from 'motion/react';
import { 
  Brain, 
  Target, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2,
  Sparkles,
  Heart,
  Quote,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      const docRef = doc(db, 'users', auth.currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  const updateTraitAnalysis = async () => {
    if (!auth.currentUser || !profile) return;
    setAnalyzing(true);

    try {
      // Get recent messages for analysis
      const conversationsSnap = await getDocs(
        query(collection(db, 'users', auth.currentUser.uid, 'conversations'), orderBy('lastMessageAt', 'desc'), limit(3))
      );
      
      let recentMessages: { role: string, content: string }[] = [];
      for (const convDoc of conversationsSnap.docs) {
        const msgsSnap = await getDocs(
          query(collection(db, 'users', auth.currentUser.uid, 'conversations', convDoc.id, 'messages'), orderBy('timestamp', 'desc'), limit(10))
        );
        recentMessages = [...recentMessages, ...msgsSnap.docs.map(d => ({ role: d.data().role, content: d.data().content }))];
      }

      if (recentMessages.length === 0) {
        alert("Not enough conversation data to analyze traits yet.");
        return;
      }

      const analysis = await getTraitAnalysis(recentMessages);
      
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        'traitProfile.attachmentStyle': analysis.attachmentStyle,
        'traitProfile.communicationStyle': analysis.communicationStyle,
        'traitProfile.triggers': analysis.triggers,
        'traitProfile.advice': analysis.advice
      });

      setProfile(prev => prev ? {
        ...prev,
        traitProfile: {
          ...prev.traitProfile,
          ...analysis
        }
      } : null);

    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleSetting = async (key: keyof NonNullable<UserProfile['settings']>) => {
    if (!auth.currentUser || !profile) return;
    
    // Default settings if they don't exist
    const currentSettings = profile.settings || {
      realTimeCoaching: true,
      shareAnonymousData: false
    };
    
    const newSettings = {
      ...currentSettings,
      [key]: !currentSettings[key]
    };

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        settings: newSettings
      });
      
      setProfile(prev => prev ? {
        ...prev,
        settings: newSettings
      } : null);
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  if (loading) return null;

  const userSettings = profile?.settings || {
    realTimeCoaching: true,
    shareAnonymousData: false
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-24 h-24 bg-white rounded-[32px] border-2 border-primary flex items-center justify-center p-2 shadow-xl">
           <div className="w-full h-full bg-bg-base rounded-[24px] flex items-center justify-center">
              <UserIcon className="w-10 h-10 text-primary" />
           </div>
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">성향 프로필</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">{profile?.email}</p>
        </div>
      </div>

      {/* Trait Cards matching sketch */}
      <div className="space-y-4">
        <TraitCard 
          label="성향 1: 애착 유형" 
          value={profile?.traitProfile?.attachmentStyle || '분석 중...'} 
          icon={Heart}
          color="bg-primary text-white"
        />
        <TraitCard 
          label="성향 2: 소통 스타일" 
          value={profile?.traitProfile?.communicationStyle || '분석 중...'} 
          icon={Target}
          color="bg-white text-secondary border border-[#e5e5d8]"
        />
        
        {profile?.traitProfile?.advice && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 bg-accent rounded-[40px] border border-[#e5e5d8] border-dashed"
          >
            <div className="flex items-center gap-2 mb-4 text-primary">
              <Sparkles className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">성장 추천 제안</span>
            </div>
            <p className="text-gray-700 leading-relaxed text-sm">
              "{profile.traitProfile.advice}"
            </p>
          </motion.div>
        )}
      </div>

      <div className="pt-4 space-y-4">
        <button
          onClick={updateTraitAnalysis}
          disabled={analyzing}
          className="w-full flex items-center justify-center gap-3 bg-white border border-[#e5e5d8] text-primary px-8 py-5 rounded-[32px] font-bold hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
        >
          {analyzing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          <span className="uppercase text-xs tracking-widest">{analyzing ? '패턴 분석 중...' : '나의 성향 업데이트'}</span>
        </button>

        {/* App Info Menu Section */}
        <div className="bg-[#f5f5f0] rounded-[40px] p-8 space-y-6 border border-[#e5e5d8]">
           {/* Experience & Privacy Settings */}
           <div className="pt-8 space-y-6">
              <div className="flex items-center gap-3 text-secondary mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">경험 개선 및 프라이버시</span>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-bold">실공간 실시간 코칭</h5>
                    <p className="text-[10px] text-gray-400 font-medium">대화 중 실시간으로 AI 팁을 노출합니다.</p>
                  </div>
                  <div 
                    onClick={() => toggleSetting('realTimeCoaching')}
                    className={`w-12 h-6 rounded-full relative p-1 cursor-pointer transition-colors ${userSettings.realTimeCoaching ? 'bg-secondary' : 'bg-gray-200'}`}
                  >
                    <motion.div 
                      animate={{ x: userSettings.realTimeCoaching ? 24 : 0 }}
                      className="w-4 h-4 bg-white rounded-full" 
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-sm font-bold">인사이트 익명 데이터 공유</h5>
                    <p className="text-[10px] text-gray-400 font-medium">사용자 통계 데이터 품질 개선에 참여합니다.</p>
                  </div>
                  <div 
                    onClick={() => toggleSetting('shareAnonymousData')}
                    className={`w-12 h-6 rounded-full relative p-1 cursor-pointer transition-colors ${userSettings.shareAnonymousData ? 'bg-secondary' : 'bg-gray-200'}`}
                  >
                    <motion.div 
                      animate={{ x: userSettings.shareAnonymousData ? 24 : 0 }}
                      className="w-4 h-4 bg-white rounded-full" 
                    />
                  </div>
                </div>
              </div>
           </div>

           <div className="flex items-center gap-3 text-gray-400 mb-2 pt-6">
             <AlertCircle className="w-4 h-4" />
             <span className="text-[10px] font-bold uppercase tracking-widest">계정 및 앱 정보</span>
           </div>
           
           <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                 <span className="text-xs font-bold text-gray-500">사용자 이름</span>
                 <span className="text-xs font-bold text-primary">{auth.currentUser?.displayName || '익명'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                 <span className="text-xs font-bold text-gray-500">이메일</span>
                 <span className="text-xs font-bold text-primary">{auth.currentUser?.email}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                 <span className="text-xs font-bold text-gray-500">상태</span>
                 <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span className="text-[10px] font-bold text-green-600 uppercase">인증됨</span>
                 </div>
              </div>
              <div className="flex justify-between items-center py-2">
                 <span className="text-xs font-bold text-gray-500">앱 버전</span>
                 <span className="text-[10px] font-bold text-gray-400">v1.0.5 (Beta)</span>
              </div>
           </div>

           <div className="pt-4 text-center">
              <p className="text-[9px] text-gray-400 font-medium leading-relaxed">
                네 언어 해석기는 AI를 통해 건강한 대화를 돕는 심리 분석 도구입니다.<br/>
                © 2026 AI Dialogue Lab. All rights reserved.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}

function TraitCard({ label, value, icon: Icon, color }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      className={`p-6 rounded-[32px] flex items-center gap-6 shadow-sm ${color}`}
    >
      <div className={`p-4 rounded-2xl ${color.includes('bg-primary') ? 'bg-white/10' : 'bg-accent'}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <h4 className={`text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1`}>{label}</h4>
        <p className="font-bold text-lg leading-tight">{value}</p>
      </div>
    </motion.div>
  );
}
