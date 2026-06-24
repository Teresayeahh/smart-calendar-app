import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  getTask,
  updateTask,
  getChildTasks,
  deleteTask,
  deleteTimeBlocksForSource,
  type Task,
} from '../../db/queries';
import { useAppStore } from '../../lib/store';
import { DatePickerInput } from '../../components/DatePickerInput';
import { localDateStr } from '../../lib/dateUtils';

const BLUE = '#208AEF';
const RED = '#FF3B30';
const GREEN = '#34C759';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { dispatch } = useAppStore();

  const [task, setTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDeadline, setEditDeadline] = useState('');

  async function load() {
    const t = await getTask(db, id);
    if (!t) return;
    setTask(t);
    setEditName(t.name);
    setEditDeadline(t.deadline ?? '');
    const children = await getChildTasks(db, id);
    setSubtasks(children);
  }

  useFocusEffect(useCallback(() => { load(); }, [id]));

  async function handleSaveEdit() {
    if (!editName.trim()) { Alert.alert('请输入任务名称'); return; }
    if (!editDeadline) { Alert.alert('请选择截止日期'); return; }
    await updateTask(db, id, { name: editName.trim(), deadline: editDeadline });
    setEditing(false);
    load();
  }

  async function handleDeleteTask() {
    Alert.alert('删除任务', `确定删除「${task?.name}」及所有子任务？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          for (const s of subtasks) {
            await deleteTimeBlocksForSource(db, s.id);
            await deleteTask(db, s.id);
          }
          await deleteTimeBlocksForSource(db, id);
          await deleteTask(db, id);
          dispatch({ type: 'REMOVE_TASK', id });
          router.back();
        },
      },
    ]);
  }

  async function handleDeleteSubtask(sub: Task) {
    Alert.alert('删除子任务', `确定删除「${sub.name}」？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteTimeBlocksForSource(db, sub.id);
          await deleteTask(db, sub.id);
          setSubtasks(prev => prev.filter(s => s.id !== sub.id));
        },
      },
    ]);
  }

  if (!task) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>加载中…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Task card */}
      <View style={styles.taskCard}>
        {editing ? (
          <>
            <Text style={styles.sectionLabel}>任务名称</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              autoFocus
            />
            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>截止日期</Text>
            <DatePickerInput
              value={editDeadline}
              onChange={setEditDeadline}
              minDate={localDateStr()}
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.editBtn, { backgroundColor: '#EEE' }]}
                onPress={() => { setEditing(false); setEditName(task.name); setEditDeadline(task.deadline ?? ''); }}
              >
                <Text style={styles.editBtnText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: BLUE }]} onPress={handleSaveEdit}>
                <Text style={[styles.editBtnText, { color: '#fff' }]}>保存</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.taskHeader}>
              <Text style={styles.taskName}>{task.name}</Text>
              <View style={styles.taskActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => setEditing(true)}>
                  <Text style={styles.iconBtnText}>编辑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: RED + '15' }]}
                  onPress={handleDeleteTask}
                >
                  <Text style={[styles.iconBtnText, { color: RED }]}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
            {task.deadline && (
              <View style={styles.deadlineRow}>
                <Text style={styles.deadlineLabel}>截止日期</Text>
                <Text style={styles.deadlineValue}>{task.deadline}</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Subtasks */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>子任务 ({subtasks.length})</Text>
          <TouchableOpacity
            style={styles.addSubBtn}
            onPress={() => router.push({ pathname: '/subtask/new', params: { parentId: id } })}
          >
            <Text style={styles.addSubBtnText}>+ 添加子任务</Text>
          </TouchableOpacity>
        </View>

        {subtasks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无子任务</Text>
            <Text style={styles.emptyHint}>添加子任务后系统会自动排程</Text>
          </View>
        ) : (
          subtasks.map(sub => (
            <SubtaskCard
              key={sub.id}
              subtask={sub}
              onDelete={() => handleDeleteSubtask(sub)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function SubtaskCard({
  subtask,
  onDelete,
}: {
  subtask: Task;
  onDelete: () => void;
}) {
  const blocks = subtask.totalDuration && subtask.blockDuration
    ? Math.ceil(subtask.totalDuration / subtask.blockDuration)
    : null;

  return (
    <View style={styles.subCard}>
      <View style={[styles.subAccent, { backgroundColor: BLUE }]} />
      <View style={styles.subMain}>
        <Text style={styles.subName}>{subtask.name}</Text>
        <View style={styles.subMeta}>
          {subtask.totalDuration && (
            <Text style={styles.subMetaText}>⏱ {subtask.totalDuration} 分钟</Text>
          )}
          {blocks && (
            <Text style={styles.subMetaText}>🧩 {blocks} 块</Text>
          )}
          {subtask.deadline && (
            <Text style={styles.subMetaText}>📅 截止 {subtask.deadline}</Text>
          )}
        </View>
      </View>
      <TouchableOpacity onPress={onDelete} style={styles.subDelete}>
        <Text style={{ color: RED, fontSize: 15 }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  content: { padding: 16, paddingBottom: 60 },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  taskName: { flex: 1, fontSize: 20, fontWeight: '700', color: '#111', marginRight: 12 },
  taskActions: { flexDirection: 'row', gap: 6 },
  iconBtn: { backgroundColor: BLUE + '15', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  iconBtnText: { fontSize: 13, color: BLUE, fontWeight: '500' },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  deadlineLabel: { fontSize: 13, color: '#999' },
  deadlineValue: { fontSize: 14, color: '#333', fontWeight: '500' },
  sectionLabel: { fontSize: 13, color: '#666', marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#FAFAFA',
  },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  editBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  editBtnText: { fontSize: 14, fontWeight: '600', color: '#555' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  addSubBtn: { backgroundColor: BLUE, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addSubBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  empty: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#999', marginBottom: 4 },
  emptyHint: { fontSize: 13, color: '#BBB' },
  subCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F8F8FA',
    marginBottom: 8,
    overflow: 'hidden',
  },
  subAccent: { width: 3, alignSelf: 'stretch' },
  subMain: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  subName: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 4 },
  subMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  subMetaText: { fontSize: 12, color: '#666' },
  subDelete: { padding: 12 },
});
