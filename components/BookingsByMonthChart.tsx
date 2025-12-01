// src/components/BookingsByMonthChart.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme, ThemeColors } from '../context/ThemeProvider';

export type MonthlyPoint = {
  label: string; // π.χ. "Ιαν", "Φεβ"
  count: number;
};

type Props = {
  points: MonthlyPoint[];
};

export default function BookingsByMonthChart({ points }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!points.length) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Κρατήσεις ανά μήνα</Text>
        <Text style={styles.emptyText}>
          Δεν υπάρχουν αρκετά δεδομένα για διάγραμμα.
        </Text>
      </View>
    );
  }

  const maxCount = Math.max(...points.map(p => p.count), 1);
  const maxBarHeight = 140; // px

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Προπονήσεις ανά μήνα</Text>

      <View style={styles.chartArea}>
        {points.map(p => {
          const barHeight =
            maxCount === 0 ? 0 : (p.count / maxCount) * maxBarHeight;

          return (
            <View key={p.label} style={styles.barColumn}>
              {/* αριθμός επάνω από το bar */}
              <Text style={styles.valueText}>
                {p.count > 0 ? p.count : ''}
              </Text>

              {/* κάθετο bar */}
              <View
                style={[
                  styles.bar,
                  { height: barHeight },
                ]}
              />

              {/* label μήνα κάτω */}
              <Text style={styles.labelText}>{p.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 8,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 13,
    },
    chartArea: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingHorizontal: 4,
    },
    barColumn: {
      flex: 1,
      alignItems: 'center',
      marginHorizontal: 4,
    },
    bar: {
      width: 16,
      borderRadius: 999,
      backgroundColor: colors.accent,
    },
    valueText: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 4,
    },
    labelText: {
      marginTop: 4,
      fontSize: 11,
      color: colors.textMuted,
    },
  });
