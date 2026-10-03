import { EXERCISES } from '@/src/data/exercises';
import { MUSCLES, MUSCLE_PRESETS } from '@/src/data/muscles';
import {
  Exercise,
  Furniture,
  MuscleId,
  PlannedExercise,
  WorkoutPlan,
  WorkoutLevel,
  WorkoutSession,
} from '@/src/types';
import { createId } from '@/src/utils';

export interface PlanGeneratorOptions {
  focusAreas: MuscleId[];
  level: WorkoutLevel;
  durationMinutes: WorkoutPlan['durationMinutes'];
  allowedFurniture: Furniture[];
  silentMode: boolean;
  language: 'id' | 'en';
  /** Riwayat sesi untuk adaptasi (FR-03.3). Opsional, tidak mengubah hasil default. */
  sessionHistory?: WorkoutSession[];
}

const LEVEL_RANK: Record<WorkoutLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

function focusName(focusAreas: MuscleId[], language: 'id' | 'en') {
  const preset = Object.entries(MUSCLE_PRESETS).find(
    ([, definition]) =>
      definition.areas.length === focusAreas.length &&
      definition.areas.every((area) => focusAreas.includes(area)),
  );
  if (preset) {
    const labels: Record<string, [string, string]> = {
      full: ['Seluruh tubuh', 'Full body'],
      upper: ['Tubuh atas', 'Upper body'],
      lower: ['Tubuh bawah', 'Lower body'],
      core: ['Core', 'Core'],
    };
    return labels[preset[0]]?.[language === 'id' ? 0 : 1] ?? preset[1].label;
  }
  const labels = focusAreas
    .map((id) => MUSCLES.find((muscle) => muscle.id === id))
    .filter((muscle) => muscle !== undefined)
    .map((muscle) => language === 'id' ? muscle.label : muscle.englishLabel);
  return labels.join(' · ') || (language === 'id' ? 'Seluruh tubuh' : 'Full body');
}

function exerciseSeconds(exercise: Exercise, planned: PlannedExercise) {
  const workPerSet =
    planned.targetSeconds ??
    exercise.targetSeconds ??
    (planned.targetReps ?? exercise.targetReps ?? 10) * 3;
  const sides = exercise.unilateral ? 2 : 1;
  return (
    workPerSet * planned.sets * sides +
    Math.max(0, planned.sets - 1) * planned.restSeconds +
    8
  );
}

function phaseSelection(
  phase: 'warm-up' | 'cooldown',
  focusAreas: MuscleId[],
  count: number,
  allowedFurniture: Furniture[],
): PlannedExercise[] {
  const candidates = EXERCISES.filter(
    (exercise) =>
      exercise.phase === phase &&
      exercise.furniture.every((item) => allowedFurniture.includes(item)),
  );
  const used = new Set<string>();
  const focusUse = new Map<MuscleId, number>();
  const result: PlannedExercise[] = [];

  while (result.length < count) {
    const available = candidates.filter((exercise) => !used.has(exercise.id));
    if (!available.length) break;
    available.sort((a, b) => scorePhase(b) - scorePhase(a));
    const bestScore = scorePhase(available[0]);
    const tied = available.filter((exercise) => scorePhase(exercise) === bestScore);
    const picked = tied[Math.floor(Math.random() * tied.length)] ?? available[0];
    used.add(picked.id);
    picked.primaryMuscles.forEach((muscle) => {
      if (focusAreas.includes(muscle)) {
        focusUse.set(muscle, (focusUse.get(muscle) ?? 0) + 1);
      }
    });
    result.push({
      exerciseId: picked.id,
      sets: 1,
      targetSeconds: picked.targetSeconds ?? 30,
      restSeconds: 0,
    });
  }
  return result;

  function scorePhase(exercise: Exercise) {
    const matches = exercise.primaryMuscles.filter((muscle) => focusAreas.includes(muscle));
    const secondaryMatches = exercise.secondaryMuscles.filter((muscle) => focusAreas.includes(muscle));
    const balance = matches.reduce((sum, muscle) => sum - (focusUse.get(muscle) ?? 0), 0);
    return matches.length * 10 + secondaryMatches.length * 2 + balance;
  }
}

