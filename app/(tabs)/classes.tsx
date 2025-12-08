import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthProvider';
import { supabase } from '../../lib/supabase';
import {
  getMyBookingsForSession,
  bookSession,
  updateBookingStatus,
  bookDropInSession,
} from '../../api/bookings';
import {
  startOfDay,
  endOfDay,
  format,
  parseISO,
} from 'date-fns';
import SessionCard from '../../components/SessionCard';
import WeekDateFilter from '../../components/WeekDateFilter';
import CategoryFilter from '../../components/CategoryFilter';
import { useTheme } from '../../context/ThemeProvider';
import { ThemeColors } from '../../context/ThemeProvider';
import { el } from 'date-fns/locale';
import { ChevronDown, ChevronRight } from 'lucide-react-native';

type ClassSession = {
  id: string;
  tenant_id: string;
  class_id: string;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  cancel_before_hours: number | null;
  classes: {
    title: string;
    description?: string | null;
    category_id?: string | null;
    drop_in_enabled?: boolean | null;
    drop_in_price?: number | null;
    member_drop_in_price?: number | null;
    coaches: {
      full_name: string | null;
    } | null;
  } | null;
};

type ClassCategory = {
  id: string;
  color?: string | null;
  [key: string]: any;
};

type ActiveMembership = {
  id: string;
  tenant_id: string;
  user_id: string;
  plan_id: string | null;
  status?: string | null;
  plan_category_ids: string[];
};

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
  const [dropInDebt, setDropInDebt] = useState<number>(0);

  const [categories, setCategories] = useState<ClassCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] =
    useState<string | 'all'>('all');

  // single selectedDate
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // accordion state
  const [showMorning, setShowMorning] = useState(true);
  const [showAfternoon, setShowAfternoon] = useState(true);
  const [showEvening, setShowEvening] = useState(true);

  const handleRefresh = async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      await fetchSessions();
    } finally {
      setRefreshing(false);
    }
  };

  const adjustRemaining = (sessionId: string, delta: number) => {
    setRemainingSeats((prev) => {
      const current = prev[sessionId];
      if (current == null) return prev;

      return {
        ...prev,
        [sessionId]: Math.max(0, current + delta),
      };
    });
  };

  useEffect(() => {
    if (!profile) return;

    const loadDropInDebt = async () => {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('booking_type, drop_in_price, drop_in_paid')
          .eq('tenant_id', profile.tenant_id)
          .eq('user_id', profile.id);

        if (error) {
          console.log('drop-in debt error', error);
          return;
        }

        const total = (data ?? []).reduce((sum, row: any) => {
          if (
            row.booking_type === 'drop_in' &&
            !row.drop_in_paid &&
            row.drop_in_price != null
          ) {
            return sum + Number(row.drop_in_price);
          }
          return sum;
        }, 0);

        setDropInDebt(total);
      } catch (err) {
        console.log('drop-in debt unexpected error', err);
      }
    };

    loadDropInDebt();
  }, [profile]);

  // ---- Load categories + membership once we know profile ----
  useEffect(() => {
    if (!profile) return;

    const loadTenantAndCategories = async () => {
      try {
        // Categories
        const { data: catData, error: catError } = await supabase
          .from('class_categories')
          .select('*')
          .eq('tenant_id', profile.tenant_id);

        if (catError) {
          console.log('catError', catError);
        } else if (catData) {
          setCategories(catData as ClassCategory[]);
        }

        // Active membership
        const { data: memData, error: memError } = await supabase
          .from('memberships')
          .select(
            `
      id, tenant_id, user_id, plan_id, status,
      membership_plans (
        membership_plan_categories (
          category_id
        )
      )
    `
          )
          .eq('tenant_id', profile.tenant_id)
          .eq('user_id', profile.id)
          .order('starts_at', { ascending: false })
          .limit(1);

        if (memError) {
          console.log('memError', memError);
          setActiveMembership(null);
        } else if (memData && memData.length > 0) {
          const row = memData[0] as any;

          const links =
            row.membership_plans?.membership_plan_categories ?? [];

          const categoryIds: string[] = links
            .map((l: any) => l?.category_id)
            .filter(
              (id: any) => typeof id === 'string' && id.trim().length > 0,
            );

          const membership: ActiveMembership = {
            id: row.id,
            tenant_id: row.tenant_id,
            user_id: row.user_id,
            plan_id: row.plan_id ?? null,
            status: row.status,
            plan_category_ids: categoryIds,
          };

          setActiveMembership(membership);
        } else {
          console.log('No membership found for user', profile.id);
          setActiveMembership(null);
        }
      } catch (err) {
        console.log('loadTenantAndCategories error', err);
      }
    };

    loadTenantAndCategories();
  }, [profile]);

  // ---- Date range based on selectedDate ----
  const { rangeStart, rangeEnd, label } = useMemo(() => {
    const base = selectedDate || new Date();
    const start = startOfDay(base);
    const end = endOfDay(base);

    return {
      rangeStart: start,
      rangeEnd: end,
      label: format(start, 'EEE dd/MM/yyyy', { locale: el }),
    };
  }, [selectedDate]);

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

      // filter by category (if not 'all')
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

      // sessions in date range (selected day)
      let query = supabase
        .from('class_sessions')
        .select(
          `
    id,
    tenant_id,
    class_id,
    starts_at,
    ends_at,
    capacity,
    cancel_before_hours,          
    classes (
      title,
      description,
      category_id,
      drop_in_enabled,
      drop_in_price,
      member_drop_in_price,
      coaches (
        full_name
      )
    )
  `,
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

      // filter out past sessions
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

      // remaining seats map
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

      // Load booking state for each session
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

    const prevStatus = bookingStates[sessionId]?.status ?? null;

    try {
      const booking = await bookSession(profile.tenant_id, sessionId, profile.id);

      setBookingStates((prev) => ({
        ...prev,
        [sessionId]: { id: booking.id, status: booking.status },
      }));

      if ((prevStatus === null || prevStatus === 'canceled') && booking.status === 'booked') {
        adjustRemaining(sessionId, -1);
      }
    } catch (err) {
      throw err;
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
        null,
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

      if (prevStatus === 'booked' && updated.status === 'canceled') {
        adjustRemaining(sessionId, +1);
      }
    } catch (err) {
      console.log('cancel error', err);
    } finally {
      setBookingLoadingId(null);
    }
  };

  const getCategoryLabel = (cat: ClassCategory) =>
    cat.name || (cat as any).title || 'Κατηγορία';

  // helper: render a single SessionCard for a session
  const renderSessionCard = (item: ClassSession) => {
    const start = parseISO(item.starts_at);
    const timeStr = format(start, 'EEE dd/MM · HH:mm', { locale: el });
    const title = item.classes?.title ?? 'Μάθημα';
    const description = item.classes?.description ?? null;
    const booking = bookingStates[item.id] ?? null;
    const isLoading = bookingLoadingId === item.id;
    const bookingStatus = booking?.status ?? null;

    const rawDropInEnabled = item.classes?.drop_in_enabled ?? false;

    const baseDropInPrice = item.classes?.drop_in_price ?? null;
    const memberDropInPrice = item.classes?.member_drop_in_price ?? null;

    // έχει ενεργή συνδρομή (όποιο πλάνο, δεν μας νοιάζει η κατηγορία εδώ)
    const hasActiveMembership =
      !!activeMembership && activeMembership.status === 'active';

    // Αν έχει ενεργή συνδρομή και ορίζεται member_drop_in_price -> πάρε αυτό,
    // αλλιώς πάρε την κλασική drop_in_price
    const dropInPrice =
      hasActiveMembership && memberDropInPrice != null
        ? memberDropInPrice
        : baseDropInPrice;

    // όριο οφειλής από profile.max_dropin_debt
    const maxDropInDebt = (profile as any)?.max_dropin_debt ?? null;
    const hasDebtLimit =
      maxDropInDebt !== null && maxDropInDebt !== undefined;

    // αν έχει οφειλή drop-in πάνω από το όριο → κλείδωμα drop-in
    const dropInDebtLimitExceeded =
      hasDebtLimit && dropInDebt >= Number(maxDropInDebt);

    // τελικό αν επιτρέπεται drop-in για αυτό το μάθημα
    const dropInEnabled = rawDropInEnabled && !dropInDebtLimitExceeded;

    // ❌ Disable cancel when we are inside the "cancel_before_hours" window
    const cancelBeforeHours = item.cancel_before_hours ?? null;
    let cancelDisabled = false;

    if (cancelBeforeHours != null) {
      const now = new Date();
      const diffMs = start.getTime() - now.getTime(); // πόσο πριν την έναρξη
      const diffHours = diffMs / (1000 * 60 * 60);

      // Αν μένουν λιγότερες ώρες από το όριο, δεν επιτρέπεται ακύρωση
      if (diffHours < cancelBeforeHours) {
        cancelDisabled = true;
      }
    }

    let categoryLabel: string | null = null;
    let categoryColor: string | null = null;
    if (item.classes?.category_id) {
      const catRow = categories.find(
        (c: ClassCategory) => String(c.id) === String(item.classes!.category_id),
      );
      if (catRow) {
        categoryLabel = getCategoryLabel(catRow);
        categoryColor = catRow.color ?? null;
      }
    }

    const classCategoryId = item.classes?.category_id ?? null;
    const membershipCategoryIds =
      activeMembership?.plan_category_ids ?? [];

    let canBookWithMembership = false;

    if (activeMembership && activeMembership.status === 'active') {
      if (membershipCategoryIds.length === 0) {
        // πλάνο χωρίς κατηγορίες → ισχύει για όλα τα μαθήματα
        canBookWithMembership = true;
      } else if (classCategoryId == null) {
        // μάθημα χωρίς κατηγορία → το αφήνουμε να περνάει
        canBookWithMembership = true;
      } else {
        // μάθημα επιτρέπεται αν η κατηγορία του είναι μέσα στις κατηγορίες του πλάνου
        canBookWithMembership = membershipCategoryIds.some(
          (cid) => String(cid) === String(classCategoryId),
        );
      }
    }

    const remaining = remainingSeats[item.id] ?? null;

    return (
      <SessionCard
        key={item.id}
        title={title}
        description={description}
        timeLabel={timeStr}
        capacity={item.capacity}
        remainingSeats={remaining}
        bookingStatus={bookingStatus}
        isLoading={isLoading}
        canBookWithMembership={canBookWithMembership}
        dropInEnabled={dropInEnabled}
        dropInPrice={dropInPrice}
        onBook={() => handleBook(item.id)}
        onCancel={() => handleCancel(item.id)}
        onDropIn={() => handleDropIn(item.id)}
        cancelDisabled={cancelDisabled}
        cancelBeforeHours={cancelBeforeHours}
        categoryLabel={categoryLabel}
        categoryColor={categoryColor}
        startAt={item.starts_at}
        endAt={item.ends_at}
        coachName={item.classes?.coaches?.full_name ?? null}
      />
    );
  };

  // group sessions by time of day
  const groupedSessions = useMemo(() => {
    const morning: ClassSession[] = [];
    const afternoon: ClassSession[] = [];
    const evening: ClassSession[] = [];

    sessions.forEach((s) => {
      try {
        const d = parseISO(s.starts_at);
        const hour = d.getHours(); // local hour

        if (hour >= 6 && hour < 13) {
          morning.push(s);
        } else if (hour >= 13 && hour < 17) {
          afternoon.push(s);
        } else {
          // 17:00–00:00 (και οτιδήποτε άλλο πέφτει εκτός, το βάζουμε εδώ)
          evening.push(s);
        }
      } catch {
        evening.push(s);
      }
    });

    return { morning, afternoon, evening };
  }, [sessions]);

  const renderAccordionSection = (
    title: string,
    subtitle: string,
    list: ClassSession[],
    isOpen: boolean,
    toggle: () => void,
  ) => (
    <View style={styles.accordionSection}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={toggle}
        activeOpacity={0.8}
      >
        <View>
          <Text style={styles.accordionTitle}>{title}</Text>
          <Text style={styles.accordionSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.accordionRight}>
          <Text style={styles.accordionCount}>
            {list.length} μαθήματα
          </Text>
          {isOpen ? (
            <ChevronDown size={18} color={colors.text} />
          ) : (
            <ChevronRight size={18} color={colors.text} />
          )}
        </View>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.accordionBody}>
          {list.length === 0 ? (
            <Text style={styles.accordionEmpty}>
              Δεν υπάρχουν μαθήματα σε αυτή τη ζώνη.
            </Text>
          ) : (
            list.map((s) => (
              <View key={s.id} style={styles.sessionWrapper}>
                {renderSessionCard(s)}
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );

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
        <Text style={styles.headerTitle}>Τμήματα</Text>
        <Text style={styles.headerSubtitle}>{label}</Text>
      </View>

      {/* Week date filter */}
      <WeekDateFilter
        selectedDate={selectedDate}
        onChange={setSelectedDate}
      />

      {/* Categories row */}
      {categories.length > 0 && (
        <CategoryFilter
          title="Κατηγορίες"
          items={[{ id: 'all', label: 'Όλες' }, ...categories]}
          selectedId={selectedCategoryId}
          onChange={(id) => setSelectedCategoryId(id)}
          getLabel={(item: any) =>
            item.id === 'all' ? item.label : getCategoryLabel(item)
          }
          showReset={true}
        />
      )}

      {/* Sessions – accordion layout */}
      <View style={{ flex: 1, marginTop: 8 }}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              Δεν υπάρχουν μαθήματα για αυτή την ημέρα.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.accent}
              />
            }
          >
            {renderAccordionSection(
              'Πρωινά',
              '06:00 – 13:00',
              groupedSessions.morning,
              showMorning,
              () => setShowMorning((v) => !v),
            )}
            {renderAccordionSection(
              'Απόγευμα',
              '13:00 – 17:00',
              groupedSessions.afternoon,
              showAfternoon,
              () => setShowAfternoon((v) => !v),
            )}
            {renderAccordionSection(
              'Βραδινά',
              '17:00 – 00:00',
              groupedSessions.evening,
              showEvening,
              () => setShowEvening((v) => !v),
            )}
          </ScrollView>
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
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textMuted,
      textAlign: 'center',
    },
    // Accordion styles
    accordionSection: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.textMuted,
      backgroundColor: colors.card,
      marginBottom: 10,
      overflow: 'hidden',
    },
    accordionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    accordionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    accordionSubtitle: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 12,
    },
    accordionRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    accordionCount: {
      color: colors.textMuted,
      fontSize: 12,
      marginRight: 8,
    },
    accordionBody: {
      paddingHorizontal: 12,
      paddingBottom: 10,
    },
    accordionEmpty: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 4,
    },
    sessionWrapper: {
      marginTop: 8,
    },
  });
