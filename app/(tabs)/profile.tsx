import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, parseISO, isAfter, subMonths } from 'date-fns';
import { el } from 'date-fns/locale';
import { User, Mail, Phone, Calendar, Activity, CreditCard, LogOut, CaseSensitive, Diff, DollarSign, Sigma, AlarmCheck, ArrowDownFromLine, BookmarkPlus, BanknoteX } from 'lucide-react-native';

import { useAuth } from '../../context/AuthProvider';
import { useTheme, ThemeColors } from '../../context/ThemeProvider';
import { supabase } from '../../lib/supabase';
import BookingsByMonthChart, {
  MonthlyPoint,
} from '../../components/BookingsByMonthChart';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';


type ActiveMembership = {
  id: string;
  status: string | null;
  remaining_sessions: number | null;
  starts_at: string | null;
  ends_at: string | null;
  plan_title: string | null;
  plan_price?: number | null;   // effective price (with discount)
  custom_price?: number | null; // raw custom price snapshot
};


type BookingStats = {
  total: number;
  upcoming: number;
  dropIn: number;
  regular: number;
};


type DebtSummary = {
  membershipDebt: number;
  dropInDebt: number;
  totalDebt: number;
};

type GymInfo = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  website: string | null;
  description: string | null;
};


export default function MyProfileScreen() {
  const { profile, signOut } = useAuth(); // 👈 use your logout fn here if you have one
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyPoint[]>([]);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);

  const [gymInfo, setGymInfo] = useState<GymInfo | null>(null);



  const [membership, setMembership] = useState<ActiveMembership | null>(null);
  const [stats, setStats] = useState<BookingStats>({
    total: 0,
    upcoming: 0,
    dropIn: 0,
    regular: 0,
  });

  const [debtSummary, setDebtSummary] = useState<DebtSummary>({
    membershipDebt: 0,
    dropInDebt: 0,
    totalDebt: 0,
  });


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);



  const loadProfileExtras = useCallback(async () => {
    if (!profile?.id || !profile.tenant_id) return;

    try {
      setError(null);
      setLoading(true);

      // 🔹 Gym info for this tenant
      const { data: gym, error: gymError } = await supabase
        .from('gym_info')
        .select(
          'name, email, phone, address, city, postal_code, website, description'
        )
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle();

      if (gymError) {
        console.log('gymInfo error', gymError);
      } else if (gym) {
        setGymInfo(gym as GymInfo);
      } else {
        setGymInfo(null);
      }

      // 🔹 Active membership
      const { data: memData, error: memError } = await supabase
        .from('memberships')
        .select(`
    id,
    status,
    remaining_sessions,
    starts_at,
    ends_at,
    plan_price,
    custom_price,
    membership_plans ( name )
  `)
        .eq('tenant_id', profile.tenant_id)
        .eq('user_id', profile.id)
        .order('starts_at', { ascending: false })
        .limit(1);


      if (memError) {
        console.log('membership error', memError);
      }

      if (memData && memData.length > 0) {
        const row: any = memData[0];

        const basePrice: number | null = row.plan_price ?? null;
        const customPrice: number | null = row.custom_price ?? null;
        const effectivePrice = customPrice ?? basePrice;

        setMembership({
          id: row.id,
          status: row.status ?? null,
          remaining_sessions: row.remaining_sessions ?? null,
          starts_at: row.starts_at ?? null,
          ends_at: row.ends_at ?? null,
          plan_title: row.membership_plans?.name ?? null,
          plan_price: effectivePrice,
          custom_price: customPrice,
        });
      } else {
        setMembership(null);
      }


      // 🔹 Συνολική οφειλή συνδρομών από memberships.debt
      let membershipDebt = 0;

      const { data: debtRows, error: debtErr } = await supabase
        .from('memberships')
        .select('debt')
        .eq('tenant_id', profile.tenant_id)
        .eq('user_id', profile.id);

      if (!debtErr && debtRows) {
        membershipDebt = (debtRows as any[]).reduce(
          (sum, row) => sum + Number(row.debt ?? 0),
          0,
        );
      }


      // 🔹 Booking stats + monthly chart (only checked_in)
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
    id,
    status,
    booking_type,
    drop_in_price,
    drop_in_paid,
    session:class_sessions ( starts_at )
  `)
        .eq('tenant_id', profile.tenant_id)
        .eq('user_id', profile.id);


      if (bookingError) {
        console.log('booking stats error', bookingError);
      }

      let dropInDebt = 0;


      if (bookingData) {
        const now = new Date();
        let total = 0;
        let upcoming = 0;
        let dropIn = 0;
        let regular = 0;

        const monthlyMap: Record<
          string,
          { date: Date; count: number }
        > = {};

        (bookingData as any[]).forEach((b) => {
          total += 1;

          if (b.session?.starts_at) {
            const sessionDate = parseISO(b.session.starts_at);

            // upcoming = future booked or checked-in
            if (
              isAfter(sessionDate, now) &&
              (b.status === 'booked' || b.status === 'checked_in')
            ) {
              upcoming += 1;
            }

            // ✅ monthly chart: only checked_in
            if (b.status === 'checked_in') {
              const monthKey = format(sessionDate, 'yyyy-MM');
              if (!monthlyMap[monthKey]) {
                monthlyMap[monthKey] = {
                  date: new Date(
                    sessionDate.getFullYear(),
                    sessionDate.getMonth(),
                    1,
                  ),
                  count: 0,
                };
              }
              monthlyMap[monthKey].count += 1;
            }
          }

          // drop-in vs regular
          if (b.booking_type === 'drop_in') {
            dropIn += 1;

            if (!b.drop_in_paid && b.drop_in_price != null) {
              dropInDebt += Number(b.drop_in_price);
            }
          } else {
            regular += 1;
          }
        });

        setDebtSummary({
          membershipDebt,
          dropInDebt,
          totalDebt: membershipDebt + dropInDebt,
        });

        setStats({ total, upcoming, dropIn, regular });

        // last 6 months (always 6, even with 0)
        const nowForMonths = new Date();
        const lastSix: MonthlyPoint[] = [];

        for (let i = 5; i >= 0; i--) {
          const d = subMonths(nowForMonths, i);
          const key = format(d, 'yyyy-MM');
          const count = monthlyMap[key]?.count ?? 0;

          lastSix.push({
            label: format(d, 'MMM', { locale: el }),
            count,
          });
        }

        setMonthlyStats(lastSix);
      }
    } catch (err) {
      console.log('profile extra error', err);
      setError('Κάτι πήγε στραβά κατά τη φόρτωση του προφίλ.');
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.tenant_id]);

  useFocusEffect(
    useCallback(() => {
      // κάθε φορά που ανοίγει / παίρνει focus το Profile tab
      loadProfileExtras();
    }, [loadProfileExtras]),
  );


  const handleLogoutPress = () => {
    setLogoutConfirmVisible(true);
  };

  const handleConfirmLogout = async () => {
    setLogoutConfirmVisible(false);
    try {
      await signOut();
      router.replace('/login');
    } catch (err) {
      console.log('Logout error:', err);
    }
  };

  const handleCancelLogout = () => {
    setLogoutConfirmVisible(false);
  };



  if (!profile?.id) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            Πρέπει πρώτα να συνδεθείς για να δεις το προφίλ σου.
          </Text>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={async () => {
              try {
                await signOut();
                router.replace('/login');
              } catch (err) {
                console.log('Logout error:', err);
              }
            }}
          >
            <LogOut size={18} color="#fff" />
            <Text style={styles.logoutButtonText}>Αποσύνδεση</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const initials =
    (profile.full_name &&
      profile.full_name
        .split(' ')
        .map((p: string) => p[0])
        .join('')
        .toUpperCase()) ||
    (profile.email ? profile.email[0].toUpperCase() : 'U');

  const membershipStatusLabel = (() => {
    const s = membership?.status;
    if (!s) return 'Χωρίς ενεργή συνδρομή';
    if (s === 'active') return 'Ενεργή';
    if (s === 'expired') return 'Ληγμένη';
    if (s === 'canceled') return 'Ακυρωμένη';
    return s;
  })();

  const membershipStatusStyle = (() => {
    const s = membership?.status;
    if (!s) return styles.statusBadgeDefault;
    if (s === 'active') return styles.statusBadgeActive;
    if (s === 'expired') return styles.statusBadgeExpired;
    if (s === 'canceled') return styles.statusBadgeCanceled;
    return styles.statusBadgeDefault;
  })();

  const formatDate = (value: string | null) => {
    if (!value) return '-';
    try {
      return format(parseISO(value), 'dd/MM/yyyy', { locale: el });
    } catch {
      return '-';
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}


        {loading && (
          <View style={[styles.center, { marginTop: 16 }]}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {/* Avatar + Name */}
        <View style={styles.avatarRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.profileName}>
              {profile.full_name || 'Χωρίς όνομα'}
            </Text>
            {profile.email && (
              <Text style={styles.profileSub}>
                {profile.email}
              </Text>
            )}
          </View>
        </View>



        {/* Account info card */}
        {/* <View style={styles.card}>
          <Text style={styles.cardTitle}>Στοιχεία λογαριασμού</Text>

          <View style={styles.row}>
            <User size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>Ονοματεπώνυμο</Text>
            <Text style={styles.rowValue}>
              {profile.full_name || '—'}
            </Text>
          </View>

          {profile.email && (
            <View style={styles.row}>
              <Mail size={16} color={colors.textMuted} />
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{profile.email}</Text>
            </View>
          )}

          {profile.phone && (
            <View style={styles.row}>
              <Phone size={16} color={colors.textMuted} />
              <Text style={styles.rowLabel}>Τηλέφωνο</Text>
              <Text style={styles.rowValue}>{profile.phone}</Text>
            </View>
          )}
        </View> */}

        {/* Membership card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.cardTitle}>Συνδρομή</Text>
            </View>

            <View style={[styles.statusBadge, membershipStatusStyle]}>
              <Text style={styles.statusBadgeText}>
                {membershipStatusLabel}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <CaseSensitive size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>Πρόγραμμα</Text>
            <Text style={styles.rowValue}>
              {membership?.plan_title || '—'}
            </Text>
          </View>

          <View style={styles.row}>
            <Calendar size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>Έναρξη</Text>
            <Text style={styles.rowValue}>
              {formatDate(membership?.starts_at ?? null)}
            </Text>
          </View>

          <View style={styles.row}>
            <Calendar size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>Λήξη</Text>
            <Text style={styles.rowValue}>
              {formatDate(membership?.ends_at ?? null)}
            </Text>
          </View>

          <View style={styles.row}>
            <Diff size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>Απομείναντα μαθήματα</Text>
            <Text style={styles.rowValue}>
              {membership?.remaining_sessions ?? '—'}
            </Text>
          </View>
          <View style={styles.row}>
            <DollarSign size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>Τιμή</Text>
            <Text style={styles.rowValue}>
              {membership?.plan_price != null
                ? `${membership.plan_price.toFixed(2)} €`
                : '—'}
            </Text>
          </View>

        </View>

        {/* Stats card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Στατιστικά</Text>

          <View style={styles.row}>
            <Sigma size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>Σύνολο κρατήσεων</Text>
            <Text style={styles.rowValue}>{stats.total}</Text>
          </View>

          <View style={styles.row}>
            <AlarmCheck size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>Επερχόμενες κρατήσεις</Text>
            <Text style={styles.rowValue}>{stats.upcoming}</Text>
          </View>

          <View style={styles.row}>
            <ArrowDownFromLine size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>Drop-in κρατήσεις</Text>
            <Text style={styles.rowValue}>{stats.dropIn}</Text>
          </View>

          <View style={styles.row}>
            <BookmarkPlus size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>Κανονικές κρατήσεις</Text>
            <Text style={styles.rowValue}>{stats.regular}</Text>
          </View>

        </View>


        {/* 💳 Οφειλές */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Οφειλές</Text>

          <View style={styles.row}>
            <BanknoteX size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>Οφειλή συνδρομών</Text>
            <Text style={[styles.rowValue, { color: debtSummary.membershipDebt > 0 ? (colors.accent ?? '#ef4444') : colors.success }]}>
              {debtSummary.membershipDebt.toFixed(2)} €
            </Text>
          </View>

          <View style={styles.row}>
            <BanknoteX size={16} color={colors.textMuted} />
            <Text style={styles.rowLabel}>Οφειλή Drop-in</Text>
            <Text style={[styles.rowValue, { color: debtSummary.dropInDebt > 0 ? (colors.accent ?? '#ef4444') : colors.success }]}>
              {debtSummary.dropInDebt.toFixed(2)} €
            </Text>
          </View>

          <View
            style={[
              styles.row,
              { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.textMuted },
            ]}
          >
            <Text style={[styles.rowLabel, { fontWeight: '700' }]}>
              Σύνολο οφειλής
            </Text>
            <Text style={[styles.rowValue, { fontWeight: '700', color: debtSummary.totalDebt > 0 ? (colors.error ?? '#ef4444') : colors.success }]}>
              {debtSummary.totalDebt.toFixed(2)} €
            </Text>
          </View>
        </View>

        <BookingsByMonthChart points={monthlyStats} />

                      {/* ⬇️ NEW: Gym info card */}
      {gymInfo && (
        <View style={styles.gymCard}>
          <Text style={styles.gymName}>{gymInfo.name}</Text>

          {(gymInfo.address || gymInfo.city || gymInfo.postal_code) && (
            <Text style={styles.gymLine}>
              {gymInfo.address}
              {gymInfo.city ? `, ${gymInfo.city}` : ''}
              {gymInfo.postal_code ? ` ${gymInfo.postal_code}` : ''}
            </Text>
          )}

          {gymInfo.phone && (
            <Text style={styles.gymLine}>Τηλέφωνο: {gymInfo.phone}</Text>
          )}

          {gymInfo.email && (
            <Text style={styles.gymLine}>Email: {gymInfo.email}</Text>
          )}

          {gymInfo.website && (
            <Text style={styles.gymLine}>{gymInfo.website}</Text>
          )}

          {gymInfo.description && (
            <Text style={styles.gymDescription}>{gymInfo.description}</Text>
          )}
        </View>
      )}



        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogoutPress}
        >
          <LogOut size={18} color="#fff" />
          <Text style={styles.logoutButtonText}>Αποσύνδεση</Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal
        transparent
        visible={logoutConfirmVisible}
        animationType="fade"
        onRequestClose={handleCancelLogout}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Αποσύνδεση</Text>
            <Text style={styles.modalText}>
              Είσαι σίγουρος ότι θέλεις να αποσυνδεθείς;
            </Text>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={handleCancelLogout}
              >
                <Text style={styles.modalButtonSecondaryText}>Άκυρο</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleConfirmLogout}
              >
                <Text style={styles.modalButtonPrimaryText}>Αποσύνδεση</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 12,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '700',
    },
    center: {
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

    avatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    avatarCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: '#fff',
      fontSize: 22,
      fontWeight: '700',
    },
    profileName: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    profileSub: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 13,
    },

    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 8,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    rowLabel: {
      marginLeft: 8,
      fontSize: 13,
      color: colors.textMuted,
      flex: 1,
    },
    rowValue: {
      fontSize: 13,
      color: colors.text,
      fontWeight: '600',
    },

    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#000',
    },
    statusBadgeActive: {
      backgroundColor: colors.success,
    },
    statusBadgeExpired: {
      backgroundColor: colors.error ?? '#ef4444',
    },
    statusBadgeCanceled: {
      backgroundColor: '#f97316',
    },
    statusBadgeDefault: {
      backgroundColor: colors.textMuted,
    },

    logoutButton: {
      marginTop: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.error ?? '#ef4444',
      gap: 8,
      marginBottom: 20,
    },
    logoutButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalBox: {
      width: '80%',
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    modalText: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 16,
    },
    modalButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
    },
    modalButton: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,

    },
    modalButtonSecondary: {
      backgroundColor: 'transparent',
    },
    modalButtonSecondaryText: {
      color: colors.textMuted,
      fontWeight: '600',
    },
    modalButtonPrimary: {
      backgroundColor: colors.error ?? colors.primary,
    },
    modalButtonPrimaryText: {
      color: '#fff',
      fontWeight: '700',
    },
        gymCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    gymName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    gymLine: {
      fontSize: 13,
      color: colors.textMuted,
    },
    gymDescription: {
      marginTop: 6,
      fontSize: 13,
      color: colors.text,
    },

  });
