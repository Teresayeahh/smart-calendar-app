import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Tabs, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Text } from 'react-native';

import {
  getPhases,
  getTasks,
  getHabits,
  getTimeBlocksForDate,
  getDayOverrides,
} from '../../db/queries';
import { useAppStore } from '../../lib/store';
import { requestNotificationPermissions } from '../../lib/notifications';
import { localDateStr } from '../../lib/dateUtils';

const BLUE = '#208AEF';
const PURPLE = '#AF52DE';

export default function TabsLayout() {
  const db = useSQLiteContext();
  const { state, dispatch } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      try {
        const phases = await getPhases(db);

        if (phases.length === 0) {
          // First launch — go to onboarding
          router.replace('/onboarding');
          return;
        }

        const [tasks, habits, blocks, overrides] = await Promise.all([
          getTasks(db, 'active'),
          getHabits(db, 'active'),
          getTimeBlocksForDate(db, localDateStr()),
          getDayOverrides(db),
        ]);

        dispatch({ type: 'SET_PHASES', phases });
        dispatch({ type: 'SET_TASKS', tasks });
        dispatch({ type: 'SET_HABITS', habits });
        dispatch({ type: 'SET_TODAY_BLOCKS', blocks });
        dispatch({ type: 'SET_DAY_OVERRIDES', overrides });
        dispatch({ type: 'SET_ONBOARDED', value: true });

        await requestNotificationPermissions();
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, [db]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#208AEF' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BLUE,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: { borderTopColor: '#EEE' },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '今日',
          tabBarLabel: '今日',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>📅</Text>,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: '任务',
          tabBarLabel: '任务',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>✅</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          tabBarLabel: '设置',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>⚙️</Text>,
        }}
      />
      <Tabs.Screen
        name="week"
        options={{ href: null }}
      />
    </Tabs>
  );
}
