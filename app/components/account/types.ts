export type ActiveTab = 'personal' | 'plan' | 'bookings' | 'password';

export interface AccountFormData {
  userId: string;
  name: string;
  email: string;
  phone: string;

  // Legacy address fields
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;

  // New multi-address system
  addresses: any[];
}

export interface BookingItem {
  id: number;
  address: string; // can contain \n for line breaks
  date: string;
  time: string;
}
