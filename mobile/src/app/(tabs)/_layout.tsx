import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';

import { T } from '../../theme';
import { IconName } from '../../ui';

const icon = (name: IconName) => ({ focused, size }: { focused: boolean; size: number }) => (
  <MaterialCommunityIcons name={name} size={size} color={focused ? T.text : T.faint} />
);

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: T.text, tabBarInactiveTintColor: T.faint,
      tabBarStyle: T.tabBar, tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
    }}>
      <Tabs.Screen name="drive" options={{ title: 'Drive', tabBarIcon: icon('steering') }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips', tabBarIcon: icon('map-marker-path') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('chart-line') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('account-circle-outline') }} />
    </Tabs>
  );
}
