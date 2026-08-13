import type { AccountAddress, AccountFormData } from "./types";
import { AddressesPanel } from "./AddressesPanel";

interface PersonalInfoFormProps {
  formData: AccountFormData;
}

function AccountDetail({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-[#6A6D71]">{label}</label>
      <div className="w-full rounded-[8px] border border-[#C5CBD8] bg-[#EEF2FF] px-4 py-2.5 text-sm font-medium text-[#313234] opacity-90 sm:px-5 sm:py-3 sm:text-base">
        {value || "-"}
      </div>
    </div>
  );
}

export function PersonalInfoForm({ formData }: PersonalInfoFormProps) {
  const addresses = (formData?.addresses || []) as AccountAddress[];

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl font-semibold text-[#313234] sm:text-2xl">
          Profile and addresses
        </h2>
        <p className="mt-1 text-sm text-[#6A6D71]">
          Manage where visits happen first. Account details are below.
        </p>
      </div>

      <AddressesPanel
        addresses={addresses}
        defaultAddressId={formData?.defaultAddressId ? String(formData.defaultAddressId) : null}
      />

      <details className="mt-5 rounded-[8px] border border-[#E0E6F5] bg-white">
        <summary className="flex min-h-[46px] cursor-pointer list-none items-center justify-between px-4 py-3 text-[15px] font-bold text-[#313234]">
          Account details
          <span className="text-[12px] font-semibold text-[#6A6D71]">Show</span>
        </summary>

        <div className="space-y-4 border-t border-[#EEF2FF] px-4 py-4 sm:space-y-5 sm:px-5">
          <AccountDetail label="Name" value={formData?.name} />
          <AccountDetail label="Email" value={formData?.email} />
          <AccountDetail label="Phone" value={formData?.phone} />
          <p className="text-xs text-[#6A6D71]">
            Need to change your name, email, or phone? Call 631-599-1363 and we&apos;ll help.
          </p>
        </div>
      </details>
    </div>
  );
}
