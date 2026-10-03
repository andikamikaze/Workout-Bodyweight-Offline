import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppScreen, ActionButton, PageHeader, Pill, SectionHeading, Surface } from '@/components/WorkoutUI';
import { useColors } from '@/hooks/useColors';
import { MUSCLES, MUSCLE_PRESETS } from '@/src/data/muscles';
import { tx } from '@/src/i18n';
import { useApp } from '@/src/store/AppContext';
import { MuscleId } from '@/src/types';
import { BodyMap } from '@/features/focus/BodyMap';

type BodySide = 'front' | 'back';
type PresetId = 'full' | 'upper' | 'lower' | 'core';

const PRESET_ORDER: PresetId[] = ['full', 'upper', 'lower', 'core'];
const MAX_FOCUS_AREAS = 3;

export default function FocusScreen() {
  const colors = useColors();
  const { snapshot } = useApp();
  const language = snapshot.settings.language;
  const [side, setSide] = useState<BodySide>('front');
  const [selected, setSelected] = useState<MuscleId[]>([]);
  const [preset, setPreset] = useState<PresetId | null>(null);

  // Swipe depan/belakang: ScrollView horizontal paging (fallback ringan pengganti
  // react-native-gesture-handler yang sudah ada di package.json ~2.32.0).
  // Segment Depan|Belakang tetap ada (role tablist/tab + testID) dan sinkron dua arah
  // dengan pager via scrollTo + onMomentumScrollEnd.
  const { width: windowWidth } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  // AppScreen paddingHorizontal 20*2 + Surface mapCard padding 12*2
  const pageWidth = Math.max(240, windowWidth - 40 - 24);

  useEffect(() => {
    pagerRef.current?.scrollTo({ x: side === 'front' ? 0 : pageWidth, animated: true });
  }, [side, pageWidth]);

  const handlePagerMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    const next: BodySide = x > pageWidth / 2 ? 'back' : 'front';
    if (next !== side) setSide(next);
  };

  const musclesForSide = useMemo(
    () => MUSCLES.filter((muscle) => muscle.side === side),
    [side],
  );

  const labelFor = (muscle: (typeof MUSCLES)[number]) =>
    language === 'id' ? muscle.label : muscle.englishLabel;

  // Label bilingual untuk TalkBack: selalu sertakan ID + EN agar terbaca dua bahasa.
  const bilingualLabelFor = (muscle: (typeof MUSCLES)[number]) =>
    `${muscle.label}, ${muscle.englishLabel}`;

  const toggleMuscle = (muscleId: MuscleId) => {
    const baseSelection = preset ? [] : selected;
    setPreset(null);
    if (baseSelection.includes(muscleId)) {
      setSelected(baseSelection.filter((id) => id !== muscleId));
      return;
    }
    if (baseSelection.length >= MAX_FOCUS_AREAS) {
      Alert.alert(
        tx(language, 'Batas area otot', 'Muscle area limit'),
        tx(
          language,
          'Pilih maksimal 3 area otot. Gunakan pintasan fokus jika ingin melatih satu kelompok tubuh.',
          'Select up to 3 muscle areas. Use a focus shortcut to target a larger body group.',
        ),
      );
      return;
    }
    setSelected([...baseSelection, muscleId]);
  };

  const applyPreset = (presetId: PresetId) => {
    if (preset === presetId) {
      setPreset(null);
      setSelected([]);
      return;
    }
    const areas = MUSCLE_PRESETS[presetId].areas;
    // FR-02: preset Full/Upper/Lower memilih >3 area. Jangan biarkan selected>3 lolos.
    // Tampilkan konfirmasi, terapkan 3 pertama bila disetujui (auto-trim).
    if (areas.length > MAX_FOCUS_AREAS) {
      Alert.alert(
        tx(language, 'Batas area otot', 'Muscle area limit'),
        tx(
          language,
          `Preset memilih ${areas.length} area, melebihi batas 3. Terapkan 3 pertama?`,
          `Preset selects ${areas.length} areas, exceeding the limit of 3. Apply first 3?`,
        ),
        [
          { text: tx(language, 'Batal', 'Cancel'), style: 'cancel' },
          {
            text: tx(language, 'Terapkan 3 pertama', 'Apply first 3'),
            onPress: () => {
              setPreset(presetId);
              setSelected(areas.slice(0, MAX_FOCUS_AREAS));
            },
          },
        ],
      );
      return;
    }
    setPreset(presetId);
    setSelected(areas.slice(0, MAX_FOCUS_AREAS));
  };

  const continueToPlan = () => {
    if (!selected.length) return;
    // Safety net: selalu ≤3 walau preset/edge-case lolos.
    const safeAreas = selected.slice(0, MAX_FOCUS_AREAS);
    router.push({
      pathname: '/plan',
      params: { focusAreas: safeAreas.join(',') },
    });
  };

  const badgeCount = Math.min(selected.length, MAX_FOCUS_AREAS);
  const selectionSummaryLabel =
    language === 'id'
      ? selected.length
        ? `Pilihan kamu: ${selected.map((id) => MUSCLES.find((m) => m.id === id)?.label ?? id).join(', ')}. ${selected.length} dari 3 area.`
        : 'Pilihan kamu: belum ada. Pilih area pada peta atau gunakan fokus cepat.'
      : selected.length
        ? `Your focus: ${selected.map((id) => MUSCLES.find((m) => m.id === id)?.englishLabel ?? id).join(', ')}. ${selected.length} of 3 areas.`
        : 'Your focus: empty. Choose an area on the map or use a quick focus.';

  return (
    <AppScreen contentStyle={styles.pageContent}>
      <PageHeader
        eyebrow={tx(language, 'Sesi baru', 'New session')}
        title={tx(language, 'Area fokus', 'Focus area')}
        subtitle={tx(
          language,
          'Pilih otot yang ingin kamu latih. Maksimal tiga area per sesi.',
          'Choose the muscles you want to train. Up to three areas per session.',
        )}
        right={
          <View
            style={[styles.countBadge, { backgroundColor: colors.accent }]}
            testID="focus-count-badge"
            accessible
            accessibilityLabel={tx(
              language,
              `${badgeCount} dari 3 area terpilih`,
              `${badgeCount} of 3 areas selected`,
            )}
          >
            <Text style={[styles.countText, { color: colors.accentForeground }]}>
              {badgeCount}/3
            </Text>
          </View>
        }
      />

      <View
        style={[styles.segment, { backgroundColor: colors.secondary, borderColor: colors.border }]}
        accessibilityRole="tablist"
        testID="focus-side-segment"
        accessibilityLabel={tx(language, 'Pilih tampilan depan atau belakang', 'Choose front or back view')}
      >
        {(['front', 'back'] as BodySide[]).map((view) => {
          const active = side === view;
          return (
            <Pressable
              key={view}
              testID={`side-tab-${view}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tx(
                language,
                view === 'front' ? 'Tampilan depan' : 'Tampilan belakang',
                view === 'front' ? 'Front view' : 'Back view',
              )}
              onPress={() => setSide(view)}
              style={[
                styles.segmentItem,
                active && { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.segmentText, { color: active ? colors.foreground : colors.mutedForeground }]}>
                {tx(language, view === 'front' ? 'Depan' : 'Belakang', view === 'front' ? 'Front' : 'Back')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Surface style={styles.mapCard}>
        <View style={styles.mapCardTop}>
          <Text style={[styles.mapLabel, { color: colors.foreground }]}>
            {tx(language, side === 'front' ? 'Tampak depan' : 'Tampak belakang', side === 'front' ? 'Front view' : 'Back view')}
          </Text>
          <View style={styles.mapHint}>
            <View style={[styles.legendDot, { backgroundColor: colors.accent, borderColor: colors.primary }]} />
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              {tx(language, 'Area terpilih', 'Selected')}
            </Text>
          </View>
        </View>
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          onMomentumScrollEnd={handlePagerMomentumEnd}
          testID="bodymap-pager"
          accessible
          accessibilityLabel={tx(
            language,
            'Geser kiri atau kanan untuk ganti tampak depan dan belakang',
            'Swipe left or right to switch front and back view',
          )}
          style={styles.pager}
        >
          <View style={[{ width: pageWidth }, styles.pagerPage]}>
            <BodyMap
              side="front"
              selected={selected}
              language={language}
              onToggle={toggleMuscle}
            />
          </View>
          <View style={[{ width: pageWidth }, styles.pagerPage]}>
            <BodyMap
              side="back"
              selected={selected}
              language={language}
              onToggle={toggleMuscle}
            />
          </View>
        </ScrollView>
        <Text style={[styles.tapHint, { color: colors.mutedForeground }]}>
          {tx(
            language,
            'Ketuk bagian tubuh untuk memilih otot. Geser kiri/kanan untuk ganti depan/belakang.',
            'Tap a body area to select a muscle. Swipe left/right to switch front/back.',
          )}
        </Text>
      </Surface>

      <View style={styles.contentBlock}>
        <SectionHeading title={tx(language, 'Fokus cepat', 'Quick focus')} />
        <View style={styles.presetRow}>
          {PRESET_ORDER.map((id) => {
            const definition = MUSCLE_PRESETS[id];
            const englishLabels: Record<PresetId, string> = {
              full: 'Full body',
              upper: 'Upper body',
              lower: 'Lower body',
              core: 'Core',
            };
            return (
              <Pill
                key={id}
                label={tx(language, definition.label, englishLabels[id])}
                selected={preset === id}
                onPress={() => applyPreset(id)}
                style={styles.presetPill}
              />
            );
          })}
        </View>
        <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
          {tx(
            language,
            'Pintasan memilih kelompok tubuh. Ketuk otot satu per satu untuk mengganti dengan pilihan maksimal 3 area.',
            'Shortcuts select a body group. Tap individual muscles to switch back to a maximum of 3 areas.',
          )}
        </Text>
      </View>

      <View style={styles.contentBlock}>
        <SectionHeading
          title={tx(language, 'Pilih satu per satu', 'Select individually')}
          action={
            selected.length || preset
              ? tx(language, 'Bersihkan', 'Clear')
              : undefined
          }
          onAction={() => {
            setSelected([]);
            setPreset(null);
          }}
        />
        <View
          style={styles.muscleList}
          testID="muscle-list"
          accessibilityLabel={tx(
            language,
            'Daftar otot tampak ini. Pilih satu per satu, maksimal 3 area.',
            'Muscle list for this view. Select individually, up to 3 areas.',
          )}
        >
          {musclesForSide.map((muscle) => {
            const active = selected.includes(muscle.id);
            return (
              <Pressable
                key={muscle.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                accessibilityLabel={bilingualLabelFor(muscle)}
                accessibilityHint={tx(
                  language,
                  active ? 'Ketuk untuk batal memilih' : 'Ketuk untuk memilih',
                  active ? 'Tap to deselect' : 'Tap to select',
                )}
                testID={`muscle-${muscle.id}`}
                onPress={() => toggleMuscle(muscle.id)}
                style={({ pressed }) => [
                  styles.muscleOption,
                  {
                    backgroundColor: active ? colors.accent : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={styles.optionCopy}>
                  <Text style={[styles.muscleName, { color: colors.foreground }]}>{labelFor(muscle)}</Text>
                  <Text style={[styles.muscleGroup, { color: colors.mutedForeground }]}>
                    {tx(
                      language,
                      muscle.group === 'upper' ? 'Tubuh atas' : muscle.group === 'lower' ? 'Tubuh bawah' : 'Core',
                      muscle.group === 'upper' ? 'Upper body' : muscle.group === 'lower' ? 'Lower body' : 'Core',
                    )}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: active ? colors.primary : 'transparent',
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  {active ? <Feather name="check" size={14} color={colors.primaryForeground} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        accessible
        testID="focus-selection-card"
        accessibilityLabel={selectionSummaryLabel}
        accessibilityRole="summary"
      >
      <Surface style={styles.selectionCard}>
        <View style={styles.selectionTop}>
          <Text style={[styles.selectionTitle, { color: colors.foreground }]}>
            {tx(language, 'Pilihan kamu', 'Your focus')}
          </Text>
          <Text style={[styles.selectionCount, { color: colors.mutedForeground }]}>
            {preset
              ? tx(
                  language,
                  `Kelompok tubuh • ${badgeCount} dari 3 area`,
                  `Body group • ${badgeCount} of 3 areas`,
                )
              : tx(language, `${badgeCount} dari 3 area`, `${badgeCount} of 3 areas`)}
          </Text>
        </View>
        {selected.length ? (
          <View style={styles.selectedList}>
            {preset ? (
              <Pill
                label={tx(
                  language,
                  MUSCLE_PRESETS[preset].label,
                  ({ full: 'Full body', upper: 'Upper body', lower: 'Lower body', core: 'Core' })[preset],
                )}
                selected
              />
            ) : (
              selected.map((id) => {
                const muscle = MUSCLES.find((item) => item.id === id);
                if (!muscle) return null;
                return <Pill key={id} label={labelFor(muscle)} selected />;
              })
            )}
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {tx(language, 'Pilih area pada peta atau gunakan fokus cepat.', 'Choose an area on the map or use a quick focus.')}
          </Text>
        )}
      </Surface>
      </View>

      <ActionButton
        title={tx(language, 'Lanjut ke rencana', 'Continue to plan')}
        onPress={continueToPlan}
        disabled={!selected.length}
        testID="continue-focus"
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pageContent: { paddingTop: 18 },
  countBadge: {
    minWidth: 45,
    height: 45,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  countText: { fontSize: 14, fontWeight: '800' },
  segment: {
    flexDirection: 'row',
    gap: 3,
    borderWidth: 1,
    padding: 4,
    borderRadius: 16,
  },
  segmentItem: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: 14, fontWeight: '700' },
  mapCard: { padding: 12, gap: 5, alignItems: 'center' },
  mapCardTop: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  mapLabel: { fontSize: 14, fontWeight: '700' },
  pager: { width: '100%' },
  pagerPage: { justifyContent: 'center', alignItems: 'center' },
  mapHint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  hintText: { fontSize: 11, fontWeight: '500' },
  tapHint: { fontSize: 12, textAlign: 'center', marginBottom: 2 },
  contentBlock: { gap: 12 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetPill: { minHeight: 42 },
  helperText: { fontSize: 12, lineHeight: 17, marginTop: -3 },
  muscleList: { gap: 8 },
  muscleOption: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionCopy: { gap: 2 },
  muscleName: { fontSize: 14, fontWeight: '700' },
  muscleGroup: { fontSize: 11, fontWeight: '500' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCard: { gap: 12 },
  selectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  selectionTitle: { fontSize: 15, fontWeight: '700' },
  selectionCount: { fontSize: 11, fontWeight: '500' },
  selectedList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  emptyText: { fontSize: 13, lineHeight: 18 },
});