import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import { el } from 'date-fns/locale';
import { ChevronLeft } from 'lucide-react-native';

import { useAuth } from '../../context/AuthProvider';
import { useTheme, ThemeColors } from '../../context/ThemeProvider';
import { getWorkoutDetail, type WorkoutDetail } from '../../api/workouts';

function pickMainImage(images: any[] | null | undefined): string | null {
  const arr = images ?? [];
  if (!arr.length) return null;
  const main = arr.find(i => i?.is_main && i?.url);
  return (main?.url ?? arr[0]?.url ?? null) as string | null;
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = typeof id === 'string' ? id : '';
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [data, setData] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workoutId) return;
    try {
      setError(null);
      setLoading(true);
      const d = await getWorkoutDetail(workoutId);
      setData(d);
    } catch (e) {
      console.log(e);
      setError('Κάτι πήγε στραβά κατά τη φόρτωση της προπόνησης.');
    } finally {
      setLoading(false);
    }
  }, [workoutId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!profile?.id) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Πρέπει πρώτα να συνδεθείς.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.emptyText}>Φόρτωση…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>{error ?? 'Δεν βρέθηκε προπόνηση.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const when = format(parseISO(data.performed_at), 'EEE dd/MM · HH:mm', { locale: el });

  const totalVolume = data.exercises.reduce((sum, ex) => {
    const v = ex.sets.reduce((s, set) => {
      const reps = set.reps ?? 0;
      const w = set.weight ?? 0;
      return s + reps * w;
    }, 0);
    return sum + v;
  }, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <ChevronLeft color={colors.text} size={18} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Λεπτομέρειες προπόνησης</Text>
            <Text style={styles.subtitle}>{when}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{data.exercises.length} ασκήσεις</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillText}>
              Όγκος: {Number.isFinite(totalVolume) ? totalVolume.toFixed(0) : '0'}
            </Text>
          </View>
        </View>

        {!!data.notes && <Text style={styles.notes}>{data.notes}</Text>}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <FlatList
          data={data.exercises}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const img = pickMainImage(item.exercise?.images as any);

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    {!!img && (
                      <Image source={{ uri: img }} style={styles.thumb} resizeMode="cover" />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>
                        {item.exercise?.name ?? `Άσκηση #${item.exercise_wger_id}`}
                      </Text>
                      {!!item.exercise?.category_name && (
                        <Text style={styles.cardSub} numberOfLines={1}>
                          {item.exercise.category_name}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                <View style={styles.setHeaderRow}>
                  <Text style={[styles.setHeaderText, { flex: 0.5 }]}>#</Text>
                  <Text style={styles.setHeaderText}>Reps</Text>
                  <Text style={styles.setHeaderText}>Kg</Text>
                </View>

                {item.sets.map((s) => (
                  <View key={s.id} style={styles.setRow}>
                    <Text style={[styles.setNo, { flex: 0.5 }]}>{s.set_no}</Text>
                    <Text style={styles.setVal}>{s.reps ?? '—'}</Text>
                    <Text style={styles.setVal}>
                      {s.weight ?? '—'} {s.weight ? s.weight_unit : ''}
                    </Text>
                  </View>
                ))}
              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },

    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.textMuted,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
    },
    title: { color: colors.text, fontSize: 16, fontWeight: '900' },
    subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

    summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.textMuted,
      backgroundColor: colors.card,
    },
    pillText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },

    notes: {
      color: colors.text,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.textMuted,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      fontSize: 13,
    },

    errorText: { marginTop: 4, fontSize: 13, color: '#f97316' },
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
    cardHeader: { marginBottom: 10 },
    cardTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
    cardSub: { marginTop: 3, color: colors.textMuted, fontSize: 12 },

    thumb: {
      width: 44,
      height: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.textMuted,
      backgroundColor: colors.bg,
    },

    setHeaderRow: { flexDirection: 'row', paddingBottom: 6 },
    setHeaderText: { flex: 1, color: colors.textMuted, fontSize: 12, fontWeight: '800' },

    setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
    setNo: { color: colors.text, fontWeight: '900' },
    setVal: { flex: 1, color: colors.text, fontWeight: '800', textAlign: 'left' },
  });