function trainingCandidates(options: PlanGeneratorOptions) {
  return EXERCISES.filter((exercise) => {
    if (exercise.phase !== 'training') return false;
    if (LEVEL_RANK[exercise.levelMin] > LEVEL_RANK[options.level]) return false;
    if (!exercise.furniture.every((item) => options.allowedFurniture.includes(item))) return false;
    if (options.silentMode && exercise.impact === 'high') return false;
    return exercise.primaryMuscles.some((muscle) => options.focusAreas.includes(muscle));
  });
}

// ── FR-03.3 adaptif: saran progresi dari 3 sesi terakhir ──────────────────────

export interface RecentEffortCount {
  easy: number;
  hard: number;
  total: number;
}

/** Hitung effort 3 sesi terakhir yang memuat exerciseId (untuk pesan saran). */
export function countRecentEffort(
  exerciseId: string,
  sessions: WorkoutSession[] | undefined | null,
): RecentEffortCount {
  if (!sessions?.length) return { easy: 0, hard: 0, total: 0 };
  const relevant = sessions
    .filter(
      (session) =>
        session.exerciseIds?.includes(exerciseId) ||
        session.completedSets?.some((entry) => entry.exerciseId === exerciseId),
    )
    .slice()
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))
    .slice(0, 3);
  let easy = 0;
  let hard = 0;
  relevant.forEach((session) => {
    const ratings = (session.completedSets ?? [])
      .filter((entry) => entry.exerciseId === exerciseId && entry.rating)
      .map((entry) => entry.rating as string);
    let derived: string | undefined;
    if (ratings.length) {
      const easyVotes = ratings.filter((rating) => rating === 'easy').length;
      const hardVotes = ratings.filter((rating) => rating === 'hard').length;
      if (easyVotes > hardVotes && easyVotes >= Math.ceil(ratings.length / 2)) derived = 'easy';
      else if (hardVotes > easyVotes && hardVotes >= Math.ceil(ratings.length / 2)) derived = 'hard';
      else if (easyVotes === 0 && hardVotes === 0) derived = session.effort;
      else derived = 'just-right';
    } else {
      derived = session.effort;
    }
    if (derived === 'easy') easy += 1;
    else if (derived === 'hard') hard += 1;
  });
  return { easy, hard, total: relevant.length };
}

/**
 * FR-03.3: baca 3 sesi terakhir untuk satu latihan.
 * - effort easy ≥3x → return harderId (naik level)
 * - effort hard ≥2x → return easierId (turun level)
 * - else null (tidak ada saran, pilihan tidak diubah otomatis)
 */
export function suggestProgression(
  exerciseId: string,
  sessions: WorkoutSession[] | undefined | null,
): string | null {
  const exercise = EXERCISES.find((item) => item.id === exerciseId);
  if (!exercise) return null;
  const { easy, hard } = countRecentEffort(exerciseId, sessions);
  if (easy >= 3 && exercise.harderId) {
    return EXERCISES.some((item) => item.id === exercise.harderId) ? exercise.harderId : null;
  }
  if (hard >= 2 && exercise.easierId) {
    return EXERCISES.some((item) => item.id === exercise.easierId) ? exercise.easierId : null;
  }
  return null;
}

// ── FR-04.8 Full Body eksplisit ───────────────────────────────────────────────

export const FULL_BODY_REQUIRED_CATEGORIES = ['push', 'pull', 'legs', 'core'] as const;

/** True bila focusAreas = preset full, atau ≥4 area lintas upper/lower/core. */
export function isFullBodyRequest(focusAreas: MuscleId[]): boolean {
  const fullAreas = MUSCLE_PRESETS.full.areas;
  if (
    focusAreas.length === fullAreas.length &&
    fullAreas.every((area) => focusAreas.includes(area))
  ) {
    return true;
  }
  if (focusAreas.length >= 4) {
    const groups = new Set(
      MUSCLES.filter((muscle) => focusAreas.includes(muscle.id)).map((muscle) => muscle.group),
    );
    if (groups.has('upper') && groups.has('lower') && groups.has('core')) return true;
  }
  return false;
}

