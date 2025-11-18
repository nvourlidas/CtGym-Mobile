import { supabase } from '../lib/supabase';
import type { BookingStatus, Booking } from '../types/types';

export const bookSession = async (
  tenantId: string,
  sessionId: string,
  userId: string
): Promise<Booking> => {
  const { data, error } = await supabase.rpc('book_session', {
    p_booking_type: 'membership',  // matches function signature
    p_session_id: sessionId,
    p_tenant_id: tenantId,
    p_user_id: userId,
  });

  if (error || !data) {
    throw error ?? new Error('No booking returned');
  }

  return data as Booking;
};

export async function bookDropInSession(
  tenantId: string,
  sessionId: string,
  userId: string,
  _dropInPrice: number | null = null // can keep param if you want, but not sent to RPC
): Promise<Booking> {
  const { data, error } = await supabase.rpc('book_session', {
    p_booking_type: 'drop_in',     // tell the function it's a drop-in
    p_session_id: sessionId,
    p_tenant_id: tenantId,
    p_user_id: userId,
  });

  if (error || !data) {
    throw error ?? new Error('No booking returned');
  }

  return data as Booking;
}

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
