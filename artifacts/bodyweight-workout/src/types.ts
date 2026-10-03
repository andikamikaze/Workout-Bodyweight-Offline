export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type WorkoutGoal = 'weight-loss' | 'muscle' | 'fitness';
export type Gender = 'female' | 'male';
export type Furniture = 'chair' | 'wall' | 'towel';
export type MuscleId =
  | 'chest'
  | 'shoulders'
  | 'biceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'back'
  | 'traps'
  | 'triceps'
  | 'lower-back'
  | 'glutes'
  | 'hamstrings'
  | 'calves';
export type WorkoutPhase = 'warm-up' | 'training' | 'cooldown';
export type Measurement = 'reps' | 'seconds';
export type Impact = 'low' | 'high';
export type WorkoutLevel = Experience;
export type DifficultyRating = 'easy' | 'just-right' | 'hard';
export type BMIStandard = 'kemenkes' | 'asia-pacific';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserProfile {
  name: string;
  gender: Gender;
  birthDate: string;
  heightCm: number;
  weightKg: number;
  goal: WorkoutGoal;
  experience: Experience;
  furniture: Furniture[];
  parqRisk: boolean;
  medicalDisclaimerAccepted: boolean;
}

export interface AppSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  keepScreenAwake: boolean;
  allowedFurniture: Furniture[];
  silentMode: boolean;
  bmiStandard: BMIStandard;
  units: 'metric' | 'imperial';
  language: 'id' | 'en';
  theme: ThemeMode;
  weeklyGoal: number;
  reminderEnabled: boolean;
  reminderTime: string;
}

export interface Exercise {
  id: string;
  name: string;
  englishName: string;
  phase: WorkoutPhase;
  primaryMuscles: MuscleId[];
  secondaryMuscles: MuscleId[];
  levelMin: WorkoutLevel;
  furniture: Furniture[];
  measurement: Measurement;
  impact: Impact;
  category: 'push' | 'pull' | 'legs' | 'core' | 'mobility' | 'conditioning';
  unilateral?: boolean;
  defaultSets: number;
  targetReps?: number;
  targetSeconds?: number;
  restSeconds: number;
  met: number;
  easierId?: string;
  harderId?: string;
  instructions: string[];
  tips: string[];
  frameOne: string;
  frameTwo: string;
}

export interface PlannedExercise {
  exerciseId: string;
  sets: number;
  targetReps?: number;
  targetSeconds?: number;
  restSeconds: number;
}

export interface WorkoutPlan {
  id: string;
  title: string;
  focusAreas: MuscleId[];
  level: WorkoutLevel;
  durationMinutes: 15 | 30 | 45 | 60;
  silentMode: boolean;
  createdAt: string;
  warmup: PlannedExercise[];
  training: PlannedExercise[];
  cooldown: PlannedExercise[];
}

export interface ActiveWorkout {
  plan: WorkoutPlan;
  startedAt: string;
  sessionStartedAt?: string;
  pausedAt: string | null;
  elapsedSeconds: number;
  phase: WorkoutPhase;
  exerciseIndex: number;
  setIndex: number;
  restSecondsLeft: number | null;
  restEndsAt?: number | null;
  exerciseEndsAt?: number | null;
  exerciseSecondsAtPause?: number | null;
  completedSets: Array<{
    exerciseId: string;
    setIndex: number;
    reps: number;
    seconds: number;
    side?: 'left' | 'right';
    rating?: DifficultyRating;
  }>;
}

export interface WorkoutSession {
  id: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  focusAreas: MuscleId[];
  level: WorkoutLevel;
  totalSets: number;
  totalReps: number;
  calories: number;
  effort: DifficultyRating;
  exerciseIds: string[];
  completedSets: ActiveWorkout['completedSets'];
}

export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
  bmi: number;
}

export interface AppSnapshot {
  schemaVersion: 1;
  profile: UserProfile | null;
  settings: AppSettings;
  sessions: WorkoutSession[];
  weightEntries: WeightEntry[];
  savedPlans: WorkoutPlan[];
  currentPlan: WorkoutPlan | null;
  activeWorkout: ActiveWorkout | null;
}

export interface BackupFile {
  app: 'bodyweight-workout';
  schemaVersion: 1;
  exportedAt: string;
  data: AppSnapshot;
}