"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";

type Address = {
  _id: string;
  label?: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
};

export function AddressesPanel({
  addresses,
  defaultAddressId,
  onRefresh,
}: {
  addresses: Address[];
  defaultAddressId: string | null;
  onRefresh: () => Promise<void>;
}) {
  const { token } = useAuth();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const setDefault = async (addressId: string) => {
    if (!token) return;
    setLoadingId(addressId);
    try {
      const res = await fetch(
        `https://api.profixter.com/api/users/default-address/${addressId}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.message || "Failed to set default address.");
        return;
      }

      await onRefresh();
    } finally {
      setLoadingId(null);
    }
  };

  const removeAddress = async (addressId: string) => {
    if (!token) return;
    if (!confirm("Delete this address?")) return;

    setDeletingId(addressId);
    try {
      const res = await fetch(
        `https://api.profixter.com/api/users/addresses/${addressId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.message || "Failed to delete address.");
        return;
      }

      await onRefresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="text-lg sm:text-xl font-semibold text-[#313234]">
          Addresses
        </h3>

        <button
          onClick={() => (window.location.href = "/account/add-address")}
          className="h-[44px] px-4 rounded-xl bg-[#306EEC] hover:bg-[#2558c9] text-white font-bold transition"
        >
          Add address
        </button>
      </div>

      <div className="space-y-3">
        {addresses.map((a) => {
          const isDefault = String(a._id) === String(defaultAddressId);

          return (
            <div
              key={a._id}
              className="bg-[#EEF2FF] border border-[#C5CBD8] rounded-[20px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[#313234] font-semibold">
                    {a.label || "Address"}
                  </p>
                  {isDefault && (
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#86EFAC] text-[#064E3B]">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-[#313234] opacity-80">
                  {a.line1}, {a.city}, {a.state} {a.zip}
                </p>
              </div>

              <div className="flex gap-2">
                {!isDefault && (
                  <button
                    onClick={() => setDefault(a._id)}
                    disabled={loadingId === a._id}
                    className="h-[42px] px-4 rounded-xl bg-white border border-[#C5CBD8] text-[#313234] font-bold hover:bg-gray-50 transition disabled:opacity-60"
                  >
                    {loadingId === a._id ? "Setting..." : "Set default"}
                  </button>
                )}

                <button
                  onClick={() => removeAddress(a._id)}
                  disabled={deletingId === a._id || isDefault}
                  className="h-[42px] px-4 rounded-xl bg-white border border-[#FCA5A5] text-[#B91C1C] font-bold hover:bg-red-50 transition disabled:opacity-60"
                >
                  {isDefault ? "Default" : deletingId === a._id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          );
        })}

        {addresses.length === 0 && (
          <div className="text-sm text-[#6A6D71] italic">
            No addresses yet. Click “Add address”.
          </div>
        )}
      </div>

      <p className="text-sm text-[#6A6D71] italic mt-3">
        Addresses cannot be edited. If you need changes, delete and add a new one.
      </p>
    </div>
  );
}
