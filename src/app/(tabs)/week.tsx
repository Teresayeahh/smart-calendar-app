import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { getTimeBlocksInRange, getTask, getHabit, type TimeBlock } from '../../db/queries';
import { localDateStr } from '../../lib/dateUtils';

const BLUE = '#208AEF';
const GREEN = '#34C759';
const PURPLE = '#AF52DE';
const GRAY = '#C7C7CC';

const DAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getWeekDates(offset: number = 0): string[] {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow + 1 + offset * 7); // start week on Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return localDateStr(d);
  });
}

function blockColor(type: 'task' | 'habit', status: TimeBlock['status']) {
  if (status === 'done') return GREEN;
  if (status === 'postponed') return GRAY;
  return type === 'habit' ? PURPLE : BLUE;
}

export default function WeekScreen() {
  const db = useSQLiteContext();
  const [weekOffset, setWeekOffset] = useState(0);
  const [blocksByDate, setBlocksByDate] = useState<Record<string, TimeBlock[]>>({});
  const [nameCache, setNameCache] = useState<Record<string, string>>({});

  const weekDates = getWeekDates(weekOffset);
  const today = localDateStr();

  async function load() {
    const from = weekDates[0];
    const to = weekDates[6];
    const blocks = await getTimeBlocksInRange(db, from, to);

    const grouped: Record<string, TimeBlock[]> = {};
    for (const b of blocks) {
      if (!grouped[b.date]) grouped[b.date] = [];
      grouped[b.date].push(b);
    }
    setBlocksByDate(grouped);

    // Resolve names
    const ids = [...new Set(blocks.map(b => b.sourceId))];
    const names: Record<string, string> = { ...nameCache };
    await Promise.all(
      ids
        .filter(id => !names[id])
        .map(async id => {
          const block = blocks.find(b => b.sourceId === id)!;
          if (block.sourceType === 'task') {
            const t = await getTask(db, id);
            names[id] = t?.name ?? '未知任务';
          } else {
            const h = await getHabit(db, id);
            names[id] = h?.name ?? '未知习惯';
          }
        })
    );
    setNameCache(names);
  }

  useFocusEffect(useCallback(() => { load(); }, [weekOffset]));
  useEffect(() => { load(); }, [weekOffset]);

  const weekLabel = (() => {
    const [y, m, d] = weekDates[0].split('-');
    const [, me, de] = weekDates[6].split('-');
    return `${y}年${m}月${d}日 – ${me}月${de}日`;
  })();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ 今日</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>周视图</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Week navigator */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={() => setWeekOffset(v => v - 1)} style={styles.navBtn}>
          <Text style={styles.navText}>‹ 上周</Text>
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        <TouchableOpacity onPress={() => setWeekOffset(v => v + 1)} style={styles.navBtn}>
          <Text style={styles.navText}>下周 ›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {weekDates.map((date, idx) => {
          const isToday = date === today;
          const dayBlocks = (blocksByDate[date] ?? []).sort((a, b) =>
            a.startTime.localeCompare(b.startTime)
          );
          const dayLabel = DAY_LABELS[(idx + 1) % 7];
          const [, , d] = date.split('-');

          return (
            <View key={date} style={[styles.dayRow, isToday && styles.todayRow]}>
              {/* Day label */}
              <View style={styles.dayLabelCol}>
                <Text style={[styles.dayNum, isToday && styles.todayNum]}>{parseInt(d)}</Text>
                <Text style={[styles.dayName, isToday && styles.todayName]}>{dayLabel}</Text>
              </View>

              {/* Blocks */}
              <View style={styles.dayBlocks}>
                {dayBlocks.length === 0 ? (
                  <Text style={styles.emptyDay}>—</Text>
                ) : (
                  dayBlocks.map(b => (
                    <View
                      key={b.id}
                      style={[
                        styles.blockChip,
                        { backgroundColor: blockColor(b.sourceType, b.status) + '20',
                          borderLeftColor: blockColor(b.sourceType, b.status) },
                      ]}
                    >
                      <Text style={[styles.blockChipTime, { color: blockColor(b.sourceType, b.status) }]}>
                        {b.startTime}–{b.endTime}
                      </Text>
                      <Text style={styles.blockChipName} numberOfLines={1}>
                        {nameCache[b.sourceId] ?? '…'}
                      </Text>
                      {b.status !== 'pending' && (
                        <Text style={[styles.blockStatus, { color: blockColor(b.sourceType, b.status) }]}>
                          {b.status === 'done' ? '✓' : '↷'}
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </View>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: BLUE, label: '任务' },
          { color: PURPLE, label: '习惯' },
          { color: GREEN, label: '已完成' },
          { color: GRAY, label: '已顺延' },
        ].map(({ color, label }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  backBtn: { width: 60 },
  backText: { fontSize: 16, color: BLUE },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  navBtn: { paddingHorizontal: 4 },
  navText: { fontSize: 14, color: BLUE, fontWeight: '500' },
  weekLabel: { fontSize: 13, color: '#555', fontWeight: '500' },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8 },
  dayRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EBEBEB',
    backgroundColor: '#fff',
    marginBottom: 2,
  },
  todayRow: { backgroundColor: '#EFF7FF' },
  dayLabelCol: { width: 44, alignItems: 'center', paddingTop: 2 },
  dayNum: { fontSize: 18, fontWeight: '600', color: '#333' },
  dayName: { fontSize: 11, color: '#999', marginTop: 2 },
  todayNum: { color: BLUE },
  todayName: { color: BLUE },
  dayBlocks: { flex: 1, paddingLeft: 12, gap: 6 },
  emptyDay: { fontSize: 14, color: '#CCC', paddingTop: 4 },
  blockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderLeftWidth: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
  },
  blockChipTime: { fontSize: 12, fontWeight: '600', minWidth: 90 },
  blockChipName: { flex: 1, fontSize: 13, color: '#333' },
  blockStatus: { fontSize: 14, fontWeight: '700' },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEE',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: '#666' },
});
