'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ActiveTab, AccountFormData } from '../components/account/types';
import { initialAccountFormData } from '../data/account';
import { AccountHeader } from '../components/account/AccountHeader';
import { AccountSidebar } from '../components/account/AccountSidebar';
import { PersonalInfoForm } from '../components/account/PersonalInfoForm';
import { PlanSection } from '../components/account/PlanSection';
import { PasswordForm } from '../components/account/PasswordForm';
import { useAuth } from '@/lib/useAuth';

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('personal');
  const [formData, setFormData] = useState<AccountFormData>(initialAccountFormData);
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/signin');
    }
  }, [isAuthenticated, isLoading, router]);

  // Load user data when authenticated
  useEffect(() => {
  if (user) {
    setFormData({
      userId: user.userId || user.id || '', 
      name: user.name || '',
      email: user.email || '', 
      phone: user.phone || '',

      // Legacy address
      address: user.address || '',
      city: user.city || '',
      state: user.state || '',
      zip: user.zip || '',
      county: user.county || '',

      // New multi-address support
      addresses: user.addresses || [],
    });
  }
}, [user]);


 const handleLogout = () => {
  logout();                // Clears token + user (react state updates)
  router.replace('/signin');
};



  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-[#313234] text-xl">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  const handleInputChange = (field: keyof AccountFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveChanges = () => {
    // Save logic
    console.log('Saving changes:', formData);
  };

  const handleDiscardChanges = () => {
    setFormData(initialAccountFormData);
  };

  return (
    <div className="min-h-screen bg-[#EEF2FF]">
      <AccountHeader userName={formData.name} />

      {/* Main Content */}
      <main className="max-w-[1240px] mx-auto px-[20px]  py-6 sm:py-10">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          <AccountSidebar activeTab={activeTab} setActiveTab={setActiveTab} userName={formData.name} onLogout={handleLogout} />

          {/* Right Content */}
          <div className="flex-1 bg-[#EEF2FF] border border-[#C5CBD8] rounded-[11px] p-6 sm:p-8 lg:p-12" style={{ boxShadow: '0px 0px 200px 0px rgba(0, 0, 0, 0.1)' }}>
            {activeTab === 'personal' && (
  <PersonalInfoForm formData={formData} />
)}


            {activeTab === 'plan' && (<PlanSection />)}


            {activeTab === 'password' && (<PasswordForm />)}
          </div>
        </div>
      </main>
      
    </div>
  );
}

