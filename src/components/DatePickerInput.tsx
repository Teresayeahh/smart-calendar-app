import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

interface Props {
  value: string;       // YYYY-MM-DD or ''
  onChange: (date: string) => void;
  placeholder?: string;
  minDate?: string;    // YYYY-MM-DD
  optional?: boolean;  // shows a "清除" option if set
  style?: object;
}

export function DatePickerInput({
  value,
  onChange,
  placeholder = '选择日期',
  minDate,
  optional = false,
  style,
}: Props) {
  function open() {
    const current = value ? new Date(value + 'T00:00:00') : new Date();
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      minimumDate: minDate ? new Date(minDate + 'T00:00:00') : undefined,
      onChange: (_event, date) => {
        if (_event.type === 'set' && date) {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          onChange(`${y}-${m}-${d}`);
        }
      },
    });
  }

  return (
    <View style={[styles.row, style]}>
      <TouchableOpacity onPress={open} style={styles.input}>
        <Text style={value ? styles.value : styles.placeholder}>
          {value || placeholder}
        </Text>
        <Text style={styles.icon}>📅</Text>
      </TouchableOpacity>
      {optional && value ? (
        <TouchableOpacity onPress={() => onChange('')} style={styles.clearBtn}>
          <Text style={styles.clearText}>清除</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  value: { fontSize: 15, color: '#111' },
  placeholder: { fontSize: 15, color: '#BBBBC0' },
  icon: { fontSize: 16 },
  clearBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  clearText: { fontSize: 13, color: '#888' },
});
