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
 *
 * SELF-SERVICE CHANGES (2026-11-03). A detail that is already there has a
 * compact "Edit" that opens the same sheet in change mode: a name is saved at
 * once; a new email or phone replaces the old one only after its code, and an
 * already-verified one first asks "Confirm it's you" (routes/authV2.js). The
 * customer stays signed in, and membership, gifts and visits are untouched.
 */
export function PersonalInfoForm({ formData }: PersonalInfoFormProps) {
  const addresses = (formData?.addresses || []) as AccountAddress[];
  const { user } = useAuth();
  const { ensureContact, editContact, contactSheet } = useContactCompletion();

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
              ) : (
                <button
                  type="button"
                  onClick={() => void editContact(row.field)}
                  className={buttonClass({ variant: "secondary", size: "sm" })}
                  aria-label={`Edit ${row.label.toLowerCase()}`}
                  data-acct-edit={row.field}
                >
                  Edit
                </button>
              )}
            </div>
          ))}
        </dl>
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
      {/* Remounted when the number changes: text consent belongs to the number, and the switches re-read it. */}
      <SmsPreferences key={String(user?.phone || "")} />
      <EmailPreferences />
    </div>
  );
}
