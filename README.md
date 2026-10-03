# Gerak — Offline Bodyweight Workout Planner

**Gerak** is a structured bodyweight workout planner for Android. It tells you exactly what to train today — with no equipment, no account, no internet, and a small app size. Every feature works fully offline: workout plans are generated on-device from a rule-based planner, all illustrations are vector graphics, and all data stays in the app's private storage.

## Features

- **Onboarding & profile** — nickname, gender, birth date, height, weight, goal (lose weight / build muscle / general fitness), experience level, and a short PAR-Q readiness questionnaire with a mandatory medical disclaimer.
- **Focus Area via interactive SVG muscle map** — 14 tappable muscle groups across front/back body views (male and female), select up to 3 areas, with Full Body / Upper Body / Lower Body / Core presets and a text list alternative for accessibility.
- **Three difficulty levels** — Beginner, Intermediate, Advanced, each with its own set/rep targets, rest periods, and exercise selection rules.
- **Rule-based plan generator** — no AI, no server. Every session has three phases: Warm-up (5–8 min), Training (15–40 min), Cooldown (4–6 min). Session length is 15 / 30 / 45 / 60 minutes, and the generator adapts set counts to fit.
- **Progression through variation, not load** — each exercise declares easier/harder variants (e.g. Knee Push-up → Push-up → Diamond Push-up), plus volume, tempo, unilateral work, and rest levers, so difficulty can rise without adding weight.
- **Balanced Full Body plans** — the generator enforces push / pull / legs / core coverage so no region is skipped.
- **Exercise library (100 exercises)** — warm-up, training, and cooldown movements with primary/secondary muscles, minimum level, required props, rep-based or time-based targets, impact level (for quiet mode), step-by-step instructions, common mistakes, and MET values for calorie estimates.
- **Workout player** — animated 2-frame SVG illustrations (crossfade driven in code), set counter, target reps or countdown, automatic rest timer with +15s and Skip, Pause/Resume, previous/next exercise, real-time progress bar, left/right unilateral sub-sets, audio cues with vibration, keep-awake, and an ongoing foreground-service notification with Pause/Skip actions.
- **Crash-safe sessions** — state is saved on every set change, so an accidentally closed app can be resumed mid-workout.
- **Quiet mode** — filters out high-impact (jumping) exercises for apartments and small rooms.
- **Progress & history** — weekly sessions, daily streak, total minutes, total reps, history calendar with per-day session detail, weight and BMI charts, 30-day muscle distribution with neglected-area warnings, personal records, weekly target, and local reminders.
- **BMI analysis** — BMI value, category gauge, ideal weight range for your height, actionable recommendations, per-update BMI snapshots, and a permanent "BMI is not a diagnostic tool" disclaimer. Default standard is Kemenkes RI, switchable to WHO Asia-Pacific.
- **Local backup & restore** — export/import a versioned JSON snapshot through the system file picker, plus a two-step full data reset.
- **Bilingual UI** — Indonesian (default) and English, light/dark/system themes, metric or imperial units.

## Tech Stack

- **Language / framework** — TypeScript, React Native 0.86, React 19, Expo ~57, expo-router (file-based routing)
- **UI** — React Native core components, `react-native-svg` for all vector artwork, `react-native-reanimated` + `react-native-worklets` + `react-native-gesture-handler`
- **Local data** — `@react-native-async-storage/async-storage` with a versioned snapshot store (`src/store/AppContext.tsx`); typed domain model in `src/types.ts`; seed data in `src/data/`
- **Device services** — `expo-notifications` (reminders + foreground workout notification), `expo-audio` (countdown and phase cues), `expo-haptics`, `expo-keep-awake`, `expo-file-system` + `expo-sharing` (backup/restore), `expo-document-picker`
- **Build & release** — EAS Build / EAS Submit (`eas.json`), app version `1.0.0`, package `com.wildanaesteam.aplikasiworkoutfitnessplan`
- **Workspace tooling** — pnpm 10.33.2 workspace, TypeScript project references, Prettier
- **Backend / accounts / analytics** — none by design. No INTERNET permission, no third-party SDKs, no telemetry

## Getting Started

### Prerequisites

