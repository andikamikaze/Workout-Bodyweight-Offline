import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ActionButton, AppScreen, PageHeader, SectionHeading, Surface } from '@/components/WorkoutUI';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/src/store/AppContext';
import { tx } from '@/src/i18n';
import { bmiCategory, calculateBmi, healthyWeightRange } from '@/features/progress/metrics';
import { BMIStandard } from '@/src/types';

const GAUGE_MAX = 35;

export default function BmiScreen() {
  const router = useRouter();
  const colors = useColors();
  const { snapshot, ready, saveWeightEntry } = useApp();
  const language = snapshot.settings.language;
  const profile = snapshot.profile;
  const [weightText, setWeightText] = useState('');
  const [weightError, setWeightError] = useState('');
  const [weightSaved, setWeightSaved] = useState(false);

  useEffect(() => {
    if (ready && !profile) router.replace('/onboarding');
  }, [ready, profile, router]);

  const latestEntry = useMemo(
    () =>
      [...snapshot.weightEntries].sort(
        (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
      )[0],
    [snapshot.weightEntries],
  );

  if (!ready) {
    return (
      <AppScreen>
        <Text style={[styles.loading, { color: colors.mutedForeground }]}>
          {tx(language, 'Menyiapkan analisis…', 'Preparing your analysis…')}
        </Text>
      </AppScreen>
    );
  }
  if (!profile) return <AppScreen />;

  const currentWeight = latestEntry?.weightKg ?? profile.weightKg;
  const bmi = latestEntry?.bmi ?? calculateBmi(currentWeight, profile.heightCm);
  const standard = snapshot.settings.bmiStandard;
  const category = bmiCategory(bmi, standard);
  const healthyRange = healthyWeightRange(profile.heightCm, standard);
  const rangeDelta = currentWeight < healthyRange.min
    ? healthyRange.min - currentWeight
    : currentWeight > healthyRange.max
      ? currentWeight - healthyRange.max
      : 0;
  const markerPosition = Math.min(98, Math.max(2, (bmi / GAUGE_MAX) * 100));
  const recommendation = getRecommendation(category, language);
  const categoryText = getCategoryLabel(category, standard, bmi, language);
  const gaugeRanges = getGaugeRanges(standard);

  const isImperial = snapshot.settings.units === 'imperial';
  function saveWeight() {
    const raw = Number(weightText.replace(',', '.'));
    // Imperial: input lb → konversi ke kg (kanonis). Batas tetap 30–300 kg.
    const weight = isImperial ? Math.round(raw * 0.453592 * 10) / 10 : raw;
    if (!Number.isFinite(weight) || weight < 30 || weight > 300) {
      setWeightError(
        isImperial
          ? tx(language, 'Masukkan berat antara 66–661 lb.', 'Enter a weight between 66–661 lb.')
          : tx(language, 'Masukkan berat antara 30–300 kg.', 'Enter a weight between 30–300 kg.'),
      );
      setWeightSaved(false);
      return;
    }
    saveWeightEntry(weight);
    setWeightText('');
    setWeightError('');
    setWeightSaved(true);
  }

  return (
    <AppScreen>
      <PageHeader
        eyebrow={tx(language, 'UKURAN KESEHATAN UMUM', 'A GENERAL HEALTH MEASURE')}
        title={tx(language, 'Analisis BMI', 'BMI analysis')}
        subtitle={tx(language, 'Pantau sebagai tren, bukan sebagai penilaian diri.', 'Use it as a trend, not a judgment.')}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx(language, 'Kembali', 'Go back')}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
        }
      />

      <Surface style={styles.scoreCard}>
        <View style={styles.scoreHeader}>
          <View>
            <Text style={[styles.scoreEyebrow, { color: colors.mutedForeground }]}>
              {tx(language, 'BMI SAAT INI', 'CURRENT BMI')}
            </Text>
            <Text style={[styles.scoreNumber, { color: colors.foreground }]}>{bmi.toFixed(1)}</Text>
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: getCategorySurface(category, colors) }]}>
            <Text style={[styles.categoryText, { color: getCategoryColor(category, colors) }]}>{categoryText}</Text>
          </View>
        </View>

        <View
          accessibilityRole="progressbar"
          accessibilityLabel={tx(language, `Indikator BMI ${bmi.toFixed(1)}; kategori ${categoryText}`, `BMI gauge ${bmi.toFixed(1)}; ${categoryText}`)}
          accessibilityValue={{ min: 0, max: GAUGE_MAX, now: bmi }}
          style={styles.gaugeWrap}
        >
          <View style={styles.gaugeTrack}>
            {gaugeRanges.map((range) => (
              <View
                key={range.key}
                style={[
                  styles.gaugeSegment,
                  {
                    width: `${range.width}%`,
                    backgroundColor: getCategoryColor(range.key, colors),
                  },
                ]}
              />
            ))}
            <View style={[styles.gaugeMarker, { left: `${markerPosition}%`, backgroundColor: colors.foreground }]} />
          </View>
          <View style={styles.gaugeLabels}>
            <Text style={[styles.gaugeLabel, { color: colors.mutedForeground }]}>{tx(language, 'Kurus', 'Low')}</Text>
            <Text style={[styles.gaugeLabel, { color: colors.mutedForeground }]}>{tx(language, 'Normal', 'Healthy')}</Text>
            <Text style={[styles.gaugeLabel, { color: colors.mutedForeground }]}>{tx(language, 'Berlebih', 'High')}</Text>
          </View>
        </View>

        <View style={[styles.rangeBox, { backgroundColor: colors.secondary }]}>
          <View style={[styles.rangeIcon, { backgroundColor: colors.card }]}>
            <Feather name="target" size={17} color={colors.primary} />
          </View>
          <View style={styles.rangeCopy}>
            <Text style={[styles.rangeTitle, { color: colors.foreground }]}>{tx(language, 'Rentang berat sehat', 'Healthy weight range')}</Text>
            <Text style={[styles.rangeValue, { color: colors.primary }]}>
              {healthyRange.min.toFixed(1)}–{healthyRange.max.toFixed(1)} kg
            </Text>
          </View>
          <Text style={[styles.rangeDelta, { color: colors.mutedForeground }]}>
            {rangeDelta === 0
              ? tx(language, 'Dalam rentang', 'In range')
              : currentWeight > healthyRange.max
                ? tx(language, `${rangeDelta.toFixed(1)} kg di atas`, `${rangeDelta.toFixed(1)} kg above`)
                : tx(language, `${rangeDelta.toFixed(1)} kg di bawah`, `${rangeDelta.toFixed(1)} kg below`)}
          </Text>
        </View>
        <Text style={[styles.standardNote, { color: colors.mutedForeground }]}>
          {standard === 'kemenkes'
            ? tx(language, 'Kategori memakai acuan Kemenkes RI.', 'Classification uses the Indonesian Ministry of Health standard.')
            : tx(language, 'Kategori memakai acuan WHO Asia-Pasifik.', 'Classification uses the WHO Asia-Pacific standard.')}
        </Text>
      </Surface>

      <SectionHeading title={tx(language, 'Langkah yang bisa dicoba', 'A next step to consider')} />
      <Surface style={styles.recommendationCard}>
        <View style={[styles.recommendationIcon, { backgroundColor: colors.accent }]}>
          <Feather name={recommendation.icon} size={19} color={colors.accentForeground} />
        </View>
        <Text style={[styles.recommendationTitle, { color: colors.foreground }]}>{recommendation.title}</Text>
        <Text style={[styles.recommendationBody, { color: colors.mutedForeground }]}>{recommendation.body}</Text>
        <View style={[styles.recommendationCallout, { backgroundColor: colors.secondary }]}>
          <Feather name="info" size={15} color={colors.primary} />
          <Text style={[styles.calloutText, { color: colors.foreground }]}>
            {tx(language, 'Pilih intensitas yang terasa nyaman. Berhenti jika muncul nyeri atau pusing.', 'Choose a comfortable intensity. Stop if you feel pain or dizziness.')}
          </Text>
        </View>
      </Surface>

      <SectionHeading title={tx(language, 'Catat berat terbaru', 'Log a new weigh-in')} />
      <Surface style={styles.weightCard}>
        <Text style={[styles.weightDescription, { color: colors.mutedForeground }]}>
          {tx(language, 'Pembaruan berat disimpan sebagai snapshot BMI baru di riwayat lokal.', 'A new weight is stored as a BMI snapshot in your local history.')}
        </Text>
        <View style={styles.weightInputRow}>
          <View style={[styles.inputShell, { backgroundColor: colors.background, borderColor: weightError ? colors.destructive : colors.border }]}>
            <TextInput
              value={weightText}
              onChangeText={(value) => {
                setWeightText(value);
                setWeightError('');
                setWeightSaved(false);
              }}
              placeholder={`${currentWeight.toFixed(1)}`}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              accessibilityLabel={isImperial ? tx(language, 'Berat dalam pon', 'Weight in pounds') : tx(language, 'Berat dalam kilogram', 'Weight in kilograms')}
              testID="bmi-weight-input"
              style={[styles.weightInput, { color: colors.foreground }]}
              returnKeyType="done"
              onSubmitEditing={saveWeight}
            />
            <Text style={[styles.kgSuffix, { color: colors.mutedForeground }]}>{isImperial ? 'lb' : 'kg'}</Text>
          </View>
          <ActionButton
            title={tx(language, 'Simpan', 'Save')}
            onPress={saveWeight}
            disabled={!weightText.trim()}
            testID="bmi-save-weight"
            style={styles.saveWeightButton}
          />
        </View>
        {weightError ? <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>{weightError}</Text> : null}
        {weightSaved ? (
          <View style={styles.savedConfirmation}>
            <Feather name="check-circle" size={15} color={colors.primary} />
            <Text style={[styles.savedText, { color: colors.primary }]}>{tx(language, 'Berat dan BMI tersimpan.', 'Weight and BMI saved.')}</Text>
          </View>
        ) : null}
      </Surface>

      <Surface style={[styles.disclaimerCard, { borderColor: colors.border }]}>
        <View style={[styles.disclaimerIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="shield" size={16} color={colors.primary} />
        </View>
        <View style={styles.disclaimerCopy}>
          <Text style={[styles.disclaimerTitle, { color: colors.foreground }]}>{tx(language, 'Catatan penting', 'Important note')}</Text>
          <Text style={[styles.disclaimerBody, { color: colors.mutedForeground }]}>
            {tx(language, 'BMI tidak membedakan massa otot dan lemak, serta bukan alat diagnosis. Angka ini hanya gambaran umum dan perlu dipahami bersama kondisi serta kebutuhan pribadimu.', 'BMI does not distinguish muscle from fat and is not a diagnostic tool. It is only a general measure and should be considered alongside your individual health needs.')}
          </Text>
        </View>
      </Surface>
    </AppScreen>
  );
}

