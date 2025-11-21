// src/components/SessionCard.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { Lock, Pen } from 'lucide-react-native';
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
}: SessionCardProps) {
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmText, setConfirmText] = useState('');
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
    actionText = 'Ακύρωση';
    actionFn = onCancel;
    actionColor = colors.error;
  } else {
    if (!canBookWithMembership || isFull) {
      disabled = true;
    }
  }

  const showDropIn = !isBooked && !canBookWithMembership && !isFull;
  const dropInDisabled = isLoading || !dropInEnabled;

  const dropInLabel =
    dropInPrice != null
      ? `Drop-in · ${dropInPrice.toFixed(2)}€`
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
    if (disabled) return;
    openConfirm(isBooked ? 'cancel' : 'book');
  };

  const handleDropInPress = () => {
    if (dropInDisabled) return;
    openConfirm('dropin');
  };

  return (
    <View style={styles.card}>
      {/* 🔹 Title left – Time right */}
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardTime}>{timeLabel}</Text>
      </View>

      {!!description && (
        <Text style={styles.cardDescription} numberOfLines={3}>
          {description}
        </Text>
      )}

      {capacity != null && !isBooked && (
        <Text style={styles.cardCapacity}>
          Θέσεις: {capacity}
          {remainingSeats != null && (
            <> · Διαθέσιμες: {Math.max(remainingSeats, 0)}</>
          )}
          {isFull && !isBooked && ' · Πλήρες'}
        </Text>
      )}

      {isBooked && (<Text style={{ color: colors.success }}>Έχετε κάνει κράτηση</Text>
      )}

      {/* Main button (Κράτηση / Ακύρωση) */}
      {!showDropIn && (
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: actionColor },
            (disabled || (!canBookWithMembership && !isBooked) || isFull) &&
              styles.actionBtnDisabled,
          ]}
          onPress={handleMainPress}
          disabled={disabled}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.bg} />
          ) : isFull && !isBooked ? (
            <View style={styles.lockRow}>
              <Lock size={16} color="#fff" strokeWidth={2} />
              <Text style={[styles.actionText, { marginLeft: 6 }]}>Πλήρες</Text>
            </View>
          ) : (
            <Text style={styles.actionText}>{actionText}</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Drop-in button */}
      {showDropIn && (
        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.dropInBtn,
            dropInDisabled && styles.actionBtnDisabled,
          ]}
          onPress={handleDropInPress}
          disabled={dropInDisabled}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.bg} />
          ) : dropInEnabled ? (
            <Text style={{ color: 'black', fontWeight: '700' }}>
              {dropInLabel}
            </Text>
          ) : (
            <View style={styles.lockRow}>
              <Lock size={16} color="#000" strokeWidth={2} />
              <Text
                style={{
                  marginLeft: 6,
                  color: 'black',
                  fontWeight: '700',
                }}
              >
                Drop-in κλειδωμένο
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

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
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.textMuted,
    },
    // 🔹 new: header row for title + time
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 11,
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
    cardDescription: {
      color: colors.textMuted,
      fontSize: 13,
      marginBottom: 6,
    },
    cardCapacity: {
      color: colors.accent,
      marginTop: 6,
      fontSize: 13,
    },
    actionBtn: {
      marginTop: 10,
      paddingVertical: 10,
      borderRadius: 999,
      alignItems: 'center',
    },
    actionBtnDisabled: {
      opacity: 0.4,
    },
    lockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dropInBtn: {
      backgroundColor: colors.accent,
    },
    actionText: {
      color: 'white',
      fontWeight: '700',
    },
    // Modal styles
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
  });
