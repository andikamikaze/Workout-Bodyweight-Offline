import { MuscleId } from '@/src/types';

export const MUSCLES: Array<{
  id: MuscleId;
  label: string;
  englishLabel: string;
  side: 'front' | 'back';
  group: 'upper' | 'lower' | 'core';
}> = [
  { id: 'chest', label: 'Dada', englishLabel: 'Chest', side: 'front', group: 'upper' },
  { id: 'shoulders', label: 'Bahu', englishLabel: 'Shoulders', side: 'front', group: 'upper' },
  { id: 'biceps', label: 'Bisep', englishLabel: 'Biceps', side: 'front', group: 'upper' },
  { id: 'forearms', label: 'Lengan bawah', englishLabel: 'Forearms', side: 'front', group: 'upper' },
  { id: 'abs', label: 'Perut', englishLabel: 'Abs', side: 'front', group: 'core' },
  { id: 'obliques', label: 'Oblique', englishLabel: 'Obliques', side: 'front', group: 'core' },
  { id: 'quads', label: 'Paha depan', englishLabel: 'Quads', side: 'front', group: 'lower' },
  { id: 'back', label: 'Punggung atas', englishLabel: 'Upper back / lats', side: 'back', group: 'upper' },
  { id: 'traps', label: 'Trapezius', englishLabel: 'Trapezius', side: 'back', group: 'upper' },
  { id: 'triceps', label: 'Trisep', englishLabel: 'Triceps', side: 'back', group: 'upper' },
  { id: 'lower-back', label: 'Punggung bawah', englishLabel: 'Lower back', side: 'back', group: 'core' },
  { id: 'glutes', label: 'Glutes', englishLabel: 'Glutes', side: 'back', group: 'lower' },
  { id: 'hamstrings', label: 'Paha belakang', englishLabel: 'Hamstrings', side: 'back', group: 'lower' },
  { id: 'calves', label: 'Betis', englishLabel: 'Calves', side: 'back', group: 'lower' },
];

export const MUSCLE_LABELS: Record<MuscleId, string> = Object.fromEntries(
  MUSCLES.map((muscle) => [muscle.id, muscle.label]),
) as Record<MuscleId, string>;

export const MUSCLE_PRESETS: Record<string, { label: string; areas: MuscleId[] }> = {
  full: { label: 'Seluruh tubuh', areas: MUSCLES.map((muscle) => muscle.id) },
  upper: {
    label: 'Tubuh atas',
    areas: ['chest', 'shoulders', 'biceps', 'forearms', 'back', 'traps', 'triceps'],
  },
  lower: { label: 'Tubuh bawah', areas: ['quads', 'glutes', 'hamstrings', 'calves'] },
  core: { label: 'Core', areas: ['abs', 'obliques', 'lower-back'] },
};