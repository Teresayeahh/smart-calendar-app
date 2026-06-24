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

import {
  getHabit,
  updateHabit,
  getHabits,
  deleteTimeBlocksForSource,
  getPhases,
  getDayOverrides,
  getPendingTimeBlocks,
  type Habit,
} from '../../db/queries';
import { scheduleHabit } from '../../lib/scheduler';
import { useAppStore } from '../../lib/store';

const PURPLE = '#AF52DE';

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { dispatch } = useAppStore();

  const [habit, setHabit] = useState<Habit | null>(null);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [timesPerWeek, setTimesPerWeek] = useState('');
  const [cycleEnd, setCycleEnd] = useState('');

  useEffect(() => {
    async function load() {
      const h = await getHabit(db, id);
      if (!h) return;
      setHabit(h);
      setName(h.name);
      setDuration(String(h.durationPerSession));
      setTimesPerWeek(String(h.timesPerWeek));
      setCycleEnd(h.cycleEnd);
    }
    load();
  }, [id]);

  async function handleSave() {
    if (!name.trim()) { Alert.alert('请输入习惯名称'); return; }
    const dur = parseInt(duration);
    const freq = parseInt(timesPerWeek);
    if (isNaN(dur) || dur <= 0) { Alert.alert('请输入有效时长'); return; }
    if (isNaN(freq) || freq <= 0 || freq > 7) { Alert.alert('频次 1–7 次/周'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cycleEnd)) { Alert.alert('结束日期格式错误'); return; }

    await updateHabit(db, id, {
      name: name.trim(),
      durationPerSession: dur,
      timesPerWeek: freq,
      cycleEnd,
    });

    // Delete and reschedule
    await deleteTimeBlocksForSource(db, id);

    const today = new Date().toISOString().slice(0, 10);
    const updatedHabit = await getHabit(db, id);
    if (updatedHabit) {
      const [phases, overrides, existingBlocks] = await Promise.all([
        getPhases(db),
        getDayOverrides(db),
        getPendingTimeBlocks(db, today),
      ]);
      const result = scheduleHabit(updatedHabit, phases, overrides, existingBlocks, today);

      router.replace({
        pathname: '/schedule-preview',
        params: {
          taskId: id,
          taskName: name.trim(),
          blocks: JSON.stringify(result.blocks),
          conflict: result.conflict ? '1' : '0',
          conflictMessage: result.conflictMessage ?? '',
          isHabit: '1',
        },
      });
    }
  }

  if (!habit) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>加载中…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field label="习惯名称 *">
        <TextInput style={styles.input} value={name} onChangeText={setName} />
      </Field>
      <Field label="每次时长（分钟）*">
        <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="number-pad" />
      </Field>
      <Field label="每周频次 *">
        <TextInput style={styles.input} value={timesPerWeek} onChangeText={setTimesPerWeek} keyboardType="number-pad" />
      </Field>
      <Field label="周期结束日期">
        <TextInput style={styles.input} value={cycleEnd} onChangeText={setCycleEnd} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
      </Field>
      <TouchableOpacity style={[styles.btn, { backgroundColor: PURPLE }]} onPress={handleSave}>
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
  btn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
