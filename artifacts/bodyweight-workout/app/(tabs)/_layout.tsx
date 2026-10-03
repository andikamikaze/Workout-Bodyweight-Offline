import React from 'react';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: 62,
          paddingTop: 6,
          paddingBottom: 6,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          tabBarIcon: ({ color }) =>
            <Feather name="home" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Rencana',
          tabBarIcon: ({ color }) => <Feather name="target" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Latihan',
          tabBarIcon: ({ color }) => <Feather name="book-open" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color }) => <Feather name="trending-up" size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Atur',
          tabBarIcon: ({ color }) => <Feather name="sliders" size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}
