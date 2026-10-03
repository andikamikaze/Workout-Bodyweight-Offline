import { Exercise, Experience, Furniture, Impact, Measurement, MuscleId, WorkoutPhase } from '@/src/types';

type Pose =
  | 'push'
  | 'squat'
  | 'lunge'
  | 'plank'
  | 'floor'
  | 'row'
  | 'shoulder'
  | 'jump'
  | 'stretch'
  | 'standing'
  | 'bridge'
  | 'bird'
  | 'curl'
  | 'calf'
  | 'crawl'
  | 'breathing';

interface Seed {
  id: string;
  name: string;
  en: string;
  muscles: MuscleId[];
  secondary?: MuscleId[];
  level?: Experience;
  furniture?: Furniture[];
  measurement?: Measurement;
  reps?: number;
  seconds?: number;
  impact?: Impact;
  category?: Exercise['category'];
  unilateral?: boolean;
  rest?: number;
  met?: number;
  easier?: string;
  harder?: string;
  pose: Pose;
  tips?: string[];
  instructions?: string[];
}

const instructionsFor = (seed: Seed, phase: WorkoutPhase): string[] => {
  if (seed.instructions) return seed.instructions;
  if (phase === 'warm-up') {
    return [
      `Mulai perlahan dengan posisi nyaman untuk ${seed.name.toLowerCase()}.`,
      'Gerakkan bagian tubuh sasaran dengan rentang yang terkontrol.',
      'Bernapas teratur dan tingkatkan gerak sedikit demi sedikit.',
    ];
  }
  if (phase === 'cooldown') {
    return [
      `Ambil posisi yang aman untuk meregangkan ${seed.name.toLowerCase()}.`,
      'Masuk ke regangan perlahan sampai terasa ringan, bukan nyeri.',
      'Tahan sambil bernapas tenang, lalu lepaskan tanpa memantul.',
    ];
  }
  const instructions: Record<Exercise['category'], string[]> = {
    push: [
      'Atur tangan selebar bahu dan kunci badan dalam garis stabil.',
      'Tekuk siku perlahan sambil menjaga bahu tetap jauh dari telinga.',
      'Dorong lantai hingga kembali ke posisi awal tanpa mengunci siku.',
    ],
    pull: [
      'Pastikan titik pegangan kokoh dan tubuh siap sebelum bergerak.',
      'Tarik siku ke belakang sambil merapatkan tulang belikat.',
      'Kembali perlahan; jangan mengayun atau menahan napas.',
    ],
    legs: [
      'Berdiri mantap dengan lutut mengikuti arah jari kaki.',
      'Turunkan pinggul perlahan sambil menjaga dada tetap terbuka.',
      'Tekan lantai untuk kembali, lalu ulangi dengan kendali.',
    ],
    core: [
      'Mulai dari posisi stabil dan aktifkan otot perut dengan lembut.',
      'Jaga panggul tetap netral saat bergerak atau menahan posisi.',
      'Bernapas teratur dan hentikan gerakan bila punggung terasa nyeri.',
    ],
    mobility: [
      'Mulai dengan rentang gerak yang terasa nyaman.',
      'Gerakkan tubuh perlahan tanpa memaksa sendi.',
      'Jaga napas tetap mengalir dan kembali ke posisi awal.',
    ],
    conditioning: [
      'Mulai dengan pendaratan ringan dan lutut sedikit menekuk.',
      'Lakukan gerakan dengan ritme stabil, tanpa memaksakan kecepatan.',
      'Berhenti sejenak bila napas terlalu berat atau keseimbangan hilang.',
    ],
  };
  return instructions[seed.category ?? 'mobility'];
};

