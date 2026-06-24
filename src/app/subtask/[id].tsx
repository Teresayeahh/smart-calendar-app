import { useState, useEffect } from 'react';
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

import { getTask, updateTask, deleteTimeBlocksForSource } from '../../db/queries';
import { DatePickerInput } from '../../components/DatePickerInput';
import { TimePickerInput } from '../../components/TimePickerInput';
import { localDateStr } from '../../lib/dateUtils';

const BLUE = '#208AEF';

export default function EditSubtaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();

  const [name, setName] = useState('');
  const [taskVolume, setTaskVolume] = useState('');
  const [totalDuration, setTotalDuration] = useState('');
  const [deadline, setDeadline] = useState('');
  const [blockPreferMin, setBlockPreferMin] = useState('');
  const [blockPreferMax, setBlockPreferMax] = useState('');
  const [preferStart, setPreferStart] = useState('');
  const [preferEnd, setPreferEnd] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTask(db, id).then(t => {
      if (!t) return;
      setName(t.name);
      setTaskVolume(t.taskVolume ?? '');
      setTotalDuration(t.totalDuration != null ? String(t.totalDuration) : '');
      setDeadline(t.deadline ?? '');
      setBlockPreferMin(t.blockPreferMin != null ? String(t.blockPreferMin) : '');
      setBlockPreferMax(t.blockPreferMax != null ? String(t.blockPreferMax) : '');
      setPreferStart(t.preferredTimeStart ?? '');
      setPreferEnd(t.preferredTimeEnd ?? '');
      setLoaded(true);
    });
  }, [id]);

  async function handleSave() {
    if (!name.trim()) { Alert.alert('请输入子任务名称'); return; }
    const total = parseInt(totalDuration);
    if (isNaN(total) || total <= 0) { Alert.alert('请输入有效的总耗时（分钟）'); return; }
    if (!deadline) { Alert.alert('请选择截止日期'); return; }
    if ((preferStart && !preferEnd) || (!preferStart && preferEnd)) {
      Alert.alert('请同时设置偏好时间的开始和结束时间'); return;
    }

    const preferMin = blockPreferMin ? parseInt(blockPreferMin) : null;
    const preferMax = blockPreferMax ? parseInt(blockPreferMax) : null;
    if (preferMin !== null && (isNaN(preferMin) || preferMin <= 0)) {
      Alert.alert('偏好用时最短时间无效'); return;
    }
    if (preferMax !== null && (isNaN(preferMax) || preferMax <= 0)) {
      Alert.alert('偏好用时最长时间无效'); return;
    }
    if (preferMin !== null && preferMax !== null && preferMin > preferMax) {
      Alert.alert('最短时间不能大于最长时间'); return;
    }

    const blockDur = preferMax ?? Math.min(total, 60);

    await updateTask(db, id, {
      name: name.trim(),
      taskVolume: taskVolume.trim() || null,
      totalDuration: total,
      blockDuration: blockDur,
      deadline,
      blockPreferMin: preferMin,
      blockPreferMax: preferMax,
      preferredTimeStart: preferStart || null,
      preferredTimeEnd: preferEnd || null,
    });
    await deleteTimeBlocksForSource(db, id);

    router.replace({ pathname: '/schedule-preview', params: { taskId: id } });
  }

  const dur = parseInt(totalDuration);
  const bMax = blockPreferMax ? parseInt(blockPreferMax) : null;
  const blockSize = bMax && !isNaN(bMax) ? bMax : Math.min(isNaN(dur) ? 60 : dur, 60);
  const blocks = !isNaN(dur) && dur > 0 ? Math.ceil(dur / blockSize) : null;

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>加载中…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field label="子任务名称 *">
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          autoFocus
        />
      </Field>
      <Field label="具体工作量（可选）">
        <TextInput
          style={styles.input}
          value={taskVolume}
          onChangeText={setTaskVolume}
          placeholder="例如：5篇文献、3个章节"
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
          <Text style={styles.hint}>将拆分为 {blocks} 个时间块（每块 {blockSize} 分钟）</Text>
        )}
      </Field>
      <Field label="截止日期 *">
        <DatePickerInput value={deadline} onChange={setDeadline} minDate={localDateStr()} />
      </Field>
      <Field label="偏好用时（分钟，可选）">
        <View style={styles.rangeRow}>
          <TextInput
            style={[styles.input, styles.rangeInput]}
            value={blockPreferMin}
            onChangeText={setBlockPreferMin}
            keyboardType="number-pad"
            placeholder="最短 30"
          />
          <Text style={styles.rangeSep}>—</Text>
          <TextInput
            style={[styles.input, styles.rangeInput]}
            value={blockPreferMax}
            onChangeText={setBlockPreferMax}
            keyboardType="number-pad"
            placeholder="最长 45"
          />
        </View>
        <Text style={styles.hint}>排程将以最长时间为单块大小</Text>
      </Field>
      <Field label="偏好时间（可选）">
        <View style={styles.timeRow}>
          <TimePickerInput
            value={preferStart}
            onChange={setPreferStart}
            placeholder="开始时间"
            optional
            style={styles.timePicker}
          />
          <Text style={styles.timeSep}>—</Text>
          <TimePickerInput
            value={preferEnd}
            onChange={setPreferEnd}
            placeholder="结束时间"
            optional
            style={styles.timePicker}
          />
        </View>
        <Text style={styles.hint}>排程优先安排在此时间段内，超出时以浅红色提示</Text>
      </Field>
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
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rangeInput: { flex: 1 },
  rangeSep: { fontSize: 16, color: '#666' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timePicker: { flex: 1 },
  timeSep: { fontSize: 16, color: '#666', paddingHorizontal: 2 },
  hint: { marginTop: 6, fontSize: 12, color: '#888' },
  btn: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
