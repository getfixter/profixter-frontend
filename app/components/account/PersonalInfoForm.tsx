// FINAL VERSION — Static personal info pulled from DB
// Shows User ID, Name, Email, Phone, Address
// No duplicates

import { AccountFormData } from './types';

interface PersonalInfoFormProps {
  formData: any;
}

export function PersonalInfoForm({ formData }: PersonalInfoFormProps) {
  // New multi-address system
  const newAddr = formData?.addresses?.[0];

  const finalAddress =
    newAddr
      ? `${newAddr.line1}${newAddr.city ? ', ' + newAddr.city : ''}${newAddr.state ? ', ' + newAddr.state : ''}${newAddr.zip ? ' ' + newAddr.zip : ''}`
      : formData?.address || formData?.city || formData?.state || formData?.zip
      ? `${formData.address || ''}${formData.city ? ', ' + formData.city : ''}${formData.state ? ', ' + formData.state : ''}${formData.zip ? ' ' + formData.zip : ''}`
      : '—';

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-8 sm:mb-10">
        Personal information
      </h2>

      <div className="space-y-6 sm:space-y-6">

        {/* USER ID */}
        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">
            Your ID
          </label>
          <div className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[#EEF2FF] border border-[#C5CBD8]
                          rounded-[20px] text-[#313234] text-base sm:text-xl font-medium opacity-90">
            {formData?.userId || '—'}
          </div>
        </div>

        {/* NAME */}
        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">Name</label>
          <div className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[#EEF2FF] border border-[#C5CBD8]
                          rounded-[20px] text-[#313234] text-base sm:text-xl font-medium opacity-90">
            {formData?.name || '—'}
          </div>
        </div>

        {/* EMAIL */}
        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">Email</label>
          <div className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[#EEF2FF] border border-[#C5CBD8]
                          rounded-[20px] text-[#313234] text-base sm:text-xl font-medium opacity-90">
            {formData?.email || '—'}
          </div>
        </div>

        {/* PHONE */}
        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">Phone</label>
          <div className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[#EEF2FF] border border-[#C5CBD8]
                          rounded-[20px] text-[#313234] text-base sm:text-xl font-medium opacity-90">
            {formData?.phone || '—'}
          </div>
        </div>

        {/* ADDRESS */}
        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">Address</label>
          <div className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[#EEF2FF] border border-[#C5CBD8]
                          rounded-[20px] text-[#313234] text-base sm:text-xl font-medium opacity-90">
            {finalAddress}
          </div>
        </div>

        <p className="text-sm text-[#6A6D71] italic -mt-2">
          This information is pulled directly from your stored account details.
        </p>
      </div>
    </div>
  );
}