function getCategoryLabel(
  category: ReturnType<typeof bmiCategory>,
  standard: BMIStandard,
  bmi: number,
  language: 'id' | 'en',
) {
  if (standard === 'asia-pacific') {
    if (category === 'underweight') return tx(language, 'Kurus', 'Underweight');
    if (category === 'normal') return tx(language, 'Normal', 'Normal');
    if (category === 'mild-overweight') return tx(language, 'Berisiko', 'At risk');
    return bmi < 30
      ? tx(language, 'Obesitas I', 'Obesity I')
      : tx(language, 'Obesitas II+', 'Obesity II+');
  }
  if (category === 'severe-underweight') return tx(language, 'Kurus berat', 'Severely underweight');
  if (category === 'underweight') return tx(language, 'Kurus', 'Underweight');
  if (category === 'normal') return tx(language, 'Normal', 'Normal');
  if (category === 'mild-overweight') return tx(language, 'Gemuk ringan', 'Mildly overweight');
  return tx(language, 'Gemuk berat', 'Severely overweight');
}

function getRecommendation(
  category: ReturnType<typeof bmiCategory>,
  language: 'id' | 'en',
) {
  if (category === 'severe-underweight' || category === 'underweight') {
    return {
      icon: 'heart' as const,
      title: tx(language, 'Bangun kekuatan secara bertahap', 'Build strength gradually'),
      body: tx(language, 'Pilih latihan kekuatan seluruh tubuh dengan variasi yang sesuai kemampuan. Ambil jeda cukup dan pertimbangkan berdiskusi dengan tenaga kesehatan tentang target yang sesuai.', 'Choose full-body strength work at a variation that suits you. Rest well and consider discussing a suitable goal with a health professional.'),
    };
  }
  if (category === 'mild-overweight' || category === 'severe-overweight') {
    return {
      icon: 'activity' as const,
      title: tx(language, 'Mulai dengan gerak yang ringan', 'Start with low-impact movement'),
      body: tx(language, 'Coba sesi seluruh tubuh berdampak rendah dan tingkatkan durasi perlahan. Pilih gerakan yang nyaman untuk sendi dan ruang latihanmu.', 'Try a low-impact full-body session and increase duration gradually. Choose movements that feel comfortable for your joints and space.'),
    };
  }
  return {
    icon: 'check' as const,
    title: tx(language, 'Pertahankan kebiasaan seimbang', 'Keep a balanced routine'),
    body: tx(language, 'Gabungkan gerakan kekuatan dan mobilitas dengan istirahat yang cukup. Gunakan catatan ini untuk mengikuti tren, bukan mengejar satu angka.', 'Pair strength and mobility with enough recovery. Use these notes to follow trends, not chase a single number.'),
  };
}