- Node.js LTS (20+ recommended)
- pnpm `10.33.2` (the repo enforces pnpm — `npm install` is blocked by a `preinstall` guard)
- Android Studio with an emulator, or a physical Android device (Android 8.0 / API 26 or newer)
- [Expo Go](https://expo.dev/go) on the device, or an Expo development build
- EAS CLI, only if you want to produce an APK/AAB: `npm i -g eas-cli` and `eas login`

### Installation

```bash
git clone https://github.com/username/project.git
cd project
pnpm install
```

The app itself lives in `artifacts/bodyweight-workout`, so run all app commands from there:

```bash
cd artifacts/bodyweight-workout
pnpm exec expo start
```

### Configuration

There is **no `.env` file and no environment configuration** — the app has no backend and makes no network requests. `.env.example` does not exist by design.

Runtime configuration lives in `app.json` and in-app Settings:

| Setting                                        | Where                                   | Notes                                                                                        |
| ---------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| App name, slug, version, icon, splash          | `artifacts/bodyweight-workout/app.json` | Display name is `Gerak`                                                                      |
| Android package and permissions                | `artifacts/bodyweight-workout/app.json` | `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `VIBRATE`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED` |
| EAS project ID                                 | `app.json` / `eas.json`                 | `1173ccf3-524b-4c5a-bc7b-fa8cf7f960d3`                                                       |
| Language, units, theme, BMI standard           | In-app Settings screen                  | Stored locally                                                                               |
| Allowed props (chair, wall, towel), quiet mode | In-app Settings screen                  | Feeds the plan generator                                                                     |

> The `dev` script in `artifacts/bodyweight-workout/package.json` is wired for a Replit-hosted environment (it depends on `REPLIT_*` environment variables). For local development use `pnpm exec expo start` directly.

### Running the Project

```bash
# from artifacts/bodyweight-workout
pnpm exec expo start          # start Metro, then press a / i / w in the terminal
```

> `pnpm run build` / `pnpm run serve` are **Replit-only**, not for local or EAS Cloud builds.
> `pnpm run build` runs `node scripts/build.js`, which builds a static Expo Go
> deployment and requires one of `REPLIT_INTERNAL_APP_DOMAIN`,
> `REPLIT_DEV_DOMAIN`, or `EXPO_PUBLIC_DOMAIN` (see `getDeploymentDomain()`).
> Running it locally without those vars fails with:
>
> ```text
> ERROR: No deployment domain found. Set REPLIT_INTERNAL_APP_DOMAIN, REPLIT_DEV_DOMAIN, or EXPO_PUBLIC_DOMAIN
> ```
>
> For local dev use `pnpm exec expo start`. For installable binaries use EAS Build below.

### Usage

1. **Onboarding** — enter body data, pick a goal and experience level, allow the home props you own (chair, wall, towel), then complete the readiness questionnaire.
2. **Home** — see today's recommendation, streak, BMI, and weekly goal; tap **Start Now** or **Create New Workout**.
3. **Focus Area** — tap muscle groups on the body map (or use a preset chip) to pick up to 3 areas.
4. **Session Setup** — choose level and duration, optionally enable quiet mode, review the props that will be used.
5. **Preview** — review warm-up / training / cooldown. Swap any exercise for an alternative, an easier or harder variation, reorder or remove items.
6. **Player** — follow the animated illustration, log reps or ride the countdown, rest on the automatic timer, and preview the next exercise.
7. **Summary** — duration, sets completed, total reps, estimated calories, muscles trained, effort feedback, and any new personal records.
8. **Progress** — review streaks, charts, calendar history, and muscle balance over the last 30 days.

Typical loop:

```text
Install → Onboarding → Home → Focus Area → Session Setup → Preview
        → Player ⇄ Rest → Summary → Progress
```

## Project Structure

```text
project/
├── artifacts/
│   ├── bodyweight-workout/          # Expo app "Gerak"
│   │   ├── app/                     # expo-router screens
│   │   │   ├── (tabs)/              # Home, Library, Plan, Progress, Settings
│   │   │   ├── onboarding.tsx  focus.tsx  plan-preview.tsx
│   │   │   ├── workout.tsx    bmi.tsx  profile.tsx
│   │   │   └── exercise/            # exercise detail route
│   │   ├── features/                # feature UI
│   │   │   ├── focus/               # body map, anatomy map renderers
│   │   │   ├── library/             # exercise list + SVG illustrations
│   │   │   ├── profile/  progress/  workout/
│   │   ├── src/
│   │   │   ├── data/                # exercises, muscles, anatomy maps (seed data)
│   │   │   ├── features/planner/    # generatePlan.ts — rule-based generator
│   │   │   ├── features/workout/    # notifications.ts, sound.ts
│   │   │   ├── store/AppContext.tsx # app state + persistence + backup
│   │   │   ├── i18n.ts  types.ts  utils.ts
│   │   ├── components/  constants/  hooks/
│   │   ├── assets/images/           # app icon, notification icon
│   │   ├── scripts/build.js  server/serve.js
│   │   └── app.json  eas.json  package.json  tsconfig.json
│   ├── api-server/                  # unrelated workspace artifacts
│   └── mockup-sandbox/
├── lib/                             # shared libs: api-client-react, api-spec, api-zod, db
├── scripts/                         # workspace tooling
├── Muscle male/female front/back.svg # anatomy source artwork (extracted into src/data/anatomyMaps.ts)
├── PRD_Workout_Bodyweight_v1.1.md
├── package.json  pnpm-workspace.yaml  tsconfig.json
└── README.md
```

## Development

```bash
# from the repository root — typecheck every workspace package
pnpm run typecheck          # typecheck:libs + per-package typecheck
pnpm run typecheck:libs     # tsc --build across lib/* and artifacts/*
pnpm run build              # typecheck, then build all packages that define a build script

# from artifacts/bodyweight-workout — typecheck the app only
pnpm run typecheck          # tsc -p tsconfig.json --noEmit

# formatting
pnpm exec prettier --write .
```

Guidelines:

- Keep every screen working offline. Do not add network calls, analytics, or ad SDKs.
- Illustrations and body maps are vector only; animate by crossfading frames in code rather than using SMIL/CSS animation.
- New user-facing strings belong in `src/i18n.ts` with both Indonesian and English variants.
- Domain changes to `src/types.ts` must include a snapshot version bump so old backups are rejected or migrated.
- Performance targets: cold start under 2s on a 3 GB device, 60 fps transitions, muscle map interactive within 300 ms, APK under 20 MB.

## Testing

There is no automated test runner configured in this workspace yet. The current gate is type checking:

```bash
pnpm run typecheck
```

Until a test runner is added, verify changes manually:

- Session flows: plan generation, exercise swap, rest timer, pause/resume, mid-session resume.
- Background behavior: lock the screen or background the app during a session and confirm the timer and notification stay accurate.
- Device matrix: Xiaomi, Oppo, Vivo, and Samsung devices with aggressive battery optimization — verify the app is excluded from doze restrictions.
- Data safety: export a backup, reset all data, restore, and confirm the session history and BMI logs return.
- Accessibility: TalkBack labels on the muscle map, minimum 56 dp player controls, no color-only meaning.

## Deployment

Android builds go through EAS Cloud (config in `artifacts/bodyweight-workout/eas.json`).
Always run EAS commands from `artifacts/bodyweight-workout` (not the repo root),
because the full `app.json` / `eas.json` live there. Do **not** use `pnpm run build`
for EAS — that script is Replit-only (see above).

Profiles:

| Profile      | Output | Use for                        |
| ------------ | ------ | ------------------------------ |
| `preview`    | APK    | Internal QA, direct install    |
| `production` | AAB    | Play Store upload via `submit` |

`preview` sets `android.buildType: apk` so the artifact can be installed directly.
`production` uses `autoIncrement` and `appVersionSource: remote`.

### Build APK internal (recommended for QA)

Prerequisites: Node.js 20+, pnpm `10.33.2`, `npm i -g eas-cli` (`>= 24.10.0`),
`eas login` as owner of EAS project `1173ccf3-524b-4c5a-bc7b-fa8cf7f960d3`.

```bash
cd artifacts/bodyweight-workout
eas whoami
eas project:info
pnpm exec expo doctor
pnpm run typecheck
eas build --platform android --profile preview
```

Open the `expo.dev` build link from the CLI, download the APK, and install it on
Android 8.0 (API 26) or newer.

### Build AAB for Play Store

```bash
cd artifacts/bodyweight-workout
eas build --platform android --profile production   # AAB for Play Store
eas submit --platform android --profile production
```

Release checklist:

- Bump `version` in `app.json` (production builds auto-increment the build number).
- Confirm only the intended permissions are declared in `app.json`.
- Verify R8/resource shrinking is on and measure the artifact size against the 20 MB budget.
- Run the manual QA matrix above on 8–10 devices before submitting.

## Out of Scope (MVP)

Gym equipment (dumbbells, barbells, machines, resistance bands, pull-up bars), social features and leaderboards, cloud sync, user accounts, nutrition plans, exercise videos, wearable integration, camera-based motion detection, and monetization. The app is free, with no ads and no in-app purchases.

## Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-change`
3. Make your changes, keeping the offline and bodyweight-only constraints intact
4. Run `pnpm run typecheck` (and the manual checks above for UI changes)
5. Open a pull request describing what changed and how you verified it

## License

This project is licensed under the MIT License.
