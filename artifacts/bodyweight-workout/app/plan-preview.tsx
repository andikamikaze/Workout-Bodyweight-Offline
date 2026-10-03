import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ActionButton,
  AppScreen,
  PageHeader,
  SectionHeading,
  Surface,
} from '@/components/WorkoutUI';
import { useColors } from '@/hooks/useColors';
import { EXERCISES } from '@/src/data/exercises';
import { MUSCLES } from '@/src/data/muscles';
import { countRecentEffort, suggestProgression } from '@/src/features/planner/generatePlan';
import { tx } from '@/src/i18n';
import { useApp } from '@/src/store/AppContext';
import {
  Exercise,
  Furniture,
  PlannedExercise,
  WorkoutLevel,
  WorkoutPhase,
  WorkoutPlan,
  WorkoutSession,
} from '@/src/types';

type PhaseKey = 'warmup' | 'training' | 'cooldown';

const LEVEL_RANK: Record<WorkoutLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

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

function findAlternatives(
  current: Exercise,
  planLevel: WorkoutLevel,
  allowedFurniture: Furniture[],
  silentMode: boolean,
  excludeIds: Set<string>,
): Exercise[] {
  return EXERCISES.filter((candidate) => {
    if (candidate.id === current.id) return false;
    if (candidate.phase !== current.phase) return false;
    if (excludeIds.has(candidate.id)) return false;
    // FR-04.3: alternatif otot primer sama.
    if (!candidate.primaryMuscles.some((muscle) => current.primaryMuscles.includes(muscle))) {
      return false;
    }
    if (LEVEL_RANK[candidate.levelMin] > LEVEL_RANK[planLevel]) return false;
    if (!candidate.furniture.every((item) => allowedFurniture.includes(item))) return false;
    if (silentMode && candidate.impact === 'high') return false;
    return true;
  });
}

