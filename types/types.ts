export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  tenant_id: string;
};

export type Booking = {
  id: string;
  tenant_id: string;
  session_id: string;
  user_id: string;
  status: BookingStatus;
  created_at: string;
};

export type BookingStatus = 'booked' | 'checked_in' | 'canceled' | 'no_show';
