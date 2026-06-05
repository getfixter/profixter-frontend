export type ActiveTab = "overview" | "personal" | "plan" | "bookings" | "password";

export interface AccountAddress {
  _id: string;
  label?: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
  hasActiveSubscription?: boolean;
  plan?: string | null;
}

export interface AccountFormData {
  userId: string;
  name: string;
  email: string;
  phone: string;

  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;

  addresses: AccountAddress[];

  // ✅ add this
  defaultAddressId?: string | null;
}


export interface BookingItem {
  id: number;
  address: string;
  date: string;
  time: string;
}