function exercise(seed: Seed, phase: WorkoutPhase): Exercise {
  const levelMin = seed.level ?? 'beginner';
  const measurement = seed.measurement ?? (phase === 'training' ? 'reps' : 'seconds');
  const defaultSets = phase === 'training' ? (levelMin === 'beginner' ? 2 : levelMin === 'intermediate' ? 3 : 4) : 1;
  const instructions = instructionsFor(seed, phase);
  const safety = seed.furniture?.includes('chair')
    ? ['Uji kursi agar tidak bergeser sebelum mulai.', 'Gunakan sandaran yang stabil; hentikan bila terasa goyah.']
    : seed.furniture?.includes('towel')
      ? ['Periksa handuk dan titik jangkar sebelum menarik.', 'Hentikan segera jika pegangan mulai bergeser.']
      : ['Jaga teknik dan napas tetap terkendali.', 'Berhenti jika terasa nyeri, pusing, atau tidak nyaman.'];
  const tips = seed.tips ?? safety;
  return {
    id: seed.id,
    name: seed.name,
    englishName: seed.en,
    phase,
    primaryMuscles: seed.muscles,
    secondaryMuscles: seed.secondary ?? [],
    levelMin,
    furniture: seed.furniture ?? [],
    measurement,
    impact: seed.impact ?? 'low',
    category: seed.category ?? (phase === 'training' ? 'mobility' : 'mobility'),
    unilateral: seed.unilateral,
    defaultSets,
    ...(measurement === 'reps'
      ? { targetReps: seed.reps ?? (levelMin === 'beginner' ? 10 : levelMin === 'intermediate' ? 12 : 15) }
      : { targetSeconds: seed.seconds ?? (phase === 'training' ? (levelMin === 'beginner' ? 25 : levelMin === 'intermediate' ? 35 : 50) : 35) }),
    restSeconds: seed.rest ?? (levelMin === 'beginner' ? 75 : levelMin === 'intermediate' ? 55 : 40),
    met: seed.met ?? (phase === 'training' ? (seed.impact === 'high' ? 7 : 4) : 2.5),
    easierId: seed.easier,
    harderId: seed.harder,
    instructions,
    tips,
    frameOne: `${seed.pose}:start`,
    frameTwo: `${seed.pose}:finish`,
  };
}

