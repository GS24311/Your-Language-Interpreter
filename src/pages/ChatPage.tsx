import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Conversation, Message, UserProfile } from '../types';
import { analyzeMessage } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Send, 
  User as UserIcon, 
  HelpCircle, 
  Sparkles, 
  AlertTriangle,
  Info,
  CheckCircle2,
  Trash2,
  Heart,
  History,
  Mic,
  MicOff,
  Zap
} from 'lucide-react';

export default function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [role, setRole] = useState<'user' | 'partner'>('user');
  const [analyzing, setAnalyzing] = useState(false);
  const [autoAnalyzing, setAutoAnalyzing] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !auth.currentUser) return;
    
    const fetchData = async () => {
      try {
        const convRef = doc(db, 'users', auth.currentUser!.uid, 'conversations', id);
        const convSnap = await getDoc(convRef);
        if (convSnap.exists()) {
          setConversation({ id: convSnap.id, ...convSnap.data() } as Conversation);
        }

        const userRef = doc(db, 'users', auth.currentUser!.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserProfile(userSnap.data() as UserProfile);
        }

        const q = query(
          collection(db, 'users', auth.currentUser!.uid, 'conversations', id, 'messages'),
          orderBy('order', 'asc')
        );
        const msgSnap = await getDocs(q);
        const msgs = msgSnap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
        
        // Fallback for old messages without order
        if (msgs.length > 0 && msgs[0].order === undefined) {
           const timeQ = query(
             collection(db, 'users', auth.currentUser!.uid, 'conversations', id, 'messages'),
             orderBy('createdAt', 'asc')
           );
           const timeSnap = await getDocs(timeQ);
           setMessages(timeSnap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
        } else {
           setMessages(msgs);
        }

        // Auto-analyze messages without analysis
        const toAnalyze = msgs.filter(m => !m.analysis);
        if (toAnalyze.length > 0) {
          setAutoAnalyzing(true);
          for (let i = 0; i < msgs.length; i++) {
            const msg = msgs[i];
            if (msg.analysis) continue;
            
            try {
              // Get current index list for context
              const history = msgs.slice(0, i).map(m => ({ role: m.role, content: m.content }));
              const analysis = await analyzeMessage(msg.content, msg.role, userSnap.data()?.traitProfile, history);
              await updateDoc(doc(db, 'users', auth.currentUser!.uid, 'conversations', id, 'messages', msg.id), {
                analysis
              });
              setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, analysis } : m));
            } catch (e) {
              console.error('Error auto-analyzing message:', e);
            }
          }
          setAutoAnalyzing(false);
        }
      } catch (err) {
        console.error('Error in ChatPage fetchData:', err);
      }
    };

    fetchData();
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, autoAnalyzing]);

  const handleSend = async () => {
    if (!inputText.trim() || !id || !auth.currentUser) return;
    setAnalyzing(true);
    const textToSend = inputText;
    setInputText('');

    try {
      // 1. Analyze with AI (passing history for context)
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const analysis = await analyzeMessage(textToSend, role, userProfile?.traitProfile, history);

      // 2. Save to Firestore
      const msgData: any = {
        role,
        content: textToSend,
        senderName: role === 'user' ? '나' : '상대방', // Default for now
        order: messages.length,
        createdAt: serverTimestamp(),
        analysis
      };

      const msgRef = await addDoc(collection(db, 'users', auth.currentUser.uid, 'conversations', id, 'messages'), msgData);
      
      // Update last message timestamp
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'conversations', id), {
        lastMessageAt: serverTimestamp()
      });

      setMessages(prev => [...prev, { id: msgRef.id, ...msgData, createdAt: new Date() }]);
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
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
    <div className="flex flex-col h-full max-h-screen bg-white rounded-[40px] shadow-sm border border-[#e5e5d8] overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#e5e5d8] flex items-center justify-between bg-[#fdfdfb]">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-[#f5f5f0] rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-display font-bold text-xl">{conversation?.title || '로딩 중...'}</h2>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">대화 분석</p>
          </div>
        </div>
        <div className="flex bg-[#f5f5f0] p-1 rounded-full border border-[#e5e5d8]">
          <button 
            onClick={() => setRole('user')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${role === 'user' ? 'bg-primary text-white shadow-md' : 'text-gray-500'}`}
          >
            나
          </button>
          <button 
            onClick={() => setRole('partner')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${role === 'partner' ? 'bg-primary text-white shadow-md' : 'text-gray-500'}`}
          >
            상대방
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        {messages.map((msg, i) => (
          <div key={msg.id || i}>
            <MessageBubble msg={msg} />
          </div>
        ))}
        {(analyzing || autoAnalyzing) && (
          <div className="flex justify-start">
            <div className="bg-[#f5f5f0] p-4 rounded-3xl animate-pulse flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary animate-spin" />
              <span className="text-xs font-bold text-primary">
                {autoAnalyzing ? '기존 대화를 분석 중입니다...' : 'AI가 해석 중입니다...'}
              </span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="p-6 bg-[#fdfdfb] border-t border-[#e5e5d8]">
        <div className="relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`${role === 'user' ? '본인' : '상대방'}이 한 말을 입력하세요...`}
            className="w-full bg-[#f5f5f0] border-none rounded-3xl py-4 pl-6 pr-16 focus:ring-2 focus:ring-primary min-h-[80px] resize-none font-medium placeholder:text-gray-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="absolute right-3 bottom-3 flex gap-2">
            <button
              onClick={toggleSpeech}
              className={`p-3 rounded-2xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-500 hover:bg-gray-400'}`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || analyzing}
              className="p-3 bg-primary text-white rounded-2xl hover:bg-[#4a4a35] transition-all disabled:opacity-50 disabled:grayscale"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-gray-400 font-bold text-center uppercase tracking-wider">
          AI가 심리적 맥락을 파악하기 위해 각 메시지를 해석합니다.
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const [showAnalysis, setShowAnalysis] = useState(false);

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%] ${isUser ? 'ml-auto' : 'mr-auto'}`}>
      <div className={`flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-widest ${isUser ? 'text-primary' : 'text-gray-500'}`}>
        <span>{msg.senderName || (isUser ? '나' : '상대방')}</span>
        <div className={`w-1.5 h-1.5 rounded-full ${isUser ? 'bg-primary' : 'bg-gray-300'}`} />
      </div>
      
      <div 
        onClick={() => setShowAnalysis(!showAnalysis)}
        className={`relative p-5 rounded-3xl cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] border-2 shadow-sm ${
          isUser 
            ? 'bg-primary text-white border-primary' 
            : 'bg-white text-[#1a1a1a] border-[#e5e5d8]'
        }`}
      >
        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        
        {msg.analysis && (
          <div className={`absolute -bottom-2 ${isUser ? '-left-2' : '-right-2'} p-1.5 bg-white rounded-full border border-[#e5e5d8] shadow-sm`}>
            <Sparkles className="w-3 h-3 text-primary" />
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAnalysis && msg.analysis && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden w-full mt-4"
          >
            <div className="bg-[#f5f5f0] p-6 rounded-[32px] border border-[#e5e5d8] space-y-4 shadow-inner">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">감정</span>
                  <p className="text-sm font-bold flex items-center gap-2">
                    <Heart className="w-4 h-4 text-red-400" />
                    {msg.analysis.emotion}
                  </p>
                </div>
                <div className="space-y-1 text-right">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">의도</span>
                  <p className="text-sm font-bold flex justify-end items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-400" />
                    {msg.analysis.intent}
                  </p>
                </div>
              </div>

              {/* Matching sketch 'AI 의견' feel */}
              <div className="bg-primary p-5 rounded-[24px] text-white shadow-lg relative overflow-hidden">
                <Sparkles className="absolute -bottom-2 -right-2 w-12 h-12 opacity-10" />
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-white/20 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest">Counsel</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">AI 의견</span>
                </div>
                <p className="text-sm font-medium leading-relaxed">{msg.analysis.advice}</p>
              </div>

              {isUser && msg.analysis.mistakeFilter && (
                <div className="p-5 bg-white rounded-[24px] border border-[#e5e5d8] border-l-4 border-l-secondary">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-secondary" />
                    <span className="text-[10px] font-bold text-secondary uppercase tracking-widest leading-none">필터 분석 결과...</span>
                  </div>
                  <p className="text-sm text-gray-700 font-medium">{msg.analysis.mistakeFilter}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
