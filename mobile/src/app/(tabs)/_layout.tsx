import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { AuthRouteGuard } from '@/features/auth/components/auth-route-guard';
import { useColorScheme } from '@/hooks/use-color-scheme';

type TabIconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ color, focused, name }: { color: string; focused: boolean; name: TabIconName }) {
  return <Ionicons name={focused ? name : (`${String(name)}-outline` as TabIconName)} size={23} color={color} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  return (
    <AuthRouteGuard>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: palette.tint,
          tabBarInactiveTintColor: palette.tabIconDefault,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: {
            backgroundColor: palette.surface,
            borderTopColor: palette.border,
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Trang chủ',
            tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="home" />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Lịch sử',
            tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="time" />,
          }}
        />
        <Tabs.Screen
          name="bills"
          options={{
            title: 'Hóa đơn',
            tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="receipt" />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Tài khoản',
            tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="person" />,
          }}
        />
        <Tabs.Screen name="home" options={{ href: null }} />
        <Tabs.Screen name="dashboard" options={{ href: null }} />
      </Tabs>
    </AuthRouteGuard>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