const trainingSeeds: Seed[] = [
  { id: 'wall-push-up', name: 'Push-up dinding', en: 'Wall push-up', muscles: ['chest'], secondary: ['shoulders', 'triceps'], level: 'beginner', category: 'push', pose: 'push', harder: 'knee-push-up' },
  { id: 'knee-push-up', name: 'Push-up lutut', en: 'Knee push-up', muscles: ['chest'], secondary: ['shoulders', 'triceps'], level: 'beginner', category: 'push', pose: 'push', easier: 'wall-push-up', harder: 'standard-push-up' },
  { id: 'standard-push-up', name: 'Push-up', en: 'Push-up', muscles: ['chest'], secondary: ['shoulders', 'triceps', 'abs'], level: 'intermediate', category: 'push', pose: 'push', easier: 'knee-push-up', harder: 'diamond-push-up' },
  { id: 'diamond-push-up', name: 'Push-up berlian', en: 'Diamond push-up', muscles: ['chest', 'triceps'], secondary: ['shoulders'], level: 'advanced', category: 'push', pose: 'push', easier: 'standard-push-up', harder: 'archer-push-up' },
  { id: 'archer-push-up', name: 'Push-up archer', en: 'Archer push-up', muscles: ['chest'], secondary: ['shoulders', 'triceps'], level: 'advanced', category: 'push', pose: 'push', unilateral: true, easier: 'diamond-push-up', reps: 8 },

  { id: 'wall-shoulder-circle', name: 'Lingkar bahu di dinding', en: 'Wall shoulder circle', muscles: ['shoulders'], secondary: ['traps'], level: 'beginner', furniture: ['wall'], measurement: 'seconds', seconds: 30, category: 'mobility', pose: 'shoulder' },
  { id: 'pike-hold', name: 'Tahan posisi pike', en: 'Pike hold', muscles: ['shoulders'], secondary: ['abs'], level: 'beginner', measurement: 'seconds', seconds: 20, category: 'push', pose: 'shoulder', harder: 'pike-push-up' },
  { id: 'pike-push-up', name: 'Pike push-up', en: 'Pike push-up', muscles: ['shoulders'], secondary: ['triceps', 'chest'], level: 'intermediate', category: 'push', pose: 'push', easier: 'pike-hold', harder: 'wall-handstand-hold' },
  { id: 'plank-shoulder-tap', name: 'Plank sentuh bahu', en: 'Plank shoulder tap', muscles: ['shoulders'], secondary: ['abs', 'obliques'], level: 'intermediate', category: 'core', pose: 'plank', unilateral: true },
  { id: 'wall-handstand-hold', name: 'Tahan handstand di dinding', en: 'Wall handstand hold', muscles: ['shoulders'], secondary: ['triceps', 'traps'], level: 'advanced', furniture: ['wall'], measurement: 'seconds', seconds: 30, category: 'push', pose: 'shoulder', easier: 'pike-push-up', tips: ['Gunakan dinding kokoh dan beri ruang aman.', 'Jangan mencoba bila bahu sedang nyeri.'] },

  { id: 'self-resisted-curl', name: 'Curl bisep tahan sendiri', en: 'Self-resisted biceps curl', muscles: ['biceps'], secondary: ['forearms'], level: 'beginner', measurement: 'seconds', seconds: 20, unilateral: true, category: 'pull', pose: 'curl' },
  { id: 'towel-isometric-curl', name: 'Curl isometrik dengan handuk', en: 'Towel isometric curl', muscles: ['biceps'], secondary: ['forearms'], level: 'intermediate', furniture: ['towel'], measurement: 'seconds', seconds: 30, unilateral: true, category: 'pull', pose: 'curl', easier: 'self-resisted-curl', harder: 'table-chin-up-hold' },
  { id: 'table-chin-up-hold', name: 'Tahan chin-up di meja kokoh', en: 'Sturdy-table chin-up hold', muscles: ['biceps'], secondary: ['back', 'forearms'], level: 'advanced', furniture: ['chair'], measurement: 'seconds', seconds: 15, category: 'pull', pose: 'row', easier: 'towel-isometric-curl', tips: ['Latihan bisep tanpa alat memang terbatas.', 'Hanya gunakan meja berat dan stabil; uji sebelum menopang beban.'] },

  { id: 'wrist-rocks', name: 'Goyang pergelangan', en: 'Wrist rocks', muscles: ['forearms'], secondary: ['shoulders'], level: 'beginner', measurement: 'reps', reps: 10, category: 'mobility', pose: 'plank' },
  { id: 'reverse-plank-hold', name: 'Tahan reverse plank', en: 'Reverse plank hold', muscles: ['forearms'], secondary: ['triceps', 'glutes'], level: 'intermediate', measurement: 'seconds', seconds: 25, category: 'core', pose: 'plank' },
  { id: 'fingertip-plank', name: 'Plank ujung jari', en: 'Fingertip plank', muscles: ['forearms'], secondary: ['chest', 'abs'], level: 'advanced', measurement: 'seconds', seconds: 20, category: 'core', pose: 'plank', tips: ['Turunkan lutut jika tekanan pada jari terlalu kuat.', 'Jangan lakukan bila pergelangan atau jari sedang cedera.'] },

  { id: 'dead-bug', name: 'Dead bug', en: 'Dead bug', muscles: ['abs'], secondary: ['obliques'], level: 'beginner', category: 'core', pose: 'floor', unilateral: true },
  { id: 'forearm-plank', name: 'Plank lengan bawah', en: 'Forearm plank', muscles: ['abs'], secondary: ['shoulders', 'glutes'], level: 'beginner', measurement: 'seconds', seconds: 25, category: 'core', pose: 'plank', harder: 'hollow-hold' },
  { id: 'reverse-crunch', name: 'Reverse crunch', en: 'Reverse crunch', muscles: ['abs'], secondary: ['obliques'], level: 'intermediate', category: 'core', pose: 'floor', easier: 'dead-bug', harder: 'v-up' },
  { id: 'plank-knee-drive', name: 'Plank tarik lutut', en: 'Plank knee drive', muscles: ['abs'], secondary: ['shoulders', 'obliques'], level: 'intermediate', category: 'core', pose: 'plank', unilateral: true },
  { id: 'hollow-hold', name: 'Tahan hollow body', en: 'Hollow body hold', muscles: ['abs'], secondary: ['obliques'], level: 'advanced', measurement: 'seconds', seconds: 30, category: 'core', pose: 'floor', easier: 'forearm-plank' },
  { id: 'v-up', name: 'V-up', en: 'V-up', muscles: ['abs'], secondary: ['obliques'], level: 'advanced', category: 'core', pose: 'floor', easier: 'reverse-crunch', reps: 10 },

  { id: 'side-plank-knee', name: 'Side plank lutut', en: 'Knee side plank', muscles: ['obliques'], secondary: ['abs'], level: 'beginner', measurement: 'seconds', seconds: 20, category: 'core', pose: 'plank', unilateral: true, harder: 'russian-twist' },
  { id: 'standing-side-crunch', name: 'Side crunch berdiri', en: 'Standing side crunch', muscles: ['obliques'], secondary: ['abs'], level: 'beginner', category: 'core', pose: 'standing', unilateral: true },
  { id: 'russian-twist', name: 'Russian twist', en: 'Russian twist', muscles: ['obliques'], secondary: ['abs'], level: 'intermediate', category: 'core', pose: 'floor', easier: 'side-plank-knee', harder: 'side-plank-reach-through' },
  { id: 'side-plank-reach-through', name: 'Side plank reach-through', en: 'Side plank reach-through', muscles: ['obliques'], secondary: ['shoulders', 'abs'], level: 'advanced', category: 'core', pose: 'plank', unilateral: true, easier: 'russian-twist' },

  { id: 'chair-squat', name: 'Squat sentuh kursi', en: 'Chair touch squat', muscles: ['quads'], secondary: ['glutes'], level: 'beginner', furniture: ['chair'], category: 'legs', pose: 'squat', harder: 'bodyweight-squat' },
  { id: 'bodyweight-squat', name: 'Squat tubuh', en: 'Bodyweight squat', muscles: ['quads'], secondary: ['glutes', 'hamstrings'], level: 'beginner', category: 'legs', pose: 'squat', easier: 'chair-squat', harder: 'reverse-lunge' },
  { id: 'reverse-lunge', name: 'Reverse lunge', en: 'Reverse lunge', muscles: ['quads'], secondary: ['glutes', 'hamstrings'], level: 'intermediate', category: 'legs', pose: 'lunge', unilateral: true, easier: 'bodyweight-squat', harder: 'split-squat' },
  { id: 'split-squat', name: 'Split squat', en: 'Split squat', muscles: ['quads'], secondary: ['glutes'], level: 'intermediate', category: 'legs', pose: 'lunge', unilateral: true, easier: 'reverse-lunge', harder: 'pistol-squat-chair' },
  { id: 'jump-squat', name: 'Jump squat', en: 'Jump squat', muscles: ['quads'], secondary: ['glutes', 'calves'], level: 'advanced', impact: 'high', category: 'conditioning', pose: 'jump', easier: 'split-squat', reps: 8 },
  { id: 'pistol-squat-chair', name: 'Pistol squat dibantu kursi', en: 'Chair-assisted pistol squat', muscles: ['quads'], secondary: ['glutes', 'calves'], level: 'advanced', furniture: ['chair'], category: 'legs', pose: 'squat', unilateral: true, easier: 'split-squat', reps: 8 },

  { id: 'superman', name: 'Superman', en: 'Superman', muscles: ['back'], secondary: ['lower-back', 'glutes'], level: 'beginner', measurement: 'reps', reps: 10, category: 'pull', pose: 'floor', harder: 'prone-y-t-w' },
  { id: 'bird-dog', name: 'Bird-dog', en: 'Bird-dog', muscles: ['back'], secondary: ['lower-back', 'abs', 'glutes'], level: 'beginner', category: 'pull', pose: 'bird', unilateral: true, harder: 'prone-y-t-w' },
  { id: 'prone-y-t-w', name: 'Prone Y-T-W', en: 'Prone Y-T-W', muscles: ['back'], secondary: ['traps', 'shoulders'], level: 'intermediate', category: 'pull', pose: 'floor', easier: 'superman', harder: 'table-row' },
  { id: 'reverse-snow-angel', name: 'Reverse snow angel', en: 'Reverse snow angel', muscles: ['back'], secondary: ['traps', 'shoulders'], level: 'intermediate', category: 'pull', pose: 'floor', easier: 'bird-dog' },
  { id: 'table-row', name: 'Table row dengan meja stabil', en: 'Sturdy-table row', muscles: ['back'], secondary: ['biceps', 'forearms'], level: 'advanced', furniture: ['chair'], category: 'pull', pose: 'row', easier: 'prone-y-t-w', tips: ['Gunakan hanya meja berat dan stabil yang terkunci posisinya.', 'Berhenti jika meja bergeser; jangan gunakan kaca atau meja lipat.'] },
  { id: 'towel-door-row', name: 'Towel door row', en: 'Towel door row', muscles: ['back'], secondary: ['biceps', 'traps'], level: 'advanced', furniture: ['towel'], category: 'pull', pose: 'row', easier: 'prone-y-t-w', tips: ['Pastikan pintu tertutup dan terkunci sebelum menarik.', 'Latihan punggung tanpa pull-up bar memang terbatas.'] },

  { id: 'scapular-squeeze', name: 'Remas tulang belikat', en: 'Scapular squeeze', muscles: ['traps'], secondary: ['back'], level: 'beginner', measurement: 'seconds', seconds: 20, category: 'pull', pose: 'standing', harder: 'prone-w-raise' },
  { id: 'prone-w-raise', name: 'Prone W raise', en: 'Prone W raise', muscles: ['traps'], secondary: ['shoulders', 'back'], level: 'beginner', category: 'pull', pose: 'floor', easier: 'scapular-squeeze', harder: 'prone-t-raise' },
  { id: 'prone-t-raise', name: 'Prone T raise', en: 'Prone T raise', muscles: ['traps'], secondary: ['back', 'shoulders'], level: 'intermediate', category: 'pull', pose: 'floor', easier: 'prone-w-raise' },
  { id: 'wall-handstand-shrug', name: 'Shrug handstand di dinding', en: 'Wall handstand shrug', muscles: ['traps'], secondary: ['shoulders', 'triceps'], level: 'advanced', furniture: ['wall'], measurement: 'reps', reps: 8, category: 'pull', pose: 'shoulder', tips: ['Gunakan dinding kokoh dan mintalah pendamping bila perlu.', 'Jangan mencoba jika ada nyeri bahu atau leher.'] },

  { id: 'wall-triceps-press', name: 'Tekan trisep ke dinding', en: 'Wall triceps press', muscles: ['triceps'], secondary: ['chest', 'shoulders'], level: 'beginner', furniture: ['wall'], category: 'push', pose: 'push', harder: 'kneeling-triceps-extension' },
  { id: 'kneeling-triceps-extension', name: 'Triceps extension berlutut', en: 'Kneeling triceps extension', muscles: ['triceps'], secondary: ['shoulders'], level: 'beginner', category: 'push', pose: 'push', easier: 'wall-triceps-press', harder: 'close-grip-push-up' },
  { id: 'close-grip-push-up', name: 'Push-up tangan rapat', en: 'Close-grip push-up', muscles: ['triceps'], secondary: ['chest', 'shoulders'], level: 'intermediate', category: 'push', pose: 'push', easier: 'kneeling-triceps-extension', harder: 'triceps-plank-press' },
  { id: 'chair-triceps-dip', name: 'Triceps dip di kursi', en: 'Chair triceps dip', muscles: ['triceps'], secondary: ['shoulders', 'chest'], level: 'intermediate', furniture: ['chair'], category: 'push', pose: 'floor', tips: ['Pastikan kursi kokoh, tidak beroda, dan menempel ke dinding.', 'Turun hanya sejauh bahu tetap nyaman.'] },
  { id: 'triceps-plank-press', name: 'Plank press trisep', en: 'Triceps plank press', muscles: ['triceps'], secondary: ['shoulders', 'abs'], level: 'advanced', category: 'push', pose: 'plank', easier: 'close-grip-push-up', unilateral: true },

  { id: 'prone-cobra-hold', name: 'Tahan prone cobra', en: 'Prone cobra hold', muscles: ['lower-back'], secondary: ['traps', 'glutes'], level: 'beginner', measurement: 'seconds', seconds: 20, category: 'core', pose: 'floor', harder: 'good-morning' },
  { id: 'hip-hinge-good-morning', name: 'Hip hinge good morning', en: 'Hip hinge good morning', muscles: ['lower-back'], secondary: ['hamstrings', 'glutes'], level: 'beginner', category: 'legs', pose: 'standing', easier: 'prone-cobra-hold', harder: 'superman-hold' },
  { id: 'superman-hold', name: 'Tahan superman', en: 'Superman hold', muscles: ['lower-back'], secondary: ['back', 'glutes'], level: 'intermediate', measurement: 'seconds', seconds: 25, category: 'core', pose: 'floor', easier: 'hip-hinge-good-morning', harder: 'swimmer' },
  { id: 'swimmer', name: 'Swimmer', en: 'Swimmer', muscles: ['lower-back'], secondary: ['back', 'glutes'], level: 'advanced', category: 'core', pose: 'floor', easier: 'superman-hold', reps: 12 },

  { id: 'glute-bridge', name: 'Glute bridge', en: 'Glute bridge', muscles: ['glutes'], secondary: ['hamstrings', 'abs'], level: 'beginner', category: 'legs', pose: 'bridge', harder: 'single-leg-glute-bridge' },
  { id: 'frog-pump', name: 'Frog pump', en: 'Frog pump', muscles: ['glutes'], secondary: ['hamstrings'], level: 'beginner', category: 'legs', pose: 'bridge' },
  { id: 'fire-hydrant', name: 'Fire hydrant', en: 'Fire hydrant', muscles: ['glutes'], secondary: ['obliques'], level: 'beginner', category: 'legs', pose: 'bird', unilateral: true, harder: 'donkey-kick' },
  { id: 'donkey-kick', name: 'Donkey kick', en: 'Donkey kick', muscles: ['glutes'], secondary: ['hamstrings', 'abs'], level: 'intermediate', category: 'legs', pose: 'bird', unilateral: true, easier: 'fire-hydrant', harder: 'bulgarian-split-squat' },
  { id: 'single-leg-glute-bridge', name: 'Glute bridge satu kaki', en: 'Single-leg glute bridge', muscles: ['glutes'], secondary: ['hamstrings', 'abs'], level: 'intermediate', category: 'legs', pose: 'bridge', unilateral: true, easier: 'glute-bridge', harder: 'bulgarian-split-squat' },
  { id: 'bulgarian-split-squat', name: 'Bulgarian split squat', en: 'Bulgarian split squat', muscles: ['glutes'], secondary: ['quads', 'hamstrings'], level: 'advanced', furniture: ['chair'], category: 'legs', pose: 'lunge', unilateral: true, easier: 'single-leg-glute-bridge' },
  { id: 'single-leg-hip-thrust', name: 'Hip thrust satu kaki', en: 'Single-leg hip thrust', muscles: ['glutes'], secondary: ['hamstrings'], level: 'advanced', category: 'legs', pose: 'bridge', unilateral: true, easier: 'single-leg-glute-bridge' },

  { id: 'hamstring-walkout', name: 'Hamstring walkout', en: 'Hamstring walkout', muscles: ['hamstrings'], secondary: ['glutes', 'abs'], level: 'beginner', category: 'legs', pose: 'bridge', harder: 'towel-hamstring-curl' },
  { id: 'kickstand-hinge', name: 'Kickstand hinge', en: 'Kickstand hinge', muscles: ['hamstrings'], secondary: ['glutes', 'lower-back'], level: 'beginner', category: 'legs', pose: 'lunge', unilateral: true },
  { id: 'towel-hamstring-curl', name: 'Hamstring curl dengan handuk', en: 'Towel hamstring curl', muscles: ['hamstrings'], secondary: ['glutes'], level: 'intermediate', furniture: ['towel'], category: 'legs', pose: 'bridge', easier: 'hamstring-walkout', harder: 'sliding-leg-curl' },
  { id: 'single-leg-deadlift', name: 'Single-leg deadlift', en: 'Single-leg deadlift', muscles: ['hamstrings'], secondary: ['glutes', 'lower-back'], level: 'intermediate', category: 'legs', pose: 'lunge', unilateral: true, easier: 'kickstand-hinge' },
  { id: 'sliding-leg-curl', name: 'Sliding leg curl', en: 'Sliding leg curl', muscles: ['hamstrings'], secondary: ['glutes', 'abs'], level: 'advanced', furniture: ['towel'], category: 'legs', pose: 'bridge', easier: 'towel-hamstring-curl' },
  { id: 'bridge-leg-extension', name: 'Bridge leg extension', en: 'Bridge leg extension', muscles: ['hamstrings'], secondary: ['glutes', 'abs'], level: 'advanced', category: 'legs', pose: 'bridge', unilateral: true },

  { id: 'standing-calf-raise', name: 'Calf raise berdiri', en: 'Standing calf raise', muscles: ['calves'], secondary: ['quads'], level: 'beginner', category: 'legs', pose: 'calf', harder: 'single-leg-calf-raise' },
  { id: 'bent-knee-calf-raise', name: 'Calf raise lutut menekuk', en: 'Bent-knee calf raise', muscles: ['calves'], secondary: ['quads'], level: 'beginner', category: 'legs', pose: 'calf' },
  { id: 'single-leg-calf-raise', name: 'Calf raise satu kaki', en: 'Single-leg calf raise', muscles: ['calves'], secondary: ['quads'], level: 'intermediate', category: 'legs', unilateral: true, pose: 'calf', easier: 'standing-calf-raise', harder: 'paused-single-calf-raise' },
  { id: 'eccentric-calf-lower', name: 'Turun calf raise perlahan', en: 'Eccentric calf lower', muscles: ['calves'], secondary: ['hamstrings'], level: 'intermediate', category: 'legs', pose: 'calf', unilateral: true },
  { id: 'calf-pogo-jump', name: 'Pogo jump betis', en: 'Calf pogo jump', muscles: ['calves'], secondary: ['quads'], level: 'advanced', impact: 'high', category: 'conditioning', pose: 'jump', harder: 'paused-single-calf-raise', reps: 15 },
  { id: 'paused-single-calf-raise', name: 'Calf raise satu kaki dengan jeda', en: 'Paused single-leg calf raise', muscles: ['calves'], secondary: ['quads'], level: 'advanced', category: 'legs', pose: 'calf', unilateral: true, easier: 'single-leg-calf-raise' },
];