function SmallButton({
  label,
  icon,
  onPress,
  disabled,
  danger,
  testID,
}: {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.smallBtn,
        {
          backgroundColor: colors.secondary,
          borderColor: colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon ? (
        <Feather
          name={icon}
          size={12}
          color={danger ? colors.destructive : colors.primary}
        />
      ) : null}
      <Text
        style={[
          styles.smallBtnText,
          { color: danger ? colors.destructive : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EditablePhaseCard({
  phase,
  phaseKey,
  exercises,
  language,
  planLevel,
  allowedFurniture,
  silentMode,
  sessions,
  usedIds,
  onReplace,
  onDelete,
  onMove,
}: {
  phase: WorkoutPhase;
  phaseKey: PhaseKey;
  exercises: PlannedExercise[];
  language: 'id' | 'en';
  planLevel: WorkoutLevel;
  allowedFurniture: Furniture[];
  silentMode: boolean;
  sessions: WorkoutSession[];
  usedIds: Set<string>;
  onReplace: (phaseKey: PhaseKey, index: number, next: PlannedExercise) => void;
  onDelete: (phaseKey: PhaseKey, index: number) => void;
  onMove: (phaseKey: PhaseKey, index: number, direction: -1 | 1) => void;
}) {
  const colors = useColors();
  const router = useRouter();
  const heading: Record<WorkoutPhase, [string, string]> = {
    'warm-up': ['Pemanasan', 'Warm-up'],
    training: ['Latihan utama', 'Training'],
    cooldown: ['Pendinginan', 'Cool-down'],
  };

  return (
    <View style={styles.phase}>
      <SectionHeading title={`${tx(language, ...heading[phase])} · ${exercises.length}`} />
      <Surface style={styles.exerciseList}>
        {exercises.map((planned, index) => {
          const exercise = EXERCISES.find((item) => item.id === planned.exerciseId);
          const name = exercise
            ? language === 'en'
              ? exercise.englishName
              : exercise.name
            : planned.exerciseId;
          const target =
            planned.targetSeconds !== undefined
              ? `${planned.targetSeconds} ${tx(language, 'dtk', 'sec')}`
              : `${planned.targetReps ?? 10} ${tx(language, 'repetisi', 'reps')}`;
          // FR-03.3: saran adaptif, tanpa mengubah pilihan otomatis.
          const suggestionId = suggestProgression(planned.exerciseId, sessions);
          const suggestionExercise = suggestionId
            ? EXERCISES.find((item) => item.id === suggestionId)
            : undefined;
          const counts = countRecentEffort(planned.exerciseId, sessions);
          const suggestionText = suggestionExercise
            ? counts.easy >= 3
              ? tx(
                  language,
                  `Saran: coba ${suggestionExercise.name} karena ${counts.easy}x Mudah`,
                  `Suggestion: try ${suggestionExercise.englishName} after ${counts.easy}x Easy`,
                )
              : tx(
                  language,
                  `Saran: coba ${suggestionExercise.name} karena ${counts.hard}x Sulit`,
                  `Suggestion: try ${suggestionExercise.englishName} after ${counts.hard}x Hard`,
                )
            : null;

          return (
            <View
              key={`${planned.exerciseId}-${index}`}
              style={[
                styles.exerciseBlock,
                index < exercises.length - 1 && {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View style={styles.exerciseRow}>
                <View style={[styles.exerciseNumber, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.numberText, { color: colors.primary }]}>
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                </View>
                <View style={styles.exerciseCopy}>
                  {/* FR-04.3: ketuk nama → /exercise/[id] */}
                  <Pressable
                    accessibilityRole="link"
                    onPress={() =>
                      router.push({ pathname: '/exercise/[id]', params: { id: planned.exerciseId } })
                    }
                  >
                    <Text style={[styles.exerciseName, styles.exerciseLink, { color: colors.primary }]}>
                      {name}
                    </Text>
                  </Pressable>
                  <Text style={[styles.exerciseMeta, { color: colors.mutedForeground }]}>
                    {phase === 'training'
                      ? `${planned.sets} ${tx(language, 'set', 'sets')} · ${target}${
                          exercise?.unilateral ? ` · ${tx(language, 'dua sisi', 'both sides')}` : ''
                        }`
                      : target}
                  </Text>
                </View>
                {exercise?.impact === 'high' ? (
                  <Feather name="zap" size={15} color={colors.destructive} />
                ) : null}
              </View>

              {suggestionText ? (
                <View style={[styles.suggestionBox, { backgroundColor: colors.accent }]}>
                  <Feather name="trending-up" size={13} color={colors.accentForeground} />
                  <Text style={[styles.suggestionText, { color: colors.accentForeground }]}>
                    {suggestionText}
                  </Text>
                </View>
              ) : null}

              <View style={styles.controlsRow}>
                <SmallButton
                  label={tx(language, 'Ganti', 'Swap')}
                  icon="repeat"
                  onPress={() => {
                    if (!exercise) {
                      Alert.alert(tx(language, 'Tidak ditemukan', 'Not found'));
                      return;
                    }
                    const alternatives = findAlternatives(
                      exercise,
                      planLevel,
                      allowedFurniture,
                      silentMode,
                      usedIds,
                    );
                    if (!alternatives.length) {
                      Alert.alert(
                        tx(language, 'Tidak ada alternatif', 'No alternative'),
                        tx(
                          language,
                          'Tidak ada gerakan pengganti dengan otot primer sama yang cocok filter.',
                          'No swap candidate with the same primary muscle matches the filters.',
                        ),
                      );
                      return;
                    }
                    const picked =
                      alternatives[Math.floor(Math.random() * alternatives.length)];
                    onReplace(phaseKey, index, buildPlannedFromExercise(picked));
                  }}
                  testID={`swap-${phaseKey}-${index}`}
                />
                <SmallButton
                  label={tx(language, 'Mudah', 'Easier')}
                  icon="arrow-down"
                  disabled={!exercise?.easierId}
                  onPress={() => {
                    const targetEx = EXERCISES.find((item) => item.id === exercise?.easierId);
                    if (!targetEx) {
                      Alert.alert(
                        tx(language, 'Belum ada variasi', 'No variation'),
                        tx(language, 'Tidak ada versi lebih mudah.', 'No easier version.'),
                      );
                      return;
                    }
                    onReplace(phaseKey, index, buildPlannedFromExercise(targetEx));
                  }}
                  testID={`easier-${phaseKey}-${index}`}
                />
                <SmallButton
                  label={tx(language, 'Sulit', 'Harder')}
                  icon="arrow-up"
                  disabled={!exercise?.harderId}
                  onPress={() => {
                    const targetEx = EXERCISES.find((item) => item.id === exercise?.harderId);
                    if (!targetEx) {
                      Alert.alert(
                        tx(language, 'Belum ada variasi', 'No variation'),
                        tx(language, 'Tidak ada versi lebih sulit.', 'No harder version.'),
                      );
                      return;
                    }
                    onReplace(phaseKey, index, buildPlannedFromExercise(targetEx));
                  }}
                  testID={`harder-${phaseKey}-${index}`}
                />
                <SmallButton
                  label={tx(language, 'Hapus', 'Delete')}
                  icon="trash-2"
                  danger
                  onPress={() => onDelete(phaseKey, index)}
                  testID={`delete-${phaseKey}-${index}`}
                />
                <SmallButton
                  label="↑"
                  disabled={index === 0}
                  onPress={() => onMove(phaseKey, index, -1)}
                  testID={`move-up-${phaseKey}-${index}`}
                />
                <SmallButton
                  label="↓"
                  disabled={index === exercises.length - 1}
                  onPress={() => onMove(phaseKey, index, 1)}
                  testID={`move-down-${phaseKey}-${index}`}
                />
              </View>
            </View>
          );
        })}
      </Surface>
    </View>
  );
}

export default function PlanPreviewScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ planId?: string | string[] }>();
  const { snapshot, ready, setCurrentPlan, savePlanTemplate } = useApp();
  const language = snapshot.settings.language;
  const [saved, setSaved] = useState(false);
  // FR-04.3: state lokal plan yang diedit.
  const [edited, setEdited] = useState<WorkoutPlan | null>(null);
  // FR-04.5: lewati warm-up / cooldown.
  const [skipWarmup, setSkipWarmup] = useState(false);
  const [skipCooldown, setSkipCooldown] = useState(false);

  const planId = Array.isArray(params.planId) ? params.planId[0] : params.planId;
  const plan: WorkoutPlan | undefined =
    snapshot.currentPlan?.id === planId
      ? snapshot.currentPlan ?? undefined
      : snapshot.savedPlans.find((item) => item.id === planId);

  useEffect(() => {
    if (plan) {
      setEdited(plan);
      setSaved(false);
      setSkipWarmup(false);
      setSkipCooldown(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]);

  const effective: WorkoutPlan | undefined = edited ?? plan;

  const updatePhase = (phaseKey: PhaseKey, updater: (list: PlannedExercise[]) => PlannedExercise[]) => {
    setEdited((current) => {
      if (!current) return current;
      return { ...current, [phaseKey]: updater(current[phaseKey]) };
    });
    setSaved(false);
  };

  const handleReplace = (phaseKey: PhaseKey, index: number, next: PlannedExercise) => {
    updatePhase(phaseKey, (list) => list.map((item, i) => (i === index ? next : item)));
  };

  const handleDelete = (phaseKey: PhaseKey, index: number) => {
    if (phaseKey === 'training' && (effective?.training.length ?? 0) <= 1) {
      Alert.alert(
        tx(language, 'Tidak bisa dihapus', 'Cannot delete'),
        tx(language, 'Sisakan minimal 1 gerakan utama.', 'Keep at least 1 main movement.'),
      );
      return;
    }
    updatePhase(phaseKey, (list) => list.filter((_, i) => i !== index));
  };

  const handleMove = (phaseKey: PhaseKey, index: number, direction: -1 | 1) => {
    updatePhase(phaseKey, (list) => {
      const target = index + direction;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  if (!ready || !plan || !effective) {
    return (
      <AppScreen>
        <View style={styles.missing}>
          <Feather name={ready ? 'alert-circle' : 'loader'} size={24} color={colors.primary} />
          <Text style={[styles.missingText, { color: colors.mutedForeground }]}>
            {ready
              ? tx(language, 'Rencana ini tidak ditemukan. Buat rencana baru untuk melanjutkan.', 'This plan could not be found. Create a new plan to continue.')
              : tx(language, 'Memuat pratinjau…', 'Loading preview…')}
          </Text>
          {ready ? (
            <ActionButton
              title={tx(language, 'Buka pembuat rencana', 'Open plan builder')}
              onPress={() => router.replace('/plan')}
            />
          ) : null}
        </View>
      </AppScreen>
    );
  }

  const startWorkout = () => {
    if (!effective.training.length) {
      Alert.alert(
        tx(language, 'Rencana kosong', 'Empty plan'),
        tx(language, 'Tambahkan minimal 1 gerakan utama sebelum mulai.', 'Add at least 1 main movement before starting.'),
      );
      return;
    }
    // FR-04.5: bila dilewati, plan dimulai langsung training.
    const toStart: WorkoutPlan = {
      ...effective,
      warmup: skipWarmup ? [] : effective.warmup,
      cooldown: skipCooldown ? [] : effective.cooldown,
    };
    setCurrentPlan(toStart);
    router.replace('/workout');
  };

  const confirmSkip = (
    kind: 'warmup' | 'cooldown',
    nextValue: boolean,
    apply: (value: boolean) => void,
  ) => {
    if (!nextValue) {
      apply(false);
      return;
    }
    Alert.alert(
      kind === 'warmup'
        ? tx(language, 'Lewati pemanasan?', 'Skip warm-up?')
        : tx(language, 'Lewati pendinginan?', 'Skip cool-down?'),
      kind === 'warmup'
        ? tx(language, 'Pemanasan mengurangi risiko cedera. Sesi akan langsung ke latihan utama.', 'Warming up lowers injury risk. The session will jump straight to training.')
        : tx(language, 'Pendinginan membantu pemulihan. Sesi akan berakhir setelah latihan utama.', 'Cooling down aids recovery. The session will end after training.'),
      [
        { text: tx(language, 'Batal', 'Cancel'), style: 'cancel' },
        { text: tx(language, 'Lewati', 'Skip'), style: 'destructive', onPress: () => apply(true) },
      ],
    );
  };

  const focusLabels = effective.focusAreas
    .map((id) => MUSCLES.find((muscle) => muscle.id === id))
    .filter((muscle) => muscle !== undefined)
    .map((muscle) => (language === 'en' ? muscle.englishLabel : muscle.label));

  const usedIds = new Set([
    ...effective.warmup.map((item) => item.exerciseId),
    ...effective.training.map((item) => item.exerciseId),
    ...effective.cooldown.map((item) => item.exerciseId),
  ]);

  const alreadySaved = snapshot.savedPlans.some((item) => item.id === effective.id);

  return (
    <AppScreen contentStyle={styles.page}>
      <PageHeader
        eyebrow={tx(language, 'PRATINJAU RENCANA', 'PLAN PREVIEW')}
        title={effective.title}
        subtitle={tx(language, 'Ketuk nama untuk detail. Sesuaikan susunan sebelum mulai.', 'Tap a name for details. Adjust the order before starting.')}
      />

      <Surface style={[styles.summaryCard, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        <View style={styles.summaryTop}>
          <View style={[styles.durationMark, { backgroundColor: colors.accent }]}>
            <Feather name="clock" size={19} color={colors.accentForeground} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={[styles.durationValue, { color: colors.primaryForeground }]}>
              {effective.durationMinutes} {tx(language, 'menit', 'min')}
            </Text>
            <Text style={[styles.durationLabel, { color: colors.primaryForeground }]}>
              {`${effective.training.length} ${tx(language, 'gerakan utama', 'main movements')} · ${effective.level === 'beginner' ? tx(language, 'Pemula', 'Beginner') : effective.level === 'intermediate' ? tx(language, 'Menengah', 'Intermediate') : tx(language, 'Lanjut', 'Advanced')}`}
            </Text>
          </View>
          {effective.silentMode ? <Feather name="volume-x" size={18} color={colors.accent} /> : null}
        </View>
        <View style={styles.focusPills}>
          {focusLabels.map((label) => (
            <View key={label} style={[styles.focusPill, { backgroundColor: `${colors.primaryForeground}1A` }]}>
              <Text style={[styles.focusText, { color: colors.primaryForeground }]}>{label}</Text>
            </View>
          ))}
        </View>
      </Surface>

      {/* FR-04.5: toggle lewati warm-up / cooldown */}
      <Surface style={styles.skipCard}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: skipWarmup }}
          onPress={() => confirmSkip('warmup', !skipWarmup, setSkipWarmup)}
          style={styles.skipRow}
        >
          <View style={styles.skipCopy}>
            <Text style={[styles.skipTitle, { color: colors.foreground }]}>
              {tx(language, 'Lewati warm-up', 'Skip warm-up')}
            </Text>
            <Text style={[styles.skipHint, { color: colors.mutedForeground }]}>
              {tx(language, 'Mulai langsung latihan utama.', 'Start directly with training.')}
            </Text>
          </View>
          <View style={[styles.switchMark, { backgroundColor: skipWarmup ? colors.primary : colors.border }]}>
            <View
              style={[
                styles.switchKnob,
                { alignSelf: skipWarmup ? 'flex-end' : 'flex-start', backgroundColor: colors.card },
              ]}
            />
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: skipCooldown }}
          onPress={() => confirmSkip('cooldown', !skipCooldown, setSkipCooldown)}
          style={[styles.skipRow, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
        >
          <View style={styles.skipCopy}>
            <Text style={[styles.skipTitle, { color: colors.foreground }]}>
              {tx(language, 'Lewati cooldown', 'Skip cool-down')}
            </Text>
            <Text style={[styles.skipHint, { color: colors.mutedForeground }]}>
              {tx(language, 'Akhiri setelah latihan utama.', 'Finish right after training.')}
            </Text>
          </View>
          <View style={[styles.switchMark, { backgroundColor: skipCooldown ? colors.primary : colors.border }]}>
            <View
              style={[
                styles.switchKnob,
                { alignSelf: skipCooldown ? 'flex-end' : 'flex-start', backgroundColor: colors.card },
              ]}
            />
          </View>
        </Pressable>
      </Surface>

      {!skipWarmup && effective.warmup.length ? (
        <EditablePhaseCard
          phase="warm-up"
          phaseKey="warmup"
          exercises={effective.warmup}
          language={language}
          planLevel={effective.level}
          allowedFurniture={snapshot.settings.allowedFurniture}
          silentMode={effective.silentMode}
          sessions={snapshot.sessions}
          usedIds={usedIds}
          onReplace={handleReplace}
          onDelete={handleDelete}
          onMove={handleMove}
        />
      ) : null}
      <EditablePhaseCard
        phase="training"
        phaseKey="training"
        exercises={effective.training}
        language={language}
        planLevel={effective.level}
        allowedFurniture={snapshot.settings.allowedFurniture}
        silentMode={effective.silentMode}
        sessions={snapshot.sessions}
        usedIds={usedIds}
        onReplace={handleReplace}
        onDelete={handleDelete}
        onMove={handleMove}
      />
      {!skipCooldown && effective.cooldown.length ? (
        <EditablePhaseCard
          phase="cooldown"
          phaseKey="cooldown"
          exercises={effective.cooldown}
          language={language}
          planLevel={effective.level}
          allowedFurniture={snapshot.settings.allowedFurniture}
          silentMode={effective.silentMode}
          sessions={snapshot.sessions}
          usedIds={usedIds}
          onReplace={handleReplace}
          onDelete={handleDelete}
          onMove={handleMove}
        />
      ) : null}

      {snapshot.activeWorkout ? (
        <Surface style={styles.activeNotice}>
          <Feather name="pause-circle" size={18} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
            {tx(language, 'Sesi sebelumnya masih tersimpan. Lanjutkan sesi tersebut sebelum memulai rencana lain.', 'A previous workout is still in progress. Resume it before starting another plan.')}
          </Text>
        </Surface>
      ) : null}

      <ActionButton
        title={snapshot.activeWorkout
          ? tx(language, 'Lanjutkan sesi sebelumnya', 'Resume previous workout')
          : tx(language, 'Mulai latihan', 'Start workout')}
        onPress={startWorkout}
        testID="start-workout"
      />
      <ActionButton
        title={saved || alreadySaved
          ? tx(language, 'Tersimpan sebagai template', 'Saved as a template')
          : tx(language, 'Simpan sebagai template', 'Save as a template')}
        variant="outline"
        disabled={saved || alreadySaved}
        onPress={() => {
          // FR-04.3: simpan versi edit (state lokal), bukan plan asli.
          savePlanTemplate(effective);
          setCurrentPlan(effective);
          setSaved(true);
        }}
        testID="save-plan-template"
      />
      <Text style={[styles.safetyNote, { color: colors.mutedForeground }]}>
        {tx(language, 'Berhenti jika terasa nyeri, pusing, atau tidak aman. Timer berhenti saat sesi dijeda atau aplikasi masuk latar belakang.', 'Stop if you feel pain, dizziness, or unsafe. Timers pause when you pause the workout or leave the app.')}
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 18, paddingBottom: 28 },
  summaryCard: { gap: 14 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  durationMark: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, gap: 3 },
  durationValue: { fontSize: 21, fontWeight: '800' },
  durationLabel: { fontSize: 12, lineHeight: 17 },
  focusPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  focusPill: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  focusText: { fontSize: 11, fontWeight: '600' },
  skipCard: { gap: 0, paddingVertical: 4, paddingHorizontal: 14 },
  skipRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  skipCopy: { flex: 1, gap: 2 },
  skipTitle: { fontSize: 14, fontWeight: '700' },
  skipHint: { fontSize: 12, lineHeight: 17 },
  switchMark: { width: 42, height: 25, borderRadius: 13, padding: 3, justifyContent: 'center' },
  switchKnob: { width: 19, height: 19, borderRadius: 10 },
  phase: { gap: 9 },
  exerciseList: { paddingVertical: 2, paddingHorizontal: 13 },
  exerciseBlock: { paddingVertical: 9, gap: 8 },
  exerciseRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 11 },
  exerciseNumber: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numberText: { fontSize: 11, fontWeight: '800' },
  exerciseCopy: { flex: 1, gap: 4 },
  exerciseName: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  exerciseLink: { textDecorationLine: 'underline' },
  exerciseMeta: { fontSize: 12, lineHeight: 16 },
  suggestionBox: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  suggestionText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  controlsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    minHeight: 32,
  },
  smallBtnText: { fontSize: 11, fontWeight: '700' },
  activeNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  safetyNote: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  missing: { gap: 13, alignItems: 'center', justifyContent: 'center', flex: 1, padding: 24 },
  missingText: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
});
