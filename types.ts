export enum Tab {
  HEALTH = 'Health',
  STRENGTH = 'Strength',
  CYCLING = 'Cycling',
  STARTUP = 'Startup',
  PROJECTS = 'Personal Projects'
}

export interface HealthMetric {
  id?: string;
  date: any; // Firestore Timestamp or string for display
  recovery: number;
  strain: number;
  hrv: number;
  sleepPerformance: number;
}

export interface WorkoutSession {
  id?: string;
  date: any;
  plan: 'PPL' | 'UpperLower' | 'FullBody';
  exercises: ExerciseLog[];
  userId: string;
}

export interface ExerciseLog {
  name: string;
  sets: number;
  reps: number;
  weight: number;
}

export interface CyclingDataPoint {
  time: number; // seconds from start
  elevation: number; // meters
  speed: number; // km/h
  power: number; // watts
  heartRate: number; // bpm
  distance: number; // km accumulated
  lat?: number;
  lon?: number;
}

export interface StartupPost {
  id?: string;
  date: any; // Firestore Timestamp
  title: string;
  content: string;
  tags: string[];
  imageUrl?: string;
}

export interface Comment {
  id?: string;
  contextId: string; // which tab/project it belongs to
  author: string;
  text: string;
  date: any;
}

export interface ProjectItem {
  id?: string;
  title: string;
  description: string;
  type: 'chess' | 'coding' | 'other';
  config?: {
    chessUsername?: string;
    repoUrl?: string;
  };
}

export interface ChessStats {
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}