import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { ActionButton, AppScreen, PageHeader, SectionHeading, Surface } from '@/components/WorkoutUI';
import { useColors } from '@/hooks/useColors';
import { tx } from '@/src/i18n';
import { useApp } from '@/src/store/AppContext';
import { MUSCLES } from '@/src/data/muscles';
import { EXERCISES } from '@/src/data/exercises';
import { WorkoutSession } from '@/src/types';
import { calculateBmi, detectLevelUp, formatDate, getPersonalRecords, localDateKey, muscleSessionCounts } from '@/features/progress/metrics';

type ChartMode = 'weight' | 'bmi';

export default function ProgressScreen() {
  const router = useRouter();
  const colors = useColors();
  const { snapshot, ready } = useApp();
  const language = snapshot.settings.language;
  const [displayedMonth, setDisplayedMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [chartMode, setChartMode] = useState<ChartMode>('weight');
  const profile = snapshot.profile;

  useEffect(() => {
    if (ready && !profile) router.replace('/onboarding');
  }, [ready, profile, router]);

  const monthSessions = useMemo(() => {
    const grouped = new Map<string, WorkoutSession[]>();
    snapshot.sessions.forEach((session) => {
      const key = localDateKey(new Date(session.completedAt));
      const current = grouped.get(key) ?? [];
      grouped.set(key, [...current, session]);
    });
    return grouped;
  }, [snapshot.sessions]);

  const selectedSessions = monthSessions.get(localDateKey(selectedDate)) ?? [];
  const weightHistory = useMemo(
    () =>
      [...snapshot.weightEntries]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-8),
    [snapshot.weightEntries],
  );

  const muscleCounts = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - 29);
    return muscleSessionCounts(snapshot.sessions, MUSCLES.map((muscle) => muscle.id), since);
  }, [snapshot.sessions]);
  const neglectedMuscles = MUSCLES.filter((muscle) => (muscleCounts.get(muscle.id) ?? 0) === 0);
  const sortedMuscles = [...MUSCLES].sort(
    (left, right) => (muscleCounts.get(right.id) ?? 0) - (muscleCounts.get(left.id) ?? 0),
  );

  const personalRecords = useMemo(() => getPersonalRecords(snapshot.sessions), [snapshot.sessions]);
  const topReps = useMemo(
    () =>
      [...personalRecords]
        .filter((record) => record.maxReps.value > 0)
        .sort((left, right) => right.maxReps.value - left.maxReps.value)
        .slice(0, 3),
    [personalRecords],
  );
  const topHolds = useMemo(
    () =>
      [...personalRecords]
        .filter((record) => record.maxSeconds.value > 0)
        .sort((left, right) => right.maxSeconds.value - left.maxSeconds.value)
        .slice(0, 3),
    [personalRecords],
  );
  const levelUps = useMemo(() => detectLevelUp(snapshot.sessions, EXERCISES), [snapshot.sessions]);
  const exerciseName = (id: string) => {
    const found = EXERCISES.find((exercise) => exercise.id === id);
    if (!found) return humanizeExerciseId(id);
    return language === 'id' ? found.name : found.englishName;
  };

  const advancedSessions = snapshot.sessions.filter((session) => session.level === 'advanced');
  const chartValues = weightHistory.map((entry) => ({
    date: entry.date,
    value: chartMode === 'weight' ? entry.weightKg : entry.bmi,
  }));
  const dateLocale = language === 'id' ? 'id-ID' : 'en-US';

  if (!ready) {
    return (
      <AppScreen>
        <Text style={[styles.loading, { color: colors.mutedForeground }]}>{tx(language, 'Memuat riwayat…', 'Loading your history…')}</Text>
      </AppScreen>
    );
  }
  if (!profile) return <AppScreen />;

  const monthName = formatDate(displayedMonth, language, { month: 'long', year: 'numeric' });
  const monthStart = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1);
  const daysInMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
  const startOffset = (monthStart.getDay() + 6) % 7;
  const calendarCells: Array<number | null> = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const maxMuscleCount = Math.max(1, ...[...muscleCounts.values()]);
  const latestBmi =
    snapshot.weightEntries.at(-1)?.bmi ??
    calculateBmi(profile.weightKg, profile.heightCm);

  return (
    <AppScreen>
      <PageHeader
        eyebrow={tx(language, 'KONSISTENSI, BUKAN KESEMPURNAAN', 'CONSISTENCY OVER PERFECTION')}
        title={tx(language, 'Progress', 'Progress')}
        subtitle={tx(language, 'Semua yang sudah kamu lakukan, tercatat di sini.', 'Every session you complete is recorded here.')}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx(language, 'Analisis BMI', 'BMI analysis')}
            onPress={() => router.push('/bmi')}
            style={({ pressed }) => [styles.headerAction, { backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 }]}
          >
            <Feather name="activity" size={18} color={colors.foreground} />
          </Pressable>
        }
      />

      <Surface style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View style={styles.chartCopy}>
            <Text style={[styles.cardKicker, { color: colors.mutedForeground }]}>{tx(language, 'TREN BERAT & BMI', 'WEIGHT & BMI TREND')}</Text>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>
              {chartMode === 'weight' ? tx(language, 'Berat badan', 'Body weight') : 'BMI'}
            </Text>
          </View>
          <View style={[styles.chartToggle, { backgroundColor: colors.secondary }]}>
            <ChartTab
              label={tx(language, 'Berat', 'Weight')}
              selected={chartMode === 'weight'}
              onPress={() => setChartMode('weight')}
            />
            <ChartTab label="BMI" selected={chartMode === 'bmi'} onPress={() => setChartMode('bmi')} />
          </View>
        </View>
        {chartValues.length > 0 ? (
          <>
            <HistoryChart values={chartValues.map((item) => item.value)} color={colors.primary} />
            <View style={styles.chartLabels}>
              <Text style={[styles.chartLabel, { color: colors.mutedForeground }]}>
                {new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'short' }).format(new Date(chartValues[0].date))}
              </Text>
              <Text style={[styles.chartCurrent, { color: colors.foreground }]}>
                {chartValues[chartValues.length - 1].value.toFixed(1)} {chartMode === 'weight' ? 'kg' : tx(language, 'BMI', 'BMI')}
              </Text>
              <Text style={[styles.chartLabel, { color: colors.mutedForeground }]}>
                {new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'short' }).format(new Date(chartValues[chartValues.length - 1].date))}
              </Text>
            </View>
            {chartValues.length === 1 ? (
              <Text style={[styles.chartHint, { color: colors.mutedForeground }]}>
                {tx(language, 'Catat berat lagi nanti untuk melihat perubahan.', 'Add another weigh-in to see a trend.')}
              </Text>
            ) : null}
          </>
        ) : (
          <EmptyChart
            title={tx(language, 'Belum ada catatan berat', 'No weigh-ins yet')}
            body={tx(language, 'Catat berat badan untuk mulai melihat perubahannya.', 'Log your weight to start seeing your trend.')}
            onPress={() => router.push('/bmi')}
            action={tx(language, 'Catat berat', 'Log weight')}
          />
        )}
      </Surface>

      <SectionHeading title={tx(language, 'Kalender latihan', 'Workout calendar')} />
      <Surface style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Text style={[styles.monthName, { color: colors.foreground }]}>{monthName}</Text>
          <View style={styles.monthControls}>
            <MonthArrow
              label={tx(language, 'Bulan sebelumnya', 'Previous month')}
              icon="chevron-left"
              onPress={() => setDisplayedMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}
            />
            <MonthArrow
              label={tx(language, 'Bulan berikutnya', 'Next month')}
              icon="chevron-right"
              onPress={() => setDisplayedMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}
            />
          </View>
        </View>
        <View style={styles.calendarGrid}>
          {getWeekdayLabels(language).map((day) => (
            <Text key={day} style={[styles.weekday, { color: colors.mutedForeground }]}>{day}</Text>
          ))}
          {calendarCells.map((day, index) => {
            if (day === null) return <View key={`empty-${index}`} style={styles.dayCell} />;
            const date = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), day);
            const key = localDateKey(date);
            const count = monthSessions.get(key)?.length ?? 0;
            const isSelected = localDateKey(selectedDate) === key;
            const isToday = localDateKey(new Date()) === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={tx(language, `${day} ${monthName}${count ? `, ${count} sesi` : ''}`, `${monthName} ${day}${count ? `, ${count} sessions` : ''}`)}
                accessibilityState={{ selected: isSelected }}
                testID={`calendar-day-${key}`}
                onPress={() => setSelectedDate(date)}
                style={({ pressed }) => [
                  styles.dayCell,
                  styles.dayButton,
                  isSelected && { backgroundColor: colors.primary },
                  !isSelected && isToday && { borderColor: colors.primary, borderWidth: 1 },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.dayText, { color: isSelected ? colors.primaryForeground : colors.foreground }]}>{day}</Text>
                {count > 0 ? (
                  <View style={[styles.sessionDot, { backgroundColor: isSelected ? colors.accent : colors.primary }]} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Surface>

      <Surface style={styles.dayDetails}>
        <View style={styles.dayDetailsHeader}>
          <View>
            <Text style={[styles.cardKicker, { color: colors.mutedForeground }]}>{tx(language, 'HARI TERPILIH', 'SELECTED DAY')}</Text>
            <Text style={[styles.dayDetailsTitle, { color: colors.foreground }]}>
              {formatDate(selectedDate, language, { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <Text style={[styles.sessionCount, { color: colors.primary }]}>
            {tx(language, `${selectedSessions.length} sesi`, `${selectedSessions.length} sessions`)}
          </Text>
        </View>
        {selectedSessions.length ? (
          selectedSessions.map((session) => (
            <SessionSummary
              key={session.id}
              session={session}
              language={language}
              onOpenBmi={() => router.push('/bmi')}
            />
          ))
        ) : (
          <Text style={[styles.mutedBody, { color: colors.mutedForeground }]}>
            {tx(language, 'Belum ada sesi yang dicatat pada hari ini.', 'No workouts were logged on this day.')}
          </Text>
        )}
      </Surface>

      <SectionHeading title={tx(language, 'Fokus otot · 30 hari', 'Muscle focus · 30 days')} />
      <Surface style={styles.muscleCard}>
        {snapshot.sessions.length === 0 ? (
          <Text style={[styles.mutedBody, { color: colors.mutedForeground }]}>
            {tx(language, 'Distribusi otot muncul setelah sesi pertamamu.', 'Muscle distribution will appear after your first workout.')}
          </Text>
        ) : (
          <>
            <Text style={[styles.mutedBody, { color: colors.mutedForeground }]}>
              {tx(language, 'Jumlah sesi yang melatih tiap area. Area tanpa sesi ditandai untuk membantu variasi.', 'Sessions that included each area. Untrained areas are highlighted to help you vary your focus.')}
            </Text>
            {sortedMuscles.slice(0, 6).map((muscle) => {
              const count = muscleCounts.get(muscle.id) ?? 0;
              return (
                <View key={muscle.id} style={styles.muscleRow}>
                  <Text style={[styles.muscleName, { color: colors.foreground }]}>{language === 'id' ? muscle.label : muscle.englishLabel}</Text>
                  <View style={[styles.muscleTrack, { backgroundColor: colors.secondary }]}>
                    <View style={[styles.muscleFill, { width: `${count === 0 ? 0 : Math.max(7, (count / maxMuscleCount) * 100)}%`, backgroundColor: count === 0 ? colors.mutedForeground : colors.primary }]} />
                  </View>
                  <Text style={[styles.muscleCount, { color: colors.mutedForeground }]}>{count}</Text>
                </View>
              );
            })}
            {neglectedMuscles.length ? (
              <View style={[styles.neglectedBox, { backgroundColor: colors.secondary }]}>
                <Feather name="info" size={15} color={colors.primary} />
                <Text style={[styles.neglectedText, { color: colors.foreground }]}>
                  {tx(language, 'Belum tercatat: ', 'Not logged yet: ')}
                  {neglectedMuscles.slice(0, 5).map((muscle) => language === 'id' ? muscle.label : muscle.englishLabel).join(', ')}
                  {neglectedMuscles.length > 5 ? tx(language, ` dan ${neglectedMuscles.length - 5} area lain`, ` and ${neglectedMuscles.length - 5} more`) : ''}
                </Text>
              </View>
            ) : (
              <View style={[styles.neglectedBox, { backgroundColor: colors.secondary }]}>
                <Feather name="check-circle" size={15} color={colors.primary} />
                <Text style={[styles.neglectedText, { color: colors.foreground }]}>
                  {tx(language, 'Semua area sudah tercatat dalam 30 hari terakhir.', 'Every area has been logged in the last 30 days.')}
                </Text>
              </View>
            )}
          </>
        )}
      </Surface>

      <SectionHeading title={tx(language, 'Rekor latihan', 'Exercise records')} />
      <Surface style={styles.recordsCard}>
        {personalRecords.length ? (
          <>
            <Text style={[styles.prGroupTitle, { color: colors.mutedForeground }]}>
              {tx(language, 'REPS TERBAIK', 'BEST REPS')}
            </Text>
            {topReps.length ? (
              topReps.map((record, index) => (
                <View key={`reps-${record.exerciseId}`} style={[styles.recordRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}>
                  <View style={[styles.recordIndex, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.recordIndexText, { color: colors.primary }]}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>
                  <View style={styles.recordCopy}>
                    <Text numberOfLines={1} style={[styles.recordName, { color: colors.foreground }]}>{exerciseName(record.exerciseId)}</Text>
                    <Text style={[styles.recordMeta, { color: colors.mutedForeground }]}>
                      {record.maxReps.date
                        ? formatDate(new Date(record.maxReps.date), language, { day: 'numeric', month: 'short' })
                        : tx(language, `${record.totalSets} set tercatat`, `${record.totalSets} recorded sets`)}
                    </Text>
                  </View>
                  <View style={styles.recordValue}>
                    <Text style={[styles.recordNumber, { color: colors.foreground }]}>{record.maxReps.value}</Text>
                    <Text style={[styles.recordUnit, { color: colors.mutedForeground }]}>{tx(language, 'repetisi', 'reps')}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.mutedBody, { color: colors.mutedForeground }]}>
                {tx(language, 'Belum ada rekor repetisi.', 'No rep records yet.')}
              </Text>
            )}
            <Text style={[styles.prGroupTitle, { color: colors.mutedForeground, marginTop: 8 }]}>
              {tx(language, 'TAHAN TERLAMA', 'LONGEST HOLD')}
            </Text>
            {topHolds.length ? (
              topHolds.map((record, index) => (
                <View key={`hold-${record.exerciseId}`} style={[styles.recordRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}>
                  <View style={[styles.recordIndex, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.recordIndexText, { color: colors.primary }]}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>
                  <View style={styles.recordCopy}>
                    <Text numberOfLines={1} style={[styles.recordName, { color: colors.foreground }]}>{exerciseName(record.exerciseId)}</Text>
                    <Text style={[styles.recordMeta, { color: colors.mutedForeground }]}>
                      {record.maxSeconds.date
                        ? formatDate(new Date(record.maxSeconds.date), language, { day: 'numeric', month: 'short' })
                        : tx(language, `${record.totalSets} set tercatat`, `${record.totalSets} recorded sets`)}
                    </Text>
                  </View>
                  <View style={styles.recordValue}>
                    <Text style={[styles.recordNumber, { color: colors.foreground }]}>{`${record.maxSeconds.value}s`}</Text>
                    <Text style={[styles.recordUnit, { color: colors.mutedForeground }]}>{tx(language, 'tahan', 'hold')}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.mutedBody, { color: colors.mutedForeground }]}>
                {tx(language, 'Belum ada rekor tahan.', 'No hold records yet.')}
              </Text>
            )}
          </>
        ) : (
          <Text style={[styles.mutedBody, { color: colors.mutedForeground }]}>
            {tx(language, 'Rekor terbaik akan muncul setelah latihan pertama selesai.', 'Personal bests appear after your first completed workout.')}
          </Text>
        )}
      </Surface>

      <SectionHeading title={tx(language, 'Naik level', 'Level up')} />
      <Surface style={styles.levelCard}>
        <View style={[styles.levelMark, { backgroundColor: colors.accent }]}>
          <Feather name="target" size={18} color={colors.accentForeground} />
        </View>
        <View style={styles.levelCopy}>
          <Text style={[styles.levelTitle, { color: colors.foreground }]}>
            {tx(language, 'Level naik 🎯', 'Level up 🎯')}
          </Text>
          {levelUps.length ? (
            levelUps.slice(0, 5).map((event) => (
              <View key={`${event.exerciseId}-${event.date}`} style={styles.levelUpRow}>
                <Text style={[styles.levelUpText, { color: colors.foreground }]}>
                  {exerciseName(event.fromId)} → {exerciseName(event.exerciseId)}
                </Text>
                <Text style={[styles.levelUpDate, { color: colors.mutedForeground }]}>
                  {formatDate(new Date(event.date), language, { day: 'numeric', month: 'short' })}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.mutedBody, { color: colors.mutedForeground }]}>
              {tx(language, 'Selesaikan varian yang lebih sulit untuk membuka level baru.', 'Complete a harder variation to unlock a new level.')}
            </Text>
          )}
        </View>
      </Surface>

      <Surface style={styles.levelCard}>
        <View style={[styles.levelMark, { backgroundColor: colors.accent }]}>
          <Feather name="trending-up" size={18} color={colors.accentForeground} />
        </View>
        <View style={styles.levelCopy}>
          <Text style={[styles.levelTitle, { color: colors.foreground }]}>{tx(language, 'Level yang diselesaikan', 'Levels completed')}</Text>
          <Text style={[styles.mutedBody, { color: colors.mutedForeground }]}>
            {advancedSessions.length
              ? tx(language, `${advancedSessions.length} sesi level lanjut tersimpan.`, `${advancedSessions.length} advanced-level sessions recorded.`)
              : tx(language, 'Sesi level lanjut akan muncul di sini setelah tercatat.', 'Advanced sessions will appear here once logged.')}
          </Text>
        </View>
      </Surface>

      {latestBmi > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/bmi')} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={[styles.bmiFootnote, { color: colors.mutedForeground }]}>
            {tx(language, `BMI terakhir ${latestBmi.toFixed(1)} · Buka analisis lengkap`, `Latest BMI ${latestBmi.toFixed(1)} · View full analysis`)}
          </Text>
        </Pressable>
      ) : null}
    </AppScreen>
  );
}

function ChartTab({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chartTab, selected && { backgroundColor: colors.card }]}
    >
      <Text style={[styles.chartTabText, { color: selected ? colors.foreground : colors.mutedForeground }]}>{label}</Text>
    </Pressable>
  );
}

function HistoryChart({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, max * 0.05, 1);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 160 : 10 + (index / (values.length - 1)) * 300;
    const y = 92 - ((value - min) / spread) * 72;
    return `${x},${y}`;
  });
  const colors = useColors();
  return (
    <View style={styles.chartPlot}>
      <Svg width="100%" height="112" viewBox="0 0 320 112" accessible accessibilityLabel="Trend line for logged measurements">
        <Line x1="8" y1="21" x2="312" y2="21" stroke={colors.border} strokeWidth="1" strokeDasharray="3 5" />
        <Line x1="8" y1="56" x2="312" y2="56" stroke={colors.border} strokeWidth="1" strokeDasharray="3 5" />
        <Line x1="8" y1="92" x2="312" y2="92" stroke={colors.border} strokeWidth="1" strokeDasharray="3 5" />
        {values.length > 1 ? (
          <Polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
        {points.map((point, index) => {
          const [cx, cy] = point.split(',');
          return <Circle key={`${index}-${point}`} cx={Number(cx)} cy={Number(cy)} r={values.length === 1 ? 6 : 4} fill={color} stroke={colors.card} strokeWidth="2" />;
        })}
      </Svg>
    </View>
  );
}

function MonthArrow({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.monthArrow, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
    >
      <Feather name={icon} size={18} color={colors.foreground} />
    </Pressable>
  );
}

function SessionSummary({
  session,
  language,
}: {
  session: WorkoutSession;
  language: 'id' | 'en';
  onOpenBmi: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.sessionSummary, { borderTopColor: colors.border }]}>
      <View style={[styles.sessionSummaryIcon, { backgroundColor: colors.secondary }]}>
        <Feather name="activity" size={16} color={colors.primary} />
      </View>
      <View style={styles.sessionSummaryCopy}>
        <Text style={[styles.sessionSummaryTitle, { color: colors.foreground }]}>
          {tx(language, 'Sesi bodyweight', 'Bodyweight session')}
        </Text>
        <Text style={[styles.sessionSummaryMeta, { color: colors.mutedForeground }]}>
          {Math.round(session.durationSeconds / 60)} {tx(language, 'menit', 'min')} · {session.totalSets} {tx(language, 'set', 'sets')} · {session.totalReps} {tx(language, 'repetisi', 'reps')}
        </Text>
      </View>
      <Text style={[styles.sessionLevel, { color: colors.primary }]}>
        {tx(language, session.level === 'beginner' ? 'Dasar' : session.level === 'intermediate' ? 'Menengah' : 'Lanjut', session.level)}
      </Text>
    </View>
  );
}

function EmptyChart({ title, body, action, onPress }: { title: string; body: string; action: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.emptyChart}>
      <View style={[styles.emptyChartIcon, { backgroundColor: colors.secondary }]}>
        <Feather name="bar-chart-2" size={20} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.mutedBody, { color: colors.mutedForeground }]}>{body}</Text>
      <ActionButton title={action} variant="outline" onPress={onPress} style={styles.emptyAction} />
    </View>
  );
}

