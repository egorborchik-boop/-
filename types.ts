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
}

export interface SavedWorkout {
  id: string;
  name: string;
  date: number;
  rounds: Round[];
  cycles?: number; // Number of times to repeat the rounds
}