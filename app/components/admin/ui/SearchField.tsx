"use client";

import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { forwardRef, useEffect, useImperativeHandle, useRef, type InputHTMLAttributes } from "react";
import { cx } from "./Button";

export type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "onSubmit"> & {
  value: string;
  onChange: (value: string) => void;
  /** Enter ("Search" on the keyboard): the keyboard closes so every result shows. */
  onSubmit?: (value: string) => void;
  /**
   * Search mode (audit E.3): true while the field has focus or holds text.
   * The screen hides its chips, stats and headings so results sit directly
   * under the field, above the keyboard.
   */
  onSearchModeChange?: (active: boolean) => void;
  /** Accessible name; also the placeholder unless one is given. */
  label: string;
};

/**
 * type="search", 44px, magnifier, always-present clear (x), enterKeyHint
 * "search", no autocorrect/capitalisation. Leaving search mode with an empty
 * query restores the scroll position the screen had before it.
 *
 *   const [q, setQ] = useState("");
 *   const [searching, setSearching] = useState(false);
 *   <SearchField label="Search customers" value={q} onChange={setQ} onSearchModeChange={setSearching} />
 *   {!searching && <FilterBar>...</FilterBar>}
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, onSubmit, onSearchModeChange, label, placeholder, className, onFocus, onBlur, ...rest },
  ref
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);
  const focused = useRef(false);
  const savedScroll = useRef<number | null>(null);
  const lastMode = useRef<boolean | null>(null);

  const report = (active: boolean) => {
    if (lastMode.current === active) return;
    lastMode.current = active;
    if (active) {
      if (savedScroll.current === null) savedScroll.current = window.scrollY;
    } else if (savedScroll.current !== null) {
      const y = savedScroll.current;
      savedScroll.current = null;
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
    onSearchModeChange?.(active);
  };

  // A query arriving from outside (a hand-off) puts the screen in search mode too.
  useEffect(() => {
    if (value && lastMode.current !== true) report(true);
    if (!value && !focused.current && lastMode.current) report(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report reads refs only; runs when the value changes
  }, [value]);

  return (
    <form
      role="search"
      className={cx("relative", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(value);
        inputRef.current?.blur();
      }}
    >
      <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-adm-text-3" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-label={label}
        placeholder={placeholder || label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => {
          focused.current = true;
          report(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          focused.current = false;
          if (!value) report(false);
          onBlur?.(event);
        }}
        className="adm-input adm-search"
        {...rest}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          className="adm-icon-btn absolute right-0 top-0"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
        >
          <XMarkIcon aria-hidden="true" />
        </button>
      ) : null}
    </form>
  );
});
