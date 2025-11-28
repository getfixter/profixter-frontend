"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { getCalendarConfig, getTimeSlots, createBooking, getNextBooking, checkSubscription, CalendarConfig } from "@/lib/booking-service";

const SERVICES = [
  'Basic Improvement',
  'Quick Fix',
  'Get 2 Pros',
  'Renovation Consultation',
  'Property Inspection'
];

const TIMES = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00'];

// Lightweight, presentational booking block matching the provided spec
export default function BookingSection() {
  const { user, isAuthenticated } = useAuth();
  
  // Calendar config
  const [config, setConfig] = useState<CalendarConfig | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [takenCounts, setTakenCounts] = useState<Record<string, number>>({});
  const [capacity, setCapacity] = useState(1);
  
  const [service, setService] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [showServiceMenu, setShowServiceMenu] = useState(false);
  
  // UI state
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingNumber, setBookingNumber] = useState('');
  
  // Modal display data
  const [confirmedService, setConfirmedService] = useState('');
  const [confirmedDate, setConfirmedDate] = useState<Date | null>(null);
  const [confirmedTime, setConfirmedTime] = useState('');
  
  // Existing booking check
  const [hasActiveBooking, setHasActiveBooking] = useState(false);
  const [existingBookingDate, setExistingBookingDate] = useState<Date | null>(null);
  
  // Subscription check
  const [hasSubscription, setHasSubscription] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  
  // Check subscription for address
  useEffect(() => {
    const checkAddressSubscription = async () => {
      if (!user?.defaultAddressId || !isAuthenticated) {
        setHasSubscription(false);
        setSubscriptionError('');
        return;
      }
      
      setCheckingSubscription(true);
      try {
        const data = await checkSubscription(user.defaultAddressId);
        
        setHasSubscription(data.hasSubscription);
        if (!data.hasSubscription) {
          setSubscriptionError(data.message || 'This address does not have an active subscription.');
        } else {
          setSubscriptionError('');
        }
      } catch (err: any) {
        console.error('❌ Failed to check subscription:', err);
        setHasSubscription(false);
        setSubscriptionError('Unable to verify subscription status.');
      } finally {
        setCheckingSubscription(false);
      }
    };
    
    checkAddressSubscription();
  }, [user?.defaultAddressId, isAuthenticated]);
  
  // Check for existing booking when user changes
  useEffect(() => {
    const checkExistingBooking = async () => {
      if (!user?.defaultAddressId || !isAuthenticated) {
        setHasActiveBooking(false);
        return;
      }
      
      try {
        const data = await getNextBooking(user.defaultAddressId);
        if (data.future) {
          setHasActiveBooking(true);
          setExistingBookingDate(new Date(data.future.date));
        } else {
          setHasActiveBooking(false);
          setExistingBookingDate(null);
        }
      } catch (err) {
        console.error('Failed to check existing booking:', err);
        setHasActiveBooking(false);
      }
    };
    
    checkExistingBooking();
  }, [user, isAuthenticated]);
  
  // Load calendar config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await getCalendarConfig();
        setConfig(data);
      } catch (err) {
        console.error('Failed to load calendar config:', err);
        // Fallback
        setConfig({
          timezone: 'America/New_York',
          slotMinutes: 60,
          minLeadDays: 2,
          closedWeekdays: [0],
          maxConcurrent: 3,
          defaultHours: TIMES,
          overrides: {},
          holidays: []
        });
      }
    };
    loadConfig();
  }, []);
  
  // Load time slots when date is selected
  useEffect(() => {
    if (!selectedDate) {
      setAvailableTimes([]);
      return;
    }
    
    const loadSlots = async () => {
      try {
        const dateStr = formatDateYMD(selectedDate);
        const data = await getTimeSlots(dateStr);
        setAvailableTimes(data.slots);
        setTakenCounts(data.taken);
        setCapacity(data.capacityPerSlot);
      } catch (err) {
        console.error('Failed to load time slots:', err);
        setAvailableTimes([]);
      }
    };
    
    loadSlots();
  }, [selectedDate]);

  const formatDateYMD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isDayDisabled = (date: Date): boolean => {
    if (!config) return true;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    // Past dates
    if (date < today) return true;
    
    // Within lead time
    const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < config.minLeadDays) return true;
    
    // Closed weekdays
    if (config.closedWeekdays.includes(date.getDay())) return true;
    
    // Holidays
    const ymd = formatDateYMD(date);
    if (config.holidays.includes(ymd)) return true;
    
    // Override: empty array = closed
    if (config.overrides[ymd] !== undefined && config.overrides[ymd].length === 0) return true;
    
    return false;
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startPadding = firstDay.getDay();
    const endPadding = 6 - lastDay.getDay();
    
    const days: { date: Date; muted: boolean }[] = [];
    
    // Previous month days
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, muted: true });
    }
    
    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      days.push({ date, muted: false });
    }
    
    // Next month days
    for (let i = 1; i <= endPadding; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, muted: true });
    }
    
    return days;
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos = Array.from(e.target.files).slice(0, 10 - uploadedPhotos.length);
      setUploadedPhotos([...uploadedPhotos, ...newPhotos]);
    }
  };

  const handleBookNow = async () => {
    if (!isAuthenticated) {
      alert('Please sign in to book a visit');
      window.location.href = '/signin';
      return;
    }
    
    if (!user?.defaultAddressId) {
      alert('Please add an address to your account first');
      return;
    }
    
    if (!hasSubscription) {
      setError('This address does not have an active subscription. Purchase a subscription to book a visit.');
      return;
    }
    
    // Validation
    if (!service) {
      setError('Please select a service');
      return;
    }
    if (!selectedDate || !selectedTime) {
      setError('Please select date and time');
      return;
    }
    if (note.trim().split(/\s+/).length < 3) {
      setError('Please describe your issue (at least 3 words)');
      return;
    }
    if (uploadedPhotos.length === 0) {
      setError('Please upload at least one photo');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Construct booking date/time
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const bookingDate = new Date(selectedDate);
      bookingDate.setHours(hours, minutes, 0, 0);
      
      const result = await createBooking({
        service,
        date: bookingDate.toISOString(),
        note: note.trim(),
        addressId: user.defaultAddressId,
        images: uploadedPhotos,
      });
      
      // Save data for modal display BEFORE resetting form
      setBookingNumber(result.booking.bookingNumber);
      setConfirmedService(service);
      setConfirmedDate(new Date(selectedDate));
      setConfirmedTime(selectedTime);
      
      // Update existing booking state
      setHasActiveBooking(true);
      setExistingBookingDate(bookingDate);
      
      // Reset form
      setService('');
      setSelectedDate(null);
      setSelectedTime('');
      setNote('');
      setUploadedPhotos([]);
      
      // Show modal after saving data
      setShowModal(true);
      
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to create booking. Please try again.';
      setError(message);
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const days = generateCalendarDays();

  return (
    <section id="pick-day" className="relative w-full pt-32 sm:pt-40 lg:pt-48 pb-12 sm:pb-16 lg:pb-24 bg-[#eaedfa]">
      <div className="container mx-auto px-[20px] max-w-[1240px]">
        {/* Header with edge labels and centered title */}
        <div className="mb-8 sm:mb-10 lg:mb-12">
          {/* Edge labels - Desktop only */}
          <div className="hidden lg:flex items-center justify-between text-[12px] font-bold text-[#313234] leading-[89%] font-montserrat uppercase">
            <span className="w-[66px] text-center whitespace-nowrap">Pick your</span>
            <span className="w-[94px] text-center whitespace-nowrap text-[#306EEC]">
              date<span className="text-[#313234]">&nbsp;and&nbsp;</span>time
            </span>
          </div>

          {/* Mobile/Tablet - Simple centered title */}
          <div className="lg:hidden text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight uppercase mb-4">
              <span className="text-[#313234]">PICK YOUR </span>
              <span className="text-[#306EEC]">DATE</span>
            </h2>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight uppercase">
              <span className="text-[#313234]">AND </span>
              <span className="text-[#306EEC]">TIME</span>
            </h2>
            <p className="text-[#6A6D71] text-sm sm:text-base mt-4 max-w-md mx-auto">
              Choose the most convenient time and tell us what needs fixing.
            </p>
          </div>

          {/* Desktop - Centered Title */}
          <div className="hidden lg:block relative max-w-[1000px] mx-auto">
            <div className="flex items-center justify-center gap-1">
              <h2 className="text-[64px] font-bold leading-[89%] uppercase tracking-[-0.05em]">
                <span className="text-[#313234]">PICK YOUR</span>
              </h2>
              <p className="text-[#6A6D71] text-[15px] font-medium max-w-[289px] text-left">
                Choose the most convenient time and tell us what needs fixing.
              </p>
            </div>
            <div className="flex justify-end " style={{ paddingRight: 'calc((100% - 289px - 64px * 4.5) / 2)' }}>
              <h2 className="text-[64px] font-bold leading-[89%] uppercase tracking-[-0.05em]">
                <span className="text-[#306EEC]">DATE</span>
                <span className="text-[#313234]"> AND </span>
                <span className="text-[#306EEC]">TIME</span>
              </h2>
            </div>
          </div>
        </div>

        {/* Content row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Calendar card */}
          <div className="lg:col-span-5">
            <div className="rounded-[14px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.09)] p-4 sm:p-6">
              {/* Month header */}
              <div className="flex items-center justify-between">
                <button 
                  aria-label="Prev month" 
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-[12px] border border-[#c5cbd8] bg-white/60 grid place-items-center text-[#313234] hover:bg-white"
                >
                  <ChevronLeft />
                </button>
                <div className="text-xl sm:text-2xl lg:text-[28px] font-semibold text-[#313234]">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
                <button 
                  aria-label="Next month" 
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-[12px] border border-[#c5cbd8] bg-white/60 grid place-items-center text-[#313234] hover:bg-white"
                >
                  <ChevronRight />
                </button>
              </div>

              {/* Week headers */}
              <div className="mt-4 grid grid-cols-7 text-center text-sm sm:text-base lg:text-[18px] text-[#cf3f3f]">
                <div>Su</div>
                <div className="text-[#6a6c71]">Mo</div>
                <div className="text-[#6a6c71]">Tu</div>
                <div className="text-[#6a6c71]">We</div>
                <div className="text-[#6a6c71]">Th</div>
                <div className="text-[#6a6c71]">Fr</div>
                <div className="text-[#6a6c71]">Sa</div>
              </div>

              {/* Days */}
              <div className="mt-2 grid grid-cols-7 gap-y-1 sm:gap-y-2">
                {days.map((day, i) => {
                  const isSelected = selectedDate && 
                    day.date.getDate() === selectedDate.getDate() &&
                    day.date.getMonth() === selectedDate.getMonth() &&
                    day.date.getFullYear() === selectedDate.getFullYear();
                  const disabled = !day.muted && isDayDisabled(new Date(day.date));
                  
                  return (
                    <button
                      key={i}
                      onClick={() => !day.muted && !disabled && setSelectedDate(new Date(day.date))}
                      disabled={disabled}
                      className={[
                        "mx-auto my-1 w-8 h-8 sm:w-10 sm:h-10 grid place-items-center rounded-[12px] text-sm sm:text-base lg:text-[18px]",
                        day.muted ? "text-[#b7bdc8] cursor-not-allowed" : disabled ? "text-[#b7bdc8] opacity-50 cursor-not-allowed" : "text-[#313234]",
                        isSelected ? "bg-[#306eec] text-white ring-4 ring-[#306eec]/15" : "bg-transparent hover:bg-white/80"
                      ].join(" ")}
                    >
                      {day.date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Note below calendar - centered */}
            <p className="mt-[12px] sm:mt-[12px] text-sm sm:text-base text-[#6a6c71] text-center leading-[120%] tracking-[-0.05em]">
              Same-day or next-day visits? Please call us directly.
            </p>
          </div>

          {/* Right column */}
          <div className="lg:col-span-7">
            {/* Time + length */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              {selectedDate && availableTimes.length > 0 ? (
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full sm:w-[160px] h-[54px] rounded-[11px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.09)] px-4 sm:px-6 text-[#313234] text-lg sm:text-[20px] appearance-none"
                  style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M6 9L12 15L18 9\' stroke=\'%23313234\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5rem' }}
                >
                  <option value="">Select time</option>
                  {availableTimes.map(time => {
                    const used = takenCounts[time] || 0;
                    const spotsLeft = capacity - used;
                    return (
                      <option key={time} value={time}>
                        {time} {capacity > 1 && `(${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left)`}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="w-full sm:w-[160px] h-[54px] rounded-[11px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.09)] flex items-center px-4 sm:px-6 text-[#6a6c71] text-sm">
                  Select date first
                </div>
              )}
              <div className="text-sm sm:text-base text-[#6a6c71]">Visit length: up to 90 minutes</div>
            </div>

            {/* Issue description block with buttons on the right */}
            <div className="relative mt-6 rounded-[14px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.10)] p-4 sm:p-5 min-h-[200px] sm:min-h-[141px]">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Briefly describe your issue (e.g. leaking faucet, light switch not working)..."
                className="w-full h-20 bg-transparent text-sm sm:text-base text-[#313234] placeholder-[#6a6c71] resize-none focus:outline-none"
              />
              <div className="text-xs text-[#6a6c71] mt-1">
                {note.trim().split(/\s+/).filter(w => w).length} words (minimum 3)
              </div>
              <div className="absolute left-4 right-4 bottom-4 sm:left-auto sm:right-5 sm:bottom-5 flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="relative">
                  <button 
                    type="button"
                    onClick={() => setShowServiceMenu(!showServiceMenu)}
                    className="h-[43px] px-4 sm:px-5 rounded-[11px] border border-[#313234] bg-[#EEF2FF] text-[#313234] text-sm sm:text-base whitespace-nowrap"
                  >
                    {service || 'Select a service'}
                  </button>
                  {showServiceMenu && (
                    <div className="absolute bottom-full mb-2 left-0 w-full min-w-[200px] bg-white border border-[#c5cbd8] rounded-[11px] shadow-lg z-10">
                      {SERVICES.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setService(s);
                            setShowServiceMenu(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm hover:bg-[#EEF2FF] text-[#313234]"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <label className="h-[43px] px-4 sm:px-5 rounded-[11px] border border-[#313234] bg-[#EEF2FF] text-[#313234] text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer hover:bg-white/50 transition-colors whitespace-nowrap">
                  <Paperclip />
                  Add photo {uploadedPhotos.length > 0 && `(${uploadedPhotos.length})`}
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Address */}
            <div className="mt-6 w-full h-[54px] rounded-[11px] border border-[#c5cbd8] bg-[#EEF2FF] shadow-[0_0_200px_rgba(0,0,0,0.10)] flex items-center px-4 sm:px-6">
              <span className="text-sm sm:text-base text-[#313234]">
                {user?.address || 'Default address will be used'}
              </span>
            </div>

            {/* Subscription warning */}
            {isAuthenticated && !checkingSubscription && !hasSubscription && subscriptionError && (
              <div className="mt-4 text-red-700 text-sm bg-red-50 border border-red-300 rounded-lg p-4">
                <div className="font-semibold mb-2">🔒 No Active Subscription</div>
                <div className="mb-3">{subscriptionError}</div>
                <a 
                  href="#plans" 
                  className="inline-block px-4 py-2 bg-[#306EEC] text-white rounded-lg hover:bg-[#2558c9] transition-colors text-sm font-medium"
                >
                  View Subscription Plans
                </a>
              </div>
            )}

            {/* Active booking warning */}
            {hasActiveBooking && existingBookingDate && (
              <div className="mt-4 text-orange-700 text-sm bg-orange-50 border border-orange-300 rounded-lg p-4">
                <div className="font-semibold mb-1">⚠️ You have an active booking</div>
                <div>
                  Scheduled for {existingBookingDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <div className="text-xs mt-2">
                  You can book another visit, but note that you have a pending appointment.
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mt-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            {/* Book now button */}
            <div className="mt-6">
              <button 
                onClick={handleBookNow}
                disabled={loading || checkingSubscription || (!hasSubscription && isAuthenticated)}
                className="w-full sm:w-[259px] h-[57px] rounded-[14px] bg-[#306eec] border border-[#306eec] text-[#eef2ff] text-lg sm:text-[20px] font-semibold hover:bg-[#2558c9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingSubscription ? 'Checking...' : loading ? 'Booking...' : 'Book now'}
              </button>
            </div>
          </div>
        </div>

        {/* Booking Confirmation Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-[20px] p-8 max-w-[500px] w-full mx-4" onClick={(e) => e.stopPropagation()}>
              {/* Party Icon */}
              <div className="text-center mb-6">
                <div className="text-6xl">🎉</div>
              </div>
              
              <h2 className="text-[32px] font-bold text-[#313234] text-center mb-6">
                Booking Confirmed
              </h2>
              
              <div className="space-y-3 mb-6">
                <div className="flex gap-2">
                  <span className="font-semibold text-[#313234]">Booking #:</span>
                  <span className="text-[#6A6D71]">{bookingNumber}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-[#313234]">Service:</span>
                  <span className="text-[#6A6D71]">{confirmedService}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-[#313234]">Date:</span>
                  <span className="text-[#6A6D71]">
                    {confirmedDate?.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-[#313234]">Time:</span>
                  <span className="text-[#6A6D71]">{confirmedTime}</span>
                </div>
              </div>
              
              <p className="text-[#6A6D71] text-[16px] mb-6">
                Mr. Fixter will reach out to you shortly.<br />
                A confirmation email has been sent.
              </p>
              
              <div className="bg-[#EEF2FF] rounded-[12px] p-4 mb-6">
                <h3 className="text-[#306EEC] font-semibold text-[18px] mb-3">Before your visit</h3>
                <p className="text-[#6A6D71] text-[14px] mb-2">
                  Please have all <span className="text-[#306EEC]">materials/fixtures on-site and ready</span> (faucets, lights, shelves, hardware, etc.).
                </p>
                <p className="text-[#6A6D71] text-[14px] mb-2">
                  Your Fixter may arrive <span className="text-[#306EEC]">up to 30 minutes before or after</span> the booked time (traffic & job length).
                </p>
                <p className="text-[#6A6D71] text-[14px]">
                  Emergencies or questions? Call <a href="tel:631-599-1363" className="text-[#306EEC]">631-599-1363</a> or email <a href="mailto:my@profixter.com" className="text-[#306EEC]">my@profixter.com</a>.
                </p>
              </div>
              
              <button
                onClick={() => setShowModal(false)}
                className="w-full h-[57px] rounded-[14px] bg-[#306EEC] text-white text-[20px] font-semibold hover:bg-[#2558c9] transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function ChevronDown() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function Paperclip() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21.44 11.05L12.49 20C10.32 22.17 6.8 22.17 4.63 20C2.46 17.83 2.46 14.31 4.63 12.14L13.58 3.19C15.13 1.64 17.64 1.64 19.19 3.19C20.74 4.74 20.74 7.25 19.19 8.8L10.24 17.75C9.47 18.52 8.22 18.52 7.45 17.75C6.68 16.98 6.68 15.73 7.45 14.96L15.69 6.72" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
