// FR-09 + §7 — Kamus i18n terpusat untuk layar Pengaturan.
// Backward-compatible: signature tx(lang, id, en) dipertahankan agar
// seluruh pemanggil lama (planner, player, progress, library, focus, dst)
// tidak rusak. File settings.tsx dianjurkan memakai STRINGS/txk.

export type AppLanguage = 'id' | 'en';

export const STRINGS = {
  language: { id: 'Bahasa', en: 'Language' },
  units: { id: 'Satuan', en: 'Units' },
  theme: { id: 'Tema', en: 'Theme' },
  bmiStandard: { id: 'Standar BMI', en: 'BMI standard' },
  sound: { id: 'Isyarat suara', en: 'Sound cues' },
  vibration: { id: 'Getaran', en: 'Vibration' },
  keepScreen: { id: 'Layar tetap menyala', en: 'Keep screen awake' },
  silentMode: { id: 'Mode hening', en: 'Quiet mode' },
  furniture: { id: 'Perabot yang boleh digunakan', en: 'Allowed furniture' },
  reminder: { id: 'Pengingat latihan', en: 'Workout reminder' },
  reminderTime: { id: 'Waktu pilihan', en: 'Preferred time' },
  weeklyGoal: { id: 'Target latihan', en: 'Workout goal' },
  backup: { id: 'Cadangkan data', en: 'Back up data' },
  restore: { id: 'Pulihkan data', en: 'Restore data' },
  reset: { id: 'Hapus semua data', en: 'Delete all data' },
  settings: { id: 'Pengaturan', en: 'Settings' },
} as const;

export type StringKey = keyof typeof STRINGS;

export function tx(language: 'id' | 'en', indonesian: string, english: string) {
  return language === 'en' ? english : indonesian;
}

/** Ambil string terpusat via kunci — alternatif rapi selain tx(lang, id, en). */
export function txk(language: 'id' | 'en', key: StringKey): string {
  return language === 'en' ? STRINGS[key].en : STRINGS[key].id;
}
