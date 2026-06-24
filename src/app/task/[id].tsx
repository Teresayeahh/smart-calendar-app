import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  getTask,
  updateTask,
  getTasks,
  deleteTimeBlocksForSource,
  getPendingTimeBlocks,
  getPhases,
  getDayOverrides,
  type Task,
} from '../../db/queries';
import { scheduleTask } from '../../lib/scheduler';
import { useAppStore } from '../../lib/store';

const BLUE = '#208AEF';

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { dispatch } = useAppStore();

  const [task, setTask] = useState<Task | null>(null);
  const [name, setName] = useState('');
  const [totalDuration, setTotalDuration] = useState('');
  const [blockDuration, setBlockDuration] = useState('');
  const [deadline, setDeadline] = useState('');
  const [hasDeadline, setHasDeadline] = useState(true);

  useEffect(() => {
    async function load() {
      const t = await getTask(db, id);
      if (!t) return;
      setTask(t);
      setName(t.name);
      setTotalDuration(t.totalDuration ? String(t.totalDuration) : '');
      setBlockDuration(t.blockDuration ? String(t.blockDuration) : '');
      setDeadline(t.deadline ?? '');
      setHasDeadline(!!t.deadline);
    }
    load();
  }, [id]);

  async function handleSave() {
    if (!name.trim()) { Alert.alert('请输入任务名称'); return; }
    const total = parseInt(totalDuration);
    const block = parseInt(blockDuration);
    if (isNaN(total) || total <= 0) { Alert.alert('请输入有效的总时长'); return; }
    if (isNaN(block) || block <= 0) { Alert.alert('请输入有效的每块时长'); return; }
    if (hasDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      Alert.alert('日期格式错误', '请使用 YYYY-MM-DD 格式');
      return;
    }

    await updateTask(db, id, {
      name: name.trim(),
      totalDuration: total,
      blockDuration: block,
      deadline: hasDeadline ? deadline : null,
    });

    // Delete existing pending blocks and reschedule
    await deleteTimeBlocksForSource(db, id);

    if (hasDeadline && deadline) {
      const today = new Date().toISOString().slice(0, 10);
      const updatedTask = await getTask(db, id);
      if (updatedTask) {
        const [phases, overrides, existingBlocks] = await Promise.all([
          getPhases(db),
          getDayOverrides(db),
          getPendingTimeBlocks(db, today),
        ]);
        const result = scheduleTask(updatedTask, phases, overrides, existingBlocks, today);

        router.replace({
          pathname: '/schedule-preview',
          params: {
            taskId: id,
            taskName: name.trim(),
            blocks: JSON.stringify(result.blocks),
            conflict: result.conflict ? '1' : '0',
            conflictMessage: result.conflictMessage ?? '',
          },
        });
        return;
      }
    }

    const tasks = await getTasks(db, 'active');
    dispatch({ type: 'SET_TASKS', tasks });
    router.back();
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
      <Field label="任务名称 *">
        <TextInput style={styles.input} value={name} onChangeText={setName} />
      </Field>
      <Field label="总时长（分钟）*">
        <TextInput style={styles.input} value={totalDuration} onChangeText={setTotalDuration} keyboardType="number-pad" />
      </Field>
      <Field label="每块时长（分钟）*">
        <TextInput style={styles.input} value={blockDuration} onChangeText={setBlockDuration} keyboardType="number-pad" />
        {totalDuration && blockDuration && (
          <Text style={styles.hint}>需要 {Math.ceil(parseInt(totalDuration) / parseInt(blockDuration))} 个时间块</Text>
        )}
      </Field>
      <View style={styles.switchRow}>
        <Text style={styles.label}>有截止日期</Text>
        <Switch value={hasDeadline} onValueChange={setHasDeadline} trackColor={{ true: BLUE }} />
      </View>
      {hasDeadline && (
        <Field label="截止日期">
          <TextInput style={styles.input} value={deadline} onChangeText={setDeadline} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        </Field>
      )}
      <TouchableOpacity style={styles.btn} onPress={handleSave}>
        <Text style={styles.btnText}>保存并重新排程</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, color: '#333', fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111', backgroundColor: '#FAFAFA' },
  hint: { marginTop: 4, fontSize: 12, color: '#888' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  btn: { backgroundColor: BLUE, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
