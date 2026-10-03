import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { ANATOMY_MAPS, ANATOMY_VIEWBOX } from "@/src/data/anatomyMaps";
import { MUSCLES } from "@/src/data/muscles";
import { tx } from "@/src/i18n";
import { svgA11yProps, svgTapProps } from "./svgPress";
import { MuscleId } from "@/src/types";

export type AnatomyGender = "male" | "female";
export type AnatomySide = "front" | "back";

// Peta anatomi full-body yang bisa diketuk, dari artwork SVG referensi
export function AnatomyMap({
  gender,
  side,
  selected,
  language,
  onToggle,
}: {
  gender: AnatomyGender;
  side: AnatomySide;
  selected: MuscleId[];
  language: "id" | "en";
  onToggle: (id: MuscleId) => void;
}) {
  const colors = useColors();
  const variant = ANATOMY_MAPS[gender][side];

  const labelFor = (id: MuscleId) => {
    const metadata = MUSCLES.find((muscle) => muscle.id === id);
    if (!metadata) return id;
    return language === "id" ? metadata.label : metadata.englishLabel;
  };

  return (
    <View
      style={styles.mapWrap}
      accessibilityLabel={
        side === "front"
          ? "Peta otot bagian depan"
          : "Peta otot bagian belakang"
      }
    >
      <Svg
        viewBox={ANATOMY_VIEWBOX}
        width="100%"
        height={430}
        {...svgA11yProps()}
        accessibilityLabel={
          side === "front"
            ? "Siluet depan yang dapat dipilih"
            : "Siluet belakang yang dapat dipilih"
        }
      >
        {/* Siluet netral: tangan (ghost, konsisten dengan zona tak dipilih) */}
        {variant.basePaths.map((d, index) => (
          <Path
            key={`base-${index}`}
            d={d}
            fill={colors.primary}
            fillOpacity={0.4}
            stroke={colors.background}
            strokeWidth={1.5}
          />
        ))}
        {/* Filler sendi lutut: netral, non-interaktif, di bawah zona otot */}
        {variant.fillers.map((filler, index) => (
          <Circle
            key={`filler-${index}`}
            cx={filler.cx}
            cy={filler.cy}
            r={filler.r}
            fill={colors.secondary}
            stroke={colors.border}
            strokeWidth={1.5}
          />
        ))}
        {/* Garis kontur tubuh: tebal agar terbaca di semua tema */}
        {variant.strokes.map((d, index) => (
          <Path
            key={`stroke-${index}`}
            d={d}
            fill="none"
            stroke={colors.border}
            strokeOpacity={0.9}
            strokeWidth={3.5}
          />
        ))}
        {variant.lines.map(([x1, y1, x2, y2], index) => (
          <Line
            key={`line-${index}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={colors.border}
            strokeOpacity={0.9}
            strokeWidth={3.5}
          />
        ))}
        {/* Zona otot yang bisa diketuk */}
        {variant.zones.map((zone, zoneIndex) => {
          const isSelected = selected.includes(zone.id);
          const label = labelFor(zone.id);
          const stateLabel = isSelected
            ? tx(language, `${label}, dipilih`, `${label}, selected`)
            : label;
          return zone.paths.map((d, index) => (
            <Path
              key={`${zone.id}-${zoneIndex}-${index}`}
              d={d}
              fill={isSelected ? colors.accent : colors.primary}
              fillOpacity={isSelected ? 0.9 : 0.4}
              stroke={isSelected ? colors.primary : colors.background}
              strokeWidth={isSelected ? 2.5 : 1.5}
              {...svgTapProps(() => onToggle(zone.id))}
              {...svgA11yProps()}
              accessibilityLabel={stateLabel}
              testID={`anatomy-zone-${zone.id}`}
            />
          ));
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    width: "100%",
    height: 430,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
