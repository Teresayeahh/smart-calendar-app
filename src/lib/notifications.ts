import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { TimeBlock } from '../db/queries';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowAlert: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '日程提醒',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#208AEF',
    });
  }
  const { status } = await Notifications.requestPermissionsAsync({
    android: { allowAlerts: true, allowBadges: true, allowSounds: true },
  });
  return status === 'granted';
}

export async function scheduleBlockReminder(
  block: TimeBlock,
  taskName: string
): Promise<string | null> {
  // Parse block start date/time
  const [y, mo, d] = block.date.split('-').map(Number);
  const [h, m] = block.startTime.split(':').map(Number);
  const triggerDate = new Date(y, mo - 1, d, h, m - 5); // 5 minutes before

  if (triggerDate <= new Date()) return null;

  const blockMins =
    Number(block.endTime.split(':')[0]) * 60 +
    Number(block.endTime.split(':')[1]) -
    (Number(block.startTime.split(':')[0]) * 60 + Number(block.startTime.split(':')[1]));

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '即将开始',
        body: `5 分钟后：${taskName}（${blockMins} 分钟）`,
        data: { blockId: block.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelBlockReminder(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function sendPostponeNotification(
  taskName: string,
  newDate: string,
  newTime: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '已顺延',
      body: `${taskName} 已顺延至 ${newDate} ${newTime}`,
    },
    trigger: null,
  });
}

export async function sendHabitExpiryNotification(habitName: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '习惯周期结束',
      body: `「${habitName}」本轮已结束，是否继续下一轮？`,
      data: { habitExpiry: true, habitName },
    },
    trigger: null,
  });
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
