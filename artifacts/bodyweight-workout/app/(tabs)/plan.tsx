import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ActionButton,
  AppScreen,
  PageHeader,
  Pill,
  SectionHeading,
  Surface,
} from '@/components/WorkoutUI';
import { useColors } from '@/hooks/useColors';
import { AnatomyMap, AnatomySide } from '@/features/focus/AnatomyMap';
import { MUSCLES, MUSCLE_PRESETS } from '@/src/data/muscles';
import { generateWorkoutPlan, isFullBodyRequest } from '@/src/features/planner/generatePlan';
import { tx } from '@/src/i18n';
import { useApp } from '@/src/store/AppContext';
import { Experience, Furniture, MuscleId, WorkoutPlan } from '@/src/types';

const DURATIONS: WorkoutPlan['durationMinutes'][] = [15, 30, 45, 60];
const LEVELS: Experience[] = ['beginner', 'intermediate', 'advanced'];
const PRESETS = ['full', 'upper', 'lower', 'core'] as const;
const FURNITURE_OPTIONS: Array<{ id: Furniture; label: [string, string] }> = [
  { id: 'chair', label: ['Kursi kokoh', 'Sturdy chair'] },
  { id: 'wall', label: ['Dinding', 'Wall'] },
  { id: 'towel', label: ['Handuk', 'Towel'] },
];

function readFocusParam(value: string | string[] | undefined): MuscleId[] {
  const raw = Array.isArray(value) ? value[0] : value;
  const valid = [...new Set((raw ?? '').split(',').filter((id): id is MuscleId =>
    MUSCLES.some((muscle) => muscle.id === id),
  ))];
  return valid.length ? valid : MUSCLE_PRESETS.full.areas;
}

function isSameAreaSet(first: MuscleId[], second: MuscleId[]) {
  return first.length === second.length && first.every((area) => second.includes(area));
}

function levelLabel(level: Experience, language: 'id' | 'en') {
  const labels: Record<Experience, [string, string]> = {
    beginner: ['Pemula', 'Beginner'],
    intermediate: ['Menengah', 'Intermediate'],
    advanced: ['Lanjut', 'Advanced'],
  };
  return tx(language, ...labels[level]);
}

