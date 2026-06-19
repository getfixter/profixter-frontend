"use client";

import type { User } from "@/lib/admin-service";

export default function MembersReadOnly({ users }: { users: User[] }) {
  return (
    <div className="grid gap-3">
      {users.map((user) => (
        <section key={user._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-bold text-slate-950">{user.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{user.email} · {user.phone || "No phone"}</p>
            </div>
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Read only</span>
          </div>
          <div className="mt-3 grid gap-2">
            {(user.addressesDetailed || []).map((address) => (
              <div key={address._id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                {address.line1}, {address.city}, {address.state} {address.zip}
                <strong className="ml-2 text-blue-700">{address.plan || "No active plan"}</strong>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
