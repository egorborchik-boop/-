import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, SavedWorkout } from '../types';

interface ProfileProps {
  profile: UserProfile;
  workouts: SavedWorkout[];
  onUpdateProfile: (p: UserProfile) => void;
  onAddManualWorkout: (w: SavedWorkout) => void;
  onClose: () => void;
  onTrainerLogin: () => void;
  onLogout: () => void;
}

const WORKOUT_TYPES = ["Табата", "Силовая", "Кардио", "Растяжка", "Борьба"];

const MOCK_LEADERBOARD = [
  { name: "Алексей И.", workouts: 142, avatar: null },
  { name: "Дмитрий К.", workouts: 115, avatar: null },
  { name: "Иван С.", workouts: 98, avatar: null },
  { name: "Мария П.", workouts: 87, avatar: null },
];

export const Profile: React.FC<ProfileProps> = ({
  profile,
  workouts,
  onUpdateProfile,
  onAddManualWorkout,
  onClose,
  onTrainerLogin,
  onLogout
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Ensure profile has an ID
  useEffect(() => {
    if (!profile.id) {
      const newId = 'athlete_' + Math.random().toString(36).substr(2, 9);
      onUpdateProfile({ ...profile, id: newId });
    }
  }, []);

  // Manual Entry State
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 16));
  const [manualType, setManualType] = useState(WORKOUT_TYPES[0]);
  const [manualDuration, setManualDuration] = useState(30);
  const [manualComment, setManualComment] = useState('');

  // --- Achievements Logic ---

  // 1. Streak: Count how many 7-day streaks occurred
  const getStreakCount = () => {
    if (workouts.length === 0) return 0;
    
    // Get unique dates sorted ascending
    const uniqueDates = [...new Set(workouts.map(w => new Date(w.date).toDateString()))]
      .map((d: string) => new Date(d).getTime())
      .sort((a, b) => a - b);

    let total7DayStreaks = 0;
    let currentRun = 1;

    for (let i = 1; i < uniqueDates.length; i++) {
      // Check if dates are consecutive (difference is approx 1 day)
      const diff = (uniqueDates[i] - uniqueDates[i-1]) / (1000 * 60 * 60 * 24);
      
      if (Math.round(diff) === 1) {
        currentRun++;
      } else {
        // Gap detected, calculate streaks in the previous run
        total7DayStreaks += Math.floor(currentRun / 7);
        currentRun = 1;
      }
    }
    // Calculate streaks for the final run
    total7DayStreaks += Math.floor(currentRun / 7);
    
    return total7DayStreaks;
  };

  // 2. Month Fire: Count months with 20+ workouts
  const getMonthFireCount = () => {
    const months: Record<string, number> = {};
    workouts.forEach(w => {
      const d = new Date(w.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      months[key] = (months[key] || 0) + 1;
    });
    return Object.values(months).filter(count => count >= 20).length;
  };

  // 3. Morning: Count sets of 5 morning workouts
  const getMorningCount = () => {
    const morningWorkouts = workouts.filter(w => {
      const h = new Date(w.date).getHours();
      return h < 9;
    });
    return Math.floor(morningWorkouts.length / 5);
  };

  // 4. Total: Just check if >= 50
  const checkTotal = () => workouts.length >= 50;

  const streakCount = getStreakCount();
  const monthCount = getMonthFireCount();
  const morningCount = getMorningCount();

  const achievements = [
    { 
      id: 'streak', 
      title: '7 дней подряд', 
      desc: 'Тренировался 7 дней без перерыва', 
      unlocked: streakCount > 0, 
      count: streakCount,
      icon: '📅' 
    },
    { 
      id: 'month', 
      title: 'Месяц огня', 
      desc: '20+ тренировок за календарный месяц', 
      unlocked: monthCount > 0, 
      count: monthCount,
      icon: '📆' 
    },
    { 
      id: 'morning', 
      title: 'Утренняя зарядка', 
      desc: '5 тренировок до 9:00 утра', 
      unlocked: morningCount > 0, 
      count: morningCount,
      icon: '⏱️' 
    },
    { 
      id: 'champion', 
      title: 'Чемпион', 
      desc: 'Выиграл всероссийские соревнования', 
      unlocked: !!profile.manualAchievements?.champion, 
      icon: '🥇',
      manual: true,
      key: 'champion'
    },
    { 
      id: 'podium', 
      title: 'На пьедестале', 
      desc: 'Занял место в топ-3 на официальных соревнованиях', 
      unlocked: !!profile.manualAchievements?.podium, 
      icon: '🏅',
      manual: true,
      key: 'podium'
    },
    { 
      id: 'total', 
      title: 'Стабильность', 
      desc: '50+ завершённых тренировок всего', 
      unlocked: checkTotal(), 
      icon: '💪' 
    }
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateProfile({ ...profile, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleManualAchievement = (key: 'champion' | 'podium') => {
    const current = profile.manualAchievements || {};
    onUpdateProfile({
      ...profile,
      manualAchievements: {
        ...current,
        [key]: !current[key]
      }
    });
  };

  const saveManualWorkout = () => {
    const timestamp = new Date(manualDate).getTime();
    const workout: SavedWorkout = {
      id: 'manual-' + Date.now(),
      name: manualType,
      date: timestamp,
      cycles: 1,
      isManual: true,
      manualComment: manualComment,
      manualDurationMin: manualDuration,
      rounds: [{
        id: 'manual-r1',
        exerciseName: manualType,
        workDuration: manualDuration * 60,
        restDuration: 0
      }]
    };
    onAddManualWorkout(workout);
    setIsAddingManual(false);
    setManualComment('');
  };

  const handleLogout = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.confirm("Вы уверены, что хотите выйти? Это сбросит данные текущего профиля.")) {
          onLogout();
      }
  };
  
  const handleTrainerLoginClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onTrainerLogin();
  };

  // Combine real user with mock leaderboard for display
  const totalWorkouts = workouts.length;
  const combinedLeaderboard = [
    ...MOCK_LEADERBOARD.map(u => ({ ...u, isMe: false, avatar: u.avatar as string | null | undefined })),
    { name: profile.name || "Вы", workouts: totalWorkouts, avatar: profile.photo, isMe: true }
  ].sort((a,b) => b.workouts - a.workouts).slice(0, 10);

  // Generate QR Code URL
  // We use the ID if available, otherwise a placeholder to prevent broken image
  const qrId = profile.id || 'new-user';
  const qrName = profile.name || "Спортсмен";
  const qrData = JSON.stringify({
    id: qrId,
    name: qrName,
    photo: null // Don't put base64 in QR, too big
  });
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=000000&color=ffffff&margin=10&data=${encodeURIComponent(qrData)}`;

  return (
    <div className="fixed inset-0 z-[400] bg-black text-white flex flex-col overflow-hidden animate-step-enter">
      {/* HEADER */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#1c1c1e]">
        <h2 className="text-xl font-black uppercase tracking-wide">Личный кабинет</h2>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
        
        {/* PROFILE HEADER WITH QR */}
        <div className="flex flex-col items-center gap-4 bg-[#1c1c1e] p-4 rounded-2xl border border-white/5">
            <div className="flex items-start gap-4 w-full">
                {/* Avatar */}
                <div className="relative group flex-none">
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-24 h-24 rounded-full bg-[#333] border-2 border-white/20 flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#ff3d00] transition-colors"
                    >
                        {profile.photo ? (
                            <img src={profile.photo} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-white/30"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        )}
                    </div>
                    <div className="absolute bottom-0 right-0 bg-[#ff3d00] rounded-full p-1.5 border border-black cursor-pointer pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-black"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                    </div>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageUpload} 
                        accept="image/*" 
                        className="hidden" 
                    />
                </div>

                {/* Name & QR */}
                <div className="flex-1 flex flex-col gap-2">
                     <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Имя Фамилия</label>
                        <input 
                            type="text" 
                            value={profile.name || ''} 
                            onChange={(e) => onUpdateProfile({...profile, name: e.target.value})}
                            placeholder="Ваше имя"
                            className="bg-black/30 text-lg font-bold text-white focus:outline-none placeholder:text-white/10 p-2 rounded border border-white/10 focus:border-[#ff3d00] transition-colors"
                        />
                    </div>
                    
                    {/* Explicit QR Container */}
                    <div className="flex items-center gap-3 mt-1">
                        <div className="w-16 h-16 bg-white p-1 rounded-lg overflow-hidden flex-none">
                            <img src={qrUrl} alt="Athlete ID" className="w-full h-full object-contain" />
                        </div>
                        <div className="text-[10px] text-white/40 leading-tight">
                            Покажите этот QR-код тренеру для добавления в группу.
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full grid grid-cols-2 gap-3 mt-2">
                <div className="bg-black/30 p-3 rounded-xl border border-white/10 flex flex-col gap-1">
                    <label className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Рост (см)</label>
                    <input 
                        type="number" 
                        value={profile.height || ''} 
                        onChange={(e) => onUpdateProfile({...profile, height: parseInt(e.target.value) || 0})}
                        placeholder="0"
                        className="bg-transparent text-xl font-mono font-bold text-white focus:outline-none placeholder:text-white/10"
                    />
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/10 flex flex-col gap-1">
                    <label className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Вес (кг)</label>
                    <input 
                        type="number" 
                        value={profile.weight || ''} 
                        onChange={(e) => onUpdateProfile({...profile, weight: parseInt(e.target.value) || 0})}
                        placeholder="0"
                        className="bg-transparent text-xl font-mono font-bold text-white focus:outline-none placeholder:text-white/10"
                    />
                </div>
                <div className="col-span-2 bg-black/30 p-3 rounded-xl border border-white/10 flex flex-col gap-1">
                    <label className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Спортивный разряд</label>
                    <input 
                        type="text" 
                        value={profile.rank || ''} 
                        onChange={(e) => onUpdateProfile({...profile, rank: e.target.value})}
                        placeholder="Например: Мастер спорта России"
                        className="bg-transparent text-base font-bold text-white focus:outline-none placeholder:text-white/10 uppercase"
                    />
                </div>
                <div className="col-span-2 bg-black/30 p-3 rounded-xl border border-white/10 flex flex-col gap-1">
                    <label className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Спортивные достижения</label>
                    <textarea 
                        value={profile.achievementsDescription || ''} 
                        onChange={(e) => onUpdateProfile({...profile, achievementsDescription: e.target.value})}
                        placeholder="Например: 1 место — Всероссийские соревнования памяти сотрудников СК РФ 2025, Калининград"
                        rows={3}
                        className="bg-transparent text-sm text-white focus:outline-none placeholder:text-white/10 resize-none leading-relaxed"
                    />
                </div>
            </div>
        </div>

        {/* ACHIEVEMENTS */}
        <div className="flex flex-col gap-3">
            <h3 className="text-white/40 font-bold uppercase tracking-[0.2em] text-xs pl-1">Достижения</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {achievements.map((ach) => (
                    <div 
                        key={ach.id} 
                        className={`p-3 rounded-xl border flex items-start gap-3 transition-colors relative ${
                            ach.unlocked 
                            ? 'bg-gradient-to-br from-[#1c1c1e] to-[#2a2a2c] border-[#ff3d00]/30' 
                            : 'bg-[#111] border-white/5 opacity-60 grayscale'
                        } ${ach.manual ? 'cursor-pointer hover:border-white/20' : ''}`}
                        onClick={() => ach.manual && toggleManualAchievement(ach.key as any)}
                    >
                        <div className="text-3xl flex-none">{ach.icon}</div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h4 className={`text-sm font-bold uppercase truncate ${ach.unlocked ? 'text-white' : 'text-white/50'}`}>{ach.title}</h4>
                                {ach.unlocked ? (
                                    <>
                                        <span className="text-[#d4ff00] text-xs flex-none">✔</span>
                                        {ach.count && ach.count > 1 && (
                                            <span className="bg-white text-black px-1.5 rounded-sm text-[10px] font-bold leading-tight flex-none">{ach.count}×</span>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-white/20 text-xs flex-none">🔒</span>
                                )}
                            </div>
                            <p className="text-[10px] text-white/40 mt-1 leading-tight">{ach.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* MANUAL ENTRY */}
        <div className="flex flex-col gap-3">
             <h3 className="text-white/40 font-bold uppercase tracking-[0.2em] text-xs pl-1">История</h3>
             
             {!isAddingManual ? (
                 <button 
                    onClick={() => setIsAddingManual(true)}
                    className="w-full py-3 rounded-xl border border-dashed border-white/20 text-white/50 hover:text-white hover:border-[#ff3d00] hover:bg-white/5 transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                 >
                    <span>➕</span> Добавить тренировку вручную
                 </button>
             ) : (
                 <div className="bg-[#1c1c1e] p-4 rounded-xl border border-white/10 flex flex-col gap-3 animate-step-enter">
                    <div className="flex justify-between items-center">
                         <h4 className="text-sm font-bold text-white uppercase">Новая запись</h4>
                         <button onClick={() => setIsAddingManual(false)} className="text-white/30 hover:text-white">✕</button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-white/40 uppercase font-bold">Дата</label>
                            <input type="datetime-local" value={manualDate} onChange={e => setManualDate(e.target.value)} className="bg-black/30 border border-white/10 rounded p-2 text-xs text-white focus:border-[#ff3d00] outline-none" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-white/40 uppercase font-bold">Тип</label>
                            <select value={manualType} onChange={e => setManualType(e.target.value)} className="bg-black/30 border border-white/10 rounded p-2 text-xs text-white focus:border-[#ff3d00] outline-none">
                                {WORKOUT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-white/40 uppercase font-bold">Длительность (мин)</label>
                        <input type="number" value={manualDuration} onChange={e => setManualDuration(parseInt(e.target.value))} className="bg-black/30 border border-white/10 rounded p-2 text-sm text-white focus:border-[#ff3d00] outline-none" />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-white/40 uppercase font-bold">Комментарий</label>
                        <input type="text" value={manualComment} onChange={e => setManualComment(e.target.value)} placeholder="Как прошла тренировка?" className="bg-black/30 border border-white/10 rounded p-2 text-sm text-white focus:border-[#ff3d00] outline-none" />
                    </div>

                    <button onClick={saveManualWorkout} className="w-full py-2 bg-[#ff3d00] text-black font-black uppercase text-xs rounded-lg hover:bg-[#ff5e2b] mt-2">Сохранить</button>
                 </div>
             )}
        </div>

        {/* LEADERBOARD */}
        <div className="flex flex-col gap-3">
            <h3 className="text-white/40 font-bold uppercase tracking-[0.2em] text-xs pl-1">Рейтинг спортсменов</h3>
            <div className="bg-[#1c1c1e] rounded-xl border border-white/10 overflow-hidden">
                {combinedLeaderboard.map((user, idx) => (
                    <div 
                        key={idx} 
                        className={`flex items-center gap-3 p-3 border-b border-white/5 last:border-0 ${user.isMe ? 'bg-[#ff3d00]/10' : ''}`}
                    >
                        <div className="w-6 text-center text-xs font-mono font-bold text-white/30">{idx + 1}</div>
                        <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center ${user.isMe ? 'border border-[#ff3d00]' : 'bg-white/10'}`}>
                            {user.avatar ? (
                                <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                            ) : (
                                <span className="text-xs">🥋</span>
                            )}
                        </div>
                        <div className="flex-1">
                            <div className={`text-sm font-bold ${user.isMe ? 'text-[#ff3d00]' : 'text-white'}`}>{user.name}</div>
                        </div>
                        <div className="text-xs font-mono text-white/60">
                            <span className="text-white font-bold">{user.workouts}</span> Трен.
                        </div>
                    </div>
                ))}
            </div>
        </div>
        
        {/* FOOTER ACTIONS */}
        <div className="flex flex-col gap-3 pt-6 border-t border-white/5 mt-4">
             <button 
                type="button"
                onClick={handleTrainerLoginClick}
                className="w-full py-3 bg-[#1c1c1e] border border-white/10 text-white/50 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-white/5 hover:text-white transition-colors active:scale-[0.98]"
             >
                Вход как тренер
             </button>
             <button 
                type="button"
                onClick={handleLogout}
                className="w-full py-3 text-red-500/50 hover:text-red-500 text-xs font-bold uppercase tracking-widest transition-colors active:scale-[0.98]"
             >
                Сбросить профиль (Выйти)
             </button>
        </div>

      </div>
    </div>
  );
};