import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Renders guide inline text: [label](href) links and **bold**, nothing else.
 *
 * Internal links use next/link; external ones open normally (same tab) with
 * rel="noopener" - a cited source is something to read, not to be sent away to.
 */
const TOKEN_SOURCE = String.raw`\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*`;

const LINK = "font-semibold text-[#306EEC] underline decoration-[#306EEC]/35 underline-offset-[3px] transition hover:decoration-[#306EEC]";

export default function GuideText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  /* A fresh regex per render: a shared /g regex carries lastIndex between calls. */
  const token = new RegExp(TOKEN_SOURCE, "g");
  while ((match = token.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    if (match[1]) {
      const href = match[2];
      out.push(
        href.startsWith("/") ? (
          <Link key={key++} href={href} className={LINK}>
            {match[1]}
          </Link>
        ) : (
          <a key={key++} href={href} className={LINK} rel="noopener">
            {match[1]}
          </a>
        )
      );
    } else {
      out.push(
        <strong key={key++} className="font-semibold text-[#0B1628]">
          {match[3]}
        </strong>
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** The same text with markup stripped, for descriptions and structured data. */
export function plainText(text: string): string {
  return text.replace(new RegExp(TOKEN_SOURCE, "g"), (_m, label, _href, bold) => label || bold || "");
}
