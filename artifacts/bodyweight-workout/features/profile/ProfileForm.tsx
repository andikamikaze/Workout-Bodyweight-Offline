import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ActionButton, AppScreen, PageHeader, Surface } from '@/components/WorkoutUI';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/src/store/AppContext';
import { tx } from '@/src/i18n';
import { Experience, Furniture, Gender, UserProfile, WorkoutGoal } from '@/src/types';

type Mode = 'onboarding' | 'edit';
type ReadinessAnswer = 'yes' | 'no' | null;
type ReadinessKey = 'heart' | 'chestPain' | 'dizziness' | 'joints' | 'other';

interface Draft {
  name: string;
  gender: Gender;
  birthDate: string;
  heightCm: string;
  weightKg: string;
  goal: WorkoutGoal;
  experience: Experience;
  furniture: Furniture[];
}

const EMPTY_DRAFT: Draft = {
  name: '',
  gender: 'female',
  birthDate: '',
  heightCm: '',
  weightKg: '',
  goal: 'fitness',
  experience: 'beginner',
  furniture: ['chair', 'wall'],
};

const READINESS_QUESTIONS: Array<{ key: ReadinessKey; id: string; en: string }> = [
  {
    key: 'heart',
    id: 'Apakah dokter pernah menyatakan Anda memiliki kondisi jantung atau tekanan darah yang perlu dibatasi saat berolahraga?',
    en: 'Has a doctor ever said that you have a heart or blood-pressure condition that limits exercise?',
  },
  {
    key: 'chestPain',
    id: 'Apakah Anda pernah merasa nyeri dada saat beraktivitas atau berolahraga?',
    en: 'Do you ever feel chest pain during activity or exercise?',
  },
  {
    key: 'dizziness',
    id: 'Apakah Anda pernah pingsan, kehilangan keseimbangan karena pusing, atau sesak berat saat beraktivitas?',
    en: 'Have you fainted, lost balance due to dizziness, or had severe shortness of breath during activity?',
  },
  {
    key: 'joints',
    id: 'Apakah ada masalah tulang atau sendi yang dapat memburuk karena perubahan aktivitas fisik?',
    en: 'Do you have a bone or joint problem that could worsen with a change in physical activity?',
  },
  {
    key: 'other',
    id: 'Apakah ada alasan kesehatan lain yang membuat Anda ragu untuk mulai berolahraga?',
    en: 'Is there another health reason that makes you unsure about starting exercise?',
  },
];

const GENDERS: Array<{ value: Gender; id: string; en: string }> = [
  { value: 'female', id: 'Perempuan', en: 'Female' },
  { value: 'male', id: 'Laki-laki', en: 'Male' },
];

const GOALS: Array<{ value: WorkoutGoal; id: string; en: string; detailId: string; detailEn: string }> = [
  {
    value: 'weight-loss',
    id: 'Menurunkan berat badan',
    en: 'Lose weight',
    detailId: 'Gerak rutin dan sesi seimbang',
    detailEn: 'Build a steady, balanced routine',
  },
  {
    value: 'muscle',
    id: 'Membentuk otot',
    en: 'Build strength',
    detailId: 'Latihan kekuatan bertahap',
    detailEn: 'Progressive bodyweight strength',
  },
  {
    value: 'fitness',
    id: 'Kebugaran umum',
    en: 'General fitness',
    detailId: 'Konsistensi dan daya tahan',
    detailEn: 'Consistency and endurance',
  },
];

const LEVELS: Array<{ value: Experience; id: string; en: string; detailId: string; detailEn: string }> = [
  {
    value: 'beginner',
    id: 'Pemula',
    en: 'Beginner',
    detailId: 'Mulai ringan, bangun kebiasaan',
    detailEn: 'Start gently and build a habit',
  },
  {
    value: 'intermediate',
    id: 'Menengah',
    en: 'Intermediate',
    detailId: 'Sudah rutin berolahraga',
    detailEn: 'You exercise regularly',
  },
  {
    value: 'advanced',
    id: 'Lanjut',
    en: 'Advanced',
    detailId: 'Nyaman dengan variasi menantang',
    detailEn: 'Comfortable with challenging moves',
  },
];

const FURNITURE: Array<{ value: Furniture; id: string; en: string; icon: keyof typeof Feather.glyphMap }> = [
  { value: 'chair', id: 'Kursi kokoh', en: 'Sturdy chair', icon: 'square' },
  { value: 'wall', id: 'Dinding', en: 'Wall', icon: 'grid' },
  { value: 'towel', id: 'Handuk', en: 'Towel', icon: 'minus' },
];

// Units conversion (metric is canonical in UserProfile).
// NOTE: DatePicker native (@react-native-community/datetimepicker) tidak tersedia
// di package.json, jadi tanggal lahir memakai popup kalender custom (BirthDateField,
// Modal + grid hari, tanpa dependency baru) dengan format tampil DD-MM-YYYY.
// Penyimpanan UserProfile.birthDate juga DD-MM-YYYY; data lama YYYY-MM-DD
// dinormalisasi sekali saat load di fromProfile.
const IN_TO_CM = 2.54;
const LB_TO_KG = 0.453592;

function cmToInDisplay(cm: number) {
  if (!Number.isFinite(cm)) return '';
  return String(Math.round((cm / IN_TO_CM) * 10) / 10);
}

function kgToLbDisplay(kg: number) {
  if (!Number.isFinite(kg)) return '';
  return String(Math.round((kg / LB_TO_KG) * 10) / 10);
}

function inToCm(inches: number) {
  return Math.round(inches * IN_TO_CM * 10) / 10;
}

