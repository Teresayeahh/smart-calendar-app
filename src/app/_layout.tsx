import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { initDatabase } from '../db/database';
import { AppProvider } from '../lib/store';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="calendar.db" onInit={initDatabase}>
      <AppProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="task/new"
            options={{ headerShown: true, title: '新建任务', presentation: 'modal' }}
          />

          <Stack.Screen
            name="task/[id]"
            options={{ headerShown: true, title: '任务详情' }}
          />
          <Stack.Screen
            name="subtask/new"
            options={{ headerShown: true, title: '添加子任务', presentation: 'modal' }}
          />
          <Stack.Screen
            name="subtask/[id]"
            options={{ headerShown: true, title: '编辑子任务', presentation: 'modal' }}
          />
          <Stack.Screen
            name="habit/new"
            options={{ headerShown: true, title: '新建习惯', presentation: 'modal' }}
          />
          <Stack.Screen
            name="habit/[id]"
            options={{ headerShown: true, title: '编辑习惯', presentation: 'modal' }}
          />
          <Stack.Screen
            name="schedule-preview"
            options={{ headerShown: true, title: '排程预览', presentation: 'modal' }}
          />
        </Stack>
      </AppProvider>
    </SQLiteProvider>
  );
}
