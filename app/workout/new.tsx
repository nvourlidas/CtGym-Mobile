// app/workout/new.tsx
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
  Pressable,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import { Plus, X, Save, Trash2, Search, ArrowLeft, Dumbbell, Copy } from 'lucide-react-native';

import { useAuth } from '../../context/AuthProvider';
import { useTheme, ThemeColors } from '../../context/ThemeProvider';

import type { ExerciseCatalogRow } from '../../api/exercises';
import {
  getWgerCategories,
  getWgerEquipment,
  getExercisesByCategoryAndEquipment,
} from '../../api/exercises';

import { createWorkout, addWorkoutExercise, addWorkoutSets } from '../../api/workouts';

import { categoryImageFor, equipmentImageFor } from '../../utils/exerciseImages';

import { listAssignedTemplates, getTemplateDetail, type AssignedTemplateRow } from '../../api/templates';

type LocalSet = { key: string; reps: string; weight: string };
type LocalExercise = {
  wger_id: number;
  name: string;
  sets: LocalSet[];
  imageUrl?: string | null;
};

type WgerCategory = { id: number; name: string };
type WgerEquipment = { id: number; name: string };

export default function NewWorkoutScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [workoutName, setWorkoutName] = useState('');

  // templates
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templates, setTemplates] = useState<AssignedTemplateRow[]>([]);

  // saving workout
  const [saving, setSaving] = useState(false);

  // exercise picker modal
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [step, setStep] = useState<'category' | 'equipment' | 'exercise'>('category');

  const [categories, setCategories] = useState<WgerCategory[]>([]);
  const [equipment, setEquipment] = useState<WgerEquipment[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<WgerCategory | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<WgerEquipment | null>(null); // null = All

  // search exercises
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ExerciseCatalogRow[]>([]);

  // workout items
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LocalExercise[]>([]);

  const nowLabel = useMemo(() => format(new Date(), 'EEE dd/MM · HH:mm', { locale: el }), []);

  // Load categories/equipment when exercise modal opens
  useEffect(() => {
    if (!exerciseModalOpen) return;

    (async () => {
      try {
        const [cats, eq] = await Promise.all([getWgerCategories(), getWgerEquipment()]);
        setCategories(cats);
        setEquipment(eq);
      } catch (e) {
        console.log(e);
      }
    })();

    setStep('category');
    setSelectedCategory(null);
    setSelectedEquipment(null);
    setQ('');
    setResults([]);
  }, [exerciseModalOpen]);

  // Search exercises when in "exercise" step
  useEffect(() => {
    if (!exerciseModalOpen) return;
    if (!selectedCategory) return;
    if (step !== 'exercise') return;

    const t = setTimeout(async () => {
      try {
        setSearching(true);
        const data = await getExercisesByCategoryAndEquipment({
          categoryId: selectedCategory.id,
          equipmentId: selectedEquipment?.id ?? null,
          q,
          limit: 60,
        });
        setResults(data);
      } catch (e) {
        console.log(e);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [q, selectedCategory, selectedEquipment, exerciseModalOpen, step]);

  // Load assigned templates when modal opens
  useEffect(() => {
    if (!templateModalOpen) return;
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateModalOpen]);

  const loadTemplates = async () => {
    if (!profile?.id || !profile?.tenant_id) return;

    try {
      setTemplatesLoading(true);
      const rows = await listAssignedTemplates({
        tenantId: profile.tenant_id,
        memberId: profile.id,
        limit: 60,
      });
      setTemplates(rows);
    } catch (e) {
      console.log(e);
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  };

  /**
   * ✅ Applies Option-B fix:
   * getTemplateDetail() must fetch template exercises+sets and then fetch exercise_catalog rows,
   * then join in JS. This file just consumes the final "detail".
   */
  const applyTemplate = async (templateId: string) => {
    if (!profile?.tenant_id) return;

    try {
      setError(null);
      setTemplatesLoading(true);

      const detail = await getTemplateDetail({
        tenantId: profile.tenant_id,
        templateId,
      });

      setWorkoutName((detail.name ?? '').trim() || 'Προπόνηση');

      const mapped: LocalExercise[] = (detail.exercises ?? []).map((ex) => {
        const exerciseName = ex.exercise?.name ?? `Άσκηση #${ex.exercise_wger_id}`;
        const img = ex.exercise ? pickMainImageUrl(ex.exercise as any) : null;

        const setsSorted = (ex.sets ?? [])
          .slice()
          .sort((a: any, b: any) => (a.set_no ?? 0) - (b.set_no ?? 0));

        return {
          wger_id: ex.exercise_wger_id,
          name: exerciseName,
          imageUrl: img,
          sets: setsSorted.length
            ? setsSorted.map((s: any) => ({
              key: cryptoRandomKey(),
              reps: s.reps == null ? '' : String(s.reps),
              weight: s.weight == null ? '' : String(s.weight),
            }))
            : [{ key: cryptoRandomKey(), reps: '', weight: '' }],
        };
      });

      setItems(mapped);
      setTemplateModalOpen(false);
    } catch (e) {
      console.log(e);
      setError('Απέτυχε η φόρτωση template.');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const addExercise = (ex: ExerciseCatalogRow) => {
    setItems((prev) => {
      if (prev.some((p) => p.wger_id === ex.wger_id)) return prev;
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
    setItems((prev) => prev.filter((p) => p.wger_id !== wgerId));
  };

  const addSet = (wgerId: number) => {
    setItems((prev) =>
      prev.map((ex) =>
        ex.wger_id === wgerId
          ? { ...ex, sets: [...ex.sets, { key: cryptoRandomKey(), reps: '', weight: '' }] }
          : ex,
      ),
    );
  };

  const removeSet = (wgerId: number, setKey: string) => {
    setItems((prev) =>
      prev.map((ex) => {
        if (ex.wger_id !== wgerId) return ex;
        const next = ex.sets.filter((s) => s.key !== setKey);
        return { ...ex, sets: next.length ? next : [{ key: cryptoRandomKey(), reps: '', weight: '' }] };
      }),
    );
  };

  const updateSet = (wgerId: number, setKey: string, field: 'reps' | 'weight', value: string) => {
    const clean = value.replace(',', '.');
    setItems((prev) =>
      prev.map((ex) =>
        ex.wger_id === wgerId
          ? { ...ex, sets: ex.sets.map((s) => (s.key === setKey ? { ...s, [field]: clean } : s)) }
          : ex,
      ),
    );
  };

  const onSave = async () => {
    if (!profile?.id) return;

    if (items.length === 0) {
      setError('Πρόσθεσε τουλάχιστον 1 άσκηση.');
      return;
    }

    if (!workoutName.trim()) {
      setError('Βάλε ένα όνομα (π.χ. Chest & Back).');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const workout = await createWorkout(profile.id, new Date().toISOString(), {
        name: workoutName.trim(),
        notes: null,
      });

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
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <X color={colors.text} size={18} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Νέα προπόνηση</Text>
            <Text style={styles.headerSub}>{nowLabel}</Text>
          </View>

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
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

        {/* Name + actions */}
        <View style={styles.metaBlock}>
          <Text style={styles.metaLabel}>Όνομα προπόνησης</Text>
          <TextInput
            value={workoutName}
            onChangeText={setWorkoutName}
            placeholder="π.χ. Chest & Back"
            placeholderTextColor={colors.textMuted}
            style={styles.nameInput}
          />

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.templateBtn]}
              onPress={() => setTemplateModalOpen(true)}
              disabled={saving}
            >
              <Copy color="#fff" size={16} />
              <Text style={styles.templateBtnText}>Χρήση template</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.addExerciseBtnInline]}
              onPress={() => {
                setExerciseModalOpen(true);
                setQ('');
                setResults([]);
              }}
              disabled={saving}
            >
              <Plus color="#fff" size={16} />
              <Text style={styles.addExerciseBtnText}>Προσθήκη άσκησης</Text>
            </TouchableOpacity>
          </View>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Exercises */}
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
                    {!!ex.imageUrl && <Image source={{ uri: ex.imageUrl }} style={styles.thumb} resizeMode="cover" />}
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

        {/* Exercise Picker Modal */}
        <Modal visible={exerciseModalOpen} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
          <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: colors.bg,
                  paddingTop: insets.top,
                  paddingBottom: insets.bottom,
                  paddingLeft: insets.left,
                  paddingRight: insets.right,
                }}
              >
                <View style={{ flex: 1, padding: 14 }}>
                  {/* HEADER */}
                  <View style={styles.modalHeader}>
                    {step !== 'category' ? (
                      <TouchableOpacity
                        style={styles.iconBtnSm}
                        onPress={() => {
                          if (step === 'exercise') {
                            setStep('equipment');
                            setQ('');
                            setResults([]);
                            return;
                          }
                          if (step === 'equipment') {
                            setStep('category');
                            setSelectedEquipment(null);
                            return;
                          }
                        }}
                      >
                        <ArrowLeft color={colors.text} size={18} />
                      </TouchableOpacity>
                    ) : (
                      <View style={{ width: 32 }} />
                    )}

                    <Text style={styles.modalTitle}>
                      {step === 'category' && 'Επιλογή κατηγορίας'}
                      {step === 'equipment' && (selectedCategory?.name ?? 'Εξοπλισμός')}
                      {step === 'exercise' &&
                        `${selectedCategory?.name ?? ''}${selectedEquipment ? ` · ${selectedEquipment.name}` : ' · All'}`}
                    </Text>

                    <TouchableOpacity
                      style={styles.iconBtnSm}
                      onPress={() => {
                        setExerciseModalOpen(false);
                        setStep('category');
                        setSelectedCategory(null);
                        setSelectedEquipment(null);
                        setQ('');
                        setResults([]);
                      }}
                    >
                      <X color={colors.text} size={18} />
                    </TouchableOpacity>
                  </View>

                  {/* STEP 1: CATEGORY */}
                  {step === 'category' && (
                    <FlatList
                      data={categories}
                      keyExtractor={(c) => String(c.id)}
                      numColumns={3}
                      columnWrapperStyle={{ gap: 10, marginBottom: 10 }}
                      contentContainerStyle={{ paddingTop: 14, paddingBottom: 14 }}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.catCard}
                          onPress={() => {
                            setSelectedCategory(item);
                            setSelectedEquipment(null);
                            setStep('equipment');
                            setQ('');
                            setResults([]);
                          }}
                        >
                          {(() => {
                            const img = categoryImageFor(item.name);
                            return img ? (
                              <Image source={{ uri: img }} style={styles.catImg} resizeMode="cover" />
                            ) : (
                              <View style={styles.catImgPlaceholder}>
                                <Dumbbell color={colors.textMuted} size={18} />
                              </View>
                            );
                          })()}
                          <Text style={styles.catLabel} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  )}

                  {/* STEP 2: EQUIPMENT */}
                  {step === 'equipment' && (
                    <FlatList
                      data={[{ id: 0, name: 'All' } as any, ...equipment]}
                      keyExtractor={(e) => String(e.id)}
                      numColumns={2}
                      columnWrapperStyle={{ gap: 10, marginBottom: 10 }}
                      contentContainerStyle={{ paddingTop: 14, paddingBottom: 14 }}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.catCard}
                          onPress={() => {
                            setSelectedEquipment(item.id === 0 ? null : item);
                            setStep('exercise');
                            setQ('');
                            setResults([]);
                          }}
                        >
                          {(() => {
                            const img = equipmentImageFor(item.name);
                            return img ? (
                              <Image source={{ uri: img }} style={styles.catImg} resizeMode="cover" />
                            ) : (
                              <View style={styles.catImgPlaceholder}>
                                <Dumbbell color={colors.textMuted} size={18} />
                              </View>
                            );
                          })()}
                          <Text style={styles.catLabel} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  )}

                  {/* STEP 3: EXERCISE */}
                  {step === 'exercise' && (
                    <>
                      <View style={styles.searchRow}>
                        <Search color={colors.textMuted} size={16} />
                        <TextInput
                          value={q}
                          onChangeText={setQ}
                          placeholder="Αναζήτηση ασκήσεων…"
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
                          keyboardDismissMode="on-drag"
                          renderItem={({ item }) => {
                            const img = pickMainImageUrl(item);
                            return (
                              <TouchableOpacity style={styles.resultRow} onPress={() => addExercise(item)}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                  {!!img && <Image source={{ uri: img }} style={styles.resultThumb} resizeMode="cover" />}

                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.resultTitle}>{item.name}</Text>
                                    <Text style={styles.resultSub} numberOfLines={1}>
                                      {selectedCategory?.name ?? item.category_name ?? '—'}
                                      {selectedEquipment ? ` · ${selectedEquipment.name}` : ''}
                                    </Text>
                                  </View>
                                </View>
                              </TouchableOpacity>
                            );
                          }}
                          ListEmptyComponent={
                            <View style={styles.centerBlock}>
                              <Text style={styles.emptyText}>
                                {q.trim() ? 'Δεν βρέθηκαν αποτελέσματα.' : 'Δεν βρέθηκαν ασκήσεις.'}
                              </Text>
                            </View>
                          }
                        />
                      )}
                    </>
                  )}
                </View>
              </View>
            </SafeAreaView>
          </Pressable>
        </Modal>

        {/* Templates Modal */}
        <Modal visible={templateModalOpen} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={{ flex: 1, padding: 16 }}>
              <View style={styles.modalHeader}>
                <View style={{ width: 32 }} />
                <Text style={styles.modalTitle}>Templates</Text>
                <TouchableOpacity style={styles.iconBtnSm} onPress={() => setTemplateModalOpen(false)}>
                  <X color={colors.text} size={18} />
                </TouchableOpacity>
              </View>

              {templatesLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.emptyText}>Φόρτωση…</Text>
                </View>
              ) : (
                <FlatList
                  data={templates}
                  keyExtractor={(t) => t.assignment_id}
                  contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
                  renderItem={({ item }) => {
                    if (!item.template) return null; // 👈 hard guard

                    const tpl = item.template;

                    const name = (tpl.name ?? '').trim() || 'Χωρίς όνομα';
                    const when = format(
                      new Date(item.assigned_at ?? tpl.created_at),
                      'dd/MM/yyyy',
                      { locale: el }
                    );

                    return (
                      <TouchableOpacity
                        style={styles.templateRow}
                        onPress={() => applyTemplate(item.template_id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.templateTitle}>{name}</Text>
                          <Text style={styles.templateSub} numberOfLines={2}>
                            {when}
                            {item.status ? ` · ${item.status}` : ''}
                            {item.message ? ` · ${item.message}` : ''}
                          </Text>
                        </View>
                        <Copy color={colors.textMuted} size={18} />
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.centerBlock}>
                      <Text style={styles.emptyText}>Δεν υπάρχουν templates για σένα ακόμα.</Text>
                    </View>
                  }
                />
              )}
            </View>
          </SafeAreaView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function cryptoRandomKey() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function pickMainImageUrl(ex: ExerciseCatalogRow): string | null {
  const imgs = ex.images ?? [];
  if (!imgs.length) return null;

  const main = imgs.find((i) => i.is_main && i.url);
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

    resultRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.textMuted },
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

    // Categories grid
    catCard: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.textMuted,
      backgroundColor: colors.card,
      overflow: 'hidden',
      minHeight: 110,
    },
    catImg: { width: '100%', height: 76, backgroundColor: colors.bg },
    catImgPlaceholder: { width: '100%', height: 76, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
    catLabel: { color: colors.text, fontWeight: '900', fontSize: 12, paddingHorizontal: 10, paddingVertical: 8 },

    metaBlock: { marginTop: 12, gap: 8 },
    metaLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '900' },

    nameInput: {
      borderWidth: 1,
      borderColor: colors.textMuted,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.card,
      fontWeight: '900',
    },

    actionsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },

    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
    },

    templateBtn: { backgroundColor: colors.primary },
    templateBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },

    addExerciseBtnInline: { backgroundColor: colors.primary },
    addExerciseBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },

    templateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.textMuted,
      borderRadius: 12,
      backgroundColor: colors.card,
      marginBottom: 10,
    },
    templateTitle: { color: colors.text, fontWeight: '900', fontSize: 14 },
    templateSub: { marginTop: 2, color: colors.textMuted, fontSize: 12 },
  });
