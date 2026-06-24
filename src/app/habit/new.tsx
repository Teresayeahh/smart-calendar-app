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

import {
  createHabit,
  getHabits,
  getPhases,
  getDayOverrides,
  getPendingTimeBlocks,
} from '../../db/queries';
import { scheduleHabit } from '../../lib/scheduler';
import { useAppStore } from '../../lib/store';

const BLUE = '#208AEF';
const PURPLE = '#AF52DE';

export default function NewHabitScreen() {
  const db = useSQLiteContext();
  const { dispatch } = useAppStore();

  const [name, setName] = useState('');
  const [duration, setDuration] = useState('45');
  const [timesPerWeek, setTimesPerWeek] = useState('3');
  const [weeks, setWeeks] = useState('4');

  function getCycleEnd(weeksFromNow: number): string {
    const d = new Date();
    d.setDate(d.getDate() + weeksFromNow * 7);
    return d.toISOString().slice(0, 10);
  }

  async function handleCreate() {
    if (!name.trim()) { Alert.alert('请输入习惯名称'); return; }
    const dur = parseInt(duration);
    const freq = parseInt(timesPerWeek);
    const w = parseInt(weeks);
    if (isNaN(dur) || dur <= 0) { Alert.alert('请输入有效的每次时长'); return; }
    if (isNaN(freq) || freq <= 0 || freq > 7) { Alert.alert('频次范围 1–7 次/周'); return; }
    if (isNaN(w) || w <= 0) { Alert.alert('请输入有效的周期周数'); return; }

    const today = new Date().toISOString().slice(0, 10);
    const cycleEnd = getCycleEnd(w);

    const habit = await createHabit(db, {
      name: name.trim(),
      durationPerSession: dur,
      timesPerWeek: freq,
      cycleStart: today,
      cycleEnd,
    });

    const [phases, overrides, existingBlocks] = await Promise.all([
      getPhases(db),
      getDayOverrides(db),
      getPendingTimeBlocks(db, today),
    ]);

    const result = scheduleHabit(habit, phases, overrides, existingBlocks, today);

    router.replace({
      pathname: '/schedule-preview',
      params: {
        taskId: habit.id,
        taskName: habit.name,
        blocks: JSON.stringify(result.blocks),
        conflict: result.conflict ? '1' : '0',
        conflictMessage: result.conflictMessage ?? '',
        isHabit: '1',
      },
    });
  }

  const totalSessions = parseInt(weeks || '0') * parseInt(timesPerWeek || '0');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field label="习惯名称 *">
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="例如：普拉提、跑步"
        />
      </Field>

      <Field label="每次时长（分钟）*">
        <TextInput
          style={styles.input}
          value={duration}
          onChangeText={setDuration}
          placeholder="45"
          keyboardType="number-pad"
        />
      </Field>

      <Field label="每周频次 *">
        <TextInput
          style={styles.input}
          value={timesPerWeek}
          onChangeText={setTimesPerWeek}
          placeholder="3"
          keyboardType="number-pad"
        />
      </Field>

      <Field label="持续周数 *">
        <TextInput
          style={styles.input}
          value={weeks}
          onChangeText={setWeeks}
          placeholder="4"
          keyboardType="number-pad"
        />
        {!isNaN(totalSessions) && totalSessions > 0 && (
          <Text style={styles.hint}>
            共需安排 {totalSessions} 次，至 {getCycleEnd(parseInt(weeks || '0'))}
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
