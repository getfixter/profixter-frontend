// FINAL VERSION — Static personal info pulled from DB
// Shows User ID, Name, Email, Phone, Address (default address preferred)
// + Addresses list + Add address inside Personal info

import type { AccountFormData } from "./types";
import { AddressesPanel } from "./AddressesPanel";

interface PersonalInfoFormProps {
  formData: AccountFormData;
}

function formatAddress(a?: { line1?: string; city?: string; state?: string; zip?: string }): string {
  if (!a) return "—";
  const line1 = a.line1?.trim() || "";
  const city = a.city?.trim() || "";
  const state = a.state?.trim() || "";
  const zip = a.zip?.trim() || "";

  const parts: string[] = [];
  if (line1) parts.push(line1);

  const cityStateZip = [city || "", state || "", zip || ""]
    .filter(Boolean)
    .join(state && city ? ", " : " ");

  if (cityStateZip.trim()) parts.push(cityStateZip.trim());
  return parts.length ? parts.join(", ") : "—";
}

export function PersonalInfoForm({ formData }: PersonalInfoFormProps) {
  const addresses = (formData?.addresses || []) as any[];

  const defaultAddr =
    (formData?.defaultAddressId
      ? addresses.find((a) => String(a._id) === String(formData.defaultAddressId))
      : null) || null;

  const primaryAddr = defaultAddr || addresses[0] || null;

  const finalAddress = primaryAddr
    ? formatAddress(primaryAddr)
    : formatAddress({
        line1: formData?.address,
        city: formData?.city,
        state: formData?.state,
        zip: formData?.zip,
      });

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold text-[#313234] mb-6 sm:mb-8">
        Personal information
      </h2>

      {/* ✅ Addresses section first */}
      <AddressesPanel
        addresses={addresses as any}
        defaultAddressId={formData?.defaultAddressId ? String(formData.defaultAddressId) : null}
      />

      {/* Then account info (without User ID) */}
      <div className="space-y-4 sm:space-y-5 mt-6 sm:mt-8">
        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">
            Name
          </label>
          <div className="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] text-[#313234] text-sm sm:text-base font-medium opacity-90">
            {formData?.name || "—"}
          </div>
        </div>

        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">
            Email
          </label>
          <div className="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] text-[#313234] text-sm sm:text-base font-medium opacity-90">
            {formData?.email || "—"}
          </div>
        </div>

        <div>
          <label className="block text-[#6A6D71] text-sm sm:text-base mb-2 sm:mb-3">
            Phone
          </label>
          <div className="w-full px-4 sm:px-5 py-2.5 sm:py-3 bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] text-[#313234] text-sm sm:text-base font-medium opacity-90">
            {formData?.phone || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
