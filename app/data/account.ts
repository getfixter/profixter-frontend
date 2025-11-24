import { AccountFormData, BookingItem } from '../components/account/types';

export const initialAccountFormData: AccountFormData = {
  name: 'Taras Bandura',
  email: 'bandurataras1596@gmail.com',
  phone: '',
  address1: '740 West 187th Street Manhattan, NY, 10033',
  address2: '',
};

export const initialBookings: BookingItem[] = [
  {
    id: 1,
    address: '25 42nd Street Lindenhurst,\nNY, 11757 • Nassau',
    date: 'Nov 7, 2025',
    time: '6:00 PM',
  },
  {
    id: 2,
    address: '25 42nd Street Lindenhurst,\nNY, 11757 • Nassau',
    date: 'Nov 7, 2025',
    time: '6:00 PM',
  },
];
