"use client";

import { useState } from "react";
import API from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { readApiError } from "@/lib/auth2";
import { useAddHome } from "@/app/components/address/AddHomeSheet";

type Address = {
  _id: string;
  label?: string;
  line1: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
};

function addressText(a: Address) {
  const cityState = [a.city, a.state].filter((part) => String(part || "").trim()).join(", ");
  return [a.line1, [cityState, a.zip].filter((part) => String(part || "").trim()).join(" ")]
    .filter((part) => String(part || "").trim())
    .join(", ");
}

export function AddressesPanel({
  addresses,
  defaultAddressId,
}: {
  addresses: Address[];
  defaultAddressId: string | null;
}) {
  const { token, refreshUser } = useAuth();
  /* New homes go through the shared "Add your home" sheet (POST /api/users/me/addresses). */
  const { homeSheet, openHome } = useAddHome({ submitLabel: "Save address" });

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const setDefault = async (addressId: string) => {
    if (!token) return;

    setLoadingId(addressId);
    try {
      await API.patch(`/api/users/default-address/${addressId}`);
      await refreshUser();
    } catch (err) {
      alert(readApiError(err).message || "Failed to set default address.");
    } finally {
      setLoadingId(null);
    }
  };

  const removeAddress = async (addressId: string, isDefault: boolean) => {
    if (!token) return;
    if (isDefault) return; // extra safety
    if (!confirm("Delete this address?")) return;

    setDeletingId(addressId);
    try {
      await API.delete(`/api/users/addresses/${addressId}`);
      await refreshUser();
    } catch (err) {
      alert(readApiError(err).message || "Failed to delete address.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg sm:text-xl font-semibold text-[#313234]">Addresses</h3>

        <button
          type="button"
          onClick={openHome}
          className="h-[44px] px-4 rounded-[8px] bg-[#306EEC] hover:bg-[#2558c9] text-white font-bold transition"
        >
          Add address
        </button>
      </div>

      {homeSheet}

      {/* List */}
      <div className="space-y-3">
        {addresses.map((a) => {
          const isDefault = String(a._id) === String(defaultAddressId);

          return (
            <div
              key={a._id}
              className="bg-[#EEF2FF] border border-[#C5CBD8] rounded-[8px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[#313234] font-semibold">{a.label || "Address"}</p>

                  {isDefault && (
                    <span className="text-xs font-bold px-2 py-1 rounded-[6px] bg-[#86EFAC] text-[#064E3B]">
                      Default
                    </span>
                  )}
                </div>

                <p className="text-[#313234] opacity-80">{addressText(a) || "Address details missing"}</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {!isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefault(a._id)}
                    disabled={loadingId === a._id}
                    className="h-[42px] px-4 rounded-[8px] bg-white border border-[#C5CBD8] text-[#313234] font-bold hover:bg-gray-50 transition disabled:opacity-60"
                  >
                    {loadingId === a._id ? "Setting..." : "Set default"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => removeAddress(a._id, isDefault)}
                  disabled={deletingId === a._id || isDefault}
                  className="h-[42px] px-4 rounded-[8px] bg-white border border-[#FCA5A5] text-[#B91C1C] font-bold hover:bg-red-50 transition disabled:opacity-60"
                >
                  {isDefault ? "Default" : deletingId === a._id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          );
        })}

        {addresses.length === 0 && (
          <div className="rounded-[8px] border border-dashed border-[#C5CBD8] bg-white p-4 text-sm text-[#6A6D71] sm:p-5">
            No home saved yet. Add it when you&apos;re ready to book. We&apos;ll check we serve your area.
          </div>
        )}
      </div>
    </div>
  );
}
