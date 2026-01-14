import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import {
  format,
  parseISO,
  isWithinInterval,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { el } from 'date-fns/locale';
import {
  Plus,
  Dumbbell,
  Search,
  CalendarDays,
  X,
  Flame,
  Layers,
  BarChart3,
  CalendarCheck,
} from 'lucide-react-native';


import { useAuth } from '../../context/AuthProvider';
import { useTheme, ThemeColors } from '../../context/ThemeProvider';
import { listMyWorkouts, WorkoutRow } from '../../api/workouts';

// If you already have your own DatePicker component, use it.
// This uses community picker (as modal).
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

function normalize(v: string) {
  return (v ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function WorkoutsScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [items, setItems] = useState<WorkoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState('');
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  // Date picker internal state
  const [picking, setPicking] = useState<'from' | 'to'>('from');
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setError(null);
      // Load a bit more so search/filter feels useful
      const data = await listMyWorkouts(profile.id, 120);
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

  const clearFilters = () => {
    setQ('');
    setFromDate(null);
    setToDate(null);
  };

  const dateLabel = useMemo(() => {
    if (!fromDate && !toDate) return 'Όλες οι ημερομηνίες';
    const f = fromDate ? format(fromDate, 'dd/MM/yyyy', { locale: el }) : '…';
    const t = toDate ? format(toDate, 'dd/MM/yyyy', { locale: el }) : '…';
    return `${f} → ${t}`;
  }, [fromDate, toDate]);

  const filtered = useMemo(() => {
    const nq = normalize(q);
    const hasQ = nq.length > 0;

    const hasRange = !!fromDate || !!toDate;
    const start = fromDate ? startOfDay(fromDate) : null;
    const end = toDate ? endOfDay(toDate) : null;

    return items.filter((w) => {
      // search
      if (hasQ) {
        const hay = normalize(`${w.name ?? ''} ${w.notes ?? ''}`);
        if (!hay.includes(nq)) return false;
      }

      // date range
      if (hasRange) {
        const d = parseISO(w.performed_at);
        const ok =
          isWithinInterval(d, {
            start: start ?? new Date(0),
            end: end ?? new Date('2999-12-31'),
          });
        if (!ok) return false;
      }

      return true;
    });
  }, [items, q, fromDate, toDate]);

  // Metrics
  const metrics = useMemo(() => {
    const total = filtered.length;

    const now = new Date();
    const wkStart = startOfWeek(now, { weekStartsOn: 1 });
    const wkEnd = endOfWeek(now, { weekStartsOn: 1 });

    const thisWeek = filtered.filter((w) => {
      const d = parseISO(w.performed_at);
      return isWithinInterval(d, { start: wkStart, end: wkEnd });
    }).length;

    const totalExercises = filtered.reduce((sum, w) => sum + (w.workout_exercises?.length ?? 0), 0);

    // Unique exercise count is not available from list endpoint (only ids of workout_exercises).
    // So we show "total exercises across workouts" and keep it accurate.
    // If you want true unique exercises, we can extend listMyWorkouts select to include exercise_wger_id.
    const avgExercises = total === 0 ? 0 : Math.round((totalExercises / total) * 10) / 10;

    return { total, thisWeek, totalExercises, avgExercises };
  }, [filtered]);

  const openDateModal = () => setDateModalOpen(true);

  const openPicker = (mode: 'from' | 'to') => {
    setPicking(mode);
    setShowPicker(true);
  };

  const onPickDate = (event: DateTimePickerEvent, date?: Date) => {
    setShowPicker(false);
    if (event.type !== 'set' || !date) return;

    if (picking === 'from') {
      setFromDate(date);
      // if end is before start, clear end
      if (toDate && endOfDay(toDate) < startOfDay(date)) setToDate(null);
    } else {
      setToDate(date);
    }
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
          <View style={{ flex: 1 }}>
            {!!(item.name ?? '').trim() && (
              <Text style={styles.cardName} numberOfLines={1}>
                {item.name}
              </Text>
            )}
            <Text style={styles.cardTitle}>{dateStr}</Text>
          </View>

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
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Dumbbell color={colors.accent} size={20} />
            <Text style={styles.headerTitle}>Προπονήσεις</Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/workout/new')}>
            <Plus color="#fff" size={16} />
            <Text style={styles.primaryBtnText}>Νέα</Text>
          </TouchableOpacity>
        </View>

        {/* Search + Filters */}
        <View style={styles.filtersBlock}>
          <View style={styles.searchRow}>
            <Search color={colors.textMuted} size={16} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Αναζήτηση (όνομα ή σημειώσεις)…"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {!!q.trim() && (
              <TouchableOpacity style={styles.iconBtnSm} onPress={() => setQ('')}>
                <X color={colors.textMuted} size={16} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filterRow}>
            <TouchableOpacity style={styles.filterChip} onPress={openDateModal}>
              <CalendarDays color={colors.textMuted} size={16} />
              <Text style={styles.filterChipText} numberOfLines={1}>
                {dateLabel}
              </Text>
            </TouchableOpacity>

            {(fromDate || toDate || q.trim()) && (
              <TouchableOpacity style={styles.clearChip} onPress={clearFilters}>
                <X color={colors.textMuted} size={16} />
                <Text style={styles.clearChipText}>Καθαρισμός</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Metrics */}
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, styles.metricBlue]}>
            <View style={styles.metricHeader}>
              <Layers color="#3b82f6" size={18} />
              <Text style={styles.metricLabel}>Σύνολο</Text>
            </View>
            <Text style={styles.metricValue}>{metrics.total}</Text>
          </View>

          <View style={[styles.metricCard, styles.metricGreen]}>
            <View style={styles.metricHeader}>
              <CalendarCheck color="#22c55e" size={18} />
              <Text style={styles.metricLabel}>Εβδομάδα</Text>
            </View>
            <Text style={styles.metricValue}>{metrics.thisWeek}</Text>
          </View>

          <View style={[styles.metricCard, styles.metricOrange]}>
            <View style={styles.metricHeader}>
              <Flame color="#f97316" size={18} />
              <Text style={styles.metricLabel}>Σύνολο ασκήσεων</Text>
            </View>
            <Text style={styles.metricValue}>{metrics.totalExercises}</Text>
          </View>

          <View style={[styles.metricCard, styles.metricPurple]}>
            <View style={styles.metricHeader}>
              <BarChart3 color="#a855f7" size={18} />
              <Text style={styles.metricLabel}>Μ.Ο. / προπόνηση</Text>
            </View>
            <Text style={styles.metricValue}>{metrics.avgExercises}</Text>
          </View>
        </View>


        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* List */}
        <View style={{ flex: 1, marginTop: 10 }}>
          {!loading && filtered.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {items.length === 0
                  ? 'Δεν έχεις καταγεγραμμένες προπονήσεις.'
                  : 'Δεν βρέθηκαν προπονήσεις με αυτά τα φίλτρα.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(i) => i.id}
              renderItem={renderItem}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          )}
        </View>

        {/* Date filter modal */}
        <Modal visible={dateModalOpen} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={{ flex: 1, padding: 16 }}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Φίλτρο ημερομηνίας</Text>
                <TouchableOpacity style={styles.iconBtnSm} onPress={() => setDateModalOpen(false)}>
                  <X color={colors.text} size={18} />
                </TouchableOpacity>
              </View>

              <View style={styles.dateBox}>
                <Text style={styles.dateLabel}>Από</Text>
                <TouchableOpacity style={styles.dateBtn} onPress={() => openPicker('from')}>
                  <Text style={styles.dateBtnText}>
                    {fromDate ? format(fromDate, 'dd/MM/yyyy', { locale: el }) : 'Επιλογή'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dateBox}>
                <Text style={styles.dateLabel}>Έως</Text>
                <TouchableOpacity style={styles.dateBtn} onPress={() => openPicker('to')}>
                  <Text style={styles.dateBtnText}>
                    {toDate ? format(toDate, 'dd/MM/yyyy', { locale: el }) : 'Επιλογή'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { flex: 1 }]}
                  onPress={() => {
                    setFromDate(null);
                    setToDate(null);
                  }}
                >
                  <Text style={styles.secondaryBtnText}>Καθαρισμός</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryWideBtn, { flex: 1 }]}
                  onPress={() => setDateModalOpen(false)}
                >
                  <Text style={styles.primaryWideBtnText}>Εφαρμογή</Text>
                </TouchableOpacity>
              </View>

              {showPicker && (
                <DateTimePicker
                  value={picking === 'from' ? fromDate ?? new Date() : toDate ?? new Date()}
                  mode="date"
                  display="inline"
                  onChange={onPickDate}
                />
              )}
            </View>
          </SafeAreaView>
        </Modal>

        {(loading || refreshing) && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
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
    headerTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },

    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },

    filtersBlock: { marginTop: 12, gap: 10 },

    searchRow: {
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
    iconBtnSm: { padding: 6 },

    filterRow: { flexDirection: 'row', gap: 10 },
    filterChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    filterChipText: { color: colors.text, fontWeight: '800', flexShrink: 1 },

    clearChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    clearChipText: { color: colors.textMuted, fontWeight: '900' },

    metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    metricCard: {
      width: '48%',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.textMuted,
      borderRadius: 14,
      padding: 12,
    },
    metricLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '900' },
    metricValue: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 4 },

    errorText: { marginTop: 8, fontSize: 13, color: '#f97316' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: colors.textMuted, textAlign: 'center' },

    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.textMuted,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },

    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    cardTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '800', flexShrink: 1 },
    cardName: { color: colors.text, fontSize: 16, fontWeight: '900' },
    cardSub: { marginTop: 8, color: colors.textMuted, fontSize: 13 },

    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.accent + '20', // 👈 soft tint
      borderWidth: 0,
    },
    badgeText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '900',
    },


    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    modalTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },

    dateBox: {
      marginTop: 10,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.textMuted,
      backgroundColor: colors.card,
    },
    dateLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '900' },
    dateBtn: {
      marginTop: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.textMuted,
      backgroundColor: colors.bg,
    },
    dateBtnText: { color: colors.text, fontWeight: '900' },

    secondaryBtn: {
      borderWidth: 1,
      borderColor: colors.textMuted,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtnText: { color: colors.text, fontWeight: '900' },

    primaryWideBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryWideBtnText: { color: '#fff', fontWeight: '900' },

    loadingOverlay: {
      position: 'absolute',
      right: 16,
      top: 16,
      opacity: 0.7,
    },

    metricHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    metricBlue: {
      borderLeftWidth: 4,
      borderLeftColor: '#3b82f6',
    },
    metricGreen: {
      borderLeftWidth: 4,
      borderLeftColor: '#22c55e',
    },
    metricOrange: {
      borderLeftWidth: 4,
      borderLeftColor: '#f97316',
    },
    metricPurple: {
      borderLeftWidth: 4,
      borderLeftColor: '#a855f7',
    },

  });
