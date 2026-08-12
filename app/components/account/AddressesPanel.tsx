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

type ApiErrorBody = {
  message?: string;
};

export function AddressesPanel({
  addresses,
  defaultAddressId,
}: {
  addresses: Address[];
  defaultAddressId: string | null;
}) {
  const { token, refreshUser } = useAuth();

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Inline add form
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState("Address");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("NY");
  const [zip, setZip] = useState("");
  const [county, setCounty] = useState("");

  const resetForm = () => {
    setLabel("Address");
    setLine1("");
    setCity("");
    setState("NY");
    setZip("");
    setCounty("");
  };

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

      const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
      if (!res.ok) {
        alert(data?.message || "Failed to set default address.");
        return;
      }

      await refreshUser();
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
      const res = await fetch(
        `https://api.profixter.com/api/users/addresses/${addressId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
      if (!res.ok) {
        alert(data?.message || "Failed to delete address.");
        return;
      }

      await refreshUser();
    } finally {
      setDeletingId(null);
    }
  };

  const addAddress = async () => {
    if (!token) return;

    const missing: string[] = [];
    if (!line1.trim()) missing.push("Street address");
    if (!city.trim()) missing.push("City");
    if (!state.trim()) missing.push("State");
    if (!zip.trim()) missing.push("ZIP");
    if (!county.trim()) missing.push("County");

    if (missing.length) {
      alert(`Please fill: ${missing.join(", ")}`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`https://api.profixter.com/api/users/addresses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          label,
          line1,
          city,
          state,
          zip,
          county,
        }),
      });

      const text = await res.text();
      let data: ApiErrorBody = {};
      try {
        data = text ? (JSON.parse(text) as ApiErrorBody) : {};
      } catch {}

      if (!res.ok) {
        alert(data?.message || `Failed to add address. (${res.status})\n${text || ""}`);
        return;
      }


      await refreshUser();
      resetForm();
      setShowAdd(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg sm:text-xl font-semibold text-[#313234]">Addresses</h3>

        <button
          onClick={() => setShowAdd((v) => !v)}
          className="h-[44px] px-4 rounded-xl bg-[#306EEC] hover:bg-[#2558c9] text-white font-bold transition"
        >
          {showAdd ? "Close" : "Add address"}
        </button>
      </div>

      {/* Inline Add Form */}
      {showAdd && (
        <div className="bg-white border border-[#C5CBD8] rounded-[14px] p-4 sm:p-5 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#6A6D71] text-sm mb-2">Label</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#C5CBD8]"
                placeholder="Primary / Rental / Parent's house"
              />
            </div>

            <div>
              <label className="block text-[#6A6D71] text-sm mb-2">County</label>
              <input
                value={county}
                onChange={(e) => setCounty(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-[#C5CBD8]"
              />

            </div>

            <div className="sm:col-span-2">
              <label className="block text-[#6A6D71] text-sm mb-2">Street address</label>
              <input
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#C5CBD8]"
                placeholder="123 Main St"
              />
            </div>

            <div>
              <label className="block text-[#6A6D71] text-sm mb-2">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#C5CBD8]"
              />
            </div>

            <div>
              <label className="block text-[#6A6D71] text-sm mb-2">State</label>
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#C5CBD8]"
                placeholder="NY"
              />
            </div>

            <div>
              <label className="block text-[#6A6D71] text-sm mb-2">ZIP</label>
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[#C5CBD8]"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => {
                resetForm();
                setShowAdd(false);
              }}
              className="h-[44px] px-4 rounded-xl border border-[#C5CBD8] font-bold text-[#313234]"
            >
              Cancel
            </button>

            <button
              onClick={addAddress}
              disabled={saving}
              className="h-[44px] px-4 rounded-xl bg-[#306EEC] hover:bg-[#2558c9] text-white font-bold disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save address"}
            </button>
          </div>

          <p className="text-xs text-[#6A6D71] italic mt-3">
            Addresses cannot be edited. If you need changes, delete and add a new one.
          </p>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {addresses.map((a) => {
          const isDefault = String(a._id) === String(defaultAddressId);

          return (
            <div
              key={a._id}
              className="bg-[#EEF2FF] border border-[#C5CBD8] rounded-[14px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[#313234] font-semibold">{a.label || "Address"}</p>

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

              <div className="flex flex-col gap-2 sm:flex-row">
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
                  onClick={() => removeAddress(a._id, isDefault)}
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
            No addresses yet. Tap Add address.
          </div>
        )}
      </div>
    </div>
  );
}
