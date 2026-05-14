import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Play, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Heart, 
  HelpCircle, 
  AlertTriangle,
  History,
  RotateCcw,
  Edit3,
  CheckCircle2,
  Lock,
  SkipForward
} from 'lucide-react';
import { analyzeMessage, simulateResponse } from '../lib/gemini';
import { auth, db } from '../lib/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';

interface SimulationStep {
  role: 'user' | 'partner';
  content: string;
  senderName: string;
  analysis?: any;
  originalContent?: string;
  isModified?: boolean;
}

type Mode = 'INPUT' | 'PLAYING' | 'REWRITING';

export default function ReplayPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [mode, setMode] = useState<Mode>('INPUT');
  const [rawText, setRawText] = useState('');
  const [steps, setSteps] = useState<SimulationStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editText, setEditText] = useState('');
  const [diverged, setDiverged] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversation if ID is provided
  useEffect(() => {
    const loadConversation = async () => {
      if (!id || !auth.currentUser) return;
      
      try {
        setLoading(true);
        const conversationDoc = await getDoc(doc(db, 'users', auth.currentUser.uid, 'conversations', id));
        if (conversationDoc.exists()) {
          const messagesSnapshot = await getDocs(
            query(collection(db, 'users', auth.currentUser.uid, 'conversations', id, 'messages'), orderBy('order', 'asc'))
          );
          
          const conversationSteps = messagesSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              role: data.role,
              content: data.content,
              senderName: data.senderName || (data.role === 'user' ? '나' : '상대방'),
              analysis: data.analysis,
              originalContent: data.content
            };
          });
          
          setSteps(conversationSteps as SimulationStep[]);
          setMode('PLAYING');
          if (conversationSteps.length > 0 && !conversationSteps[0].analysis) {
            analyzeStep(0, conversationSteps as SimulationStep[]);
          }
        }
      } catch (error) {
        console.error('Error loading conversation for replay:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConversation();
  }, [id]);

  const parseAndStart = () => {
    if (!rawText.trim()) return;

    const lines = rawText.split('\n').filter(l => l.trim() !== '');
    const parsedSteps = lines.map((line, i) => {
      let role: 'user' | 'partner' = 'user';
      let content = line;
      let senderName = '나';

      const separator = line.includes(':') ? ':' : (line.includes('：') ? '：' : null);
      if (separator) {
        const parts = line.split(separator);
        senderName = parts[0].trim();
        content = parts.slice(1).join(separator).trim();
        
        const lowerName = senderName.toLowerCase();
        if (['나', 'me', '본인', '나님', 'a'].includes(lowerName)) {
          role = 'user';
          senderName = '나';
        } else {
          role = 'partner';
        }
      } else if (i % 2 !== 0) {
        role = 'partner';
        senderName = '상대방';
      }

      return { role, content: content || line, senderName, originalContent: content || line };
    });

    setSteps(parsedSteps as SimulationStep[]);
    setMode('PLAYING');
    setCurrentStep(0);
    analyzeStep(0, parsedSteps as SimulationStep[]);
  };

  const analyzeStep = async (index: number, currentSteps = steps) => {
    if (currentSteps[index].analysis) return;
    
    // Only set global loading if we don't even have the content yet (simulation case)
    // or if we want the "AI is thinking" effect for the very first time.
    // For original messages, we'll show the text first.
    const isNewSimulation = currentSteps[index].isModified || !currentSteps[index].originalContent;
    
    if (isNewSimulation) setLoading(true);

    try {
      const history = currentSteps.slice(0, index).map(s => ({ role: s.role, content: s.content }));
      const result = await analyzeMessage(currentSteps[index].content, currentSteps[index].role, null, history);
      const newSteps = [...currentSteps];
      newSteps[index].analysis = result;
      setSteps(newSteps);
    } catch (err) {
      console.error(err);
    } finally {
      if (isNewSimulation) setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const nextIdx = currentStep + 1;
      setCurrentStep(nextIdx);
      // Trigger analysis in background, don't block if content exists
      analyzeStep(nextIdx);
    }
  };

  const startRewrite = () => {
    setEditText(steps[currentStep].content);
    setMode('REWRITING');
  };

  const applyRewrite = async () => {
    if (!editText.trim() || editText === steps[currentStep].content) {
      setMode('PLAYING');
      return;
    }

    setLoading(true);
    try {
      // 1. Analyze the new message
      const analysis = await analyzeMessage(editText, 'user');
      
      // 2. Simulate partner's response based on history
      const history = steps.slice(0, currentStep).map(s => ({ role: s.role, content: s.content }));
      const simulation = await simulateResponse(history as any, editText);

      // 3. Update current step and remove all future steps (divergence)
      const newSteps = steps.slice(0, currentStep);
      newSteps.push({
        role: 'user',
        senderName: '나 (수정됨)',
        content: editText,
        isModified: true,
        originalContent: steps[currentStep].content,
        analysis
      });

      // 4. Add the simulated response
      newSteps.push({
        role: 'partner',
        senderName: steps[currentStep + 1]?.senderName || '상대방', // Try to keep name if exists
        content: simulation.reply,
        analysis: { emotion: '시뮬레이션', intent: simulation.reasoning, advice: '수정된 대화에 대한 반응입니다.' }
      });

      setSteps(newSteps);
      setDiverged(true);
      setMode('PLAYING');
      // Already at currentStep, but we want to show the next one (partner's reply)
      setCurrentStep(newSteps.length - 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetSimulation = () => {
    if (id) {
       window.location.reload();
    } else {
       setMode('INPUT');
       setSteps([]);
       setCurrentStep(0);
       setDiverged(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0c0c08] flex items-center justify-center p-0 md:p-6 sm:p-10">
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-primary/20 to-transparent" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full" />
      </div>

      {/* Mobile Frame Container */}
      <div className="relative w-full max-w-[430px] h-full sm:h-[85vh] sm:max-h-[900px] bg-[#0c0c08] sm:rounded-[3.5rem] sm:border-[8px] border-white/10 shadow-2xl overflow-hidden flex flex-col z-10 transition-all duration-500">
        
        {/* Notch/Top Sim */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-[#0c0c08] rounded-b-[2rem] z-50 border-x border-b border-white/5 hidden sm:block"></div>

        {/* Top Bar */}
        <div className="relative z-10 pt-12 p-6 flex justify-between items-center border-b border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-display font-bold">마음 리플레이</h1>
              <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Dialogue Simulator</p>
            </div>
          </div>
          
          {mode !== 'INPUT' && (
            <div className="flex items-center gap-2">
              <div className="text-[9px] font-bold bg-white/5 px-2.5 py-1.5 rounded-full border border-white/10 text-white/60">
                {currentStep + 1}/{steps.length}
              </div>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {mode === 'INPUT' ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col px-6 pt-10 pb-20 items-center overflow-y-auto no-scrollbar"
            >
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-6 border border-primary/30">
                 <RotateCcw className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-display font-bold mb-2 text-center">반복되는 대화,<br/>바꿀 수 있을까요?</h2>
              <p className="text-white/40 text-[11px] text-center mb-8 leading-relaxed font-medium">
                갈등 상황의 대화를 입력하고,<br/>
                나의 말이 바뀌었을 때의 결과를 미리 확인해보세요.
              </p>

              <div className="w-full relative">
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="대화 내용을 입력하세요...&#10;나: 왜 늦은거야?&#10;상대: 차가 막혀서 그랬어."
                  className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-6 text-sm font-medium outline-none focus:ring-2 focus:ring-primary min-h-[220px] transition-all placeholder:text-white/10"
                />
              </div>

              <button
                 onClick={parseAndStart}
                 disabled={!rawText.trim()}
                 className="w-full mt-6 py-4 bg-primary text-white rounded-[1.5rem] font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
              >
                리플레이 시작
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="story"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col relative overflow-hidden"
            >
              {/* Analysis Drawer Button (Integrated) */}
              {steps[currentStep]?.analysis && !loading && mode === 'PLAYING' && (
                <div className="absolute top-4 right-4 z-30">
                  <button 
                     onClick={() => setShowAnalysis(!showAnalysis)}
                     className={`p-2 rounded-full transition-all ${showAnalysis ? 'bg-primary text-white shadow-lg' : 'bg-white/10 text-white/50'}`}
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* In-Frame Analysis Overlay */}
              <AnimatePresence>
                {showAnalysis && steps[currentStep]?.analysis && !loading && mode === 'PLAYING' && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="absolute bottom-4 left-4 right-4 space-y-2 z-20 pointer-events-none"
                  >
                    <div className="flex gap-2">
                      <AnalysisSnippet 
                        title="감정" 
                        icon={Heart} 
                        content={steps[currentStep].analysis.emotion} 
                        color="text-red-400"
                      />
                      <AnalysisSnippet 
                        title="의도" 
                        icon={HelpCircle} 
                        content={steps[currentStep].analysis.intent} 
                        color="text-blue-400"
                      />
                    </div>
                    <div className="bg-primary/95 backdrop-blur-xl p-4 rounded-[2rem] shadow-2xl border border-white/10 pointer-events-auto">
                       <p className="text-[11px] leading-relaxed text-white font-medium">
                          <span className="opacity-50 block mb-1 font-bold text-[8px] uppercase tracking-widest">💡 대화 가이드</span>
                          {steps[currentStep].analysis.advice}
                       </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Stage - Mobile Proportioned Content */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 pb-40 overflow-y-auto no-scrollbar">
                <AnimatePresence mode="wait">
                  {mode === 'REWRITING' ? (
                    <motion.div
                      key="rewrite"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="w-full flex-1 flex flex-col justify-center"
                    >
                      <div className="text-center mb-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary/20 text-secondary rounded-full text-[9px] font-bold uppercase tracking-widest mb-3">
                           <Edit3 className="w-3 h-3" />
                           대화 수정
                        </div>
                        <h2 className="text-xl font-display font-bold">다르게 말해본다면?</h2>
                      </div>

                      <div className="relative mb-6">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full bg-white/5 border-2 border-secondary/30 rounded-[2.5rem] p-6 text-lg font-medium outline-none focus:border-secondary transition-all text-center min-h-[180px] placeholder:text-white/10"
                          autoFocus
                          placeholder="더 나은 표현으로 고쳐보세요..."
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={applyRewrite}
                          disabled={loading || !editText.trim()}
                          className="w-full py-4 bg-secondary text-white rounded-[1.5rem] font-bold shadow-lg shadow-secondary/20 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                        >
                          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> 수정된 결과 보기</>}
                        </button>
                        <button 
                          onClick={() => setMode('PLAYING')}
                          className="w-full py-3 rounded-[1.5rem] border border-white/10 font-bold hover:bg-white/5 text-white/50 text-xs"
                        >
                          취소
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={currentStep}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full space-y-8 flex flex-col items-center"
                    >
                      <div className="flex flex-col items-center text-center w-full">
                         <motion.div 
                           initial={{ scale: 0.8 }}
                           animate={{ scale: 1 }}
                           className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold mb-4 ring-2 ring-white/5 ${steps[currentStep]?.role === 'user' ? 'bg-primary text-white' : 'bg-white/10 text-white/40'}`}
                         >
                           {steps[currentStep]?.senderName[0]}
                         </motion.div>
                         <div className="space-y-1">
                           <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
                              {steps[currentStep]?.senderName}
                           </span>
                           <h2 className="text-2xl font-display font-medium leading-normal px-2">
                              {loading ? (
                                <span className="flex gap-1.5 justify-center py-2">
                                  <span className="w-2 h-2 bg-white/20 rounded-full animate-bounce delay-0" />
                                  <span className="w-2 h-2 bg-white/20 rounded-full animate-bounce delay-150" />
                                  <span className="w-2 h-2 bg-white/20 rounded-full animate-bounce delay-300" />
                                </span>
                              ) : (
                                `"${steps[currentStep]?.content}"`
                              )}
                           </h2>
                         </div>

                         {steps[currentStep]?.isModified && (
                           <div className="mt-4 px-3 py-1 bg-white/5 rounded-full text-[9px] font-medium text-white/40 italic">
                              기존: {steps[currentStep]?.originalContent}
                           </div>
                         )}
                      </div>

                      {/* Interaction Area */}
                      {!loading && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="w-full"
                        >
                          {steps[currentStep]?.role === 'user' ? (
                            <div className="flex flex-col items-center gap-3 w-full">
                              <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest mb-1">당신의 선택</p>
                              <div className="flex flex-col gap-2 w-full">
                                <ChoiceButton 
                                  label="수정해서 말하기" 
                                  description="다르게 행동했다면 어땠을까요?"
                                  icon={Edit3}
                                  onClick={startRewrite}
                                  highlight
                                />
                                <ChoiceButton 
                                  label="그대로 말하기" 
                                  description="원래 하려던 말을 이어갑니다"
                                  icon={SkipForward}
                                  onClick={handleNext}
                                  disabled={currentStep === steps.length - 1}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                               <button 
                                 onClick={handleNext}
                                 disabled={currentStep === steps.length - 1}
                                 className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-full font-bold flex items-center gap-2 transition-all group text-sm border border-white/5"
                               >
                                 다음 내용 보기
                                 <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                               </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom Nav Simulation */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full"></div>
              
              <div className="absolute bottom-10 left-6">
                <button 
                  onClick={resetSimulation}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-xl flex items-center gap-2 text-white/30 hover:text-white transition-all font-bold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="text-[10px]">다시</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AnalysisSnippet({ title, icon: Icon, content, color }: any) {
  return (
    <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-3 h-3 ${color}`} />
        <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">{title}</span>
      </div>
      <p className="text-xs font-medium text-white/80">{content}</p>
    </div>
  );
}

function ChoiceButton({ label, description, icon: Icon, onClick, highlight, disabled }: any) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`p-4 rounded-[1.5rem] text-left transition-all border group flex items-center gap-3 ${
        highlight 
        ? 'bg-secondary text-white border-secondary shadow-lg shadow-secondary/20 active:scale-95' 
        : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 disabled:opacity-30'
      }`}
    >
      <div className={`p-2 rounded-xl shrink-0 ${highlight ? 'bg-white/20' : 'bg-white/5 text-secondary'}`}>
         <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="font-bold text-[13px] leading-none mb-1">
          {label}
        </div>
        <div className={`text-[9px] font-medium leading-none ${highlight ? 'text-white/60' : 'text-white/20'}`}>
          {description}
        </div>
      </div>
    </button>
  );
}

function RefreshCw(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
