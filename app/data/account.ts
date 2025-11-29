import { AccountFormData, BookingItem } from '../components/account/types';

export const initialAccountFormData: AccountFormData = {
  userId: '',
  name: '',
  email: '',
  phone: '',

  // Legacy address fields
  address: '',
  city: '',
  state: '',
  zip: '',
  county: '',

  // New multi-address system
  addresses: [],
};

export const initialBookings: BookingItem[] = [];
