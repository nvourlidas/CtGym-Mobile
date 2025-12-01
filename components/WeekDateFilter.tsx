// src/components/WeekDateFilter.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  startOfWeek,
  addDays,
  isSameDay,
  format,
  isBefore,
  startOfDay,
} from 'date-fns';
import { el } from 'date-fns/locale';
import { Calendar, X } from 'lucide-react-native'; // 👈 Lucide
import { useTheme, ThemeColors } from '../context/ThemeProvider';

type Props = {
  selectedDate: Date;
  onChange: (date: Date) => void;
};

export default function WeekDateFilter({ selectedDate, onChange }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [showPicker, setShowPicker] = useState(false);

  const today = useMemo(() => startOfDay(new Date()), []);
  // 👇 Week now starts on Sunday (0)
  const weekStart = useMemo(
    () => startOfWeek(selectedDate, { weekStartsOn: 0 }),
    [selectedDate],
  );

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') {
      setShowPicker(false);
      return;
    }

    const picked = date ?? selectedDate;

    // Android: close automatically after pick
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    // Block past dates (even if user somehow picks one)
    if (isBefore(startOfDay(picked), today)) return;

    onChange(picked);
  };

  return (
    <View style={styles.container}>
      {/* Title + calendar icon */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Ημέρα</Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => setShowPicker(true)}
        >
          <Calendar size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Week days as small cards */}
      <View style={styles.daysRow}>
        {days.map((day) => {
          const active = isSameDay(day, selectedDate);
          const key = format(day, 'yyyy-MM-dd');
          const isPast = isBefore(startOfDay(day), today);

          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.dayCard,
                active && styles.dayCardActive,
                isPast && styles.dayCardDisabled,
              ]}
              onPress={() => {
                if (!isPast) onChange(day);
              }}
              disabled={isPast}
            >
              <Text
                style={[
                  styles.dayName,
                  active && styles.dayTextActive,
                  isPast && styles.dayTextDisabled,
                ]}
                numberOfLines={1}
              >
                {format(day, 'EEE', { locale: el })}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  active && styles.dayTextActive,
                  isPast && styles.dayTextDisabled,
                ]}
              >
                {format(day, 'dd/MM')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {showPicker && (
        <View style={styles.pickerWrapper}>
          {/* Close row above the picker */}
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Επιλογή ημερομηνίας</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={handlePickerChange}
            themeVariant="dark"
            minimumDate={today} // 👈 block past dates
          />
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginTop: 8,
      marginBottom: 4,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    iconButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.card,
    },
    daysRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 6, // if RN version doesn't support gap, remove and use marginRight
    },
    dayCard: {
      flex: 1,
      marginRight: 6,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.textMuted,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCardActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dayCardDisabled: {
      opacity: 0.4,
    },
    dayName: {
      fontSize: 11,
      color: colors.textMuted,
    },
    dayNumber: {
      marginTop: 2,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    dayTextActive: {
      color: '#fff',
    },
    dayTextDisabled: {
      color: colors.textMuted,
    },
    pickerWrapper: {
      marginTop: 8,
      borderRadius: 12,
      padding: 8,
      backgroundColor: colors.card,
    },
    pickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    pickerTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '500',
    },
  });
