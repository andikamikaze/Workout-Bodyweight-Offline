import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { ActionButton, AppScreen, Surface } from '@/components/WorkoutUI';
import { useColors } from '@/hooks/useColors';
import { tx } from '@/src/i18n';
import { playBeepTick, playPhaseChime } from '@/src/features/workout/sound';
import {
  clearWorkoutNotification,
  ensureWorkoutNotifications,
  subscribeWorkoutNotificationActions,
  updateWorkoutNotification,
} from '@/src/features/workout/notifications';
import { useApp } from '@/src/store/AppContext';
import {
  ActiveWorkout,
  DifficultyRating,
  Exercise,
  PlannedExercise,
  WorkoutPhase,
  WorkoutPlan,
  WorkoutSession,
} from '@/src/types';
import { createId, formatDuration } from '@/src/utils';
import { EXERCISES } from '@/src/data/exercises';

type ExtendedWorkout = ActiveWorkout & {
  sessionStartedAt?: string;
  exerciseEndsAt?: number | null;
  restEndsAt?: number | null;
  exerciseSecondsAtPause?: number | null;
};

interface PlannedItem {
  phase: WorkoutPhase;
  planned: PlannedExercise;
  exercise?: Exercise;
}

const phaseLabel = (phase: WorkoutPhase, language: 'id' | 'en') => {
  if (phase === 'warm-up') return tx(language, 'Pemanasan', 'Warm-up');
  if (phase === 'cooldown') return tx(language, 'Pendinginan', 'Cooldown');
  return tx(language, 'Latihan utama', 'Training');
};

function planItems(plan: WorkoutPlan): PlannedItem[] {
  const phases: Array<{ phase: WorkoutPhase; planned: PlannedExercise[] }> = [
    { phase: 'warm-up', planned: plan.warmup },
    { phase: 'training', planned: plan.training },
    { phase: 'cooldown', planned: plan.cooldown },
  ];
  const exerciseIndex = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));
  return phases.flatMap(({ phase, planned }) =>
    planned.map((item) => ({
      phase,
      planned: item,
      exercise: exerciseIndex.get(item.exerciseId),
    })),
  );
}

function createWorkout(plan: WorkoutPlan, item: PlannedItem): ExtendedWorkout {
  const now = Date.now();
  const startedAt = new Date(now).toISOString();
  const timed = item.exercise?.measurement === 'seconds' || item.planned.targetSeconds !== undefined;
  const seconds = item.planned.targetSeconds ?? item.exercise?.targetSeconds ?? 30;
  return {
    plan,
    startedAt,
    sessionStartedAt: startedAt,
    pausedAt: null,
    elapsedSeconds: 0,
    phase: item.phase,
    exerciseIndex: 0,
    setIndex: 0,
    restSecondsLeft: null,
    restEndsAt: null,
    exerciseEndsAt: timed ? now + seconds * 1000 : null,
    exerciseSecondsAtPause: null,
    completedSets: [],
  };
}

function elapsedFor(active: ExtendedWorkout, now: number) {
  if (active.pausedAt) return Math.max(0, Math.floor(active.elapsedSeconds));
  const segmentStart = Date.parse(active.startedAt);
  return Math.max(
    0,
    Math.floor(active.elapsedSeconds + (Number.isNaN(segmentStart) ? 0 : (now - segmentStart) / 1000)),
  );
}

function signedName(item?: PlannedItem) {
  if (!item) return '';
  return item.exercise?.name ?? item.planned.exerciseId.replace(/[-_]/g, ' ');
}

function ExerciseIllustration({
  item,
  colors,
  frame,
}: {
  item: PlannedItem;
  colors: ReturnType<typeof useColors>;
  frame: number;
}) {
  const isLeg = item.exercise?.category === 'legs';
  const isCore = item.exercise?.category === 'core';
  const isPull = item.exercise?.category === 'pull';
  const start = frame === 0;

  if (isLeg) {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 320 160" accessibilityLabel={`${signedName(item)} illustration`}>
        <Rect width="320" height="160" rx="22" fill={colors.secondary} />
        <Circle cx={start ? 160 : 154} cy={start ? 35 : 46} r={13} fill={colors.primary} />
        <Path
          d={start ? 'M160 50 L160 92 L132 119 M160 90 L187 119 M160 61 L131 83 M160 61 L189 82' : 'M154 60 L153 96 L123 115 M153 96 L185 103 L201 127 M154 69 L130 88 M154 69 L180 76'}
          fill="none"
          stroke={colors.primary}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={11}
        />
        <Line x1="85" y1="132" x2="235" y2="132" stroke={colors.mutedForeground} strokeWidth={2} opacity={0.45} />
      </Svg>
    );
  }

  if (isCore || isPull) {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 320 160" accessibilityLabel={`${signedName(item)} illustration`}>
        <Rect width="320" height="160" rx="22" fill={colors.secondary} />
        <Circle cx={start ? 94 : 101} cy={start ? 78 : 58} r={12} fill={colors.primary} />
        <Path
          d={start ? 'M107 83 L177 91 L223 94 M135 88 L126 125 M170 91 L174 125 M216 94 L237 112' : 'M114 65 L176 77 L224 91 M139 70 L126 110 M177 78 L183 117 M217 91 L239 109'}
          fill="none"
          stroke={colors.primary}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={11}
        />
        <Line x1="72" y1="132" x2="250" y2="132" stroke={colors.mutedForeground} strokeWidth={2} opacity={0.45} />
      </Svg>
    );
  }

  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 160" accessibilityLabel={`${signedName(item)} illustration`}>
      <Rect width="320" height="160" rx="22" fill={colors.secondary} />
      <Circle cx={start ? 95 : 102} cy={start ? 78 : 88} r={12} fill={colors.primary} />
      <Path
        d={start ? 'M108 82 L177 87 L227 88 M137 84 L128 126 M175 88 L181 125 M210 88 L242 70 M151 85 L130 57' : 'M115 91 L179 89 L230 88 M143 89 L132 126 M180 89 L186 126 M215 88 L240 106 M154 89 L137 115'}
        fill="none"
        stroke={colors.primary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={11}
      />
      <Line x1="68" y1="132" x2="252" y2="132" stroke={colors.mutedForeground} strokeWidth={2} opacity={0.45} />
    </Svg>
  );
}