function getWeekdayLabels(language: 'id' | 'en') {
  return language === 'id'
    ? ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
}

function humanizeExerciseId(id: string) {
  return id
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  loading: { marginTop: 45, textAlign: 'center', fontSize: 14 },
  headerAction: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  chartCard: { padding: 17, gap: 11 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  chartCopy: { gap: 4 },
  cardKicker: { fontSize: 10, letterSpacing: 0.9, fontWeight: '700' },
  chartTitle: { fontSize: 19, lineHeight: 24, fontWeight: '700' },
  chartToggle: { flexDirection: 'row', padding: 3, borderRadius: 13 },
  chartTab: { minHeight: 32, minWidth: 55, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 8 },
  chartTabText: { fontSize: 11, fontWeight: '600' },
  chartPlot: { width: '100%', height: 112, marginTop: 2 },
  chartLabels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chartLabel: { fontSize: 10, minWidth: 46 },
  chartCurrent: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700' },
  chartHint: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
  emptyChart: { minHeight: 188, alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 10 },
  emptyChartIcon: { height: 44, width: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyTitle: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  mutedBody: { fontSize: 12, lineHeight: 18 },
  emptyAction: { minHeight: 42, marginTop: 2 },
  calendarCard: { padding: 15, gap: 12 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthName: { fontSize: 17, fontWeight: '700', textTransform: 'capitalize' },
  monthControls: { flexDirection: 'row', gap: 8 },
  monthArrow: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.285%', textAlign: 'center', fontSize: 10, fontWeight: '700', paddingBottom: 7 },
  dayCell: { width: '14.285%', height: 43, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  dayButton: { borderRadius: 13 },
  dayText: { fontSize: 12, fontWeight: '600' },
  sessionDot: { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: 4 },
  pressed: { opacity: 0.78 },
  dayDetails: { padding: 16, gap: 13 },
  dayDetailsHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  dayDetailsTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', textTransform: 'capitalize', marginTop: 4 },
  sessionCount: { fontSize: 12, fontWeight: '700' },
  sessionSummary: { borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12 },
  sessionSummaryIcon: { width: 33, height: 33, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sessionSummaryCopy: { flex: 1, gap: 2 },
  sessionSummaryTitle: { fontSize: 13, fontWeight: '700' },
  sessionSummaryMeta: { fontSize: 11 },
  sessionLevel: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  muscleCard: { padding: 16, gap: 13 },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  muscleName: { width: 104, fontSize: 11, fontWeight: '600' },
  muscleTrack: { flex: 1, height: 7, overflow: 'hidden', borderRadius: 4 },
  muscleFill: { height: 7, borderRadius: 4 },
  muscleCount: { width: 18, fontSize: 11, textAlign: 'right', fontWeight: '600' },
  neglectedBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 11, borderRadius: 13, marginTop: 3 },
  neglectedText: { flex: 1, fontSize: 11, lineHeight: 16 },
  recordsCard: { paddingHorizontal: 14, paddingVertical: 3 },
  recordRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  recordIndex: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  recordIndexText: { fontSize: 10, fontWeight: '700' },
  recordCopy: { flex: 1, gap: 3 },
  recordName: { fontSize: 13, fontWeight: '700' },
  recordMeta: { fontSize: 10 },
  recordValue: { alignItems: 'flex-end' },
  recordNumber: { fontSize: 18, lineHeight: 21, fontWeight: '700' },
  recordUnit: { fontSize: 10 },
  levelCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, padding: 15 },
  levelMark: { width: 37, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  levelCopy: { flex: 1, gap: 4 },
  levelTitle: { fontSize: 14, fontWeight: '700' },
  prGroupTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.9, paddingTop: 10 },
  levelUpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 6 },
  levelUpText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  levelUpDate: { fontSize: 10, fontWeight: '600' },
  bmiFootnote: { fontSize: 12, textAlign: 'center', paddingVertical: 4 },
});