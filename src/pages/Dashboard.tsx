import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, limit, deleteDoc, doc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Conversation } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Clock, ChevronRight, Play, User as UserIcon, Sparkles, Mic, MicOff, Trash2, Info, RefreshCw, Zap, Target, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function MissionCard() {
  const [completed, setCompleted] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleComplete = () => {
    if (completed) return;
    setCompleted(true);
    setShowReward(true);
    setTimeout(() => setShowReward(false), 3000);
  };

  return (
    <motion.div 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -5 }}
      className={`bg-white p-7 rounded-[40px] border-2 relative overflow-hidden group transition-all duration-700 ${completed ? 'border-primary shadow-xl shadow-primary/5' : 'border-[#e5e5d8] shadow-sm'}`}
    >
      <AnimatePresence>
        {showReward && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5, y: 10 }}
            animate={{ opacity: 1, scale: 1.2, y: -40 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-1/4 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-3 rounded-full font-bold text-sm shadow-2xl z-20 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            +150 XP 획득!
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] group-hover:rotate-12 transition-all duration-700">
        <Target className="w-40 h-40 text-primary" />
      </div>
      
      <div className="flex justify-between items-center mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 ${completed ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-secondary/10 text-secondary'}`}>
            {completed ? <CheckCircle2 className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
          </div>
          <div>
            <h4 className={`text-sm font-bold transition-colors ${completed ? 'text-primary' : 'text-gray-800'}`}>
              {completed ? '오늘의 퀘스트 완료' : '오늘의 마음 퀘스트'}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${completed ? 'bg-primary' : 'bg-secondary animate-pulse'}`} />
              <span className="text-[9px] font-bold text-gray-400 tracking-wider">DAILY QUEST</span>
            </div>
          </div>
        </div>
        {!completed && (
          <div className="text-right">
            <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-full">+150 pts</span>
          </div>
        )}
      </div>

      <div className="relative z-10 mb-8">
        <p className={`text-base font-display font-bold leading-tight ${completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
          {completed ? '건강한 소통을 위한 미션을 성공했어요!' : '"상대방의 숨은 의도를 한 번 더 물어보는 질문을 던져보세요"'}
        </p>
        {!completed && (
          <p className="text-[11px] text-gray-400 mt-2 font-medium">
             예: "그렇게 말한 데 특별한 이유가 있었어?"
          </p>
        )}
      </div>

      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
           <span>달성 현황</span>
           <span>{completed ? '100%' : '40%'}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
          <motion.div 
            initial={{ width: '40%' }}
            animate={{ width: completed ? '100%' : '40%' }}
            transition={{ duration: 1, ease: "circOut" }}
            className={`h-full rounded-full ${completed ? 'bg-primary' : 'bg-secondary'}`}
          />
        </div>
        
        <button 
          onClick={handleComplete}
          disabled={completed}
          className={`w-full py-4 rounded-[24px] font-bold text-xs transition-all flex items-center justify-center gap-3 ${
            completed 
            ? 'bg-primary/5 text-primary/40 cursor-default' 
            : 'bg-secondary text-white shadow-xl shadow-secondary/20 hover:shadow-secondary/40 active:scale-95'
          }`}
        >
          {completed ? (
             <>보상 획득 완료</>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              미션 수행 대화 시작하기
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [tempMessages, setTempMessages] = useState<{ role: 'user' | 'partner', senderName: string, content: string }[]>([]);
  const [participants, setParticipants] = useState<{ id: string, name: string, role: 'user' | 'partner' }[]>([
    { id: '1', name: '나', role: 'user' },
    { id: '2', name: '상대방', role: 'partner' }
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchConversations = async () => {
      if (!auth.currentUser) return;
      const q = query(
        collection(db, 'users', auth.currentUser.uid, 'conversations'),
        orderBy('lastMessageAt', 'desc'),
        limit(5)
      );
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
      setConversations(list);
      setLoading(false);
    };
    fetchConversations();
  }, []);

  const startNewConversation = async () => {
    if (!auth.currentUser || analyzing) return;
    
    let messagesToSave: { role: 'user' | 'partner', senderName: string, content: string }[] = [];
    
    if (tempMessages.length > 0) {
      messagesToSave = tempMessages;
    } else if (inputText.trim()) {
      // Auto-parse if multi-line transcript is pasted
      const lines = inputText.trim().split('\n').filter(l => l.trim());
      const hasSeparators = lines.some(l => l.includes(':') || l.includes('：'));
      
      if (hasSeparators) {
        messagesToSave = lines.map((line, i) => {
          let role: 'user' | 'partner' = 'user';
          let senderName = '나';
          let content = line;

          const separator = line.includes(':') ? ':' : (line.includes('：') ? '：' : null);
          if (separator) {
            const parts = line.split(separator);
            senderName = parts[0].trim();
            content = parts.slice(1).join(separator).trim();
            
            const lowerName = senderName.toLowerCase();
            if (lowerName === '나' || lowerName === 'me' || lowerName === '본인' || lowerName === '나님' || lowerName === 'a') {
              role = 'user';
              senderName = '나';
            } else {
              role = 'partner';
            }
          } else if (i % 2 !== 0) {
            role = 'partner';
            senderName = '상대방';
          }
          return { role, senderName, content: content || line };
        });
      } else {
        messagesToSave = [{ role: 'user', senderName: '나', content: inputText.trim() }];
      }
    }
    
    if (messagesToSave.length === 0) return;

    setAnalyzing(true);
    const path = `users/${auth.currentUser.uid}/conversations`;

    try {
      const firstContent = messagesToSave[0].content;
      const title = firstContent.length > 30 ? firstContent.substring(0, 30) + '...' : firstContent;
      
      const docRef = await addDoc(collection(db, 'users', auth.currentUser.uid, 'conversations'), {
        userId: auth.currentUser.uid,
        title: title || `새로운 대화 분석 (${new Date().toLocaleDateString()})`,
        status: 'active',
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // Save messages in sequence using count as order
      for (let i = 0; i < messagesToSave.length; i++) {
        const msg = messagesToSave[i];
        await addDoc(collection(db, 'users', auth.currentUser.uid, 'conversations', docRef.id, 'messages'), {
          content: msg.content,
          role: msg.role,
          senderName: msg.senderName,
          order: i,
          createdAt: serverTimestamp()
        });
      }

      setShowOptions(false);
      setTempMessages([]);
      setInputText('');
      navigate(`/chat/${docRef.id}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    // Simulate file reading and analysis process
    setTimeout(() => {
      setIsUploading(false);
      alert('파일 분석이 완료되었습니다. 대화 구성 창에 내용이 추가됩니다.');
      
      // Simulate reading content from file (mock data for now)
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setInputText(text);
          // Auto trigger modal if not open
          if (!showOptions) setShowOptions(true);
        }
      };
      reader.readAsText(file);
    }, 2000);
  };

  const addBubble = (participantId: string) => {
    if (!inputText.trim()) return;
    const participant = participants.find(p => p.id === participantId);
    if (!participant) return;

    setTempMessages(prev => [...prev, {
      role: participant.role,
      senderName: participant.name,
      content: inputText.trim()
    }]);
    setInputText('');
  };

  const removeBubble = (index: number) => {
    setTempMessages(prev => prev.filter((_, i) => i !== index));
  };

  const addParticipant = () => {
    const name = prompt('등장 인물의 이름을 입력해주세요:');
    if (name) {
      setParticipants(prev => [...prev, { 
        id: Math.random().toString(36).substr(2, 9), 
        name, 
        role: 'partner' 
      }]);
    }
  };

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!auth.currentUser || !id) return;
    
    // Temporarily removing confirm to test if it was being blocked
    const path = `users/${auth.currentUser.uid}/conversations/${id}`;
    
    try {
      // Optimistic UI update
      setConversations(prev => prev.filter(c => c.id !== id));
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'conversations', id));
    } catch (error) {
      console.error('Error deleting conversation:', error);
      // Revert optimistic update
      const q = query(
        collection(db, 'users', auth.currentUser.uid, 'conversations'),
        orderBy('lastMessageAt', 'desc'),
        limit(5)
      );
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
      setConversations(list);
      
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const toggleSpeech = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prev => (prev.trim() ? prev + ' ' : '') + transcript);
    };

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white p-6 rounded-[32px] border border-[#e5e5d8] flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4 truncate">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-primary/10 border-2 border-white">
            <UserIcon className="w-7 h-7" />
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">인증됨</p>
            <h2 className="text-xl font-display font-bold truncate">환영합니다, {auth.currentUser?.displayName?.split(' ')[0].toLowerCase() || '사용자'}님!</h2>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">LEVEL</p>
          <div className="text-2xl font-display font-bold text-primary">12</div>
        </div>
      </div>

      {/* Experience Improvement: Growth & Mission Section */}
      <div className="grid grid-cols-1 gap-4">
        {/* Daily Mission Card */}
        <MissionCard />
      </div>

      {/* Main Interaction Area (The "User" box in sketch) */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {!showOptions ? (
            <motion.button
              key="main-button"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => setShowOptions(true)}
              className="w-full bg-primary p-10 rounded-[48px] shadow-xl shadow-primary/20 text-white flex flex-col items-center justify-center gap-4 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <Sparkles className="w-32 h-32" />
              </div>
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                 <Plus className="w-10 h-10" />
              </div>
              <div className="text-center relative z-10">
                <h3 className="text-2xl font-display font-bold">새로운 대화 분석</h3>
                <p className="text-white/60 text-sm font-medium">갈등을 해결하고 마음을 이해해보세요</p>
              </div>
            </motion.button>
          ) : (
            <motion.div
              key="options"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white max-w-2xl w-full mx-auto rounded-[48px] border-2 border-primary shadow-2xl overflow-hidden flex flex-col"
              style={{ maxHeight: '85vh' }}
            >
              {/* Header */}
              <div className="bg-primary p-6 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                   <MessageSquare className="w-6 h-6" />
                   <h3 className="text-xl font-display font-bold">대화 구성하기</h3>
                </div>
                <button 
                  onClick={() => { setShowOptions(false); setTempMessages([]); setInputText(''); }} 
                  className="bg-white/20 hover:bg-white/30 p-2 rounded-full backdrop-blur-sm transition-colors"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              {/* Message List - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#fdfdfb]">
                {tempMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-4 py-20 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-bold uppercase tracking-widest leading-relaxed">
                      대화 내용을 입력하고<br/>
                      버튼을 눌러 말풍선을 만드세요
                    </p>
                  </div>
                ) : (
                  tempMessages.map((msg, idx) => (
                    <motion.div 
                      key={`${idx}-${msg.content.substring(0, 10)}`}
                      initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-end gap-2 max-w-[85%] group font-medium">
                        {msg.role !== 'user' && (
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-400 border border-gray-200 shrink-0">
                            {msg.senderName[0]}
                          </div>
                        )}
                        <div className={`p-4 rounded-3xl text-sm relative ${
                          msg.role === 'user' 
                          ? 'bg-primary text-white rounded-tr-none shadow-lg shadow-primary/10' 
                          : 'bg-white border border-[#e5e5d8] text-gray-800 rounded-tl-none shadow-sm'
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <button 
                            onClick={() => removeBubble(idx)}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest px-2">
                        {msg.senderName}
                      </span>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Input Area - Fixed at bottom */}
              <div className="p-6 bg-white border-t border-gray-100 flex flex-col gap-4 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
                <div className="relative">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="내용을 입력하세요..."
                    className="w-full bg-[#f5f5f0] border border-[#e5e5d8] rounded-[32px] p-5 pr-12 text-sm font-medium focus:ring-2 focus:ring-primary outline-none min-h-[80px] max-h-[150px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (inputText.trim()) addBubble(participants[0].id);
                      }
                    }}
                  />
                  <div className="absolute bottom-4 right-4 flex gap-2">
                    <button 
                      onClick={toggleSpeech}
                      className={`p-2 rounded-full transition-all ${isListening ? "bg-red-500 text-white" : "text-gray-400 hover:text-primary"}`}
                    >
                      {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-2">누가 말했나요?</div>
                    <div className="flex flex-wrap gap-2 flex-1">
                      {participants.map(p => (
                        <button
                          key={p.id}
                          onClick={() => addBubble(p.id)}
                          disabled={!inputText.trim()}
                          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all active:scale-95 shadow-sm disabled:opacity-30 ${
                            p.role === 'user' ? 'bg-primary text-white hover:bg-primary-dark' : 'bg-white border border-[#e5e5d8] text-gray-600 hover:border-primary hover:text-primary'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                      <button 
                        onClick={addParticipant}
                        className="p-2.5 bg-gray-50 border border-dashed border-gray-300 rounded-2xl text-gray-400 hover:text-primary hover:border-primary transition-all"
                        title="인물 추가"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <input 
                        type="file" 
                        id="file-upload-modal" 
                        className="hidden" 
                        accept=".txt,.csv"
                        onChange={handleFileUpload}
                      />
                      <label 
                        htmlFor="file-upload-modal"
                        className={`w-full py-4 rounded-[24px] border-2 border-dashed border-[#e5e5d8] text-gray-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2 cursor-pointer ${isUploading ? 'opacity-50 animate-pulse' : ''}`}
                      >
                        {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        <span className="text-[10px] font-bold uppercase tracking-widest">파일 분석</span>
                      </label>
                    </div>
                    <button 
                      onClick={startNewConversation}
                      disabled={(tempMessages.length === 0 && !inputText.trim()) || analyzing}
                      className="bg-secondary text-white py-4 rounded-[24px] font-bold shadow-lg shadow-secondary/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {analyzing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">분석 시작</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Recent History (The "AI Analysis" list idea) */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">최근 대화 목록</h4>
          <Link to="/dashboard" className="text-[10px] font-bold uppercase tracking-widest text-secondary hover:underline">전체 보기</Link>
        </div>
        
        <div className="space-y-3">
          {conversations.map((conv) => (
            <div key={conv.id} className="flex gap-2">
              <Link
                to={`/chat/${conv.id}`}
                className="flex-1 flex items-center justify-between bg-white p-5 rounded-[28px] border border-[#e5e5d8] hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-accent group-hover:bg-primary group-hover:text-white rounded-xl transition-colors">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-sm">{conv.title}</h5>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                      {conv.lastMessageAt?.toDate().toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary transition-colors" />
              </Link>
              <button
                onClick={() => navigate(`/replay/${conv.id}`)}
                className="p-5 bg-white border border-[#e5e5d8] rounded-[28px] text-gray-400 hover:text-primary hover:border-primary transition-all shadow-sm"
                title="시뮬레이션"
              >
                <Play className="w-5 h-5 fill-current" />
              </button>
              <button
                onClick={(e) => deleteConversation(e, conv.id)}
                className="p-5 bg-white border border-[#e5e5d8] rounded-[28px] text-gray-400 hover:text-red-500 hover:border-red-500 transition-all shadow-sm"
                title="삭제"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OptionButton({ icon: Icon, label, onClick, color, active }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-3 p-6 rounded-3xl transition-all hover:scale-105 active:scale-95 ${color} ${active ? 'ring-4 ring-red-200' : 'shadow-lg shadow-black/5'}`}
    >
      <div className="p-3 bg-white/10 rounded-2xl">
        <Icon className="w-8 h-8" />
      </div>
      <span className="text-xs font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}
