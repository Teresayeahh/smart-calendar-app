import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  insertTimeBlocks,
  deleteTimeBlocksForSource,
  getTimeBlocksForDate,
  getTasks,
  getHabits,
} from '../db/queries';
import { scheduleBlockReminder } from '../lib/notifications';
import { useAppStore } from '../lib/store';
import type { ScheduledBlock } from '../lib/scheduler';

const BLUE = '#208AEF';
const GREEN = '#34C759';
const ORANGE = '#FF9500';
const PURPLE = '#AF52DE';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function SchedulePreviewScreen() {
  const params = useLocalSearchParams<{
    taskId: string;
    taskName: string;
    blocks: string;
    conflict: string;
    conflictMessage: string;
    isHabit?: string;
  }>();

  const db = useSQLiteContext();
  const { dispatch } = useAppStore();

  const isHabit = params.isHabit === '1';
  const hasConflict = params.conflict === '1';
  const blocks: ScheduledBlock[] = JSON.parse(params.blocks ?? '[]');

  const [applying, setApplying] = useState(false);

  // Group by date
  const grouped: Record<string, ScheduledBlock[]> = {};
  for (const b of blocks) {
    if (!grouped[b.date]) grouped[b.date] = [];
    grouped[b.date].push(b);
  }
  const dates = Object.keys(grouped).sort();

  async function handleApply() {
    if (blocks.length === 0) {
      Alert.alert('没有可应用的时间块');
      return;
    }
    setApplying(true);
    try {
      // Delete any existing pending blocks for this source first
      await deleteTimeBlocksForSource(db, params.taskId);

      const inserted = await insertTimeBlocks(db, blocks);

      // Schedule notifications
      for (const block of inserted) {
        const notifId = await scheduleBlockReminder(block, params.taskName);
        if (notifId) {
          const { updateTimeBlock } = await import('../db/queries');
          await updateTimeBlock(db, block.id, { notificationId: notifId });
        }
      }

      // Refresh store
      const today = todayStr();
      const [todayBlocks, tasks, habits] = await Promise.all([
        getTimeBlocksForDate(db, today),
        getTasks(db, 'active'),
        getHabits(db, 'active'),
      ]);
      dispatch({ type: 'SET_TODAY_BLOCKS', blocks: todayBlocks });
      dispatch({ type: 'SET_TASKS', tasks });
      dispatch({ type: 'SET_HABITS', habits });

      Alert.alert('已应用', `成功排入 ${inserted.length} 个时间块`, [
        { text: '好的', onPress: () => router.replace('/(tabs)') },
      ]);
    } finally {
      setApplying(false);
    }
  }

  async function handleDiscard() {
    // Delete the task/habit that was already created
    Alert.alert('取消排程', '确定放弃？已创建的任务也将被删除。', [
      { text: '继续编辑', style: 'cancel' },
      {
        text: '放弃',
        style: 'destructive',
        onPress: async () => {
          if (isHabit) {
            const { deleteHabit } = await import('../db/queries');
            await deleteHabit(db, params.taskId);
          } else {
            const { deleteTask } = await import('../db/queries');
            await deleteTask(db, params.taskId);
          }
          router.replace('/(tabs)/tasks');
        },
      },
    ]);
  }

  const accentColor = isHabit ? PURPLE : BLUE;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.taskName}>{params.taskName}</Text>
        <Text style={styles.subtitle}>
          {isHabit ? '习惯' : '任务'} · 共 {blocks.length} 个时间块
        </Text>

        {hasConflict && (
          <View style={styles.conflictBanner}>
            <Text style={styles.conflictTitle}>⚠️ 注意</Text>
            <Text style={styles.conflictText}>{params.conflictMessage}</Text>
          </View>
        )}

        {dates.map(date => (
          <View key={date} style={styles.dateGroup}>
            <Text style={styles.dateLabel}>{date}</Text>
            {grouped[date].map((b, i) => (
              <View key={i} style={[styles.blockRow, { borderLeftColor: accentColor }]}>
                <Text style={styles.blockTime}>{b.startTime} – {b.endTime}</Text>
                <View style={[styles.badge, { backgroundColor: accentColor + '20' }]}>
                  <Text style={[styles.badgeText, { color: accentColor }]}>
                    {isHabit ? '习惯' : '任务'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        {blocks.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>没有可排的时间块</Text>
            <Text style={styles.emptyHint}>请检查时间阶段设置或调整截止日期</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.discardBtn} onPress={handleDiscard}>
          <Text style={styles.discardText}>放弃</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.applyBtn, { backgroundColor: accentColor }, applying && styles.btnDisabled]}
          onPress={handleApply}
          disabled={applying || blocks.length === 0}
        >
          <Text style={styles.applyText}>{applying ? '应用中…' : '✓ 应用排程'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  scroll: { flex: 1 },
  content: { padding: 20 },
  taskName: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 20 },
  conflictBanner: {
    backgroundColor: '#FFF3CD',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: ORANGE,
  },
  conflictTitle: { fontSize: 14, fontWeight: '700', color: '#856404', marginBottom: 4 },
  conflictText: { fontSize: 13, color: '#856404', lineHeight: 18 },
  dateGroup: { marginBottom: 16 },
  dateLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  blockRow: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
  },
  blockTime: { fontSize: 15, fontWeight: '500', color: '#111' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  empty: { paddingTop: 40, alignItems: 'center' },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#555', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#999' },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDD',
    paddingBottom: 32,
  },
  discardBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  discardText: { fontSize: 15, color: '#666', fontWeight: '500' },
  applyBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
});
