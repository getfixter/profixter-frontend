"use client";

import type { AccountAddress, AccountFormData } from "./types";
import { AddressesPanel } from "./AddressesPanel";
import { SmsPreferences } from "./SmsPreferences";
import { EmailPreferences } from "./EmailPreferences";
import { useAuth } from "@/lib/useAuth";
import { formatPhoneInput } from "@/lib/auth2";
import { useContactCompletion } from "@/app/components/auth/ContactCompletion";
import { buttonClass } from "@/app/components/ui/Button";

interface PersonalInfoFormProps {
  formData: AccountFormData;
}

type Field = "name" | "email" | "phone";

/*
 * Contact details, homes, and the text and email choices, on one page.
 *
 * PROGRESSIVE, NOT RE-ASKED. Registration 2.0 opens an account with one
 * verified identifier, so a phone-only customer has no email here and a
 * Google customer may have no phone. A missing detail gets an "Add" button
 * that opens the same verified ContactCompletion sheet booking and checkout
 * use (a code to the new phone or email, mode "attach"), so nothing is ever
 * stored unverified and nothing already on the account is asked for again.
 * Changing a detail that is already there stays a call to the office, as it
 * always has.
 */
export function PersonalInfoForm({ formData }: PersonalInfoFormProps) {
  const addresses = (formData?.addresses || []) as AccountAddress[];
  const { user } = useAuth();
  const { ensureContact, contactSheet } = useContactCompletion();

  const rows: { field: Field; label: string; value: string; verified?: boolean }[] = [
    { field: "name", label: "Name", value: (formData?.name || "").trim() },
    {
      field: "email",
      label: "Email",
      value: (formData?.email || "").trim(),
      verified: user?.emailVerified === true,
    },
    {
      field: "phone",
      label: "Mobile",
      value: formData?.phone ? formatPhoneInput(String(formData.phone)) : "",
      verified: user?.phoneVerified === true,
    },
  ];

  return (
    <div className="acct-stack">
      <section className="acct-card" aria-labelledby="acct-contact">
        <h2 id="acct-contact" className="acct-card__title">
          Contact details
        </h2>
        <dl className="acct-fields">
          {rows.map((row) => (
            <div key={row.field} className="acct-field" data-acct-field={row.field}>
              <div className="min-w-0">
                <dt>{row.label}</dt>
                <dd className={row.value ? "" : "acct-field__empty"}>
                  {row.value || "Not added yet"}
                  {row.value && row.verified ? (
                    <span className="ui-tag ui-tag--accent ml-2 !min-h-[22px] align-[1px]">Verified</span>
                  ) : null}
                </dd>
              </div>
              {!row.value ? (
                <button
                  type="button"
                  onClick={() => void ensureContact({ fields: [row.field] })}
                  className={buttonClass({ variant: "secondary", size: "sm" })}
                >
                  Add {row.field === "phone" ? "mobile" : row.field}
                </button>
              ) : null}
            </div>
          ))}
        </dl>
        <p className="ui-small mt-2">
          Need to change your name, email, or phone? Call 631-599-1363 and we&apos;ll help.
        </p>
        {contactSheet}
      </section>

      <AddressesPanel
        addresses={addresses}
        defaultAddressId={formData?.defaultAddressId ? String(formData.defaultAddressId) : null}
      />

      {/*
        * Never inside a collapsed section, deliberately.
        *
        * These are the controls on the page a customer can actually change,
        * and they are consent decisions. Burying them behind a disclosure
        * toggle would make opting out harder than opting in, which is the
        * asymmetry these rules exist to prevent.
        */}
      <SmsPreferences />
      <EmailPreferences />
    </div>
  );
}
