import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native';
import { useAuth } from '../../context/AuthProvider';
import { supabase } from '../../lib/supabase';
import {
  getMyBookingsForSession,
  bookSession,
  updateBookingStatus,
  bookDropInSession
} from '../../api/bookings';
import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  format,
  parseISO,
} from 'date-fns';
import { Platform } from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import SessionCard from '../../components/SessionCard';
import { useTheme } from '../../context/ThemeProvider';
import { ThemeColors } from '../../context/ThemeProvider';
import { el } from 'date-fns/locale';





type ClassSession = {
  id: string;
  tenant_id: string;
  class_id: string;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  classes: {
    title: string;
    description?: string | null;
    category_id?: string | null;
    drop_in_enabled?: boolean | null;
    drop_in_price?: number | null;   // 👈 NEW
  } | null;
};



// keep it loose since we don't know exact columns of class_categories
type ClassCategory = {
  id: string;
  [key: string]: any;
};

type ActiveMembership = {
  id: string;
  tenant_id: string;
  user_id: string;
  plan_id: string | null;
  status?: string | null;
  membership_plans?: {
    category_id: string | null;
  } | null;
};


type DateFilterMode = 'today' | 'week' | 'custom';

export default function ClassesScreen() {
  const { profile } = useAuth();
  const { colors, logoUrl } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingStates, setBookingStates] = useState<
    Record<string, { id: string; status: string } | null>
  >({});
  const [bookingLoadingId, setBookingLoadingId] = useState<string | null>(null);


  const [activeMembership, setActiveMembership] =
    useState<ActiveMembership | null>(null);


  const [remainingSeats, setRemainingSeats] = useState<
    Record<string, number | null>
  >({});


  const adjustRemaining = (sessionId: string, delta: number) => {
    setRemainingSeats((prev) => {
      const current = prev[sessionId];
      if (current == null) return prev; // αν δεν έχουμε τιμή, μην πειράξεις τίποτα

      return {
        ...prev,
        [sessionId]: Math.max(0, current + delta),
      };
    });
  };

  const [categories, setCategories] = useState<ClassCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] =
    useState<string | 'all'>('all');

  const [dateFilter, setDateFilter] = useState<DateFilterMode>('today');
  const [customDate, setCustomDate] = useState<Date>(new Date());

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      await fetchSessions(); // reuse existing logic
    } finally {
      setRefreshing(false);
    }
  };



  // ---- Load tenant logo + categories once we know profile ----
  useEffect(() => {
    if (!profile) return;

    const loadTenantAndCategories = async () => {
      try {
        // Tenant logo
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants') // 👈 adjust table/column names if different
          .select('logo_url')
          .eq('id', profile.tenant_id)
          .single();


        // Categories
        const { data: catData, error: catError } = await supabase
          .from('class_categories') // 👈 adjust table name if needed
          .select('*')
          .eq('tenant_id', profile.tenant_id);

        // Active membership for this user (join με membership_plans για category)
        const { data: memData, error: memError } = await supabase
          .from('memberships')
          .select(
            'id, tenant_id, user_id, plan_id,status,membership_plans (category_id)'
          )
          .eq('tenant_id', profile.tenant_id)
          .eq('user_id', profile.id)
          .order('starts_at', { ascending: false }) // ή created_at
          .limit(1);


        if (!memError && memData && memData.length > 0) {
          const row = memData[0] as any;

          const membership: ActiveMembership = {
            id: row.id,
            tenant_id: row.tenant_id,
            user_id: row.user_id,
            plan_id: row.membership_plan_id ?? null,
            status: row.status,
            membership_plans: row.membership_plans
              ? { category_id: row.membership_plans.category_id ?? null }
              : null,
          };

          setActiveMembership(membership);
        } else {
          console.log('No membership found for user', profile.id);
          setActiveMembership(null);
        }



        if (!catError && catData) {
          setCategories(catData as ClassCategory[]);
        }
      } catch (err) {
        console.log('loadTenantAndCategories error', err);
      }
    };

    loadTenantAndCategories();
  }, [profile]);

  // ---- Date range based on filter ----
  const { rangeStart, rangeEnd, label } = useMemo(() => {
    const now = new Date();

    if (dateFilter === 'today') {
      const start = startOfDay(now);
      const end = endOfDay(now);
      return {
        rangeStart: start,
        rangeEnd: end,
        label: format(start, 'dd/MM/yyyy'),
      };
    }

    if (dateFilter === 'week') {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      return {
        rangeStart: start,
        rangeEnd: end,
        label: `${format(start, 'dd/MM')} – ${format(end, 'dd/MM')}`,
      };
    }

    // custom date
    const base = customDate || now;
    const start = startOfDay(base);
    const end = endOfDay(base);
    return {
      rangeStart: start,
      rangeEnd: end,
      label: `Ημερομηνία: ${format(start, 'dd/MM/yyyy')}`,
    };
  }, [dateFilter, customDate]);

  // ---- Fetch sessions when profile / date range / category changes ----
  useEffect(() => {
    if (!profile) return;
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, rangeStart, rangeEnd, selectedCategoryId]);

  const fetchSessions = async () => {
    if (!profile) return;
    setLoading(true);

    try {
      let classIds: string[] | null = null;

      // 1) If a specific category is selected, find the classes in that category
      if (selectedCategoryId !== 'all') {
        const { data: cls, error: clsError } = await supabase
          .from('classes')
          .select('id')
          .eq('tenant_id', profile.tenant_id)
          .eq('category_id', selectedCategoryId);

        if (clsError) {
          console.log('fetchSessions classes error', clsError);
          setSessions([]);
          setBookingStates({});
          setLoading(false);
          return;
        }

        classIds = (cls ?? []).map((c: any) => c.id);

        if (!classIds.length) {
          setSessions([]);
          setBookingStates({});
          setLoading(false);
          return;
        }
      }

      // 2) Query sessions in date range
      let query = supabase
        .from('class_sessions')
        .select(
          'id, tenant_id, class_id, starts_at, ends_at, capacity, classes (title, description, category_id, drop_in_enabled, drop_in_price)'
        )
        .eq('tenant_id', profile.tenant_id)
        .gte('starts_at', rangeStart.toISOString())
        .lte('starts_at', rangeEnd.toISOString())
        .order('starts_at', { ascending: true });

      if (classIds) {
        query = query.in('class_id', classIds);
      }

      const { data, error } = await query;

      if (error) {
        console.log('fetchSessions error', error);
        setSessions([]);
        setBookingStates({});
        setLoading(false);
        return;
      }

      const sessionsData = (data as any) || [];

      // 🔹 FILTER OUT PAST SESSIONS (datetime < now)
      const now = new Date();
      const upcomingSessions = sessionsData.filter((s: any) => {
        try {
          return parseISO(s.starts_at) > now;
        } catch {
          return false;
        }
      });

      if (!upcomingSessions.length) {
        setSessions([]);
        setBookingStates({});
        setLoading(false);
        return;
      }

      setSessions(upcomingSessions);

      // Remaining seats map (αν το έχεις)
      const remainingMap: Record<string, number | null> = {};
      for (const s of upcomingSessions) {
        if (s.capacity == null) {
          remainingMap[s.id] = null;
          continue;
        }

        const { count, error: countError } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', profile.tenant_id)
          .eq('session_id', s.id)
          .in('status', ['booked', 'checked_in']);

        if (countError) {
          console.log('remaining seats count error', countError);
          remainingMap[s.id] = s.capacity;
        } else {
          remainingMap[s.id] = s.capacity - (count ?? 0);
        }
      }
      setRemainingSeats(remainingMap);

      // Load booking state for each upcoming session
      const map: Record<string, { id: string; status: string } | null> = {};
      for (const s of upcomingSessions) {
        try {
          const booking = await getMyBookingsForSession(s.id, profile.id);
          map[s.id] = booking ? { id: booking.id, status: booking.status } : null;
        } catch (err) {
          console.log('booking load err', err);
          map[s.id] = null;
        }
      }
      setBookingStates(map);
    } catch (err) {
      console.log('fetchSessions unexpected error', err);
      setSessions([]);
      setBookingStates({});
    } finally {
      setLoading(false);
    }
  };




  const handleBook = async (sessionId: string) => {
    if (!profile) return;
    setBookingLoadingId(sessionId);

    // τι status είχαμε πριν;
    const prevStatus = bookingStates[sessionId]?.status ?? null;

    try {
      const booking = await bookSession(profile.tenant_id, sessionId, profile.id);

      setBookingStates((prev) => ({
        ...prev,
        [sessionId]: { id: booking.id, status: booking.status },
      }));

      // αν πριν ήταν null ή canceled και τώρα έγινε booked => -1 διαθέσιμη θέση
      if ((prevStatus === null || prevStatus === 'canceled') && booking.status === 'booked') {
        adjustRemaining(sessionId, -1);
      }
    } catch (err) {
      console.log('book error', err);
    } finally {
      setBookingLoadingId(null);
    }
  };



  const handleDropIn = async (sessionId: string) => {
    if (!profile) return;
    setBookingLoadingId(sessionId);

    const prevStatus = bookingStates[sessionId]?.status ?? null;

    try {
      const booking = await bookDropInSession(
        profile.tenant_id,
        sessionId,
        profile.id,
        null // ή κάποια default τιμή
      );

      setBookingStates((prev) => ({
        ...prev,
        [sessionId]: { id: booking.id, status: booking.status },
      }));

      if ((prevStatus === null || prevStatus === 'canceled') && booking.status === 'booked') {
        adjustRemaining(sessionId, -1);
      }
    } catch (err) {
      console.log('drop-in book error', err);
    } finally {
      setBookingLoadingId(null);
    }
  };




  const handleCancel = async (sessionId: string) => {
    const current = bookingStates[sessionId];
    if (!current) return;

    setBookingLoadingId(sessionId);
    const prevStatus = current.status;

    try {
      const updated = await updateBookingStatus(current.id, 'canceled');

      setBookingStates((prev) => ({
        ...prev,
        [sessionId]: { id: updated.id, status: updated.status },
      }));

      // αν ήμασταν booked και γίναμε canceled => +1 διαθέσιμη θέση
      if (prevStatus === 'booked' && updated.status === 'canceled') {
        adjustRemaining(sessionId, +1);
      }
    } catch (err) {
      console.log('cancel error', err);
    } finally {
      setBookingLoadingId(null);
    }
  };



  const handleCustomDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }

    const currentDate = selectedDate || customDate;
    setCustomDate(currentDate);

    // Close automatically on Android, keep open on iOS if you want
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  };


  const renderItem = ({ item }: { item: ClassSession }) => {
    const start = parseISO(item.starts_at);
    const timeStr = format(start, 'EEE dd/MM · HH:mm', { locale: el });
    const title = item.classes?.title ?? 'Μάθημα';
    const description = item.classes?.description ?? null;
    const booking = bookingStates[item.id] ?? null;
    const isLoading = bookingLoadingId === item.id;
    const bookingStatus = booking?.status ?? null;
    const isPast = start < new Date();

    const classCategoryId = item.classes?.category_id ?? null;

    // category του membership από το membership_plans
    const membershipCategoryId =
      activeMembership?.membership_plans?.category_id ?? null;


    let canBookWithMembership = false;

    if (activeMembership && activeMembership.status === 'active') {
      if (membershipCategoryId == null) {
        // plan χωρίς category => ισχύει για όλα
        canBookWithMembership = true;
      } else if (classCategoryId == null) {
        // μάθημα χωρίς κατηγορία αλλά υπάρχει membership => το αφήνουμε
        canBookWithMembership = true;
      } else {
        canBookWithMembership =
          String(membershipCategoryId) === String(classCategoryId);
      }
    }

    const remaining = remainingSeats[item.id] ?? null;

    const dropInEnabled = item.classes?.drop_in_enabled ?? false;
    const dropInPrice = item.classes?.drop_in_price ?? null;

    return (
      <SessionCard
        title={title}
        description={description}
        timeLabel={timeStr}
        capacity={item.capacity}
        remainingSeats={remainingSeats[item.id] ?? null}
        bookingStatus={bookingStatus}
        isLoading={isLoading}
        canBookWithMembership={canBookWithMembership}
        dropInEnabled={dropInEnabled}
        dropInPrice={dropInPrice}          // 👈 pass price
        onBook={() => handleBook(item.id)}
        onCancel={() => handleCancel(item.id)}
        onDropIn={() => handleDropIn(item.id)}
      />
    );
  };




  // Labels for category chips
  const getCategoryLabel = (cat: ClassCategory) =>
    cat.name || cat.title || 'Κατηγορία';

  return (
    <View style={styles.container}>
      {/* Tenant logo */}
      {logoUrl && (
        <View style={styles.logoWrapper}>
          <Image
            source={{ uri: logoUrl }}
            style={styles.tenantLogo}
            resizeMode="contain"
          />
        </View>
      )}


      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Μαθήματα</Text>
        <Text style={styles.headerSubtitle}>{label}</Text>
      </View>


            {/* Date filter row */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ημέρα</Text>
        <View style={styles.chipRow}>
          {(['today', 'week', 'custom'] as DateFilterMode[]).map((mode) => {
            const isActive = dateFilter === mode;
            let text = 'Σήμερα';
            if (mode === 'week') text = 'Αυτή την εβδομάδα';
            if (mode === 'custom') text = 'Ημερομηνία';

            return (
              <TouchableOpacity
                key={mode}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => {
                  setDateFilter(mode);
                  if (mode === 'custom') {
                    setShowDatePicker(true);
                  }
                }}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Categories row */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Κατηγορίες</Text>
        <FlatList
          horizontal
          data={[{ id: 'all', label: 'Όλες' }, ...categories]}
          keyExtractor={(item: any) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item }: any) => {
            const isAll = item.id === 'all';
            const isActive = selectedCategoryId === item.id;
            const labelText = isAll ? item.label : getCategoryLabel(item);

            return (
              <TouchableOpacity
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setSelectedCategoryId(item.id)}
              >
                <Text
                  style={[styles.chipText, isActive && styles.chipTextActive]}
                >
                  {labelText}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>




      {dateFilter === 'custom' && showDatePicker && (
        <DateTimePicker
          value={customDate}
          mode="date"
          textColor="white"
          themeVariant="dark"
          display={Platform.OS === 'ios' ? 'default' : 'default'}
          onChange={handleCustomDateChange}
        />
      )}

      {/* Sessions list */}
      <View style={{ flex: 1, marginTop: 8 }}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              Δεν υπάρχουν μαθήματα για αυτή την περίοδο.
            </Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        )}
      </View>



    </View>
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
    logoWrapper: {
      alignItems: 'center',
    },
    tenantLogo: {
      width: 190,
      height: 80,
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
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.textMuted,
      marginRight: 8,
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
    rangeLabel: {
      marginTop: 4,
      fontSize: 12,
      color: colors.textMuted,
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
  });
