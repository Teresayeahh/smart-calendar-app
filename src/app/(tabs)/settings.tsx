import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  getPhases,
  upsertPhase,
  deletePhase,
  getDayOverrides,
  setDayOverride,
  removeDayOverride,
  type Phase,
  type DayOverride,
  type DayType,
} from '../../db/queries';
import { useAppStore } from '../../lib/store';
import { getDayType } from '../../lib/holidays';
import { DatePickerInput } from '../../components/DatePickerInput';
import { localDateStr } from '../../lib/dateUtils';

const BLUE = '#208AEF';
const RED = '#FF3B30';
const GREEN = '#34C759';
const ORANGE = '#FF9500';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { state, dispatch } = useAppStore();
  const [showPhaseForm, setShowPhaseForm] = useState(false);
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideType, setOverrideType] = useState<DayType>('holiday');

  // Phase form state
  const [editPhase, setEditPhase] = useState<Partial<Phase>>({});

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const [phases, overrides] = await Promise.all([
          getPhases(db),
          getDayOverrides(db),
        ]);
        dispatch({ type: 'SET_PHASES', phases });
        dispatch({ type: 'SET_DAY_OVERRIDES', overrides });
      }
      load();
    }, [db])
  );

  function startNewPhase() {
    const today = localDateStr();
    setEditPhase({
      name: '',
      startDate: today,
      endDate: null,
      workdayFreeStart: '19:30',
      workdayFreeEnd: '22:30',
      holidayFreeStart: '09:00',
      holidayFreeEnd: '22:00',
    });
    setShowPhaseForm(true);
  }

  function startEditPhase(phase: Phase) {
    setEditPhase({ ...phase });
    setShowPhaseForm(true);
  }

  async function savePhase() {
    if (!editPhase.name?.trim()) {
      Alert.alert('请输入阶段名称');
      return;
    }
    await upsertPhase(db, {
      id: editPhase.id,
      name: editPhase.name!,
      startDate: editPhase.startDate!,
      endDate: editPhase.endDate ?? null,
      workdayFreeStart: editPhase.workdayFreeStart!,
      workdayFreeEnd: editPhase.workdayFreeEnd!,
      holidayFreeStart: editPhase.holidayFreeStart!,
      holidayFreeEnd: editPhase.holidayFreeEnd!,
    });
    const phases = await getPhases(db);
    dispatch({ type: 'SET_PHASES', phases });
    setShowPhaseForm(false);
  }

  async function handleDeletePhase(phase: Phase) {
    Alert.alert('删除阶段', `确定删除「${phase.name}」？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deletePhase(db, phase.id);
          const phases = await getPhases(db);
          dispatch({ type: 'SET_PHASES', phases });
        },
      },
    ]);
  }

  async function addOverride() {
    if (!overrideDate) {
      Alert.alert('请选择日期');
      return;
    }
    await setDayOverride(db, overrideDate, overrideType);
    const overrides = await getDayOverrides(db);
    dispatch({ type: 'SET_DAY_OVERRIDES', overrides });
    setOverrideDate('');
  }

  async function removeOverride(date: string) {
    await removeDayOverride(db, date);
    const overrides = await getDayOverrides(db);
    dispatch({ type: 'SET_DAY_OVERRIDES', overrides });
  }

  if (showPhaseForm) {
    return (
      <PhaseForm
        phase={editPhase}
        onChange={setEditPhase}
        onSave={savePhase}
        onCancel={() => setShowPhaseForm(false)}
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>设置</Text>

      {/* Phases */}
      <Section title="时间阶段">
        {state.phases.map(phase => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            onEdit={() => startEditPhase(phase)}
            onDelete={() => handleDeletePhase(phase)}
          />
        ))}
        <TouchableOpacity style={styles.outlineBtn} onPress={startNewPhase}>
          <Text style={styles.outlineBtnText}>+ 添加阶段</Text>
        </TouchableOpacity>
      </Section>

      {/* Day Overrides */}
      <Section title="单日类型覆盖">
        <Text style={styles.hint}>
          调休上班日 / 临时休假日可在此覆盖系统判断
        </Text>
        <View style={styles.row}>
          <DatePickerInput
            value={overrideDate}
            onChange={setOverrideDate}
            placeholder="选择日期"
            style={{ flex: 1 }}
          />
          <TouchableOpacity
            style={[styles.toggleBtn, overrideType === 'holiday' && styles.toggleActive]}
            onPress={() => setOverrideType('holiday')}
          >
            <Text style={overrideType === 'holiday' ? styles.toggleTextActive : styles.toggleText}>休息日</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, overrideType === 'workday' && styles.toggleActive]}
            onPress={() => setOverrideType('workday')}
          >
            <Text style={overrideType === 'workday' ? styles.toggleTextActive : styles.toggleText}>工作日</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smallBtn} onPress={addOverride}>
            <Text style={styles.smallBtnText}>添加</Text>
          </TouchableOpacity>
        </View>

        {state.dayOverrides.map(o => (
          <View key={o.date} style={styles.overrideRow}>
            <Text style={styles.overrideDate}>{o.date}</Text>
            <View style={[styles.badge, { backgroundColor: o.type === 'holiday' ? ORANGE + '22' : BLUE + '22' }]}>
              <Text style={[styles.badgeText, { color: o.type === 'holiday' ? ORANGE : BLUE }]}>
                {o.type === 'holiday' ? '休息日' : '工作日'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => removeOverride(o.date)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </Section>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

function PhaseCard({
  phase,
  onEdit,
  onDelete,
}: {
  phase: Phase;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.phaseCard}>
      <View style={styles.phaseMain}>
        <Text style={styles.phaseName}>{phase.name}</Text>
        <Text style={styles.phaseMeta}>
          {phase.startDate} → {phase.endDate ?? '持续中'}
        </Text>
        <Text style={styles.phaseMeta}>
          工作日 {phase.workdayFreeStart}–{phase.workdayFreeEnd} ·
          休息日 {phase.holidayFreeStart}–{phase.holidayFreeEnd}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.iconBtn} onPress={onEdit}>
          <Text style={styles.iconBtnText}>编辑</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: RED + '15' }]} onPress={onDelete}>
          <Text style={[styles.iconBtnText, { color: RED }]}>删除</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PhaseForm({
  phase,
  onChange,
  onSave,
  onCancel,
}: {
  phase: Partial<Phase>;
  onChange: (p: Partial<Phase>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  function set(key: keyof Phase, value: string | null) {
    onChange({ ...phase, [key]: value });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.formHeader}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancel}>取消</Text>
        </TouchableOpacity>
        <Text style={styles.formTitle}>时间阶段</Text>
        <TouchableOpacity onPress={onSave}>
          <Text style={styles.save}>保存</Text>
        </TouchableOpacity>
      </View>

      <FField label="阶段名称">
        <TextInput style={styles.input} value={phase.name ?? ''} onChangeText={v => set('name', v)} placeholder="实习期" />
      </FField>
      <FField label="开始日期">
        <DatePickerInput
          value={phase.startDate ?? ''}
          onChange={v => set('startDate', v)}
        />
      </FField>
      <FField label="结束日期（选填）">
        <DatePickerInput
          value={phase.endDate ?? ''}
          onChange={v => set('endDate', v || null)}
          placeholder="不设置结束日期"
          optional
        />
      </FField>
      <Text style={styles.sectionLabel}>工作日可用时间</Text>
      <View style={styles.row}>
        <FField label="开始">
          <TextInput style={[styles.input, styles.timeInput]} value={phase.workdayFreeStart ?? ''} onChangeText={v => set('workdayFreeStart', v)} placeholder="19:30" />
        </FField>
        <FField label="结束">
          <TextInput style={[styles.input, styles.timeInput]} value={phase.workdayFreeEnd ?? ''} onChangeText={v => set('workdayFreeEnd', v)} placeholder="22:30" />
        </FField>
      </View>
      <Text style={styles.sectionLabel}>休息日可用时间</Text>
      <View style={styles.row}>
        <FField label="开始">
          <TextInput style={[styles.input, styles.timeInput]} value={phase.holidayFreeStart ?? ''} onChangeText={v => set('holidayFreeStart', v)} placeholder="09:00" />
        </FField>
        <FField label="结束">
          <TextInput style={[styles.input, styles.timeInput]} value={phase.holidayFreeEnd ?? ''} onChangeText={v => set('holidayFreeEnd', v)} placeholder="22:00" />
        </FField>
      </View>
    </ScrollView>
  );
}

function FField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 16, flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: '#111', marginBottom: 24, marginTop: 52 },
  section: { marginBottom: 28 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: BLUE, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  hint: { fontSize: 13, color: '#888', marginBottom: 10 },
  phaseCard: {
    backgroundColor: '#F5F5F7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  phaseMain: { flex: 1 },
  phaseName: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 },
  phaseMeta: { fontSize: 12, color: '#666' },
  cardActions: { flexDirection: 'row', gap: 6 },
  iconBtn: { backgroundColor: BLUE + '15', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  iconBtnText: { fontSize: 13, color: BLUE, fontWeight: '500' },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: BLUE,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  outlineBtnText: { color: BLUE, fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111',
    backgroundColor: '#FAFAFA',
  },
  timeInput: { textAlign: 'center' },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F0F0F3',
  },
  toggleActive: { backgroundColor: BLUE },
  toggleText: { fontSize: 13, color: '#555' },
  toggleTextActive: { fontSize: 13, color: '#fff', fontWeight: '600' },
  smallBtn: { backgroundColor: BLUE, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  smallBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  overrideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
    gap: 10,
  },
  overrideDate: { flex: 1, fontSize: 14, color: '#333' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  removeText: { fontSize: 16, color: RED },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 52,
  },
  formTitle: { fontSize: 17, fontWeight: '600', color: '#111' },
  cancel: { fontSize: 16, color: '#888' },
  save: { fontSize: 16, color: BLUE, fontWeight: '600' },
  label: { fontSize: 13, color: '#666', marginBottom: 4 },
});
