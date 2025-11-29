// FINAL VERSION — ALWAYS SHOWS ADDRESS FROM DATABASE
// Works with BOTH legacy fields and new multi-address system
// 100% static — no editing, no buttons

import { AccountFormData } from './types';

interface PersonalInfoFormProps {
  formData: any; // We allow ANY so we can read raw DB fields directly
}

export function PersonalInfoForm({ formData }: PersonalInfoFormProps) {
  // --- 1. EXTRACT ADDRESS FROM NEW SYSTEM (addresses[])
  const newAddr = formData?.addresses?.[0];

  const newAddress1 = newAddr
    ? `${newAddr.line1 || ''}${newAddr.city ? ', ' + newAddr.city : ''}${newAddr.state ? ', ' + newAddr.state : ''}${newAddr.zip ? ' ' + newAddr.zip : ''}`
    : '';

  const newAddress2 = newAddr?.county || '';

  // --- 2. EXTRACT FROM LEGACY FIELDS IF NEW SYSTEM IS EMPTY
  const legacyAddress1 =
    formData?.address || formData?.city || formData?.state || formData?.zip
      ? `${formData.address || ''}${formData.city ? ', ' + formData.city : ''}${formData.state ? ', ' + formData.state : ''}${formData.zip ? ' ' + formData.zip : ''}`
      : '';

  const legacyAddress2 = formData?.county || '';

  // --- 3. FINAL VALUES (PREFER NEW SYSTEM)
  const finalAddress1 = newAddress1 || legacyAddress1 || '—';
  const finalAddress2 = newAddress2 || legacyAddress2 || '—';

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-8 sm:mb-10">
        Personal information
      </h2>

      <div className="space-y-6 sm:space-y-6">
        {/* Name */}
        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">Name</label>
          <div className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[#EEF2FF] border border-[#C5CBD8]
                          rounded-[20px] text-[#313234] text-base sm:text-xl font-medium opacity-90">
            {formData?.name || '—'}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">Email</label>
          <div className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[#EEF2FF] border border-[#C5CBD8]
                          rounded-[20px] text-[#313234] text-base sm:text-xl font-medium opacity-90">
            {formData?.email || '—'}
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">Phone</label>
          <div className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[#EEF2FF] border border-[#C5CBD8]
                          rounded-[20px] text-[#313234] text-base sm:text-xl font-medium opacity-90">
            {formData?.phone || '—'}
          </div>
        </div>

        {/* Address 1 */}
        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">Address</label>
          <div className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[#EEF2FF] border border-[#C5CBD8]
                          rounded-[20px] text-[#313234] text-base sm:text-xl font-medium opacity-90">
            {finalAddress1}
          </div>
        </div>

        {/* Address 2 */}
        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">County</label>
          <div className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-[#EEF2FF] border border-[#C5CBD8]
                          rounded-[20px] text-[#313234] text-base sm:text-xl font-medium opacity-90">
            {finalAddress2}
          </div>
        </div>

        <p className="text-sm text-[#6A6D71] italic -mt-2">
          This information is pulled directly from your stored account details.
        </p>
      </div>
    </div>
  );
}
