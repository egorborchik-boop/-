import React, { useState, useRef } from 'react';
import { Round, Phase, TimerStatus } from '../types';
import * as audio from '../utils/audio';

interface RoundEditorProps {
  rounds: Round[];
  cycles: number;
  onUpdateCycles: (val: number) => void;
  onUpdateRound: (id: string, field: keyof Round, value: any) => void;
  onUpdateAllDurations: (work: number, rest: number) => void;
  onRemoveRound: (id: string) => void;
  onAddRound: () => void;
  onOpenStopwatch: () => void;
  activeRoundId: string | null;
  isEditable: boolean;
  currentPhase?: Phase;
  timerStatus?: TimerStatus;
}

const EXERCISE_PRESETS = [
  "Отжимания",
  "Пресс (скручивания)",
  "Планка",
  "Подъёмы ног лёжа",
  "Приседания",
  "Выпады",
  "Вис на перекладине",
  "Учи-коми",
  "Учи-коми в движении",
  "Учи-коми с отрывом",
  "Борьба",
  "Борьба на захват"
];

export const RoundEditor: React.FC<RoundEditorProps> = ({ 
  rounds,
  cycles,
  onUpdateCycles, 
  onUpdateRound, 
  onUpdateAllDurations,
  onRemoveRound, 
  onAddRound,
  onOpenStopwatch,
  activeRoundId,
  isEditable,
  currentPhase,
  timerStatus
}) => {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [recordingRoundId, setRecordingRoundId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>, id: string, field: keyof Round) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) val = 0;
    if (val < 0) val = 0;
    if (val > 999) val = 999;
    onUpdateRound(id, field, val);
  };

  const handleCycleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) val = 1;
    if (val < 1) val = 1;
    if (val > 99) val = 99;
    onUpdateCycles(val);
  };

  // Handlers for Global Time Inputs
  const globalWork = rounds.length > 0 ? rounds[0].workDuration : 10;
  const globalRest = rounds.length > 0 ? rounds[0].restDuration : 10;

  const handleGlobalWorkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) val = 0;
    if (val < 0) val = 0;
    onUpdateAllDurations(val, globalRest);
  };

  const handleGlobalRestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) val = 0;
    if (val < 0) val = 0;
    onUpdateAllDurations(globalWork, val);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const toggleDropdown = (id: string) => {
    if (openDropdownId === id) setOpenDropdownId(null);
    else setOpenDropdownId(id);
  };

  const selectPreset = (id: string, name: string) => {
    onUpdateRound(id, 'exerciseName', name);
    setOpenDropdownId(null);
  };

  // --- Voice Recording Logic ---
  const startRecording = async (roundId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64String = reader.result as string;
          onUpdateRound(roundId, 'customAudio', base64String);
        };
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecordingRoundId(roundId);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Не удалось получить доступ к микрофону");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingRoundId) {
      mediaRecorderRef.current.stop();
      setRecordingRoundId(null);
    }
  };

  const deleteRecording = (e: React.MouseEvent, roundId: string) => {
    e.stopPropagation();
    onUpdateRound(roundId, 'customAudio', undefined);
  };

  const playRecording = (e: React.MouseEvent, base64: string) => {
    e.stopPropagation();
    audio.playAudioFromBase64(base64);
  };
  
  const toggleTTS = (e: React.MouseEvent, id: string, currentState?: boolean) => {
      e.stopPropagation();
      // If undefined, we assume false now (default off)
      const newState = currentState === true ? false : true;
      onUpdateRound(id, 'ttsEnabled', newState);
  };


  return (
    <div className="flex flex-col gap-2 w-full pb-24">
      
      {/* HEADER: Cycles/Stopwatch (Left) - Global Time (Center) - Training/Add (Right) */}
      <div className="flex items-end justify-between px-1 mb-2 pt-2 border-b border-white/5 pb-3 gap-2">
        
        {/* LEFT: Cycles + Stopwatch */}
        <div className="flex gap-2 flex-none">
            {/* Cycles */}
            <div className="flex flex-col gap-1.5">
                <h3 className="text-white/40 font-bold uppercase tracking-[0.2em] text-[9px] sm:text-[10px]">ЦИКЛЫ</h3>
                <div className="flex items-center bg-[#1c1c1e] rounded-lg border border-white/10 p-0.5 h-[38px]">
                    <button 
                      onClick={() => isEditable && onUpdateCycles(Math.max(1, cycles - 1))}
                      className="w-8 h-full flex items-center justify-center text-white/50 hover:text-[#ff3d00] hover:bg-white/5 rounded-md transition-colors active:scale-95 disabled:opacity-30"
                      disabled={!isEditable}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    
                    <input 
                        type="number" 
                        value={cycles}
                        onChange={handleCycleChange}
                        onFocus={handleFocus}
                        className="w-8 sm:w-10 bg-transparent text-center font-mono text-xl font-bold text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={!isEditable}
                    />
                    
                    <button 
                      onClick={() => isEditable && onUpdateCycles(cycles + 1)}
                      className="w-8 h-full flex items-center justify-center text-white/50 hover:text-[#ff3d00] hover:bg-white/5 rounded-md transition-colors active:scale-95 disabled:opacity-30"
                      disabled={!isEditable}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                </div>
            </div>

            {/* Stopwatch Button */}
            <div className="flex flex-col justify-end h-[38px] mb-[1px]">
               <button 
                  onClick={onOpenStopwatch}
                  className="w-10 h-full flex items-center justify-center bg-[#1c1c1e] hover:bg-[#ff3d00] border border-white/10 hover:border-[#ff3d00] rounded-lg transition-all active:scale-95 group"
                  title="Периодический таймер"
               >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50 group-hover:text-black"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
               </button>
            </div>
        </div>

        {/* CENTER: Global Time Controls */}
        <div className="flex flex-col gap-1.5 flex-1 items-center">
            <h3 className="text-white/40 font-bold uppercase tracking-[0.2em] text-[9px] sm:text-[10px]">ВРЕМЯ</h3>
            <div className="flex items-center bg-[#1c1c1e] rounded-lg border border-white/10 p-0.5 h-[38px] gap-2 px-3 w-full justify-center max-w-[160px]">
                {/* Work Input */}
                <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-[#ff3d00] uppercase">Раб</span>
                    <input 
                        type="number"
                        value={globalWork}
                        onChange={handleGlobalWorkChange}
                        onFocus={handleFocus}
                        className="w-8 bg-transparent text-center font-mono text-lg font-bold text-white focus:outline-none border-b border-white/20 focus:border-[#ff3d00] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={!isEditable}
                    />
                </div>
                
                <div className="w-px h-4 bg-white/10"></div>

                {/* Rest Input */}
                <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-[#d4ff00] uppercase">Отд</span>
                    <input 
                        type="number"
                        value={globalRest}
                        onChange={handleGlobalRestChange}
                        onFocus={handleFocus}
                        className="w-8 bg-transparent text-center font-mono text-lg font-bold text-white focus:outline-none border-b border-white/20 focus:border-[#d4ff00] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={!isEditable}
                    />
                </div>
            </div>
        </div>

        {/* RIGHT: Training Header & Add Button */}
        <div className="flex flex-col items-end gap-1.5 flex-none">
            <h3 className="text-white/40 font-bold uppercase tracking-[0.2em] text-[9px] sm:text-[10px]">ТРЕНИРОВКА</h3>
            {isEditable && (
              <button 
                onClick={onAddRound}
                className="flex items-center gap-2 px-3 h-[38px] bg-[#1c1c1e] hover:bg-[#ff3d00] border border-white/10 hover:border-[#ff3d00] rounded-lg transition-all active:scale-95 group"
              >
                <div className="w-4 h-4 rounded-full bg-white/10 group-hover:bg-black/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="text-white group-hover:text-black"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <span className="text-[10px] font-black uppercase text-white group-hover:text-black tracking-wider hidden sm:inline">Добавить</span>
                <span className="text-[10px] font-black uppercase text-white group-hover:text-black tracking-wider sm:hidden">ADD</span>
              </button>
            )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {rounds.map((round, idx) => {
           const isActive = activeRoundId === round.id;
           const isRunning = timerStatus === TimerStatus.RUNNING;
           const isDropdownOpen = openDropdownId === round.id;
           const isRecording = recordingRoundId === round.id;
           const isWorkActive = isActive && currentPhase === Phase.WORK && isRunning;
           const isRestActive = isActive && currentPhase === Phase.REST && isRunning;
           const zIndexClass = isDropdownOpen ? 'z-[100]' : (isActive ? 'z-10' : 'z-0');
           const isTTSEnabled = round.ttsEnabled === true;

           return (
            <div 
              key={round.id} 
              className={`relative transition-all duration-300 ${zIndexClass}`}
            >
              {isActive && isRunning && (
                <div 
                  className={`absolute inset-0 rounded-lg blur-xl opacity-40 transition-colors duration-300 animate-pulse ${
                    currentPhase === Phase.WORK ? 'bg-[#ff3d00]' : (currentPhase === Phase.REST ? 'bg-[#d4ff00]' : 'bg-transparent')
                  }`}
                />
              )}

              <div className="flex gap-1 items-stretch">
                <div className={`w-12 flex-none rounded-lg flex flex-col items-center justify-center font-mono font-bold text-xl border transition-all duration-300 relative group
                    ${isActive && isRunning 
                        ? 'border-transparent ' + (currentPhase === Phase.WORK ? 'bg-[#ff3d00] text-black shadow-[0_0_15px_#ff3d00]' : 'bg-[#d4ff00] text-black shadow-[0_0_15px_#d4ff00]') 
                        : (isActive ? 'bg-white text-black border-transparent' : 'bg-[#1c1c1e] text-white/30 border-white/5')
                    }
                    ${isActive && isRunning ? 'animate-sync-pulse' : ''}
                `}>
                   {isRecording ? (
                        <button 
                            onClick={stopRecording}
                            className="w-full h-full flex items-center justify-center bg-red-600/20 text-red-500 rounded-lg animate-pulse"
                        >
                            <div className="w-4 h-4 bg-red-600 rounded-sm"></div>
                        </button>
                   ) : (
                       <>
                           {round.customAudio ? (
                               <div className="relative w-full h-full flex items-center justify-center group/audio">
                                    <button 
                                        onClick={(e) => playRecording(e, round.customAudio!)}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-[#ff3d00] hover:text-black transition-all z-10"
                                        title="Прослушать"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                    </button>
                                    
                                    {isEditable && (
                                        <>
                                            <button 
                                                onClick={(e) => deleteRecording(e, round.id)}
                                                className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-[#222] text-white/50 hover:text-red-500 rounded-full border border-white/10 z-20 hover:scale-110 transition-all shadow-md"
                                                title="Удалить"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>

                                            <button 
                                                onClick={(e) => { e.stopPropagation(); startRecording(round.id); }}
                                                className="absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center bg-[#222] text-white/50 hover:text-[#ff3d00] rounded-full border border-white/10 z-20 hover:scale-110 transition-all shadow-md"
                                                title="Перезаписать"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                                            </button>
                                        </>
                                    )}
                               </div>
                           ) : (
                               <>
                                   <span className="text-xl mb-1">{idx + 1}</span>
                                   {isEditable && (
                                     <button 
                                        onClick={() => startRecording(round.id)}
                                        className="absolute bottom-0 right-0 p-1.5 text-white/30 hover:text-[#ff3d00] transition-colors active:scale-95"
                                        title="Записать команду"
                                     >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                                     </button>
                                   )}
                               </>
                           )}
                       </>
                   )}
                </div>

                <div className={`flex-1 rounded-lg p-2 relative transition-colors duration-300 border flex flex-col gap-1 ${
                    isActive ? 'bg-[#111] border-transparent' : 'bg-[#1c1c1e] border-white/5'
                  }`}
                >
                  <div className="flex gap-1 h-9 relative z-30">
                    <div 
                        className={`flex-1 relative rounded bg-white/5 border border-white/5 flex items-center px-2 transition-colors group/input ${isEditable ? 'hover:border-white/20 cursor-pointer' : ''}`}
                        onClick={() => isEditable && toggleDropdown(round.id)}
                    >
                         {isEditable ? (
                             <>
                                <input 
                                  type="text" 
                                  value={round.exerciseName}
                                  onChange={(e) => onUpdateRound(round.id, 'exerciseName', e.target.value)}
                                  onFocus={(e) => { 
                                      e.target.select(); 
                                      if (openDropdownId !== round.id) setOpenDropdownId(round.id);
                                  }}
                                  onClick={(e) => e.stopPropagation()} 
                                  className="w-full bg-transparent text-white text-sm font-bold uppercase tracking-wide focus:outline-none placeholder:text-white/20 truncate pr-6"
                                  placeholder="УПРАЖНЕНИЕ"
                                  autoComplete="off"
                                />
                                
                                <div className="absolute right-2 top-0 bottom-0 flex items-center gap-2">
                                    {round.exerciseName && (
                                        <button 
                                            onClick={(e) => toggleTTS(e, round.id, round.ttsEnabled)}
                                            className={`transition-colors ${isTTSEnabled ? 'text-[#d4ff00]' : 'text-white/20 hover:text-white/40'}`}
                                            title={isTTSEnabled ? "Озвучка включена" : "Озвучка выключена"}
                                        >
                                            {isTTSEnabled ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                                            )}
                                        </button>
                                    )}
                                    <svg className={`w-3 h-3 text-white/20 flex-none transition-transform group-hover/input:text-white ${isDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                                </div>
                                
                                {isDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40 cursor-default" onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); }}></div>
                                        <div className="absolute top-full left-0 mt-2 w-full bg-[#222] border border-white/10 rounded-md shadow-xl max-h-56 overflow-y-auto z-50 py-1">
                                            {EXERCISE_PRESETS.map(preset => (
                                                <div 
                                                    key={preset}
                                                    className="px-3 py-2 text-xs font-bold uppercase text-white hover:bg-[#ff3d00] hover:text-black cursor-pointer transition-colors"
                                                    onClick={(e) => { e.stopPropagation(); selectPreset(round.id, preset); }}
                                                >
                                                    {preset}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                             </>
                         ) : (
                             <span className="w-full text-white text-sm font-bold uppercase tracking-wide truncate">
                                {round.exerciseName}
                             </span>
                         )}
                    </div>
                    
                    {isEditable && (
                      <button 
                        onClick={() => onRemoveRound(round.id)}
                        className="w-8 h-full rounded bg-white/5 text-white/20 hover:bg-[#ff3d00] hover:text-white transition-all flex items-center justify-center flex-none border border-white/5 hover:border-transparent"
                        disabled={rounds.length <= 1}
                        title="Удалить раунд"
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1 h-10">
                    <div 
                      className={`bg-[#000] rounded px-2 py-0.5 flex flex-col justify-center border transition-all duration-300 relative group overflow-hidden ${
                        isWorkActive 
                          ? 'border-[#ff3d00] text-[#ff3d00] animate-sync-pulse' 
                          : 'border-white/5 text-white'
                      }`}
                    >
                       <div className="flex items-center justify-between">
                          <span className={`text-[9px] uppercase font-bold tracking-widest ${isWorkActive ? 'text-[#ff3d00]' : 'text-white/40'}`}>РАБОТА</span>
                          
                          <div className="flex items-baseline gap-1">
                            {isEditable ? (
                              <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={round.workDuration}
                                    onChange={(e) => handleDurationChange(e, round.id, 'workDuration')}
                                    onFocus={handleFocus}
                                    className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-transparent w-12 font-mono text-lg font-bold leading-none focus:outline-none text-right ${isWorkActive ? 'text-[#ff3d00]' : 'text-white'}`}
                                  />
                                  <div className="flex flex-col gap-0.5">
                                    <button onClick={() => onUpdateRound(round.id, 'workDuration', round.workDuration + 5)} className="text-white/30 hover:text-[#ff3d00]"><svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="18 15 12 9 6 15"/></svg></button>
                                    <button onClick={() => onUpdateRound(round.id, 'workDuration', Math.max(5, round.workDuration - 5))} className="text-white/30 hover:text-[#ff3d00]"><svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="6 9 12 15 18 9"/></svg></button>
                                  </div>
                              </div>
                            ) : (
                              <span className="text-lg font-mono font-bold leading-none">{round.workDuration}</span>
                            )}
                            <span className="text-[9px] opacity-30">с</span>
                          </div>
                       </div>
                    </div>

                    <div 
                      className={`bg-[#000] rounded px-2 py-0.5 flex flex-col justify-center border transition-all duration-300 relative overflow-hidden ${
                        isRestActive 
                          ? 'border-[#d4ff00] text-[#d4ff00] animate-sync-pulse' 
                          : 'border-white/5 text-white'
                      }`}
                    >
                       <div className="flex items-center justify-between">
                          <span className={`text-[9px] uppercase font-bold tracking-widest ${isRestActive ? 'text-[#d4ff00]' : 'text-white/40'}`}>ОТДЫХ</span>
                          
                          <div className="flex items-baseline gap-1">
                            {isEditable ? (
                              <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={round.restDuration}
                                    onChange={(e) => handleDurationChange(e, round.id, 'restDuration')}
                                    onFocus={handleFocus}
                                    className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-transparent w-12 font-mono text-lg font-bold leading-none focus:outline-none text-right ${isRestActive ? 'text-[#d4ff00]' : 'text-white'}`}
                                  />
                                  <div className="flex flex-col gap-0.5">
                                    <button onClick={() => onUpdateRound(round.id, 'restDuration', round.restDuration + 5)} className="text-white/30 hover:text-[#d4ff00]"><svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="18 15 12 9 6 15"/></svg></button>
                                    <button onClick={() => onUpdateRound(round.id, 'restDuration', Math.max(0, round.restDuration - 5))} className="text-white/30 hover:text-[#d4ff00]"><svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="6 9 12 15 18 9"/></svg></button>
                                  </div>
                              </div>
                            ) : (
                              <span className="text-lg font-mono font-bold leading-none">{round.restDuration}</span>
                            )}
                            <span className="text-[9px] opacity-30">с</span>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
           );
        })}
      </div>
    </div>
  );
};