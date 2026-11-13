"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Sheet, useIsClient } from "./Sheet";

export type MenuItem = {
  label: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  href?: string;
  /** Opens in a new tab (external dashboards). */
  external?: boolean;
  tone?: "default" | "destructive";
  disabled?: boolean;
  /** Small text under the label. */
  hint?: ReactNode;
};

const WIDE = "(min-width: 1024px) and (min-height: 501px) and (hover: hover)";

/** True on a desktop with a mouse: menus become popovers there. */
export function useWideLayout(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(WIDE);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(WIDE).matches,
    () => false
  );
}

/**
 * A "More" menu (E.5): a bottom sheet with full-width rows on phones, a
 * popover under its button on a desktop. Escape or a tap outside closes it;
 * focus returns to the button. Destructive items go last.
 *
 *   const ref = useRef<HTMLButtonElement>(null);
 *   <IconButton ref={ref} label="More" icon={<EllipsisHorizontalIcon />} onClick={() => setOpen(true)} />
 *   <Menu open={open} onClose={() => setOpen(false)} anchorRef={ref} title="Job"
 *         items={[{ label: "Copy address", onSelect: copy }, { label: "Cancel job", tone: "destructive", onSelect: ask }]} />
 */
export function Menu({ open, onClose, items, title, anchorRef }: { open: boolean; onClose: () => void; items: MenuItem[]; title: ReactNode; anchorRef?: RefObject<HTMLElement | null> }) {
  const wide = useWideLayout();
  if (!open) return null;
  if (wide && anchorRef) return <Popover onClose={onClose} items={items} title={title} anchorRef={anchorRef} />;
  return (
    <Sheet open onClose={onClose} title={title} variant="dialog" bodyClassName="!p-2">
      <MenuList items={items} onClose={onClose} />
    </Sheet>
  );
}

function MenuList({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  return (
    <div role="menu" className="flex flex-col">
      {items.map((item, index) => {
        const content = (
          <>
            {item.icon}
            <span className="flex min-w-0 flex-col">
              <span>{item.label}</span>
              {item.hint && <span className="text-[12px] font-normal text-adm-text-3">{item.hint}</span>}
            </span>
          </>
        );
        if (item.href) {
          const props = {
            role: "menuitem",
            className: "adm-menu-item",
            "data-tone": item.tone,
            onClick: () => {
              item.onSelect?.();
              onClose();
            },
          };
          return item.external || /^(https?:|tel:|sms:|mailto:)/.test(item.href) ? (
            <a key={index} href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined} {...props}>
              {content}
            </a>
          ) : (
            <Link key={index} href={item.href} {...props}>
              {content}
            </Link>
          );
        }
        return (
          <button
            key={index}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className="adm-menu-item disabled:opacity-50"
            data-tone={item.tone}
            onClick={() => {
              onClose();
              item.onSelect?.();
            }}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

function Popover({ onClose, items, title, anchorRef }: { onClose: () => void; items: MenuItem[]; title: ReactNode; anchorRef: RefObject<HTMLElement | null> }) {
  const isClient = useIsClient();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- measured once from the anchor before paint
    if (rect) setPos({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
  }, [anchorRef]);

  useEffect(() => {
    const anchor = anchorRef.current;
    ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") || []);
        const i = nodes.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "ArrowDown" ? (i + 1) % nodes.length : (i - 1 + nodes.length) % nodes.length;
        nodes[next]?.focus();
        event.preventDefault();
      }
    };
    const onDown = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node) || anchor?.contains(event.target as Node)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
      if (anchor?.isConnected) anchor.focus({ preventScroll: true });
    };
  }, [anchorRef, onClose]);

  if (!isClient) return null;
  return createPortal(
    <div ref={ref} className="adm-popover" style={pos ? { top: pos.top, right: pos.right } : { visibility: "hidden" }} aria-label={typeof title === "string" ? title : undefined}>
      <MenuList items={items} onClose={onClose} />
    </div>,
    document.body
  );
}
