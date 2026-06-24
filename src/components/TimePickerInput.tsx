import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

interface Props {
  value: string;        // HH:MM or ''
  onChange: (time: string) => void;
  placeholder?: string;
  optional?: boolean;
  style?: object;
}

export function TimePickerInput({
  value,
  onChange,
  placeholder = '选择时间',
  optional = false,
  style,
}: Props) {
  function open() {
    const base = new Date();
    if (value) {
      const [h, m] = value.split(':').map(Number);
      base.setHours(h, m, 0, 0);
    }
    DateTimePickerAndroid.open({
      value: base,
      mode: 'time',
      display: 'spinner',
      is24Hour: true,
      onChange: (_event, date) => {
        if (_event.type === 'set' && date) {
          const h = String(date.getHours()).padStart(2, '0');
          const m = String(date.getMinutes()).padStart(2, '0');
          onChange(`${h}:${m}`);
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
        <Text style={styles.icon}>🕐</Text>
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
