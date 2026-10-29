"use client";

import { useState } from "react";
import API from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { readApiError } from "@/lib/auth2";
import { useAddHome } from "@/app/components/address/AddHomeSheet";
import { buttonClass } from "@/app/components/ui/Button";

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
    <section className="acct-card" aria-labelledby="acct-homes">
      <div className="acct-card__head !items-center">
        <h2 id="acct-homes" className="acct-card__title">
          Homes
        </h2>
        <button type="button" onClick={openHome} className={buttonClass({ variant: "secondary", size: "sm" })}>
          Add address
        </button>
      </div>

      {homeSheet}

      <ul className="mt-3 grid gap-2">
        {addresses.map((a) => {
          const isDefault = String(a._id) === String(defaultAddressId);

          return (
            <li
              key={a._id}
              className="flex flex-col gap-3 rounded-[var(--ui-r-sm)] border border-[color:var(--ui-line)] p-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-semibold text-[color:var(--ui-ink)]">{a.label || "Address"}</p>
                  {isDefault && <span className="ui-tag !min-h-[22px]">Default</span>}
                </div>
                <p className="mt-0.5 break-words text-[14px] text-[color:var(--ui-text-2)]">
                  {addressText(a) || "Address details missing"}
                </p>
              </div>

              {/* The default home cannot be deleted, so it offers nothing to press. */}
              {!isDefault ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setDefault(a._id)}
                    disabled={loadingId === a._id}
                    className={buttonClass({ variant: "secondary", size: "sm", className: "flex-1 disabled:opacity-60 sm:flex-none" })}
                  >
                    {loadingId === a._id ? "Setting..." : "Set default"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAddress(a._id, isDefault)}
                    disabled={deletingId === a._id}
                    className={buttonClass({ variant: "ghost", size: "sm", className: "flex-1 !text-[#b4342b] disabled:opacity-60 sm:flex-none" })}
                  >
                    {deletingId === a._id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}

        {addresses.length === 0 && (
          <li className="rounded-[var(--ui-r-sm)] border border-dashed border-[color:var(--ui-line-2)] p-4 text-[14px] text-[color:var(--ui-text-2)]">
            No home saved yet. Add it when you&apos;re ready to book. We&apos;ll check we serve your area.
          </li>
        )}
      </ul>
    </section>
  );
}
