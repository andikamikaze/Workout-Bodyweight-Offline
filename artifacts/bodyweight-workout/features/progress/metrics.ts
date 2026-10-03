import { BMIStandard, Exercise, MuscleId, WorkoutSession } from '@/src/types';

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekdayFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekdayFromMonday);
  return start;
}

export function getDailyStreak(sessions: WorkoutSession[], now = new Date()) {
  const completedDays = new Set(
    sessions.map((session) => localDateKey(new Date(session.completedAt))),
  );
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!completedDays.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (completedDays.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function calculateBmi(weightKg: number, heightCm: number) {
  if (weightKg <= 0 || heightCm <= 0) return 0;
  const heightMeters = heightCm / 100;
  return Math.round((weightKg / (heightMeters * heightMeters)) * 10) / 10;
}

export type BmiCategory =
  | 'severe-underweight'
  | 'underweight'
  | 'normal'
  | 'mild-overweight'
  | 'severe-overweight';

export function bmiCategory(value: number, standard: BMIStandard): BmiCategory {
  if (standard === 'asia-pacific') {
    if (value < 18.5) return 'underweight';
    if (value <= 22.9) return 'normal';
    if (value <= 24.9) return 'mild-overweight';
    if (value <= 29.9) return 'severe-overweight';
    return 'severe-overweight';
  }
  if (value < 17) return 'severe-underweight';
  if (value < 18.5) return 'underweight';
  if (value <= 25) return 'normal';
  if (value <= 27) return 'mild-overweight';
  return 'severe-overweight';
}

export function healthyWeightRange(heightCm: number, standard: BMIStandard) {
  const heightMeters = heightCm / 100;
  const maxBmi = standard === 'asia-pacific' ? 22.9 : 25;
  return {
    min: 18.5 * heightMeters * heightMeters,
    max: maxBmi * heightMeters * heightMeters,
  };
}

export function formatDate(date: Date, language: 'id' | 'en', options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-US', options).format(date);
}

export function muscleSessionCounts(
  sessions: WorkoutSession[],
  muscleIds: MuscleId[],
  since: Date,
) {
  const counts = new Map<MuscleId, number>(muscleIds.map((id) => [id, 0]));
  sessions
    .filter((session) => new Date(session.completedAt) >= since)
    .forEach((session) => {
      session.focusAreas.forEach((muscle) => {
        counts.set(muscle, (counts.get(muscle) ?? 0) + 1);
      });
    });
  return counts;
}

export interface MaxMark {
  value: number;
  date: string | null;
}

export interface PersonalRecord {
  exerciseId: string;
  maxReps: MaxMark;
  maxSeconds: MaxMark;
  totalSets: number;
}

/**
 * Personal records per exerciseId, reps dan seconds dipisah
 * agar tidak tercampur (hold 60s tidak dibandingkan dengan 12 reps).
 */
export function getPersonalRecords(sessions: WorkoutSession[]): PersonalRecord[] {
  const records = new Map<string, PersonalRecord>();
  const ensure = (exerciseId: string): PersonalRecord => {
    const existing = records.get(exerciseId);
    if (existing) return existing;
    const created: PersonalRecord = {
      exerciseId,
      maxReps: { value: 0, date: null },
      maxSeconds: { value: 0, date: null },
      totalSets: 0,
    };
    records.set(exerciseId, created);
    return created;
  };
  sessions.forEach((session) => {
    const date = session.completedAt;
    session.completedSets.forEach((set) => {
      if (!set.exerciseId) return;
      const record = ensure(set.exerciseId);
      record.totalSets += 1;
      if (set.reps > 0 && set.reps > record.maxReps.value) {
        record.maxReps = { value: set.reps, date };
      }
      if (set.seconds > 0 && set.seconds > record.maxSeconds.value) {
        record.maxSeconds = { value: set.seconds, date };
      }
    });
  });
  return [...records.values()];
}

export interface LevelUpEvent {
  exerciseId: string;
  fromId: string;
  fromName: string;
  toName: string;
  date: string;
}

/**
 * Deteksi level-up: sesi menyelesaikan varian harder dari rantai
 * progresi (easierId → harderId) yang sebelumnya belum pernah selesai,
 * sementara salah satu ancestor easier-nya sudah pernah selesai.
 * Urutan sesi diurut kronologis naik; hasil terbaru dulu.
 */
export function detectLevelUp(
  sessions: WorkoutSession[],
  exercises: Exercise[],
): LevelUpEvent[] {
  if (!sessions.length || !exercises.length) return [];
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const sorted = [...sessions].sort(
    (left, right) => new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime(),
  );
  const completed = new Set<string>();
  const events: LevelUpEvent[] = [];
  sorted.forEach((session) => {
    const idsInSession = new Set<string>();
    session.completedSets.forEach((set) => {
      if (set.exerciseId) idsInSession.add(set.exerciseId);
    });
    if (idsInSession.size === 0) {
      session.exerciseIds.forEach((id) => idsInSession.add(id));
    }
    const newIds = [...idsInSession].filter((id) => !completed.has(id));
    newIds.forEach((id) => {
      const exercise = byId.get(id);
      if (!exercise) return;
      let cursor: string | undefined = exercise.easierId;
      const visited = new Set<string>();
      let from: Exercise | undefined;
      while (cursor && !visited.has(cursor)) {
        visited.add(cursor);
        if (completed.has(cursor)) {
          from = byId.get(cursor);
          break;
        }
        cursor = byId.get(cursor)?.easierId;
      }
      if (from) {
        events.push({
          exerciseId: id,
          fromId: from.id,
          fromName: from.name,
          toName: exercise.name,
          date: session.completedAt,
        });
      }
    });
    newIds.forEach((id) => completed.add(id));
  });
  return events.sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
}

export function last30DaysSince(now = new Date()) {
  const since = new Date(now);
  since.setDate(since.getDate() - 29);
  return since;
}

export function getNeglectedMuscles(counts: Map<MuscleId, number>): MuscleId[] {
  return [...counts.entries()].filter(([, count]) => count === 0).map(([id]) => id);
}

export interface MuscleDistribution {
  counts: Map<MuscleId, number>;
  sortedIds: MuscleId[];
  neglectedIds: MuscleId[];
  max: number;
}

/** Distribusi otot 30 hari terakhir + neglected list. */
export function getMuscleDistribution(
  sessions: WorkoutSession[],
  muscleIds: MuscleId[],
  since: Date = last30DaysSince(),
): MuscleDistribution {
  const counts = muscleSessionCounts(sessions, muscleIds, since);
  const sortedIds = [...muscleIds].sort((left, right) => (counts.get(right) ?? 0) - (counts.get(left) ?? 0));
  return {
    counts,
    sortedIds,
    neglectedIds: getNeglectedMuscles(counts),
    max: Math.max(1, ...[...counts.values()]),
  };
}