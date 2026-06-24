import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  getTask,
  getHabit,
  getPhases,
  getDayOverrides,
  getPendingTimeBlocks,
  insertTimeBlocks,
  deleteTimeBlocksForSource,
  getTimeBlocksForDate,
  getTasks,
  getHabits,
  updateTimeBlock,
} from '../db/queries';
import {
  scheduleTask,
  scheduleHabit,
  type ScheduledBlock,
} from '../lib/scheduler';
import { scheduleBlockReminder } from '../lib/notifications';
import { useAppStore } from '../lib/store';
import { localDateStr } from '../lib/dateUtils';

const BLUE = '#208AEF';
const ORANGE = '#FF9500';
const PURPLE = '#AF52DE';

export default function SchedulePreviewScreen() {
  const { taskId, isHabit: isHabitParam } = useLocalSearchParams<{
    taskId: string;
    isHabit?: string;
  }>();

  const db = useSQLiteContext();
  const { dispatch } = useAppStore();

  const isHabit = isHabitParam === '1';
  const accentColor = isHabit ? PURPLE : BLUE;

  const [loading, setLoading] = useState(true);
  const [sourceName, setSourceName] = useState('');
  const [blocks, setBlocks] = useState<ScheduledBlock[]>([]);
  const [conflict, setConflict] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    async function runScheduler() {
      try {
        const today = localDateStr();
        const [phases, overrides, existingBlocks] = await Promise.all([
          getPhases(db),
          getDayOverrides(db),
          getPendingTimeBlocks(db, today),
        ]);

        if (phases.length === 0) {
          setConflict(true);
          setConflictMessage('未找到时间阶段配置，请先在「设置」里添加时间阶段。');
          setLoading(false);
          return;
        }

        if (isHabit) {
          const habit = await getHabit(db, taskId);
          if (!habit) { setConflict(true); setConflictMessage('习惯不存在'); setLoading(false); return; }
          setSourceName(habit.name);
          const result = scheduleHabit(habit, phases, overrides, existingBlocks, today);
          setBlocks(result.blocks);
          setConflict(result.conflict);
          setConflictMessage(result.conflictMessage ?? '');
        } else {
          const task = await getTask(db, taskId);
          if (!task) { setConflict(true); setConflictMessage('任务不存在'); setLoading(false); return; }
          setSourceName(task.name);
          if (!task.deadline) {
            const tasks = await getTasks(db, 'active');
            dispatch({ type: 'SET_TASKS', tasks });
            router.replace('/(tabs)/tasks');
            return;
          }
          const result = scheduleTask(task, phases, overrides, existingBlocks, today);
          setBlocks(result.blocks);
          setConflict(result.conflict);
          setConflictMessage(result.conflictMessage ?? '');
        }
      } finally {
        setLoading(false);
      }
    }
    runScheduler();
  }, [taskId]);

  // Group blocks by date
  const grouped: Record<string, ScheduledBlock[]> = {};
  for (const b of blocks) {
    if (!grouped[b.date]) grouped[b.date] = [];
    grouped[b.date].push(b);
  }
  const dates = Object.keys(grouped).sort();
  const outsideCount = blocks.filter(b => b.outsidePreference).length;

  async function handleApply() {
    if (blocks.length === 0) {
      Alert.alert('没有可应用的时间块');
      return;
    }
    setApplying(true);
    try {
      await deleteTimeBlocksForSource(db, taskId);
      const inserted = await insertTimeBlocks(db, blocks);

      for (const block of inserted) {
        const notifId = await scheduleBlockReminder(block, sourceName);
        if (notifId) {
          await updateTimeBlock(db, block.id, { notificationId: notifId });
        }
      }

      const today = localDateStr();
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={styles.loadingText}>正在计算排程…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.taskName}>{sourceName}</Text>
        <Text style={styles.subtitle}>
          {isHabit ? '习惯' : '任务'} · 共 {blocks.length} 个时间块
        </Text>

        {conflict && (
          <View style={styles.conflictBanner}>
            <Text style={styles.conflictTitle}>⚠️ 注意</Text>
            <Text style={styles.conflictText}>{conflictMessage}</Text>
          </View>
        )}

        {outsideCount > 0 && (
          <View style={styles.outsideBanner}>
            <Text style={styles.outsideText}>
              浅红色时间块（{outsideCount} 个）超出偏好时间范围，已自动安排在其他空闲时段
            </Text>
          </View>
        )}

        {blocks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>没有可排的时间块</Text>
            <Text style={styles.emptyHint}>
              请检查：{'\n'}
              • 设置里是否有时间阶段{'\n'}
              • 截止日期是否在今天之后{'\n'}
              • 每块时长是否超过每日可用时间
            </Text>
          </View>
        ) : (
          dates.map(date => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateLabel}>{date}</Text>
              {grouped[date].map((b, i) => (
                <View
                  key={i}
                  style={[
                    styles.blockRow,
                    { borderLeftColor: accentColor },
                    b.outsidePreference && styles.blockRowOutside,
                  ]}
                >
                  <Text style={styles.blockTime}>{b.startTime} – {b.endTime}</Text>
                  <View style={styles.badgeRow}>
                    {b.outsidePreference && (
                      <View style={styles.outsideBadge}>
                        <Text style={styles.outsideBadgeText}>偏好外</Text>
                      </View>
                    )}
                    <View style={[styles.badge, { backgroundColor: accentColor + '20' }]}>
                      <Text style={[styles.badgeText, { color: accentColor }]}>
                        {isHabit ? '习惯' : '任务'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>返回修改</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.applyBtn,
            { backgroundColor: accentColor },
            (applying || blocks.length === 0) && styles.btnDisabled,
          ]}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },
  scroll: { flex: 1 },
  content: { padding: 20 },
  taskName: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 20 },
  conflictBanner: {
    backgroundColor: '#FFF3CD',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: ORANGE,
  },
  conflictTitle: { fontSize: 14, fontWeight: '700', color: '#856404', marginBottom: 4 },
  conflictText: { fontSize: 13, color: '#856404', lineHeight: 20 },
  outsideBanner: {
    backgroundColor: '#FFEEEE',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  outsideText: { fontSize: 13, color: '#C0392B', lineHeight: 18 },
  dateGroup: { marginBottom: 16 },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
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
  blockRowOutside: {
    backgroundColor: '#FFEEEE',
  },
  blockTime: { fontSize: 15, fontWeight: '500', color: '#111' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  outsideBadge: {
    backgroundColor: '#FFD0D0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  outsideBadgeText: { fontSize: 12, fontWeight: '600', color: '#C0392B' },
  empty: { paddingTop: 32, alignItems: 'flex-start' },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#555', marginBottom: 12 },
  emptyHint: { fontSize: 14, color: '#999', lineHeight: 22 },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDD',
    paddingBottom: 32,
  },
  backBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backText: { fontSize: 15, color: '#666', fontWeight: '500' },
  applyBtn: { flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  applyText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
});
