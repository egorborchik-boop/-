import React, { useState, useEffect, useRef } from 'react';
import { RoundEditor } from './components/RoundEditor';
import { Round, Phase, TimerStatus, SavedWorkout, UserProfile } from './types';
import * as audio from './utils/audio';
import { Profile } from './components/Profile';
import { TrainerMode } from './components/TrainerMode';

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

// Preloaded workout 1: Judo Complex
const PRELOADED_JUDO_WORKOUT: SavedWorkout = {
  id: 'default-uchi-komi-complex',
  name: 'Учи-коми Комплекс',
  date: Date.now(),
  cycles: 1,
  rounds: [
    { 
      id: 'def-u1', 
      exerciseName: 'Учи-коми на месте', 
      workDuration: 10, 
      restDuration: 0, 
      ttsEnabled: true,
      instructions: []
    },
    { 
      id: 'def-u2', 
      exerciseName: 'Учи-коми в движении', 
      workDuration: 10, 
      restDuration: 0, 
      ttsEnabled: true,
      instructions: []
    },
    { 
      id: 'def-u3', 
      exerciseName: 'Учи-коми с отрывом', 
      workDuration: 10, 
      restDuration: 0, 
      ttsEnabled: true,
      instructions: []
    },
    { 
      id: 'def-u4', 
      exerciseName: 'Борьба на захват', 
      workDuration: 20, 
      restDuration: 10, 
      ttsEnabled: true,
      instructions: []
    }
  ]
};

// Preloaded workout 2: Series
const PRELOADED_SERIES_WORKOUT: SavedWorkout = {
  id: 'default-series-workout',
  name: 'Серии',
  date: Date.now(),
  cycles: 1,
  rounds: [
    { id: 'ser-1', exerciseName: 'Бег вперёд назад', workDuration: 10, restDuration: 10, ttsEnabled: true, instructions: [] },
    { id: 'ser-2', exerciseName: 'Прыжки лягушкой', workDuration: 10, restDuration: 10, ttsEnabled: true, instructions: [] },
    { id: 'ser-3', exerciseName: 'Упор присест', workDuration: 10, restDuration: 10, ttsEnabled: true, instructions: [] },
    { id: 'ser-4', exerciseName: 'Отжимания', workDuration: 10, restDuration: 10, ttsEnabled: true, instructions: [] },
    { id: 'ser-5', exerciseName: 'Пресс', workDuration: 10, restDuration: 10, ttsEnabled: true, instructions: [] },
    { id: 'ser-6', exerciseName: 'Приседания', workDuration: 10, restDuration: 10, ttsEnabled: true, instructions: [] },
    { id: 'ser-7', exerciseName: 'Локти', workDuration: 10, restDuration: 10, ttsEnabled: true, instructions: [] },
    { id: 'ser-8', exerciseName: 'Колени', workDuration: 10, restDuration: 10, ttsEnabled: true, instructions: [] },
    { id: 'ser-9', exerciseName: 'Бабочка', workDuration: 10, restDuration: 10, ttsEnabled: true, instructions: [] },
    { id: 'ser-10', exerciseName: 'Тяги', workDuration: 10, restDuration: 10, ttsEnabled: true, instructions: [] },
    { id: 'ser-11', exerciseName: 'Толкание', workDuration: 10, restDuration: 10, ttsEnabled: true, instructions: [] },
    { id: 'ser-12', exerciseName: 'Подсечки', workDuration: 10, restDuration: 10, ttsEnabled: true, instructions: [] },
    { id: 'ser-13', exerciseName: 'Прыжки колени к груди', workDuration: 10, restDuration: 10, ttsEnabled: true, instructions: [] },
    { id: 'ser-14', exerciseName: 'Бег на месте ускорение', workDuration: 5, restDuration: 15, ttsEnabled: true, instructions: [] },
  ]
};

