import React, { useState, useEffect, useRef } from 'react';
import { RoundEditor } from './components/RoundEditor';
import { Round, Phase, TimerStatus, SavedWorkout } from './types';
import * as audio from './utils/audio';

const PREPARE_TIME = 5; // seconds

const DEFAULT_ROUNDS: Round[] = [
  { 
    id: '1', 
    exerciseName: 'Раунд 1', 
    workDuration: 10, 
    restDuration: 10, 
    ttsEnabled: false,
    instructions: []
  },
  { 
    id: '2', 
    exerciseName: 'Раунд 2', 
    workDuration: 10, 
    restDuration: 10, 
    ttsEnabled: false,
    instructions: []
  },
  { 
    id: '3', 
    exerciseName: 'Раунд 3', 
    workDuration: 10, 
    restDuration: 10, 
    ttsEnabled: false,
    instructions: []
  },
];

export default function App() {
  const [rounds, setRounds] = useState<Round[]>(DEFAULT_ROUNDS);
  // Cycle State
  const [cycles, setCycles] = useState(1);
  const [currentCycle, setCurrentCycle] = useState(0); // 0-indexed for logic

  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(PREPARE_TIME);
  const [phase, setPhase] = useState<Phase>(Phase.PREPARE);
  const [status, setStatus] = useState<TimerStatus>(TimerStatus.IDLE);
  const [isEditable, setIsEditable] = useState(true);

  // Archive & Save State
  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>(() => {
    try {
      const stored = localStorage.getItem('judo_timer_workouts');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      // MIGRATION: Ensure every workout has an ID to fix delete issues with old data
      return Array.isArray(parsed) ? parsed.map((w: any) => ({
        ...w,
        id: w.id || Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
        cycles: w.cycles || 1
      })) : [];
    } catch (e) {
      console.error("Failed to load workouts", e);
      return [];
    }
  });
  
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [workoutName, setWorkoutName] = useState('');

  // Timer reference
  const timerRef = useRef<number | null>(null);

  const activeRound = rounds[currentRoundIndex];
  const nextRound = rounds[currentRoundIndex + 1];

  // Save changes to local storage whenever savedWorkouts changes
  useEffect(() => {
    localStorage.setItem('judo_timer_workouts', JSON.stringify(savedWorkouts));
  }, [savedWorkouts]);

  // Helper to safely play audio
  const playPhaseAudio = (currentPhase: Phase, round: Round) => {
    if (currentPhase === Phase.WORK) {
      if (round.customAudio) {
        // Priority 1: Recorded Voice
        audio.playAudioFromBase64(round.customAudio);
      } else if (round.ttsEnabled === true && round.exerciseName && round.exerciseName.trim()) {
        // Priority 2: Text-to-Speech (Only if EXPLICITLY enabled)
        audio.speakText(round.exerciseName);
      } else {
        // Priority 3: Default Beep (Default behavior)
        audio.playStartBeep();
      }
    } else if (currentPhase === Phase.REST) {
      audio.playRestBeep();
    } else if (currentPhase === Phase.COMPLETE) {
      audio.playRestBeep();
      setTimeout(audio.playRestBeep, 300);
      setTimeout(audio.playRestBeep, 600);
    }
  };

  const tick = () => {
    setTimeLeft((prev) => {
      const next = prev - 0.1;

      // --- Countdown Beeps (3, 2, 1) ---
      const currentCeil = Math.ceil(prev);
      const nextCeil = Math.ceil(next);
      
      if (nextCeil < currentCeil && nextCeil <= 3 && nextCeil > 0) {
         audio.playBeep(600, 'sine', 0.15);
      }

      if (prev <= 0.1) {
        // Phase transition logic
        if (phase === Phase.PREPARE) {
          setPhase(Phase.WORK);
          playPhaseAudio(Phase.WORK, rounds[currentRoundIndex]);
          return rounds[currentRoundIndex].workDuration;
        } 
        else if (phase === Phase.WORK) {
          const round = rounds[currentRoundIndex];
          if (round.restDuration > 0) {
            setPhase(Phase.REST);
            playPhaseAudio(Phase.REST, round);
            return round.restDuration;
          } else {
            // No rest, go directly to next round or finish
            if (currentRoundIndex < rounds.length - 1) {
              setCurrentRoundIndex(idx => idx + 1);
              setPhase(Phase.WORK);
              // We need to play audio for the NEW round
              playPhaseAudio(Phase.WORK, rounds[currentRoundIndex + 1]);
              return rounds[currentRoundIndex + 1].workDuration;
            } else {
              // END OF ROUNDS LIST
              if (currentCycle < cycles - 1) {
                 // START NEXT CYCLE
                 setCurrentCycle(c => c + 1);
                 setCurrentRoundIndex(0);
                 setPhase(Phase.PREPARE); // 5s prep for new cycle
                 audio.playBeep(600, 'sine', 0.2); // Cycle transition beep
                 return PREPARE_TIME;
              } else {
                 // FINISH WORKOUT
                 setPhase(Phase.COMPLETE);
                 setStatus(TimerStatus.IDLE);
                 playPhaseAudio(Phase.COMPLETE, round);
                 return 0;
              }
            }
          }
        } 
        else if (phase === Phase.REST) {
          if (currentRoundIndex < rounds.length - 1) {
            setCurrentRoundIndex(idx => idx + 1);
            setPhase(Phase.WORK);
            playPhaseAudio(Phase.WORK, rounds[currentRoundIndex + 1]);
            return rounds[currentRoundIndex + 1].workDuration;
          } else {
             // END OF ROUNDS LIST (AFTER LAST REST)
              if (currentCycle < cycles - 1) {
                 // START NEXT CYCLE
                 setCurrentCycle(c => c + 1);
                 setCurrentRoundIndex(0);
                 setPhase(Phase.PREPARE);
                 audio.playBeep(600, 'sine', 0.2);
                 return PREPARE_TIME;
              } else {
                 // FINISH WORKOUT
                 setPhase(Phase.COMPLETE);
                 setStatus(TimerStatus.IDLE);
                 playPhaseAudio(Phase.COMPLETE, rounds[currentRoundIndex]);
                 return 0;
              }
          }
        }
        return 0;
      }
      return next;
    });
  };

  useEffect(() => {
    if (status === TimerStatus.RUNNING) {
      timerRef.current = window.setInterval(tick, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, phase, currentRoundIndex, rounds, cycles, currentCycle]);

  const updateRound = (id: string, field: keyof Round, value: any) => {
    setRounds(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeRound = (id: string) => {
    if (rounds.length > 1) {
      setRounds(prev => prev.filter(r => r.id !== id));
    }
  };

  const addRound = () => {
    setRounds(prev => {
      const nextNum = prev.length + 1;
      const newRound: Round = {
        id: Math.random().toString(36).substr(2, 9),
        exerciseName: `Раунд ${nextNum}`,
        workDuration: 10,
        restDuration: 10,
        ttsEnabled: false // Default to disabled (BEEP ONLY)
      };
      return [...prev, newRound];
    });
  };

  const toggleTimer = () => {
    if (status === TimerStatus.IDLE) {
      // Start fresh
      setPhase(Phase.PREPARE);
      setCurrentRoundIndex(0);
      setCurrentCycle(0); // Reset cycles
      setTimeLeft(PREPARE_TIME);
      setStatus(TimerStatus.RUNNING);
      setIsEditable(false);
      audio.playBeep(600, 'sine', 0.1); 
    } else if (status === TimerStatus.RUNNING) {
      setStatus(TimerStatus.PAUSED);
    } else if (status === TimerStatus.PAUSED) {
      setStatus(TimerStatus.RUNNING);
    }
  };

  const resetTimer = () => {
    setStatus(TimerStatus.IDLE);
    setPhase(Phase.PREPARE);
    setCurrentRoundIndex(0);
    setCurrentCycle(0);
    setTimeLeft(PREPARE_TIME);
    setIsEditable(true);
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Сбросить все настройки к стандартным?')) {
      const defaults = DEFAULT_ROUNDS.map(r => ({...r, id: Math.random().toString(36).substr(2, 9)}));
      setRounds(defaults);
      setCycles(1);
      resetTimer();
    }
  };

  const formatTime = (seconds: number) => {
    const s = Math.ceil(seconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleSaveWorkout = () => {
    if (!workoutName.trim()) return;
    const newWorkout: SavedWorkout = {
      id: Date.now().toString(),
      name: workoutName,
      date: Date.now(),
      rounds: rounds,
      cycles: cycles
    };
    setSavedWorkouts(prev => [newWorkout, ...prev]);
    setIsSaveOpen(false);
    setWorkoutName('');
  };

  const handleLoadWorkout = (workout: SavedWorkout) => {
    if (window.confirm(`Загрузить тренировку "${workout.name}"? Текущая будет заменена.`)) {
      setRounds(workout.rounds);
      setCycles(workout.cycles || 1);
      setIsArchiveOpen(false);
      resetTimer();
    }
  };

  const handleDeleteWorkout = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSavedWorkouts(prev => prev.filter(w => w.id !== id));
  };

  // Helper to calculate progress percentage for the bar
  const getTotalDuration = () => {
    if (status === TimerStatus.IDLE) return 1;
    switch (phase) {
      case Phase.PREPARE: return PREPARE_TIME;
      case Phase.WORK: return activeRound?.workDuration || 1;
      case Phase.REST: return activeRound?.restDuration || 1;
      default: return 1;
    }
  };

  const totalDuration = getTotalDuration();
  const progressPercent = Math.min(100, Math.max(0, ((totalDuration - timeLeft) / totalDuration) * 100));

  const getPhaseColor = () => {
    switch (phase) {
      case Phase.PREPARE: return 'text-yellow-400';
      case Phase.WORK: return 'text-[#ff3d00]';
      case Phase.REST: return 'text-[#d4ff00]';
      case Phase.COMPLETE: return 'text-green-500';
      default: return 'text-white';
    }
  };

  const getPhaseBg = () => {
     switch (phase) {
      case Phase.PREPARE: return 'bg-yellow-400';
      case Phase.WORK: return 'bg-[#ff3d00]';
      case Phase.REST: return 'bg-[#d4ff00]';
      case Phase.COMPLETE: return 'bg-green-500';
      default: return 'bg-white';
    }
  };

  // Modern gradients for the fill animation
  const getGradientClass = () => {
    switch(phase) {
        case Phase.PREPARE: return 'bg-gradient-to-r from-yellow-600 to-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]';
        case Phase.WORK: return 'bg-gradient-to-r from-orange-700 via-[#ff3d00] to-orange-500 shadow-[0_0_25px_rgba(255,61,0,0.5)]';
        case Phase.REST: return 'bg-gradient-to-r from-lime-700 via-[#d4ff00] to-lime-500 shadow-[0_0_20px_rgba(212,255,0,0.4)]';
        case Phase.COMPLETE: return 'bg-green-500';
        default: return 'bg-gray-800';
    }
  };

  // --- LOGIC FOR NEXT EXERCISES PREVIEW ---
  const getNextExercisesString = () => {
      const upcoming = [];
      // Look ahead up to 3 rounds
      for (let i = 1; i <= 3; i++) {
          const nextIdx = currentRoundIndex + i;
          
          if (nextIdx < rounds.length) {
              upcoming.push(rounds[nextIdx].exerciseName);
          } else if (currentCycle < cycles - 1) {
              // Wrap around logic if cycles exist
              const wrapIdx = nextIdx - rounds.length;
              if (wrapIdx < rounds.length) upcoming.push(rounds[wrapIdx].exerciseName);
          }
      }
      return upcoming.join(' • ');
  };

  const nextExercisesPreview = getNextExercisesString();


  return (
    <div className="min-h-screen bg-black flex flex-col max-w-lg mx-auto border-x border-white/5 relative overflow-hidden">
      
      {/* 
        CONDITIONAL LAYOUT SWITCH 
        If Running/Paused: Show "Focus Mode" (Full screen timer + animations)
        If Idle: Show "Edit Mode" (Header + List)
      */}
      
      {status === TimerStatus.IDLE ? (
        // --- EDIT MODE (IDLE) ---
        <>
          {/* HEADER */}
          <div className="sticky top-0 bg-black/95 backdrop-blur-md z-[150] border-b border-white/10 p-4 pb-4">
            
            <div className="flex justify-between items-center mb-3">
                 <div className="flex items-center gap-2">
                     <div className="text-xs font-bold text-white/50 tracking-[0.2em] uppercase">
                       {cycles > 1 ? `ЦИКЛЫ: ${cycles}` : 'НАСТРОЙКА'}
                     </div>
                 </div>

                 {/* Archive & Save Buttons */}
                 <div className="flex gap-2">
                     <button 
                        onClick={handleResetToDefaults}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95"
                        title="Сброс к начальным настройкам"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                      </button>
                     <button 
                       onClick={() => setIsArchiveOpen(true)}
                       className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95"
                       title="Архив тренировок"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                     </button>
                     <button 
                       onClick={() => setIsSaveOpen(true)}
                       className="w-8 h-8 rounded-full bg-white/5 hover:bg-[#ff3d00] flex items-center justify-center text-white/70 hover:text-black transition-all active:scale-95"
                       title="Сохранить тренировку"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                     </button>
                 </div>
            </div>

            {/* RESTORED Main Display Row (Timer + Gradient Block) */}
            <div className="flex items-stretch gap-3 h-24 sm:h-28">
              {/* Big Timer */}
              <div className={`flex items-center text-6xl sm:text-7xl font-black font-mono leading-none tracking-tighter tabular-nums ${getPhaseColor()}`}>
                 {formatTime(timeLeft)}
              </div>

              {/* Animated Exercise Block */}
              <div className="flex-1 relative rounded-xl overflow-hidden bg-[#1c1c1e] border border-white/10 shadow-inner group">
                  <div 
                      className={`absolute inset-0 h-full transition-all duration-100 ease-linear ${getGradientClass()}`}
                      style={{ width: `${status === TimerStatus.IDLE ? '100' : progressPercent}%` }}
                  />
                  <div className="absolute inset-0 z-10 p-3 flex flex-col justify-center items-center text-center">
                      <span className="text-2xl sm:text-3xl font-black uppercase leading-none text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] break-words line-clamp-2 mix-blend-normal">
                          {phase === Phase.COMPLETE ? "ОТЛИЧНАЯ РАБОТА!" : 
                           phase === Phase.REST ? "ОТДЫХ" : 
                           (activeRound?.exerciseName || "...")}
                      </span>
                      {status === TimerStatus.IDLE && (
                          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/80 mt-1.5 drop-shadow-md truncate">
                              ГОТОВ К СТАРТУ
                          </span>
                      )}
                  </div>
              </div>
            </div>
          </div>

          {/* BODY: List of Rounds */}
          <div className="flex-1 p-4 overflow-y-auto">
            <RoundEditor 
              rounds={rounds}
              cycles={cycles}
              onUpdateCycles={setCycles}
              onUpdateRound={updateRound}
              onRemoveRound={removeRound}
              onAddRound={addRound}
              activeRoundId={null}
              isEditable={isEditable}
              currentPhase={phase}
              timerStatus={status}
            />
          </div>
        </>
      ) : (
        // --- FOCUS MODE (RUNNING/PAUSED) ---
        <div className="flex-1 flex flex-col relative h-full">
           {/* Top Info Bar */}
           <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
               <div className="text-xs font-bold text-white/50 tracking-[0.2em] uppercase">
                  {cycles > 1 ? `C${currentCycle + 1}/${cycles} • ` : ''} 
                  {phase === Phase.COMPLETE ? 'FINISH' : `R${currentRoundIndex + 1}/${rounds.length}`}
               </div>
               <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase text-black ${getPhaseBg()}`}>
                  {phase === Phase.PREPARE ? 'READY' : phase === Phase.WORK ? 'WORK' : phase === Phase.REST ? 'REST' : 'DONE'}
               </div>
           </div>

           {/* Main Content Area: Centered */}
           <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-4 w-full">
              
              {/* Giant Timer */}
              <div className={`text-[25vw] sm:text-[10rem] font-black leading-none tracking-tighter tabular-nums transition-colors duration-300 ${getPhaseColor()} drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]`}>
                 {formatTime(timeLeft)}
              </div>

              {/* Animated Exercise Name Block (Gradient Filled) */}
              {phase !== Phase.COMPLETE && (
                <div className="w-full max-w-md relative rounded-2xl overflow-hidden bg-[#1c1c1e] border border-white/10 shadow-2xl h-32 sm:h-40 flex items-center justify-center group mt-4">
                    {/* Fill Layer */}
                    <div 
                        className={`absolute inset-0 h-full transition-all duration-100 ease-linear ${getGradientClass()}`}
                        style={{ width: `${progressPercent}%` }}
                    />
                    
                    {/* Text Layer */}
                    <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
                       <span className="text-3xl sm:text-5xl font-black uppercase text-center leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                           {phase === Phase.REST ? 'ОТДЫХ' : (activeRound?.exerciseName || "Раунд")}
                       </span>
                    </div>
                </div>
              )}

              {/* NEXT EXERCISES PREVIEW (New Block) */}
              {status === TimerStatus.RUNNING && phase !== Phase.COMPLETE && nextExercisesPreview && (
                  <div className="w-full max-w-md relative rounded-xl overflow-hidden bg-[#1c1c1e] border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] h-12 flex items-center justify-center animate-step-enter">
                      {/* Soft Blue/Purple Glow Background */}
                      <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-blue-600 to-purple-600 animate-pulse"></div>
                      
                      {/* Content */}
                      <div className="relative z-10 flex items-center gap-2 px-4 truncate max-w-full">
                          <span className="text-[10px] uppercase font-bold text-blue-400 tracking-widest opacity-80">Next:</span>
                          <span 
                            className="text-blue-100 font-bold uppercase tracking-wide truncate"
                            style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.2rem)' }}
                          >
                             {nextExercisesPreview}
                          </span>
                      </div>
                  </div>
              )}
              
              {phase === Phase.PREPARE && (
                 <div className="text-white/50 text-sm uppercase tracking-widest animate-pulse mt-4">Приготовиться</div>
              )}
              
              {phase === Phase.COMPLETE && (
                 <div className="text-green-500 text-2xl font-black uppercase tracking-widest animate-bounce mt-4">Тренировка окончена!</div>
              )}

           </div>
        </div>
      )}

      {/* FOOTER: Controls */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 bg-gradient-to-t from-black via-black to-transparent z-[150]">
        <div className="flex gap-3 h-14">
          {status === TimerStatus.IDLE ? (
             <button 
               onClick={toggleTimer}
               className="flex-1 bg-[#ff3d00] text-black font-black uppercase tracking-widest text-lg rounded-xl hover:bg-[#ff5e2b] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,61,0,0.3)]"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
               СТАРТ
             </button>
          ) : (
            <>
               <button 
                  onClick={resetTimer}
                  className="w-14 bg-[#222] text-white rounded-xl flex items-center justify-center hover:bg-[#333] transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
               </button>
               
               <button 
                 onClick={toggleTimer}
                 className={`flex-1 font-black uppercase tracking-widest text-lg rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]
                   ${status === TimerStatus.RUNNING 
                      ? 'bg-[#d4ff00] text-black hover:bg-[#e0ff4d] shadow-[0_0_20px_rgba(212,255,0,0.3)]' 
                      : 'bg-[#ff3d00] text-black hover:bg-[#ff5e2b] shadow-[0_0_20px_rgba(255,61,0,0.3)]'
                   }`}
               >
                 {status === TimerStatus.RUNNING ? (
                   <>
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                     ПАУЗА
                   </>
                 ) : (
                   <>
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                     TiME!
                   </>
                 )}
               </button>
            </>
          )}
        </div>
      </div>

      {/* --- MODALS & OVERLAYS --- */}

      {/* SAVE MODAL (Center Glass) */}
      {isSaveOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSaveOpen(false)}></div>
          <div className="relative w-full max-w-sm bg-[#1c1c1e] border border-white/10 p-6 rounded-2xl shadow-2xl flex flex-col gap-4">
            <h3 className="text-xl font-black uppercase tracking-wide text-white">Сохранить тренировку</h3>
            <input 
              type="text" 
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              placeholder="Название (напр. День борьбы)"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#ff3d00] transition-colors"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button 
                onClick={() => setIsSaveOpen(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors uppercase text-sm tracking-wider"
              >
                Отмена
              </button>
              <button 
                onClick={handleSaveWorkout}
                disabled={!workoutName.trim()}
                className="flex-1 py-3 bg-[#ff3d00] hover:bg-[#ff5e2b] text-black font-black rounded-xl transition-colors uppercase text-sm tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVE DRAWER (Bottom Sheet) */}
      <div className={`fixed inset-0 z-[300] transition-visibility duration-300 ${isArchiveOpen ? 'visible' : 'invisible'}`}>
        {/* Backdrop */}
        <div 
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isArchiveOpen ? 'opacity-100' : 'opacity-0'}`} 
          onClick={() => setIsArchiveOpen(false)}
        />
        
        {/* Sheet */}
        <div className={`absolute bottom-0 left-0 right-0 max-w-lg mx-auto bg-[#111] border-t border-white/10 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] h-[80vh] flex flex-col transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1) ${isArchiveOpen ? 'translate-y-0' : 'translate-y-full'}`}>
          
          {/* Handle */}
          <div className="w-full flex justify-center pt-3 pb-1" onClick={() => setIsArchiveOpen(false)}>
             <div className="w-12 h-1.5 bg-white/20 rounded-full"></div>
          </div>

          <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
             <h2 className="text-2xl font-black uppercase tracking-wide text-white">Архив</h2>
             <button onClick={() => setIsArchiveOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/50 hover:bg-white/20">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {savedWorkouts.length === 0 ? (
               <div className="text-center text-white/30 py-10">
                 <p className="mb-2 text-4xl opacity-20">📂</p>
                 <p className="uppercase text-sm font-bold tracking-widest">Нет сохраненных тренировок</p>
               </div>
             ) : (
               savedWorkouts.map(w => (
                 <div key={w.id} onClick={() => handleLoadWorkout(w)} className="bg-[#1c1c1e] p-4 rounded-xl border border-white/5 hover:border-[#ff3d00]/50 active:scale-[0.98] transition-all cursor-pointer group flex justify-between items-center">
                    <div>
                       <h3 className="text-lg font-bold text-white group-hover:text-[#ff3d00] transition-colors">{w.name}</h3>
                       <div className="text-xs text-white/40 mt-1 flex gap-3">
                          <span>{new Date(w.date).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{w.cycles && w.cycles > 1 ? `${w.cycles} Циклов • ` : ''}{w.rounds.length} Раундов</span>
                       </div>
                    </div>
                    {/* ISOLATED DELETE BUTTON */}
                    <button 
                      type="button"
                      onClick={(e) => handleDeleteWorkout(w.id, e)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg text-white/20 hover:text-red-500 hover:bg-white/5 transition-colors relative z-10"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                 </div>
               ))
             )}
          </div>
        </div>
      </div>

    </div>
  );
}