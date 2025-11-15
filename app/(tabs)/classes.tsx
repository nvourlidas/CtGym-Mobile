import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useAuth } from '../../context/AuthProvider';
import { supabase } from '../../lib/supabase';
import {
  getMyBookingsForSession,
  bookSession,
  updateBookingStatus,
} from '../../api/bookings';
import { startOfWeek, endOfWeek, format, parseISO } from 'date-fns';
import { colors } from '../../lib/theme';

type ClassSession = {
  id: string;
  tenant_id: string;
  class_id: string;
  starts_at: string; // ISO
  ends_at: string | null;
  capacity: number | null;
  classes: { title: string } | null;
};

export default function ClassesScreen() {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingStates, setBookingStates] = useState<
    Record<string, { id: string; status: string } | null>
  >({});
  const [bookingLoadingId, setBookingLoadingId] = useState<string | null>(null);

  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, 1 = next week, etc.

  const { weekStart, weekEnd, label } = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    const start = startOfWeek(base, { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(base, { weekStartsOn: 1 });
    return {
      weekStart: start,
      weekEnd: end,
      label: `${format(start, 'dd/MM')} – ${format(end, 'dd/MM')}`,
    };
  }, [weekOffset]);

  useEffect(() => {
    if (!profile) return;
    fetchSessions();
  }, [profile, weekStart, weekEnd]);

  const fetchSessions = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('class_sessions')
      .select('id, tenant_id, class_id, starts_at, ends_at, capacity, classes (title)')
      .eq('tenant_id', profile.tenant_id)
      .gte('starts_at', weekStart.toISOString())
      .lte('starts_at', weekEnd.toISOString())
      .order('starts_at', { ascending: true });

    if (error) {
      console.log('fetchSessions error', error);
      setSessions([]);
      setLoading(false);
      return;
    }

    const sessionsData = (data as any) || [];
    setSessions(sessionsData);

    // Load booking state for each session
    const map: Record<string, { id: string; status: string } | null> = {};
    for (const s of sessionsData) {
      try {
        const booking = await getMyBookingsForSession(s.id, profile.id);
        map[s.id] = booking ? { id: booking.id, status: booking.status } : null;
      } catch (err) {
        console.log('booking load err', err);
        map[s.id] = null;
      }
    }
    setBookingStates(map);
    setLoading(false);
  };

  const handleBook = async (sessionId: string) => {
    if (!profile) return;
    setBookingLoadingId(sessionId);
    try {
      const booking = await bookSession(profile.tenant_id, sessionId, profile.id);
      setBookingStates((prev) => ({
        ...prev,
        [sessionId]: { id: booking.id, status: booking.status },
      }));
    } catch (err) {
      console.log('book error', err);
    } finally {
      setBookingLoadingId(null);
    }
  };

  const handleCancel = async (sessionId: string) => {
    const current = bookingStates[sessionId];
    if (!current) return;
    setBookingLoadingId(sessionId);
    try {
      const updated = await updateBookingStatus(current.id, 'canceled');
      setBookingStates((prev) => ({
        ...prev,
        [sessionId]: { id: updated.id, status: updated.status },
      }));
    } catch (err) {
      console.log('cancel error', err);
    } finally {
      setBookingLoadingId(null);
    }
  };

  const renderItem = ({ item }: { item: ClassSession }) => {
    const start = parseISO(item.starts_at);
    const timeStr = format(start, 'EEE dd/MM · HH:mm');
    const title = item.classes?.title ?? 'Μάθημα';
    const booking = bookingStates[item.id] ?? null;
    const isLoading = bookingLoadingId === item.id;

    let actionText = 'Κράτηση';
    let actionFn = () => handleBook(item.id);
    let actionColor = colors.primary;

    if (booking?.status === 'booked') {
      actionText = 'Ακύρωση';
      actionFn = () => handleCancel(item.id);
      actionColor = colors.error;
    } else if (booking?.status === 'canceled') {
      actionText = 'Ξανά κράτηση';
      actionFn = () => handleBook(item.id);
      actionColor = colors.primary;
    }

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardTime}>{timeStr}</Text>
        {item.capacity != null && (
          <Text style={styles.cardCapacity}>Θέσεις: {item.capacity}</Text>
        )}

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: actionColor }]}
          onPress={actionFn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.actionText}>{actionText}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => setWeekOffset((x) => x - 1)}>
          <Text style={styles.navArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Μαθήματα · {label}</Text>
        <TouchableOpacity onPress={() => setWeekOffset((x) => x + 1)}>
          <Text style={styles.navArrow}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : sessions.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Δεν υπάρχουν μαθήματα για αυτή την εβδομάδα.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator = {false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 40,
    backgroundColor: colors.bg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  navArrow: {
    color: colors.primary,
    fontSize: 24,
    paddingHorizontal: 8,
  },
  card: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardTime: {
    color: colors.textMuted,
    fontSize: 14,
  },
  cardCapacity: {
    color: colors.accent,
    marginTop: 6,
    fontSize: 13,
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
  actionBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  actionText: {
    color: 'white',
    fontWeight: '700',
  },
});
