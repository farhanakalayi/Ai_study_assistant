import { useState, useEffect } from 'react';
import { Check, X, RotateCcw, ArrowRight, HelpCircle, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface QuizProps {
  quiz: QuizQuestion[];
}

export default function Quiz({ quiz: initialQuiz }: QuizProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuiz);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  
  const [incorrectIndices, setIncorrectIndices] = useState<number[]>([]);
  const [quizFinished, setQuizFinished] = useState(false);

  useEffect(() => {
    console.log("Quiz State Synced with prop:", initialQuiz);
    setQuestions(initialQuiz);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIncorrectIndices([]);
    setQuizFinished(false);
  }, [initialQuiz]);

  const currentQuestion = questions[currentIndex];

  const handleOptionSelect = (option: string) => {
    if (isAnswered) return;
    setSelectedOption(option);
    setIsAnswered(true);

    const isCorrect = option === currentQuestion.correctAnswer;
    if (isCorrect) {
      setScore((s) => s + 1);
    } else {
      const originalIndex = initialQuiz.findIndex(q => q.question === currentQuestion.question);
      if (originalIndex !== -1 && !incorrectIndices.includes(originalIndex)) {
        setIncorrectIndices((prev) => [...prev, originalIndex]);
      }
    }
  };

  const handleNext = () => {
    setSelectedOption(null);
    setIsAnswered(false);
    
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setQuizFinished(true);
    }
  };

  const handleRestartAll = () => {
    setQuestions(initialQuiz);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIncorrectIndices([]);
    setQuizFinished(false);
  };

  const handleRetryIncorrect = () => {
    const failedQuestions = initialQuiz.filter((_, idx) => incorrectIndices.includes(idx));
    setQuestions(failedQuestions);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIncorrectIndices([]);
    setQuizFinished(false);
  };

  if (!questions || questions.length === 0) {
    return (
      <div className="text-center py-8 bg-white/70 dark:bg-slate-900/60 rounded-3xl p-6 border border-white/40 dark:border-slate-800/40">
        <p className="text-slate-600 dark:text-slate-350">No quiz questions generated.</p>
      </div>
    );
  }

  if (quizFinished) {
    const scorePercentage = Math.round((score / questions.length) * 100);
    return (
      <div className="w-full max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[32px] p-8 shadow-xl text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" />
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="flex flex-col items-center"
        >
          <div className="p-4 bg-gradient-to-tr from-yellow-400 to-amber-500 rounded-full text-white mb-6 shadow-md shadow-amber-500/20">
            <Award className="w-12 h-12" />
          </div>
          
          <h3 className="text-3xl font-extrabold text-slate-800 dark:text-white mb-2">Quiz Completed!</h3>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">
            You scored {score} out of {questions.length} questions
          </p>

          {/* Score ring */}
          <div className="relative w-36 h-36 flex items-center justify-center mb-8">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="60"
                stroke="currentColor"
                strokeWidth="10"
                className="text-slate-100 dark:text-slate-800"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r="60"
                stroke="url(#quizResultGrad)"
                strokeWidth="10"
                className="transition-all duration-1000"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 60}
                strokeDashoffset={2 * Math.PI * 60 * (1 - score / questions.length)}
              />
              <defs>
                <linearGradient id="quizResultGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22C55E" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute text-2xl font-black text-slate-800 dark:text-white">{scorePercentage}%</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            <button
              onClick={handleRestartAll}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold rounded-2xl transition-all text-sm active:scale-95 shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Restart Full Quiz
            </button>

            {incorrectIndices.length > 0 && (
              <button
                onClick={handleRetryIncorrect}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all text-sm active:scale-95 shadow-md shadow-blue-500/25"
              >
                <RotateCcw className="w-4 h-4" />
                Retry Incorrect ({incorrectIndices.length})
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* Quiz Progress Header */}
      <div className="w-full flex items-center justify-between mb-2 px-2 text-sm font-bold text-white">
        <span>
          Question {currentIndex + 1} of {questions.length}
        </span>
        <span className="bg-black/35 px-3 py-1 rounded-full text-xs">
          Score: {score}/{questions.length}
        </span>
      </div>

      <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden mb-6 p-[1px]">
        <div
          className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[28px] p-6 md:p-8 shadow-xl">
        <h3 className="text-xl font-extrabold text-slate-800 dark:text-white mb-6 leading-relaxed flex gap-3">
          <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 animate-pulse" />
          <span>{currentQuestion.question}</span>
        </h3>

        {/* Options */}
        <div className="space-y-3">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = selectedOption === option;
            const isCorrect = option === currentQuestion.correctAnswer;
            const isWrong = isSelected && !isCorrect;

            let optionStyle = 'border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-slate-700 dark:text-slate-300 hover:border-blue-500/40 hover:bg-blue-50/30';
            let iconElement = null;

            if (isAnswered) {
              if (isCorrect) {
                optionStyle = 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400';
                iconElement = <Check className="w-5 h-5 text-green-700 dark:text-green-400 shrink-0" />;
              } else if (isWrong) {
                optionStyle = 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-450';
                iconElement = <X className="w-5 h-5 text-red-700 dark:text-red-450 shrink-0" />;
              } else {
                optionStyle = 'border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/10 opacity-40 cursor-not-allowed text-slate-400';
              }
            }

            return (
              <motion.button
                key={idx}
                disabled={isAnswered}
                onClick={() => handleOptionSelect(option)}
                whileHover={!isAnswered ? { scale: 1.01, x: 4 } : {}}
                animate={isWrong ? { x: [0, -10, 10, -10, 10, 0] } : {}}
                transition={isWrong ? { duration: 0.4 } : { duration: 0.2 }}
                className={`w-full text-left p-4 border rounded-2xl flex items-center justify-between font-bold text-sm md:text-base transition-all ${optionStyle}`}
              >
                <span>{option}</span>
                {iconElement}
              </motion.button>
            );
          })}
        </div>

        {/* Explanation Block */}
        <AnimatePresence>
          {isAnswered && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80 overflow-hidden"
            >
              <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 rounded-2xl p-4 mb-4">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1">
                  Explanation & Concept
                </h4>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-350">
                  {currentQuestion.explanation}
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-5 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs rounded-2xl hover:opacity-90 transition-all shadow-md active:scale-95"
                >
                  {currentIndex + 1 === questions.length ? 'Finish Quiz' : 'Next Question'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
