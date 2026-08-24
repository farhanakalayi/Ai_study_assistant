import React, { useState, useEffect, useRef } from 'react';
import {
  Brain,
  Sparkles,
  Moon,
  Sun,
  Play,
  History,
  AlertCircle,
  XCircle,
  Clipboard,
  Trash2,
  BookOpen,
  Book,
  Calculator,
  Dna,
  Atom,
  FlaskConical,
  Pencil,
  Send,
  GraduationCap,
  Lightbulb,
  Coffee,
  Ruler,
  Laptop,
  ArrowRight,
  TrendingUp,
  Award,
  BookOpenCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Flashcards from './components/Flashcards';
import Quiz from './components/Quiz';
import Stats from './components/Stats';

interface Flashcard {
  front: string;
  back: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface StudyMaterial {
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
}

interface HistoryItem {
  id: string;
  title: string;
  createdAt: string;
  flashcardsCount: number;
  quizCount: number;
  data: StudyMaterial;
}

const SAMPLE_NOTES = [
  {
    title: "REST APIs",
    text: "REST stands for Representational State Transfer. It is an architectural style for designing networked applications. It relies on a stateless, client-server protocol, almost always HTTP. Key HTTP methods include: GET (retrieve a resource), POST (create a resource), PUT (update/replace a resource), PATCH (partial update), and DELETE (remove a resource). HTTP status codes are critical: 200 OK (success), 201 Created (post success), 400 Bad Request, 401 Unauthorized, 404 Not Found, and 500 Internal Server Error."
  },
  {
    title: "Photosynthesis",
    text: "Photosynthesis is the process used by plants, algae and certain bacteria to harness energy from sunlight and turn it into chemical energy. The general equation is: 6CO2 + 6H2O + Light Energy -> C6H12O6 + 6O2. It takes place in two main stages: the Light-Dependent Reactions (occurs in the thylakoid membranes, converts light energy into ATP and NADPH, releasing oxygen) and the Light-Independent Reactions or Calvin Cycle (occurs in the stroma, uses ATP and NADPH to convert carbon dioxide into glucose)."
  },
  {
    title: "Vocal Registers",
    text: "Vocal registers refer to distinct regions of voice production. The four main registers are: 1. Vocal Fry (the lowest register, characterized by a low, creaky sound caused by loose vocal folds vibrating slowly). 2. Chest Voice (the default speaking register, rich in lower harmonics, utilizing thick vocal folds). 3. Head Voice / Falsetto (the higher register, light and airy, where vocal folds are stretched thin). 4. Whistle Register (the highest register, producing a flute-like sound, where only the front edge of the vocal folds vibrates)."
  }
];

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [material, setMaterial] = useState<StudyMaterial | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'flashcards' | 'quiz' | 'stats'>(() => {
    const state = window.history.state;
    if (state?.tab) return state.tab;
    return 'input';
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingMessage, setLoadingMessage] = useState('Parsing notes...');
  const [isDragOver, setIsDragOver] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Apply Theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Browser history: push a state entry whenever tab changes
  useEffect(() => {
    const currentState = window.history.state;
    if (currentState?.tab !== activeTab) {
      window.history.pushState({ tab: activeTab }, '', window.location.pathname);
    }
  }, [activeTab]);

  // Browser back/forward button: restore the tab from history state
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const tab = e.state?.tab;
      if (tab === 'input' || tab === 'flashcards' || tab === 'quiz' || tab === 'stats') {
        setActiveTab(tab);
      } else {
        setActiveTab('input');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load history from local storage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('study_assistant_history');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error('Failed to load history from localStorage', e);
    }
  }, []);

  // Save history to local storage
  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem('study_assistant_history', JSON.stringify(newHistory));
  };

  // Loading message rotation to feel delightful
  useEffect(() => {
    if (!loading) return;
    const messages = [
      "Analyzing study notes...",
      "Extracting key concepts...",
      "Structuring interactive flashcards...",
      "Drafting multiple-choice questions...",
      "Generating detailed explanations...",
      "Polishing study materials..."
    ];
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setLoadingMessage(messages[index]);
    }, 3000);

    return () => clearInterval(interval);
  }, [loading]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!notes.trim() || notes.trim().length < 10) {
      setError('Please enter at least 10 characters of notes to analyze.');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);
    setMaterial(null);
    setLoadingMessage('Parsing notes...');

    try {
      let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      // Clean up whitespace, leading slashes, and trailing slashes
      API_URL = API_URL.trim().replace(/^\/+/, '').replace(/\/+$/, '');
      
      // Ensure there is a protocol prefix
      if (!API_URL.startsWith('http://') && !API_URL.startsWith('https://')) {
        API_URL = `https://${API_URL}`;
      }

      const response = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
        signal: abortController.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Server failed to generate study assets.');
      }

      const data: StudyMaterial = await response.json();
      console.log("API Response", data);
      console.log("Flashcards", data.flashcards);
      console.log("Quiz", data.quiz);
      console.log("StudyData", data);

      const cleanTitle = notes.trim().split('\n')[0].substring(0, 40) || 'Study Session';

      const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        title: cleanTitle.length > 35 ? cleanTitle.substring(0, 35) + '...' : cleanTitle,
        createdAt: new Date().toISOString(),
        flashcardsCount: data.flashcards.length,
        quizCount: data.quiz.length,
        data
      };

      saveHistory([newItem, ...history]);
      setMaterial(data);
      setActiveTab('flashcards');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request aborted successfully');
        return;
      }
      setError(err.message || 'Something went wrong. Please check your network or try again.');
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setError('Generation cancelled by user.');
    }
  };

  const loadHistoryItem = (id: string) => {
    const item = history.find((h) => h.id === id);
    if (item) {
      setMaterial(item.data);
      setActiveTab('flashcards');
    }
  };

  const deleteHistoryItem = (id: string) => {
    const updated = history.filter((h) => h.id !== id);
    saveHistory(updated);
  };

  const prefillSample = (sampleText: string) => {
    setNotes(sampleText);
    setError(null);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setNotes(text);
      setError(null);
    } catch (err) {
      console.error('Failed to read clipboard', err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setNotes(event.target.result as string);
          setError(null);
        }
      };
      reader.readAsText(file);
    }
  };

  // Calculations for progress card
  const totalSessions = history.length;
  const totalFlashcards = history.reduce((sum, item) => sum + item.flashcardsCount, 0);
  const totalQuizQuestions = history.reduce((sum, item) => sum + item.quizCount, 0);
  const totalItems = totalFlashcards + totalQuizQuestions;
  const progressPercentage = Math.min(100, Math.round((totalSessions / 10) * 100));

  return (
    <div className="relative min-h-screen text-foreground flex flex-col font-sans overflow-x-hidden selection:bg-primary/30 selection:text-foreground">
      
      {/* ──────────────────────────────────────────────
          EDUCATIONAL BACKGROUND DOODLES (5-8% opacity)
          ────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none">
        {/* Row 1 */}
        <BookOpen className="absolute text-white opacity-[0.06] w-20 h-20 top-24 left-[5%] -rotate-12" />
        <Calculator className="absolute text-white opacity-[0.07] w-16 h-16 top-40 left-[40%] rotate-12" />
        <Dna className="absolute text-white opacity-[0.06] w-20 h-20 top-16 left-[78%] rotate-45" />
        <Atom className="absolute text-white opacity-[0.07] w-24 h-24 top-64 left-[20%] animate-[spin_40s_linear_infinite]" />
        
        {/* Row 2 */}
        <FlaskConical className="absolute text-white opacity-[0.06] w-16 h-16 top-[400px] left-[8%] rotate-6" />
        <Pencil className="absolute text-white opacity-[0.07] w-12 h-12 top-[350px] left-[52%] -rotate-45" />
        <Send className="absolute text-white opacity-[0.06] w-16 h-16 top-[450px] left-[85%] -rotate-12" />
        <GraduationCap className="absolute text-white opacity-[0.08] w-20 h-20 top-[600px] left-[33%] rotate-12" />

        {/* Row 3 */}
        <Lightbulb className="absolute text-white opacity-[0.07] w-16 h-16 top-[720px] left-[15%] rotate-12" />
        <Coffee className="absolute text-white opacity-[0.06] w-14 h-14 top-[850px] left-[78%] -rotate-12" />
        <Ruler className="absolute text-white opacity-[0.07] w-20 h-10 top-[900px] left-[45%] rotate-[30deg]" />
        <Laptop className="absolute text-white opacity-[0.06] w-20 h-20 top-[1100px] left-[5%] rotate-6" />
        <Book className="absolute text-white opacity-[0.08] w-16 h-16 top-[1150px] left-[88%] -rotate-12" />

        {/* Math & Physics Text Doodles */}
        <span className="absolute text-white opacity-[0.06] text-xl font-bold top-96 left-[68%] -rotate-12">E = mc²</span>
        <span className="absolute text-white opacity-[0.06] text-2xl font-bold top-[680px] left-[6%] rotate-12">a² + b² = c²</span>
        <span className="absolute text-white opacity-[0.06] text-xl font-bold top-[980px] left-[70%] rotate-6">f(x) = ∫ x dx</span>
        <span className="absolute text-white opacity-[0.06] text-3xl font-extrabold top-[220px] left-[88%] -rotate-[25deg]">Δx · Δp ≥ ℏ/2</span>
      </div>

      {/* ──────────────────────────────────────────────
          TOP NAVBAR
          ────────────────────────────────────────────── */}
      <header className="sticky top-4 z-40 w-full max-w-6xl mx-auto px-4">
        <div className="w-full bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-slate-800/60 rounded-3xl py-3 px-6 flex items-center justify-between shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] transition-all">
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setActiveTab('input')}>
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl text-white shadow-md shadow-blue-500/20">
              <Brain className="w-6 h-6" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-slate-800 dark:text-white flex items-center gap-1">
              MindSync <span className="text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-500 text-white px-2 py-0.5 rounded-lg">AI</span>
            </span>
          </div>

          <nav className="flex items-center space-x-1.5 sm:space-x-3">
            <button
              onClick={() => setActiveTab('input')}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                activeTab === 'input' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-105' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/50 dark:hover:bg-slate-800/40'
              }`}
            >
              Notes
            </button>
            {material && (
              <>
                <button
                  onClick={() => setActiveTab('flashcards')}
                  className={`px-4 py-2 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                    activeTab === 'flashcards' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-105' 
                      : 'text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  Flashcards
                </button>
                <button
                  onClick={() => setActiveTab('quiz')}
                  className={`px-4 py-2 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                    activeTab === 'quiz' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-105' 
                      : 'text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  Quiz
                </button>
              </>
            )}
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold transition-all duration-300 flex items-center gap-1.5 ${
                activeTab === 'stats' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-105' 
                  : 'text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/50 dark:hover:bg-slate-800/40'
              }`}
            >
              Stats
            </button>
            
            <div className="w-[1px] h-6 bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />
            
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-2xl border border-white/50 dark:border-slate-800/60 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/90 dark:hover:bg-slate-800/90 transition-all shadow-sm"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </nav>
        </div>
      </header>

      {/* ──────────────────────────────────────────────
          MAIN WRAPPER
          ────────────────────────────────────────────── */}
      <main className="flex-1 container max-w-6xl mx-auto px-4 py-8 z-10">
        <AnimatePresence mode="wait">
          
          {/* Notes Input Area & Sidebar Layout */}
          {activeTab === 'input' && !loading && (
            <motion.div
              key="input-view"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 100 }}
              className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start"
            >
              
              {/* Left Column (70%) */}
              <div className="lg:col-span-7 space-y-8">
                
                {/* ──────────────────────────────────────────────
                    HERO SECTION (Refined Glassmorphic Hero)
                    ────────────────────────────────────────────── */}
                <div className="relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 p-8 md:p-10 h-auto md:h-[350px] backdrop-blur-[18px] shadow-[0_25px_60px_rgba(0,0,0,0.18)] transition-all duration-300 z-10"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '32px'
                  }}
                >
                  
                  {/* Tiny Floating Education Doodles inside Hero (5-8% opacity) */}
                  <div className="absolute inset-0 pointer-events-none z-0 select-none overflow-hidden">
                    <motion.div animate={{ y: [0, -10, 0], rotate: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }} className="absolute top-6 left-12 text-white opacity-[0.06]"><BookOpen className="w-8 h-8" /></motion.div>
                    <motion.div animate={{ y: [0, 8, 0], rotate: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 9, ease: "easeInOut", delay: 1 }} className="absolute bottom-8 left-1/3 text-white opacity-[0.07]"><Atom className="w-10 h-10" /></motion.div>
                    <motion.div animate={{ y: [0, -12, 0] }} transition={{ repeat: Infinity, duration: 10, ease: "easeInOut", delay: 0.5 }} className="absolute top-8 right-1/4 text-white opacity-[0.06]"><FlaskConical className="w-7 h-7" /></motion.div>
                    <motion.div animate={{ y: [0, 6, 0], rotate: [0, 15, 0] }} transition={{ repeat: Infinity, duration: 11, ease: "easeInOut", delay: 2 }} className="absolute bottom-6 right-10 text-white opacity-[0.08]"><Ruler className="w-9 h-6" /></motion.div>
                    <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 7, ease: "easeInOut", delay: 1.5 }} className="absolute bottom-10 left-10 text-white opacity-[0.07]"><Pencil className="w-6 h-6" /></motion.div>
                    <motion.span animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }} className="absolute top-10 left-1/2 text-white opacity-[0.06] text-xs font-bold">E = mc²</motion.span>
                  </div>

                  {/* Left Side Illustration */}
                  <motion.div 
                    animate={{ y: [0, -12, 0] }}
                    transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                    className="flex items-center justify-center space-x-4 relative md:w-1/3 shrink-0 z-10"
                  >
                    {/* Glow behind illustration */}
                    <div className="absolute w-28 h-28 bg-blue-500/25 blur-2xl rounded-full -z-10" />

                    {/* Sparkles around illustration */}
                    <Sparkles className="absolute text-yellow-300 w-5 h-5 -top-4 left-6 animate-pulse" />
                    
                    {/* Notebook / Flask illustration */}
                    <div className="relative w-36 h-36 flex items-center justify-center">
                      <div className="absolute w-24 h-28 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg transform -rotate-12 translate-x-2 border border-white/20 flex flex-col justify-between p-3 text-white">
                        <div className="h-1 w-10 bg-white/40 rounded-full" />
                        <div className="space-y-1">
                          <div className="h-1 bg-white/70 rounded-full" />
                          <div className="h-1 bg-white/50 rounded-full w-4/5" />
                        </div>
                      </div>
                      <div className="absolute w-24 h-28 bg-gradient-to-br from-blue-500 to-teal-400 rounded-xl shadow-md transform rotate-6 border border-white/20 flex flex-col justify-between p-3 text-white">
                        <div className="flex justify-between">
                          <div className="h-1 w-6 bg-white/50 rounded-full" />
                          <BookOpen className="w-4 h-4 text-white/80" />
                        </div>
                        <div className="space-y-1">
                          <div className="h-1.5 bg-white rounded-full" />
                          <div className="h-1.5 bg-white/80 rounded-full w-5/6" />
                          <div className="h-1.5 bg-white/60 rounded-full w-2/3" />
                        </div>
                      </div>
                      <div className="absolute -bottom-2 -right-2 p-2.5 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/60 transform rotate-12 flex gap-1">
                        <FlaskConical className="w-6 h-6 text-purple-500 animate-bounce" />
                        <Pencil className="w-5 h-5 text-amber-500" />
                      </div>
                    </div>
                  </motion.div>

                  {/* Center/Right Text Info */}
                  <div className="flex-1 text-center md:text-left space-y-4 z-10 flex flex-col justify-center h-full">
                    <div className="flex items-center justify-center md:justify-start gap-1.5">
                      <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                      <h1 className="text-4xl md:text-[44px] font-[900] tracking-[-1px] text-white leading-none flex items-center gap-2"
                        style={{ textShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                      >
                        AI Study Assistant
                      </h1>
                      <Pencil className="w-6 h-6 text-yellow-400 rotate-12 shrink-0 animate-bounce" />
                      <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                    </div>
                    
                    {/* B.B. King Quote */}
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.8 }}
                      className="space-y-1.5 max-w-xl"
                    >
                      <p className="text-white italic text-[24px] md:text-[27px] leading-[1.6] font-medium" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                        "The beautiful thing about learning is that no one can take it away from you."
                      </p>
                      <p className="text-[#5DE4FF] font-bold text-sm tracking-wide">
                        — B.B. King
                      </p>
                    </motion.div>
                  </div>
                </div>

                {/* ──────────────────────────────────────────────
                    NOTES CARD
                    ────────────────────────────────────────────── */}
                <div 
                  className={`bg-white dark:bg-slate-900 border-2 rounded-[24px] p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-300 relative ${
                    isDragOver 
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[1.01]' 
                      : 'border-transparent dark:border-slate-800'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                        <Book className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-slate-800 dark:text-white">Your Study Document</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePaste}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all flex items-center gap-1 shadow-sm active:scale-95"
                      >
                        <Clipboard className="w-3.5 h-3.5" />
                        Paste
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotes('')}
                        className="px-3 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl transition-all flex items-center gap-1 shadow-sm active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="relative rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 p-2 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                    <textarea
                      value={notes}
                      onChange={(e) => {
                        setNotes(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Drag & Drop a .txt file, paste notes, or use one of the Quick Samples below to begin..."
                      className="w-full h-80 px-4 py-3 rounded-xl bg-transparent outline-none border-none resize-none text-base leading-relaxed text-slate-800 dark:text-slate-100 placeholder:text-slate-400/80"
                    />
                    
                    {/* Info Footer inside Textarea */}
                    <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800/50 pt-2 px-2 mt-2">
                      <span className="text-[11px] text-slate-400 font-medium">
                        Drag & Drop supported
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                        notes.length < 10 ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600' : 'bg-green-100 dark:bg-green-900/20 text-green-600'
                      }`}>
                        {notes.length} characters
                      </span>
                    </div>
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-start gap-3"
                    >
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div className="text-sm font-medium leading-relaxed">{error}</div>
                    </motion.div>
                  )}

                  {/* ──────────────────────────────────────────────
                      GENERATE BUTTON (Gradient Purple -> Blue)
                      ────────────────────────────────────────────── */}
                  <button
                    onClick={() => handleGenerate()}
                    className="w-full mt-6 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-[0_10px_25px_rgba(99,102,241,0.35)] hover:shadow-[0_12px_30px_rgba(99,102,241,0.5)] active:scale-[0.99] group overflow-hidden relative"
                  >
                    <Sparkles className="w-5 h-5 animate-pulse text-yellow-300" />
                    <span>Generate Study Material</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>

                {/* ──────────────────────────────────────────────
                    FEATURE CARDS
                    ────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      title: "AI Powered Insights",
                      subtitle: "Powered by Groq's high-speed Llama models.",
                      icon: <Brain className="w-6 h-6 text-white" />,
                      color: "from-blue-500 to-indigo-500"
                    },
                    {
                      title: "Smart Flashcards",
                      subtitle: "Generates intuitive question & answer cards.",
                      icon: <BookOpen className="w-6 h-6 text-white" />,
                      color: "from-purple-500 to-indigo-600"
                    },
                    {
                      title: "Custom Quizzes",
                      subtitle: "Instant interactive multiple-choice quizzes.",
                      icon: <Award className="w-6 h-6 text-white" />,
                      color: "from-amber-500 to-orange-500"
                    },
                    {
                      title: "Analytics & Stats",
                      subtitle: "Track your performance and accuracy.",
                      icon: <TrendingUp className="w-6 h-6 text-white" />,
                      color: "from-emerald-500 to-teal-500"
                    }
                  ].map((feat, idx) => (
                    <motion.div
                      key={idx}
                      whileHover={{ y: -8, scale: 1.01 }}
                      className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[24px] p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-all duration-300"
                    >
                      <div className={`p-3 rounded-2xl bg-gradient-to-tr ${feat.color} shadow-md`}>
                        {feat.icon}
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-800 dark:text-white">{feat.title}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed">{feat.subtitle}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Right Column - Sidebar (30%) */}
              <div className="lg:col-span-3 space-y-6">
                
                {/* Quick Start Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[24px] p-5 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm tracking-wider uppercase text-slate-450 dark:text-slate-455 flex items-center gap-1.5">
                    <Play className="w-4 h-4 text-blue-600" />
                    Quick Samples
                  </h3>
                  <div className="space-y-2">
                    {SAMPLE_NOTES.map((sample, idx) => (
                      <button
                        key={idx}
                        onClick={() => prefillSample(sample.text)}
                        className="w-full text-left p-3.5 border border-slate-100 dark:border-slate-800/80 hover:border-blue-500/50 rounded-2xl text-xs hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-all font-semibold flex justify-between items-center group shadow-sm"
                      >
                        <span className="text-slate-700 dark:text-slate-200">{sample.title}</span>
                        <Sparkles className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Progress Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[24px] p-5 shadow-sm flex flex-col items-center text-center space-y-4">
                  <h3 className="font-bold text-sm tracking-wider uppercase text-slate-455 self-start flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                    Study Progress
                  </h3>
                  
                  {/* Circular Progress SVG */}
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="56"
                        cy="56"
                        r="45"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-slate-100 dark:text-slate-800"
                        fill="transparent"
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r="45"
                        stroke="url(#progressGrad)"
                        strokeWidth="8"
                        className="transition-all duration-1000"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 45}
                        strokeDashoffset={2 * Math.PI * 45 * (1 - progressPercentage / 100)}
                      />
                      <defs>
                        <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#7C3AED" />
                          <stop offset="100%" stopColor="#2563EB" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-xl font-extrabold text-slate-800 dark:text-white">{progressPercentage}%</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Goal</span>
                    </div>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-2 text-center pt-2">
                    <div className="p-2 bg-slate-50 dark:bg-slate-950/20 rounded-xl">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Sessions</span>
                      <span className="text-base font-extrabold text-slate-800 dark:text-white">{totalSessions}</span>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-950/20 rounded-xl">
                      <span className="block text-[10px] text-slate-400 font-bold uppercase">Assets</span>
                      <span className="text-base font-extrabold text-slate-800 dark:text-white">{totalItems}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Sessions */}
                {history.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[24px] p-5 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm tracking-wider uppercase text-slate-455 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-emerald-600" />
                      Recent Sessions
                    </h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {history.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/50 pb-2.5 last:border-0 last:pb-0"
                        >
                          <button
                            onClick={() => loadHistoryItem(item.id)}
                            className="text-left font-bold text-xs truncate max-w-[130px] hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title={item.title}
                          >
                            {item.title}
                          </button>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded-full">
                            {item.flashcardsCount}c / {item.quizCount}q
                          </span>
                        </div>
                      ))}
                      {history.length > 3 && (
                        <button
                          onClick={() => setActiveTab('stats')}
                          className="w-full text-center text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline pt-1.5 flex items-center justify-center gap-1"
                        >
                          View all history ({history.length})
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Loading View */}
          {loading && (
            <motion.div
              key="loading-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto"
            >
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full border-4 border-white/20 border-t-white animate-spin flex items-center justify-center shadow-lg" />
                <Sparkles className="w-7 h-7 text-yellow-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
              </div>
              <h3 className="text-2xl font-extrabold text-white mb-2">Generating Study Tools...</h3>
              <p className="text-white/80 text-sm min-h-10 px-4 py-2 bg-white/10 rounded-2xl backdrop-blur-md">
                {loadingMessage}
              </p>
              
              <button
                onClick={handleCancelRequest}
                className="mt-8 flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-100 hover:bg-red-200 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl transition-all shadow-sm active:scale-95"
              >
                <XCircle className="w-4 h-4" />
                Cancel Generation
              </button>
            </motion.div>
          )}

          {/* Flashcards View */}
          {activeTab === 'flashcards' && material && !loading && (
            <motion.div
              key="flashcards-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold text-xs uppercase tracking-wider">
                  <BookOpen className="w-3.5 h-3.5" /> Flashcards
                </div>
                <h2 className="text-3xl font-extrabold text-white">Study Flashcards</h2>
                <p className="text-white/80 text-sm max-w-md mx-auto">
                  Guess the answer first, then flip to verify. Active recall improves retention!
                </p>
              </div>
              <Flashcards flashcards={material.flashcards} />
            </motion.div>
          )}

          {/* Quiz View */}
          {activeTab === 'quiz' && material && !loading && (
            <motion.div
              key="quiz-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs uppercase tracking-wider">
                  <BookOpenCheck className="w-3.5 h-3.5" /> Quiz Time
                </div>
                <h2 className="text-3xl font-extrabold text-white">Practice Quiz</h2>
                <p className="text-white/80 text-sm max-w-md mx-auto">
                  Instant validation & explanations help you patch knowledge gaps.
                </p>
              </div>
              <Quiz quiz={material.quiz} />
            </motion.div>
          )}

          {/* Stats View */}
          {activeTab === 'stats' && !loading && (
            <motion.div
              key="stats-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-xs uppercase tracking-wider">
                  <TrendingUp className="w-3.5 h-3.5" /> Statistics
                </div>
                <h2 className="text-3xl font-extrabold text-white">Your Analytics Dashboard</h2>
                <p className="text-white/80 text-sm max-w-md mx-auto">
                  Review historical performance and quickly load previous study sessions.
                </p>
              </div>
              <Stats
                history={history}
                onLoadItem={loadHistoryItem}
                onDeleteItem={deleteHistoryItem}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ──────────────────────────────────────────────
          FOOTER
          ────────────────────────────────────────────── */}
      <footer className="w-full mt-auto py-8 bg-white/10 dark:bg-slate-950/20 border-t border-white/20 backdrop-blur-md z-10">
        <div className="container max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-white/70">
          <p>© 2026 MindSync AI Study Assistant. Powered by Groq Node SDK.</p>
          <div className="flex gap-4">
            <span className="cursor-pointer hover:text-white transition-colors" onClick={() => setActiveTab('input')}>New Session</span>
            <span>|</span>
            <span className="cursor-pointer hover:text-white transition-colors" onClick={() => setActiveTab('stats')}>History</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
