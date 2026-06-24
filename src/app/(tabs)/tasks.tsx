import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  getParentTasks,
  getHabits,
  deleteTask,
  deleteHabit,
  deleteTimeBlocksForSource,
  getChildTasks,
  type Task,
  type Habit,
} from '../../db/queries';
import { useAppStore } from '../../lib/store';

const BLUE = '#208AEF';
const RED = '#FF3B30';
const PURPLE = '#AF52DE';
const GRAY = '#8E8E93';

export default function ArrangeScreen() {
  const db = useSQLiteContext();
  const { dispatch } = useAppStore();
  const [tab, setTab] = useState<'tasks' | 'habits'>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const [t, h] = await Promise.all([
          getParentTasks(db, 'active'),
          getHabits(db, 'active'),
        ]);
        setTasks(t);
        setHabits(h);
        dispatch({ type: 'SET_HABITS', habits: h });
      }
      load();
    }, [db])
  );

  async function handleDeleteTask(task: Task) {
    Alert.alert(
      '删除任务',
      `确定要删除「${task.name}」及所有子任务？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            const children = await getChildTasks(db, task.id);
            for (const c of children) {
              await deleteTimeBlocksForSource(db, c.id);
              await deleteTask(db, c.id);
            }
            await deleteTimeBlocksForSource(db, task.id);
            await deleteTask(db, task.id);
            setTasks(prev => prev.filter(t => t.id !== task.id));
            dispatch({ type: 'REMOVE_TASK', id: task.id });
          },
        },
      ]
    );
  }

  async function handleDeleteHabit(habit: Habit) {
    Alert.alert(
      '删除习惯',
      `确定要删除「${habit.name}」？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await deleteTimeBlocksForSource(db, habit.id);
            await deleteHabit(db, habit.id);
            setHabits(prev => prev.filter(h => h.id !== habit.id));
            dispatch({ type: 'REMOVE_HABIT', id: habit.id });
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>安排</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/task/new')}
          >
            <Text style={styles.addBtnText}>+ 任务</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: PURPLE }]}
            onPress={() => router.push('/habit/new')}
          >
            <Text style={styles.addBtnText}>+ 习惯</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'tasks' && styles.tabActive]}
          onPress={() => setTab('tasks')}
        >
          <Text style={[styles.tabText, tab === 'tasks' && styles.tabTextActive]}>
            任务 ({tasks.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'habits' && styles.tabActive]}
          onPress={() => setTab('habits')}
        >
          <Text style={[styles.tabText, tab === 'habits' && styles.tabTextActive]}>
            习惯 ({habits.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>
        {tab === 'tasks' ? (
          tasks.length === 0 ? (
            <Empty text="暂无任务，点击右上角添加" />
          ) : (
            tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onPress={() => router.push(`/task/${task.id}`)}
                onDelete={() => handleDeleteTask(task)}
              />
            ))
          )
        ) : habits.length === 0 ? (
          <Empty text="暂无习惯，点击右上角添加" />
        ) : (
          habits.map(habit => (
            <HabitRow
              key={habit.id}
              habit={habit}
              onEdit={() => router.push(`/habit/${habit.id}`)}
              onDelete={() => handleDeleteHabit(habit)}
            />
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function TaskRow({
  task,
  onPress,
  onDelete,
}: {
  task: Task;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.cardAccent, { backgroundColor: BLUE }]} />
      <View style={styles.cardMain}>
        <Text style={styles.cardName}>{task.name}</Text>
        <View style={styles.meta}>
          {task.deadline && (
            <MetaTag icon="📅" text={`截止 ${task.deadline}`} />
          )}
          <MetaTag icon="›" text="查看子任务" color={GRAY} />
        </View>
      </View>
      <TouchableOpacity
        style={[styles.iconBtn, { backgroundColor: RED + '15' }]}
        onPress={onDelete}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.iconBtnText, { color: RED }]}>删除</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function HabitRow({
  habit,
  onEdit,
  onDelete,
}: {
  habit: Habit;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: PURPLE }]} />
      <View style={styles.cardMain}>
        <Text style={styles.cardName}>{habit.name}</Text>
        <View style={styles.meta}>
          <MetaTag icon="🔄" text={`${habit.timesPerWeek} 次/周`} />
          <MetaTag icon="⏱" text={`${habit.durationPerSession} 分钟/次`} />
          <MetaTag icon="📅" text={`至 ${habit.cycleEnd}`} />
        </View>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.iconBtn} onPress={onEdit}>
          <Text style={styles.iconBtnText}>编辑</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: RED + '15' }]} onPress={onDelete}>
          <Text style={[styles.iconBtnText, { color: RED }]}>删除</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MetaTag({ icon, text, color }: { icon: string; text: string; color?: string }) {
  return (
    <View style={styles.metaTag}>
      <Text style={[styles.metaText, color ? { color } : {}]}>{icon} {text}</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
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
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#111' },
  headerActions: { flexDirection: 'row', gap: 8 },
  addBtn: { backgroundColor: BLUE, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F3',
  },
  tabActive: { backgroundColor: BLUE },
  tabText: { fontSize: 14, color: '#666', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardAccent: { width: 4, position: 'absolute', left: 0, top: 0, bottom: 0 },
  cardMain: { flex: 1, paddingLeft: 8 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 6 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaTag: { backgroundColor: '#F0F0F3', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  metaText: { fontSize: 12, color: '#555' },
  cardActions: { flexDirection: 'row', gap: 6 },
  iconBtn: { backgroundColor: BLUE + '15', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  iconBtnText: { fontSize: 13, color: BLUE, fontWeight: '500' },
  empty: { paddingTop: 60, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#999' },
});
