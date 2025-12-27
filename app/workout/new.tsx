import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { Plus, X, Save, Trash2, Search } from 'lucide-react-native';

import { useAuth } from '../../context/AuthProvider';
import { useTheme, ThemeColors } from '../../context/ThemeProvider';
import { searchExercises, type ExerciseCatalogRow } from '../../api/exercises';
import { createWorkout, addWorkoutExercise, addWorkoutSets } from '../../api/workouts';

type LocalSet = { key: string; reps: string; weight: string };
type LocalExercise = {
  wger_id: number;
  name: string;
  sets: LocalSet[];
  imageUrl?: string | null;
};

export default function NewWorkoutScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [saving, setSaving] = useState(false);

  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ExerciseCatalogRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<LocalExercise[]>([]);

  const nowLabel = useMemo(() => format(new Date(), 'EEE dd/MM · HH:mm', { locale: el }), []);

  useEffect(() => {
    const query = q.trim();
    if (!exerciseModalOpen) return;

    const t = setTimeout(async () => {
      if (!query) {
        setResults([]);
        return;
      }
      try {
        setSearching(true);
        const data = await searchExercises(query, 30);
        setResults(data);
      } catch (e) {
        console.log(e);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [q, exerciseModalOpen]);

  const addExercise = (ex: ExerciseCatalogRow) => {
    setItems(prev => {
      if (prev.some(p => p.wger_id === ex.wger_id)) return prev;
      return [
        ...prev,
        {
          wger_id: ex.wger_id,
          name: ex.name,
          imageUrl: pickMainImageUrl(ex),
          sets: [{ key: cryptoRandomKey(), reps: '', weight: '' }],
        },
      ];
    });
    setExerciseModalOpen(false);
    setQ('');
    setResults([]);
  };

  const removeExercise = (wgerId: number) => {
    setItems(prev => prev.filter(p => p.wger_id !== wgerId));
  };

  const addSet = (wgerId: number) => {
    setItems(prev =>
      prev.map(ex =>
        ex.wger_id === wgerId
          ? { ...ex, sets: [...ex.sets, { key: cryptoRandomKey(), reps: '', weight: '' }] }
          : ex,
      ),
    );
  };

  const removeSet = (wgerId: number, setKey: string) => {
    setItems(prev =>
      prev.map(ex => {
        if (ex.wger_id !== wgerId) return ex;
        const next = ex.sets.filter(s => s.key !== setKey);
        return { ...ex, sets: next.length ? next : [{ key: cryptoRandomKey(), reps: '', weight: '' }] };
      }),
    );
  };

  const updateSet = (wgerId: number, setKey: string, field: 'reps' | 'weight', value: string) => {
    const clean = value.replace(',', '.');
    setItems(prev =>
      prev.map(ex => {
        if (ex.wger_id !== wgerId) return ex;
        return {
          ...ex,
          sets: ex.sets.map(s => (s.key === setKey ? { ...s, [field]: clean } : s)),
        };
      }),
    );
  };

  const onSave = async () => {
    if (!profile?.id) return;
    if (items.length === 0) {
      setError('Πρόσθεσε τουλάχιστον 1 άσκηση.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const workout = await createWorkout(profile.id, new Date().toISOString(), null);

      for (let i = 0; i < items.length; i++) {
        const ex = items[i];
        const we = await addWorkoutExercise(workout.id, ex.wger_id, i);

        const setsPayload = ex.sets.map((s, idx) => {
          const reps = s.reps.trim() ? Number(s.reps) : null;
          const weight = s.weight.trim() ? Number(s.weight) : null;

          return {
            set_no: idx + 1,
            reps: Number.isFinite(reps as any) ? reps : null,
            weight: Number.isFinite(weight as any) ? weight : null,
            weight_unit: 'kg',
          };
        });

        await addWorkoutSets(we.id, setsPayload);
      }

      router.back();
    } catch (e) {
      console.log(e);
      setError('Αποτυχία αποθήκευσης. Δοκίμασε ξανά.');
    } finally {
      setSaving(false);
    }
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
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <X color={colors.text} size={18} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Νέα προπόνηση</Text>
            <Text style={styles.headerSub}>{nowLabel}</Text>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={onSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Save color="#fff" size={16} />
                <Text style={styles.saveBtnText}>Αποθήκευση</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity style={styles.addExerciseBtn} onPress={() => setExerciseModalOpen(true)}>
          <Plus color="#fff" size={18} />
          <Text style={styles.addExerciseBtnText}>Προσθήκη άσκησης</Text>
        </TouchableOpacity>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <View style={styles.centerBlock}>
              <Text style={styles.emptyText}>Πάτα “Προσθήκη άσκησης” για να ξεκινήσεις.</Text>
            </View>
          ) : (
            items.map((ex) => (
              <View key={ex.wger_id} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    {!!ex.imageUrl && (
                      <Image
                        source={{ uri: ex.imageUrl }}
                        style={styles.thumb}
                        resizeMode="cover"
                      />
                    )}
                    <Text style={styles.exerciseTitle}>{ex.name}</Text>
                  </View>

                  <TouchableOpacity style={styles.iconBtnSm} onPress={() => removeExercise(ex.wger_id)}>
                    <Trash2 color={colors.error ?? '#ef4444'} size={16} />
                  </TouchableOpacity>
                </View>


                <View style={styles.setHeaderRow}>
                  <Text style={styles.setHeaderText}>Set</Text>
                  <Text style={styles.setHeaderText}>Reps</Text>
                  <Text style={styles.setHeaderText}>Kg</Text>
                  <Text style={styles.setHeaderText}></Text>
                </View>

                {ex.sets.map((s, idx) => (
                  <View key={s.key} style={styles.setRow}>
                    <Text style={styles.setNo}>{idx + 1}</Text>

                    <TextInput
                      value={s.reps}
                      onChangeText={(v) => updateSet(ex.wger_id, s.key, 'reps', v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                    />

                    <TextInput
                      value={s.weight}
                      onChangeText={(v) => updateSet(ex.wger_id, s.key, 'weight', v.replace(/[^0-9.,]/g, ''))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                    />

                    <TouchableOpacity style={styles.iconBtnSm} onPress={() => removeSet(ex.wger_id, s.key)}>
                      <X color={colors.textMuted} size={16} />
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(ex.wger_id)}>
                  <Plus color={colors.accent} size={16} />
                  <Text style={styles.addSetText}>Προσθήκη set</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        {/* Exercise Search Modal */}
        <Modal visible={exerciseModalOpen} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Αναζήτηση άσκησης</Text>
                <TouchableOpacity style={styles.iconBtnSm} onPress={() => setExerciseModalOpen(false)}>
                  <X color={colors.text} size={18} />
                </TouchableOpacity>
              </View>

              <View style={styles.searchRow}>
                <Search color={colors.textMuted} size={16} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Γράψε π.χ. bench, squat…"
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  autoFocus
                />
              </View>

              {searching ? (
                <View style={styles.center}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.emptyText}>Αναζήτηση…</Text>
                </View>
              ) : (
                <FlatList
                  data={results}
                  keyExtractor={(i) => String(i.wger_id)}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const img = pickMainImageUrl(item);

                    return (
                      <TouchableOpacity style={styles.resultRow} onPress={() => addExercise(item)}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          {!!img && (
                            <Image
                              source={{ uri: img }}
                              style={styles.resultThumb}
                              resizeMode="cover"
                            />
                          )}

                          <View style={{ flex: 1 }}>
                            <Text style={styles.resultTitle}>{item.name}</Text>
                            <Text style={styles.resultSub} numberOfLines={1}>
                              {item.category_name ?? '—'}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.centerBlock}>
                      <Text style={styles.emptyText}>
                        {q.trim() ? 'Δεν βρέθηκαν αποτελέσματα.' : 'Ξεκίνα να πληκτρολογείς…'}
                      </Text>
                    </View>
                  }
                />
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function cryptoRandomKey() {
  // works in RN (no crypto dependency)
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function pickMainImageUrl(ex: ExerciseCatalogRow): string | null {
  const imgs = ex.images ?? [];
  if (!imgs.length) return null;

  const main = imgs.find(i => i.is_main && i.url);
  return (main?.url ?? imgs[0]?.url ?? null) as string | null;
}


const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },

    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
    headerSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

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
    iconBtnSm: { padding: 6 },

    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
    },
    saveBtnText: { color: '#fff', fontWeight: '900', fontSize: 12 },

    errorText: { marginTop: 8, fontSize: 13, color: '#f97316' },

    addExerciseBtn: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      justifyContent: 'center',
    },
    addExerciseBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
    centerBlock: { paddingVertical: 18, alignItems: 'center' },
    emptyText: { color: colors.textMuted, textAlign: 'center' },

    exerciseCard: {
      marginTop: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
    exerciseTitle: { color: colors.text, fontSize: 15, fontWeight: '900', flexShrink: 1 },

    setHeaderRow: { flexDirection: 'row', marginTop: 12, paddingBottom: 6 },
    setHeaderText: { flex: 1, color: colors.textMuted, fontSize: 12, fontWeight: '800' },

    setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    setNo: { width: 24, color: colors.text, fontWeight: '900' },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.textMuted,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: colors.text,
      backgroundColor: colors.bg,
      textAlign: 'center',
      fontWeight: '800',
    },

    addSetBtn: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    addSetText: { color: colors.accent, fontWeight: '900' },

    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      height: '80%',
      backgroundColor: colors.bg,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },

    searchRow: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.textMuted,
      borderRadius: 12,
      paddingHorizontal: 10,
      backgroundColor: colors.card,
    },
    searchInput: { flex: 1, color: colors.text, paddingVertical: 10, fontWeight: '700' },

    resultRow: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.textMuted,
    },
    resultTitle: { color: colors.text, fontWeight: '900', fontSize: 14 },
    resultSub: { marginTop: 3, color: colors.textMuted, fontSize: 12 },

    thumb: {
      width: 42,
      height: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.textMuted,
      backgroundColor: colors.bg,
    },

    resultThumb: {
      width: 40,
      height: 40,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.textMuted,
      backgroundColor: colors.bg,
    },

  });
