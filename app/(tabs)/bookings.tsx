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
import { Calendar } from 'react-native-calendars';


import { useAuth } from '../../context/AuthProvider';
import { useTheme, ThemeColors } from '../../context/ThemeProvider';
import {
  getMyBookings,
  MyBooking,
  updateBookingStatus,
} from '../../api/bookings';

type FilterMode = 'all' | 'today' | 'week' | 'date';
type TabKey = 'list' | 'calendar';

export default function MyBookingsScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [activeTab, setActiveTab] = useState<TabKey>('calendar');

  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterMode>('today');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [agendaSelected, setAgendaSelected] = useState(
    format(new Date(), 'yyyy-MM-dd'),
  );

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

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

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

  const getCancelState = (booking: MyBooking) => {
    if (!booking.session) return { show: false, disabled: true };
    if (booking.status !== 'booked') return { show: false, disabled: true };

    const start = parseISO(booking.session.starts_at);
    const now = new Date();

    if (!isAfter(start, now)) return { show: false, disabled: true };

    const cancelBefore = booking.session.cancel_before_hours ?? null;

    if (cancelBefore == null) return { show: true, disabled: false };

    const diffMs = start.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < cancelBefore) return { show: true, disabled: true };

    return { show: true, disabled: false };
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

  // ----------- LIST FILTERS -----------

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

    if (filter === 'all') return 'Όλες οι κρατήσεις';
    if (filter === 'today') return format(startOfDay(now), 'dd/MM/yyyy');

    if (filter === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      return `${format(start, 'dd/MM')} – ${format(end, 'dd/MM')}`;
    }

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

  const renderFilterChip = (mode: FilterMode, label: string) => {
    const active = filter === mode;
    return (
      <TouchableOpacity
        key={mode}
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => {
          if (mode === 'date') setShowDatePicker(true);
          setFilter(mode);
        }}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  // ----------- SHARED CARD RENDER (List + Agenda) -----------

  const renderBookingCard = (item: MyBooking) => {
    const session = item.session;
    if (!session) return null;

    const start = parseISO(session.starts_at);
    const dateStr = format(start, 'EEE dd/MM · HH:mm', { locale: el });
    const classTitle = session.class_title ?? 'Μάθημα';
    const description = session.class_description ?? null;

    const { show, disabled: cancelDisabled } = getCancelState(item);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{classTitle}</Text>
          <Text style={styles.cardTime}>{dateStr}</Text>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
            <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>

        {!!description && (
          <Text style={styles.cardDescription} numberOfLines={3}>
            {description}
          </Text>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>
            Κράτηση:{' '}
            {format(parseISO(item.created_at), 'dd/MM/yyyy', { locale: el })}
          </Text>

          {show && (
            <TouchableOpacity
              style={[
                styles.cancelButton,
                (cancelDisabled || updatingId === item.id) &&
                styles.cancelButtonDisabled,
              ]}
              onPress={() => {
                if (!cancelDisabled && updatingId !== item.id) {
                  handleCancel(item);
                }
              }}
              disabled={cancelDisabled || updatingId === item.id}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  cancelDisabled && { opacity: 0.7 },
                ]}
              >
                {updatingId === item.id
                  ? 'Ακύρωση…'
                  : cancelDisabled
                    ? 'Δεν μπορεί να ακυρωθεί'
                    : 'Ακύρωση'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {show && cancelDisabled && (
          <Text
            style={{
              marginTop: 4,
              fontSize: 12,
              color: colors.textMuted,
            }}
          >
            Δεν μπορεί να ακυρωθεί, έχει περάσει το όριο ακύρωσης.
          </Text>
        )}
      </View>
    );
  };

  const renderListItem = ({ item }: { item: MyBooking }) => renderBookingCard(item);

  // ----------- CALENDAR (Agenda) -----------

  const agendaItems = useMemo(() => {
    const map: Record<string, MyBooking[]> = {};

    for (const b of bookings) {
      if (!b.session) continue;
      const key = format(parseISO(b.session.starts_at), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(b);
    }

    // sort by time in each day
    Object.keys(map).forEach(k => {
      map[k].sort((a, b) => {
        const aT = parseISO(a.session!.starts_at).getTime();
        const bT = parseISO(b.session!.starts_at).getTime();
        return aT - bT;
      });
    });

    return map;
  }, [bookings]);

  const markedDatesBase = useMemo(() => {
    const marks: Record<string, any> = {};
    Object.keys(agendaItems).forEach(dateKey => {
      marks[dateKey] = { marked: true, dotColor: colors.accent };
    });
    return marks;
  }, [agendaItems, colors.accent]);

  const markedDates = useMemo(() => {
    return {
      ...markedDatesBase,
      [agendaSelected]: {
        ...(markedDatesBase[agendaSelected] ?? {}),
        selected: true,
        selectedColor: colors.primary,
      },
    };
  }, [markedDatesBase, agendaSelected, colors.primary]);

  const dayBookings = useMemo(() => {
    return agendaItems[agendaSelected] ?? [];
  }, [agendaItems, agendaSelected]);



  const calendarTheme = useMemo(
    () => ({
      backgroundColor: colors.bg,
      calendarBackground: colors.bg,
      textSectionTitleColor: colors.textMuted,
      dayTextColor: colors.text,
      monthTextColor: colors.text,
      selectedDayBackgroundColor: colors.primary,
      selectedDayTextColor: '#fff',
      todayTextColor: colors.accent,
      dotColor: colors.accent,
      selectedDotColor: '#fff',
      arrowColor: colors.accent,
    }),
    [colors.bg, colors.textMuted, colors.text, colors.primary, colors.accent],
  );



  // ----------- GUARDS -----------

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

  // ----------- UI -----------

  const headerSubtitle =
    activeTab === 'list' ? rangeLabel : 'Όλες οι κρατήσεις';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Οι κρατήσεις μου</Text>
          <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'list' && styles.tabActive]}
            onPress={() => setActiveTab('list')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'list' && styles.tabTextActive,
              ]}
            >
              Λίστα
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'calendar' && styles.tabActive]}
            onPress={() => setActiveTab('calendar')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'calendar' && styles.tabTextActive,
              ]}
            >
              Ημερολόγιο
            </Text>
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* TAB: LIST */}
        {activeTab === 'list' && (
          <>
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
                display="default"
                textColor="white"
                themeVariant="dark"
                onChange={onChangeDate}
              />
            )}

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
                  renderItem={renderListItem}
                  contentContainerStyle={{ paddingBottom: 24 }}
                  refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                  }
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          </>
        )}

        {/* TAB: CALENDAR */}
        {activeTab === 'calendar' && (
          <View style={{ flex: 1, marginTop: 8 }}>
            <View style={styles.calendarWrap}>
              <View style={{ flex: 1, marginTop: 8 }}>
                {/* Calendar */}
                <View style={styles.calendarCard}>
                  <Calendar
                    current={agendaSelected}
                    markedDates={markedDates}
                    firstDay={1}
                    enableSwipeMonths
                    onDayPress={(day: any) => {
                      if (day?.dateString && day.dateString !== agendaSelected) {
                        setAgendaSelected(day.dateString);
                      }
                    }}
                    theme={calendarTheme}
                  />
                </View>

                {/* Day bookings list */}
                <View style={{ flex: 1, marginTop: 10 }}>
                  {dayBookings.length === 0 ? (
                    <View style={styles.center}>
                      <Text style={styles.emptyText}>
                        Δεν υπάρχουν κρατήσεις για αυτή την ημέρα.
                      </Text>
                    </View>
                  ) : (
                    <FlatList
                      data={dayBookings}
                      keyExtractor={b => b.id}
                      renderItem={({ item }) => renderBookingCard(item)}
                      contentContainerStyle={{ paddingBottom: 24 }}
                      refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                      }
                      showsVerticalScrollIndicator={false}
                    />
                  )}
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
      backgroundColor: colors.bg,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 10,
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

    tabBar: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.textMuted,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: colors.card,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    tabActive: {
      backgroundColor: colors.primary,
    },
    tabText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    tabTextActive: {
      color: '#fff',
    },

    section: {
      marginTop: 10,
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

    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 18,
    },
    emptyText: {
      color: colors.textMuted,
      textAlign: 'center',
    },
    errorText: {
      marginTop: 8,
      fontSize: 13,
      color: '#f97316',
    },

    calendarWrap: {
      flex: 1,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.textMuted,
      backgroundColor: colors.bg,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.textMuted,
      marginHorizontal: 12,
      marginTop: 10,
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
      backgroundColor: colors.primary,
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
    cancelButtonDisabled: {
      opacity: 0.4,
    },

    calendarCard: {
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.textMuted,
      backgroundColor: colors.bg,
    },

  });