function lbToKg(lb: number) {
  return Math.round(lb * LB_TO_KG * 10) / 10;
}

/** Normalisasi sekali saat load: nilai lama 'other'/'prefer-not' -> 'female'. */
function normalizeGender(value: string): Gender {
  return value === 'male' ? 'male' : 'female';
}

function fromProfile(profile: UserProfile | null, units: 'metric' | 'imperial' = 'metric'): Draft {
  if (!profile) return { ...EMPTY_DRAFT, furniture: [...EMPTY_DRAFT.furniture] };
  if (units === 'imperial') {
    return {
      name: profile.name,
      gender: normalizeGender(profile.gender),
      birthDate: normalizeBirthDate(profile.birthDate),
      heightCm: cmToInDisplay(profile.heightCm),
      weightKg: kgToLbDisplay(profile.weightKg),
      goal: profile.goal,
      experience: profile.experience,
      furniture: [...(profile.furniture ?? ['chair', 'wall'])],
    };
  }
  return {
    name: profile.name,
    gender: normalizeGender(profile.gender),
    birthDate: normalizeBirthDate(profile.birthDate),
    heightCm: String(profile.heightCm),
    weightKg: String(profile.weightKg),
    goal: profile.goal,
    experience: profile.experience,
    furniture: [...(profile.furniture ?? ['chair', 'wall'])],
  };
}

function readNumber(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return Number.NaN;
  return Number(normalized);
}

function pad2(value: number) {
  return value < 10 ? `0${value}` : String(value);
}

function formatDMY(year: number, month: number, day: number) {
  return `${pad2(day)}-${pad2(month)}-${year}`;
}

function parseDMY(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const probe = new Date(year, month - 1, day);
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/** Normalisasi sekali saat load: data lama YYYY-MM-DD -> DD-MM-YYYY. */
function normalizeBirthDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (parseDMY(trimmed)) return trimmed;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return trimmed;
  const probe = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (
    probe.getFullYear() !== Number(match[1]) ||
    probe.getMonth() !== Number(match[2]) - 1 ||
    probe.getDate() !== Number(match[3])
  ) {
    return trimmed;
  }
  return formatDMY(Number(match[1]), Number(match[2]), Number(match[3]));
}

function ageFromDate(value: string) {
  const parsed = parseDMY(value);
  if (!parsed) return null;
  const { year, month, day } = parsed;
  const birth = new Date(year, month - 1, day);
  const today = new Date();
  if (birth.getTime() > today.getTime()) return null;
  let age = today.getFullYear() - year;
  if (
    today.getMonth() < month - 1 ||
    (today.getMonth() === month - 1 && today.getDate() < day)
  ) {
    age -= 1;
  }
  return age;
}

