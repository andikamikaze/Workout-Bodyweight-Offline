import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { Exercise } from '@/src/types';

function PoseFrame({ frameKey }: { frameKey: string }) {
  const colors = useColors();
  const [pose, moment = 'start'] = frameKey.split(':');
  const end = moment === 'finish';
  const ink = colors.primary;
  const soft = colors.secondary;
  const accent = colors.accent;
  const lineProps = {
    stroke: ink,
    strokeWidth: 8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  const upright = (
    <G {...lineProps}>
      <Circle cx={128} cy={27} r={12} fill={accent} stroke={ink} strokeWidth={5} />
      <Path d={end ? 'M128 40 L128 88' : 'M128 40 L128 85'} />
      <Path d={end ? 'M128 52 L95 68 L77 45 M128 52 L153 63 L174 42' : 'M128 52 L96 70 L83 46 M128 52 L160 70 L174 48'} />
      <Path d={end ? 'M128 87 L106 116 L94 139 M128 87 L150 116 L163 139' : 'M128 85 L111 113 L105 140 M128 85 L146 112 L151 140'} />
    </G>
  );

  const floor = (
    <G {...lineProps}>
      <Circle cx={end ? 49 : 46} cy={end ? 64 : 74} r={12} fill={accent} stroke={ink} strokeWidth={5} />
      <Path d={end ? 'M62 67 L123 55 L169 65' : 'M60 76 L124 75 L172 76'} />
      <Path d={end ? 'M82 71 L62 104 L49 120 M91 69 L116 103 L125 121' : 'M83 77 L63 111 L48 123 M102 77 L125 105 L137 122'} />
      <Path d={end ? 'M168 65 L197 46 L216 38 M167 66 L193 88 L211 97' : 'M170 76 L197 55 L219 53 M170 76 L198 92 L219 92'} />
    </G>
  );

  const push = (
    <G {...lineProps}>
      <Circle cx={end ? 55 : 53} cy={end ? 77 : 73} r={12} fill={accent} stroke={ink} strokeWidth={5} />
      <Path d={end ? 'M68 79 L133 73 L190 69' : 'M67 75 L132 72 L190 74'} />
      <Path d={end ? 'M98 75 L106 98 L100 123 M98 75 L91 96 L86 119' : 'M100 75 L102 105 L97 126 M100 75 L91 100 L84 122'} />
      <Path d={end ? 'M190 69 L215 97 L229 98 M189 69 L213 64 L229 66' : 'M190 74 L216 98 L229 99 M190 74 L216 65 L229 66'} />
    </G>
  );

  const squat = (
    <G {...lineProps}>
      <Circle cx={128} cy={27} r={12} fill={accent} stroke={ink} strokeWidth={5} />
      <Path d={end ? 'M128 40 L128 76' : 'M128 40 L128 85'} />
      <Path d="M128 52 L98 68 L86 94 M128 52 L158 68 L170 94" />
      <Path d={end ? 'M128 75 L101 94 L108 117 L88 139 M128 75 L155 94 L148 117 L168 139' : 'M128 84 L108 112 L104 139 M128 84 L148 112 L152 139'} />
    </G>
  );

  const bridge = (
    <G {...lineProps}>
      <Circle cx={36} cy={103} r={11} fill={accent} stroke={ink} strokeWidth={5} />
      <Path d={end ? 'M48 99 L96 65 L148 67 L184 102' : 'M48 101 L96 99 L144 101 L184 102'} />
      <Path d="M184 102 L206 75 L226 74 M184 102 L211 119 L229 120" />
      <Path d={end ? 'M96 65 L93 39 M96 65 L117 44' : 'M97 99 L90 76 M97 99 L119 80'} />
    </G>
  );

  const bird = (
    <G {...lineProps}>
      <Circle cx={end ? 82 : 89} cy={65} r={11} fill={accent} stroke={ink} strokeWidth={5} />
      <Path d="M101 67 L148 77 L181 86" />
      <Path d="M124 73 L116 103 L105 122 M124 73 L143 101 L158 117" />
      <Path d={end ? 'M104 75 L75 94 L43 94 M151 79 L180 64 L215 48' : 'M104 75 L78 96 L51 100 M151 79 L175 96 L201 101'} />
    </G>
  );

  const row = (
    <G {...lineProps}>
      <Circle cx={end ? 55 : 51} cy={end ? 68 : 76} r={11} fill={accent} stroke={ink} strokeWidth={5} />
      <Path d={end ? 'M67 70 L122 80 L167 82' : 'M63 78 L121 87 L168 87'} />
      <Path d="M168 87 L197 67 L220 66 M168 87 L197 105 L221 106" />
      <Path d={end ? 'M119 80 L104 55 L97 39 M119 80 L141 59 L150 42' : 'M118 87 L100 61 L90 51 M118 87 L142 66 L155 55'} />
    </G>
  );

  const lunge = (
    <G {...lineProps}>
      <Circle cx={128} cy={27} r={12} fill={accent} stroke={ink} strokeWidth={5} />
      <Path d={end ? 'M128 40 L128 81' : 'M128 40 L128 84'} />
      <Path d="M128 53 L98 73 L90 96 M128 53 L157 73 L165 96" />
      <Path d={end ? 'M128 80 L105 104 L80 106 L73 138 M128 80 L155 102 L172 122 L191 139' : 'M128 83 L111 111 L94 139 M128 83 L150 110 L165 139'} />
    </G>
  );

  const overhead = (
    <G {...lineProps}>
      <Circle cx={128} cy={27} r={12} fill={accent} stroke={ink} strokeWidth={5} />
      <Path d={end ? 'M128 40 L128 86' : 'M128 40 L128 84'} />
      <Path d={end ? 'M128 52 L108 30 L100 10 M128 52 L148 30 L156 10' : 'M128 52 L98 38 L82 22 M128 52 L158 38 L174 22'} />
      <Path d={end ? 'M128 86 L112 113 L107 140 M128 86 L144 113 L149 140' : 'M128 84 L111 112 L105 140 M128 84 L145 112 L151 140'} />
    </G>
  );

  const sideBend = (
    <G {...lineProps}>
      <Rect x={end ? 96 : 78} y={132} width={88} height={7} rx={3.5} fill={soft} opacity={0.9} />
      <Circle cx={end ? 144 : 128} cy={27} r={12} fill={accent} stroke={ink} strokeWidth={5} />
      <Path d={end ? 'M144 40 L154 84' : 'M128 40 L128 85'} />
      <Path d={end ? 'M151 52 L183 38 L199 20 M151 52 L128 66 L118 88' : 'M128 52 L160 36 L176 20 M128 52 L100 68 L90 90'} />
      <Path d={end ? 'M154 84 L138 112 L132 132 M154 84 L170 111 L175 132' : 'M128 85 L111 113 L105 132 M128 85 L146 112 L151 132'} />
    </G>
  );

  const kneel = (
    <G {...lineProps}>
      <Rect x={72} y={132} width={112} height={7} rx={3.5} fill={soft} opacity={0.9} />
      <Circle cx={128} cy={36} r={12} fill={accent} stroke={ink} strokeWidth={5} />
      <Path d="M128 48 L128 92" />
      <Path d={end ? 'M128 60 L108 72 L126 58 M128 60 L148 72 L152 94' : 'M128 60 L108 72 L112 94 M128 60 L148 72 L154 92'} />
      <Path d={end ? 'M128 92 L108 110 L108 132 M128 92 L150 110 L166 122 L170 132' : 'M128 92 L110 112 L92 122 L88 132 M128 92 L148 110 L162 132'} />
    </G>
  );

  const frame = (() => {
    if (pose === 'push') return push;
    if (pose === 'plank' || pose === 'crawl') return bird;
    if (pose === 'squat' || pose === 'calf' || pose === 'jump') return squat;
    if (pose === 'lunge') return lunge;
    if (pose === 'bridge') return bridge;
    if (pose === 'floor') return floor;
    if (pose === 'row') return row;
    if (pose === 'bird') return bird;
    if (pose === 'shoulder') return overhead;
    if (pose === 'breathing') return overhead;
    if (pose === 'stretch') return sideBend;
    if (pose === 'standing') return upright;
    if (pose === 'curl') return kneel;
    return upright;
  })();

  return (
    <Svg width="100%" height="100%" viewBox="0 0 256 160" accessibilityLabel="Ilustrasi dua posisi latihan">
      <Rect x="16" y="139" width="224" height="3" rx="1.5" fill={colors.border} />
      <Circle cx="128" cy="79" r="67" fill={soft} opacity={0.48} />
      {frame}
      <Path d="M209 28 L225 28 L225 41" fill="none" stroke={accent} strokeWidth={4} strokeLinecap="round" />
    </Svg>
  );
}

export function ExerciseIllustration({
  exercise,
  height = 190,
}: {
  exercise: Exercise;
  height?: number;
}) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.delay(850),
        Animated.timing(fade, { toValue: 0, duration: 420, useNativeDriver: true }),
        Animated.delay(850),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [fade]);

  return (
    <View accessible accessibilityLabel={`Ilustrasi ${exercise.name}, dua posisi bergantian`} style={[styles.frame, { height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
        <PoseFrame frameKey={exercise.frameOne} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <PoseFrame frameKey={exercise.frameTwo} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', overflow: 'hidden', borderRadius: 18 },
});