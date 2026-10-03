// FR-09 + §7 (Agen 7 — Pengaturan + Data + NFR).
// NFR: offline-first — tidak butuh izin INTERNET, tanpa import analytics/ads.
// Ukuran APK: R8 fullMode + split ABI + SVGO disarankan (lihat app.json —
// blok android milik Agen5, file ini tidak mengubahnya).
// Notifikasi: POST_NOTIFICATIONS dikoordinasikan dengan Agen5; scheduling di
// bawah bersifat guarded — bila modul expo-notifications tak ada, tampilkan
// catatan "Notifikasi belum tersedia di build ini".
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  Platform,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  ActionButton,
  AppScreen,
  PageHeader,
  Pill,
  SectionHeading,
  Surface,
} from "@/components/WorkoutUI";
import { useColors } from "@/hooks/useColors";
import { STRINGS, tx, txk } from "@/src/i18n";
import { useApp } from "@/src/store/AppContext";
import { AppSettings, BMIStandard, Furniture, ThemeMode } from "@/src/types";

type Language = AppSettings["language"];

// FR-09: opsi ChoiceRow terpusat — label memakai STRINGS agar konsisten id/en.
const LANGUAGE_OPTIONS: Array<{ value: Language; id: string; en: string }> = [
  { value: "id", id: "Indonesia", en: "Indonesian" },
  { value: "en", id: "Inggris", en: "English" },
];

const UNITS_OPTIONS: Array<{
  value: AppSettings["units"];
  id: string;
  en: string;
}> = [
  { value: "metric", id: "Metrik", en: "Metric" },
  { value: "imperial", id: "Imperial", en: "Imperial" },
];

const THEME_OPTIONS: Array<{ value: ThemeMode; id: string; en: string }> = [
  { value: "system", id: "Sistem", en: "System" },
  { value: "light", id: "Terang", en: "Light" },
  { value: "dark", id: "Gelap", en: "Dark" },
];

const BMI_OPTIONS: Array<{ value: BMIStandard; id: string; en: string }> = [
  { value: "kemenkes", id: "Kemenkes", en: "Indonesia" },
  { value: "asia-pacific", id: "Asia-Pasifik", en: "Asia-Pacific" },
];

const WEEKLY_GOAL_MIN = 1;
const WEEKLY_GOAL_MAX = 7;
const REMINDER_TIMES = ["07:00", "12:30", "18:00", "20:00"] as const;

type ReminderScheduleState = "idle" | "scheduled" | "unavailable";

/** Muat expo-notifications secara guarded tanpa static import.
 *  Memakai pemanggilan dinamis agar bundler tetap lolos bila modul belum
 *  dipasang (koordinasi izin POST_NOTIFICATIONS milik Agen5). */
function loadNotificationsModule(): any | null {
  try {
    const modName = ["expo", "notifications"].join("-");
    const g = globalThis as unknown as { require?: (name: string) => any };
    const dynRequire =
      g.require ??
      (typeof require !== "undefined"
        ? (require as unknown as (name: string) => any)
        : null);
    if (!dynRequire) return null;
    const mod = dynRequire(modName);
    if (!mod || typeof mod.scheduleNotificationAsync !== "function")
      return null;
    return mod;
  } catch {
    return null;
  }
}

