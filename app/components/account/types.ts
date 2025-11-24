export type ActiveTab = 'personal' | 'plan' | 'bookings' | 'password';

export interface AccountFormData {
  name: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
}

export interface BookingItem {
  id: number;
  address: string; // can contain \n for line breaks
  date: string;
  time: string;
}
