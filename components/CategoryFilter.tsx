// src/components/CategoryFilter.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Filter } from 'lucide-react-native';
import { useTheme, ThemeColors } from '../context/ThemeProvider';

type CategoryFilterProps = {
  title?: string;
  items: any[]; // can be { id, label } or your Supabase rows
  selectedId: string | 'all';
  onChange: (id: string | 'all') => void;
  getLabel: (item: any) => string;
  showReset?: boolean;
};

export default function CategoryFilter({
  title = 'Κατηγορίες',
  items,
  selectedId,
  onChange,
  getLabel,
  showReset = false,
}: CategoryFilterProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.categoryCard}>
      <View style={styles.categoryHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Filter size={16} color={colors.text} />
          <Text style={styles.categoryTitle}>{title}</Text>
        </View>

      </View>

      <FlatList
        horizontal
        data={items}
        keyExtractor={(item: any) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryChipRow}
        renderItem={({ item }: any) => {
          const isActive = selectedId === item.id;
          const labelText = getLabel(item);

          return (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                isActive && styles.categoryChipActive,
              ]}
              onPress={() => onChange(item.id)}
            >
              <Text
                style={[
                  styles.categoryChipLabel,
                  isActive && styles.categoryChipLabelActive,
                ]}
              >
                {labelText}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    categoryCard: {
      marginTop: 12,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.card,
      borderRadius: 16,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    categoryHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    categoryTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    categoryReset: {
      fontSize: 12,
      color: colors.textMuted,
    },
    categoryChipRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    categoryChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.textMuted,
      marginRight: 8,
      backgroundColor: colors.bg,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    categoryChipLabel: {
      fontSize: 13,
      color: colors.textMuted,
    },
    categoryChipLabelActive: {
      color: '#fff',
      fontWeight: '600',
    },
  });
