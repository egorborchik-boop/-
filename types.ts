export enum Phase {
  PREPARE = 'PREPARE',
  WORK = 'WORK',
  REST = 'REST',
  COMPLETE = 'COMPLETE'
}

export enum TimerStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED'
}

export interface Round {
  id: string;
  exerciseName: string;
  workDuration: number; // in seconds
  restDuration: number; // in seconds
  customAudio?: string; // base64 encoded audio
  ttsEnabled?: boolean; // Text-to-speech enabled flag
  instructions?: string[]; // Optional list of preparation steps
}

export interface SavedWorkout {
  id: string;
  name: string;
  date: number;
  rounds: Round[];
  cycles?: number; // Number of times to repeat the rounds
  isManual?: boolean; // Flag for manually entered workouts
  manualComment?: string;
  manualDurationMin?: number;
}

export interface UserProfile {
  id: string; // UUID for athlete identification
  photo?: string; // Base64 image
  name?: string;
  height?: number; // cm
  weight?: number; // kg
  rank?: string; // e.g. "Мастер спорта"
  achievementsDescription?: string; // Text field for custom achievements
  manualAchievements?: {
    champion?: boolean;
    podium?: boolean;
  };
}

export interface Student {
  id: string;
  name: string;
  photo?: string;
  lastWorkoutDate: number;
}

export interface Assessment {
  rating: number; // 1-5
  comment: string;
}

export interface TrainerData {
  students: Student[];
  assessments: Record<string, Record<string, Assessment>>; // studentId -> workoutId -> Assessment
}