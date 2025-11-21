import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  format,
  parseISO,
  isAfter,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
} from 'date-fns';
import { el } from 'date-fns/locale';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../../context/AuthProvider';
import { useTheme, ThemeColors } from '../../context/ThemeProvider';
import {
  getMyBookings,
  MyBooking,
  updateBookingStatus,
} from '../../api/bookings';

type FilterMode = 'all' | 'today' | 'week' | 'date';

export default function MyBookingsScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadBookings = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setError(null);
      const data = await getMyBookings(profile.id);
      setBookings(data);
    } catch (err) {
      console.log(err);
      setError('Κάτι πήγε στραβά κατά τη φόρτωση των κρατήσεων.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  // Initial load
  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Reload κάθε φορά που ανοίγει το tab / παίρνει focus
  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const getStatusLabel = (status: MyBooking['status']) => {
    switch (status) {
      case 'booked':
        return 'Κρατημένο';
      case 'checked_in':
        return 'Checked-in';
      case 'canceled':
        return 'Ακυρωμένο';
      case 'no_show':
        return 'Απουσία';
      default:
        return status;
    }
  };

  const getStatusStyle = (status: MyBooking['status']) => {
    switch (status) {
      case 'booked':
        return styles.statusBooked;
      case 'checked_in':
        return styles.statusCheckedIn;
      case 'canceled':
        return styles.statusCanceled;
      case 'no_show':
        return styles.statusNoShow;
      default:
        return styles.statusDefault;
    }
  };

  // cancel button μόνο αν το session είναι στο μέλλον
  const canCancel = (booking: MyBooking) => {
    if (!booking.session) return false;
    if (booking.status !== 'booked') return false;
    const start = parseISO(booking.session.starts_at);
    return isAfter(start, new Date());
  };

  const handleCancel = async (booking: MyBooking) => {
    if (!booking.session) return;
    try {
      setUpdatingId(booking.id);
      const updated = await updateBookingStatus(booking.id, 'canceled');
      setBookings(prev =>
        prev.map(b =>
          b.id === updated.id ? { ...b, status: updated.status } : b,
        ),
      );
    } catch (err) {
      console.log(err);
      setError('Δεν ήταν δυνατή η ακύρωση της κράτησης.');
    } finally {
      setUpdatingId(null);
    }
  };

  // ----------- ΦΙΛΤΡΑ ΗΜΕΡΟΜΗΝΙΩΝ + LABEL -----------

  const filteredBookings = useMemo(() => {
    if (filter === 'all') return bookings;

    const now = new Date();

    if (filter === 'today') {
      const start = startOfDay(now);
      const end = endOfDay(now);
      return bookings.filter(b => {
        if (!b.session) return false;
        const startDate = parseISO(b.session.starts_at);
        return isWithinInterval(startDate, { start, end });
      });
    }

    if (filter === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      return bookings.filter(b => {
        if (!b.session) return false;
        const startDate = parseISO(b.session.starts_at);
        return isWithinInterval(startDate, { start, end });
      });
    }

    if (filter === 'date' && selectedDate) {
      const start = startOfDay(selectedDate);
      const end = endOfDay(selectedDate);
      return bookings.filter(b => {
        if (!b.session) return false;
        const startDate = parseISO(b.session.starts_at);
        return isWithinInterval(startDate, { start, end });
      });
    }

    return bookings;
  }, [bookings, filter, selectedDate]);

  const rangeLabel = useMemo(() => {
    const now = new Date();

    if (filter === 'all') {
      return 'Όλες οι κρατήσεις';
    }

    if (filter === 'today') {
      const start = startOfDay(now);
      return format(start, 'dd/MM/yyyy');
    }

    if (filter === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      return `${format(start, 'dd/MM')} – ${format(end, 'dd/MM')}`;
    }

    // date
    const base = selectedDate ?? now;
    return `Ημερομηνία: ${format(base, 'dd/MM/yyyy')}`;
  }, [filter, selectedDate]);

  const onChangeDate = (event: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'dismissed') return;
    if (date) {
      setSelectedDate(date);
      setFilter('date');
    }
  };

  const renderFilterChip = (mode: FilterMode | 'all', label: string) => {
    const active = filter === mode;
    return (
      <TouchableOpacity
        key={mode}
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => {
          if (mode === 'date') {
            setShowDatePicker(true);
          }
          setFilter(mode as FilterMode);
        }}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }: { item: MyBooking }) => {
    const session = item.session;
    if (!session) return null;

    const start = parseISO(session.starts_at);
    const dateStr = format(start, 'EEE dd/MM · HH:mm', { locale: el });
    const classTitle = session.class_title ?? 'Μάθημα';
    const description = session.class_description ?? null;

    const isCancelable = canCancel(item);

    return (
      <View style={styles.card}>
        {/* Τίτλος αριστερά – Ημερομηνία/ώρα δεξιά */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{classTitle}</Text>
          <Text style={styles.cardTime}>{dateStr}</Text>
        </View>

        {/* Status badge σε δική του σειρά */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
            <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>

        {/* Περιγραφή μαθήματος */}
        {!!description && (
          <Text style={styles.cardDescription} numberOfLines={3}>
            {description}
          </Text>
        )}

        {/* Footer με ημερομηνία κράτησης + button κάτω */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>
            Κράτηση:{' '}
            {format(parseISO(item.created_at), 'dd/MM/yyyy', { locale: el })}
          </Text>

          {isCancelable && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => handleCancel(item)}
              disabled={updatingId === item.id}
            >
              <Text style={styles.cancelButtonText}>
                {updatingId === item.id ? 'Ακύρωση…' : 'Ακύρωση'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };


  if (!profile?.id) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            Πρέπει πρώτα να συνδεθείς για να δεις τις κρατήσεις σου.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.emptyText}>Φόρτωση κρατήσεων…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.container}>
        {/* Header row όπως στο ClassesScreen */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Οι κρατήσεις μου</Text>
          <Text style={styles.headerSubtitle}>{rangeLabel}</Text>
        </View>

        {/* Φίλτρα ημερομηνίας σαν chips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Φίλτρο</Text>
          <View style={styles.chipRow}>
            {renderFilterChip('all', 'Όλα')}
            {renderFilterChip('today', 'Σήμερα')}
            {renderFilterChip('week', 'Εβδομάδα')}
            {renderFilterChip('date', 'Ημερομηνία')}
          </View>
        </View>


        {filter === 'date' && showDatePicker && (
          <DateTimePicker
            value={selectedDate ?? new Date()}
            mode="date"
            display='default'
            textColor="white"
            themeVariant="dark"
            onChange={onChangeDate}
          />
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={{ flex: 1, marginTop: 8 }}>
          {filteredBookings.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                Δεν βρέθηκαν κρατήσεις για το επιλεγμένο φίλτρο.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredBookings}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 24 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 40,
      backgroundColor: colors.bg,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 8,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '700',
    },
    headerSubtitle: {
      color: colors.textMuted,
      fontSize: 13,
    },
    section: {
      marginTop: 8,
      marginBottom: 4,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 6,
    },
    chipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.textMuted,
      marginRight: 8,
      marginBottom: 6,
      backgroundColor: colors.bg,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 13,
      color: colors.textMuted,
    },
    chipTextActive: {
      color: '#fff',
      fontWeight: '600',
    },

    capacityText: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 4,
      marginBottom: 8,
    },


    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textMuted,
      textAlign: 'center',
    },
    errorText: {
      marginTop: 4,
      fontSize: 13,
      color: '#f97316',
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 6,
      gap: 8,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      flexShrink: 1,
    },
    cardTime: {
      color: colors.accent,
      fontSize: 13,
      textAlign: 'right',
      fontWeight: '800',
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      marginBottom: 6,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#000',
    },
    statusBooked: {
      backgroundColor: colors.accent ?? colors.primary,
    },
    statusCheckedIn: {
      backgroundColor: colors.success,
    },
    statusCanceled: {
      backgroundColor: colors.error ?? '#ef4444',
    },
    statusNoShow: {
      backgroundColor: '#ffc947',
    },
    statusDefault: {
      backgroundColor: colors.textMuted,
    },
    cardDescription: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 10,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    footerText: {
      fontSize: 12,
      color: colors.textMuted,
    },
    cancelButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.error ?? '#ef4444',
    },
    cancelButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.error ?? '#ef4444',
    },

  });
