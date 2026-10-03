import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { AppScreen, ActionButton, PageHeader, SectionHeading, Surface } from '@/components/WorkoutUI';
import { useColors } from '@/hooks/useColors';
import { ExerciseIllustration } from '@/features/library/ExerciseIllustration';
import { EXERCISES } from '@/src/data/exercises';
import { MUSCLES } from '@/src/data/muscles';
import { tx } from '@/src/i18n';
import { Exercise, Experience, Furniture } from '@/src/types';
import { useApp } from '@/src/store/AppContext';

function MusclePill({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View style={[styles.musclePill, { backgroundColor: colors.secondary }]}>
      <Text style={[styles.musclePillText, { color: colors.secondaryForeground }]}>{label}</Text>
    </View>
  );
}

function ProgressionLink({
  title,
  exercise,
}: {
  title: string;
  exercise: Exercise | undefined;
}) {
  const colors = useColors();
  const { snapshot } = useApp();
  const language = snapshot.settings.language;
  if (!exercise) {
    return (
      <View style={[styles.progressionDisabled, { borderColor: colors.border }]}>
        <Text style={[styles.progressionHint, { color: colors.mutedForeground }]}>{title}</Text>
        <Text style={[styles.progressionName, { color: colors.mutedForeground }]}>{tx(language, 'Belum ada variasi', 'No variation available')}</Text>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.replace({ pathname: '/exercise/[id]', params: { id: exercise.id } })}
      style={({ pressed }) => [
        styles.progressionCard,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[styles.progressionHint, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={styles.progressionNameRow}>
        <Text style={[styles.progressionName, { color: colors.foreground }]}>{language === 'en' ? exercise.englishName : exercise.name}</Text>
        <Feather name="arrow-up-right" size={16} color={colors.primary} />
      </View>
    </Pressable>
  );
}

export default function ExerciseDetailScreen() {
  const colors = useColors();
  const { snapshot } = useApp();
  const language = snapshot.settings.language;
  const params = useLocalSearchParams<{ id?: string | string[]; from?: string | string[]; planId?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  const planId = Array.isArray(params.planId) ? params.planId[0] : params.planId;
  const exercise = useMemo(() => EXERCISES.find((item) => item.id === id), [id]);

  const handleBack = () => {
    if (from === 'plan-preview') {
      if (planId) {
        router.replace({ pathname: '/plan-preview', params: { planId } });
        return;
      }
      if (router.canGoBack()) {
        router.back();
        return;
      }
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/library');
  };

  if (!exercise) {
    return (
      <AppScreen>
        <PageHeader
          title={tx(language, 'Latihan tidak ditemukan', 'Exercise not found')}
          subtitle={tx(language, 'Latihan mungkin sudah tidak tersedia di pustaka.', 'This movement is not available in the library.')}
        />
        <ActionButton title={tx(language, 'Kembali ke pustaka', 'Back to library')} onPress={() => router.replace('/(tabs)/library')} />
      </AppScreen>
    );
  }

  const primary = exercise.primaryMuscles.map((id) => MUSCLES.find((muscle) => muscle.id === id)).filter(Boolean);
  const secondary = exercise.secondaryMuscles.map((id) => MUSCLES.find((muscle) => muscle.id === id)).filter(Boolean);
  const easier = exercise.easierId ? EXERCISES.find((item) => item.id === exercise.easierId) : undefined;
  const harder = exercise.harderId ? EXERCISES.find((item) => item.id === exercise.harderId) : undefined;
  const name = language === 'en' ? exercise.englishName : exercise.name;
  const target = exercise.measurement === 'reps'
    ? tx(language, `${exercise.defaultSets} set × ${exercise.targetReps ?? 10} repetisi`, `${exercise.defaultSets} sets × ${exercise.targetReps ?? 10} reps`)
    : tx(language, `${exercise.defaultSets} set × ${exercise.targetSeconds ?? 30} dtk`, `${exercise.defaultSets} set × ${exercise.targetSeconds ?? 30} sec`);
  const levelLabels: Record<Experience, readonly [string, string]> = {
    beginner: ['Pemula', 'Beginner'],
    intermediate: ['Menengah', 'Intermediate'],
    advanced: ['Lanjut', 'Advanced'],
  };
  const furnitureNames = exercise.furniture.map((item) => {
    const labels: Record<Furniture, readonly [string, string]> = {
      chair: ['Kursi kokoh', 'Sturdy chair'],
      wall: ['Dinding', 'Wall'],
      towel: ['Handuk', 'Towel'],
    };
    return tx(language, ...labels[item]);
  });
  const primaryHighlightId = exercise.primaryMuscles[0] ?? '';

  return (
    <AppScreen>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx(language, 'Kembali', 'Go back')}
          onPress={handleBack}
          style={({ pressed }) => [styles.backButton, { backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 }]}
        >
          <Feather name="arrow-left" size={19} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topLabel, { color: colors.mutedForeground }]}>{tx(language, 'DETAIL GERAKAN', 'MOVEMENT DETAILS')}</Text>
      </View>
      <PageHeader
        title={name}
        subtitle={tx(language, 'Lakukan dengan teknik nyaman dan terkontrol.', 'Move with a comfortable, controlled technique.')}
      />
      <Surface style={styles.illustrationSurface}>
        <ExerciseIllustration exercise={exercise} />
        <View style={styles.illustrationCaption}>
          <Feather name="repeat" size={14} color={colors.primary} />
          <Text style={[styles.illustrationCaptionText, { color: colors.mutedForeground }]}>
            {tx(language, 'Ilustrasi dua posisi bergantian', 'Two static movement frames')}
          </Text>
        </View>
      </Surface>
      <View style={styles.statsRow}>
        <Surface style={styles.statCard}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{tx(language, 'TARGET', 'TARGET')}</Text>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{target}</Text>
        </Surface>
        <Surface style={styles.statCard}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{tx(language, 'LEVEL', 'LEVEL')}</Text>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{tx(language, ...levelLabels[exercise.levelMin])}</Text>
        </Surface>
        <Surface style={styles.statCard}>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{tx(language, 'ISTIRAHAT', 'REST')}</Text>
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {tx(language, `${exercise.restSeconds} dtk`, `${exercise.restSeconds}s`)}
          </Text>
        </Surface>
      </View>
      {exercise.furniture.length ? (
        <Surface style={styles.safetyNote}>
          <Feather name="alert-triangle" size={18} color={colors.destructive} />
          <View style={styles.noteCopy}>
            <Text style={[styles.noteTitle, { color: colors.foreground }]}>{tx(language, `Perabot: ${furnitureNames.join(', ')}`, `Equipment: ${furnitureNames.join(', ')}`)}</Text>
            <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
              {tx(language, 'Pastikan semuanya stabil dan aman sebelum mulai. Jangan lanjut bila titik tumpu bergeser.', 'Check every support is stable before starting. Stop if anything shifts.')}
            </Text>
          </View>
        </Surface>
      ) : null}
      {exercise.id === 'towel-isometric-curl' || exercise.id === 'self-resisted-curl' || exercise.id === 'table-chin-up-hold' ? (
        <Surface style={styles.safetyNote}>
          <Feather name="info" size={18} color={colors.primary} />
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            {tx(language, 'Latihan bisep tanpa alat memang terbatas. Pilihan dengan handuk atau meja disertai peringatan keamanan.', 'Biceps training without equipment is limited. Towel and table variations require extra care.')}
          </Text>
        </Surface>
      ) : null}
      <Surface>
        <SectionHeading title={tx(language, 'Cara melakukan', 'How to do it')} />
        <View style={styles.instructionList}>
          {exercise.instructions.map((line, index) => (
            <View key={`${exercise.id}-step-${index}`} style={styles.instructionRow}>
              <View style={[styles.stepNumber, { backgroundColor: colors.accent }]}>
                <Text style={[styles.stepNumberText, { color: colors.accentForeground }]}>{index + 1}</Text>
              </View>
              <Text style={[styles.instructionText, { color: colors.foreground }]}>{line}</Text>
            </View>
          ))}
        </View>
      </Surface>
      <Surface>
        <SectionHeading title={tx(language, 'Otot yang dilatih', 'Muscles worked')} />
        <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>{tx(language, 'UTAMA', 'PRIMARY')}</Text>
        <View style={styles.muscleTags}>
          {primary.map((muscle) => muscle ? <MusclePill key={muscle.id} label={language === 'en' ? muscle.englishLabel : muscle.label} /> : null)}
        </View>
        {secondary.length ? (
          <>
            <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>{tx(language, 'PENDUKUNG', 'SECONDARY')}</Text>
            <View style={styles.muscleTags}>
              {secondary.map((muscle) => muscle ? <MusclePill key={muscle.id} label={language === 'en' ? muscle.englishLabel : muscle.label} /> : null)}
            </View>
          </>
        ) : null}
        {primaryHighlightId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx(language, 'Lihat otot di Peta', 'View muscle on Map')}
            onPress={() => router.push({ pathname: '/focus', params: { highlight: primaryHighlightId } })}
            style={({ pressed }) => [
              styles.mapButton,
              { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Feather name="map-pin" size={15} color={colors.primary} />
            <Text style={[styles.mapButtonText, { color: colors.primary }]}>
              {tx(language, 'Lihat otot di Peta', 'View muscle on Map')}
            </Text>
            <Feather name="arrow-up-right" size={15} color={colors.primary} />
          </Pressable>
        ) : null}
      </Surface>
      <Surface>
        <SectionHeading title={tx(language, 'Tips aman', 'Form & safety tips')} />
        {exercise.tips.map((tip, index) => (
          <View key={`${exercise.id}-tip-${index}`} style={styles.tipRow}>
            <Feather name="check" size={15} color={colors.primary} />
            <Text style={[styles.tipText, { color: colors.mutedForeground }]}>{tip}</Text>
          </View>
        ))}
      </Surface>
      <Surface>
        <SectionHeading title={tx(language, 'Rantai progresi', 'Progression chain')} />
        <ProgressionLink title={tx(language, 'LEBIH MUDAH', 'EASIER')} exercise={easier} />
        <ProgressionLink title={tx(language, 'LEBIH SULIT', 'HARDER')} exercise={harder} />
      </Surface>
      <View style={[styles.phaseFooter, { borderColor: colors.border }]}>
        <Text style={[styles.phaseText, { color: colors.mutedForeground }]}>
          {tx(language, 'Fase', 'Phase')}: {exercise.phase === 'training' ? tx(language, 'latihan utama', 'training') : exercise.phase === 'warm-up' ? tx(language, 'pemanasan', 'warm-up') : tx(language, 'pendinginan', 'cooldown')}
          {'  ·  '}
          {tx(language, `Istirahat ${exercise.restSeconds} dtk`, `${exercise.restSeconds}s rest`)}
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 3 },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  topLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  illustrationSurface: { padding: 8, gap: 0 },
  illustrationCaption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingBottom: 8 },
  illustrationCaptionText: { fontSize: 11, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, paddingVertical: 14, paddingHorizontal: 13, gap: 5 },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  statValue: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  safetyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 14, paddingHorizontal: 14 },
  noteCopy: { flex: 1, gap: 4 },
  noteTitle: { fontSize: 13, fontWeight: '700' },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },
  instructionList: { gap: 13, marginTop: 4 },
  instructionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNumber: { width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 11, fontWeight: '800' },
  instructionText: { flex: 1, fontSize: 14, lineHeight: 20, paddingTop: 1 },
  groupLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  muscleTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  musclePill: { borderRadius: 14, paddingHorizontal: 11, paddingVertical: 7 },
  musclePillText: { fontSize: 11, fontWeight: '600' },
  mapButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 14, minHeight: 44, marginTop: 12, paddingHorizontal: 12 },
  mapButtonText: { fontSize: 13, fontWeight: '700' },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19 },
  progressionCard: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 12, gap: 6 },
  progressionDisabled: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 12, gap: 6, opacity: 0.75 },
  progressionHint: { fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 0.8 },
  progressionNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  progressionName: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  phaseFooter: { paddingTop: 4, borderTopWidth: 1 },
  phaseText: { fontSize: 11, lineHeight: 17, textAlign: 'center' },
});