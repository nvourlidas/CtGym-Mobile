// src/screens/QRCheckinScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Platform, StatusBar } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthProvider';
import { router } from 'expo-router';

export default function QRCheckinScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const scanningRef = useRef(false); // 👈 immediate guard
    const { profile } = useAuth();

    const hasPermission = Boolean(permission?.granted);

    useEffect(() => {
        if (!permission || !permission.granted) {
            requestPermission();
        }
    }, [permission, requestPermission]);

    const handleBarcodeScanned = async ({ data }: { data: string }) => {
        // Synchronous guard – blocks multiple rapid calls
        if (scanningRef.current) return;
        scanningRef.current = true;
        setScanned(true);

        try {
            const payload = JSON.parse(data);

            if (payload.type !== 'session_checkin') {
                throw new Error('Μη έγκυρο QR (τύπος)');
            }

            const { tenantId, sessionId, token } = payload;

            const { data: booking, error } = await supabase.rpc('check_in_with_qr', {
                p_tenant_id: tenantId,
                p_session_id: sessionId,
                p_token: token,
            });

            if (error) {
                if (error.message === 'Already checked in') {
                    Alert.alert('Προσοχή', 'Έχεις ήδη κάνει check-in σε αυτό το μάθημα.');
                } else {
                    Alert.alert('Αποτυχία check-in', error.message || 'Κάτι πήγε στραβά');
                }
            } else {
                // ✅ SUCCESS MESSAGE
                Alert.alert('Επιτυχία', 'Έκανες check-in στο μάθημα!');
                // αν θέλεις εδώ μπορείς π.χ. να κάνεις navigation πίσω
                 router.back();
            }
        } catch (err: any) {
            console.log(err);
            Alert.alert('Σφάλμα', err.message || 'Μη έγκυρο QR');
        } finally {
            // allow re-scan after 2s
            setTimeout(() => {
                scanningRef.current = false;
                setScanned(false);
            }, 2000);
        }
    };


    if (!permission) {
        return (
            <View style={styles.center}>
                <ActivityIndicator />
                <Text>Φόρτωση αδειών κάμερας…</Text>
            </View>
        );
    }

    if (!hasPermission) {
        return (
            <View style={styles.center}>
                <Text>Η εφαρμογή δεν έχει άδεια για χρήση της κάμερας.</Text>
                <Text>Πήγαινε στις ρυθμίσεις για να την ενεργοποιήσεις.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {Platform.OS === 'android' ? <StatusBar hidden /> : null}

            <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr'], // μόνο QR
                }}
            />

            <View style={styles.overlay}>
                <Text style={styles.text}>Σκάναρε το QR για να κάνεις check-in</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    overlay: {
        position: 'absolute',
        bottom: 80,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    text: { color: '#fff', fontSize: 16 },
});
