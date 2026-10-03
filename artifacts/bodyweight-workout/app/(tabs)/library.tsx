import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppScreen, PageHeader, Surface } from '@/components/WorkoutUI';
import { useColors } from '@/hooks/useColors';
import { EXERCISES } from '@/src/data/exercises';
import { MUSCLES } from '@/src/data/muscles';
import { tx } from '@/src/i18n';
import { Exercise, Experience, Furniture, WorkoutPhase } from '@/src/types';
import { useApp } from '@/src/store/AppContext';

type PhaseFilter = 'all' | WorkoutPhase;
type LevelFilter = 'all' | Experience;
type FurnitureFilter = 'all' | 'none' | Furniture;

const LEVEL_RANK: Record<Experience, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

const levelLabel = (level: Experience, language: 'id' | 'en') => {
  const labels: Record<Experience, [string, string]> = {
    beginner: ['Pemula', 'Beginner'],
    intermediate: ['Menengah', 'Intermediate'],
    advanced: ['Lanjut', 'Advanced'],
  };
  return tx(language, ...labels[level]);
};

const phaseLabel = (phase: WorkoutPhase | 'all', language: 'id' | 'en') => {
  const labels: Record<WorkoutPhase | 'all', [string, string]> = {
    all: ['Semua fase', 'All phases'],
    'warm-up': ['Pemanasan', 'Warm-up'],
    training: ['Latihan utama', 'Training'],
    cooldown: ['Pendinginan', 'Cooldown'],
  };
  return tx(language, ...labels[phase]);
};

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        {
          backgroundColor: selected ? colors.primary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[styles.filterChipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ExerciseRow({
  exercise,
  language,
}: {
  exercise: Exercise;
  language: 'id' | 'en';
}) {
  const colors = useColors();
  const name = language === 'en' ? exercise.englishName : exercise.name;
  const muscleLabels = exercise.primaryMuscles
    .map((id) => {
      const muscle = MUSCLES.find((item) => item.id === id);
      return muscle ? (language === 'en' ? muscle.englishLabel : muscle.label) : id;
    })
    .join(' · ');
  return (
    <Surface
      onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })}
      accessibilityLabel={tx(language, `Detail latihan ${exercise.name}`, `${exercise.englishName} details`)}
      style={styles.exerciseCard}
    >
      <View style={[styles.miniFigure, { backgroundColor: colors.secondary }]}>
        <Feather
          name={
            exercise.category === 'legs'
              ? 'activity'
              : exercise.category === 'pull'
                ? 'move'
                : exercise.category === 'core'
                  ? 'circle'
                  : 'zap'
          }
          size={22}
          color={colors.primary}
        />
      </View>
      <View style={styles.exerciseCopy}>
        <Text numberOfLines={1} style={[styles.exerciseName, { color: colors.foreground }]}>{name}</Text>
        <Text numberOfLines={1} style={[styles.muscleLine, { color: colors.mutedForeground }]}>{muscleLabels}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.primary }]}>{levelLabel(exercise.levelMin, language)}</Text>
          <View style={[styles.metaDot, { backgroundColor: colors.border }]} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {exercise.measurement === 'reps'
              ? tx(language, `${exercise.targetReps ?? 10} repetisi`, `${exercise.targetReps ?? 10} reps`)
              : tx(language, `${exercise.targetSeconds ?? 30} dtk`, `${exercise.targetSeconds ?? 30} sec`)}
          </Text>
        </View>
        {exercise.impact === 'high' || exercise.unilateral ? (
          <View style={styles.badgeRow}>
            {exercise.impact === 'high' ? (
              <View
                accessibilityLabel={tx(language, 'Dampak tinggi', 'High impact')}
                style={[styles.badge, { backgroundColor: colors.destructive }]}
              >
                <Feather name="zap" size={10} color="#FFFFFF" />
                <Text style={styles.badgeText}>{tx(language, 'High-impact', 'High-impact')}</Text>
              </View>
            ) : null}
            {exercise.unilateral ? (
              <View
                accessibilityLabel={tx(language, 'Unilateral, dua sisi', 'Unilateral, both sides')}
                style={[styles.badge, styles.badgeOutline, { borderColor: colors.border, backgroundColor: colors.card }]}
              >
                <Text style={[styles.badgeOutlineText, { color: colors.foreground }]}>L/R</Text>
                <Text style={[styles.badgeSmallText, { color: colors.mutedForeground }]}>
                  {tx(language, 'Unilateral', 'Unilateral')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
    </Surface>
  );
}

export default function LibraryScreen() {
  const colors = useColors();
  const { snapshot } = useApp();
  const language = snapshot.settings.language;
  const [search, setSearch] = useState('');
  const [phase, setPhase] = useState<PhaseFilter>('all');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [muscle, setMuscle] = useState('all');
  const [furniture, setFurniture] = useState<FurnitureFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return EXERCISES.filter((exercise) => {
      const matchesQuery =
        !query ||
        exercise.name.toLocaleLowerCase().includes(query) ||
        exercise.englishName.toLocaleLowerCase().includes(query) ||
        exercise.id.includes(query);
      const matchesPhase = phase === 'all' || exercise.phase === phase;
      const matchesLevel = level === 'all' || LEVEL_RANK[exercise.levelMin] <= LEVEL_RANK[level];
      const matchesMuscle =
        muscle === 'all' ||
        exercise.primaryMuscles.includes(muscle as Exercise['primaryMuscles'][number]) ||
        exercise.secondaryMuscles.includes(muscle as Exercise['secondaryMuscles'][number]);
      const matchesFurniture =
        furniture === 'all' ||
        (furniture === 'none' ? exercise.furniture.length === 0 : exercise.furniture.includes(furniture));
      return matchesQuery && matchesPhase && matchesLevel && matchesMuscle && matchesFurniture;
    });
  }, [search, phase, level, muscle, furniture]);

  const resetFilters = () => {
    setSearch('');
    setPhase('all');
    setLevel('all');
    setMuscle('all');
    setFurniture('all');
  };

  const listHeader = (
    <View style={styles.listHeader}>
      <PageHeader
        eyebrow={tx(language, 'GERAK · PUSTAKA', 'GERAK · LIBRARY')}
        title={tx(language, 'Pustaka latihan', 'Exercise library')}
        subtitle={tx(language, 'Gerakan tanpa alat, tersusun menurut area dan level.', 'Bodyweight moves, organized by focus and level.')}
      />
      <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={tx(language, 'Cari gerakan atau otot', 'Search moves or muscles')}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={tx(language, 'Cari latihan', 'Search exercises')}
          returnKeyType="search"
          style={[styles.searchInput, { color: colors.foreground }]}
          testID="library-search"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel={tx(language, 'Hapus pencarian', 'Clear search')}>
            <Feather name="x-circle" size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
        {(['all', 'training', 'warm-up', 'cooldown'] as PhaseFilter[]).map((item) => (
          <FilterChip key={item} selected={phase === item} onPress={() => setPhase(item)} label={phaseLabel(item, language)} />
        ))}
      </ScrollView>
      <View style={styles.filterHeading}>
        <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
          {tx(language, `${filtered.length} dari ${EXERCISES.length} gerakan`, `${filtered.length} of ${EXERCISES.length} movements`)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          onPress={() => setFiltersOpen((open) => !open)}
          style={({ pressed }) => [styles.filterToggle, pressed && styles.pressed]}
        >
          <Feather name="sliders" size={15} color={colors.primary} />
          <Text style={[styles.filterToggleText, { color: colors.primary }]}>
            {tx(language, filtersOpen ? 'Tutup filter' : 'Filter', filtersOpen ? 'Hide filters' : 'Filters')}
          </Text>
        </Pressable>
      </View>
      {filtersOpen ? (
        <View style={styles.filterPanel}>
          <Text style={[styles.filterLabel, { color: colors.foreground }]}>{tx(language, 'Otot', 'Muscle')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
            <FilterChip selected={muscle === 'all'} onPress={() => setMuscle('all')} label={tx(language, 'Semua', 'All')} />
            {MUSCLES.map((item) => (
              <FilterChip
                key={item.id}
                selected={muscle === item.id}
                onPress={() => setMuscle(item.id)}
                label={language === 'en' ? item.englishLabel : item.label}
              />
            ))}
          </ScrollView>
          <Text style={[styles.filterLabel, { color: colors.foreground }]}>{tx(language, 'Level minimum', 'Minimum level')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
            {(['all', 'beginner', 'intermediate', 'advanced'] as LevelFilter[]).map((item) => (
              <FilterChip key={item} selected={level === item} onPress={() => setLevel(item)} label={item === 'all' ? tx(language, 'Semua', 'All') : levelLabel(item, language)} />
            ))}
          </ScrollView>
          <Text style={[styles.filterLabel, { color: colors.foreground }]}>{tx(language, 'Perabot', 'Furniture')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
            {([
              ['all', tx(language, 'Semua', 'All')],
              ['none', tx(language, 'Lantai kosong', 'No furniture')],
              ['chair', tx(language, 'Kursi', 'Chair')],
              ['wall', tx(language, 'Dinding', 'Wall')],
              ['towel', tx(language, 'Handuk', 'Towel')],
            ] as [FurnitureFilter, string][]).map(([id, label]) => (
              <FilterChip key={id} selected={furniture === id} onPress={() => setFurniture(id)} label={label} />
            ))}
          </ScrollView>
          <Pressable onPress={resetFilters} accessibilityRole="button" style={styles.resetButton}>
            <Text style={[styles.resetText, { color: colors.primary }]}>{tx(language, 'Hapus semua filter', 'Clear all filters')}</Text>
          </Pressable>
        </View>
      ) : (
        <Surface style={styles.noteCard}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            {tx(language, 'Latihan bisep tanpa alat memang terbatas. Pilihan handuk dan meja kokoh selalu diberi peringatan keamanan.', 'No-equipment biceps options are limited. Towel and sturdy-table movements include safety notes.')}
          </Text>
        </Surface>
      )}
    </View>
  );

  return (
    <AppScreen scroll={false}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={filtered.length > 0}
        renderItem={({ item }) => <ExerciseRow exercise={item} language={language} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <Surface style={styles.emptyState}>
            <Feather name="search" size={22} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{tx(language, 'Latihan tidak ditemukan', 'No exercises found')}</Text>
            <Text style={[styles.emptyMessage, { color: colors.mutedForeground }]}>{tx(language, 'Coba kata kunci atau filter lain.', 'Try a different search or filter.')}</Text>
            <Pressable onPress={resetFilters} accessibilityRole="button">
              <Text style={[styles.resetText, { color: colors.primary }]}>{tx(language, 'Reset pencarian', 'Reset search')}</Text>
            </Pressable>
          </Surface>
        }
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 20, paddingBottom: 22, gap: 10 },
  listHeader: { gap: 15, paddingTop: 10, paddingBottom: 8 },
  searchBox: { minHeight: 50, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  searchInput: { flex: 1, minHeight: 48, fontSize: 14, paddingVertical: 8 },
  chipRail: { alignItems: 'center', gap: 8, paddingRight: 18 },
  filterChip: { minHeight: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 13, justifyContent: 'center', alignItems: 'center' },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  filterHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 1 },
  resultCount: { fontSize: 12, fontWeight: '600' },
  filterToggle: { minHeight: 40, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterToggleText: { fontSize: 13, fontWeight: '700' },
  filterPanel: { gap: 10, paddingBottom: 3 },
  filterLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  resetButton: { alignSelf: 'flex-start', minHeight: 38, justifyContent: 'center' },
  resetText: { fontSize: 13, fontWeight: '700' },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
  exerciseCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 84 },
  miniFigure: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  exerciseCopy: { flex: 1, minWidth: 0, gap: 4 },
  exerciseName: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  muscleLine: { fontSize: 11, lineHeight: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaText: { fontSize: 10, lineHeight: 14, fontWeight: '600' },
  metaDot: { width: 3, height: 3, borderRadius: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 9, lineHeight: 12, fontWeight: '800', color: '#FFFFFF' },
  badgeOutline: { borderWidth: 1 },
  badgeOutlineText: { fontSize: 9, lineHeight: 12, fontWeight: '800' },
  badgeSmallText: { fontSize: 9, lineHeight: 12, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 26, marginTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyMessage: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  pressed: { opacity: 0.75 },
});