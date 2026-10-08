/**
 * The homeowner guide content model.
 *
 * Guides are data, not hand-built pages, for the same reason the service and
 * location pages are: one renderer gives every guide the same reading layout,
 * the same breadcrumb and Article markup, the same "updated" date and the same
 * way of citing sources, and a guide cannot forget any of them.
 *
 * Inline text supports exactly two kinds of markup, parsed by GuideText:
 *   [label](/href)  a link (internal or https://)
 *   **bold**        emphasis
 * Nothing else - no HTML, no Markdown headings inside a paragraph.
 */

export type GuideBlock =
  /** The direct answer, shown first in a highlighted box. Answer first, sell second. */
  | { t: "answer"; text: string }
  | { t: "p"; text: string }
  | { t: "h2"; text: string; id?: string }
  | { t: "h3"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | {
      t: "table";
      caption: string;
      head: string[];
      rows: string[][];
      note?: string;
    }
  | { t: "callout"; title?: string; text: string; tone?: "note" | "profixter" }
  | { t: "qa"; items: { q: string; a: string }[] }
  /** A printable checklist with tick boxes and blank lines for the reader's own items. */
  | {
      t: "checklist";
      title: string;
      intro?: string;
      groups: { name: string; items: string[] }[];
      blankLines?: number;
    }
  /** Interactive or data-driven pieces, rendered by name. */
  | {
      t: "component";
      name: "plan-table" | "offers" | "membership-calculator" | "town-proof" | "task-mix";
    };

export type GuideSource = { label: string; url: string };

export type Guide = {
  slug: string;
  /** The H1, phrased the way a homeowner would ask. */
  title: string;
  metaTitle: string;
  metaDescription: string;
  /** One line under the H1. */
  dek: string;
  /** Hub card copy. */
  summary: string;
  category: "small-jobs" | "cost" | "membership" | "homeownership" | "maintenance";
  /** YYYY-MM-DD. Shown on the page and used in Article markup and the sitemap. */
  published: string;
  updated: string;
  body: GuideBlock[];
  /** External facts cited in the body. Shown at the end of the guide. */
  sources?: GuideSource[];
  related: string[];
};
