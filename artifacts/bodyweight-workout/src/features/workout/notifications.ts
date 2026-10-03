/**
 * Agen 5 — Notifikasi workout + foreground-service style (FR-06).
 *
 * Semua import expo-notifications bersifat guarded (require dalam try/catch)
 * agar Expo Go / web tidak crash bila modul belum terpasang.
 *
 * Strategi:
 * - Minta izin POST_NOTIFICATIONS (Android 13+) via expo-notifications.
 * - Channel Android "workout-live" (importance MAX) untuk notif persisten.
 * - Kategori "workout-controls" dengan aksi Pause & Lewati (skip).
 * - Update tiap detik memakai identifier stabil "workout-live" sehingga
 *   notif lama ditimpa, bukan menumpuk. Timer tetap berbasis endsAt
 *   (exerciseEndsAt/restEndsAt) sehingga akurat saat prebuild/dev-client.
 * - Di Expo Go background tetap auto-pause (fallback) — lihat WorkoutPlayerScreen.
 */

export interface WorkoutNotificationState {
  exerciseName: string;
  setLabel: string; // mis. "Set 2/4"
  restLabel: string | null; // mis. "Istirahat 25s" atau null
  totalLabel: string; // mis. "12:34"
  paused: boolean;
}

export type WorkoutNotificationAction = 'pause' | 'resume' | 'skip';

const LIVE_NOTIFICATION_ID = 'workout-live';
const CATEGORY_ID = 'workout-controls';

// ---------------------------------------------------------------------------
// Guarded loading.
// ---------------------------------------------------------------------------

type NotificationsModule = any;

function loadNotifications(): NotificationsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications');
    if (mod?.scheduleNotificationAsync) return mod as NotificationsModule;
  } catch {
    // Modul belum terpasang — semua API di bawah jadi no-op.
  }
  return null;
}

function loadConstants(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-constants');
  } catch {
    return null;
  }
}

/** True bila berjalan di Expo Go (milik expo), tempat background akurat TIDAK diklaim. */
export function isExpoGo(): boolean {
  try {
    const Constants = loadConstants();
    const ownership = Constants?.default?.appOwnership ?? Constants?.appOwnership;
    if (ownership === 'expo') return true;
    if (typeof ownership === 'string' && ownership.length > 0) return false;
  } catch {
    // Lanjut ke heuristik.
  }
  try {
    const Constants = loadConstants();
    const executionEnvironment =
      Constants?.default?.executionEnvironment ?? Constants?.executionEnvironment;
    if (executionEnvironment === 'storeClient') return true;
  } catch {
    // Abaikan.
  }
  return false;
}

export function areNotificationsAvailable(): boolean {
  return loadNotifications() !== null;
}

// ---------------------------------------------------------------------------
// Setup: handler + channel Android + kategori aksi. Idempoten.
// ---------------------------------------------------------------------------

let setupDone = false;
let permissionGranted = false;

export function isWorkoutNotificationGranted(): boolean {
  return permissionGranted;
}

export async function ensureWorkoutNotifications(): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) return false;
  if (setupDone && permissionGranted) return true;
  try {
    // Handler: tampilkan notif walau app foreground + izinkan aksi.
    try {
      await Notifications.setNotificationHandler?.({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
    } catch {
      // Versi lama memakai shouldShowAlert — coba fallback.
      try {
        await Notifications.setNotificationHandler?.({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
          }),
        });
      } catch {
        // Abaikan.
      }
    }

    // Kanal Android khusus workout-live.
    try {
      await Notifications.setNotificationChannelAsync?.('workout-live', {
        name: 'Workout berjalan',
        importance: Notifications.AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 120, 80, 120],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC,
        bypassDnd: false,
      });
    } catch {
      // iOS / versi lama — abaikan.
    }

    // Aksi Pause & Lewati.
    try {
      await Notifications.setNotificationCategoryAsync?.(CATEGORY_ID, [
        {
          identifier: 'pause',
          buttonTitle: 'Pause',
          options: { opensAppToForeground: true },
        },
        {
          identifier: 'skip',
          buttonTitle: 'Lewati',
          options: { opensAppToForeground: true },
        },
      ]);
    } catch {
      // Kategori tidak didukung — notif teks tetap tampil.
    }

    // Minta izin.
    try {
      const current = await Notifications.getPermissionsAsync?.();
      if (current?.granted) {
        permissionGranted = true;
      } else {
        const requested = await Notifications.requestPermissionsAsync?.();
        permissionGranted = !!requested?.granted;
      }
    } catch {
      permissionGranted = false;
    }

    setupDone = true;
    return permissionGranted;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Format & update tiap detik.
// ---------------------------------------------------------------------------

export function formatWorkoutNotification(state: WorkoutNotificationState): {
  title: string;
  body: string;
} {
  const restPart = state.restLabel ? ` • ${state.restLabel}` : '';
  const pausedPrefix = state.paused ? '⏸ ' : '';
  return {
    title: `${pausedPrefix}Workout berjalan: ${state.exerciseName}`,
    body: `${state.setLabel}${restPart} • Total ${state.totalLabel}`,
  };
}

export async function updateWorkoutNotification(
  state: WorkoutNotificationState,
): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications || !permissionGranted) return false;
  const { title, body } = formatWorkoutNotification(state);
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: LIVE_NOTIFICATION_ID,
      content: {
        title,
        body,
        sticky: false,
        priority: Notifications.AndroidNotificationPriority?.HIGH,
        categoryIdentifier: CATEGORY_ID,
        data: { kind: 'workout-live', paused: state.paused },
      },
      trigger: null, // tampil segera, menimpa identifier yang sama
    });
    return true;
  } catch {
    return false;
  }
}

export async function clearWorkoutNotification(): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.dismissNotificationAsync?.(LIVE_NOTIFICATION_ID).catch(() => {});
  } catch {
    // Abaikan.
  }
  try {
    // Fallback: batalkan yang terjadwal dengan id sama.
    await Notifications.cancelScheduledNotificationAsync?.(LIVE_NOTIFICATION_ID).catch(() => {});
  } catch {
    // Abaikan.
  }
}

// ---------------------------------------------------------------------------
// Listener aksi Pause / Lewati dari notifikasi.
// ---------------------------------------------------------------------------

export function subscribeWorkoutNotificationActions(
  handlers: {
    onPause?: () => void;
    onResume?: () => void;
    onSkip?: () => void;
    onTap?: () => void;
  },
): () => void {
  const Notifications = loadNotifications();
  if (!Notifications?.addNotificationResponseReceivedListener) {
    return () => {};
  }
  let subscription: any = null;
  try {
    subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      try {
        const actionId: string | undefined = response?.actionIdentifier;
        const data = response?.notification?.request?.content?.data as
          | { kind?: string }
          | undefined;
        if (data && data.kind !== 'workout-live' && actionId !== 'pause' && actionId !== 'skip') {
          return;
        }
        if (actionId === 'pause') {
          handlers.onPause?.();
        } else if (actionId === 'skip') {
          handlers.onSkip?.();
        } else if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER || !actionId) {
          // Tap badan notif: bila sedang pause → resume, else no-op (app dibuka via deep link OS).
          handlers.onTap?.();
        } else {
          // Aksi "resume" (beberapa OEM menampilkan label sama) — perlakukan sebagai pause-toggle.
          handlers.onResume?.();
        }
      } catch {
        // Abaikan.
      }
    });
  } catch {
    return () => {};
  }
  return () => {
    try {
      subscription?.remove?.();
    } catch {
      // Abaikan.
    }
  };
}
