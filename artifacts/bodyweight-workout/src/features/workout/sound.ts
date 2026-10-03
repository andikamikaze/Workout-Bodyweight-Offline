/**
 * Agen 5 — Workout beep (FR-06).
 *
 * Prioritas backend audio (guarded agar Expo Go tidak crash bila modul tak ada):
 *   1. expo-av (sesuai spek FR-06, bila masih terpasang — terakhir SDK 54)
 *   2. expo-audio (penerus resmi expo-av di SDK 55+, dipakai di SDK 57)
 *   3. Web Audio oscillator (web / fallback darurat)
 *
 * Semua API no-op bila sound dimatikan atau modul audio tidak tersedia.
 * Panggil playBeepTick(false) untuk detik 3 & 2, playBeepTick(true) untuk detik 1,
 * dan playPhaseChime() saat ganti fase (mulai set / selesai rest / ganti latihan).
 */

// ---------------------------------------------------------------------------
// Guarded module loading — JANGAN pakai static import untuk expo-av/expo-audio
// agar bundle Expo Go tidak crash saat modul belum terpasang.
// ---------------------------------------------------------------------------

type ExpoAvAudioModule = {
  Sound?: any;
  setAudioModeAsync?: (mode: any) => Promise<void>;
};

type ExpoAudioModule = {
  createAudioPlayer?: (source: any) => any;
  setAudioModeAsync?: (mode: any) => Promise<void>;
};

function loadExpoAv(): ExpoAvAudioModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expoAv = require('expo-av') as { Audio?: ExpoAvAudioModule };
    if (expoAv?.Audio?.Sound) return expoAv.Audio;
  } catch {
    // Modul belum terpasang (mis. SDK 57 tanpa expo-av) — lanjut ke fallback.
  }
  return null;
}

function loadExpoAudio(): ExpoAudioModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expoAudio = require('expo-audio') as ExpoAudioModule;
    if (expoAudio?.createAudioPlayer) return expoAudio;
  } catch {
    // Belum terpasang — lanjut ke Web Audio / no-op.
  }
  return null;
}

// ---------------------------------------------------------------------------
// WAV beep sintetis (sine 880Hz tick / 1320Hz final / chime dua nada).
// Dibuat sebagai data URI agar tidak perlu file aset biner baru.
// ---------------------------------------------------------------------------

function sineWavBase64(frequencyHz: number, durationMs: number, volume = 0.5): string {
  const sampleRate = 22050;
  const samples = Math.max(1, Math.floor((sampleRate * durationMs) / 1000));
  const dataSize = samples * 2; // 16-bit mono
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples; i += 1) {
    // Envelope attack/decay sederhana agar tidak "klik".
    const t = i / sampleRate;
    const envelope = Math.min(1, (i / sampleRate / 0.01));
    const fadeOut = Math.min(1, ((samples - i) / sampleRate / 0.03));
    const s = Math.sin(2 * Math.PI * frequencyHz * t) * volume * Math.min(envelope, fadeOut);
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 32767, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // btoa tersedia di Hermes/RN modern; fallback manual bila tidak ada.
  try {
    return typeof btoa === 'function'
      ? btoa(binary)
      : (globalThis as any)?.Buffer
        ? (globalThis as any).Buffer.from(binary, 'binary').toString('base64')
        : '';
  } catch {
    return '';
  }
}

function beepUri(kind: 'tick' | 'final' | 'phase'): string {
  const base64 =
    kind === 'final'
      ? sineWavBase64(1318, 320, 0.55)
      : kind === 'phase'
        ? sineWavBase64(988, 260, 0.5)
        : sineWavBase64(880, 140, 0.45);
  if (!base64) return '';
  return `data:audio/wav;base64,${base64}`;
}

// ---------------------------------------------------------------------------
// Pemutar Web Audio (fallback web / darurat native tanpa modul expo).
// ---------------------------------------------------------------------------

let webAudioContext: any = null;

function getWebAudioContext(): any | null {
  try {
    const Global = globalThis as any;
    const Ctor = Global?.AudioContext ?? Global?.webkitAudioContext;
    if (!Ctor) return null;
    if (!webAudioContext) webAudioContext = new Ctor();
    if (webAudioContext?.state === 'suspended') {
      void webAudioContext.resume?.().catch(() => {});
    }
    return webAudioContext;
  } catch {
    return null;
  }
}

function playWebTone(frequencyHz: number, durationMs: number, whenMs = 0): void {
  const ctx = getWebAudioContext();
  if (!ctx) return;
  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const startAt = ctx.currentTime + whenMs / 1000;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequencyHz;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.5, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + durationMs / 1000 + 0.05);
  } catch {
    // Abaikan — beep bersifat opsional.
  }
}

// ---------------------------------------------------------------------------
// Pemutar native guarded.
// ---------------------------------------------------------------------------

async function playViaExpoAv(uri: string): Promise<boolean> {
  const Audio = loadExpoAv();
  if (!Audio?.Sound || !uri) return false;
  try {
    await Audio.setAudioModeAsync?.({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, volume: 1.0 },
    );
    try {
      await sound?.playAsync?.();
    } catch {
      // Sudah auto-play via createAsync; abaikan.
    }
    // Bebaskan memori setelah bunyi selesai.
    setTimeout(() => {
      void sound?.unloadAsync?.().catch(() => {});
    }, 900);
    return true;
  } catch {
    return false;
  }
}

async function playViaExpoAudio(uri: string): Promise<boolean> {
  const mod = loadExpoAudio();
  if (!mod?.createAudioPlayer || !uri) return false;
  try {
    await mod.setAudioModeAsync?.({ playsInSilentMode: true } as any).catch(() => {});
    const player = mod.createAudioPlayer(uri);
    try {
      player?.play?.();
    } catch {
      // Abaikan.
    }
    setTimeout(() => {
      try {
        player?.release?.();
      } catch {
        // Abaikan.
      }
    }, 1200);
    return true;
  } catch {
    return false;
  }
}

async function playNativeBeep(kind: 'tick' | 'final' | 'phase'): Promise<boolean> {
  const uri = beepUri(kind);
  if (!uri) return false;
  // Sesuai spek: coba expo-av dulu, lalu expo-audio.
  if (await playViaExpoAv(uri)) return true;
  if (await playViaExpoAudio(uri)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// API publik. Semua menerima flag soundEnabled dari settings.
// ---------------------------------------------------------------------------

/** Bunyi detik countdown. `isLast=true` untuk detik terakhir ("1" → nada lebih tinggi). */
export async function playBeepTick(isLast: boolean, soundEnabled = true): Promise<void> {
  if (!soundEnabled) return;
  try {
    const kind = isLast ? 'final' : 'tick';
    const played = await playNativeBeep(kind);
    if (!played) {
      playWebTone(isLast ? 1318 : 880, isLast ? 300 : 130);
    }
  } catch {
    // Beep tidak boleh mengganggu workout.
  }
}

/** Bunyi ganti fase (selesai rest / mulai set baru / ganti latihan). Dua nada naik. */
export async function playPhaseChime(soundEnabled = true): Promise<void> {
  if (!soundEnabled) return;
  try {
    const played = await playNativeBeep('phase');
    if (!played) {
      playWebTone(988, 220);
      playWebTone(1318, 260, 160);
    }
  } catch {
    // Abaikan.
  }
}

/** Cek apakah ada backend audio native yang tersedia (expo-av atau expo-audio). */
export function isNativeAudioAvailable(): boolean {
  return loadExpoAv() !== null || loadExpoAudio() !== null;
}