const warmupSeeds: Seed[] = [
  { id: 'warm-neck-mobility', name: 'Mobilitas leher ringan', en: 'Gentle neck mobility', muscles: ['shoulders'], pose: 'standing', seconds: 30 },
  { id: 'warm-shoulder-roll', name: 'Putaran bahu', en: 'Shoulder rolls', muscles: ['shoulders', 'traps'], pose: 'shoulder', seconds: 30 },
  { id: 'warm-arm-swings', name: 'Ayunan lengan', en: 'Arm swings', muscles: ['chest', 'shoulders'], pose: 'standing', seconds: 35 },
  { id: 'warm-wrist-circles', name: 'Putaran pergelangan', en: 'Wrist circles', muscles: ['forearms'], pose: 'standing', seconds: 30 },
  { id: 'warm-torso-rotation', name: 'Rotasi badan', en: 'Torso rotation', muscles: ['obliques', 'abs'], pose: 'standing', seconds: 35 },
  { id: 'warm-cat-cow', name: 'Cat-cow', en: 'Cat-cow', muscles: ['lower-back', 'abs'], pose: 'bird', seconds: 40 },
  { id: 'warm-inchworm', name: 'Inchworm jalan', en: 'Inchworm walkout', muscles: ['chest', 'hamstrings'], pose: 'crawl', seconds: 30 },
  { id: 'warm-hip-circles', name: 'Putaran pinggul', en: 'Hip circles', muscles: ['glutes', 'obliques'], pose: 'standing', seconds: 30 },
  { id: 'warm-leg-swing-front', name: 'Ayunan kaki depan-belakang', en: 'Front-to-back leg swing', muscles: ['quads', 'hamstrings'], pose: 'standing', seconds: 35 },
  { id: 'warm-leg-swing-side', name: 'Ayunan kaki menyamping', en: 'Side leg swing', muscles: ['glutes', 'quads'], pose: 'standing', seconds: 35 },
  { id: 'warm-squat-flow', name: 'Squat ringan', en: 'Easy squat flow', muscles: ['quads', 'glutes'], pose: 'squat', seconds: 40, category: 'legs' },
  { id: 'warm-glute-bridge', name: 'Glute bridge aktivasi', en: 'Glute bridge activation', muscles: ['glutes', 'hamstrings'], pose: 'bridge', seconds: 35, category: 'legs' },
  { id: 'warm-march', name: 'Jalan di tempat', en: 'March in place', muscles: ['quads', 'calves'], pose: 'standing', seconds: 40, category: 'conditioning' },
  { id: 'warm-calf-raise', name: 'Calf raise pemanasan', en: 'Calf raise warm-up', muscles: ['calves'], pose: 'calf', seconds: 30, category: 'legs' },
  { id: 'warm-ankle-circles', name: 'Putaran pergelangan kaki', en: 'Ankle circles', muscles: ['calves'], pose: 'standing', seconds: 30 },
];

