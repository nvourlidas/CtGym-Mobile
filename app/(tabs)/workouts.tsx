import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { el } from 'date-fns/locale';
import { Plus, Dumbbell } from 'lucide-react-native';

import { useAuth } from '../../context/AuthProvider';
import { useTheme, ThemeColors } from '../../context/ThemeProvider';
import { listMyWorkouts, WorkoutRow } from '../../api/workouts';

export default function WorkoutsScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [items, setItems] = useState<WorkoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setError(null);
      const data = await listMyWorkouts(profile.id, 30);
      setItems(data);
    } catch (e) {
      console.log(e);
      setError('Κάτι πήγε στραβά κατά τη φόρτωση.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const renderItem = ({ item }: { item: WorkoutRow }) => {
    const dateStr = format(parseISO(item.performed_at), 'EEE dd/MM · HH:mm', { locale: el });
    const exCount = item.workout_exercises?.length ?? 0;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push(`/workout/${item.id}`)}
        style={styles.card}
      >
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>{dateStr}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{exCount} ασκήσεις</Text>
          </View>
        </View>

        {!!item.notes && (
          <Text style={styles.cardSub} numberOfLines={2}>
            {item.notes}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (!profile?.id) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Πρέπει πρώτα να συνδεθείς.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Dumbbell color={colors.accent} size={20} />
            <Text style={styles.headerTitle}>Προπονήσεις</Text>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/workout/new')}
          >
            <Plus color="#fff" size={16} />
            <Text style={styles.primaryBtnText}>Νέα</Text>
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={{ flex: 1, marginTop: 10 }}>
          {!loading && items.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>Δεν έχεις καταγεγραμμένες προπονήσεις.</Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              renderItem={renderItem}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },

    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

    errorText: { marginTop: 8, fontSize: 13, color: '#f97316' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: colors.textMuted, textAlign: 'center' },

    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
    cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
    cardSub: { marginTop: 8, color: colors.textMuted, fontSize: 13 },

    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    badgeText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  });
