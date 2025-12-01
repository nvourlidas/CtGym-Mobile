// src/components/SessionCard.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { Clock, ClockFading, Lock, User2 } from 'lucide-react-native';
import { ThemeColors } from '../context/ThemeProvider';
import { useTheme } from '../context/ThemeProvider';

type SessionCardProps = {
  title: string;
  description: string | null;
  timeLabel: string;
  capacity: number | null;
  remainingSeats: number | null;
  bookingStatus: string | null;
  isLoading: boolean;
  canBookWithMembership: boolean;
  dropInEnabled: boolean;
  dropInPrice: number | null;
  onBook: () => void;
  onCancel: () => void;
  onDropIn: () => void;
  cancelDisabled?: boolean;
  cancelBeforeHours?: number | null;
  categoryLabel?: string | null;
  categoryColor?: string | null;
  coachName?: string | null;
  startAt?: string | null;
  endAt?: string | null;
};

type PendingAction = 'book' | 'cancel' | 'dropin' | null;

export default function SessionCard({
  title,
  description,
  timeLabel,
  capacity,
  remainingSeats,
  bookingStatus,
  isLoading,
  canBookWithMembership,
  dropInEnabled,
  dropInPrice,
  onBook,
  onCancel,
  onDropIn,
  cancelDisabled = false,
  cancelBeforeHours = null,
  categoryLabel = null,
  categoryColor = null,
  coachName = null,
  startAt = null,
  endAt = null,
}: SessionCardProps) {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmText, setConfirmText] = useState('');
  const [detailsVisible, setDetailsVisible] = useState(false); // 👈 NEW
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isBooked = bookingStatus === 'booked';
  const isFull =
    remainingSeats != null && Number(remainingSeats) <= 0 && !isBooked;

  let actionText = 'Κράτηση';
  let actionFn = onBook;
  let actionColor = colors.primary;
  let disabled = isLoading;

  if (isBooked) {
    if (cancelDisabled) {
      actionText = 'Ακύρωση';
      actionFn = onCancel;
      actionColor = colors.textMuted;
      disabled = true;
    } else {
      actionText = 'Ακύρωση';
      actionFn = onCancel;
      actionColor = colors.error;
    }
  } else {
    if (!canBookWithMembership || isFull) {
      disabled = true;
    }
  }

  const durationLabel = useMemo(() => {
    if (!startAt || !endAt) return null;
    const start = new Date(startAt);
    const end = new Date(endAt);
    const diffMs = end.getTime() - start.getTime();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return null;

    const minutes = Math.round(diffMs / 60000);
    if (minutes <= 0) return null;

    return `${minutes}′`;
  }, [startAt, endAt]);

  const showDropIn = !isBooked && !canBookWithMembership && !isFull;
  const dropInDisabled = isLoading || !dropInEnabled;

  const dropInLabel =
    dropInPrice != null
      ? `Drop-in
${dropInPrice.toFixed(2)}€`
      : 'Drop-in';

  const openConfirm = (action: PendingAction) => {
    if (!action) return;

    setPendingAction(action);

    if (action === 'book') {
      setConfirmText('Θέλεις σίγουρα να κάνεις κράτηση για αυτό το μάθημα;');
    } else if (action === 'cancel') {
      setConfirmText('Θέλεις σίγουρα να ακυρώσεις την κράτησή σου;');
    } else if (action === 'dropin') {
      setConfirmText('Θέλεις να συνεχίσεις με Drop-in για αυτό το μάθημα;');
    }

    setConfirmVisible(true);
  };

  const handleConfirm = () => {
    if (!pendingAction) {
      setConfirmVisible(false);
      return;
    }

    if (pendingAction === 'book') {
      onBook();
    } else if (pendingAction === 'cancel') {
      onCancel();
    } else if (pendingAction === 'dropin') {
      onDropIn();
    }

    setConfirmVisible(false);
    setPendingAction(null);
  };

  const handleCancelConfirm = () => {
    setConfirmVisible(false);
    setPendingAction(null);
  };

  const handleMainPress = () => {
    if (disabled || (!canBookWithMembership && !isBooked) || isFull) return;
    openConfirm(isBooked ? 'cancel' : 'book');
  };

  const handleDropInPress = () => {
    if (dropInDisabled) return;
    openConfirm('dropin');
  };

  const timeOnlyLabel = useMemo(() => {
    const parts = (timeLabel || '').split(' ').filter(Boolean);
    if (parts.length === 0) return timeLabel;
    return parts[parts.length - 1];
  }, [timeLabel]);

  const bookedCount =
    capacity != null && remainingSeats != null
      ? Math.max(0, capacity - remainingSeats)
      : null;

  const capacityLabel =
    bookedCount != null && capacity != null
      ? `(${bookedCount}/${capacity})`
      : null;

  return (
    <View style={styles.card}>
      {/* Main row: time | info | button */}
      <View style={styles.mainRow}>
        {/* Left: Time + capacity */}
        <View style={styles.timeCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Clock size={16} color="#fffcfcff" strokeWidth={2} />
            <Text style={styles.timeText}>{timeOnlyLabel}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ClockFading size={16} color="#fffcfcff" strokeWidth={2} />
            {durationLabel && (
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                {durationLabel}
              </Text>
            )}
          </View>
          {capacityLabel && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <User2 size={16} color="#fffcfcff" strokeWidth={2} />
              <Text
                style={[
                  styles.capacityText,
                  isFull && styles.capacityTextFull,
                ]}
              >
                {capacityLabel}
              </Text>
            </View>
          )}
        </View>

        {/* Middle: title, category, coach, description */}
        <View style={styles.infoCol}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>

          {categoryLabel && (
            <Text
              style={[
                styles.categoryLabel,
                categoryColor && { color: categoryColor },
              ]}
              numberOfLines={1}
            >
              {categoryLabel}
            </Text>
          )}

          <Text style={styles.coachText} numberOfLines={1}>
            {coachName ? `${coachName}` : 'No Coach'}
          </Text>

          {!!description && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setDetailsVisible(true)}
            >
              <Text style={styles.cardDescription} numberOfLines={2}>
                {description}
              </Text>
            </TouchableOpacity>
          )}

          {isBooked && (
            <Text style={styles.bookedLabel}>Έχετε κάνει κράτηση</Text>
          )}
        </View>

        {/* Right: Book / Cancel / Drop-in pill */}
        <View style={styles.actionsCol}>
          {!showDropIn ? (
            <TouchableOpacity
              style={[
                styles.actionPill,
                isBooked ? styles.cancelPill : styles.bookPill,
                (disabled ||
                  (!canBookWithMembership && !isBooked) ||
                  isFull) && styles.actionPillDisabled,
              ]}
              onPress={handleMainPress}
              disabled={
                disabled || (!canBookWithMembership && !isBooked) || isFull
              }
            >
              {isLoading ? (
                <ActivityIndicator
                  color={isBooked ? '#fff' : colors.text}
                  size="small"
                />
              ) : isFull && !isBooked ? (
                <View style={styles.lockRow}>
                  <Lock
                    size={16}
                    color={isBooked ? '#fff' : colors.text}
                    strokeWidth={2}
                  />
                  <Text
                    style={[
                      styles.actionText,
                      !isBooked && { color: colors.text },
                      { marginLeft: 6 },
                    ]}
                  >
                    Πλήρες
                  </Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.actionText,
                    !isBooked && { color: colors.text },
                  ]}
                >
                  {actionText}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.actionPill,
                styles.dropInPill,
                dropInDisabled && styles.actionPillDisabled,
              ]}
              onPress={handleDropInPress}
              disabled={dropInDisabled}
            >
              {isLoading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : dropInEnabled ? (
                <Text style={styles.dropInText}>{dropInLabel}</Text>
              ) : (
                <View style={styles.lockRow}>
                  <Lock size={16} color="#000" strokeWidth={2} />
                  <Text style={[styles.dropInText, { marginLeft: 6 }]}>
                    Drop-in
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Confirmation Modal */}
      <Modal
        transparent
        visible={confirmVisible}
        animationType="fade"
        onRequestClose={handleCancelConfirm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Επιβεβαίωση</Text>
            <Text style={styles.modalText}>{confirmText}</Text>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={handleCancelConfirm}
              >
                <Text style={styles.modalButtonSecondaryText}>Άκυρο</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleConfirm}
                disabled={isLoading}
              >
                <Text style={styles.modalButtonPrimaryText}>Συνέχεια</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Details Modal (Title / Category / Coach / Full description) */}
      <Modal
        transparent
        visible={detailsVisible}
        animationType="fade"
        onRequestClose={() => setDetailsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailsBox}>
            <Text style={styles.detailsTitle}>{title}</Text>

            {categoryLabel && (
              <Text style={styles.detailsMeta}>
                Κατηγορία:{' '}
                <Text
                  style={[
                    styles.detailsMetaValue,
                    categoryColor && { color: categoryColor },
                  ]}
                >
                  {categoryLabel}
                </Text>
              </Text>
            )}

            {coachName && (
              <Text style={styles.detailsMeta}>
                Προπονητής:{' '}
                <Text style={styles.detailsMetaValue}>{coachName}</Text>
              </Text>
            )}

            {!!description && (
              <ScrollView
                style={styles.detailsDescriptionWrapper}
                contentContainerStyle={{ paddingBottom: 4 }}
              >
                <Text style={styles.detailsDescription}>{description}</Text>
              </ScrollView>
            )}

            <View style={styles.detailsButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => setDetailsVisible(false)}
              >
                <Text style={styles.modalButtonPrimaryText}>Κλείσιμο</Text>
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
    card: {
      backgroundColor: colors.card,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.textMuted + '30',
    },
    mainRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    timeCol: {
      width: 80,
      marginRight: 10,
      marginTop: 7,
      gap: 10,
    },
    timeText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    capacityText: {
      marginTop: 2,
      fontSize: 13,
      color: colors.textMuted,
    },
    capacityTextFull: {
      color: colors.error,
      fontWeight: '600',
    },

    infoCol: {
      flex: 1,
      width: 100,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      flexShrink: 1,
    },
    coachText: {
      marginTop: 2,
      fontSize: 13,
      color: colors.textMuted,
    },
    cardDescription: {
      marginTop: 4,
      color: colors.textMuted,
      fontSize: 12,
    },
    bookedLabel: {
      marginTop: 4,
      fontSize: 11,
      fontWeight: '600',
      color: colors.success,
    },

    categoryLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textMuted,
    },

    actionsCol: {
      marginLeft: 10,
      marginTop: 10,
      justifyContent: 'center',
      alignItems: 'flex-end',
    },
    actionPill: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 999,
      minWidth: 80,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bookPill: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    cancelPill: {
      backgroundColor: colors.error,
    },
    actionPillDisabled: {
      opacity: 0.4,
    },
    actionText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#fff',
    },
    lockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },

    dropInPill: {
      backgroundColor: colors.accent,
    },
    dropInText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#000',
    },

    // Shared modal overlay
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
      backgroundColor: colors.primary,
    },
    modalButtonPrimaryText: {
      color: '#fff',
      fontWeight: '700',
    },

    // Details modal
    detailsBox: {
      width: '85%',
      maxHeight: '70%',
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    detailsTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    detailsMeta: {
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 2,
    },
    detailsMetaValue: {
      fontWeight: '600',
      color: colors.text,
    },
    detailsDescriptionWrapper: {
      marginTop: 10,
      marginBottom: 12,
    },
    detailsDescription: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    detailsButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
  });
