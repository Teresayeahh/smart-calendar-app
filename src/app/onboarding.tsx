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
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { upsertPhase, getPhases } from '../db/queries';
import { requestNotificationPermissions } from '../lib/notifications';
import { useAppStore } from '../lib/store';

const BLUE = '#208AEF';

export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const { dispatch } = useAppStore();

  const [phaseName, setPhaseName] = useState('实习期');
  const [workStart, setWorkStart] = useState('19:30');
  const [workEnd, setWorkEnd] = useState('22:30');
  const [holidayStart, setHolidayStart] = useState('09:00');
  const [holidayEnd, setHolidayEnd] = useState('22:00');
  const [phaseEnd, setPhaseEnd] = useState('');

  function validateTime(t: string) {
    return /^\d{2}:\d{2}$/.test(t);
  }

  async function handleFinish() {
    if (!phaseName.trim()) {
      Alert.alert('请输入阶段名称');
      return;
    }
    for (const t of [workStart, workEnd, holidayStart, holidayEnd]) {
      if (!validateTime(t)) {
        Alert.alert('时间格式错误', '请使用 HH:MM 格式，例如 19:30');
        return;
      }
    }
    if (workStart >= workEnd) {
      Alert.alert('时间错误', '工作日结束时间必须晚于开始时间');
      return;
    }
    if (holidayStart >= holidayEnd) {
      Alert.alert('时间错误', '休息日结束时间必须晚于开始时间');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    await upsertPhase(db, {
      name: phaseName.trim(),
      startDate: today,
      endDate: phaseEnd.trim() || null,
      workdayFreeStart: workStart,
      workdayFreeEnd: workEnd,
      holidayFreeStart: holidayStart,
      holidayFreeEnd: holidayEnd,
    });

    const phases = await getPhases(db);
    dispatch({ type: 'SET_PHASES', phases });
    dispatch({ type: 'SET_ONBOARDED', value: true });

    await requestNotificationPermissions();

    router.replace('/(tabs)');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>欢迎使用超级日程</Text>
      <Text style={styles.subtitle}>先设置你的日常可用时间</Text>

      <Section title="阶段名称">
        <Field label={'名称（如「实习期」）'}>
          <TextInput
            style={styles.input}
            value={phaseName}
            onChangeText={setPhaseName}
            placeholder="实习期"
          />
        </Field>
        <Field label="结束日期（选填，格式 YYYY-MM-DD）">
          <TextInput
            style={styles.input}
            value={phaseEnd}
            onChangeText={setPhaseEnd}
            placeholder="2025-09-01"
          />
        </Field>
      </Section>

      <Section title="工作日可用时间（下班后）">
        <Row>
          <Field label="开始">
            <TextInput
              style={[styles.input, styles.timeInput]}
              value={workStart}
              onChangeText={setWorkStart}
              placeholder="19:30"
              keyboardType="numbers-and-punctuation"
            />
          </Field>
          <Field label="结束">
            <TextInput
              style={[styles.input, styles.timeInput]}
              value={workEnd}
              onChangeText={setWorkEnd}
              placeholder="22:30"
              keyboardType="numbers-and-punctuation"
            />
          </Field>
        </Row>
      </Section>

      <Section title="休息日可用时间">
        <Row>
          <Field label="开始">
            <TextInput
              style={[styles.input, styles.timeInput]}
              value={holidayStart}
              onChangeText={setHolidayStart}
              placeholder="09:00"
              keyboardType="numbers-and-punctuation"
            />
          </Field>
          <Field label="结束">
            <TextInput
              style={[styles.input, styles.timeInput]}
              value={holidayEnd}
              onChangeText={setHolidayEnd}
              placeholder="22:00"
              keyboardType="numbers-and-punctuation"
            />
          </Field>
        </Row>
      </Section>

      <Text style={styles.note}>
        节假日将自动跟随中国法定节假日日历（2025–2026 已内置）
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleFinish}>
        <Text style={styles.buttonText}>开始使用</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
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

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8, color: '#111' },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: BLUE, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  field: { marginBottom: 12, flex: 1 },
  label: { fontSize: 13, color: '#666', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#FAFAFA',
  },
  timeInput: { textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  note: { fontSize: 13, color: '#888', marginBottom: 32, lineHeight: 20 },
  button: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
