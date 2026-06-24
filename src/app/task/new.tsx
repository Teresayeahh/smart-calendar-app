import { useState } from 'react';
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
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { createTask, getTasks, getPhases, getDayOverrides, getPendingTimeBlocks } from '../../db/queries';
import { scheduleTask } from '../../lib/scheduler';
import { useAppStore } from '../../lib/store';

const BLUE = '#208AEF';

export default function NewTaskScreen() {
  const db = useSQLiteContext();
  const { state, dispatch } = useAppStore();

  const [name, setName] = useState('');
  const [totalDuration, setTotalDuration] = useState('');
  const [blockDuration, setBlockDuration] = useState('60');
  const [deadline, setDeadline] = useState('');
  const [hasDeadline, setHasDeadline] = useState(true);

  async function handlePreview() {
    if (!name.trim()) { Alert.alert('请输入任务名称'); return; }
    const total = parseInt(totalDuration);
    const block = parseInt(blockDuration);
    if (isNaN(total) || total <= 0) { Alert.alert('请输入有效的总时长（分钟）'); return; }
    if (isNaN(block) || block <= 0) { Alert.alert('请输入有效的每块时长（分钟）'); return; }
    if (hasDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      Alert.alert('日期格式错误', '请使用 YYYY-MM-DD 格式');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    // Create task in DB first (needed for scheduling)
    const task = await createTask(db, {
      parentId: null,
      name: name.trim(),
      totalDuration: total,
      blockDuration: block,
      deadline: hasDeadline ? deadline : null,
    });

    const [phases, overrides, existingBlocks] = await Promise.all([
      getPhases(db),
      getDayOverrides(db),
      getPendingTimeBlocks(db, today),
    ]);

    if (!hasDeadline || !task.deadline) {
      // No scheduling needed
      const tasks = await getTasks(db, 'active');
      dispatch({ type: 'SET_TASKS', tasks });
      router.back();
      return;
    }

    const result = scheduleTask(task, phases, overrides, existingBlocks, today);

    router.replace({
      pathname: '/schedule-preview',
      params: {
        taskId: task.id,
        taskName: task.name,
        blocks: JSON.stringify(result.blocks),
        conflict: result.conflict ? '1' : '0',
        conflictMessage: result.conflictMessage ?? '',
      },
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field label="任务名称 *">
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="例如：完成论文第三章"
        />
      </Field>

      <Field label="总时长（分钟）*">
        <TextInput
          style={styles.input}
          value={totalDuration}
          onChangeText={setTotalDuration}
          placeholder="例如：480（8小时）"
          keyboardType="number-pad"
        />
      </Field>

      <Field label="每块时长（分钟）*">
        <TextInput
          style={styles.input}
          value={blockDuration}
          onChangeText={setBlockDuration}
          placeholder="例如：60"
          keyboardType="number-pad"
        />
        {totalDuration && blockDuration && !isNaN(parseInt(totalDuration)) && !isNaN(parseInt(blockDuration)) && (
          <Text style={styles.hint}>
            需要 {Math.ceil(parseInt(totalDuration) / parseInt(blockDuration))} 个时间块
          </Text>
        )}
      </Field>

      <View style={styles.switchRow}>
        <Text style={styles.label}>有截止日期</Text>
        <Switch value={hasDeadline} onValueChange={setHasDeadline} trackColor={{ true: BLUE }} />
      </View>

      {hasDeadline && (
        <Field label="截止日期 *">
          <TextInput
            style={styles.input}
            value={deadline}
            onChangeText={setDeadline}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
          />
        </Field>
      )}

      <TouchableOpacity style={styles.btn} onPress={handlePreview}>
        <Text style={styles.btnText}>{hasDeadline ? '生成排程预览' : '直接保存'}</Text>
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
  hint: { marginTop: 4, fontSize: 12, color: '#888' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  btn: { backgroundColor: BLUE, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
