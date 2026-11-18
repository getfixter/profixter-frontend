# Booking funnel events (Clarity) and how to build the funnel

Added 2026-11-17 on branch `acquisition-audit`.

Clarity is loaded by the agency's GTM container (tag 4, project `u5lnatsuyv`); the
site never loads it and never changes its settings. `lib/clarity.ts` only names
four moments so recordings and a funnel can find them. **Counting stays with our
own funnel steps** (`lib/meta.ts` `trackStep` → the Admin Overview); Clarity is for
watching what happened in those sessions.

## Events

Clarity custom events carry a name only, so the visit type is part of the name.
Each session where one fires also gets the tag `booking_type = <type>`.

| Event name | Fires when | Fired from |
|---|---|---|
| `booking_started_free_visit` | first focus/tap in the Free Visit form | `booking4/FreeVisitForm.tsx` |
| `booking_started_handyman` | first focus/tap in Book a Handyman | `booking4/HandymanBooker.tsx` |
| `booking_started_full_day` | first focus/tap in the Full Day panel | `booking/FullDayVisitPanel.tsx` |
| `booking_details_completed_free_visit` | the review sheet opens (every required field valid) | FreeVisitForm |
| `booking_details_completed_handyman` | job, address, time and (guests) contact all valid, at "How to book" | HandymanBooker |
| `booking_details_completed_full_day` | every field valid and Pay pressed | FullDayVisitPanel |
| `booking_request_submitted_free_visit` | the server accepted the request (201) | FreeVisitForm |
| `booking_request_submitted_handyman` | the server booked a member visit, or opened the paid checkout | HandymanBooker |
| `booking_request_submitted_full_day` | the server booked an included day, or opened the paid checkout | FullDayVisitPanel |
| `booking_payment_confirmed_handyman` | the server reports the One-Time payment recorded (status page), or a membership's first visit booked | `book/confirmation/PaidVisitStatus.tsx`, HandymanBooker |
| `booking_payment_confirmed_full_day` | the server reports the Full Day payment recorded | PaidVisitStatus |

Rules the code keeps:

- **Success only after the server says so.** Nothing fires on a button press; "submitted"
  fires on the server's acceptance, "payment confirmed" on the server's status (never on
  Stripe's redirect alone).
- **No duplicates.** Each event fires at most once per page load; submitted and payment
  events also once per booking / Stripe session across reloads of the tab.
- **Nothing personal.** Only the fixed names above and `booking_type`. No names, phone
  numbers, emails, addresses, job descriptions, photos, payment links or tokens.
  Contact, address, note and account content is also masked in recordings
  (`data-clarity-mask`).
- Free Visit has no payment step.

## Build the funnel in Clarity

1. Clarity → project **u5lnatsuyv** → **Funnels** → **New funnel**.
2. Steps (for Book a Handyman, swap the suffix for the others):
   1. Custom event `booking_started_handyman`
   2. Custom event `booking_details_completed_handyman`
   3. Custom event `booking_request_submitted_handyman`
   4. Custom event `booking_payment_confirmed_handyman`
3. Filters for paid Meta mobile traffic: **Device = Mobile**, **Traffic → Source** `fb` / `ig` / `an`
   with **Medium** `paid` (or **Campaign** `52606450943827`), **User type = New**.
4. From any step, **View recordings** shows the sessions that stopped there.

Recordings filter: **Custom tags → booking_type** = `handyman` / `full_day` / `free_visit`.

## Our own counts (unchanged)

The Admin Overview funnel keeps counting with `/api/track/step`:
`booking_page_view`, `booker_started`, `slot_selected`, `request_submitted`, `request_failed`
(Free Visit form), once per browser per step per New York day.