export default function PlanScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ focusAreas?: string | string[] }>();
  const { snapshot, ready, setCurrentPlan, savePlanTemplate, removePlanTemplate } = useApp();
  const language = snapshot.settings.language;
  const focusAreasParam = Array.isArray(params.focusAreas) ? params.focusAreas[0] : params.focusAreas;
  const [focusAreas, setFocusAreas] = useState<MuscleId[]>(() => readFocusParam(focusAreasParam));
  const [mapSide, setMapSide] = useState<AnatomySide>('front');
  const [level, setLevel] = useState<Experience>(snapshot.profile?.experience ?? 'beginner');
  const [duration, setDuration] = useState<WorkoutPlan['durationMinutes']>(30);
  const [silentMode, setSilentMode] = useState(snapshot.settings.silentMode);
  const [furniture, setFurniture] = useState<Furniture[]>(snapshot.settings.allowedFurniture);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (focusAreasParam !== undefined) {
      setFocusAreas(readFocusParam(focusAreasParam));
    }
  }, [focusAreasParam]);

  useEffect(() => {
    if (!ready) return;
    setLevel(snapshot.profile?.experience ?? 'beginner');
    setSilentMode(snapshot.settings.silentMode);
    setFurniture(snapshot.settings.allowedFurniture);
  }, [
    ready,
    snapshot.profile?.experience,
    snapshot.settings.silentMode,
    snapshot.settings.allowedFurniture,
  ]);

  const selectedPreset = PRESETS.find((preset) =>
    isSameAreaSet(focusAreas, MUSCLE_PRESETS[preset].areas),
  );
  // Varian anatomi mengikuti gender onboarding (female/male saja).
  const anatomyGender = snapshot.profile?.gender ?? 'male';
  const focusLabels = focusAreas
    .map((id) => MUSCLES.find((muscle) => muscle.id === id))
    .filter((muscle): muscle is (typeof MUSCLES)[number] => Boolean(muscle))
    .map((muscle) => (language === 'en' ? muscle.englishLabel : muscle.label));

  const openPreview = (plan: WorkoutPlan) => {
    setCurrentPlan(plan);
    router.push({ pathname: '/plan-preview', params: { planId: plan.id } });
  };

  const generate = () => {
    setGenerating(true);
    try {
      const plan = generateWorkoutPlan({
        focusAreas,
        level,
        durationMinutes: duration,
        allowedFurniture: furniture,
        silentMode,
        language,
        // FR-03.3: teruskan riwayat sesi (opsional, non-breaking) untuk adaptasi.
        sessionHistory: snapshot.sessions,
      });
      if (!plan.training.length) {
        Alert.alert(
          tx(language, 'Belum ada gerakan yang cocok', 'No matching movements'),
          tx(language, 'Coba pilih area fokus lain atau izinkan lebih banyak perabot.', 'Try another focus area or allow more equipment.'),
        );
        return;
      }
      openPreview(plan);
    } finally {
      setGenerating(false);
    }
  };

  const toggleFocus = (id: MuscleId) => {
    if (focusAreas.length > 3) {
      setFocusAreas([id]);
      return;
    }
    if (focusAreas.includes(id)) {
      setFocusAreas(focusAreas.filter((area) => area !== id));
    } else if (focusAreas.length < 3) {
      setFocusAreas([...focusAreas, id]);
    } else {
      Alert.alert(
        tx(language, 'Batas area fokus', 'Focus area limit'),
        tx(language, 'Pilih maksimal tiga otot, atau gunakan salah satu kelompok tubuh.', 'Choose up to three muscles or use a body-group preset.'),
      );
    }
  };

  const confirmDelete = (plan: WorkoutPlan) => {
    Alert.alert(
      tx(language, 'Hapus template?', 'Delete template?'),
      tx(language, `“${plan.title}” akan dihapus dari daftar tersimpan.`, `“${plan.title}” will be removed from saved plans.`),
      [
        { text: tx(language, 'Batal', 'Cancel'), style: 'cancel' },
        {
          text: tx(language, 'Hapus', 'Delete'),
          style: 'destructive',
          onPress: () => removePlanTemplate(plan.id),
        },
      ],
    );
  };

  if (!ready) {
    return (
      <AppScreen>
        <Text style={[styles.muted, { color: colors.mutedForeground }]}>
          {tx(language, 'Memuat rencana…', 'Loading plans…')}
        </Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen contentStyle={styles.page}>
      <PageHeader
        eyebrow={tx(language, 'SESI BARU', 'NEW SESSION')}
        title={tx(language, 'Susun rencana', 'Build a plan')}
        subtitle={tx(language, 'Pilih fokus, level, dan waktu. Gerakan disaring dari pustaka offline.', 'Choose a focus, level, and duration. Movements come from the offline library.')}
      />

      {snapshot.activeWorkout ? (
        <Surface style={[styles.resumeCard, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          <View style={styles.resumeCopy}>
            <Text style={[styles.resumeEyebrow, { color: colors.accent }]}>
              {tx(language, 'SESI SEDANG BERJALAN', 'WORKOUT IN PROGRESS')}
            </Text>
            <Text style={[styles.resumeTitle, { color: colors.primaryForeground }]}>
              {snapshot.activeWorkout.plan.title}
            </Text>
          </View>
          <ActionButton
            title={tx(language, 'Lanjutkan sesi', 'Resume workout')}
            variant="secondary"
            onPress={() => router.push('/workout')}
            testID="plan-resume-workout"
          />
        </Surface>
      ) : null}

      <View style={styles.section}>
        <SectionHeading title={tx(language, 'Area fokus', 'Focus areas')} />
        <View style={styles.presetGrid}>
          {PRESETS.map((preset) => {
            const label: Record<(typeof PRESETS)[number], [string, string]> = {
              full: ['Seluruh tubuh', 'Full body'],
              upper: ['Tubuh atas', 'Upper body'],
              lower: ['Tubuh bawah', 'Lower body'],
              core: ['Core', 'Core'],
            };
            return (
              <Pill
                key={preset}
                label={tx(language, ...label[preset])}
                selected={selectedPreset === preset}
                onPress={() => setFocusAreas(MUSCLE_PRESETS[preset].areas)}
                style={styles.choice}
              />
            );
          })}
        </View>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          {tx(language, 'Atau ketuk hingga tiga otot pada peta tubuh. Pilih kelompok tubuh untuk rencana yang lebih luas.', 'Or tap up to three muscles on the body map. Choose a body group for a broader plan.')}
        </Text>
        <View style={styles.optionRow}>
          {(['front', 'back'] as const).map((side) => (
            <Pill
              key={side}
              label={side === 'front' ? tx(language, 'Tampak depan', 'Front view') : tx(language, 'Tampak belakang', 'Back view')}
              selected={mapSide === side}
              onPress={() => setMapSide(side)}
              style={styles.choice}
            />
          ))}
        </View>
        <AnatomyMap
          gender={anatomyGender}
          side={mapSide}
          selected={focusAreas}
          language={language}
          onToggle={toggleFocus}
        />
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          {focusLabels.length
            ? tx(language, `Terpilih: ${focusLabels.join(', ')}`, `Selected: ${focusLabels.join(', ')}`)
            : tx(language, 'Belum ada otot dipilih.', 'No muscles selected yet.')}
        </Text>
        {isFullBodyRequest(focusAreas) ? (
          <Surface style={styles.fullBodyHint}>
            <Feather name="layers" size={16} color={colors.primary} />
            <Text style={[styles.helper, { color: colors.mutedForeground, flex: 1 }]}>
              {tx(
                language,
                'Mode Full Body: rencana akan mencakup minimal 1 push + 1 pull + 1 legs + 1 core bila kandidat tersedia.',
                'Full Body mode: the plan will include at least 1 push + 1 pull + 1 legs + 1 core when candidates exist.',
              )}
            </Text>
          </Surface>
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionHeading title={tx(language, 'Level latihan', 'Training level')} />
        <View style={styles.optionRow}>
          {LEVELS.map((item) => (
            <Pill
              key={item}
              label={levelLabel(item, language)}
              selected={level === item}
              onPress={() => setLevel(item)}
              style={styles.choice}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading title={tx(language, 'Durasi sesi', 'Session duration')} />
        <View style={styles.optionRow}>
          {DURATIONS.map((minutes) => (
            <Pill
              key={minutes}
              label={`${minutes} ${tx(language, 'menit', 'min')}`}
              selected={duration === minutes}
              onPress={() => setDuration(minutes)}
              style={styles.choice}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeading title={tx(language, 'Peralatan & lingkungan', 'Equipment & environment')} />
        <Surface style={styles.preferenceCard}>
          <Text style={[styles.muscleText, { color: colors.foreground }]}>
            {tx(language, 'Hanya gunakan benda yang aman dan stabil.', 'Only use safe, stable furniture.')}
          </Text>
          <View style={styles.optionRow}>
            {FURNITURE_OPTIONS.map((item) => {
              const selected = furniture.includes(item.id);
              return (
                <Pill
                  key={item.id}
                  label={tx(language, ...item.label)}
                  selected={selected}
                  onPress={() =>
                    setFurniture((current) =>
                      current.includes(item.id)
                        ? current.filter((value) => value !== item.id)
                        : [...current, item.id],
                    )
                  }
                  style={styles.choice}
                />
              );
            })}
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: silentMode }}
            onPress={() => setSilentMode((value) => !value)}
            style={[styles.quietRow, { borderTopColor: colors.border }]}
          >
            <View style={[styles.quietIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="volume-x" size={17} color={colors.primary} />
            </View>
            <View style={styles.quietCopy}>
              <Text style={[styles.quietTitle, { color: colors.foreground }]}>
                {tx(language, 'Mode hening', 'Quiet mode')}
              </Text>
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                {tx(language, 'Hindari lompatan dan gerakan berdampak tinggi.', 'Avoid jumps and high-impact moves.')}
              </Text>
            </View>
            <View style={[styles.switchMark, { backgroundColor: silentMode ? colors.primary : colors.border }]}>
              <View style={[styles.switchKnob, { alignSelf: silentMode ? 'flex-end' : 'flex-start', backgroundColor: colors.card }]} />
            </View>
          </Pressable>
        </Surface>
      </View>

      <ActionButton
        title={tx(language, 'Buat rencana latihan', 'Generate workout plan')}
        onPress={generate}
        loading={generating}
        disabled={!focusAreas.length}
        testID="generate-workout-plan"
      />

      {snapshot.savedPlans.length ? (
        <View style={styles.section}>
          <SectionHeading title={tx(language, 'Template tersimpan', 'Saved plans')} />
          {snapshot.savedPlans.map((plan) => (
            <Surface key={plan.id} style={styles.savedPlan}>
              <Pressable
                accessibilityRole="button"
                onPress={() => openPreview(plan)}
                style={styles.savedPlanMain}
              >
                <View style={[styles.savedPlanIcon, { backgroundColor: colors.accent }]}>
                  <Feather name="bookmark" size={17} color={colors.accentForeground} />
                </View>
                <View style={styles.savedPlanCopy}>
                  <Text numberOfLines={1} style={[styles.savedPlanTitle, { color: colors.foreground }]}>
                    {plan.title}
                  </Text>
                  <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                    {`${plan.durationMinutes} ${tx(language, 'menit', 'min')} · ${plan.training.length} ${tx(language, 'gerakan', 'moves')}`}
                  </Text>
                </View>
                <Feather name="chevron-right" size={19} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx(language, `Hapus template ${plan.title}`, `Delete ${plan.title} template`)}
                onPress={() => confirmDelete(plan)}
                style={({ pressed }) => [styles.deletePlan, pressed && styles.pressed]}
              >
                <Feather name="trash-2" size={17} color={colors.destructive} />
              </Pressable>
            </Surface>
          ))}
        </View>
      ) : (
        <Surface style={styles.emptySaved}>
          <Feather name="bookmark" size={18} color={colors.primary} />
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            {tx(language, 'Simpan rencana favorit dari halaman pratinjau agar mudah digunakan lagi.', 'Save a favorite plan from its preview to reuse it later.')}
          </Text>
        </Surface>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 18, paddingBottom: 26 },
  section: { gap: 11 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 42 },
  helper: { fontSize: 12, lineHeight: 18 },
  muscleText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preferenceCard: { gap: 13 },
  quietRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 13,
  },
  quietIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quietCopy: { flex: 1, gap: 2 },
  quietTitle: { fontSize: 14, fontWeight: '700' },
  switchMark: { width: 42, height: 25, borderRadius: 13, padding: 3, justifyContent: 'center' },
  switchKnob: { width: 19, height: 19, borderRadius: 10 },
  resumeCard: { gap: 12 },
  resumeCopy: { gap: 4 },
  resumeEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  resumeTitle: { fontSize: 17, fontWeight: '700' },
  savedPlan: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 9, paddingLeft: 10, paddingRight: 6 },
  savedPlanMain: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, minHeight: 50 },
  savedPlanIcon: { height: 38, width: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  savedPlanCopy: { flex: 1, gap: 3 },
  savedPlanTitle: { fontSize: 14, fontWeight: '700' },
  deletePlan: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  emptySaved: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  fullBodyHint: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  muted: { fontSize: 14, textAlign: 'center', paddingTop: 30 },
  pressed: { opacity: 0.72 },
});