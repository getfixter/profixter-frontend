"use client";

import { useParams } from "next/navigation";
import { CustomersBoard } from "@/app/components/admin/sections/CustomersBoard";
import { RequireSection } from "@/app/components/admin/shell/RequireSection";

/* /admin/customers/[id] opens that customer's detail over the list, which stays mounted. */
export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id?: string }>();
  const id = params?.id ? decodeURIComponent(String(params.id)) : undefined;
  return (
    <RequireSection id="customers">
      <CustomersBoard customerId={id} />
      {children}
    </RequireSection>
  );
}
