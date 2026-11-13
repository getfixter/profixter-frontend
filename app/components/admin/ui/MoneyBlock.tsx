import type { ReactNode } from "react";
import { cx } from "./Button";

/** $1,234.50 from integer cents (the project documents store cents). */
export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  const negative = cents < 0;
  const value = Math.abs(cents) / 100;
  const text = value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 });
  return negative ? `−${text}` : text;
}

/** $1,234.50 from dollars (bookings and plans store dollars). */
export function formatDollars(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  return formatCents(Math.round(amount * 100));
}

export type MoneyRow = {
  label: ReactNode;
  /** Integer cents (preferred). */
  cents?: number | null;
  /** Or dollars. */
  dollars?: number | null;
  /** Or text ("Included", "Waived"). */
  text?: ReactNode;
  tone?: "default" | "muted" | "success" | "problem";
  /** The total line: bold, with a rule above. */
  strong?: boolean;
  note?: ReactNode;
};

const TONE: Record<NonNullable<MoneyRow["tone"]>, string> = {
  default: "text-adm-ink",
  muted: "text-adm-text-3",
  success: "text-adm-ok",
  problem: "text-adm-problem",
};

/**
 * Clearly labelled money (F.2, Q-9): every amount on its own line with what
 * it is, right-aligned tabular figures, the total last. Refunds stay in
 * Stripe, so a footnote and a dashboard link go in `footer`.
 *
 *   <MoneyBlock rows={[
 *     { label: "Visit", dollars: 149 },
 *     { label: "Paid by card", dollars: -149, tone: "success" },
 *     { label: "Balance", dollars: 0, strong: true },
 *   ]} footer="Canceling does not refund. Refunds are made in Stripe." />
 */
export function MoneyBlock({ rows, title, footer, className }: { rows: MoneyRow[]; title?: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-adm-md border border-adm-line bg-adm-surface p-4", className)}>
      {title && <h3 className="mb-2 text-[15px] font-semibold text-adm-ink">{title}</h3>}
      <dl className="flex flex-col">
        {rows.map((row, index) => {
          const value = row.text ?? (row.cents !== undefined ? formatCents(row.cents) : formatDollars(row.dollars));
          return (
            <div key={index} className={cx("flex items-baseline justify-between gap-4 py-1.5", row.strong && "mt-1 border-t border-adm-line pt-2.5")}>
              <dt className={cx("text-[14px]", row.strong ? "font-semibold text-adm-ink" : "text-adm-text-2")}>
                {row.label}
                {row.note && <span className="block text-[12px] text-adm-text-3">{row.note}</span>}
              </dt>
              <dd className={cx("adm-num text-right text-[15px]", row.strong ? "font-semibold" : "font-medium", TONE[row.tone || "default"])}>{value}</dd>
            </div>
          );
        })}
      </dl>
      {footer && <div className="mt-2 border-t border-adm-line pt-2 text-[13px] text-adm-text-2">{footer}</div>}
    </div>
  );
}
