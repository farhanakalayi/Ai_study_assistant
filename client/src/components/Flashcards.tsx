import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RotateCw, Shuffle, HelpCircle, BookOpen } from 'lucide-react';

interface Flashcard {
  front: string;
  back: string;
}

interface FlashcardsProps {
  flashcards: Flashcard[];
}

export default function Flashcards({ flashcards: initialFlashcards }: FlashcardsProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>(initialFlashcards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewedCount, setViewedCount] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    console.log("Flashcards State Synced with prop:", initialFlashcards);
    setFlashcards(initialFlashcards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setViewedCount(new Set([0]));
  }, [initialFlashcards]);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === 'ArrowRight') {
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, flashcards.length]);

  const handleNext = () => {
    if (flashcards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => {
        const nextIdx = (prev + 1) % flashcards.length;
        setViewedCount((viewed) => {
          const updated = new Set(viewed);
          updated.add(nextIdx);
          return updated;
        });
        return nextIdx;
      });
    }, 150);
  };

  const handlePrev = () => {
    if (flashcards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => {
        const prevIdx = (prev - 1 + flashcards.length) % flashcards.length;
        setViewedCount((viewed) => {
          const updated = new Set(viewed);
          updated.add(prevIdx);
          return updated;
        });
        return prevIdx;
      });
    }, 150);
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    setTimeout(() => {
      const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
      setFlashcards(shuffled);
      setCurrentIndex(0);
      setViewedCount(new Set([0]));
    }, 150);
  };

  if (!flashcards || flashcards.length === 0) return null;

  const currentCard = flashcards[currentIndex];
  const progressPercent = Math.round((viewedCount.size / flashcards.length) * 100);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
      
      {/* Top Bar / Progress */}
      <div className="w-full bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-white/40 dark:border-slate-800/40 rounded-3xl p-4 flex items-center justify-between mb-4 shadow-sm">
        <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
          Card {currentIndex + 1} of {flashcards.length}
        </span>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full">
            {progressPercent}% studied
          </span>
          <button
            onClick={handleShuffle}
            className="flex items-center gap-1.5 text-xs font-bold hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-1.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700"
            title="Shuffle deck"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Shuffle
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden mb-6 p-[2px]">
        <div
          className="bg-gradient-to-r from-purple-500 to-blue-500 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* 3D Flashcard Container */}
      <div
        className="w-full h-[360px] perspective-1000 cursor-pointer group relative"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* Glow behind the card */}
        <div className="absolute -inset-1 rounded-[30px] bg-gradient-to-tr from-purple-600 to-blue-600 opacity-20 blur-lg group-hover:opacity-30 transition-all duration-500" />
        
        <div
          className={`relative w-full h-full duration-700 transform-style-3d transition-transform ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* Front of Card */}
          <div className="absolute inset-0 w-full h-full bg-white/95 dark:bg-slate-900/95 border-2 border-white/80 dark:border-slate-800 rounded-[28px] shadow-lg flex flex-col justify-between p-8 backface-hidden">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold tracking-wider text-purple-600 dark:text-purple-400 uppercase bg-purple-50 dark:bg-purple-950/30 px-3 py-1 rounded-full">
                Question
              </span>
              <HelpCircle className="w-5 h-5 text-slate-450" />
            </div>
            <div className="flex-1 flex items-center justify-center text-center px-4">
              <p className="text-2xl md:text-3xl font-extrabold leading-relaxed text-slate-800 dark:text-white">
                {currentCard.front}
              </p>
            </div>
            <div className="flex justify-center items-center text-xs font-semibold text-slate-500 group-hover:text-blue-600 transition-colors gap-2 bg-slate-50 dark:bg-slate-950/20 py-2.5 rounded-2xl">
              <RotateCw className="w-4 h-4 animate-spin-slow text-blue-500" />
              Click card or press Space to reveal answer
            </div>
          </div>

          {/* Back of Card */}
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-indigo-50/95 to-blue-50/95 dark:from-slate-950/95 dark:to-slate-900/95 border-2 border-indigo-200/50 dark:border-indigo-900/30 rounded-[28px] shadow-lg flex flex-col justify-between p-8 backface-hidden rotate-y-180">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase bg-blue-50 dark:bg-blue-950/30 px-3 py-1 rounded-full">
                Answer
              </span>
              <BookOpen className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1 flex items-center justify-center text-center px-4">
              <p className="text-xl md:text-2xl font-bold leading-relaxed text-slate-850 dark:text-slate-100">
                {currentCard.back}
              </p>
            </div>
            <div className="flex justify-center items-center text-xs font-semibold text-blue-600/80 gap-2 bg-blue-500/10 py-2.5 rounded-2xl">
              Click card to view question again
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex flex-col items-center gap-4 mt-8 w-full">
        <div className="flex items-center gap-6">
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="p-4 rounded-full border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white transition-all active:scale-95 shadow-md hover:shadow-lg"
            aria-label="Previous card"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <span className="text-xs font-bold text-white bg-black/35 px-4 py-2 rounded-full shadow-sm select-none">
            Space to Flip
          </span>

          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="p-4 rounded-full border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-white transition-all active:scale-95 shadow-md hover:shadow-lg"
            aria-label="Next card"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
        
        <span className="text-[11px] font-bold text-white/70">
          Use Left/Right arrow keys on keyboard
        </span>
      </div>
    </div>
  );
}
