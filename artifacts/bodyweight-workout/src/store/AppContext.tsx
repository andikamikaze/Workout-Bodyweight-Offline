import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AppSettings,
  AppSnapshot,
  BackupFile,
  UserProfile,
  WeightEntry,
  WorkoutPlan,
  WorkoutSession,
  ActiveWorkout,
} from '@/src/types';

const STORAGE_KEY = 'bodyweight-workout.snapshot.v1';

// FR-09 §7 — Kunci settings wajib (12 keys). Harus selaras dengan
// validateBackup() di app/(tabs)/settings.tsx:
// sound, vibration, keepScreen, furniture, silentMode, bmiStandard,
// units, language, theme, weeklyGoal, reminderEnabled, reminderTime.
const REQUIRED_SETTINGS_KEYS: Array<keyof AppSettings> = [
  'soundEnabled',
  'vibrationEnabled',
  'keepScreenAwake',
  'allowedFurniture',
  'silentMode',
  'bmiStandard',
  'units',
  'language',
  'theme',
  'weeklyGoal',
  'reminderEnabled',
  'reminderTime',
];

const defaultSettings: AppSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  keepScreenAwake: true,
  allowedFurniture: ['chair', 'wall'],
  silentMode: false,
  bmiStandard: 'kemenkes',
  units: 'metric',
  language: 'id',
  theme: 'system',
  weeklyGoal: 3,
  reminderEnabled: false,
  reminderTime: '18:00',
};

export const emptySnapshot: AppSnapshot = {
  schemaVersion: 1,
  profile: null,
  settings: defaultSettings,
  sessions: [],
  weightEntries: [],
  savedPlans: [],
  currentPlan: null,
  activeWorkout: null,
};

interface AppContextValue {
  snapshot: AppSnapshot;
  ready: boolean;
  storageError: string | null;
  saveProfile: (profile: UserProfile) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  saveWeightEntry: (weightKg: number) => void;
  setCurrentPlan: (plan: WorkoutPlan | null) => void;
  savePlanTemplate: (plan: WorkoutPlan) => void;
  removePlanTemplate: (id: string) => void;
  setActiveWorkout: (
    next: ActiveWorkout | null | ((current: ActiveWorkout | null) => ActiveWorkout | null),
  ) => void;
  recordSession: (session: WorkoutSession) => void;
  exportBackup: () => BackupFile;
  restoreBackup: (serialized: string) => void;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function isSnapshot(value: unknown): value is AppSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppSnapshot>;
  return (
    candidate.schemaVersion === 1 &&
    !!candidate.settings &&
    Array.isArray(candidate.sessions) &&
    Array.isArray(candidate.weightEntries) &&
    Array.isArray(candidate.savedPlans)
  );
}