function buildPlannedFromExercise(picked: Exercise): PlannedExercise {
  return {
    exerciseId: picked.id,
    sets: picked.defaultSets,
    ...(picked.measurement === 'reps'
      ? { targetReps: picked.targetReps ?? 10 }
      : { targetSeconds: picked.targetSeconds ?? 30 }),
    restSeconds: picked.restSeconds,
  };
}

/**
 * Pasca-pass Full Body: pastikan training memuat minimal 1 push + 1 pull +
 * 1 legs + 1 core bila kandidat tersedia. Kategori yang kurang ditutup dengan
 * menukar 1 latihan terlemah (kategori yang sudah >1) dengan kandidat kategori
 * yang kurang. Mempertahankan anti-duplikat via `used`.
 */
export function ensureFullBodyBalance(
  training: PlannedExercise[],
  candidates: Exercise[],
  used: Set<string>,
): PlannedExercise[] {
  if (training.length < 2) return training;
  const exerciseById = new Map(EXERCISES.map((item) => [item.id, item]));
  const present = new Set(
    training
      .map((item) => exerciseById.get(item.exerciseId)?.category)
      .filter((category): category is Exercise['category'] => category !== undefined),
  );
  const missing = FULL_BODY_REQUIRED_CATEGORIES.filter((category) => !present.has(category));
  if (!missing.length) return training;

  const result = [...training];
  missing.forEach((needed) => {
    const pool = candidates.filter(
      (candidate) => candidate.category === needed && !used.has(candidate.id),
    );
    if (!pool.length) return;
    // Random tie-break di antara kandidat seimbang: acak lalu pilih yang
    // paling cocok level/fokus agar stabil tapi tidak deterministik kaku.
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picked = shuffled[0];

    // Cari indeks terlemah untuk ditukar: utamakan kategori yang sudah >1
    // agar tidak menghilangkan satu-satunya wakil kategori lain.
    const counts = new Map<string, number>();
    result.forEach((item) => {
      const category = exerciseById.get(item.exerciseId)?.category ?? 'mobility';
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });
    let weakestIndex = -1;
    let weakestScore = Number.POSITIVE_INFINITY;
    result.forEach((item, index) => {
      const current = exerciseById.get(item.exerciseId);
      if (!current) return;
      const overRepresented = (counts.get(current.category) ?? 0) > 1;
      // Skor kecocokan fokus: makin kecil makin lemah (kandidat tukar).
      // Beri penalti kecil bila kategorinya satu-satunya wakil.
      const focusMatches = current.primaryMuscles.length;
      const score = focusMatches + (overRepresented ? 0 : 100);
      if (score < weakestScore) {
        weakestScore = score;
        weakestIndex = index;
      }
    });
    if (weakestIndex < 0) return;
    const removed = result[weakestIndex];
    used.delete(removed.exerciseId);
    used.add(picked.id);
    result[weakestIndex] = buildPlannedFromExercise(picked);
    present.add(needed);
  });
  return result;
}