function getGaugeRanges(standard: BMIStandard) {
  const cutoffs = standard === 'kemenkes' ? [17, 18.5, 25, 27, 35] : [18.5, 22.9, 24.9, 29.9, 35];
  const categories: Array<ReturnType<typeof bmiCategory>> = [
    'severe-underweight',
    'underweight',
    'normal',
    'mild-overweight',
    'severe-overweight',
  ];
  let previous = 0;
  return cutoffs.map((limit, index) => {
    const width = ((limit - previous) / GAUGE_MAX) * 100;
    previous = limit;
    return { key: categories[index], width };
  });
}

function getCategoryColor(
  category: ReturnType<typeof bmiCategory>,
  colors: ReturnType<typeof useColors>,
) {
  if (category === 'normal') return colors.primary;
  if (category === 'underweight') return colors.accent;
  if (category === 'mild-overweight') return colors.mutedForeground;
  return colors.destructive;
}

function getCategorySurface(
  category: ReturnType<typeof bmiCategory>,
  colors: ReturnType<typeof useColors>,
) {
  if (category === 'normal') return colors.secondary;
  if (category === 'underweight') return colors.accent;
  if (category === 'mild-overweight') return colors.muted;
  return colors.secondary;
}

const styles = StyleSheet.create({
  loading: { marginTop: 50, textAlign: 'center', fontSize: 14 },
  backButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  scoreCard: { padding: 18, gap: 16 },
  scoreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  scoreEyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  scoreNumber: { fontSize: 46, lineHeight: 54, fontWeight: '700', letterSpacing: -1 },
  categoryBadge: { maxWidth: 145, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  categoryText: { fontSize: 12, lineHeight: 16, fontWeight: '700', textAlign: 'center' },
  gaugeWrap: { gap: 9, marginTop: 2 },
  gaugeTrack: { height: 14, flexDirection: 'row', overflow: 'visible', borderRadius: 9, position: 'relative' },
  gaugeSegment: { height: 14 },
  gaugeMarker: { width: 3, height: 24, borderRadius: 2, position: 'absolute', top: -5, marginLeft: -1.5 },
  gaugeLabels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 1 },
  gaugeLabel: { fontSize: 10, fontWeight: '600' },
  rangeBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 12, marginTop: 3 },
  rangeIcon: { height: 34, width: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rangeCopy: { flex: 1, gap: 2 },
  rangeTitle: { fontSize: 11, fontWeight: '600' },
  rangeValue: { fontSize: 14, fontWeight: '700' },
  rangeDelta: { maxWidth: 83, fontSize: 10, textAlign: 'right', lineHeight: 14 },
  standardNote: { fontSize: 10, lineHeight: 14 },
  recommendationCard: { padding: 17, gap: 9 },
  recommendationIcon: { height: 39, width: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  recommendationTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  recommendationBody: { fontSize: 13, lineHeight: 20 },
  recommendationCallout: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 13, padding: 11, marginTop: 4 },
  calloutText: { flex: 1, fontSize: 11, lineHeight: 16 },
  weightCard: { padding: 16, gap: 12 },
  weightDescription: { fontSize: 12, lineHeight: 18 },
  weightInputRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  inputShell: { flex: 1, minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  weightInput: { flex: 1, fontSize: 16, fontWeight: '600', padding: 0 },
  kgSuffix: { fontSize: 13, fontWeight: '600' },
  saveWeightButton: { minHeight: 52, paddingHorizontal: 18 },
  errorText: { fontSize: 12, lineHeight: 17 },
  savedConfirmation: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  savedText: { fontSize: 12, fontWeight: '600' },
  disclaimerCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 15 },
  disclaimerIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  disclaimerCopy: { flex: 1, gap: 5 },
  disclaimerTitle: { fontSize: 13, fontWeight: '700' },
  disclaimerBody: { fontSize: 11, lineHeight: 17 },
});