function calculateBmi(weightKg: number, heightCm: number) {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(emptySnapshot);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (isSnapshot(parsed)) setSnapshot(parsed);
          else setStorageError('Data lokal tidak valid. Data baru akan disimpan setelah Anda melanjutkan.');
        }
      })
      .catch(() => {
        if (mounted) setStorageError('Penyimpanan lokal tidak dapat dibaca.');
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => {
      setStorageError('Perubahan belum tersimpan. Periksa ruang penyimpanan perangkat.');
    });
  }, [ready, snapshot]);

  const saveProfile = useCallback((profile: UserProfile) => {
    setSnapshot((current) => {
      const hasWeight = current.weightEntries.some((entry) => entry.weightKg === profile.weightKg);
      const weightEntries = hasWeight
        ? current.weightEntries
        : [
            ...current.weightEntries,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              date: new Date().toISOString(),
              weightKg: profile.weightKg,
              bmi: calculateBmi(profile.weightKg, profile.heightCm),
            },
          ];
      return { ...current, profile, weightEntries };
    });
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setSnapshot((current) => {
      if (!current.profile) return current;
      const profile = { ...current.profile, ...patch };
      const weightChanged = patch.weightKg !== undefined && patch.weightKg !== current.profile.weightKg;
      const weightEntries = weightChanged
        ? [
            ...current.weightEntries,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              date: new Date().toISOString(),
              weightKg: profile.weightKg,
              bmi: calculateBmi(profile.weightKg, profile.heightCm),
            },
          ]
        : current.weightEntries;
      return { ...current, profile, weightEntries };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSnapshot((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }));
  }, []);

  const saveWeightEntry = useCallback((weightKg: number) => {
    setSnapshot((current) => {
      if (!current.profile) return current;
      const entry: WeightEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: new Date().toISOString(),
        weightKg,
        bmi: calculateBmi(weightKg, current.profile.heightCm),
      };
      return {
        ...current,
        profile: { ...current.profile, weightKg },
        weightEntries: [...current.weightEntries, entry],
      };
    });
  }, []);

  const setCurrentPlan = useCallback((plan: WorkoutPlan | null) => {
    setSnapshot((current) => ({ ...current, currentPlan: plan }));
  }, []);

  const savePlanTemplate = useCallback((plan: WorkoutPlan) => {
    setSnapshot((current) => ({
      ...current,
      savedPlans: [
        plan,
        ...current.savedPlans.filter((saved) => saved.id !== plan.id),
      ],
    }));
  }, []);

  const removePlanTemplate = useCallback((id: string) => {
    setSnapshot((current) => ({
      ...current,
      savedPlans: current.savedPlans.filter((plan) => plan.id !== id),
    }));
  }, []);

  const setActiveWorkout = useCallback(
    (
      next:
        | ActiveWorkout
        | null
        | ((current: ActiveWorkout | null) => ActiveWorkout | null),
    ) => {
      setSnapshot((current) => ({
        ...current,
        activeWorkout:
          typeof next === 'function' ? next(current.activeWorkout) : next,
      }));
    },
    [],
  );

  const recordSession = useCallback((session: WorkoutSession) => {
    setSnapshot((current) => ({
      ...current,
      sessions: [session, ...current.sessions],
      activeWorkout: null,
    }));
  }, []);

  // NFR §7: export murni lokal (AsyncStorage + JSON), tanpa INTERNET / analytics.
  // Sudah mencakup reminderEnabled/reminderTime + silentMode + bmiStandard
  // karena seluruh snapshot.settings diserialisasi apa adanya.
  const exportBackup = useCallback(
    (): BackupFile => ({
      app: 'bodyweight-workout',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: snapshot,
    }),
    [snapshot],
  );

  const restoreBackup = useCallback((serialized: string) => {
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object') throw new Error('File cadangan tidak valid.');
    const backup = parsed as Partial<BackupFile>;
    if (backup.app !== 'bodyweight-workout' || backup.schemaVersion !== 1 || !isSnapshot(backup.data)) {
      throw new Error('Versi atau format file cadangan tidak didukung.');
    }
    // Penjagaan tambahan selaras validateBackup(): pastikan 12 keys settings ada.
    const settingsRecord = backup.data.settings as Partial<Record<keyof AppSettings, unknown>>;
    const missing = REQUIRED_SETTINGS_KEYS.filter((key) => !(key in (settingsRecord as object)));
    if (missing.length > 0) {
      throw new Error(`Pengaturan cadangan belum lengkap: ${missing.join(', ')}.`);
    }
    setSnapshot(backup.data);
  }, []);

  const resetAllData = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setSnapshot(emptySnapshot);
    setStorageError(null);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      snapshot,
      ready,
      storageError,
      saveProfile,
      updateProfile,
      updateSettings,
      saveWeightEntry,
      setCurrentPlan,
      savePlanTemplate,
      removePlanTemplate,
      setActiveWorkout,
      recordSession,
      exportBackup,
      restoreBackup,
      resetAllData,
    }),
    [
      snapshot,
      ready,
      storageError,
      saveProfile,
      updateProfile,
      updateSettings,
      saveWeightEntry,
      setCurrentPlan,
      savePlanTemplate,
      removePlanTemplate,
      setActiveWorkout,
      recordSession,
      exportBackup,
      restoreBackup,
      resetAllData,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}