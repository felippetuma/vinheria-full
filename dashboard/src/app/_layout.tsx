import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ColorValue } from 'react-native';
import { AppProvider } from '../lib/AppProvider';
import { colors } from '../lib/theme';

const icon =
  (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: ColorValue; size: number }) =>
    <Ionicons name={name} size={size} color={color as string} />;

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bg },
          tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.muted,
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: icon('stats-chart-outline') }} />
        <Tabs.Screen name="devices" options={{ title: 'Dispositivos', tabBarIcon: icon('hardware-chip-outline') }} />
        <Tabs.Screen name="triggers" options={{ title: 'Triggers', tabBarIcon: icon('options-outline') }} />
        <Tabs.Screen name="settings" options={{ title: 'Config', tabBarIcon: icon('settings-outline') }} />
      </Tabs>
    </AppProvider>
  );
}