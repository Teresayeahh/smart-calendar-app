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
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { createTask } from '../../db/queries';
import { DatePickerInput } from '../../components/DatePickerInput';
import { localDateStr } from '../../lib/dateUtils';

const BLUE = '#208AEF';

export default function NewTaskScreen() {
  const db = useSQLiteContext();
  const [name, setName] = useState('');
  const [deadline, setDeadline] = useState('');

  async function handleCreate() {
    if (!name.trim()) { Alert.alert('请输入任务名称'); return; }
    if (!deadline) { Alert.alert('请选择截止日期'); return; }

    const task = await createTask(db, {
      parentId: null,
      name: name.trim(),
      totalDuration: null,
      blockDuration: null,
      deadline,
      taskVolume: null,
      blockPreferMin: null,
      blockPreferMax: null,
      preferredTimeStart: null,
      preferredTimeEnd: null,
    });

    router.replace({ pathname: '/task/[id]', params: { id: task.id } });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field label="任务名称 *">
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="例如：准备演讲稿"
          autoFocus
        />
      </Field>
      <Field label="截止日期 *">
        <DatePickerInput
          value={deadline}
          onChange={setDeadline}
          minDate={localDateStr()}
        />
      </Field>
      <TouchableOpacity style={styles.btn} onPress={handleCreate}>
        <Text style={styles.btnText}>创建任务</Text>
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
  btn: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
