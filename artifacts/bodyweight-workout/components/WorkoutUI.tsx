import React, { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export function AppScreen({
  children,
  scroll = true,
  style,
  contentStyle,
}: {
  children?: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webInsets = Platform.OS === 'web';
  const paddingTop = webInsets ? Math.max(67, insets.top) : insets.top;
  const paddingBottom = webInsets ? Math.max(34, insets.bottom) : insets.bottom;
  if (!scroll) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop, paddingBottom }, style]}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }, style]}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop, paddingBottom: Math.max(28, paddingBottom + 20) },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Surface({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const surfaceStyle = [
    styles.surface,
    { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [surfaceStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={surfaceStyle}>{children}</View>;
}

export function ActionButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  ...props
}: Omit<PressableProps, 'onPress' | 'style'> & {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}) {
  const colors = useColors();
  const backgroundColor =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.destructive
        : variant === 'secondary'
          ? colors.secondary
          : 'transparent';
  const foregroundColor =
    variant === 'primary'
      ? colors.primaryForeground
      : variant === 'danger'
        ? colors.destructiveForeground
        : colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor: variant === 'outline' ? colors.border : backgroundColor,
          opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={foregroundColor} />
      ) : (
        <Text style={[styles.buttonText, { color: foregroundColor }, textStyle]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button">
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Pill({
  label,
  selected = false,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const colors = useColors();
  const content = (
    <Text style={[styles.pillText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
      {label}
    </Text>
  );
  const pillStyle = [
    styles.pill,
    {
      backgroundColor: selected ? colors.primary : colors.secondary,
      borderColor: selected ? colors.primary : colors.border,
    },
    style,
  ];
  if (!onPress) return <View style={pillStyle}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [pillStyle, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export const uiStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 12, lineHeight: 17 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, gap: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 3 },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3 },
  title: { fontSize: 29, lineHeight: 35, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 1 },
  surface: { borderWidth: 1, padding: 16, gap: 10 },
  button: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 3 },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  sectionAction: { fontSize: 13, fontWeight: '700' },
  pill: { minHeight: 40, borderWidth: 1, borderRadius: 20, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});