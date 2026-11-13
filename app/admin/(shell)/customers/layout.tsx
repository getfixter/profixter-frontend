"use client";

import { useParams } from "next/navigation";
import { CustomersBoard } from "@/app/components/admin/sections/CustomersBoard";
import { CustomerProfile } from "@/app/components/admin/customers/CustomerProfile";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

/*
 * /admin/customers/[id] is the customer's profile page (a full page on a
 * phone, a wide page on desktop: audit G.2). The list stays mounted but
 * hidden underneath, so Back returns to the same rows and scroll position,
 * and the profile can open its own sheets without stacking dialogs.
 */
export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id?: string }>();
  const id = params?.id ? decodeURIComponent(String(params.id)) : undefined;
  return (
    <RequireSection id="customers">
      <CustomersBoard hidden={Boolean(id)} />
      {id && <CustomerProfile key={id} id={id} />}
      {children}
    </RequireSection>
  );
}