const PROTECTED_WORKOUT_IDS = [PRELOADED_JUDO_WORKOUT.id, PRELOADED_SERIES_WORKOUT.id];

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

  // Stopwatch State
  const [isStopwatchOpen, setIsStopwatchOpen] = useState(false);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [stopwatchInterval, setStopwatchInterval] = useState(30); // Seconds
  const [isFlashing, setIsFlashing] = useState(false);
  const stopwatchRef = useRef<number | null>(null);

  // Profile State
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
        const stored = localStorage.getItem('judo_timer_profile');
        return stored ? JSON.parse(stored) : {};
    } catch(e) {
        return {};
    }
  });

  // Trainer Mode State
  const [isTrainerMode, setIsTrainerMode] = useState(false);
  const [isTrainerUIOpen, setIsTrainerUIOpen] = useState(false);
  const trainerUnlockTimeout = useRef<number | null>(null);

  // Archive & Save State
  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>(() => {
    try {
      const stored = localStorage.getItem('judo_timer_workouts');
      let workouts: SavedWorkout[] = [];

      if (stored) {
        const parsed = JSON.parse(stored);
        workouts = Array.isArray(parsed) ? parsed.map((w: any) => ({
          ...w,
          id: w.id || Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
          cycles: w.cycles || 1
        })) : [];
      }

      // Check and restore protected workouts if missing
      const result = [...workouts];
      if (!result.some(w => w.id === PRELOADED_SERIES_WORKOUT.id)) {
        result.unshift(PRELOADED_SERIES_WORKOUT);
      }
      if (!result.some(w => w.id === PRELOADED_JUDO_WORKOUT.id)) {
        result.unshift(PRELOADED_JUDO_WORKOUT);
      }

      return result;
    } catch (e) {
      console.error("Failed to load workouts", e);
      return [PRELOADED_JUDO_WORKOUT, PRELOADED_SERIES_WORKOUT];
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

  // Save profile changes
  useEffect(() => {
    localStorage.setItem('judo_timer_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  // Trainer Mode Activation Logic
  const openTrainerLogin = () => {
      const password = prompt("Введите пароль тренера:");
      if (password === "1324") {
          setIsTrainerMode(true);
          setIsTrainerUIOpen(true);
          // If called from profile, close profile
          setIsProfileOpen(false);
          alert("Режим тренера активирован");
      }
  };

  const handleLogoDown = () => {
      trainerUnlockTimeout.current = window.setTimeout(() => {
          openTrainerLogin();
      }, 3000); // 3 seconds long press
  };

  const handleLogoUp = () => {
      if (trainerUnlockTimeout.current) {
          clearTimeout(trainerUnlockTimeout.current);
          trainerUnlockTimeout.current = null;
      }
  };

  const handleProfileLogout = () => {
      const emptyProfile = { id: 'athlete_' + Math.random().toString(36).substr(2, 9) };
      setUserProfile(emptyProfile);
      setIsProfileOpen(false); // Close modal on logout
  };

  // --- STOPWATCH LOGIC ---
  useEffect(() => {
    if (stopwatchRunning) {
      stopwatchRef.current = window.setInterval(() => {
        setStopwatchTime(prev => {
          const next = prev + 1;
          // Check for interval trigger
          if (next > 0 && next % stopwatchInterval === 0) {
             triggerStopwatchSignal();
          }
          return next;
        });
      }, 1000);
    } else {
      if (stopwatchRef.current) clearInterval(stopwatchRef.current);
    }
    return () => { if (stopwatchRef.current) clearInterval(stopwatchRef.current); };
  }, [stopwatchRunning, stopwatchInterval]);

  const triggerStopwatchSignal = () => {
    audio.playStartBeep(); // Loud sound
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 1000); // 1s flash
  };

  const toggleStopwatch = () => {
    setStopwatchRunning(prev => !prev);
  };

  const resetStopwatch = () => {
    setStopwatchRunning(false);
    setStopwatchTime(0);
  };

  const formatStopwatchTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // --- MAIN TIMER AUDIO LOGIC ---
  const playRoundVoice = (round: Round | undefined) => {
    if (!round) return;
    if (round.customAudio) {
       audio.playAudioFromBase64(round.customAudio);
    } else if (round.ttsEnabled === true && round.exerciseName && round.exerciseName.trim()) {
       audio.speakText(round.exerciseName);
    }
  };

  const tick = () => {
    setTimeLeft((prev) => {
      const next = prev - 0.1;
      const currentCeil = Math.ceil(prev);
      const nextCeil = Math.ceil(next);
      if (nextCeil < currentCeil && nextCeil <= 3 && nextCeil > 0) {
         audio.playBeep(600, 'sine', 0.15);
      }

      if (prev <= 0.1) {
        if (phase === Phase.PREPARE) {
          setPhase(Phase.WORK);
          audio.playStartBeep(); 
          return rounds[currentRoundIndex].workDuration;
        } 
        else if (phase === Phase.WORK) {
          const round = rounds[currentRoundIndex];
          if (round.restDuration > 0) {
            setPhase(Phase.REST);
            audio.playRestBeep(); 
            let nextR = null;
            if (currentRoundIndex < rounds.length - 1) nextR = rounds[currentRoundIndex + 1];
            else if (currentCycle < cycles - 1) nextR = rounds[0];
            if (nextR) setTimeout(() => playRoundVoice(nextR), 600);
            return round.restDuration;
          } else {
            if (currentRoundIndex < rounds.length - 1) {
              const nextIdx = currentRoundIndex + 1;
              setCurrentRoundIndex(nextIdx);
              setPhase(Phase.WORK);
              audio.playStartBeep(); 
              setTimeout(() => playRoundVoice(rounds[nextIdx]), 300);
              return rounds[nextIdx].workDuration;
            } else {
              if (currentCycle < cycles - 1) {
                 setCurrentCycle(c => c + 1);
                 setCurrentRoundIndex(0);
                 setPhase(Phase.PREPARE);
                 audio.playBeep(600, 'sine', 0.2);
                 setTimeout(() => playRoundVoice(rounds[0]), 300);
                 return PREPARE_TIME;
              } else {
                 setPhase(Phase.COMPLETE);
                 setStatus(TimerStatus.IDLE);
                 audio.playRestBeep();
                 setTimeout(audio.playRestBeep, 300);
                 setTimeout(audio.playRestBeep, 600);
                 return 0;
              }
            }
          }
        } 
        else if (phase === Phase.REST) {
          if (currentRoundIndex < rounds.length - 1) {
            const nextIdx = currentRoundIndex + 1;
            setCurrentRoundIndex(nextIdx);
            setPhase(Phase.WORK);
            audio.playStartBeep(); 
            return rounds[nextIdx].workDuration;
          } else {
              if (currentCycle < cycles - 1) {
                 setCurrentCycle(c => c + 1);
                 setCurrentRoundIndex(0);
                 setPhase(Phase.PREPARE);
                 audio.playBeep(600, 'sine', 0.2);
                 setTimeout(() => playRoundVoice(rounds[0]), 300);
                 return PREPARE_TIME;
              } else {
                 setPhase(Phase.COMPLETE);
                 setStatus(TimerStatus.IDLE);
                 audio.playRestBeep();
                 setTimeout(audio.playRestBeep, 300);
                 setTimeout(audio.playRestBeep, 600);
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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, phase, currentRoundIndex, rounds, cycles, currentCycle]);

  const updateRound = (id: string, field: keyof Round, value: any) => {
    setRounds(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const updateAllDurations = (work: number, rest: number) => {
    setRounds(prev => prev.map(r => ({ ...r, workDuration: work, restDuration: rest })));
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
        ttsEnabled: false
      };
      return [...prev, newRound];
    });
  };

  const toggleTimer = () => {
    if (status === TimerStatus.IDLE) {
      setPhase(Phase.PREPARE);
      setCurrentRoundIndex(0);
      setCurrentCycle(0);
      setTimeLeft(PREPARE_TIME);
      setStatus(TimerStatus.RUNNING);
      setIsEditable(false);
      playRoundVoice(rounds[0]);
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
    if (workout.isManual) return; // Cannot load manual workouts
    setRounds(workout.rounds);
    setCycles(workout.cycles || 1);
    setIsArchiveOpen(false);
    resetTimer();
  };

  const handleDeleteWorkout = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (PROTECTED_WORKOUT_IDS.includes(id)) return;
    setSavedWorkouts(prev => prev.filter(w => w.id !== id));
  };

  const progressPercent = Math.min(100, Math.max(0, (( (status === TimerStatus.IDLE ? 1 : 
    (phase === Phase.PREPARE ? PREPARE_TIME : (phase === Phase.WORK ? activeRound?.workDuration : activeRound?.restDuration))) - timeLeft) / 
    (status === TimerStatus.IDLE ? 1 : (phase === Phase.PREPARE ? PREPARE_TIME : (phase === Phase.WORK ? activeRound?.workDuration : activeRound?.restDuration)))) * 100));

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

  const getGradientClass = () => {
    switch(phase) {
        case Phase.PREPARE: return 'bg-gradient-to-r from-yellow-600 to-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.4)]';
        case Phase.WORK: return 'bg-gradient-to-r from-orange-700 via-[#ff3d00] to-orange-500 shadow-[0_0_25px_rgba(255,61,0,0.5)]';
        case Phase.REST: return 'bg-gradient-to-r from-lime-700 via-[#d4ff00] to-lime-500 shadow-[0_0_20px_rgba(212,255,0,0.4)]';
        case Phase.COMPLETE: return 'bg-green-500';
        default: return 'bg-gray-800';
    }
  };

  const getNextExercisesList = () => {
      const upcoming: Round[] = [];
      for (let i = 1; i <= 3; i++) {
          const nextIdx = currentRoundIndex + i;
          if (nextIdx < rounds.length) {
              upcoming.push(rounds[nextIdx]);
          } else if (currentCycle < cycles - 1) {
              const wrapIdx = nextIdx - rounds.length;
              if (wrapIdx < rounds.length) upcoming.push(rounds[wrapIdx]);
          }
      }
      return upcoming;
  };

  const nextExercisesList = getNextExercisesList();

  const getNextBlockStyle = (index: number) => {
      const styles = [
          'border-fuchsia-500/30 shadow-[0_0_15px_rgba(217,70,239,0.15)] bg-gradient-to-r from-fuchsia-900/40 to-purple-900/40 text-fuchsia-100',
          'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] bg-gradient-to-r from-emerald-900/40 to-cyan-900/40 text-emerald-100',
          'border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)] bg-gradient-to-r from-amber-900/40 to-orange-900/40 text-amber-100',
      ];
      return styles[index % styles.length];
  };

  return (
    <div className="min-h-screen bg-black flex flex-col max-w-lg mx-auto border-x border-white/5 relative overflow-hidden">
      
      {/* FLASH OVERLAY FOR STOPWATCH */}
      {isFlashing && (
        <div className="fixed inset-0 z-[999] pointer-events-none animate-pulse bg-gradient-to-br from-purple-500/30 via-red-500/30 to-yellow-500/30 mix-blend-screen"></div>
      )}

      {/* PROFILE MODAL */}
      {isProfileOpen && (
        <Profile 
            profile={userProfile} 
            workouts={savedWorkouts} 
            onUpdateProfile={setUserProfile}
            onAddManualWorkout={(w) => setSavedWorkouts(prev => [w, ...prev])}
            onClose={() => setIsProfileOpen(false)} 
            onTrainerLogin={openTrainerLogin}
            onLogout={handleProfileLogout}
        />
      )}

      {/* TRAINER MODE UI */}
      {isTrainerUIOpen && (
          <TrainerMode onClose={() => setIsTrainerUIOpen(false)} />
      )}

      {status === TimerStatus.IDLE ? (
        <>
          <div className="sticky top-0 bg-black/95 backdrop-blur-md z-[150] border-b border-white/10 p-4 pb-4">
            
            <div className="flex justify-between items-center mb-3">
                 <div className="flex items-center gap-2">
                     {isTrainerMode && (
                        <button 
                            onClick={() => setIsTrainerUIOpen(true)}
                            className="w-8 h-8 flex items-center justify-center bg-[#ff3d00] text-black rounded-lg shadow-[0_0_10px_#ff3d00] animate-pulse mr-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                        </button>
                     )}
                     <div 
                        className="text-xs font-bold text-white/50 tracking-[0.2em] uppercase select-none"
                        onPointerDown={handleLogoDown}
                        onPointerUp={handleLogoUp}
                        onPointerLeave={handleLogoUp}
                     >
                       {cycles > 1 ? `ЦИКЛЫ: ${cycles}` : 'НАСТРОЙКА'}
                     </div>
                 </div>

                 <div className="flex gap-2 items-center">
                     <button onClick={handleResetToDefaults} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95" title="Сброс">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                      </button>
                     <button onClick={() => setIsArchiveOpen(true)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95" title="Архив">
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                     </button>
                     <button onClick={() => setIsSaveOpen(true)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-[#ff3d00] flex items-center justify-center text-white/70 hover:text-black transition-all active:scale-95" title="Сохранить">
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                     </button>
                     
                     <div className="w-px h-6 bg-white/10 mx-1"></div>

                     <button onClick={() => setIsProfileOpen(true)} className="w-9 h-9 rounded-full overflow-hidden border border-white/20 hover:border-[#ff3d00] transition-colors">
                        {userProfile.photo ? (
                            <img src={userProfile.photo} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-[#333] flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            </div>
                        )}
                     </button>
                 </div>
            </div>

            <div className="flex items-stretch gap-3 h-24 sm:h-28">
              <div className={`flex items-center text-6xl sm:text-7xl font-black font-mono leading-none tracking-tighter tabular-nums ${getPhaseColor()}`}>
                 {formatTime(timeLeft)}
              </div>

              <div className="flex-1 relative rounded-xl overflow-hidden bg-[#1c1c1e] border border-white/10 shadow-inner group">
                  <div className={`absolute inset-0 h-full transition-all duration-100 ease-linear ${getGradientClass()}`} style={{ width: `${status === TimerStatus.IDLE ? '100' : progressPercent}%` }} />
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

          <div className="flex-1 p-4 overflow-y-auto">
            <RoundEditor 
              rounds={rounds}
              cycles={cycles}
              onUpdateCycles={setCycles}
              onUpdateRound={updateRound}
              onUpdateAllDurations={updateAllDurations}
              onRemoveRound={removeRound}
              onAddRound={addRound}
              onOpenStopwatch={() => setIsStopwatchOpen(true)}
              activeRoundId={null}
              isEditable={isEditable}
              currentPhase={phase}
              timerStatus={status}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col relative h-full">
           <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
               <div className="text-xs font-bold text-white/50 tracking-[0.2em] uppercase">
                  {cycles > 1 ? `C${currentCycle + 1}/${cycles} • ` : ''} 
                  {phase === Phase.COMPLETE ? 'FINISH' : `R${currentRoundIndex + 1}/${rounds.length}`}
               </div>
               <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase text-black ${getPhaseBg()}`}>
                  {phase === Phase.PREPARE ? 'READY' : phase === Phase.WORK ? 'WORK' : phase === Phase.REST ? 'REST' : 'DONE'}
               </div>
           </div>

           <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-4 w-full">
              <div className={`text-[25vw] sm:text-[10rem] font-black leading-none tracking-tighter tabular-nums transition-colors duration-300 ${getPhaseColor()} drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]`}>
                 {formatTime(timeLeft)}
              </div>

              {phase !== Phase.COMPLETE && (
                <div className="w-full max-w-md relative rounded-2xl overflow-hidden bg-[#1c1c1e] border border-white/10 shadow-2xl h-32 sm:h-40 flex items-center justify-center group mt-4">
                    <div className={`absolute inset-0 h-full transition-all duration-100 ease-linear ${getGradientClass()}`} style={{ width: `${progressPercent}%` }} />
                    <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
                       <span className="text-3xl sm:text-5xl font-black uppercase text-center leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                           {phase === Phase.REST ? 'ОТДЫХ' : (activeRound?.exerciseName || "Раунд")}
                       </span>
                    </div>
                </div>
              )}

              {status === TimerStatus.RUNNING && phase !== Phase.COMPLETE && nextExercisesList.length > 0 && (
                  <div className="w-full max-w-md flex flex-col gap-2 mt-2">
                      {nextExercisesList.map((round, idx) => (
                          <div 
                            key={`${round.id}-${idx}`}
                            className={`w-full relative rounded-xl overflow-hidden border h-10 sm:h-12 flex items-center justify-center animate-step-enter backdrop-blur-md ${getNextBlockStyle(idx)}`}
                          >
                              <div className="relative z-10 flex items-center gap-2 px-4 truncate max-w-full">
                                  <span className="text-[9px] uppercase font-black tracking-widest opacity-60">Next:</span>
                                  <span className="font-bold uppercase tracking-wide truncate" style={{ fontSize: 'clamp(0.8rem, 2.5vw, 1.1rem)' }}>{round.exerciseName}</span>
                              </div>
                          </div>
                      ))}
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

      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 bg-gradient-to-t from-black via-black to-transparent z-[150]">
        <div className="flex gap-3 h-14">
          {status === TimerStatus.IDLE ? (
             <button onClick={toggleTimer} className="flex-1 bg-[#ff3d00] text-black font-black uppercase tracking-widest text-lg rounded-xl hover:bg-[#ff5e2b] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,61,0,0.3)]">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
               СТАРТ
             </button>
          ) : (
            <>
               <button onClick={resetTimer} className="w-14 bg-[#222] text-white rounded-xl flex items-center justify-center hover:bg-[#333] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
               </button>
               <button onClick={toggleTimer} className={`flex-1 font-black uppercase tracking-widest text-lg rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${status === TimerStatus.RUNNING ? 'bg-[#d4ff00] text-black hover:bg-[#e0ff4d] shadow-[0_0_20px_rgba(212,255,0,0.3)]' : 'bg-[#ff3d00] text-black hover:bg-[#ff5e2b] shadow-[0_0_20px_rgba(255,61,0,0.3)]'}`}>
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

      {isSaveOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSaveOpen(false)}></div>
          <div className="relative w-full max-w-sm bg-[#1c1c1e] border border-white/10 p-6 rounded-2xl shadow-2xl flex flex-col gap-4">
            <h3 className="text-xl font-black uppercase tracking-wide text-white">Сохранить тренировку</h3>
            <input type="text" value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} placeholder="Название (напр. День борьбы)" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#ff3d00] transition-colors" autoFocus />
            <div className="flex gap-2 mt-2">
              <button onClick={() => setIsSaveOpen(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors uppercase text-sm tracking-wider">Отмена</button>
              <button onClick={handleSaveWorkout} disabled={!workoutName.trim()} className="flex-1 py-3 bg-[#ff3d00] hover:bg-[#ff5e2b] text-black font-black rounded-xl transition-colors uppercase text-sm tracking-wider disabled:opacity-50 disabled:cursor-not-allowed">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {isArchiveOpen && (
        <div className="fixed inset-0 z-[300]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsArchiveOpen(false)}></div>
          <div className="absolute bottom-0 left-0 right-0 max-w-lg mx-auto bg-[#111] border-t border-white/10 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] h-[80vh] flex flex-col transition-transform duration-300">
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
                 <div className="text-center text-white/30 py-10"><p className="mb-2 text-4xl opacity-20">📂</p><p className="uppercase text-sm font-bold tracking-widest">Нет сохраненных тренировок</p></div>
               ) : (
                 savedWorkouts.map(w => (
                   <div key={w.id} onClick={() => handleLoadWorkout(w)} className={`bg-[#1c1c1e] p-4 rounded-xl border border-white/5 hover:border-[#ff3d00]/50 active:scale-[0.98] transition-all cursor-pointer group flex justify-between items-center ${w.isManual ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                      <div>
                         <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-white group-hover:text-[#ff3d00] transition-colors">{w.name}</h3>
                            {w.isManual && <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/50 font-bold uppercase">Manual</span>}
                         </div>
                         <div className="text-xs text-white/40 mt-1 flex gap-3">
                            <span>{new Date(w.date).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{w.isManual ? `${w.manualDurationMin} мин` : `${w.cycles && w.cycles > 1 ? `${w.cycles} Циклов • ` : ''}${w.rounds.length} Раундов`}</span>
                         </div>
                      </div>
                      {!PROTECTED_WORKOUT_IDS.includes(w.id) && (
                        <button type="button" onClick={(e) => handleDeleteWorkout(w.id, e)} className="w-10 h-10 flex items-center justify-center rounded-lg text-white/20 hover:text-red-500 hover:bg-white/5 transition-colors relative z-10">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      )}
                   </div>
                 ))
               )}
            </div>
          </div>
        </div>
      )}

      {isStopwatchOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsStopwatchOpen(false)}></div>
          <div className="relative w-full max-w-sm bg-[#1c1c1e] border border-white/10 p-6 rounded-3xl shadow-2xl flex flex-col gap-6 items-center">
            <h3 className="text-2xl font-black uppercase tracking-wide text-white">Секундомер</h3>
            <div className="text-7xl font-mono font-bold text-[#ff3d00] tabular-nums tracking-tighter drop-shadow-lg">
                {formatStopwatchTime(stopwatchTime)}
            </div>
            
            <div className="flex flex-col items-center gap-2 w-full">
                <label className="text-xs text-white/50 uppercase font-bold tracking-widest">Сигнал каждые (сек)</label>
                <input 
                    type="number" 
                    value={stopwatchInterval} 
                    onChange={(e) => setStopwatchInterval(Math.max(1, parseInt(e.target.value) || 30))}
                    className="w-24 bg-black/50 text-center text-2xl font-bold text-white border-b border-white/20 focus:border-[#ff3d00] focus:outline-none p-2 rounded-t-lg"
                />
            </div>

            <div className="flex gap-3 w-full">
                <button 
                    onClick={toggleStopwatch}
                    className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-lg transition-all ${stopwatchRunning ? 'bg-[#d4ff00] text-black' : 'bg-[#ff3d00] text-black'}`}
                >
                    {stopwatchRunning ? 'ПАУЗА' : 'СТАРТ'}
                </button>
                <button 
                    onClick={resetStopwatch}
                    className="w-16 flex items-center justify-center bg-white/10 text-white hover:bg-white/20 rounded-xl"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
            </div>
            
            <button onClick={() => setIsStopwatchOpen(false)} className="text-white/30 hover:text-white text-sm font-bold uppercase tracking-wider mt-2">Закрыть</button>
          </div>
        </div>
      )}

    </div>
  );
}