const cooldownSeeds: Seed[] = [
  { id: 'cool-box-breathing', name: 'Napas perlahan', en: 'Slow breathing', muscles: ['abs'], pose: 'breathing', seconds: 45 },
  { id: 'cool-chest-wall-stretch', name: 'Regang dada di dinding', en: 'Wall chest stretch', muscles: ['chest', 'shoulders'], furniture: ['wall'], pose: 'stretch', seconds: 35 },
  { id: 'cool-overhead-triceps-stretch', name: 'Regang trisep atas kepala', en: 'Overhead triceps stretch', muscles: ['triceps'], pose: 'stretch', seconds: 30 },
  { id: 'cool-cross-body-shoulder', name: 'Regang bahu silang', en: 'Cross-body shoulder stretch', muscles: ['shoulders', 'traps'], pose: 'stretch', seconds: 30 },
  { id: 'cool-child-pose', name: 'Child pose', en: 'Child’s pose', muscles: ['back', 'shoulders'], pose: 'stretch', seconds: 40 },
  { id: 'cool-puppy-pose', name: 'Puppy pose', en: 'Puppy pose', muscles: ['back', 'shoulders'], pose: 'stretch', seconds: 35 },
  { id: 'cool-cobra-stretch', name: 'Regang cobra lembut', en: 'Gentle cobra stretch', muscles: ['abs', 'lower-back'], pose: 'stretch', seconds: 25 },
  { id: 'cool-side-reach', name: 'Regang sisi tubuh', en: 'Side body reach', muscles: ['obliques'], pose: 'stretch', seconds: 30 },
  { id: 'cool-hip-flexor-lunge', name: 'Regang fleksor pinggul', en: 'Hip flexor lunge stretch', muscles: ['quads', 'glutes'], pose: 'lunge', seconds: 35 },
  { id: 'cool-hamstring-fold', name: 'Regang paha belakang', en: 'Hamstring fold', muscles: ['hamstrings'], pose: 'stretch', seconds: 35 },
  { id: 'cool-figure-four', name: 'Regang figure four', en: 'Figure-four stretch', muscles: ['glutes'], pose: 'floor', seconds: 35 },
  { id: 'cool-calf-wall-stretch', name: 'Regang betis di dinding', en: 'Wall calf stretch', muscles: ['calves'], furniture: ['wall'], pose: 'stretch', seconds: 30 },
  { id: 'cool-forearm-stretch', name: 'Regang lengan bawah', en: 'Forearm stretch', muscles: ['forearms', 'biceps'], pose: 'stretch', seconds: 25 },
  { id: 'cool-butterfly-fold', name: 'Regang kupu-kupu', en: 'Butterfly fold', muscles: ['quads', 'glutes'], pose: 'floor', seconds: 35 },
  { id: 'cool-ankle-release', name: 'Peregangan pergelangan kaki', en: 'Ankle release', muscles: ['calves'], pose: 'floor', seconds: 25 },
];

export const EXERCISES: Exercise[] = [
  ...trainingSeeds.map((seed) => exercise(seed, 'training')),
  ...warmupSeeds.map((seed) => exercise(seed, 'warm-up')),
  ...cooldownSeeds.map((seed) => exercise(seed, 'cooldown')),
];
