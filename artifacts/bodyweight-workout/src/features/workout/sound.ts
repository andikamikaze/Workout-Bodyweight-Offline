/**
 * Workout beep (FR-06) — tanpa native audio module agar APK tetap kecil.
 *
 * Sebelumnya memakai expo-av / expo-audio (ExoPlayer/Media3, MBs per ABI)
 * hanya untuk beep countdown sintetik. Sekarang:
 *   - Web: Web Audio oscillator (nada 880/1318/988Hz seperti dulu).
 *   - Native: haptik via expo-haptics (modul kecil, sudah dipakai player)
 *     + Vibration fallback bila haptics tak tersedia.
 *
 * Semua API no-op bila sound dimatikan. Panggil playBeepTick(false) untuk
 * detik 3 & 2, playBeepTick(true) untuk detik 1, dan playPhaseChime() saat
 * ganti fase (mulai set / selesai rest / ganti latihan).
 */

import { Vibration } from "react-native";

type HapticsModule = {
  impactAsync?: (style?: unknown) => Promise<void>;
  notificationAsync?: (type?: unknown) => Promise<void>;
  ImpactFeedbackStyle?: { Medium?: unknown; Heavy?: unknown };
  NotificationFeedbackType?: { Success?: unknown };
};

function loadHaptics(): HapticsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-haptics") as HapticsModule;
    if (mod?.impactAsync) return mod;
  } catch {
    // expo-haptics belum terpasang — pakai Vibration murni.
  }
  return null;
}

async function playNativeHaptic(
  kind: "tick" | "final" | "phase",
): Promise<boolean> {
  const Haptics = loadHaptics();
  try {
    if (Haptics?.notificationAsync && kind !== "tick") {
      const type = Haptics.NotificationFeedbackType?.Success ?? undefined;
      await Haptics.notificationAsync(type);
      return true;
    }
    if (Haptics?.impactAsync) {
      const style =
        kind === "final" || kind === "phase"
          ? Haptics.ImpactFeedbackStyle?.Heavy
          : Haptics.ImpactFeedbackStyle?.Medium;
      await Haptics.impactAsync(style);
      return true;
    }
  } catch {
    // Lanjut ke Vibration fallback.
  }
  try {
    Vibration.vibrate(kind === "tick" ? 40 : [0, 80, 40, 120]);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Pemutar Web Audio (web / fallback darurat).
// ---------------------------------------------------------------------------

let webAudioContext: any = null;

function getWebAudioContext(): any | null {
  try {
    const Global = globalThis as any;
    const Ctor = Global?.AudioContext ?? Global?.webkitAudioContext;
    if (!Ctor) return null;
    if (!webAudioContext) webAudioContext = new Ctor();
    if (webAudioContext?.state === "suspended") {
      void webAudioContext.resume?.().catch(() => {});
    }
    return webAudioContext;
  } catch {
    return null;
  }
}

function playWebTone(
  frequencyHz: number,
  durationMs: number,
  whenMs = 0,
): boolean {
  const ctx = getWebAudioContext();
  if (!ctx) return false;
  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const startAt = ctx.currentTime + whenMs / 1000;
    oscillator.type = "sine";
    oscillator.frequency.value = frequencyHz;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.5, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + durationMs / 1000 + 0.05);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// API publik. Semua menerima flag soundEnabled dari settings.
// ---------------------------------------------------------------------------

/** Bunyi detik countdown. `isLast=true` untuk detik terakhir (haptik lebih kuat). */
export async function playBeepTick(
  isLast: boolean,
  soundEnabled = true,
): Promise<void> {
  if (!soundEnabled) return;
  try {
    // Web: nada beneran. Native (tanpa AudioContext): haptik.
    if (!playWebTone(isLast ? 1318 : 880, isLast ? 300 : 130)) {
      await playNativeHaptic(isLast ? "final" : "tick");
    }
  } catch {
    // Beep tidak boleh mengganggu workout.
  }
}

/** Tanda ganti fase (selesai rest / mulai set baru / ganti latihan). */
export async function playPhaseChime(soundEnabled = true): Promise<void> {
  if (!soundEnabled) return;
  try {
    const first = playWebTone(988, 220);
    playWebTone(1318, 260, 160);
    if (!first) {
      await playNativeHaptic("phase");
    }
  } catch {
    // Abaikan.
  }
}

/** Tidak ada backend audio native — beep native memakai haptik. */
export function isNativeAudioAvailable(): boolean {
  return false;
}
