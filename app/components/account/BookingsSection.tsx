'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAllBookings, cancelBooking } from '@/lib/booking-service';
import type { Booking } from '@/lib/booking-service';

export function BookingsSection() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  // Load bookings
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const data = await getAllBookings();
        
        // Sort by date (newest first)
        const bookingsArray = Array.isArray(data) ? data : [];
        const sorted = bookingsArray.sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setBookings(sorted);
      } catch (err: any) {
        console.error('Failed to load bookings:', err);
        setError(err.response?.data?.message || 'Failed to load bookings');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  // Cancel booking
  const handleCancel = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    setCancelingId(bookingId);
    try {
      const result = await cancelBooking(bookingId);
      alert(result.message || 'Booking canceled successfully');
      
      // Remove from list
      setBookings(prev => prev.filter(b => b._id !== bookingId));
    } catch (err: any) {
      console.error('Failed to cancel booking:', err);
      alert(err.response?.data?.message || 'Failed to cancel booking');
    } finally {
      setCancelingId(null);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Check if future
  const isFuture = (dateString: string) => {
    return new Date(dateString) > new Date();
  };

  // Check if cancelable
  const isCancelable = (booking: Booking) => {
    if (!isFuture(booking.date)) return false;
    const nonCancelableStatuses = ['Canceled', 'Cancelled', 'Completed', 'Complete', 'Done'];
    return !nonCancelableStatuses.includes(booking.status);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Confirmed': return 'bg-blue-100 text-blue-800';
      case 'Completed':
      case 'Complete':
      case 'Done': return 'bg-green-100 text-green-800';
      case 'Canceled':
      case 'Cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-[#6A6D71]">Loading bookings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const futureBookings = bookings.filter(b => isFuture(b.date));
  const pastBookings = bookings.filter(b => !isFuture(b.date));

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-8 sm:mb-12">My bookings</h2>
      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 sm:py-24">
          <p className="text-sm sm:text-base text-[#313234] mb-6 sm:mb-8 text-center">No bookings yet.</p>
          <Link href="/#pick-day" className="px-12 sm:px-24 py-3 sm:py-4 bg-[#306EEC] text-[#EEF2FF] rounded-[14px] text-base sm:text-xl font-semibold hover:bg-[#2557C7] transition-colors">Book now</Link>
        </div>
      ) : (
        <>
          {/* Show only upcoming bookings */}
          {futureBookings.length > 0 ? (
            <div>
              <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr] gap-4 lg:gap-8 mb-4 sm:mb-6 px-4 sm:px-6">
                <div className="text-sm sm:text-base text-[#6A6D71]">Address</div>
                <div className="text-sm sm:text-base text-[#6A6D71]">Date</div>
                <div className="text-sm sm:text-base text-[#6A6D71]">Time</div>
              </div>
              <div className="space-y-0">
                {futureBookings.map(booking => (
                  <div key={booking._id} className="border-[#C5CBD8] py-4 px-4 sm:px-6">
                    {/* Mobile */}
                    <div className="sm:hidden space-y-3">
                      <div>
                        <p className="text-xs text-[#6A6D71] mb-1">Address</p>
                        <p className="text-sm text-[#313234] leading-[120%] whitespace-pre-line">{booking.address}, {booking.city}</p>
                      </div>
                      <div className="flex gap-6">
                        <div>
                          <p className="text-xs text-[#6A6D71] mb-1">Date</p>
                          <p className="text-sm text-[#313234]">{formatDate(booking.date)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6A6D71] mb-1">Time</p>
                          <p className="text-sm text-[#313234]">{formatTime(booking.date)}</p>
                        </div>
                      </div>
                      {isCancelable(booking) && (
                        <button 
                          onClick={() => handleCancel(booking._id)}
                          disabled={cancelingId === booking._id}
                          className="text-sm text-[#6A6D71] hover:underline disabled:opacity-50"
                        >
                          {cancelingId === booking._id ? 'Canceling...' : 'Cancel booking'}
                        </button>
                      )}
                    </div>
                    
                    {/* Desktop */}
                    <div className="hidden sm:block">
                      <div className="w-full h-[54px] rounded-[14px] border border-[#C5CBD8] bg-[#EEF2FF] flex items-center px-4 sm:px-6">
                        <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 lg:gap-8 w-full items-center">
                          <div className="text-[16px] leading-[120%] text-[#313234] whitespace-pre-line">{booking.address}, {booking.city}</div>
                          <div className="text-[16px] leading-[120%] text-[#313234]">{formatDate(booking.date)}</div>
                          <div className="text-[16px] leading-[120%] text-[#313234]">{formatTime(booking.date)}</div>
                        </div>
                      </div>
                      {booking.note && (
                        <div className="mt-2 px-4 sm:px-6">
                          <p className="text-xs text-[#6A6D71]">Task: {booking.note}</p>
                        </div>
                      )}
                      {isCancelable(booking) && (
                        <div className="flex justify-end mt-3">
                          <button 
                            onClick={() => handleCancel(booking._id)}
                            disabled={cancelingId === booking._id}
                            className="text-[16px] leading-[120%] text-[#6A6D71] hover:underline disabled:opacity-50"
                          >
                            {cancelingId === booking._id ? 'Canceling...' : 'Cancel booking'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-[#6A6D71] py-8">No upcoming bookings.</p>
          )}
        </>
      )}
    </div>
  );
}