function estimateBytes(text: string): number {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    return text.length;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateBackup(raw: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "JSON tidak dapat dibaca. Periksa tanda kurung dan koma pada file.";
  }

  if (!isRecord(parsed))
    return "Format cadangan tidak valid: isi file harus berupa objek JSON.";
  if (parsed.app !== "bodyweight-workout") {
    return "File ini bukan cadangan dari aplikasi Gerak.";
  }
  if (parsed.schemaVersion !== 1) {
    return `Versi skema tidak didukung. Aplikasi ini menerima schemaVersion 1, bukan ${String(parsed.schemaVersion)}.`;
  }

  const data = parsed.data;
  if (!isRecord(data))
    return "Data cadangan tidak memiliki bagian data yang valid.";
  if (data.schemaVersion !== 1) {
    return `Versi data tidak didukung. Diperlukan schemaVersion 1, ditemukan ${String(data.schemaVersion)}.`;
  }
  if (!isRecord(data.settings))
    return "Data pengaturan pada cadangan tidak valid.";
  if (data.profile !== null && !isRecord(data.profile)) {
    return "Data profil pada cadangan tidak valid.";
  }
  if (!Array.isArray(data.sessions))
    return "Daftar riwayat latihan pada cadangan tidak valid.";
  if (!Array.isArray(data.weightEntries))
    return "Daftar berat dan BMI pada cadangan tidak valid.";
  if (!Array.isArray(data.savedPlans))
    return "Daftar template rencana pada cadangan tidak valid.";

  const settings = data.settings;
  const requiredSettings: Array<keyof AppSettings> = [
    "soundEnabled",
    "vibrationEnabled",
    "keepScreenAwake",
    "allowedFurniture",
    "silentMode",
    "bmiStandard",
    "units",
    "language",
    "theme",
    "weeklyGoal",
    "reminderEnabled",
    "reminderTime",
  ];
  const missing = requiredSettings.filter((key) => !(key in settings));
  if (missing.length > 0) {
    return `Pengaturan cadangan belum lengkap: ${missing.join(", ")}.`;
  }
  return null;
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
      <View style={styles.settingText}>
        <Text style={[styles.settingTitle, { color: colors.foreground }]}>
          {title}
        </Text>
        {description ? (
          <Text
            style={[
              styles.settingDescription,
              { color: colors.mutedForeground },
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const colors = useColors();
  return (
    <SettingRow title={title} description={description}>
      <Switch
        accessibilityLabel={title}
        accessibilityRole="switch"
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={value ? colors.primaryForeground : colors.card}
      />
    </SettingRow>
  );
}

function ChoiceRow<T extends string>({
  title,
  description,
  language,
  value,
  options,
  onChange,
}: {
  title: string;
  description?: string;
  language: Language;
  value: T;
  options: Array<{ value: T; id: string; en: string }>;
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.choiceRow, { borderBottomColor: colors.border }]}>
      <View style={styles.settingText}>
        <Text style={[styles.settingTitle, { color: colors.foreground }]}>
          {title}
        </Text>
        {description ? (
          <Text
            style={[
              styles.settingDescription,
              { color: colors.mutedForeground },
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>
      <View style={styles.optionWrap}>
        {options.map((option) => (
          <Pill
            key={option.value}
            label={tx(language, option.id, option.en)}
            selected={value === option.value}
            onPress={() => onChange(option.value)}
            style={styles.optionPill}
          />
        ))}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    snapshot,
    ready,
    storageError,
    updateSettings,
    exportBackup,
    restoreBackup,
    resetAllData,
  } = useApp();
  const settings = snapshot.settings;
  const language: Language = settings.language;
  const modalOverlayColor = `${colors.foreground}88`;
  const [backupMode, setBackupMode] = useState<"export" | "import" | null>(
    null,
  );
  const [backupText, setBackupText] = useState("");
  const [backupError, setBackupError] = useState("");
  const [backupSuccess, setBackupSuccess] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [reminderStatus, setReminderStatus] =
    useState<ReminderScheduleState>("idle");

  // FR-09: jadwalkan pengingat harian lokal bila modul tersedia; guarded.
  useEffect(() => {
    let cancelled = false;
    async function syncReminder() {
      if (!settings.reminderEnabled) {
        if (!cancelled) setReminderStatus("idle");
        return;
      }
      try {
        const Notifications = loadNotificationsModule();
        if (!Notifications) {
          if (!cancelled) setReminderStatus("unavailable");
          return;
        }
        try {
          await Notifications.requestPermissionsAsync?.();
        } catch {
          // Izin opsional — lanjutkan penjadwalan lokal.
        }
        try {
          await Notifications.cancelAllScheduledNotificationsAsync?.();
        } catch {
          // Abaikan kegagalan pembatalan.
        }
        const [hourRaw, minuteRaw] = settings.reminderTime.split(":");
        const hour = Number(hourRaw);
        const minute = Number(minuteRaw);
        if (Number.isNaN(hour) || Number.isNaN(minute)) {
          if (!cancelled) setReminderStatus("unavailable");
          return;
        }
        // Kompatibel SDK lama ({hour,minute,repeats}) & baru ({type:'daily',...}).
        const triggerLegacy = { hour, minute, repeats: true };
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: tx(language, "Waktunya bergerak", "Time to move"),
              body: tx(
                language,
                "Sesi bodyweight singkat menunggumu. Buka Gerak untuk mulai.",
                "A short bodyweight session is waiting. Open Gerak to start.",
              ),
            },
            trigger: triggerLegacy,
          });
        } catch {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: tx(language, "Waktunya bergerak", "Time to move"),
              body: tx(
                language,
                "Sesi bodyweight singkat menunggumu. Buka Gerak untuk mulai.",
                "A short bodyweight session is waiting. Open Gerak to start.",
              ),
            },
            trigger: { type: "daily", hour, minute } as unknown as never,
          });
        }
        if (!cancelled) setReminderStatus("scheduled");
      } catch {
        if (!cancelled) setReminderStatus("unavailable");
      }
    }
    syncReminder();
    return () => {
      cancelled = true;
    };
  }, [settings.reminderEnabled, settings.reminderTime, language]);

  const backupSizeLabel = useMemo(() => {
    if (!backupText) return "";
    return formatBytes(estimateBytes(backupText));
  }, [backupText]);

  const backupExportedAtLabel = useMemo(() => {
    if (!backupText) return "";
    try {
      const parsed = JSON.parse(backupText) as { exportedAt?: string };
      if (parsed?.exportedAt) {
        const date = new Date(parsed.exportedAt);
        if (!Number.isNaN(date.getTime())) {
          return date.toLocaleString(language === "en" ? "en-US" : "id-ID", {
            dateStyle: "medium",
            timeStyle: "short",
          });
        }
      }
    } catch {
      // Abaikan — label dikosongkan bila JSON belum valid.
    }
    return "";
  }, [backupText, language]);

  const furnitureOptions = useMemo(
    () =>
      [
        { value: "chair" as const, id: "Kursi kokoh", en: "Sturdy chair" },
        { value: "wall" as const, id: "Dinding", en: "Wall" },
        { value: "towel" as const, id: "Handuk", en: "Towel" },
      ] satisfies Array<{ value: Furniture; id: string; en: string }>,
    [],
  );

  const toggleFurniture = (item: Furniture) => {
    const next = settings.allowedFurniture.includes(item)
      ? settings.allowedFurniture.filter((current) => current !== item)
      : [...settings.allowedFurniture, item];
    updateSettings({ allowedFurniture: next });
  };

  const openExport = () => {
    setBackupError("");
    setBackupSuccess("");
    setBackupBusy(false);
    setBackupText(JSON.stringify(exportBackup(), null, 2));
    setBackupMode("export");
  };

  const openImport = () => {
    setBackupError("");
    setBackupSuccess("");
    setBackupBusy(false);
    setBackupText("");
    setBackupMode("import");
  };

  const shareBackup = async () => {
    if (!backupText) return;
    setBackupBusy(true);
    setBackupError("");
    setBackupSuccess("");
    try {
      if (Platform.OS === "web") {
        const result = await Share.share({
          title: tx(language, "Cadangan data Gerak", "Gerak data backup"),
          message: backupText,
        });
        if (result.action === Share.sharedAction) {
          setBackupSuccess(
            tx(
              language,
              "Cadangan dibagikan. Simpan di tempat yang aman.",
              "Backup shared. Save it somewhere safe.",
            ),
          );
        }
      } else {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const file = new File(Paths.cache, `gerak-backup-${timestamp}.json`);
        file.write(backupText);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: "application/json",
            dialogTitle: tx(
              language,
              "Simpan atau bagikan cadangan Gerak",
              "Save or share Gerak backup",
            ),
          });
          setBackupSuccess(
            tx(
              language,
              "File JSON siap dibagikan. Simpan di tempat yang aman.",
              "JSON file is ready to share. Save it somewhere safe.",
            ),
          );
        } else {
          const result = await Share.share({
            title: tx(language, "Cadangan data Gerak", "Gerak data backup"),
            message: backupText,
          });
          if (result.action === Share.sharedAction) {
            setBackupSuccess(
              tx(
                language,
                "Cadangan dibagikan. Simpan di tempat yang aman.",
                "Backup shared. Save it somewhere safe.",
              ),
            );
          }
        }
      }
    } catch {
      setBackupError(
        tx(
          language,
          "File JSON tidak dapat dibagikan. Coba lagi atau salin isi JSON di bawah.",
          "Could not share the JSON file. Try again or copy the JSON contents below.",
        ),
      );
    } finally {
      setBackupBusy(false);
    }
  };

  const chooseBackupFile = async () => {
    setBackupBusy(true);
    setBackupError("");
    setBackupSuccess("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "text/plain"],
        copyToCacheDirectory: true,
        multiple: false,
        base64: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const selectedFile = new File(result.assets[0].uri);
      const contents = await selectedFile.text();
      if (!contents.trim()) {
        setBackupError(
          tx(language, "File JSON kosong.", "The selected JSON file is empty."),
        );
        return;
      }
      setBackupText(contents);
      setBackupSuccess(
        tx(
          language,
          `File “${result.assets[0].name}” siap divalidasi.`,
          `“${result.assets[0].name}” is ready to validate.`,
        ),
      );
    } catch {
      setBackupError(
        tx(
          language,
          "File tidak dapat dibaca. Pilih file JSON cadangan yang valid.",
          "Could not read the file. Select a valid JSON backup.",
        ),
      );
    } finally {
      setBackupBusy(false);
    }
  };

  const importBackup = () => {
    setBackupError("");
    setBackupSuccess("");
    const validationError = validateBackup(backupText);
    if (validationError) {
      setBackupError(validationError);
      return;
    }
    Alert.alert(
      tx(language, "Ganti data perangkat?", "Replace this device’s data?"),
      tx(
        language,
        "Pemulihan akan mengganti profil, pengaturan, rencana, catatan berat badan, dan riwayat latihan saat ini. Tindakan ini tidak dapat dibatalkan.",
        "Restoring will replace the current profile, settings, plans, weight entries, and workout history. This cannot be undone.",
      ),
      [
        { text: tx(language, "Batal", "Cancel"), style: "cancel" },
        {
          text: tx(language, "Pulihkan & ganti", "Restore & replace"),
          style: "destructive",
          onPress: () => {
            try {
              restoreBackup(backupText);
              setBackupSuccess(
                tx(
                  language,
                  "Cadangan berhasil dipulihkan ke perangkat ini.",
                  "Backup restored on this device.",
                ),
              );
              setBackupText("");
            } catch (error) {
              setBackupError(
                error instanceof Error
                  ? error.message
                  : tx(
                      language,
                      "Cadangan tidak dapat dipulihkan.",
                      "The backup could not be restored.",
                    ),
              );
            }
          },
        },
      ],
    );
  };

  const confirmReset = async () => {
    setResetBusy(true);
    setResetError("");
    try {
      await resetAllData();
      setResetStep(0);
      router.replace("/onboarding");
    } catch {
      setResetError(
        tx(
          language,
          "Data tidak berhasil dihapus. Coba lagi.",
          "Data could not be erased. Please try again.",
        ),
      );
    } finally {
      setResetBusy(false);
    }
  };

  if (!ready) {
    return (
      <AppScreen style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
          {tx(language, "Memuat pengaturan…", "Loading settings…")}
        </Text>
      </AppScreen>
    );
  }

  return (
    <>
      <AppScreen contentStyle={styles.page}>
        <PageHeader
          eyebrow={tx(language, "Ruang latihanmu", "Your training space")}
          title={tx(language, "Pengaturan", "Settings")}
          subtitle={tx(
            language,
            "Atur pengalaman latihan dan kendali data pribadi.",
            "Personalize workouts and control your local data.",
          )}
        />

        {storageError ? (
          <Surface
            style={[styles.alertSurface, { borderColor: colors.destructive }]}
          >
            <Feather name="alert-circle" size={18} color={colors.destructive} />
            <Text style={[styles.alertText, { color: colors.destructive }]}>
              {storageError}
            </Text>
          </Surface>
        ) : null}

        <Surface style={styles.profileSurface}>
          <View
            style={[styles.profileMark, { backgroundColor: colors.accent }]}
          >
            <Text
              style={[
                styles.profileInitial,
                { color: colors.accentForeground },
              ]}
            >
              {snapshot.profile?.name?.trim()?.[0]?.toUpperCase() ?? "G"}
            </Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={[styles.profileName, { color: colors.foreground }]}>
              {snapshot.profile?.name ||
                tx(language, "Profil belum dibuat", "Profile not set up")}
            </Text>
            <Text
              style={[
                styles.settingDescription,
                { color: colors.mutedForeground },
              ]}
            >
              {snapshot.profile
                ? `${snapshot.profile.heightCm} cm · ${snapshot.profile.weightKg} kg`
                : tx(
                    language,
                    "Lengkapi profil agar rencana latihan lebih sesuai.",
                    "Complete your profile for a tailored plan.",
                  )}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx(language, "Ubah profil", "Edit profile")}
            onPress={() => router.push("/profile")}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
            testID="settings-profile"
          >
            <Feather name="chevron-right" size={21} color={colors.primary} />
          </Pressable>
        </Surface>

        <View style={styles.section}>
          <SectionHeading
            title={tx(language, "Preferensi aplikasi", "App preferences")}
          />
          <Surface style={styles.groupSurface}>
            <ChoiceRow
              title={txk(language, "units")}
              language={language}
              value={settings.units}
              options={UNITS_OPTIONS}
              onChange={(units) => updateSettings({ units })}
            />
            <ChoiceRow
              title={txk(language, "language")}
              language={language}
              value={language}
              options={LANGUAGE_OPTIONS}
              onChange={(nextLanguage) =>
                updateSettings({ language: nextLanguage })
              }
            />
            <ChoiceRow<ThemeMode>
              title={txk(language, "theme")}
              language={language}
              value={settings.theme}
              options={THEME_OPTIONS}
              onChange={(theme) => updateSettings({ theme })}
            />
            <ChoiceRow<BMIStandard>
              title={txk(language, "bmiStandard")}
              description={tx(
                language,
                "Digunakan di analisis BMI.",
                "Used in your BMI analysis.",
              )}
              language={language}
              value={settings.bmiStandard}
              options={BMI_OPTIONS}
              onChange={(bmiStandard) => updateSettings({ bmiStandard })}
            />
          </Surface>
        </View>

        <View style={styles.section}>
          <SectionHeading
            title={tx(language, "Saat berlatih", "During workouts")}
          />
          <Surface style={styles.groupSurface}>
            <ToggleRow
              title={txk(language, "sound")}
              description={tx(
                language,
                "Nada di web, getar haptik di HP untuk hitung mundur dan ganti set.",
                "Web tone, haptic pulse on device for countdown and set changes.",
              )}
              value={settings.soundEnabled}
              onChange={(soundEnabled) => updateSettings({ soundEnabled })}
            />
            <ToggleRow
              title={txk(language, "vibration")}
              description={tx(
                language,
                "Umpan balik haptik saat berpindah set.",
                "Haptic feedback between sets.",
              )}
              value={settings.vibrationEnabled}
              onChange={(vibrationEnabled) =>
                updateSettings({ vibrationEnabled })
              }
            />
            <ToggleRow
              title={txk(language, "keepScreen")}
              description={tx(
                language,
                "Aktif hanya saat sesi berjalan di depan; sesi otomatis dijeda ketika aplikasi masuk latar belakang.",
                "Active only while a workout is in the foreground; sessions pause when the app goes to the background.",
              )}
              value={settings.keepScreenAwake}
              onChange={(keepScreenAwake) =>
                updateSettings({ keepScreenAwake })
              }
            />
            <ToggleRow
              title={txk(language, "silentMode")}
              description={tx(
                language,
                "Generator menghindari gerakan berdampak tinggi.",
                "The plan generator avoids high-impact moves.",
              )}
              value={settings.silentMode}
              onChange={(silentMode) => updateSettings({ silentMode })}
            />
            <View style={styles.furnitureBlock}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>
                {tx(
                  language,
                  "Perabot yang boleh digunakan",
                  "Allowed furniture",
                )}
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.mutedForeground },
                ]}
              >
                {tx(
                  language,
                  "Pilih hanya benda yang stabil dan aman.",
                  "Select only stable, safe items.",
                )}
              </Text>
              <View style={styles.optionWrap}>
                {furnitureOptions.map((option) => {
                  const selected = settings.allowedFurniture.includes(
                    option.value,
                  );
                  return (
                    <Pill
                      key={option.value}
                      label={tx(language, option.id, option.en)}
                      selected={selected}
                      onPress={() => toggleFurniture(option.value)}
                      style={styles.optionPill}
                    />
                  );
                })}
              </View>
            </View>
          </Surface>
        </View>

        <View style={styles.section}>
          <SectionHeading
            title={tx(language, "Kebiasaan mingguan", "Weekly routine")}
          />
          <Surface style={styles.groupSurface}>
            <SettingRow
              title={tx(language, "Target latihan", "Workout goal")}
              description={tx(language, "Sesi per minggu", "Sessions per week")}
            >
              <View style={styles.stepper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tx(
                    language,
                    "Kurangi target",
                    "Decrease goal",
                  )}
                  accessibilityState={{ disabled: settings.weeklyGoal <= 1 }}
                  disabled={settings.weeklyGoal <= 1}
                  onPress={() =>
                    updateSettings({
                      weeklyGoal: Math.max(1, settings.weeklyGoal - 1),
                    })
                  }
                  style={({ pressed }) => [
                    styles.stepperButton,
                    {
                      backgroundColor: colors.secondary,
                      opacity: pressed ? 0.72 : 1,
                    },
                  ]}
                  testID="weekly-goal-minus"
                >
                  <Feather name="minus" size={16} color={colors.foreground} />
                </Pressable>
                <Text
                  style={[styles.stepperValue, { color: colors.foreground }]}
                >
                  {settings.weeklyGoal}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tx(
                    language,
                    "Tambah target",
                    "Increase goal",
                  )}
                  accessibilityState={{ disabled: settings.weeklyGoal >= 7 }}
                  disabled={settings.weeklyGoal >= 7}
                  onPress={() =>
                    updateSettings({
                      weeklyGoal: Math.min(7, settings.weeklyGoal + 1),
                    })
                  }
                  style={({ pressed }) => [
                    styles.stepperButton,
                    {
                      backgroundColor: colors.secondary,
                      opacity: pressed ? 0.72 : 1,
                    },
                  ]}
                  testID="weekly-goal-plus"
                >
                  <Feather name="plus" size={16} color={colors.foreground} />
                </Pressable>
              </View>
            </SettingRow>
            <ToggleRow
              title={tx(language, "Pengingat latihan", "Workout reminder")}
              description={tx(
                language,
                "Pilihan waktu disimpan secara lokal.",
                "Your preferred time is saved locally.",
              )}
              value={settings.reminderEnabled}
              onChange={(reminderEnabled) =>
                updateSettings({ reminderEnabled })
              }
            />
            {settings.reminderEnabled ? (
              <View
                style={[
                  styles.reminderBlock,
                  { borderTopColor: colors.border },
                ]}
              >
                <Text
                  style={[styles.settingTitle, { color: colors.foreground }]}
                >
                  {tx(language, "Waktu pilihan", "Preferred time")}
                </Text>
                <View style={styles.optionWrap}>
                  {["07:00", "12:30", "18:00", "20:00"].map((time) => (
                    <Pill
                      key={time}
                      label={time}
                      selected={settings.reminderTime === time}
                      onPress={() => updateSettings({ reminderTime: time })}
                      style={styles.optionPill}
                    />
                  ))}
                </View>
                <Text
                  style={[
                    styles.reminderNote,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {reminderStatus === "scheduled"
                    ? tx(
                        language,
                        "Pengingat harian aktif dan terjadwal secara lokal.",
                        "Daily reminder is scheduled locally.",
                      )
                    : reminderStatus === "unavailable"
                      ? tx(
                          language,
                          "Modul notifikasi tidak tersedia di build ini; waktu tetap tersimpan sebagai preferensi.",
                          "Notification module unavailable in this build; time is saved as a preference.",
                        )
                      : tx(
                          language,
                          "Menjadwalkan pengingat lokal…",
                          "Scheduling local reminder…",
                        )}
                </Text>
              </View>
            ) : null}
          </Surface>
        </View>

        <View style={styles.section}>
          <SectionHeading
            title={tx(language, "Data & privasi", "Data & privacy")}
          />
          <Surface style={styles.groupSurface}>
            <Text style={[styles.dataIntro, { color: colors.mutedForeground }]}>
              {tx(
                language,
                "Semua data latihan disimpan di perangkat ini. Cadangan JSON tidak dienkripsi; simpan dengan hati-hati.",
                "Workout data stays on this device. JSON backups are not encrypted; store them carefully.",
              )}
            </Text>
            <ActionButton
              title={tx(language, "Ekspor cadangan JSON", "Export JSON backup")}
              variant="secondary"
              onPress={openExport}
              testID="backup-export"
              style={styles.dataButton}
            />
            <ActionButton
              title={tx(language, "Pulihkan dari JSON", "Restore from JSON")}
              variant="outline"
              onPress={openImport}
              testID="backup-import"
              style={styles.dataButton}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setResetError("");
                setResetStep(1);
              }}
              style={({ pressed }) => [
                styles.resetLink,
                pressed && styles.pressed,
              ]}
              testID="reset-start"
            >
              <Feather name="trash-2" size={16} color={colors.destructive} />
              <Text style={[styles.resetText, { color: colors.destructive }]}>
                {tx(language, "Hapus semua data", "Delete all data")}
              </Text>
            </Pressable>
          </Surface>
        </View>
      </AppScreen>

      <Modal
        visible={backupMode !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setBackupMode(null)}
      >
        <View
          style={[styles.modalOverlay, { backgroundColor: modalOverlayColor }]}
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeading}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {backupMode === "export"
                    ? tx(language, "Cadangkan data", "Back up data")
                    : tx(language, "Pulihkan data", "Restore data")}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {backupMode === "export"
                    ? tx(
                        language,
                        "JSON versi skema 1, hanya di perangkatmu.",
                        "Schema version 1 JSON, kept on your device.",
                      )
                    : tx(
                        language,
                        "Pilih file JSON dari perangkat atau tempel isinya di bawah.",
                        "Choose a JSON file from your device or paste its contents below.",
                      )}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx(language, "Tutup", "Close")}
                onPress={() => setBackupMode(null)}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
              >
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            {backupMode === "export" ? (
              <View style={styles.backupWarning}>
                <Feather name="shield" size={17} color={colors.primary} />
                <Text
                  style={[
                    styles.backupWarningText,
                    { color: colors.foreground },
                  ]}
                >
                  {tx(
                    language,
                    "Cadangan tidak dienkripsi. File dapat berisi profil, riwayat latihan, serta catatan berat badan.",
                    "Backups are not encrypted. The file may contain your profile, workout history, and weight entries.",
                  )}
                </Text>
              </View>
            ) : null}

            {backupMode === "import" ? (
              <ActionButton
                title={
                  backupBusy
                    ? tx(language, "Membaca file…", "Reading file…")
                    : tx(language, "Pilih file JSON", "Choose JSON file")
                }
                variant="secondary"
                onPress={chooseBackupFile}
                loading={backupBusy}
                testID="backup-pick-file"
              />
            ) : null}

            <TextInput
              accessibilityLabel={
                backupMode === "export"
                  ? tx(
                      language,
                      "Pratinjau file cadangan JSON",
                      "JSON backup preview",
                    )
                  : tx(
                      language,
                      "Isi file cadangan JSON",
                      "JSON backup contents",
                    )
              }
              value={backupText}
              onChangeText={setBackupText}
              editable={backupMode === "import"}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
              placeholder={tx(
                language,
                "Tempel JSON cadangan versi 1 di sini…",
                "Paste a version 1 JSON backup here…",
              )}
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.jsonInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              testID="backup-json-input"
            />

            {backupError ? (
              <Text
                accessibilityRole="alert"
                style={[styles.feedbackText, { color: colors.destructive }]}
              >
                {backupError}
              </Text>
            ) : null}
            {backupSuccess ? (
              <Text
                accessibilityRole="alert"
                style={[styles.feedbackText, { color: colors.primary }]}
              >
                {backupSuccess}
              </Text>
            ) : null}

            {backupMode === "export" ? (
              <ActionButton
                title={
                  backupBusy
                    ? tx(language, "Menyiapkan file…", "Preparing file…")
                    : tx(language, "Bagikan file JSON", "Share JSON file")
                }
                onPress={shareBackup}
                disabled={!backupText || backupBusy}
                loading={backupBusy}
                testID="backup-share"
              />
            ) : (
              <ActionButton
                title={
                  backupBusy
                    ? tx(language, "Memproses…", "Processing…")
                    : tx(language, "Validasi & pulihkan", "Validate & restore")
                }
                onPress={importBackup}
                disabled={!backupText.trim() || backupBusy}
                loading={backupBusy}
                testID="backup-restore"
              />
            )}
            <Text
              style={[styles.schemaFootnote, { color: colors.mutedForeground }]}
            >
              {tx(
                language,
                "Versi yang didukung: schemaVersion 1.",
                "Supported version: schemaVersion 1.",
              )}
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={resetStep > 0}
        transparent
        animationType="fade"
        onRequestClose={() => setResetStep(0)}
      >
        <View
          style={[styles.modalOverlay, { backgroundColor: modalOverlayColor }]}
        >
          <View
            style={[
              styles.resetModal,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[styles.resetIcon, { backgroundColor: colors.secondary }]}
            >
              <Feather
                name="alert-triangle"
                size={22}
                color={colors.destructive}
              />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {resetStep === 1
                ? tx(language, "Hapus semua data?", "Delete all data?")
                : tx(language, "Konfirmasi terakhir", "Final confirmation")}
            </Text>
            <Text
              style={[styles.modalSubtitle, { color: colors.mutedForeground }]}
            >
              {resetStep === 1
                ? tx(
                    language,
                    "Profil, rencana, berat badan, dan seluruh riwayat sesi akan dihapus dari perangkat.",
                    "Your profile, plans, weight entries, and all workout history will be erased from this device.",
                  )
                : tx(
                    language,
                    "Tindakan ini tidak dapat dibatalkan. Pastikan cadangan JSON sudah disimpan jika ingin mempertahankan data.",
                    "This cannot be undone. Save a JSON backup first if you want to keep your data.",
                  )}
            </Text>
            {resetError ? (
              <Text
                accessibilityRole="alert"
                style={[styles.feedbackText, { color: colors.destructive }]}
              >
                {resetError}
              </Text>
            ) : null}
            {resetStep === 1 ? (
              <View style={styles.modalActions}>
                <ActionButton
                  title={tx(language, "Batal", "Cancel")}
                  variant="outline"
                  onPress={() => setResetStep(0)}
                  style={styles.flexButton}
                  testID="reset-cancel"
                />
                <ActionButton
                  title={tx(language, "Lanjutkan", "Continue")}
                  variant="danger"
                  onPress={() => setResetStep(2)}
                  style={styles.flexButton}
                  testID="reset-confirm-first"
                />
              </View>
            ) : (
              <View style={styles.modalActions}>
                <ActionButton
                  title={tx(language, "Kembali", "Go back")}
                  variant="outline"
                  onPress={() => setResetStep(1)}
                  disabled={resetBusy}
                  style={styles.flexButton}
                />
                <ActionButton
                  title={
                    resetBusy
                      ? tx(language, "Menghapus…", "Deleting…")
                      : tx(language, "Hapus permanen", "Erase permanently")
                  }
                  variant="danger"
                  onPress={confirmReset}
                  disabled={resetBusy}
                  style={styles.flexButton}
                  testID="reset-confirm-final"
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 24 },
  loadingScreen: { alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontWeight: "500" },
  section: { gap: 10 },
  groupSurface: { paddingHorizontal: 16, paddingVertical: 3, gap: 0 },
  profileSurface: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 15,
  },
  profileMark: {
    height: 46,
    width: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitial: { fontSize: 19, fontWeight: "800" },
  profileCopy: { flex: 1, gap: 3 },
  profileName: { fontSize: 16, lineHeight: 21, fontWeight: "700" },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  settingRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingText: { flex: 1, gap: 4 },
  settingTitle: { fontSize: 14, lineHeight: 19, fontWeight: "600" },
  settingDescription: { fontSize: 12, lineHeight: 17 },
  choiceRow: {
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionPill: { minHeight: 36, paddingHorizontal: 13 },
  furnitureBlock: { paddingVertical: 14, gap: 8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepperButton: {
    height: 38,
    width: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    minWidth: 18,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
  },
  reminderBlock: {
    gap: 10,
    paddingTop: 12,
    paddingBottom: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reminderNote: { fontSize: 12, lineHeight: 17 },
  dataIntro: { fontSize: 13, lineHeight: 19, paddingTop: 12 },
  dataButton: { minHeight: 48, borderRadius: 16 },
  resetLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    alignSelf: "center",
    paddingVertical: 15,
    paddingHorizontal: 12,
  },
  resetText: { fontSize: 14, fontWeight: "700" },
  alertSurface: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    padding: 12,
  },
  alertText: { flex: 1, fontSize: 12, lineHeight: 18 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", padding: 14 },
  modalCard: {
    borderWidth: 1,
    borderRadius: 26,
    padding: 19,
    gap: 14,
    maxHeight: "91%",
  },
  modalHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  modalHeading: { flex: 1, gap: 5 },
  modalTitle: { fontSize: 21, lineHeight: 27, fontWeight: "700" },
  modalSubtitle: { fontSize: 13, lineHeight: 19 },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  backupWarning: {
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
    padding: 11,
    borderRadius: 14,
  },
  backupWarningText: { flex: 1, fontSize: 12, lineHeight: 18 },
  jsonInput: {
    minHeight: 150,
    maxHeight: 270,
    borderWidth: 1,
    borderRadius: 15,
    padding: 12,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "monospace",
  },
  feedbackText: { fontSize: 13, lineHeight: 19, fontWeight: "600" },
  schemaFootnote: { textAlign: "center", fontSize: 11, lineHeight: 16 },
  resetModal: {
    borderWidth: 1,
    borderRadius: 25,
    padding: 21,
    gap: 13,
    marginBottom: 10,
  },
  resetIcon: {
    height: 44,
    width: 44,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  flexButton: {
    flex: 1,
    paddingHorizontal: 11,
    minHeight: 49,
    borderRadius: 15,
  },
  pressed: { opacity: 0.75 },
});
