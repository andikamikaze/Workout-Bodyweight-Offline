import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ActionButton, AppScreen, PageHeader, SectionHeading, Surface } from '@/components/WorkoutUI';
import { useColors } from '@/hooks/useColors';
import { tx } from '@/src/i18n';
import { useApp } from '@/src/store/AppContext';
import { EXERCISES } from '@/src/data/exercises';
import { calculateBmi, detectLevelUp, getDailyStreak, startOfWeek } from '@/features/progress/metrics';

export default function HomeDashboard() {
  const router = useRouter();
  const colors = useColors();
  const { snapshot, ready, storageError } = useApp();
  const language = snapshot.settings.language;
  const profile = snapshot.profile;

  useEffect(() => {
    if (ready && !profile) router.replace('/onboarding');
  }, [ready, profile, router]);

  const metrics = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const thisWeek = snapshot.sessions.filter((session) => new Date(session.completedAt) >= weekStart);
    return {
      sessions: thisWeek.length,
      minutes: Math.round(thisWeek.reduce((sum, session) => sum + session.durationSeconds, 0) / 60),
      reps: thisWeek.reduce((sum, session) => sum + session.totalReps, 0),
      streak: getDailyStreak(snapshot.sessions),
      goal: Math.max(1, snapshot.settings.weeklyGoal),
    };
  }, [snapshot.sessions, snapshot.settings.weeklyGoal]);

  const latestBmi =
    snapshot.weightEntries.at(-1)?.bmi ??
    (profile ? calculateBmi(profile.weightKg, profile.heightCm) : null);
  const goalProgress = Math.min(1, metrics.sessions / metrics.goal);
  const levelUps = useMemo(() => detectLevelUp(snapshot.sessions, EXERCISES).slice(0, 2), [snapshot.sessions]);
  const levelUpName = (id: string) => {
    const found = EXERCISES.find((exercise) => exercise.id === id);
    if (!found) return id;
    return language === 'id' ? found.name : found.englishName;
  };

  if (!ready) {
    return (
      <AppScreen>
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            {tx(language, 'Menyiapkan ruang latihanmu…', 'Getting your training space ready…')}
          </Text>
        </View>
      </AppScreen>
    );
  }
  if (!profile) return <AppScreen />;

  const firstName = profile.name.trim().split(/\s+/)[0] || profile.name;
  const today = new Date();
  const greeting = new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-US', { weekday: 'long' }).format(today);

  return (
    <AppScreen>
      <PageHeader
        eyebrow={tx(language, 'RUANG LATIHANMU', 'YOUR TRAINING SPACE')}
        title={tx(language, `Halo, ${firstName}`, `Hello, ${firstName}`)}
        subtitle={tx(language, 'Satu sesi kecil tetap berarti.', 'One small session still counts.')}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx(language, 'Buka profil', 'Open profile')}
            testID="dashboard-profile"
            onPress={() => router.push('/profile')}
            style={({ pressed }) => [styles.profileButton, { backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 }]}
          >
            <Feather name="user" size={19} color={colors.foreground} />
          </Pressable>
        }
      />

      {storageError ? (
        <Surface style={[styles.storageNotice, { borderColor: colors.destructive }]}>
          <Feather name="alert-circle" size={18} color={colors.destructive} />
          <Text style={[styles.noticeText, { color: colors.foreground }]}>{storageError}</Text>
        </Surface>
      ) : null}

      {snapshot.activeWorkout ? (
        <Surface style={[styles.resumePanel, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          <View style={styles.resumeCopy}>
            <Text style={[styles.resumeEyebrow, { color: colors.primaryForeground }]}>
              {tx(language, 'SESI BELUM SELESAI', 'WORKOUT IN PROGRESS')}
            </Text>
            <Text style={[styles.resumeTitle, { color: colors.primaryForeground }]}>
              {snapshot.activeWorkout.plan.title}
            </Text>
            <Text style={[styles.resumeSubtext, { color: colors.primaryForeground }]}>
              {tx(language, 'Lanjutkan tepat dari bagian terakhirmu.', 'Pick up right where you left off.')}
            </Text>
          </View>
          <ActionButton
            title={tx(language, 'Lanjutkan', 'Resume')}
            variant="secondary"
            onPress={() => router.push('/workout')}
            testID="dashboard-resume-workout"
          />
        </Surface>
      ) : (
        <Surface style={[styles.hero, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={[styles.heroEyebrow, { color: colors.accent }]}>
                {tx(language, greeting.toUpperCase(), 'YOUR NEXT SESSION')}
              </Text>
              <Text style={[styles.heroTitle, { color: colors.primaryForeground }]}>
                {tx(language, 'Mulai dari tubuhmu sendiri.', 'Start with what you have.')}
              </Text>
              <Text style={[styles.heroSubtext, { color: colors.primaryForeground }]}>
                {tx(language, 'Rencana tanpa alat, dirancang untuk ruang dan ritmemu.', 'Equipment-free plans made for your space and pace.')}
              </Text>
            </View>
            <View style={[styles.heroMark, { backgroundColor: colors.accent }]}>
              <Feather name="activity" size={25} color={colors.accentForeground} />
            </View>
          </View>
          <View style={styles.heroButtons}>
            <ActionButton
              title={tx(language, 'Pilih fokus otot', 'Choose muscle focus')}
              onPress={() => router.push('/focus')}
              testID="dashboard-start-focus"
              style={styles.heroAction}
              textStyle={{ fontSize: 14 }}
            />
            <Pressable
              onPress={() => router.push('/plan')}
              accessibilityRole="button"
              testID="dashboard-view-plan"
              style={({ pressed }) => [styles.heroLink, pressed && styles.pressed]}
            >
              <Text style={[styles.heroLinkText, { color: colors.primaryForeground }]}>
                {tx(language, 'Atur sesi', 'Plan a session')}
              </Text>
              <Feather name="arrow-right" size={15} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </Surface>
      )}

      <View style={styles.metricGrid}>
        <MetricCard
          label={tx(language, 'Sesi minggu ini', 'Sessions this week')}
          value={String(metrics.sessions)}
          unit={tx(language, 'sesi', 'sessions')}
          icon="activity"
        />
        <MetricCard
          label={tx(language, 'Streak harian', 'Daily streak')}
          value={String(metrics.streak)}
          unit={tx(language, 'hari', 'days')}
          icon="zap"
        />
        <MetricCard
          label={tx(language, 'Waktu latihan', 'Training time')}
          value={String(metrics.minutes)}
          unit={tx(language, 'menit', 'min')}
          icon="clock"
        />
        <MetricCard
          label={tx(language, 'Total repetisi', 'Total reps')}
          value={formatCompact(metrics.reps)}
          unit={tx(language, 'minggu ini', 'this week')}
          icon="repeat"
        />
      </View>

      <Surface style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <View style={styles.goalTitleBlock}>
            <Text style={[styles.goalKicker, { color: colors.mutedForeground }]}>
              {tx(language, 'TARGET MINGGUAN', 'WEEKLY TARGET')}
            </Text>
            <Text style={[styles.goalTitle, { color: colors.foreground }]}>
              {tx(language, `${metrics.sessions} dari ${metrics.goal} sesi`, `${metrics.sessions} of ${metrics.goal} sessions`)}
            </Text>
          </View>
          <View style={[styles.goalIcon, { backgroundColor: colors.accent }]}>
            <Feather name="flag" size={17} color={colors.accentForeground} />
          </View>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: metrics.goal, now: metrics.sessions }}
          accessibilityLabel={tx(language, 'Capaian target mingguan', 'Weekly goal progress')}
          style={[styles.progressTrack, { backgroundColor: colors.secondary }]}
        >
          <View style={[styles.progressFill, { width: `${Math.max(metrics.sessions ? 7 : 0, goalProgress * 100)}%`, backgroundColor: colors.primary }]} />
        </View>
        <Text style={[styles.goalFootnote, { color: colors.mutedForeground }]}>
          {metrics.sessions >= metrics.goal
            ? tx(language, 'Target tercapai. Jaga ritme yang terasa nyaman.', 'Goal reached. Keep a rhythm that feels right.')
            : tx(language, `Tinggal ${metrics.goal - metrics.sessions} sesi lagi minggu ini.`, `${metrics.goal - metrics.sessions} more this week.`)}
        </Text>
      </Surface>

      <SectionHeading title={tx(language, 'Ringkasan tubuh', 'Body check-in')} action={tx(language, 'Lihat BMI', 'BMI details')} onAction={() => router.push('/bmi')} />
      <Surface style={styles.bmiCard}>
        <View style={[styles.bmiIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="heart" size={20} color={colors.primary} />
        </View>
        <View style={styles.bmiCopy}>
          <Text style={[styles.bmiLabel, { color: colors.mutedForeground }]}>{tx(language, 'BMI TERKINI', 'LATEST BMI')}</Text>
          <Text style={[styles.bmiValue, { color: colors.foreground }]}>
            {latestBmi === null ? '—' : latestBmi.toFixed(1)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx(language, 'Buka analisis BMI', 'Open BMI analysis')}
          onPress={() => router.push('/bmi')}
          style={({ pressed }) => [styles.arrowButton, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-up-right" size={19} color={colors.foreground} />
        </Pressable>
      </Surface>

      <Text style={[styles.dateNote, { color: colors.mutedForeground }]}>
        {new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(today)}
      </Text>
    </AppScreen>
  );
}

function MetricCard({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}) {
  const colors = useColors();
  return (
    <Surface style={styles.metricCard}>
      <View style={styles.metricTop}>
        <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
        <Text style={[styles.metricUnit, { color: colors.mutedForeground }]}>{unit}</Text>
      </View>
    </Surface>
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

const styles = StyleSheet.create({
  loading: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, fontWeight: '500' },
  profileButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  storageNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  hero: { padding: 20, borderRadius: 24, gap: 17 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heroCopy: { flex: 1, gap: 8 },
  heroEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  heroTitle: { fontSize: 25, lineHeight: 30, fontWeight: '700', maxWidth: 275 },
  heroSubtext: { fontSize: 13, lineHeight: 19, maxWidth: 282, opacity: 0.82 },
  heroMark: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heroAction: { flex: 1, minHeight: 48 },
  heroLink: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  heroLinkText: { fontSize: 12, fontWeight: '700' },
  resumePanel: { padding: 18, borderRadius: 23, gap: 14 },
  resumeCopy: { gap: 5 },
  resumeEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  resumeTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  resumeSubtext: { fontSize: 13, lineHeight: 19, opacity: 0.82 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', minHeight: 108, padding: 13, justifyContent: 'space-between' },
  metricTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 },
  metricLabel: { fontSize: 11, lineHeight: 15, fontWeight: '600', flex: 1 },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  metricValue: { fontSize: 27, lineHeight: 32, fontWeight: '700' },
  metricUnit: { fontSize: 10, lineHeight: 14, fontWeight: '500', flexShrink: 1 },
  goalCard: { padding: 17, gap: 12 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalTitleBlock: { gap: 4 },
  goalKicker: { fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  goalTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  goalIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 9, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: 9, borderRadius: 5 },
  goalFootnote: { fontSize: 12, lineHeight: 17 },
  bmiCard: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  bmiIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  bmiCopy: { flex: 1, gap: 2 },
  bmiLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  bmiValue: { fontSize: 25, fontWeight: '700', lineHeight: 30 },
  arrowButton: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dateNote: { fontSize: 12, textAlign: 'center', marginTop: -3 },
  pressed: { opacity: 0.8 },
});
