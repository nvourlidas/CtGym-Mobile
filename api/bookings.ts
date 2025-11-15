import { supabase } from '../lib/supabase';
import type { BookingStatus, Booking } from '../types/types';

export const bookSession = async (
    tenantId: string,
    sessionId: string,
    userId: string
): Promise<Booking> => {
    const { data, error } = await supabase
        .from('bookings')
        .insert({
            tenant_id: tenantId,
            session_id: sessionId,
            user_id: userId,
            status: 'booked',
        })
        .select('id, tenant_id, session_id, user_id, status, created_at')
        .single();

    if (error || !data) {
        throw error ?? new Error('No booking returned');
    }

    return data as Booking;
};

export const updateBookingStatus = async (
    bookingId: string,
    status: BookingStatus
): Promise<Pick<Booking, 'id' | 'status'>> => {
    const { data, error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', bookingId)
        .select('id, status')
        .single();

    if (error || !data) {
        throw error ?? new Error('No booking returned');
    }

    return data as { id: string; status: BookingStatus };
};

export const getMyBookingsForSession = async (
    sessionId: string,
    userId: string
): Promise<Pick<Booking, 'id' | 'status'> | null> => {
    const { data, error } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return data as { id: string; status: BookingStatus };
};
