import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User, signOut, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, testConnection } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  User as UserIcon, 
  Brain, 
  LogOut, 
  Plus, 
  ArrowLeft,
  Sparkles,
  Heart,
  AlertCircle,
  History
} from 'lucide-react';

// Internal Components
import Dashboard from './pages/Dashboard';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import LandingPage from './pages/LandingPage';
import ReplayPage from './pages/ReplayPage';
import InsightsPage from './pages/InsightsPage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Ensure user exists in Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            name: user.displayName || 'Anonymous',
            email: user.email,
            traitProfile: {
              attachmentStyle: 'Unknown',
              communicationStyle: 'Evaluating...',
              triggers: [],
              notes: ''
            },
            createdAt: serverTimestamp()
          });
        }
        setUser(user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-base">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-12 h-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg-base text-[#1a1a1a] font-sans selection:bg-primary selection:text-white">
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
          <Route path="/dashboard" element={user ? <Layout user={user}><Dashboard /></Layout> : <Navigate to="/" />} />
          <Route path="/chat/:id" element={user ? <Layout user={user}><ChatPage /></Layout> : <Navigate to="/" />} />
          <Route path="/profile" element={user ? <Layout user={user}><ProfilePage /></Layout> : <Navigate to="/" />} />
          <Route path="/replay" element={user ? <Layout user={user}><ReplayPage /></Layout> : <Navigate to="/" />} />
          <Route path="/replay/:id" element={user ? <Layout user={user}><ReplayPage /></Layout> : <Navigate to="/" />} />
          <Route path="/insights" element={user ? <Layout user={user}><InsightsPage /></Layout> : <Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function Layout({ children, user }: { children: React.ReactNode, user: User }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="flex flex-col h-screen bg-[#fcfcf9]">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24 pt-4 px-4 md:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={window.location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="max-w-md mx-auto w-full min-h-full flex flex-col"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation (Mobile Style) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-[#e5e5d8] px-6 py-4 flex justify-between items-center z-50 max-w-md mx-auto rounded-t-[32px] shadow-2xl shadow-black/5">
        <NavLink to="/dashboard" icon={MessageSquare} label="홈" />
        <NavLink to="/insights" icon={History} label="인사이트" />
        <NavLink to="/profile" icon={Brain} label="성향" />
        <button 
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase truncate">로그아웃</span>
        </button>
      </nav>
    </div>
  );
}

function NavLink({ to, icon: Icon, label }: { to: string, icon: any, label: string }) {
  const isActive = window.location.pathname.startsWith(to);
  return (
    <Link to={to} className={`flex flex-col items-center gap-1 transition-all ${isActive ? 'text-primary scale-110' : 'text-gray-400 hover:text-primary'}`}>
      <div className={`p-1.5 rounded-xl ${isActive ? 'bg-primary/10' : ''}`}>
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </Link>
  );
}
