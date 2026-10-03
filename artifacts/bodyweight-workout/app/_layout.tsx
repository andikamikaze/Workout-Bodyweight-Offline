import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { AppProvider } from "@/src/store/AppContext";

// Prevent the splash screen from auto-hiding before the app is ready.
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: "Kembali" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="focus" />
      <Stack.Screen name="plan-preview" />
      <Stack.Screen name="workout" />
      <Stack.Screen name="bmi" />
      <Stack.Screen name="exercise/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <ErrorBoundary>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </ErrorBoundary>
      </AppProvider>
    </SafeAreaProvider>
  );
}
