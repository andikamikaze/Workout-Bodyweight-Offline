import { Platform } from "react-native";

// Props tap yang aman untuk elemen react-native-svg di semua platform.
export function svgTapProps(onTap: () => void): { onPress: () => void } {
  if (Platform.OS === "web") {
    return { onClick: onTap } as unknown as { onPress: () => void };
  }
  return { onPress: onTap };
}

// Prop `accessible` boolean disebar mentah ke DOM di web -> warning
export function svgA11yProps(): { accessible: true } | Record<string, never> {
  if (Platform.OS === "web") return {};
  return { accessible: true as const };
}
