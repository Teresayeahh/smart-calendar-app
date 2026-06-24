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

import { createHabit } from '../../db/queries';
import { localDateStr } from '../../lib/dateUtils';

const PURPLE = '#AF52DE';

export default function NewHabitScreen() {
  const db = useSQLiteContext();

  const [name, setName] = useState('');
  const [duration, setDuration] = useState('45');
  const [timesPerWeek, setTimesPerWeek] = useState('3');
  const [weeks, setWeeks] = useState('4');

  function getCycleEnd(w: number): string {
    const d = new Date();
    d.setDate(d.getDate() + w * 7);
    return localDateStr(d);
  }

  async function handleCreate() {
    if (!name.trim()) { Alert.alert('请输入习惯名称'); return; }
    const dur = parseInt(duration);
    const freq = parseInt(timesPerWeek);
    const w = parseInt(weeks);
    if (isNaN(dur) || dur <= 0) { Alert.alert('请输入有效的每次时长'); return; }
    if (isNaN(freq) || freq < 1 || freq > 7) { Alert.alert('频次范围 1–7 次/周'); return; }
    if (isNaN(w) || w <= 0) { Alert.alert('请输入有效的周期周数'); return; }

    const today = localDateStr();
    const habit = await createHabit(db, {
      name: name.trim(),
      durationPerSession: dur,
      timesPerWeek: freq,
      cycleStart: today,
      cycleEnd: getCycleEnd(w),
    });

    router.replace({
      pathname: '/schedule-preview',
      params: { taskId: habit.id, isHabit: '1' },
    });
  }

  const w = parseInt(weeks);
  const freq = parseInt(timesPerWeek);
  const totalSessions = (!isNaN(w) && !isNaN(freq)) ? w * freq : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field label="习惯名称 *">
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="例如：普拉提、跑步" />
      </Field>
      <Field label="每次时长（分钟）*">
        <TextInput style={styles.input} value={duration} onChangeText={setDuration} placeholder="45" keyboardType="number-pad" />
      </Field>
      <Field label="每周频次 *">
        <TextInput style={styles.input} value={timesPerWeek} onChangeText={setTimesPerWeek} placeholder="3" keyboardType="number-pad" />
      </Field>
      <Field label="持续周数 *">
        <TextInput style={styles.input} value={weeks} onChangeText={setWeeks} placeholder="4" keyboardType="number-pad" />
        {totalSessions > 0 && (
          <Text style={styles.hint}>
            共 {totalSessions} 次，至 {getCycleEnd(!isNaN(w) ? w : 0)}
          </Text>
        )}
      </Field>
      <TouchableOpacity style={[styles.btn, { backgroundColor: PURPLE }]} onPress={handleCreate}>
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
  label: { fontSize: 14, color: '#333', fontWeight: '500', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111', backgroundColor: '#FAFAFA' },
  hint: { marginTop: 4, fontSize: 12, color: '#888' },
  btn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
