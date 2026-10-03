import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { MUSCLES } from '@/src/data/muscles';
import { MuscleId } from '@/src/types';

type BodySide = 'front' | 'back';

// Audit hit-area FR-02: semua Circle hit harus r>=24 (diameter 48dp).
// Otot kecil (forearms, traps) dapat hitR diperbesar agar mudah diketuk.
// Fill datar tanpa gradient/filter — warna via useColors():
// selected = colors.accent (fillOpacity 1), unselected = colors.primary (fillOpacity 0.2).
interface MuscleZone {
  id: MuscleId;
  paths: string[];
  hit: Array<{ x: number; y: number }>;
  /** Radius hit-area Circle. Default 25 (>=24). Otot kecil gunakan 30. */
  hitR?: number;
}

const DEFAULT_HIT_R = 25;
const SMALL_MUSCLE_HIT_R = 30;

const FRONT_ZONES: MuscleZone[] = [
  {
    id: 'shoulders',
    paths: [
      'M112 71 C115 60 127 56 143 62 L149 76 C138 69 126 73 116 83 Z',
      'M188 71 C185 60 173 56 157 62 L151 76 C162 69 174 73 184 83 Z',
    ],
    hit: [{ x: 119, y: 71 }, { x: 181, y: 71 }],
  },
  {
    id: 'chest',
    paths: [
      'M113 78 C124 72 138 74 149 81 L149 110 C137 115 123 109 112 101 Z',
      'M187 78 C176 72 162 74 151 81 L151 110 C163 115 177 109 188 101 Z',
    ],
    hit: [{ x: 132, y: 91 }, { x: 168, y: 91 }],
  },
  {
    id: 'biceps',
    paths: [
      'M99 88 C104 81 110 81 115 87 L108 119 L98 127 L91 120 Z',
      'M201 88 C196 81 190 81 185 87 L192 119 L202 127 L209 120 Z',
    ],
    hit: [{ x: 101, y: 104 }, { x: 199, y: 104 }],
  },
  {
    id: 'forearms',
    paths: [
      'M91 124 L101 128 L91 161 L80 171 L73 166 L78 145 Z',
      'M209 124 L199 128 L209 161 L220 171 L227 166 L222 145 Z',
    ],
    hit: [{ x: 84, y: 146 }, { x: 216, y: 146 }],
    hitR: SMALL_MUSCLE_HIT_R,
  },
  {
    id: 'abs',
    paths: [
      'M132 116 C143 120 157 120 168 116 L176 164 C163 171 137 171 124 164 Z',
    ],
    hit: [{ x: 150, y: 140 }],
  },
  {
    id: 'obliques',
    paths: [
      'M112 112 L127 117 L121 158 L113 169 L107 143 Z',
      'M188 112 L173 117 L179 158 L187 169 L193 143 Z',
    ],
    hit: [{ x: 117, y: 143 }, { x: 183, y: 143 }],
  },
  {
    id: 'quads',
    paths: [
      'M116 173 C126 171 138 174 148 180 L143 244 L130 270 L117 252 L108 202 Z',
      'M184 173 C174 171 162 174 152 180 L157 244 L170 270 L183 252 L192 202 Z',
    ],
    hit: [{ x: 127, y: 215 }, { x: 173, y: 215 }],
  },
];

const BACK_ZONES: MuscleZone[] = [
  {
    id: 'traps',
    paths: [
      'M124 63 C137 60 145 67 150 77 C155 67 163 60 176 63 L186 78 L169 88 L150 83 L131 88 L114 78 Z',
    ],
    hit: [{ x: 150, y: 74 }],
    hitR: SMALL_MUSCLE_HIT_R,
  },
  {
    id: 'back',
    paths: [
      'M113 84 C123 79 138 79 148 85 L145 130 L126 145 L116 131 Z',
      'M187 84 C177 79 162 79 152 85 L155 130 L174 145 L184 131 Z',
    ],
    hit: [{ x: 130, y: 112 }, { x: 170, y: 112 }],
  },
  {
    id: 'triceps',
    paths: [
      'M99 88 C104 81 110 81 115 87 L108 119 L98 127 L91 120 Z',
      'M201 88 C196 81 190 81 185 87 L192 119 L202 127 L209 120 Z',
    ],
    hit: [{ x: 101, y: 104 }, { x: 199, y: 104 }],
  },
  {
    id: 'lower-back',
    paths: [
      'M128 146 L145 137 L150 145 L155 137 L172 146 L178 169 C163 176 137 176 122 169 Z',
    ],
    hit: [{ x: 150, y: 158 }],
  },
  {
    id: 'glutes',
    paths: [
      'M119 173 C130 168 143 174 149 183 L147 207 C136 213 124 208 117 199 Z',
      'M181 173 C170 168 157 174 151 183 L153 207 C164 213 176 208 183 199 Z',
    ],
    hit: [{ x: 133, y: 190 }, { x: 167, y: 190 }],
  },
  {
    id: 'hamstrings',
    paths: [
      'M116 206 C127 208 138 214 146 218 L142 262 L129 278 L116 254 Z',
      'M184 206 C173 208 162 214 154 218 L158 262 L171 278 L184 254 Z',
    ],
    hit: [{ x: 129, y: 238 }, { x: 171, y: 238 }],
  },
  {
    id: 'calves',
    paths: [
      'M129 280 L142 269 L148 280 L144 331 L133 352 L123 344 Z',
      'M171 280 L158 269 L152 280 L156 331 L167 352 L177 344 Z',
    ],
    hit: [{ x: 135, y: 310 }, { x: 165, y: 310 }],
  },
];

