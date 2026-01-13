import React, { useState, useEffect, useRef } from 'react';
import { TrainerData, Student, SavedWorkout, Assessment } from '../types';

interface TrainerModeProps {
  onClose: () => void;
}

declare const Html5QrcodeScanner: any;

export const TrainerMode: React.FC<TrainerModeProps> = ({ onClose }) => {
  const [data, setData] = useState<TrainerData>(() => {
    try {
      const stored = localStorage.getItem('judo_trainer_data');
      return stored ? JSON.parse(stored) : { students: [], assessments: {} };
    } catch {
      return { students: [], assessments: {} };
    }
  });

  const [activeScreen, setActiveScreen] = useState<'LIST' | 'SCANNER' | 'HISTORY'>('LIST');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
  // Scanner state
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem('judo_trainer_data', JSON.stringify(data));
  }, [data]);

  const startScanner = () => {
    setActiveScreen('SCANNER');
    // Allow DOM to update
    setTimeout(() => {
        if (!scannerRef.current) {
            const scanner = new Html5QrcodeScanner(
                "reader", 
                { fps: 10, qrbox: { width: 250, height: 250 } },
                /* verbose= */ false
            );
            scanner.render(onScanSuccess, onScanFailure);
            scannerRef.current = scanner;
        }
    }, 100);
  };

  const stopScanner = () => {
      if (scannerRef.current) {
          scannerRef.current.clear().catch((error: any) => console.error(error));
          scannerRef.current = null;
      }
      setActiveScreen('LIST');
  };

  const onScanSuccess = (decodedText: string, decodedResult: any) => {
    try {
        const studentInfo = JSON.parse(decodedText);
        if (studentInfo.id && studentInfo.name) {
            addStudent(studentInfo);
            // Stop scanner
            if (scannerRef.current) {
                scannerRef.current.clear().catch((e: any) => console.log(e));
                scannerRef.current = null;
            }
            setActiveScreen('LIST');
            alert(`Ученик добавлен: ${studentInfo.name}`);
        }
    } catch (e) {
        console.error("Invalid QR", e);
    }
  };

  const onScanFailure = (error: any) => {
    // console.warn(`Code scan error = ${error}`);
  };

  const addStudent = (info: any) => {
      setData(prev => {
          if (prev.students.some(s => s.id === info.id)) return prev;
          const newStudent: Student = {
              id: info.id,
              name: info.name,
              photo: info.photo,
              lastWorkoutDate: Date.now()
          };
          return {
              ...prev,
              students: [newStudent, ...prev.students]
          };
      });
  };

  const handleStudentClick = (studentId: string) => {
      setSelectedStudentId(studentId);
      setActiveScreen('HISTORY');
  };

  const saveAssessment = (workoutId: string, rating: number, comment: string) => {
      if (!selectedStudentId) return;
      setData(prev => {
          const studentAssessments = prev.assessments[selectedStudentId] || {};
          return {
              ...prev,
              assessments: {
                  ...prev.assessments,
                  [selectedStudentId]: {
                      ...studentAssessments,
                      [workoutId]: { rating, comment }
                  }
              }
          };
      });
      alert('Оценка сохранена');
  };

  const renderHistory = () => {
      const student = data.students.find(s => s.id === selectedStudentId);
      if (!student) return null;

      // In a real app, we would fetch workouts from a server.
      // Since this is local-only and QR doesn't transfer history, we show an empty state.
      const studentWorkouts: SavedWorkout[] = []; 

      return (
        <div className="flex flex-col h-full bg-black">
             <div className="p-4 border-b border-white/10 flex items-center gap-4 bg-[#1c1c1e]">
                <button onClick={() => setActiveScreen('LIST')} className="p-2 -ml-2 text-white/50 hover:text-white">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden">
                        {student.photo ? <img src={student.photo} className="w-full h-full object-cover"/> : <span className="flex items-center justify-center h-full text-xs">🥋</span>}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold leading-none">{student.name}</h2>
                        <span className="text-xs text-white/50">История тренировок</span>
                    </div>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {studentWorkouts.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-20 opacity-50">
                         <div className="text-4xl mb-2">📭</div>
                         <p className="text-white font-bold uppercase tracking-widest text-sm">История пуста</p>
                         <p className="text-white/50 text-xs mt-1 text-center max-w-[200px]">Данные о тренировках еще не синхронизированы.</p>
                     </div>
                 ) : (
                     studentWorkouts.map(w => {
                         const assessment = data.assessments[student.id]?.[w.id] || { rating: 0, comment: '' };
                         
                         return (
                             <div key={w.id} className="bg-[#1c1c1e] rounded-xl border border-white/10 p-4 flex flex-col gap-3">
                                 <div className="flex justify-between items-start">
                                     <div>
                                         <h3 className="font-bold text-[#ff3d00]">{w.name}</h3>
                                         <div className="text-xs text-white/50 mt-1">
                                             {new Date(w.date).toLocaleDateString()} • {w.manualDurationMin} мин
                                             {w.isManual && <span className="ml-2 px-1.5 py-0.5 rounded bg-white/10 text-white/70">Manual</span>}
                                         </div>
                                     </div>
                                 </div>

                                 {/* TRAINER CONTROLS */}
                                 <div className="bg-black/40 rounded-lg p-3 border border-white/5 flex flex-col gap-3">
                                     <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40">Оценка тренера</h4>
                                     
                                     <div className="flex items-center gap-2">
                                         {[1, 2, 3, 4, 5].map(star => (
                                             <button 
                                                key={star}
                                                onClick={() => saveAssessment(w.id, star, assessment.comment)}
                                                className={`text-2xl transition-transform active:scale-90 ${star <= assessment.rating ? 'text-[#FFD700]' : 'text-white/10'}`}
                                             >
                                                 ★
                                             </button>
                                         ))}
                                     </div>

                                     <div className="flex gap-2">
                                         <input 
                                            type="text" 
                                            defaultValue={assessment.comment}
                                            onBlur={(e) => saveAssessment(w.id, assessment.rating, e.target.value)}
                                            placeholder="Комментарий тренера..." 
                                            className="flex-1 bg-transparent border-b border-white/10 text-sm py-1 focus:outline-none focus:border-[#ff3d00] text-white"
                                         />
                                         <button 
                                            className="text-xs font-bold text-[#ff3d00] uppercase"
                                            onClick={(e) => {
                                                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                                saveAssessment(w.id, assessment.rating, input.value);
                                            }}
                                         >
                                             Сохранить
                                         </button>
                                     </div>
                                 </div>
                             </div>
                         );
                     })
                 )}
             </div>
        </div>
      );
  };

  if (activeScreen === 'SCANNER') {
      return (
          <div className="fixed inset-0 z-[500] bg-black flex flex-col">
              <div className="flex items-center justify-between p-4 bg-[#1c1c1e]">
                  <h2 className="font-bold">Сканировать QR</h2>
                  <button onClick={stopScanner} className="text-white/50">Закрыть</button>
              </div>
              <div className="flex-1 flex items-center justify-center bg-black relative">
                   <div id="reader" className="w-full max-w-sm"></div>
              </div>
          </div>
      );
  }

  if (activeScreen === 'HISTORY') {
      return (
        <div className="fixed inset-0 z-[500] bg-black animate-step-enter">
            {renderHistory()}
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[450] bg-black flex flex-col animate-step-enter">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#1c1c1e]">
            <h2 className="text-xl font-black uppercase tracking-wide text-[#ff3d00]">Тренерский режим</h2>
            <div className="flex gap-4">
                <button onClick={startScanner} className="w-10 h-10 flex items-center justify-center rounded-full bg-[#ff3d00] text-black shadow-[0_0_15px_#ff3d00]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                </button>
                <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-white/40 font-bold uppercase tracking-[0.2em] text-xs mb-4">Мои ученики</h3>
            
            {data.students.length === 0 ? (
                <div className="text-center py-10 text-white/30 flex flex-col items-center">
                    <div className="text-4xl mb-2">📷</div>
                    <p>Список пуст.</p>
                    <p className="text-sm">Нажмите камеру, чтобы добавить ученика.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {data.students.map(s => (
                        <div 
                            key={s.id} 
                            onClick={() => handleStudentClick(s.id)}
                            className="bg-[#1c1c1e] p-3 rounded-xl border border-white/10 flex items-center gap-4 active:scale-98 transition-transform"
                        >
                            <div className="w-12 h-12 rounded-full bg-white/10 overflow-hidden flex-none">
                                {s.photo ? <img src={s.photo} className="w-full h-full object-cover"/> : <span className="w-full h-full flex items-center justify-center text-xl">🥋</span>}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-white text-lg leading-none">{s.name}</h4>
                                <p className="text-xs text-white/40 mt-1">
                                    Посл. тренировка: {new Date(s.lastWorkoutDate).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="text-white/20">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};