export function generateWorkoutPlan(options: PlanGeneratorOptions): WorkoutPlan {
  const focusAreas = [...new Set(options.focusAreas)];
  const warmCount = options.durationMinutes === 15 ? 2 : options.durationMinutes < 60 ? 3 : 4;
  const cooldownCount = options.durationMinutes <= 15 ? 2 : options.durationMinutes < 60 ? 3 : 4;
  const warmup = phaseSelection('warm-up', focusAreas, warmCount, options.allowedFurniture);
  const cooldown = phaseSelection('cooldown', focusAreas, cooldownCount, options.allowedFurniture);
  const candidates = trainingCandidates({ ...options, focusAreas });
  const used = new Set<string>();
  const areaUse = new Map<MuscleId, number>();
  const categoryUse = new Map<Exercise['category'], number>();
  const training: PlannedExercise[] = [];

  const fixedSeconds =
    warmup.reduce((sum, item) => {
      const exercise = EXERCISES.find((entry) => entry.id === item.exerciseId);
      return sum + (item.targetSeconds ?? 30) + 8 + (exercise?.furniture.length ? 0 : 0);
    }, 0) +
    cooldown.reduce((sum, item) => sum + (item.targetSeconds ?? 30) + 8, 0);
  const trainingBudget = Math.max(
    180,
    options.durationMinutes * 60 - fixedSeconds - 25,
  );
  let trainingSeconds = 0;
  const maximumExercises = Math.min(18, Math.max(2, Math.ceil(trainingBudget / 150)));

  while (training.length < maximumExercises) {
    const available = candidates.filter((exercise) => !used.has(exercise.id));
    if (!available.length) break;
    available.sort(
      (a, b) =>
        scoreTraining(b) - scoreTraining(a) ||
        Math.random() - 0.5,
    );
    const picked = available[0];
    const planned: PlannedExercise = {
      exerciseId: picked.id,
      sets: picked.defaultSets,
      ...(picked.measurement === 'reps'
        ? { targetReps: picked.targetReps ?? 10 }
        : { targetSeconds: picked.targetSeconds ?? 30 }),
      restSeconds: picked.restSeconds,
    };
    const cost = exerciseSeconds(picked, planned);
    if (training.length >= 2 && trainingSeconds + cost > trainingBudget * 1.08) break;

    used.add(picked.id);
    training.push(planned);
    trainingSeconds += cost;
    picked.primaryMuscles.forEach((muscle) => {
      if (focusAreas.includes(muscle)) {
        areaUse.set(muscle, (areaUse.get(muscle) ?? 0) + 1);
      }
    });
    categoryUse.set(picked.category, (categoryUse.get(picked.category) ?? 0) + 1);
  }

  if (!training.length && candidates.length) {
    const first = candidates[0];
    used.add(first.id);
    training.push({
      exerciseId: first.id,
      sets: first.defaultSets,
      ...(first.measurement === 'reps'
        ? { targetReps: first.targetReps ?? 10 }
        : { targetSeconds: first.targetSeconds ?? 30 }),
      restSeconds: first.restSeconds,
    });
  }

  // FR-04.8 pasca-pass Full Body: tukar 1 latihan terlemah bila ada kategori
  // push/pull/legs/core yang hilang (hanya bila kandidat tersedia).
  let finalTraining = training;
  if (isFullBodyRequest(focusAreas)) {
    finalTraining = ensureFullBodyBalance(training, candidates, used);
  }

  const now = new Date().toISOString();
  const durationLabel = `${options.durationMinutes} ${options.language === 'id' ? 'menit' : 'min'}`;
  const focus = focusName(focusAreas, options.language);
  return {
    id: createId(),
    title: options.language === 'id' ? `${focus} · ${durationLabel}` : `${focus} · ${durationLabel}`,
    focusAreas,
    level: options.level,
    durationMinutes: options.durationMinutes,
    silentMode: options.silentMode,
    createdAt: now,
    warmup,
    training: finalTraining,
    cooldown,
  };

  function scoreTraining(exercise: Exercise) {
    const matches = exercise.primaryMuscles.filter((muscle) => focusAreas.includes(muscle));
    const secondaryMatches = exercise.secondaryMuscles.filter((muscle) => focusAreas.includes(muscle));
    const balance = matches.reduce((sum, muscle) => sum - (areaUse.get(muscle) ?? 0) * 2, 0);
    const levelFit = 4 - Math.abs(LEVEL_RANK[options.level] - LEVEL_RANK[exercise.levelMin]);
    const categoryBalance = -(categoryUse.get(exercise.category) ?? 0);
    return matches.length * 12 + secondaryMatches.length * 3 + balance + levelFit + categoryBalance;
  }
}