export default function WorkoutPlayerScreen() {
  const colors = useColors();
  const { snapshot, ready, setActiveWorkout, recordSession } = useApp();
  const language = snapshot.settings.language;
  const active = snapshot.activeWorkout as ExtendedWorkout | null;
  const [now, setNow] = useState(Date.now());
  const [actualReps, setActualReps] = useState(0);
  const [awaitingRatingFor, setAwaitingRatingFor] = useState<string | null>(null);
  const [summary, setSummary] = useState<WorkoutSession | null>(null);
  const [effort, setEffort] = useState<DifficultyRating>('just-right');
  const [frame, setFrame] = useState(0);
  const redirected = useRef(false);
  const lastAppState = useRef<AppStateStatus>(AppState.currentState);
  const lastBeepSecond = useRef<number | null>(null);
  const notifReady = useRef(false);
  const items = useMemo(
    () => (active ? planItems(active.plan) : snapshot.currentPlan ? planItems(snapshot.currentPlan) : []),
    [active, snapshot.currentPlan],
  );
  const item = active ? items[active.exerciseIndex] : undefined;
  const targetReps = item?.planned.targetReps ?? item?.exercise?.targetReps ?? 10;
  const targetSeconds = item?.planned.targetSeconds ?? item?.exercise?.targetSeconds ?? 30;
  const isTimed = item?.exercise?.measurement === 'seconds' || item?.planned.targetSeconds !== undefined;
  const isUnilateral = !!item?.exercise?.unilateral;

  useEffect(() => {
    if (!ready) return;
    if (!active) {
      const plan = snapshot.currentPlan;
      const first = plan ? planItems(plan)[0] : undefined;
      if (plan && first) {
        setActiveWorkout(createWorkout(plan, first));
        return;
      }
      if (!redirected.current) {
        redirected.current = true;
        router.replace('/plan');
      }
      return;
    }
    redirected.current = false;
  }, [active, ready, setActiveWorkout, snapshot.currentPlan]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setFrame((current) => (current + 1) % 2), 1050);
    return () => clearInterval(timer);
  }, []);

  const completedForSet = useMemo(() => {
    if (!active || !item) return [];
    return active.completedSets.filter(
      (entry) => entry.exerciseId === item.planned.exerciseId && entry.setIndex === active.setIndex,
    );
  }, [active, item]);
  const currentSide: 'left' | 'right' | undefined = isUnilateral
    ? completedForSet.some((entry) => entry.side === 'left')
      ? 'right'
      : 'left'
    : undefined;
  useEffect(() => {
    setActualReps(targetReps);
  }, [active?.exerciseIndex, active?.setIndex, currentSide, targetReps]);

  const isOnRest = !!active?.restEndsAt && !active.pausedAt;
  const restRemaining =
    active?.restEndsAt && !active.pausedAt
      ? Math.max(0, Math.ceil((active.restEndsAt - now) / 1000))
      : active?.restSecondsLeft ?? 0;
  const exerciseRemaining =
    active?.exerciseEndsAt && !active.pausedAt
      ? Math.max(0, Math.ceil((active.exerciseEndsAt - now) / 1000))
      : targetSeconds;

  const exerciseCount = active?.completedSets.length ?? 0;
  const plannedSetCount = items.reduce((total, current) => {
    const sideMultiplier = current.exercise?.unilateral ? 2 : 1;
    return total + current.planned.sets * sideMultiplier;
  }, 0);
  const progress = plannedSetCount > 0 ? Math.min(1, exerciseCount / plannedSetCount) : 0;
  const phaseCompleted = active
    ? active.completedSets.filter((entry) => {
        const index = items.findIndex((planned) => planned.planned.exerciseId === entry.exerciseId);
        return index >= 0 && items[index].phase === active.phase;
      }).length
    : 0;
  const phaseItems = active ? items.filter((planned) => planned.phase === active.phase) : [];
  const phaseTotal = phaseItems.reduce(
    (total, current) => total + current.planned.sets * (current.exercise?.unilateral ? 2 : 1),
    0,
  );
  const phaseProgress = phaseTotal > 0 ? Math.min(1, phaseCompleted / phaseTotal) : 0;
  const secondsElapsed = active ? elapsedFor(active, now) : 0;
  const nextItem = active ? items[active.exerciseIndex + 1] : undefined;
  const storedSettings = snapshot.settings;
  const keepScreenAwake =
    storedSettings.keepScreenAwake && !!active && !active.pausedAt && !summary;

  useEffect(() => {
    const tag = 'gerak-active-workout';
    if (!keepScreenAwake) return;
    activateKeepAwakeAsync(tag).catch(() => {
      // Keeping the screen awake is a convenience; the workout still works without it.
    });
    return () => {
      deactivateKeepAwake(tag).catch(() => {});
    };
  }, [keepScreenAwake]);

  // FR-06.7/06.9: setup notifikasi workout (guarded) + langganan aksi Pause/Lewati.
  useEffect(() => {
    let cancelled = false;
    void ensureWorkoutNotifications().then((granted) => {
      if (!cancelled) notifReady.current = granted;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Aksi dari notifikasi: pause & skip. Ref diisi setelah pauseWorkout terdefinisi
  // (lihat effect langganan di bawah setelah resumeWorkout).
  const actionsRef = useRef<{ pause: () => void }>({ pause: () => {} });

  // FR-06.7: beep 3-2-1 untuk countdown latihan durasi & istirahat.
  const soundOn = storedSettings.soundEnabled;
  useEffect(() => {
    if (!active || active.pausedAt || summary) return;
    const ticking = isOnRest ? restRemaining : isTimed ? exerciseRemaining : null;
    if (ticking === null) {
      lastBeepSecond.current = null;
      return;
    }
    if (ticking >= 1 && ticking <= 3 && ticking !== lastBeepSecond.current) {
      lastBeepSecond.current = ticking;
      void playBeepTick(ticking === 1, soundOn);
    } else if (ticking > 3) {
      lastBeepSecond.current = null;
    }
  }, [active, exerciseRemaining, isOnRest, isTimed, restRemaining, soundOn, summary]);

  // FR-06.9: update notifikasi live tiap detik (menimpa id yang sama).
  useEffect(() => {
    if (!active || summary || !notifReady.current) return;
    if (active.pausedAt) {
      void updateWorkoutNotification({
        exerciseName: signedName(item),
        setLabel: `Set ${Math.min(active.setIndex + 1, item?.planned.sets ?? 1)}/${item?.planned.sets ?? 1}`,
        restLabel: null,
        totalLabel: formatDuration(secondsElapsed),
        paused: true,
      });
      return;
    }
    void updateWorkoutNotification({
      exerciseName: signedName(item),
      setLabel: `Set ${Math.min(active.setIndex + 1, item?.planned.sets ?? 1)}/${item?.planned.sets ?? 1}`,
      restLabel: isOnRest ? `Istirahat ${formatDuration(restRemaining)}` : null,
      totalLabel: formatDuration(secondsElapsed),
      paused: false,
    });
  }, [active, isOnRest, item, now, restRemaining, secondsElapsed, summary]);

  // Bersihkan notifikasi saat ringkasan tampil / sesi disimpan.
  useEffect(() => {
    if (summary) void clearWorkoutNotification();
  }, [summary]);

  const emitHaptic = useCallback(async (kind: 'selection' | 'success' = 'selection') => {
    if (!storedSettings.vibrationEnabled) return;
    try {
      if (kind === 'success') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.selectionAsync();
      }
    } catch {
      // Haptic feedback is optional; the workout remains fully usable without it.
    }
  }, [storedSettings.vibrationEnabled]);

  const makeSession = useCallback(
    (workout: ExtendedWorkout, endTime: number, chosenEffort: DifficultyRating): WorkoutSession => {
      const rows = workout.completedSets;
      const ids = Array.from(new Set(rows.map((entry) => entry.exerciseId)));
      const exerciseIndex = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));
      const avgMet =
        rows.length > 0
          ? rows.reduce((sum, entry) => sum + (exerciseIndex.get(entry.exerciseId)?.met ?? 3.5), 0) /
            rows.length
          : 3.5;
      const durationSeconds = elapsedFor(workout, endTime);
      const weight = snapshot.profile?.weightKg ?? 70;
      const calories = Math.round((avgMet * weight * durationSeconds) / 3600);
      return {
        id: createId(),
        startedAt: workout.sessionStartedAt ?? workout.startedAt,
        completedAt: new Date(endTime).toISOString(),
        durationSeconds,
        focusAreas: workout.plan.focusAreas,
        level: workout.plan.level,
        totalSets: rows.length,
        totalReps: rows.reduce((sum, entry) => sum + entry.reps, 0),
        calories,
        effort: chosenEffort,
        exerciseIds: ids,
        completedSets: rows,
      };
    },
    [snapshot.profile?.weightKg],
  );

  const showSummary = useCallback(
    (workout: ExtendedWorkout) => {
      setSummary(makeSession(workout, Date.now(), effort));
      void emitHaptic('success');
    },
    [effort, emitHaptic, makeSession],
  );

  useEffect(() => {
    if (active && items.length > 0 && active.exerciseIndex >= items.length && !summary) {
      showSummary(active);
    }
  }, [active, items.length, showSummary, summary]);

  const beginCurrentSet = useCallback(
    (workout: ExtendedWorkout) => {
      const plannedItem = items[workout.exerciseIndex];
      if (!plannedItem) {
        showSummary(workout);
        return;
      }
      const timed = plannedItem.exercise?.measurement === 'seconds' || plannedItem.planned.targetSeconds !== undefined;
      const seconds =
        plannedItem.planned.targetSeconds ?? plannedItem.exercise?.targetSeconds ?? 30;
      const current = Date.now();
      setActiveWorkout({
        ...workout,
        restEndsAt: null,
        restSecondsLeft: null,
        exerciseEndsAt: timed ? current + seconds * 1000 : null,
        exerciseSecondsAtPause: null,
      });
      setActualReps(plannedItem.planned.targetReps ?? plannedItem.exercise?.targetReps ?? 10);
      setNow(current);
      void playPhaseChime(snapshot.settings.soundEnabled);
    },
    [items, setActiveWorkout, showSummary, snapshot.settings.soundEnabled],
  );

  const advanceExercise = useCallback(
    (workout: ExtendedWorkout, nextIndex = workout.exerciseIndex + 1) => {
      if (nextIndex >= items.length) {
        const finished = {
          ...workout,
          exerciseIndex: items.length,
          restEndsAt: null,
          restSecondsLeft: null,
          exerciseEndsAt: null,
        };
        setActiveWorkout(finished);
        showSummary(finished);
        return;
      }
      const next = items[nextIndex];
      const nextWorkout: ExtendedWorkout = {
        ...workout,
        exerciseIndex: nextIndex,
        phase: next.phase,
        setIndex: 0,
        restEndsAt: null,
        restSecondsLeft: null,
        exerciseEndsAt: null,
        exerciseSecondsAtPause: null,
      };
      setActiveWorkout(nextWorkout);
      setActualReps(next.planned.targetReps ?? next.exercise?.targetReps ?? 10);
      setAwaitingRatingFor(null);
      beginCurrentSet(nextWorkout);
      void emitHaptic();
    },
    [beginCurrentSet, emitHaptic, items, setActiveWorkout, showSummary],
  );

  const finishSide = useCallback(
    (reps: number, seconds: number) => {
      if (!active || !item || active.pausedAt || isOnRest || awaitingRatingFor) return;
      const sideRows = active.completedSets.filter(
        (entry) => entry.exerciseId === item.planned.exerciseId && entry.setIndex === active.setIndex,
      );
      const side: 'left' | 'right' | undefined = isUnilateral
        ? sideRows.some((entry) => entry.side === 'left')
          ? 'right'
          : 'left'
        : undefined;
      const completedSets = [
        ...active.completedSets,
        {
          exerciseId: item.planned.exerciseId,
          setIndex: active.setIndex,
          reps: Math.max(0, Math.round(reps)),
          seconds: Math.max(0, Math.round(seconds)),
          ...(side ? { side } : {}),
        },
      ];
      void emitHaptic('success');

      if (isUnilateral && side === 'left') {
        const nextWorkout: ExtendedWorkout = {
          ...active,
          completedSets,
          restEndsAt: null,
          restSecondsLeft: null,
          exerciseEndsAt: isTimed ? Date.now() + targetSeconds * 1000 : null,
        };
        setActiveWorkout(nextWorkout);
        setActualReps(item.planned.targetReps ?? item.exercise?.targetReps ?? 10);
        return;
      }

      const lastSet = active.setIndex + 1 >= item.planned.sets;
      if (lastSet) {
        const updated = {
          ...active,
          completedSets,
          restEndsAt: null,
          restSecondsLeft: null,
          exerciseEndsAt: null,
        };
      setActiveWorkout(updated);
      setAwaitingRatingFor(item.planned.exerciseId);
      void playPhaseChime(snapshot.settings.soundEnabled);
      return;
      }

      const restSeconds = Math.max(0, item.planned.restSeconds ?? item.exercise?.restSeconds ?? 45);
      const updated: ExtendedWorkout = {
        ...active,
        completedSets,
        setIndex: active.setIndex + 1,
        restSecondsLeft: restSeconds,
        restEndsAt: restSeconds > 0 ? Date.now() + restSeconds * 1000 : null,
        exerciseEndsAt: null,
      };
      if (restSeconds > 0) {
        setActiveWorkout(updated);
      } else {
        setActiveWorkout(updated);
        beginCurrentSet(updated);
      }
    },
    [
      active,
      awaitingRatingFor,
      beginCurrentSet,
      emitHaptic,
      isOnRest,
      isTimed,
      isUnilateral,
      item,
      setActiveWorkout,
      snapshot.settings.soundEnabled,
      targetSeconds,
    ],
  );

  useEffect(() => {
    if (!active || !item || active.pausedAt || active.restEndsAt || awaitingRatingFor) return;
    const completedForExercise = active.completedSets.filter(
      (entry) => entry.exerciseId === item.planned.exerciseId,
    ).length;
    const expectedForExercise = item.planned.sets * (item.exercise?.unilateral ? 2 : 1);
    if (completedForExercise >= expectedForExercise && expectedForExercise > 0) {
      setAwaitingRatingFor(item.planned.exerciseId);
      return;
    }
    const timed = item.exercise?.measurement === 'seconds' || item.planned.targetSeconds !== undefined;
    if (timed && !active.exerciseEndsAt) {
      const seconds = item.planned.targetSeconds ?? item.exercise?.targetSeconds ?? 30;
      setActiveWorkout({ ...active, exerciseEndsAt: Date.now() + seconds * 1000 });
    }
  }, [active, awaitingRatingFor, item, setActiveWorkout]);

  useEffect(() => {
    if (!active || !item || active.pausedAt || awaitingRatingFor || isOnRest || !active.exerciseEndsAt) return;
    if (active.exerciseEndsAt <= now) finishSide(0, targetSeconds);
  }, [active, awaitingRatingFor, finishSide, isOnRest, item, now, targetSeconds]);

  useEffect(() => {
    if (!active || active.pausedAt || !active.restEndsAt) return;
    if (active.restEndsAt <= now) beginCurrentSet(active);
  }, [active, beginCurrentSet, now]);

  const pauseWorkout = useCallback(() => {
    if (!active || active.pausedAt) return;
    const current = Date.now();
    const exerciseSecondsAtPause =
      active.exerciseEndsAt !== null && active.exerciseEndsAt !== undefined
        ? Math.max(0, Math.ceil((active.exerciseEndsAt - current) / 1000))
        : null;
    setActiveWorkout({
      ...active,
      elapsedSeconds: elapsedFor(active, current),
      pausedAt: new Date(current).toISOString(),
      exerciseSecondsAtPause,
      restSecondsLeft:
        active.restEndsAt !== null && active.restEndsAt !== undefined
          ? Math.max(0, Math.ceil((active.restEndsAt - current) / 1000))
          : active.restSecondsLeft,
    });
    setNow(current);
  }, [active, setActiveWorkout]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const previous = lastAppState.current;
      lastAppState.current = state;
      if (previous === 'active' && state.match(/inactive|background/)) {
        pauseWorkout();
      } else if (previous.match(/inactive|background/) && state === 'active') {
        setNow(Date.now());
      }
    });
    return () => subscription.remove();
  }, [pauseWorkout]);

  const resumeWorkout = useCallback(() => {
    if (!active?.pausedAt) return;
    const current = Date.now();
    const restEndsAt =
      active.restSecondsLeft !== null
        ? current + Math.max(0, active.restSecondsLeft) * 1000
        : null;
    const exerciseEndsAt =
      active.exerciseSecondsAtPause !== null && active.exerciseSecondsAtPause !== undefined
        ? current + active.exerciseSecondsAtPause * 1000
        : null;
    setActiveWorkout({
      ...active,
      startedAt: new Date(current).toISOString(),
      sessionStartedAt: active.sessionStartedAt ?? active.startedAt,
      pausedAt: null,
      restEndsAt,
      exerciseEndsAt,
      exerciseSecondsAtPause: null,
    });
    setNow(current);
    void emitHaptic();
  }, [active, emitHaptic, setActiveWorkout]);

  // Langganan aksi notifikasi setelah pauseWorkout tersedia (hindari use-before-declare).
  useEffect(() => {
    actionsRef.current.pause = pauseWorkout;
  }, [pauseWorkout]);
  useEffect(() => {
    const unsubscribe = subscribeWorkoutNotificationActions({
      onPause: () => actionsRef.current.pause(),
      onSkip: () => {
        setActiveWorkout((current) => {
          if (!current) return current;
          const ext = current as ExtendedWorkout;
          if (ext.restEndsAt) {
            return { ...ext, restEndsAt: Date.now(), restSecondsLeft: 0 };
          }
          return current;
        });
      },
    });
    return unsubscribe;
  }, [setActiveWorkout]);

  const adjustRest = useCallback(
    (additionalSeconds: number) => {
      if (!active || !active.restEndsAt || active.pausedAt) return;
      const updatedEnd = Math.max(Date.now(), active.restEndsAt) + additionalSeconds * 1000;
      setActiveWorkout({
        ...active,
        restEndsAt: updatedEnd,
        restSecondsLeft: Math.max(0, Math.ceil((updatedEnd - Date.now()) / 1000)),
      });
    },
    [active, setActiveWorkout],
  );

  const rateExercise = useCallback(
    (rating: DifficultyRating) => {
      if (!active || !item) return;
      const updated: ExtendedWorkout = {
        ...active,
        completedSets: active.completedSets.map((entry) =>
          entry.exerciseId === item.planned.exerciseId
            ? { ...entry, rating }
            : entry,
        ),
      };
      setActiveWorkout(updated);
      advanceExercise(updated);
      void emitHaptic();
    },
    [active, advanceExercise, emitHaptic, item, setActiveWorkout],
  );

  const goPrevious = useCallback(() => {
    if (!active || active.exerciseIndex <= 0) return;
    const previousIndex = active.exerciseIndex - 1;
    const previous = items[previousIndex];
    if (!previous) return;
    const completedSets = active.completedSets.filter(
      (entry) => entry.exerciseId !== previous.planned.exerciseId,
    );
    const updated: ExtendedWorkout = {
      ...active,
      completedSets,
      exerciseIndex: previousIndex,
      phase: previous.phase,
      setIndex: 0,
      restEndsAt: null,
      restSecondsLeft: null,
      exerciseEndsAt: null,
    };
    setAwaitingRatingFor(null);
    setActiveWorkout(updated);
    setActualReps(previous.planned.targetReps ?? previous.exercise?.targetReps ?? 10);
    beginCurrentSet(updated);
    void emitHaptic();
  }, [active, beginCurrentSet, emitHaptic, items, setActiveWorkout]);

  const skipExercise = useCallback(() => {
    if (!active) return;
    const label = tx(language, 'Lewati latihan ini?', 'Skip this exercise?');
    Alert.alert(
      label,
      tx(language, 'Set yang sudah selesai tetap dicatat.', 'Sets already completed will stay in your log.'),
      [
        { text: tx(language, 'Batal', 'Cancel'), style: 'cancel' },
        {
          text: tx(language, 'Lewati', 'Skip'),
          style: 'destructive',
          onPress: () => {
            setAwaitingRatingFor(null);
            advanceExercise(active);
          },
        },
      ],
    );
  }, [active, advanceExercise, language]);

  const finishEarly = useCallback(() => {
    if (!active) return;
    Alert.alert(
      tx(language, 'Akhiri sesi sekarang?', 'End this session now?'),
      tx(language, 'Progress yang tercatat akan masuk ke ringkasan.', 'Recorded progress will be included in your summary.'),
      [
        { text: tx(language, 'Lanjut latihan', 'Keep going'), style: 'cancel' },
        {
          text: tx(language, 'Lihat ringkasan', 'View summary'),
          onPress: () => showSummary(active),
        },
      ],
    );
  }, [active, language, showSummary]);

  const saveSummary = useCallback(() => {
    if (!summary) return;
    recordSession({ ...summary, effort });
    setSummary(null);
    router.replace('/');
  }, [effort, recordSession, summary]);

  const sideLabel =
    currentSide === 'left'
      ? tx(language, 'Kiri', 'Left')
      : currentSide === 'right'
        ? tx(language, 'Kanan', 'Right')
        : '';

  if (!ready || (!active && !summary)) {
    return (
      <AppScreen scroll={false} style={styles.centered}>
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          {tx(language, 'Menyiapkan sesi…', 'Preparing your session…')}
        </Text>
      </AppScreen>
    );
  }

  if (summary) {
    return (
      <AppScreen contentStyle={styles.summaryContent}>
        <View style={styles.summaryTop}>
          <View style={[styles.summaryMark, { backgroundColor: colors.accent }]}>
            <Feather name="check" size={24} color={colors.accentForeground} />
          </View>
          <Text style={[styles.kicker, { color: colors.primary }]}>{tx(language, 'SESI SELESAI', 'SESSION COMPLETE')}</Text>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            {tx(language, 'Kerja bagus.', 'Great work.')}
          </Text>
          <Text style={[styles.summaryCopy, { color: colors.mutedForeground }]}>
            {tx(language, 'Konsistensi kecil adalah progress yang nyata.', 'Small sessions add up to real progress.')}
          </Text>
        </View>

        <Surface style={styles.summaryStats}>
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryNumber, { color: colors.foreground }]}>{formatDuration(summary.durationSeconds)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{tx(language, 'Durasi', 'Duration')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryNumber, { color: colors.foreground }]}>{summary.totalSets}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{tx(language, 'Set selesai', 'Sets done')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryStat}>
            <Text style={[styles.summaryNumber, { color: colors.foreground }]}>{summary.totalReps}</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{tx(language, 'Repetisi', 'Reps')}</Text>
          </View>
        </Surface>

        <Surface style={styles.calorieCard}>
          <View style={[styles.calorieIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="zap" size={20} color={colors.primary} />
          </View>
          <View style={styles.calorieCopy}>
            <Text style={[styles.calorieValue, { color: colors.foreground }]}>{summary.calories} kcal</Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
              {tx(language, 'Estimasi MET • angka perkiraan', 'MET estimate • approximate only')}
            </Text>
          </View>
        </Surface>

        <View style={styles.effortBlock}>
          <Text style={[styles.effortHeading, { color: colors.foreground }]}>
            {tx(language, 'Bagaimana rasanya?', 'How did it feel?')}
          </Text>
          <View style={styles.effortOptions}>
            {([
              ['easy', tx(language, 'Mudah', 'Easy')],
              ['just-right', tx(language, 'Pas', 'Just right')],
              ['hard', tx(language, 'Berat', 'Hard')],
            ] as Array<[DifficultyRating, string]>).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: effort === value }}
                onPress={() => setEffort(value)}
                style={[
                  styles.effortChoice,
                  {
                    backgroundColor: effort === value ? colors.primary : colors.card,
                    borderColor: effort === value ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.effortText, { color: effort === value ? colors.primaryForeground : colors.foreground }]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <ActionButton title={tx(language, 'Simpan sesi', 'Save session')} onPress={saveSummary} />
        <Pressable onPress={saveSummary} accessibilityRole="button" style={styles.returnLink}>
          <Text style={[styles.returnLinkText, { color: colors.mutedForeground }]}>
            {tx(language, 'Simpan dan kembali ke beranda', 'Save and return home')}
          </Text>
        </Pressable>
      </AppScreen>
    );
  }

  if (!active || !item) {
    return (
      <AppScreen scroll={false} style={styles.centered}>
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          {tx(language, 'Mengalihkan ke rencana latihan…', 'Opening your workout plan…')}
        </Text>
      </AppScreen>
    );
  }

  const totalItems = items.length;
  const displayExerciseNumber = Math.min(active.exerciseIndex + 1, totalItems);
  const displaySetNumber = Math.min(active.setIndex + 1, item.planned.sets);
  const paused = !!active.pausedAt;
  const itemTargetTitle = isTimed
    ? tx(language, 'Target waktu', 'Time target')
    : tx(language, 'Target repetisi', 'Rep target');
  const nextPreviewName = nextItem ? signedName(nextItem) : tx(language, 'Ringkasan sesi', 'Session summary');

  return (
    <AppScreen scroll={false} style={styles.playerScreen}>
      <View style={styles.playerHeader}>
        <View style={styles.headerLeft}>
          <Text style={[styles.phaseEyebrow, { color: colors.primary }]}>{phaseLabel(active.phase, language).toUpperCase()}</Text>
          <Text style={[styles.timerTotal, { color: colors.foreground }]}>{formatDuration(secondsElapsed)}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.exerciseCounter, { color: colors.mutedForeground }]}>
            {tx(language, 'Latihan', 'Exercise')} {displayExerciseNumber}/{totalItems}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx(language, 'Akhiri latihan', 'End workout')}
            testID="end-workout"
            onPress={finishEarly}
            style={({ pressed }) => [styles.iconButton, { borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Feather name="x" size={20} color={colors.foreground} />
          </Pressable>
        </View>
      </View>

      <View style={styles.progressRows}>
        <View style={styles.progressLine}>
          <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={[styles.progressCaption, { color: colors.mutedForeground }]}>{Math.round(progress * 100)}%</Text>
        </View>
        <View style={styles.phaseProgressLine}>
          <View style={[styles.phaseTrack, { backgroundColor: colors.secondary }]}>
            <View style={[styles.phaseFill, { backgroundColor: colors.accent, width: `${Math.round(phaseProgress * 100)}%` }]} />
          </View>
          <Text style={[styles.phaseProgressText, { color: colors.mutedForeground }]}>
            {phaseLabel(active.phase, language)} · {phaseCompleted}/{phaseTotal}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.playerContent}
        contentContainerStyle={styles.playerContentInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.exerciseTitleRow}>
          <View style={styles.exerciseTitleCopy}>
            <Text style={[styles.exerciseTitle, { color: colors.foreground }]} numberOfLines={2}>
              {signedName(item)}
            </Text>
            {isUnilateral ? (
              <View style={[styles.sidePill, { backgroundColor: colors.accent }]}>
                <Text style={[styles.sideLabel, { color: colors.accentForeground }]}>{sideLabel}</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={tx(language, 'Detail latihan', 'Exercise details')}
            testID="exercise-detail-link"
            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: item.planned.exerciseId } })}
            style={({ pressed }) => [styles.detailButton, { borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Feather name="info" size={18} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.illustrationWrap}>
          <ExerciseIllustration item={item} colors={colors} frame={frame} />
          <View style={[styles.illustrationBadge, { backgroundColor: colors.card }]}>
            <Text style={[styles.illustrationBadgeText, { color: colors.mutedForeground }]}>
              {tx(language, 'GERAKAN', 'MOVEMENT')}
            </Text>
          </View>
        </View>

        {awaitingRatingFor === item.planned.exerciseId ? (
          <Surface style={styles.ratingCard}>
            <Text style={[styles.cardHeading, { color: colors.foreground }]}>
              {tx(language, 'Bagaimana set ini terasa?', 'How did that exercise feel?')}
            </Text>
            <View style={styles.ratingOptions}>
              {([
                ['easy', tx(language, 'Mudah', 'Easy')],
                ['just-right', tx(language, 'Pas', 'Just right')],
                ['hard', tx(language, 'Berat', 'Hard')],
              ] as Array<[DifficultyRating, string]>).map(([rating, label]) => (
                <Pressable
                  key={rating}
                  accessibilityRole="button"
                  testID={`rating-${rating}`}
                  onPress={() => rateExercise(rating)}
                  style={({ pressed }) => [
                    styles.ratingButton,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.ratingText, { color: colors.foreground }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => advanceExercise(active)} accessibilityRole="button" style={styles.skipRating}>
              <Text style={[styles.skipRatingText, { color: colors.mutedForeground }]}>
                {tx(language, 'Lanjut tanpa rating', 'Continue without rating')}
              </Text>
            </Pressable>
          </Surface>
        ) : paused ? (
          <Surface style={styles.pausedCard}>
            <Feather name="pause-circle" size={22} color={colors.primary} />
            <View style={styles.pausedCopy}>
              <Text style={[styles.cardHeading, { color: colors.foreground }]}>
                {tx(language, 'Sesi dijeda', 'Workout paused')}
              </Text>
              <Text style={[styles.pausedHint, { color: colors.mutedForeground }]}>
                {tx(language, 'Lanjutkan saat Anda siap.', 'Resume when you are ready.')}
              </Text>
            </View>
          </Surface>
        ) : isOnRest ? (
          <Surface style={styles.timerCard}>
            <Text style={[styles.timerLabel, { color: colors.mutedForeground }]}>{tx(language, 'WAKTU ISTIRAHAT', 'REST')}</Text>
            <Text style={[styles.countdown, { color: colors.primary }]}>{formatDuration(restRemaining)}</Text>
            {nextItem ? (
              <Text style={[styles.nextLabel, { color: colors.foreground }]} numberOfLines={1}>
                {tx(language, 'Berikutnya', 'Up next')}: {nextPreviewName}
              </Text>
            ) : null}
            <View style={styles.restActions}>
              <Pressable
                accessibilityRole="button"
                testID="add-rest-time"
                onPress={() => adjustRest(15)}
                style={({ pressed }) => [styles.restAction, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
              >
                <Feather name="plus" size={17} color={colors.primary} />
                <Text style={[styles.restActionText, { color: colors.foreground }]}>15s</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                testID="skip-rest"
                onPress={() => beginCurrentSet(active)}
                style={({ pressed }) => [styles.restSkip, { borderColor: colors.border }, pressed && styles.pressed]}
              >
                <Text style={[styles.restSkipText, { color: colors.foreground }]}>{tx(language, 'Lewati istirahat', 'Skip rest')}</Text>
              </Pressable>
            </View>
          </Surface>
        ) : (
          <Surface style={styles.timerCard}>
            <View style={styles.timerTopLine}>
              <Text style={[styles.timerLabel, { color: colors.mutedForeground }]}>{itemTargetTitle.toUpperCase()}</Text>
              <Text style={[styles.setLabel, { color: colors.foreground }]}>
                {tx(language, 'Set', 'Set')} {displaySetNumber}/{item.planned.sets}
              </Text>
            </View>
            {isTimed ? (
              <Text accessibilityLiveRegion="polite" style={[styles.countdown, { color: colors.primary }]}>
                {formatDuration(exerciseRemaining)}
              </Text>
            ) : (
              <View style={styles.repStepper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tx(language, 'Kurangi repetisi', 'Decrease reps')}
                  testID="decrease-reps"
                  onPress={() => setActualReps((value) => Math.max(0, value - 1))}
                  style={({ pressed }) => [styles.stepButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
                >
                  <Feather name="minus" size={20} color={colors.foreground} />
                </Pressable>
                <View style={styles.repValueWrap}>
                  <Text accessibilityLiveRegion="polite" style={[styles.repValue, { color: colors.foreground }]}>{actualReps}</Text>
                  <Text style={[styles.repTarget, { color: colors.mutedForeground }]}>
                    {tx(language, `target ${targetReps}`, `target ${targetReps}`)}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tx(language, 'Tambah repetisi', 'Increase reps')}
                  testID="increase-reps"
                  onPress={() => setActualReps((value) => Math.min(999, value + 1))}
                  style={({ pressed }) => [styles.stepButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
                >
                  <Feather name="plus" size={20} color={colors.foreground} />
                </Pressable>
              </View>
            )}
            <Text style={[styles.coachHint, { color: colors.mutedForeground }]}>
              {isTimed
                ? tx(language, 'Hitung napas dan jaga gerakan tetap stabil.', 'Breathe steadily and keep your movement controlled.')
                : tx(language, 'Catat repetisi yang benar-benar selesai.', 'Log the reps you actually completed.')}
            </Text>
          </Surface>
        )}

        {!awaitingRatingFor && !isOnRest && nextItem ? (
          <View style={[styles.nextPreview, { borderColor: colors.border }]}>
            <Feather name="arrow-right" size={15} color={colors.mutedForeground} />
            <Text style={[styles.nextPreviewText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {tx(language, 'Selanjutnya', 'Next')}: {nextPreviewName}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.controls, { backgroundColor: colors.background }]}>
        <View style={styles.transport}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx(language, 'Latihan sebelumnya', 'Previous exercise')}
            testID="previous-exercise"
            disabled={active.exerciseIndex <= 0}
            onPress={goPrevious}
            style={({ pressed }) => [
              styles.transportButton,
              { borderColor: colors.border, opacity: active.exerciseIndex <= 0 ? 0.4 : 1 },
              pressed && styles.pressed,
            ]}
          >
            <Feather name="skip-back" size={19} color={colors.foreground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={paused ? tx(language, 'Lanjutkan', 'Resume') : tx(language, 'Jeda', 'Pause')}
            testID="pause-resume"
            onPress={paused ? resumeWorkout : pauseWorkout}
            style={({ pressed }) => [
              styles.pauseButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Feather name={paused ? 'play' : 'pause'} size={22} color={colors.primaryForeground} />
            <Text style={[styles.pauseButtonText, { color: colors.primaryForeground }]}>
              {paused ? tx(language, 'Lanjut', 'Resume') : tx(language, 'Jeda', 'Pause')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx(language, 'Lewati latihan', 'Skip exercise')}
            testID="skip-exercise"
            onPress={skipExercise}
            style={({ pressed }) => [styles.transportButton, { borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Feather name="skip-forward" size={19} color={colors.foreground} />
          </Pressable>
        </View>
        {!paused && !isOnRest && !awaitingRatingFor ? (
          <ActionButton
            title={tx(
              language,
              `Selesai ${sideLabel ? `sisi ${sideLabel.toLowerCase()}` : 'set'}`,
              `Finish ${sideLabel ? `${sideLabel.toLowerCase()} side` : 'set'}`,
            )}
            onPress={() => finishSide(isTimed ? 0 : actualReps, isTimed ? targetSeconds : 0)}
            testID="complete-set"
            style={styles.completeButton}
          />
        ) : !paused ? (
          <View style={styles.controlsBottomSpacer} />
        ) : null}
        <Text style={[styles.deviceNote, { color: colors.mutedForeground }]}>
          {tx(language, 'Timer berbasis waktu sistem + notifikasi live (Pause/Lewati). Di Expo Go background tetap auto-pause; di dev-client/prebuild timer akurat.', 'System-clock timer with a live notification (Pause/Skip). Background auto-pauses in Expo Go; accurate in dev-client/prebuild.')}
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, fontWeight: '600' },
  playerScreen: { paddingHorizontal: 18, paddingTop: 6 },
  playerHeader: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  phaseEyebrow: { fontSize: 10, lineHeight: 13, fontWeight: '800', letterSpacing: 1 },
  timerTotal: { fontSize: 16, lineHeight: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  exerciseCounter: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  iconButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  progressRows: { gap: 6, paddingBottom: 6 },
  progressLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 4 },
  progressCaption: { minWidth: 30, fontSize: 10, fontWeight: '700', textAlign: 'right' },
  phaseProgressLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phaseTrack: { width: 44, height: 4, borderRadius: 4, overflow: 'hidden' },
  phaseFill: { height: 4, borderRadius: 4 },
  phaseProgressText: { fontSize: 10, lineHeight: 13, fontWeight: '600' },
  playerContent: { flex: 1 },
  playerContentInner: { gap: 12, paddingBottom: 10 },
  exerciseTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, gap: 10 },
  exerciseTitleCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9 },
  exerciseTitle: { fontSize: 23, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4, flexShrink: 1 },
  sidePill: { minHeight: 26, paddingHorizontal: 11, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sideLabel: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
  detailButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  illustrationWrap: { height: 146, borderRadius: 22, overflow: 'hidden', position: 'relative' },
  illustrationBadge: { position: 'absolute', right: 10, bottom: 10, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8 },
  illustrationBadgeText: { fontSize: 8, lineHeight: 11, fontWeight: '800', letterSpacing: 0.8 },
  timerCard: { paddingVertical: 12, paddingHorizontal: 15, gap: 5 },
  timerTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  timerLabel: { fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1 },
  setLabel: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  countdown: { fontSize: 42, lineHeight: 48, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  repStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  stepButton: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  repValueWrap: { minWidth: 105, alignItems: 'center', gap: 0 },
  repValue: { fontSize: 39, lineHeight: 43, fontWeight: '700', fontVariant: ['tabular-nums'] },
  repTarget: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  coachHint: { fontSize: 11, lineHeight: 15 },
  nextLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600', marginTop: -2 },
  restActions: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 3 },
  restAction: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 12, borderRadius: 12 },
  restActionText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  restSkip: { minHeight: 38, flex: 1, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  restSkipText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  ratingCard: { paddingVertical: 12, gap: 8 },
  pausedCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 },
  pausedCopy: { flex: 1, gap: 3 },
  pausedHint: { fontSize: 12, lineHeight: 17 },
  cardHeading: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  ratingOptions: { flexDirection: 'row', gap: 7 },
  ratingButton: { flex: 1, minHeight: 43, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  ratingText: { fontSize: 11, lineHeight: 14, fontWeight: '700', textAlign: 'center' },
  skipRating: { alignSelf: 'center', minHeight: 32, justifyContent: 'center', paddingHorizontal: 10 },
  skipRatingText: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  nextPreview: { minHeight: 32, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 7 },
  nextPreviewText: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  controls: { paddingTop: 8, paddingBottom: 2, gap: 8 },
  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9 },
  transportButton: { width: 54, height: 52, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pauseButton: { flex: 1, minHeight: 52, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pauseButtonText: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  completeButton: { minHeight: 56 },
  controlsBottomSpacer: { height: 4 },
  deviceNote: { fontSize: 9, lineHeight: 12, textAlign: 'center', paddingBottom: 2 },
  summaryContent: { gap: 16, paddingTop: 16 },
  summaryTop: { alignItems: 'center', gap: 5, paddingVertical: 6 },
  summaryMark: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  kicker: { fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1.4 },
  summaryTitle: { fontSize: 31, lineHeight: 37, fontWeight: '700', letterSpacing: -0.5 },
  summaryCopy: { fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 290 },
  summaryStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 19 },
  summaryStat: { flex: 1, alignItems: 'center', gap: 4 },
  summaryNumber: { fontSize: 20, lineHeight: 25, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: 10, lineHeight: 14, fontWeight: '600', textAlign: 'center' },
  statDivider: { width: 1, height: 35 },
  calorieCard: { borderWidth: 1, borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  calorieIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  calorieCopy: { flex: 1, gap: 2 },
  calorieValue: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  effortBlock: { gap: 10 },
  effortHeading: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  effortOptions: { flexDirection: 'row', gap: 8 },
  effortChoice: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  effortText: { fontSize: 12, lineHeight: 16, fontWeight: '700', textAlign: 'center' },
  returnLink: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  returnLinkText: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});