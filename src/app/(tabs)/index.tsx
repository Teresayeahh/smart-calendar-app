import { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  getTimeBlocksForDate,
  updateTimeBlock,
  insertTimeBlocks,
  getTask,
  getHabit,
  type TimeBlock,
} from '../../db/queries';
import { useAppStore } from '../../lib/store';
import { findNextSlot } from '../../lib/scheduler';
import {
  cancelBlockReminder,
  sendPostponeNotification,
} from '../../lib/notifications';

const BLUE = '#208AEF';
const GREEN = '#34C759';
const ORANGE = '#FF9500';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatChineseDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  return `${y}年${m}月${d}日 周${days[dow]}`;
}

function statusLabel(status: TimeBlock['status']) {
  switch (status) {
    case 'pending': return '待执行';
    case 'done': return '已完成';
    case 'postponed': return '已顺延';
  }
}

function statusColor(status: TimeBlock['status']) {
  switch (status) {
    case 'pending': return BLUE;
    case 'done': return GREEN;
    case 'postponed': return ORANGE;
  }
}

export default function TodayScreen() {
  const db = useSQLiteContext();
  const { state, dispatch } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);

  async function loadBlocks() {
    const blocks = await getTimeBlocksForDate(db, todayStr());
    dispatch({ type: 'SET_TODAY_BLOCKS', blocks });
  }

  useFocusEffect(
    useCallback(() => {
      loadBlocks();
    }, [db])
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadBlocks();
    setRefreshing(false);
  }

  async function markDone(block: TimeBlock) {
    if (block.notificationId) {
      await cancelBlockReminder(block.notificationId);
    }
    await updateTimeBlock(db, block.id, { status: 'done' });
    dispatch({ type: 'UPDATE_BLOCK', block: { ...block, status: 'done' } });
  }

  async function postponeBlock(block: TimeBlock) {
    const slot = findNextSlot(
      block,
      state.phases,
      state.dayOverrides,
      state.todayBlocks,
      todayStr()
    );
    if (!slot) {
      Alert.alert('无法顺延', '未来 30 天内找不到合适的空闲时段');
      return;
    }

    if (block.notificationId) {
      await cancelBlockReminder(block.notificationId);
    }

    await updateTimeBlock(db, block.id, { status: 'postponed' });
    dispatch({ type: 'UPDATE_BLOCK', block: { ...block, status: 'postponed' } });

    await insertTimeBlocks(db, [
      {
        sourceId: block.sourceId,
        sourceType: block.sourceType,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: 'pending',
      },
    ]);

    let name = '任务';
    if (block.sourceType === 'task') {
      const t = await getTask(db, block.sourceId);
      if (t) name = t.name;
    } else {
      const h = await getHabit(db, block.sourceId);
      if (h) name = h.name;
    }

    await sendPostponeNotification(name, slot.date, slot.startTime);
    Alert.alert('已顺延', `已顺延至 ${slot.date} ${slot.startTime}`);
  }

  function isCurrentBlock(block: TimeBlock) {
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    if (block.date !== todayISO) return false;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = block.startTime.split(':').map(Number);
    const [eh, em] = block.endTime.split(':').map(Number);
    return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em;
  }

  const blocks = state.todayBlocks;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.dateText}>{formatChineseDate(todayStr())}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/task/new')}
        >
          <Text style={styles.addBtnText}>+ 新任务</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {blocks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={styles.emptyTitle}>今天没有安排</Text>
            <Text style={styles.emptyText}>下拉刷新，或添加新任务</Text>
          </View>
        ) : (
          blocks.map(block => (
            <BlockCard
              key={block.id}
              block={block}
              isCurrent={isCurrentBlock(block)}
              onDone={() => markDone(block)}
              onPostpone={() => postponeBlock(block)}
            />
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function BlockCard({
  block,
  isCurrent,
  onDone,
  onPostpone,
}: {
  block: TimeBlock;
  isCurrent: boolean;
  onDone: () => void;
  onPostpone: () => void;
}) {
  const db = useSQLiteContext();
  const color = statusColor(block.status);
  const isDone = block.status === 'done';
  const isPostponed = block.status === 'postponed';
  const [sourceName, setSourceName] = useState('…');

  useEffect(() => {
    async function load() {
      if (block.sourceType === 'task') {
        const t = await getTask(db, block.sourceId);
        setSourceName(t?.name ?? '未知任务');
      } else {
        const h = await getHabit(db, block.sourceId);
        setSourceName(h?.name ?? '未知习惯');
      }
    }
    load();
  }, [block.sourceId, block.sourceType]);

  return (
    <View style={[styles.card, isCurrent && styles.cardCurrent]}>
      <View style={[styles.cardAccent, { backgroundColor: color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTime}>
            {block.startTime} – {block.endTime}
          </Text>
          <View style={[styles.badge, { backgroundColor: color + '22' }]}>
            <Text style={[styles.badgeText, { color }]}>{statusLabel(block.status)}</Text>
          </View>
        </View>
        <Text style={[styles.cardName, isDone && styles.strikethrough]}>{sourceName}</Text>
        <Text style={styles.cardType}>{block.sourceType === 'habit' ? '循环习惯' : '项目任务'}</Text>

        {!isDone && !isPostponed && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: GREEN + '22' }]}
              onPress={onDone}
            >
              <Text style={[styles.actionText, { color: GREEN }]}>✓ 完成</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: ORANGE + '22' }]}
              onPress={onPostpone}
            >
              <Text style={[styles.actionText, { color: ORANGE }]}>↷ 顺延</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  dateText: { fontSize: 17, fontWeight: '600', color: '#111' },
  addBtn: { backgroundColor: BLUE, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  scroll: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#111', marginBottom: 8 },
  emptyText: { fontSize: 15, color: '#888' },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: 'hidden',
  },
  cardCurrent: { borderWidth: 2, borderColor: BLUE },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTime: { fontSize: 13, color: '#666' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  cardName: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 2 },
  cardType: { fontSize: 12, color: '#BBB', marginBottom: 8 },
  strikethrough: { textDecorationLine: 'line-through', color: '#AAA' },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  actionText: { fontSize: 13, fontWeight: '600' },
});
