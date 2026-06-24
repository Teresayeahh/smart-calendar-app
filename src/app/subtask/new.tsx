import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { createTask } from '../../db/queries';
import { DatePickerInput } from '../../components/DatePickerInput';
import { localDateStr } from '../../lib/dateUtils';

const BLUE = '#208AEF';

export default function NewSubtaskScreen() {
  const { parentId } = useLocalSearchParams<{ parentId: string }>();
  const db = useSQLiteContext();

  const [name, setName] = useState('');
  const [totalDuration, setTotalDuration] = useState('');
  const [deadline, setDeadline] = useState('');

  async function handleCreate() {
    if (!name.trim()) { Alert.alert('请输入子任务名称'); return; }
    const total = parseInt(totalDuration);
    if (isNaN(total) || total <= 0) { Alert.alert('请输入有效的总耗时（分钟）'); return; }
    if (!deadline) { Alert.alert('请选择截止日期'); return; }

    // blockDuration: sessions of max 60 min
    const blockDur = Math.min(total, 60);

    const sub = await createTask(db, {
      parentId,
      name: name.trim(),
      totalDuration: total,
      blockDuration: blockDur,
      deadline,
    });

    router.replace({ pathname: '/schedule-preview', params: { taskId: sub.id } });
  }

  const dur = parseInt(totalDuration);
  const blocks = !isNaN(dur) && dur > 0 ? Math.ceil(dur / Math.min(dur, 60)) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field label="子任务名称 *">
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="例如：撰写第一章"
          autoFocus
        />
      </Field>
      <Field label="总耗时（分钟）*">
        <TextInput
          style={styles.input}
          value={totalDuration}
          onChangeText={setTotalDuration}
          keyboardType="number-pad"
          placeholder="例如：120"
        />
        {blocks !== null && (
          <Text style={styles.hint}>
            将拆分为 {blocks} 个时间块（每块最长 60 分钟）
          </Text>
        )}
      </Field>
      <Field label="截止日期 *">
        <DatePickerInput
          value={deadline}
          onChange={setDeadline}
          minDate={localDateStr()}
        />
      </Field>
      <TouchableOpacity style={styles.btn} onPress={handleCreate}>
        <Text style={styles.btnText}>生成排程预览</Text>
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
  label: { fontSize: 14, color: '#333', fontWeight: '500', marginBottom: 8 },
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
  btn: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
