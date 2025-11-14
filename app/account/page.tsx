'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

type ActiveTab = 'personal' | 'plan' | 'bookings' | 'password';

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('personal');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: 'Taras Bandura',
    email: 'bandurataras1596@gmail.com',
    phone: '',
    address1: '740 West 187th Street Manhattan, NY, 10033',
    address2: '',
  });

  const [bookings, setBookings] = useState<any[]>([
    {
      id: 1,
      address: '25 42nd Street Lindenhurst,\nNY, 11757 • Nassau',
      date: 'Nov 7, 2025',
      time: '6:00 PM'
    },
    {
      id: 2,
      address: '25 42nd Street Lindenhurst,\nNY, 11757 • Nassau',
      date: 'Nov 7, 2025',
      time: '6:00 PM'
    }
  ]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveChanges = () => {
    // Save logic
    console.log('Saving changes:', formData);
  };

  const handleDiscardChanges = () => {
    // Reset to original values
    setFormData({
      name: 'Taras Bandura',
      email: 'bandurataras1596@gmail.com',
      phone: '',
      address1: '740 West 187th Street Manhattan, NY, 10033',
      address2: '',
    });
  };

  return (
    <div className="min-h-screen bg-[#EEF2FF]">
      {/* Header */}
      <header className="w-full py-4 sm:py-5 px-4 sm:px-8">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link href="/">
            <div className="cursor-pointer">
              <h1 className="text-lg sm:text-xl font-medium text-[#313234]">Profixter</h1>
              <p className="text-xs text-[#313234] text-right">Long Island</p>
            </div>
          </Link>

          {/* Navigation - Hidden on mobile */}
          <nav className="hidden lg:flex items-center gap-8">
            <Link href="#how-it-works" className="text-[#313234] text-base hover:text-[#306EEC]">
              How it works
            </Link>
            <Link href="#plans" className="text-[#313234] text-base hover:text-[#306EEC]">
              Plans
            </Link>
            <Link href="#pick-day" className="text-[#313234] text-base hover:text-[#306EEC]">
              Pick day
            </Link>
            <Link href="#projects" className="text-[#313234] text-base hover:text-[#306EEC]">
              Projects
            </Link>
          </nav>

          {/* User Profile */}
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <span className="text-[#313234] text-sm sm:text-base">Taras</span>
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#C5CBD8] flex items-center justify-center">
                <svg width="24" height="22" viewBox="0 0 31 28" fill="none" className="sm:w-[31px] sm:h-[28px]">
                  <path d="M15.5 14C18.5376 14 21 11.5376 21 8.5C21 5.46243 18.5376 3 15.5 3C12.4624 3 10 5.46243 10 8.5C10 11.5376 12.4624 14 15.5 14Z" fill="#EEF2FF"/>
                  <path d="M15.5 16C9.70101 16 5 19.134 5 23C5 24.1046 5.89543 25 7 25H24C25.1046 25 26 24.1046 26 23C26 19.134 21.299 16 15.5 16Z" fill="#EEF2FF"/>
                </svg>
              </div>
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 sm:w-56 bg-white border border-[#C5CBD8] rounded-[14px] shadow-lg py-2 z-50">
                <Link 
                  href="#how-it-works" 
                  className="block px-4 py-3 text-sm sm:text-base text-[#313234] hover:bg-[#EEF2FF] transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  How it works
                </Link>
                <Link 
                  href="#plans" 
                  className="block px-4 py-3 text-sm sm:text-base text-[#313234] hover:bg-[#EEF2FF] transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Plans
                </Link>
                <Link 
                  href="#pick-day" 
                  className="block px-4 py-3 text-sm sm:text-base text-[#313234] hover:bg-[#EEF2FF] transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Pick day
                </Link>
                <Link 
                  href="#projects" 
                  className="block px-4 py-3 text-sm sm:text-base text-[#313234] hover:bg-[#EEF2FF] transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Projects
                </Link>
                <div className="border-t border-[#C5CBD8] my-2"></div>
                <Link 
                  href="/" 
                  className="block px-4 py-3 text-sm sm:text-base text-[#313234] hover:bg-[#EEF2FF] transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Home
                </Link>
                <button 
                  className="block w-full text-left px-4 py-3 text-sm sm:text-base text-red-600 hover:bg-[#EEF2FF] transition-colors"
                  onClick={() => {
                    setIsMenuOpen(false);
                    // Add logout logic here
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          {/* Left Sidebar */}
          <div className="w-full lg:w-[358px] bg-[#EEF2FF] border border-[#C5CBD8] rounded-[11px] p-4 sm:p-6 lg:p-8" style={{ boxShadow: '0px 0px 200px 0px rgba(0, 0, 0, 0.1)' }}>
            {/* Avatar */}
            <div className="flex flex-col items-center mb-6 sm:mb-8">
              <div className="w-[120px] h-[120px] sm:w-[150px] sm:h-[150px] rounded-full bg-[#C5CBD8] flex items-center justify-center mb-3 sm:mb-4">
                <svg width="85" height="77" viewBox="0 0 106 96" fill="none" className="sm:w-[106px] sm:h-[96px]">
                  <path d="M53 48C61.8366 48 69 40.8366 69 32C69 23.1634 61.8366 16 53 16C44.1634 16 37 23.1634 37 32C37 40.8366 44.1634 48 53 48Z" fill="#EEF2FF"/>
                  <path d="M53 53C35.8792 53 22 62.0589 22 73C22 77.4183 25.5817 81 30 81H76C80.4183 81 84 77.4183 84 73C84 62.0589 70.1208 53 53 53Z" fill="#EEF2FF"/>
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-1">Taras Bandura</h2>
            </div>

            {/* Menu */}
            <nav className="space-y-3 sm:space-y-4">
              <button
                onClick={() => setActiveTab('personal')}
                className={`w-full text-left text-sm sm:text-base px-0 py-1 relative ${
                  activeTab === 'personal' ? 'text-[#313234]' : 'text-[#313234]'
                }`}
              >
                Personal information
                <span className={`absolute -bottom-1 left-0 w-full h-0.5 bg-[#306EEC] transition-transform duration-300 origin-left ${
                  activeTab === 'personal' ? 'scale-x-100' : 'scale-x-0'
                }`}></span>
              </button>
              <button
                onClick={() => setActiveTab('plan')}
                className={`w-full text-left text-sm sm:text-base px-0 py-1 relative ${
                  activeTab === 'plan' ? 'text-[#313234]' : 'text-[#313234]'
                }`}
              >
                My plan
                <span className={`absolute -bottom-1 left-0 w-full h-0.5 bg-[#306EEC] transition-transform duration-300 origin-left ${
                  activeTab === 'plan' ? 'scale-x-100' : 'scale-x-0'
                }`}></span>
              </button>
              <button
                onClick={() => setActiveTab('bookings')}
                className={`w-full text-left text-sm sm:text-base px-0 py-1 relative ${
                  activeTab === 'bookings' ? 'text-[#313234]' : 'text-[#313234]'
                }`}
              >
                My bookings
                <span className={`absolute -bottom-1 left-0 w-full h-0.5 bg-[#306EEC] transition-transform duration-300 origin-left ${
                  activeTab === 'bookings' ? 'scale-x-100' : 'scale-x-0'
                }`}></span>
              </button>
              <button
                onClick={() => setActiveTab('password')}
                className={`w-full text-left text-sm sm:text-base px-0 py-1 relative ${
                  activeTab === 'password' ? 'text-[#313234]' : 'text-[#313234]'
                }`}
              >
                Password
                <span className={`absolute -bottom-1 left-0 w-full h-0.5 bg-[#306EEC] transition-transform duration-300 origin-left ${
                  activeTab === 'password' ? 'scale-x-100' : 'scale-x-0'
                }`}></span>
              </button>
              <button className="w-full text-left text-base px-0 py-1 text-[#FF3C3C]">
                Log Out
              </button>
            </nav>
          </div>

          {/* Right Content */}
          <div className="flex-1 bg-[#EEF2FF] border border-[#C5CBD8] rounded-[11px] p-6 sm:p-8 lg:p-12" style={{ boxShadow: '0px 0px 200px 0px rgba(0, 0, 0, 0.1)' }}>
            {activeTab === 'personal' && (
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-8 sm:mb-12">Personal information</h2>

                <form className="space-y-6 sm:space-y-10">
                  {/* Name */}
                  <div>
                    <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-transparent border-b border-[#C5CBD8] text-[#313234] text-base sm:text-xl font-medium focus:outline-none focus:border-[#306EEC] transition-colors"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-transparent border-b border-[#C5CBD8] text-[#313234] text-base sm:text-xl font-medium focus:outline-none focus:border-[#306EEC] transition-colors"
                    />
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">Phone number</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-transparent border-b border-[#C5CBD8] text-[#313234] text-base sm:text-xl font-medium focus:outline-none focus:border-[#306EEC] transition-colors"
                      placeholder=""
                    />
                  </div>

                  {/* Address 1 */}
                  <div>
                    <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">Address 1</label>
                    <input
                      type="text"
                      value={formData.address1}
                      onChange={(e) => handleInputChange('address1', e.target.value)}
                      className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-transparent border-b border-[#C5CBD8] text-[#313234] text-base sm:text-xl font-medium focus:outline-none focus:border-[#306EEC] transition-colors"
                    />
                  </div>

                  {/* Address 2 */}
                  <div>
                    <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">Address 2</label>
                    <input
                      type="text"
                      value={formData.address2}
                      onChange={(e) => handleInputChange('address2', e.target.value)}
                      className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-transparent border-b border-[#C5CBD8] text-[#313234] text-base sm:text-xl font-medium focus:outline-none focus:border-[#306EEC] transition-colors"
                      placeholder=""
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-6 sm:pt-8">
                    <button
                      type="button"
                      onClick={handleDiscardChanges}
                      className="w-full sm:w-[350px] py-3 sm:py-4 bg-transparent border border-[#306EEC] text-[#313234] rounded-[14px] text-base sm:text-xl font-semibold hover:bg-[#306EEC]/10 transition-colors"
                    >
                      Discard changes
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveChanges}
                      className="w-full sm:w-[350px] py-3 sm:py-4 bg-[#306EEC] text-[#EEF2FF] rounded-[14px] text-base sm:text-xl font-semibold hover:bg-[#2557C7] transition-colors"
                    >
                      Safe changes
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'plan' && (
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-8 sm:mb-12">My plan</h2>
                
                <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 mb-8 sm:mb-10">
                  {/* Current Plan Card */}
                  <div className="w-full lg:w-[400px] bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] p-4 sm:p-6" style={{ boxShadow: '0px 0px 200px 0px rgba(0, 0, 0, 0.1)' }}>
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <h3 className="text-lg sm:text-xl font-medium text-[#313234]">Premium</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg sm:text-xl font-medium text-[#313234]">$349</span>
                        <span className="text-sm sm:text-base text-[#6A6D71]">/month</span>
                      </div>
                    </div>
                    
                    <button className="w-full py-3 sm:py-4 bg-[#306EEC] text-[#EEF2FF] rounded-[14px] text-base sm:text-xl font-semibold hover:bg-[#2557C7] transition-colors">
                      Upgrade Plan
                    </button>
                  </div>

                  {/* Next Payment Card */}
                  <div className="w-full lg:w-[302px] bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] p-4 sm:p-6" style={{ boxShadow: '0px 0px 200px 0px rgba(0, 0, 0, 0.1)' }}>
                    <p className="text-sm sm:text-base text-[#6A6D71] mb-2">Next payment</p>
                    <p className="text-base sm:text-xl font-medium text-[#313234] mb-6 sm:mb-8">On December 30, 2025</p>
                    
                    <button className="text-sm sm:text-base text-[#6A6D71] hover:underline">
                      Cancel plan
                    </button>
                  </div>
                </div>

                {/* Invoices Section */}
                <div>
                  <h3 className="text-lg sm:text-xl font-medium text-[#6A6D71] mb-4 sm:mb-6">Invoices</h3>
                  
                  <div className="space-y-0">
                    {/* Invoice Item */}
                    {[1, 2, 3, 4, 5].map((item) => (
                      <div key={item} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 sm:py-4 border-b border-[#C5CBD8] gap-2 sm:gap-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                          {/* PDF Icon */}
                          <svg width="14" height="18" viewBox="0 0 16 22" fill="none" className="sm:w-4 sm:h-[22px] flex-shrink-0">
                            <path d="M10 0H2C0.9 0 0.0100002 0.9 0.0100002 2L0 20C0 21.1 0.89 22 1.99 22H14C15.1 22 16 21.1 16 20V6L10 0ZM12 18H4V16H12V18ZM12 14H4V12H12V14ZM9 7V1.5L14.5 7H9Z" fill="#313234"/>
                          </svg>
                          <span className="text-sm sm:text-base text-[#313234]">invoice_2025/10.pdf</span>
                        </div>
                        
                        <div className="flex items-center gap-2 sm:gap-4 ml-9 sm:ml-0">
                          <span className="text-xs sm:text-base text-[#6A6D71]">Date of invoice</span>
                          <span className="text-sm sm:text-base text-[#313234]">Nov 02, 2020</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'bookings' && (
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-8 sm:mb-12">My bookings</h2>
                
                {bookings.length === 0 ? (
                  // Empty State
                  <div className="flex flex-col items-center justify-center py-16 sm:py-24">
                    <p className="text-sm sm:text-base text-[#313234] mb-6 sm:mb-8 text-center">No active bookings at the moment.</p>
                    <Link 
                      href="/#pick-day"
                      className="px-12 sm:px-24 py-3 sm:py-4 bg-[#306EEC] text-[#EEF2FF] rounded-[14px] text-base sm:text-xl font-semibold hover:bg-[#2557C7] transition-colors"
                    >
                      Book now
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Table Header - Hidden on mobile */}
                    <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr] gap-4 lg:gap-8 mb-4 sm:mb-6 px-4 sm:px-6">
                      <div className="text-sm sm:text-base text-[#6A6D71]">Address</div>
                      <div className="text-sm sm:text-base text-[#6A6D71]">Date</div>
                      <div className="text-sm sm:text-base text-[#6A6D71]">Time</div>
                    </div>

                    {/* Booking Items */}
                    <div className="space-y-0">
                      {bookings.map((booking) => (
                        <div key={booking.id} className="border-b border-[#C5CBD8] py-4 px-4 sm:px-6">
                          {/* Mobile Layout */}
                          <div className="sm:hidden space-y-3">
                            <div>
                              <p className="text-xs text-[#6A6D71] mb-1">Address</p>
                              <p className="text-sm text-[#313234] leading-[120%]">
                                25 42nd Street Lindenhurst,<br />
                                NY, 11757 • Nassau
                              </p>
                            </div>
                            <div className="flex gap-6">
                              <div>
                                <p className="text-xs text-[#6A6D71] mb-1">Date</p>
                                <p className="text-sm text-[#313234]">Nov 7, 2025</p>
                              </div>
                              <div>
                                <p className="text-xs text-[#6A6D71] mb-1">Time</p>
                                <p className="text-sm text-[#313234]">6:00 PM</p>
                              </div>
                            </div>
                            <button className="text-sm text-[#6A6D71] hover:underline">
                              Cancel booking
                            </button>
                          </div>

                          {/* Desktop Layout */}
                          <div className="hidden sm:block">
                            <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 lg:gap-8 items-start mb-3">
                              <div className="text-sm sm:text-base text-[#313234] leading-[120%]">
                                25 42nd Street Lindenhurst,<br />
                                NY, 11757 • Nassau
                              </div>
                              <div className="text-sm sm:text-base text-[#313234]">Nov 7, 2025</div>
                              <div className="text-sm sm:text-base text-[#313234]">6:00 PM</div>
                            </div>
                            <div className="flex justify-end">
                              <button className="text-sm sm:text-base text-[#6A6D71] hover:underline">
                                Cancel booking
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'password' && (
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-8 sm:mb-12">Password</h2>

                <form className="space-y-6 sm:space-y-10">
                  {/* Current Password */}
                  <div>
                    <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">Current Password</label>
                    <input
                      type="password"
                      className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-white border border-[#C5CBD8] rounded-[14px] text-[#313234] text-sm sm:text-base focus:outline-none focus:border-[#306EEC] transition-colors"
                      placeholder=""
                    />
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">New Password</label>
                    <input
                      type="password"
                      className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-white border border-[#C5CBD8] rounded-[14px] text-[#313234] text-sm sm:text-base focus:outline-none focus:border-[#306EEC] transition-colors"
                      placeholder=""
                    />
                  </div>

                  {/* Confirm new Password */}
                  <div>
                    <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">Confirm new Password</label>
                    <input
                      type="password"
                      className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-white border border-[#C5CBD8] rounded-[14px] text-[#313234] text-sm sm:text-base focus:outline-none focus:border-[#306EEC] transition-colors"
                      placeholder=""
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-6 sm:pt-8">
                    <button
                      type="button"
                      className="w-full sm:w-[350px] py-3 sm:py-4 bg-transparent border border-[#306EEC] text-[#313234] rounded-[14px] text-base sm:text-xl font-semibold hover:bg-[#306EEC]/10 transition-colors"
                    >
                      Discard changes
                    </button>
                    <button
                      type="button"
                      className="w-full sm:w-[350px] py-3 sm:py-4 bg-[#306EEC] text-[#EEF2FF] rounded-[14px] text-base sm:text-xl font-semibold hover:bg-[#2557C7] transition-colors"
                    >
                      Safe changes
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
