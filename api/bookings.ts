import { supabase } from '../lib/supabase';
import type { BookingStatus, Booking } from '../types/types';

export const bookSession = async (
  tenantId: string,
  sessionId: string,
  userId: string
): Promise<Booking> => {
  const { data, error } = await supabase.rpc('book_session', {
    p_booking_type: 'membership', // matches function signature
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
    p_booking_type: 'drop_in', // tell the function it's a drop-in
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

/* ------------------------------------------------------------------ */
/*            ΝΕΟ: τύποι & function για “Οι κρατήσεις μου”            */
/* ------------------------------------------------------------------ */

type RawBookingRow = {
  id: string;
  status: BookingStatus;
  created_at: string;
  session_id: string | null;
};

type RawSessionRow = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  classes: {
    title: string;
    description?: string | null;
  } | null;
};

export type MyBooking = {
  id: string;
  status: BookingStatus;
  created_at: string;
  session: {
    id: string;
    starts_at: string;
    ends_at: string | null;
    capacity: number | null;
    class_title: string | null;
    class_description: string | null;
  } | null;
};

export const getMyBookings = async (userId: string): Promise<MyBooking[]> => {
  // 1) Φέρνουμε ΟΛΕΣ τις κρατήσεις του user (χωρίς joins)
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id, status, created_at, session_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });


  if (bookingsError) throw bookingsError;
  if (!bookings || bookings.length === 0) return [];

  const typedBookings = bookings as unknown as RawBookingRow[];

  // 2) Μαζεύουμε τα session_ids και φέρνουμε τα sessions
  const sessionIds = [
    ...new Set(
      typedBookings
        .map((b) => b.session_id)
        .filter((id): id is string => !!id),
    ),
  ];

  if (sessionIds.length === 0) {
    // Δεν υπάρχουν sessions (θεωρητικά δεν θα συμβεί, αλλά just in case)
    return typedBookings.map((b) => ({
      id: b.id,
      status: b.status,
      created_at: b.created_at,
      session: null,
    }));
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from('class_sessions')
    .select('id, starts_at, ends_at, capacity, classes:classes ( title, description )')
    .in('id', sessionIds);


  if (sessionsError) throw sessionsError;

  const typedSessions = (sessions ?? []) as unknown as RawSessionRow[];

  const sessionMap = new Map<string, RawSessionRow>();
  typedSessions.forEach((s) => sessionMap.set(s.id, s));

  // 3) Κάνουμε merge bookings + sessions
  const result: MyBooking[] = typedBookings.map((b) => {
    const session = b.session_id ? sessionMap.get(b.session_id) : undefined;
    return {
      id: b.id,
      status: b.status,
      created_at: b.created_at,
      session: session
        ? {
          id: session.id,
          starts_at: session.starts_at,
          ends_at: session.ends_at,
          capacity: session.capacity,
          class_title: session.classes?.title ?? null,
          class_description: session.classes?.description ?? null,
        }
        : null,
    };
  });

  return result;
};