function ProfileField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = 'sentences',
  maxLength,
  error,
  hint,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  maxLength?: number;
  error?: string;
  hint?: string;
  testID: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        accessibilityLabel={label}
        testID={testID}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        style={[
          styles.textInput,
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.destructive : colors.border,
            color: colors.foreground,
            borderRadius: colors.radius,
          },
        ]}
      />
      {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
      {!error && hint ? <Text style={[styles.hintText, { color: colors.mutedForeground }]}>{hint}</Text> : null}
    </View>
  );
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_NAMES_ID = ['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mn'];
const WEEKDAY_NAMES_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function BirthDateField({
  label,
  value,
  onSelect,
  placeholder,
  hint,
  error,
  testID,
  language,
}: {
  label: string;
  value: string;
  onSelect: (value: string) => void;
  placeholder: string;
  hint?: string;
  error?: string;
  testID: string;
  language: 'id' | 'en';
}) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  // Bulan yang sedang ditampilkan di kalender (1-12).
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear() - 20);
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth() + 1);
  // Tanggal terpilih sementara di dalam popup (belum ditulis ke draft).
  const [picked, setPicked] = useState<{ year: number; month: number; day: number } | null>(null);

  const today = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  }, []);
  const minYear = today.year - 100;

  const openPicker = () => {
    const parsed = parseDMY(value);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
      setPicked(parsed);
    } else {
      const fallback = new Date(today.year - 20, today.month - 1, today.day);
      setViewYear(fallback.getFullYear());
      setViewMonth(fallback.getMonth() + 1);
      setPicked(null);
    }
    Keyboard.dismiss();
    setVisible(true);
  };

  const canGoPrev = viewYear > minYear || (viewYear === minYear && viewMonth > 1);
  const canGoNext =
    viewYear < today.year || (viewYear === today.year && viewMonth < today.month);

  const goPrev = () => {
    if (!canGoPrev) return;
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    if (!canGoNext) return;
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Sel kalender: null = sel kosong, selain itu nomor tanggal bulan tampil.
  // Tanggal > hari ini dinonaktifkan (tidak bisa lahir di masa depan).
  const cells = useMemo(() => {
    const firstWeekday = (new Date(viewYear, viewMonth - 1, 1).getDay() + 6) % 7; // Senin=0
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const list: Array<number | null> = [];
    for (let i = 0; i < firstWeekday; i += 1) list.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) list.push(d);
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [viewYear, viewMonth]);

  const isFutureDay = (day: number) => {
    if (viewYear !== today.year || viewMonth !== today.month) {
      return viewYear > today.year || (viewYear === today.year && viewMonth > today.month);
    }
    return day > today.day;
  };

  const monthNames = language === 'id' ? MONTH_NAMES_ID : MONTH_NAMES_EN;
  const weekdayNames = language === 'id' ? WEEKDAY_NAMES_ID : WEEKDAY_NAMES_EN;

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        testID={testID}
        onPress={openPicker}
        style={[
          styles.textInput,
          styles.dateInput,
          {
            backgroundColor: colors.card,
            borderColor: error ? colors.destructive : colors.border,
            borderRadius: colors.radius,
          },
        ]}
      >
        <Text style={{ fontSize: 15, color: value ? colors.foreground : colors.mutedForeground }}>
          {value || placeholder}
        </Text>
        <Feather name="calendar" size={18} color={colors.mutedForeground} />
      </Pressable>
      {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
      {!error && hint ? <Text style={[styles.hintText, { color: colors.mutedForeground }]}>{hint}</Text> : null}

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setVisible(false)}>
          <Pressable
            style={[styles.calendarCard, { backgroundColor: colors.card, borderRadius: colors.radius }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.calendarHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx(language, 'Bulan sebelumnya', 'Previous month')}
                testID="birth-date-prev-month"
                onPress={goPrev}
                disabled={!canGoPrev}
                style={[styles.monthNav, { opacity: canGoPrev ? 1 : 0.3 }]}
              >
                <Feather name="chevron-left" size={22} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.calendarTitle, { color: colors.foreground }]}>
                {monthNames[viewMonth - 1]} {viewYear}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx(language, 'Bulan berikutnya', 'Next month')}
                testID="birth-date-next-month"
                onPress={goNext}
                disabled={!canGoNext}
                style={[styles.monthNav, { opacity: canGoNext ? 1 : 0.3 }]}
              >
                <Feather name="chevron-right" size={22} color={colors.foreground} />
              </Pressable>
            </View>
            <View style={styles.weekdayRow}>
              {weekdayNames.map((name) => (
                <Text key={name} style={[styles.weekdayCell, { color: colors.mutedForeground }]}>
                  {name}
                </Text>
              ))}
            </View>
            <View style={styles.daysGrid}>
              {cells.map((day, index) => {
                if (day === null) return <View key={`empty-${index}`} style={styles.dayCell} />;
                const disabled = isFutureDay(day);
                const selected =
                  picked !== null &&
                  picked.year === viewYear &&
                  picked.month === viewMonth &&
                  picked.day === day;
                return (
                  <Pressable
                    key={`day-${day}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled }}
                    accessibilityLabel={`${day} ${monthNames[viewMonth - 1]} ${viewYear}`}
                    testID={`birth-date-day-${day}`}
                    disabled={disabled}
                    onPress={() => setPicked({ year: viewYear, month: viewMonth, day })}
                    style={[
                      styles.dayCell,
                      selected ? { backgroundColor: colors.primary, borderRadius: colors.radius } : null,
                      { opacity: disabled ? 0.3 : 1 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: selected ? colors.primaryForeground : colors.foreground },
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.calendarFooter}>
              <Pressable
                accessibilityRole="button"
                testID="birth-date-cancel"
                onPress={() => setVisible(false)}
                style={[styles.calendarButton, { borderColor: colors.border, borderRadius: colors.radius }]}
              >
                <Text style={[styles.calendarButtonText, { color: colors.foreground }]}>
                  {tx(language, 'Batal', 'Cancel')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                testID="birth-date-confirm"
                disabled={picked === null}
                onPress={() => {
                  if (picked) onSelect(formatDMY(picked.year, picked.month, picked.day));
                  setVisible(false);
                }}
                style={[
                  styles.calendarButton,
                  styles.calendarConfirm,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: colors.radius,
                    opacity: picked === null ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={[styles.calendarButtonText, { color: colors.primaryForeground }]}>
                  {tx(language, 'Pilih', 'Select')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ChoiceButton({  label,
  selected,
  onPress,
  accessibilityLabel,
  testID,
  detail,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  testID: string;
  detail?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? colors.secondary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={styles.choiceCopy}>
        <Text style={[styles.choiceTitle, { color: colors.foreground }]}>{label}</Text>
        {detail ? <Text style={[styles.choiceDetail, { color: colors.mutedForeground }]}>{detail}</Text> : null}
      </View>
      <View
        style={[
          styles.radioOuter,
          { borderColor: selected ? colors.primary : colors.border },
        ]}
      >
        {selected ? <View style={[styles.radioInner, { backgroundColor: colors.primary }]} /> : null}
      </View>
    </Pressable>
  );
}

function CheckRow({
  checked,
  onPress,
  title,
  detail,
  testID,
}: {
  checked: boolean;
  onPress: () => void;
  title: string;
  detail?: string;
  testID: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={title}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.checkRow, { opacity: pressed ? 0.78 : 1 }]}
    >
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: checked ? colors.primary : colors.card,
            borderColor: checked ? colors.primary : colors.border,
          },
        ]}
      >
        {checked ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
      </View>
      <View style={styles.choiceCopy}>
        <Text style={[styles.checkTitle, { color: colors.foreground }]}>{title}</Text>
        {detail ? <Text style={[styles.choiceDetail, { color: colors.mutedForeground }]}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

export function ProfileForm({ mode }: { mode: Mode }) {
  const colors = useColors();
  const {
    snapshot,
    ready,
    saveProfile,
    updateProfile,
    updateSettings,
  } = useApp();
  const existingProfile = snapshot.profile;
  const isEditing = mode === 'edit';
  const language = snapshot.settings.language;
  const units = snapshot.settings.units;
  const isImperial = units === 'imperial';
  // Edit dan onboarding sama-sama 3 langkah agar PAR-Q bisa direview di mode edit.
  const totalSteps = 3;
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => {
    const base = fromProfile(existingProfile, snapshot.settings.units);
    // Onboarding tanpa profil: hormati settings.allowedFurniture bila sudah ada,
    // fallback default ['chair','wall']. Kosong = lantai saja (diizinkan).
    if (!existingProfile && snapshot.settings.allowedFurniture) {
      base.furniture = [...snapshot.settings.allowedFurniture];
    }
    return base;
  });
  const [answers, setAnswers] = useState<Record<ReadinessKey, ReadinessAnswer>>({
    heart: null,
    chestPain: null,
    dizziness: null,
    joints: null,
    other: null,
  });
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(
    () => existingProfile?.medicalDisclaimerAccepted ?? false,
  );
  const [riskConfirmed, setRiskConfirmed] = useState(false);
  // Mode edit: PAR-Q tampil read-only dulu, bisa dibuka via tombol Ubah.
  const [readinessUnlocked, setReadinessUnlocked] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing || !ready) return;
    if (snapshot.profile) {
      setDraft(fromProfile(snapshot.profile, snapshot.settings.units));
      setDisclaimerAccepted(snapshot.profile.medicalDisclaimerAccepted ?? false);
      // Prefill jawaban bila sebelumnya tidak ada risiko agar review ringan;
      // bila ada risiko, kosongkan agar pengguna meninjau ulang eksplisit.
      if (!snapshot.profile.parqRisk) {
        setAnswers({ heart: 'no', chestPain: 'no', dizziness: 'no', joints: 'no', other: 'no' });
      } else {
        setAnswers({ heart: null, chestPain: null, dizziness: null, joints: null, other: null });
      }
      setRiskConfirmed(false);
    } else router.replace('/onboarding');
  }, [isEditing, ready, snapshot.profile, snapshot.settings.units]);

  const hasRisk = useMemo(
    () => Object.values(answers).some((answer) => answer === 'yes'),
    [answers],
  );

  const consentDateLabel = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const setDraftValue = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const toggleFurniture = (furniture: Furniture) => {
    const selected = draft.furniture.includes(furniture);
    const next = selected
      ? draft.furniture.filter((item) => item !== furniture)
      : [...draft.furniture, furniture];
    setDraft((current) => ({ ...current, furniture: next }));
    // Sinkron dua arah: draft <-> settings.allowedFurniture.
    // Kosong diizinkan = lantai saja. Default ['chair','wall'] via EMPTY_DRAFT.
    updateSettings({ allowedFurniture: next });
  };

  const validateBasics = () => {
    const nextErrors: Record<string, string> = {};
    if (!draft.name.trim()) {
      nextErrors.name = tx(language, 'Masukkan nama panggilan.', 'Enter a nickname.');
    } else if (draft.name.trim().length > 40) {
      nextErrors.name = tx(language, 'Nama maksimal 40 karakter.', 'Name must be 40 characters or fewer.');
    }
    // Validasi tanggal lahir DD-MM-YYYY (dipilih via popup kalender):
    // format ketat, tanggal kalender nyata, tidak di masa depan, usia 13–100.
    const rawBirth = draft.birthDate.trim();
    const parsedBirth = parseDMY(rawBirth);
    if (!parsedBirth) {
      nextErrors.birthDate = tx(language, 'Gunakan tanggal valid dengan format DD-MM-YYYY.', 'Use a valid date in DD-MM-YYYY format.');
    } else {
      const age = ageFromDate(rawBirth);
      if (age === null) {
        nextErrors.birthDate = tx(language, 'Tanggal lahir tidak boleh di masa depan.', 'Birth date cannot be in the future.');
      } else if (age < 13) {
        nextErrors.birthDate = tx(language, 'Usia minimum untuk menggunakan aplikasi adalah 13 tahun.', 'You must be at least 13 to use this app.');
      } else if (age > 100) {
        nextErrors.birthDate = tx(language, 'Usia maksimal 100 tahun.', 'Age must be 100 years or younger.');
      }
    }
    // Validasi metrik 100–250cm / 30–300kg; bila imperial, konversi dulu ke metrik.
    const rawHeight = readNumber(draft.heightCm);
    const rawWeight = readNumber(draft.weightKg);
    const heightMetric = isImperial ? rawHeight * IN_TO_CM : rawHeight;
    const weightMetric = isImperial ? rawWeight * LB_TO_KG : rawWeight;
    if (!Number.isFinite(heightMetric) || heightMetric < 100 || heightMetric > 250) {
      nextErrors.heightCm = tx(language, 'Tinggi harus antara 100–250 cm.', 'Height must be between 100–250 cm.');
    }
    if (!Number.isFinite(weightMetric) || weightMetric < 30 || weightMetric > 300) {
      nextErrors.weightKg = tx(language, 'Berat harus antara 30–300 kg.', 'Weight must be between 30–300 kg.');
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateReadiness = () => {
    const nextErrors: Record<string, string> = {};
    if (READINESS_QUESTIONS.some(({ key }) => answers[key] === null)) {
      nextErrors.answers = tx(language, 'Jawab semua pertanyaan kesiapan fisik.', 'Answer all readiness questions.');
    }
    if (!disclaimerAccepted) {
      nextErrors.disclaimer = tx(language, 'Persetujuan disclaimer medis wajib.', 'Medical disclaimer consent is required.');
    }
    if (hasRisk && !riskConfirmed) {
      nextErrors.risk = tx(language, 'Konfirmasikan bahwa Anda telah membaca anjuran konsultasi dokter.', 'Confirm that you have read the doctor-consultation advice.');
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const needsReadinessValidation = !isEditing || readinessUnlocked;

  const handleContinue = () => {
    Keyboard.dismiss();
    if (step === 0 && !validateBasics()) return;
    if (step === 2 && needsReadinessValidation && !validateReadiness()) return;
    if (step < totalSteps - 1) {
      setErrors({});
      setStep((current) => current + 1);
      return;
    }
    void handleSave();
  };

  const handleSave = async () => {
    if (!validateBasics()) return;
    if (needsReadinessValidation && !validateReadiness()) {
      // Bila validasi kesiapan gagal saat di langkah akhir, tahan di step 2.
      setStep(2);
      return;
    }
    // Konversi ke metrik saat simpan bila imperial.
    const rawHeight = readNumber(draft.heightCm);
    const rawWeight = readNumber(draft.weightKg);
    const heightMetric = isImperial ? inToCm(rawHeight) : rawHeight;
    const weightMetric = isImperial ? lbToKg(rawWeight) : rawWeight;
    setSaving(true);
    const profile: UserProfile = {
      name: draft.name.trim(),
      gender: draft.gender,
      birthDate: draft.birthDate.trim(),
      heightCm: heightMetric,
      weightKg: weightMetric,
      goal: draft.goal,
      // experience mapping 1:1 ke level generator (beginner/intermediate/advanced).
      experience: draft.experience,
      furniture: draft.furniture,
      parqRisk: isEditing
        ? (readinessUnlocked ? hasRisk : (existingProfile?.parqRisk ?? false))
        : hasRisk,
      medicalDisclaimerAccepted: isEditing
        ? (readinessUnlocked ? disclaimerAccepted : (existingProfile?.medicalDisclaimerAccepted ?? false))
        : disclaimerAccepted,
    };
    try {
      if (isEditing) {
        updateProfile(profile);
      } else {
        saveProfile(profile);
      }
      updateSettings({ allowedFurniture: profile.furniture });
      if (isEditing) router.back();
      else router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setErrors({});
      setStep((current) => current - 1);
      return;
    }
    if (isEditing) router.back();
  };

  if (!ready && isEditing) {
    return (
      <AppScreen scroll={false}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            {tx(language, 'Memuat profil…', 'Loading profile…')}
          </Text>
        </View>
      </AppScreen>
    );
  }

  const progress = ((step + 1) / totalSteps) * 100;
  const heading = isEditing
    ? tx(language, 'Profil Anda', 'Your profile')
    : tx(language, 'Mulai dengan nyaman', 'Start at your pace');

  const heightLabel = isImperial
    ? tx(language, 'Tinggi (inci)', 'Height (in)')
    : tx(language, 'Tinggi (cm)', 'Height (cm)');
  const weightLabel = isImperial
    ? tx(language, 'Berat (lb)', 'Weight (lb)')
    : tx(language, 'Berat (kg)', 'Weight (kg)');

  const showReadOnlyReadiness = isEditing && step === 2 && !readinessUnlocked;
  const showEditableReadiness = step === 2 && (!isEditing || readinessUnlocked);

  return (
    <AppScreen scroll={false}>
      <KeyboardAwareScrollViewCompat
        bottomOffset={24}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topLine}>
          {isEditing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tx(language, 'Kembali', 'Go back')}
              testID="profile-back"
              onPress={goBack}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={21} color={colors.foreground} />
            </Pressable>
          ) : (
            <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
              <Feather name="activity" size={20} color={colors.accent} />
            </View>
          )}
          <View style={styles.stepMeta}>
            <Text style={[styles.stepText, { color: colors.mutedForeground }]}>
              {tx(language, `LANGKAH ${step + 1} DARI ${totalSteps}`, `STEP ${step + 1} OF ${totalSteps}`)}
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${progress}%` }]} />
            </View>
          </View>
        </View>

        <PageHeader
          eyebrow={isEditing ? tx(language, 'Data pribadi', 'Personal details') : tx(language, 'Gerak • latihan tanpa alat', 'Gerak • equipment-free training')}
          title={step === 0 ? heading : step === 1 ? tx(language, 'Rencana yang cocok', 'A plan that fits') : tx(language, 'Kesiapan dan keamanan', 'Readiness and safety')}
          subtitle={
            step === 0
              ? tx(language, 'Isi detail dasar agar rencana latihan terasa pas untuk Anda.', 'Share a few basics so your plan can fit you.')
              : step === 1
                ? tx(language, 'Pilih tujuan, pengalaman, dan perabot yang aman digunakan.', 'Choose your goal, experience, and safe household supports.')
                : tx(language, 'Jawab singkat. Data kesehatan tetap tersimpan hanya di perangkat.', 'A quick check. Your health details stay on this device.')
          }
        />

        {step === 0 ? (
          <View style={styles.formSection}>
            <ProfileField
              label={tx(language, 'Nama panggilan', 'Nickname')}
              value={draft.name}
              onChangeText={(value) => setDraftValue('name', value)}
              placeholder={tx(language, 'Contoh: Naya', 'For example: Naya')}
              autoCapitalize="words"
              maxLength={40}
              error={errors.name}
              testID="profile-name"
            />
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{tx(language, 'Jenis kelamin', 'Gender')}</Text>
              <View style={styles.choiceGrid}>
                {GENDERS.map((option) => (
                  <ChoiceButton
                    key={option.value}
                    label={tx(language, option.id, option.en)}
                    selected={draft.gender === option.value}
                    onPress={() => setDraftValue('gender', option.value)}
                    accessibilityLabel={`${tx(language, 'Jenis kelamin', 'Gender')}: ${tx(language, option.id, option.en)}`}
                    testID={`gender-${option.value}`}
                  />
                ))}
              </View>
            </View>
            <BirthDateField
              label={tx(language, 'Tanggal lahir', 'Date of birth')}
              value={draft.birthDate}
              onSelect={(selected) => setDraftValue('birthDate', selected)}
              placeholder="DD-MM-YYYY"
              hint={tx(language, 'Ketuk untuk memilih tanggal (tanggal-bulan-tahun)', 'Tap to pick a date (day-month-year)')}
              error={errors.birthDate}
              testID="profile-birth-date"
              language={language}
            />
            <View style={styles.measureRow}>
              <View style={styles.measureItem}>
                <ProfileField
                  label={heightLabel}
                  value={draft.heightCm}
                  onChangeText={(value) =>
                    setDraftValue(
                      'heightCm',
                      isImperial
                        ? value.replace(/[^\d.]/g, '').slice(0, 6)
                        : value.replace(/[^\d]/g, '').slice(0, 3),
                    )
                  }
                  placeholder={isImperial ? '65' : '165'}
                  keyboardType={isImperial ? 'decimal-pad' : 'numeric'}
                  maxLength={6}
                  error={errors.heightCm}
                  testID="profile-height"
                />
              </View>
              <View style={styles.measureItem}>
                <ProfileField
                  label={weightLabel}
                  value={draft.weightKg}
                  onChangeText={(value) => setDraftValue('weightKg', value.replace(/[^\d,.]/g, '').slice(0, 6))}
                  placeholder={isImperial ? '132' : '60'}
                  keyboardType="decimal-pad"
                  maxLength={6}
                  error={errors.weightKg}
                  testID="profile-weight"
                />
              </View>
            </View>
            {isImperial ? (
              <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                {tx(language, 'Disimpan sebagai cm/kg (1 inci = 2,54 cm, 1 lb = 0,453592 kg).', 'Stored as cm/kg (1 in = 2.54 cm, 1 lb = 0.453592 kg).')}
              </Text>
            ) : null}
            {!isEditing ? (
              <Text style={[styles.privacyLine, { color: colors.mutedForeground }]}>
                <Feather name="lock" size={13} color={colors.primary} />{' '}
                {tx(language, 'Disimpan lokal. Tidak perlu akun atau koneksi internet.', 'Saved locally. No account or internet connection needed.')}
              </Text>
            ) : null}
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.formSection}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{tx(language, 'Tujuan Anda', 'Your goal')}</Text>
              {GOALS.map((goal) => (
                <ChoiceButton
                  key={goal.value}
                  label={tx(language, goal.id, goal.en)}
                  detail={tx(language, goal.detailId, goal.detailEn)}
                  selected={draft.goal === goal.value}
                  onPress={() => setDraftValue('goal', goal.value)}
                  accessibilityLabel={`${tx(language, 'Tujuan', 'Goal')}: ${tx(language, goal.id, goal.en)}`}
                  testID={`goal-${goal.value}`}
                />
              ))}
            </View>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{tx(language, 'Pengalaman latihan', 'Training experience')}</Text>
              {LEVELS.map((level) => (
                <ChoiceButton
                  key={level.value}
                  label={tx(language, level.id, level.en)}
                  detail={tx(language, level.detailId, level.detailEn)}
                  selected={draft.experience === level.value}
                  onPress={() => setDraftValue('experience', level.value)}
                  accessibilityLabel={`${tx(language, 'Pengalaman', 'Experience')}: ${tx(language, level.id, level.en)}`}
                  testID={`experience-${level.value}`}
                />
              ))}
            </View>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{tx(language, 'Perabot yang boleh digunakan', 'Supports you can use')}</Text>
              <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                {tx(language, 'Tanpa pilihan berarti latihan lantai saja.', 'With none selected, plans use floor-only exercises.')}
              </Text>
              <View style={styles.furnitureGrid}>
                {FURNITURE.map((item) => {
                  const selected = draft.furniture.includes(item.value);
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={tx(language, item.id, item.en)}
                      testID={`furniture-${item.value}`}
                      onPress={() => toggleFurniture(item.value)}
                      style={({ pressed }) => [
                        styles.furnitureCard,
                        {
                          backgroundColor: selected ? colors.secondary : colors.card,
                          borderColor: selected ? colors.primary : colors.border,
                          borderRadius: colors.radius,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Feather name={item.icon} size={18} color={selected ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.furnitureLabel, { color: colors.foreground }]}>{tx(language, item.id, item.en)}</Text>
                      <View style={styles.furnitureCheck}>
                        {selected ? <Feather name="check" size={14} color={colors.primary} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {showReadOnlyReadiness ? (
          <View style={styles.formSection}>
            <Surface style={styles.disclaimerCard}>
              <Text style={[styles.disclaimerTitle, { color: colors.foreground }]}>
                {tx(language, 'Kesiapan & Persetujuan', 'Readiness & Consent')}
              </Text>
              <Text style={[styles.disclaimerCopy, { color: colors.mutedForeground }]}>
                {existingProfile?.parqRisk
                  ? tx(language, 'Status PAR-Q: ada jawaban “Ya” — disarankan konsultasi dokter sebelum latihan intens.', 'PAR-Q status: answered “Yes” — doctor consultation advised before intense training.')
                  : tx(language, 'Status PAR-Q: semua “Tidak” — tidak ada risiko terdeteksi dari jawaban terakhir.', 'PAR-Q status: all “No” — no risk detected from last answers.')}
              </Text>
              {READINESS_QUESTIONS.map((question) => (
                <View key={question.key} style={styles.readOnlyQuestion}>
                  <Feather name="lock" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.readOnlyQuestionText, { color: colors.mutedForeground }]}>
                    {tx(language, question.id, question.en)}
                  </Text>
                </View>
              ))}
              <View style={[styles.consentMeta, { borderTopColor: colors.border }]}>
                <Text style={[styles.consentMetaText, { color: colors.foreground }]}>
                  {tx(language, 'Disclaimer medis: ', 'Medical disclaimer: ')}
                  <Text style={{ fontWeight: '700' }}>
                    {existingProfile?.medicalDisclaimerAccepted
                      ? tx(language, 'Disetujui', 'Accepted')
                      : tx(language, 'Belum disetujui', 'Not accepted')}
                  </Text>
                </Text>
                <Text style={[styles.consentMetaText, { color: colors.mutedForeground }]}>
                  {tx(language, 'Tanggal persetujuan: ', 'Consent date: ')}
                  {existingProfile?.medicalDisclaimerAccepted
                    ? tx(language, 'tercatat saat pendaftaran (stempel waktu tidak disimpan di schema v1)', 'recorded at signup (timestamp not stored in schema v1)')
                    : '—'}
                </Text>
              </View>
              <ActionButton
                title={tx(language, 'Ubah / Tinjau ulang', 'Change / Review')}
                onPress={() => setReadinessUnlocked(true)}
                variant="outline"
                testID="parq-review-edit"
              />
            </Surface>
          </View>
        ) : null}

        {showEditableReadiness ? (
          <View style={styles.formSection}>
            {isEditing ? (
              <Surface style={styles.noticeCard}>
                <Feather name="edit-3" size={18} color={colors.primary} />
                <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
                  {tx(language, 'Anda meninjau ulang kesiapan. Jawab semua pertanyaan untuk memperbarui status risiko.', 'You are reviewing readiness. Answer all questions to update the risk status.')}
                </Text>
              </Surface>
            ) : null}
            <Surface style={styles.parqCard}>
              <View style={styles.parqHeading}>
                <View style={[styles.parqIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name="heart" size={18} color={colors.primary} />
                </View>
                <View style={styles.choiceCopy}>
                  <Text style={[styles.parqTitle, { color: colors.foreground }]}>{tx(language, 'Cek kesiapan singkat', 'Quick readiness check')}</Text>
                  <Text style={[styles.choiceDetail, { color: colors.mutedForeground }]}>{tx(language, 'Pilih “ya” atau “tidak” untuk tiap pertanyaan.', 'Choose “yes” or “no” for each question.')}</Text>
                </View>
              </View>
              {READINESS_QUESTIONS.map((question) => (
                <View key={question.key} style={[styles.question, { borderTopColor: colors.border }]}>
                  <Text style={[styles.questionText, { color: colors.foreground }]}>{tx(language, question.id, question.en)}</Text>
                  <View style={styles.answerRow}>
                    {(['yes', 'no'] as const).map((answer) => {
                      const selected = answers[question.key] === answer;
                      return (
                        <Pressable
                          key={answer}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          accessibilityLabel={`${tx(language, question.id, question.en)} — ${answer === 'yes' ? tx(language, 'Ya', 'Yes') : tx(language, 'Tidak', 'No')}`}
                          testID={`parq-${question.key}-${answer}`}
                          onPress={() => {
                            setAnswers((current) => ({ ...current, [question.key]: answer }));
                            setRiskConfirmed(false);
                            setErrors((current) => ({ ...current, answers: '', risk: '' }));
                          }}
                          style={[
                            styles.answerButton,
                            {
                              borderColor: selected ? colors.primary : colors.border,
                              backgroundColor: selected ? colors.secondary : colors.card,
                            },
                          ]}
                        >
                          <Text style={[styles.answerText, { color: selected ? colors.primary : colors.foreground }]}>
                            {answer === 'yes' ? tx(language, 'Ya', 'Yes') : tx(language, 'Tidak', 'No')}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </Surface>
            {errors.answers ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.answers}</Text> : null}

            {hasRisk ? (
              <Surface style={[styles.warningCard, { borderColor: colors.destructive }]}>
                <View style={styles.warningHeading}>
                  <Feather name="alert-triangle" size={19} color={colors.destructive} />
                  <Text style={[styles.warningTitle, { color: colors.destructive }]}>{tx(language, 'Utamakan keselamatan', 'Put safety first')}</Text>
                </View>
                <Text style={[styles.warningCopy, { color: colors.foreground }]}>
                  {tx(language, 'Jawaban Anda menunjukkan kemungkinan faktor risiko. Sebaiknya konsultasikan kondisi Anda dengan dokter sebelum memulai atau mengubah aktivitas olahraga.', 'Your answers suggest a possible risk factor. Please consult a doctor before starting or changing your exercise routine.')}
                </Text>
                <CheckRow
                  checked={riskConfirmed}
                  onPress={() => {
                    setRiskConfirmed((current) => !current);
                    setErrors((current) => ({ ...current, risk: '' }));
                  }}
                  title={tx(language, 'Saya sudah membaca anjuran ini dan memilih untuk melanjutkan.', 'I have read this advice and choose to continue.')}
                  testID="parq-risk-confirmation"
                />
                {errors.risk ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.risk}</Text> : null}
              </Surface>
            ) : null}

            <Surface style={styles.disclaimerCard}>
              <Text style={[styles.disclaimerTitle, { color: colors.foreground }]}>{tx(language, 'Disclaimer medis', 'Medical disclaimer')}</Text>
              <Text style={[styles.disclaimerCopy, { color: colors.mutedForeground }]}>
                {tx(language, 'Aplikasi ini untuk kebugaran umum, bukan diagnosis atau pengganti saran tenaga kesehatan. Hentikan latihan bila merasa nyeri, pusing, atau tidak nyaman.', 'This app supports general fitness; it is not a diagnosis or a replacement for medical advice. Stop exercising if you feel pain, dizziness, or discomfort.')}
              </Text>
              <CheckRow
                checked={disclaimerAccepted}
                onPress={() => {
                  setDisclaimerAccepted((current) => !current);
                  setErrors((current) => ({ ...current, disclaimer: '' }));
                }}
                title={tx(language, 'Saya telah membaca dan menyetujui disclaimer.', 'I have read and agree to the disclaimer.')}
                testID="medical-disclaimer-consent"
              />
              {disclaimerAccepted ? (
                <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                  {tx(language, `Tanggal persetujuan: ${consentDateLabel} (waktu tinjauan saat ini)`, `Consent date: ${consentDateLabel} (current review date)`)}
                </Text>
              ) : null}
              {errors.disclaimer ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.disclaimer}</Text> : null}
              {isEditing ? (
                <ActionButton
                  title={tx(language, 'Kembali ke ringkasan', 'Back to summary')}
                  onPress={() => {
                    setReadinessUnlocked(false);
                    setErrors({});
                  }}
                  variant="outline"
                  testID="parq-review-cancel"
                />
              ) : null}
            </Surface>
          </View>
        ) : null}

        {isEditing && step === 1 ? (
          <View style={styles.editNotice}>
            <Surface style={styles.noticeCard}>
              <Feather name="info" size={18} color={colors.primary} />
              <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
                {tx(language, 'Perubahan berat akan ditambahkan ke riwayat agar grafik BMI tetap akurat.', 'Weight changes are added to your history to keep the BMI chart accurate.')}
              </Text>
            </Surface>
          </View>
        ) : null}

        {errors.form ? <Text style={[styles.errorText, { color: colors.destructive }]}>{errors.form}</Text> : null}
        <View style={styles.footer}>
          {step > 0 ? (
            <ActionButton
              title={tx(language, 'Kembali', 'Back')}
              onPress={goBack}
              variant="outline"
              style={styles.footerSecondary}
              testID="profile-previous"
            />
          ) : null}
          <ActionButton
            title={
              saving
                ? tx(language, 'Menyimpan…', 'Saving…')
                : step === totalSteps - 1
                  ? isEditing
                    ? tx(language, 'Simpan perubahan', 'Save changes')
                    : tx(language, 'Selesai dan mulai', 'Finish and start')
                  : tx(language, 'Lanjut', 'Continue')
            }
            onPress={handleContinue}
            loading={saving}
            disabled={!ready && isEditing}
            style={styles.footerPrimary}
            testID={step === totalSteps - 1 ? 'profile-save' : 'profile-continue'}
          />
        </View>
      </KeyboardAwareScrollViewCompat>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
    gap: 20,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 3 },
  brandMark: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  backButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepMeta: { flex: 1, gap: 8 },
  stepText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  progressTrack: { height: 6, overflow: 'hidden', borderRadius: 5 },
  progressFill: { height: '100%', borderRadius: 5 },
  formSection: { gap: 18 },
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '700' },
  textInput: { minHeight: 52, borderWidth: 1, paddingHorizontal: 15, fontSize: 15 },
  dateInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  calendarCard: { padding: 18, gap: 12 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  calendarTitle: { fontSize: 16, fontWeight: '700' },
  weekdayRow: { flexDirection: 'row' },
  weekdayCell: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', paddingVertical: 6 },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, fontWeight: '600' },
  calendarFooter: { flexDirection: 'row', gap: 10, marginTop: 4 },
  calendarButton: { flex: 1, minHeight: 48, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  calendarConfirm: { borderWidth: 0 },
  calendarButtonText: { fontSize: 14, fontWeight: '700' },
  errorText: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  hintText: { fontSize: 12, lineHeight: 17 },
  choiceGrid: { gap: 8 },
  choice: {
    minHeight: 52,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  choiceCopy: { flex: 1, gap: 3 },
  choiceTitle: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  choiceDetail: { fontSize: 12, lineHeight: 17 },
  radioOuter: { width: 21, height: 21, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 11, height: 11, borderRadius: 6 },
  measureRow: { flexDirection: 'row', gap: 12 },
  measureItem: { flex: 1 },
  privacyLine: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  furnitureGrid: { flexDirection: 'row', gap: 8 },
  furnitureCard: {
    minHeight: 88,
    flex: 1,
    borderWidth: 1,
    padding: 10,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  furnitureLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  furnitureCheck: { position: 'absolute', top: 9, right: 9 },
  parqCard: { padding: 0, overflow: 'hidden' },
  parqHeading: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 15 },
  parqIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  parqTitle: { fontSize: 15, fontWeight: '700' },
  question: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 11 },
  questionText: { fontSize: 13, lineHeight: 19 },
  answerRow: { flexDirection: 'row', gap: 8 },
  answerButton: { minHeight: 40, minWidth: 74, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 14 },
  answerText: { fontSize: 13, fontWeight: '700' },
  warningCard: { borderWidth: 1, gap: 11 },
  warningHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  warningTitle: { fontSize: 15, fontWeight: '700' },
  warningCopy: { fontSize: 13, lineHeight: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 5 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkTitle: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  disclaimerCard: { gap: 10 },
  disclaimerTitle: { fontSize: 14, fontWeight: '700' },
  disclaimerCopy: { fontSize: 13, lineHeight: 19 },
  readOnlyQuestion: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  readOnlyQuestionText: { flex: 1, fontSize: 12, lineHeight: 17 },
  consentMeta: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 4 },
  consentMetaText: { fontSize: 12, lineHeight: 17 },
  editNotice: { marginTop: -5 },
  noticeCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 3 },
  footerPrimary: { flex: 1 },
  footerSecondary: { minWidth: 105 },
});