const SHAPES: Record<BodySide, MuscleZone[]> = {
  front: FRONT_ZONES,
  back: BACK_ZONES,
};

function MuscleLayer({
  zone,
  selected,
  fill,
  stroke,
  label,
  onPress,
}: {
  zone: MuscleZone;
  selected: boolean;
  fill: string;
  stroke: string;
  label: string;
  onPress: (id: MuscleId) => void;
}) {
  const handlePress = () => onPress(zone.id);
  // Flat fill tanpa gradient/filter. Warna dari useColors() diteruskan via props:
  // selected -> colors.accent, unselected -> colors.primary dengan fillOpacity 0.2.
  const hitR = Math.max(zone.hitR ?? DEFAULT_HIT_R, 24);
  return (
    <>
      {zone.paths.map((path, index) => (
        <Path
          key={`${zone.id}-${index}`}
          d={path}
          fill={fill}
          fillOpacity={selected ? 1 : 0.2}
          stroke={stroke}
          strokeWidth={selected ? 1.8 : 1}
          onPress={handlePress}
          accessibilityLabel={label}
          accessible
        />
      ))}
      {zone.hit.map((hit, index) => (
        <Circle
          key={`${zone.id}-hit-${index}`}
          cx={hit.x}
          cy={hit.y}
          r={hitR}
          fill="transparent"
          onPress={handlePress}
          accessibilityLabel={label}
          accessible
          testID={`bodymap-hit-${zone.id}-${index}`}
        />
      ))}
    </>
  );
}

export function BodyMap({
  side,
  selected,
  language,
  onToggle,
}: {
  side: BodySide;
  selected: MuscleId[];
  language: 'id' | 'en';
  onToggle: (id: MuscleId) => void;
}) {
  const colors = useColors();
  const visibleMuscles = MUSCLES.filter((muscle) => muscle.side === side);
  const zones = SHAPES[side];

  return (
    <View style={styles.mapWrap} accessibilityLabel={side === 'front' ? 'Peta otot bagian depan' : 'Peta otot bagian belakang'}>
      <Svg
        viewBox="0 0 300 370"
        width="100%"
        height={330}
        accessible
        accessibilityLabel={side === 'front' ? 'Siluet depan yang dapat dipilih' : 'Siluet belakang yang dapat dipilih'}
      >
        <Ellipse cx={150} cy={31} rx={21} ry={23} fill={colors.secondary} stroke={colors.border} strokeWidth={2} />
        <Path
          d="M137 51 L163 51 L168 64 C183 60 194 66 202 77 L210 113 L201 128 L194 105 L190 153 L184 173 L187 185 L193 204 L188 257 L181 273 L176 342 L164 359 L153 354 L151 294 L150 227 L149 294 L147 354 L136 359 L124 342 L119 273 L112 257 L107 204 L113 185 L116 173 L110 153 L106 105 L99 128 L90 113 L98 77 C106 66 117 60 132 64 Z"
          fill={colors.secondary}
          stroke={colors.border}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Path
          d="M142 52 L150 61 L158 52 M150 82 L150 169 M122 171 Q150 180 178 171 M148 184 L145 217 M152 184 L155 217"
          fill="none"
          stroke={colors.mutedForeground}
          strokeOpacity={0.5}
          strokeWidth={1}
        />
        {zones.map((zone) => {
          const metadata = visibleMuscles.find((muscle) => muscle.id === zone.id);
          if (!metadata) return null;
          const label = language === 'id' ? metadata.label : metadata.englishLabel;
          return (
            <MuscleLayer
              key={zone.id}
              zone={zone}
              selected={selected.includes(zone.id)}
              fill={selected.includes(zone.id) ? colors.accent : colors.primary}
              stroke={selected.includes(zone.id) ? colors.primary : colors.background}
              label={label}
              onPress={onToggle}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    width: '100%',
    height: 330,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});