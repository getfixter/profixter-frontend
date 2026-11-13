"use client";

import { ExclamationCircleIcon } from "@heroicons/react/20/solid";
import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "./Button";

type FieldControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean;
};

export type FieldProps = {
  label: ReactNode;
  /** One line under the field: what to type, or an example. */
  help?: ReactNode;
  /** Shown under the field in red with an icon; marks the control invalid. */
  error?: ReactNode;
  required?: boolean;
  /** The control: TextInput, Select, Textarea or any input. It receives id and aria wiring. */
  children: ReactElement<FieldControlProps>;
  className?: string;
  /** For the keyboard rule: this whole block is the "line of context" kept on screen. */
  name?: string;
};

/**
 * A labelled field (J.5, E.4): visible label above (13/600), help or error
 * below (13px; error in red with an icon). The control gets its id,
 * aria-describedby and aria-invalid wired automatically.
 *
 *   <Field label="Customer name" error={errors.name}>
 *     <TextInput value={name} onChange={...} autoCapitalize="words" enterKeyHint="next" />
 *   </Field>
 */
export function Field({ label, help, error, required, children, className, name }: FieldProps) {
  const auto = useId();
  const id = children.props.id || `f${auto}`;
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [children.props["aria-describedby"], errorId, helpId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : children.props["aria-invalid"],
        "aria-required": required || undefined,
      })
    : children;
  return (
    <div className={cx("flex flex-col gap-1.5", className)} data-field={name || id}>
      <label htmlFor={id} className="text-[13px] font-semibold text-adm-ink">
        {label}
        {required && (
          <span className="text-adm-text-3" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {control}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-[13px] font-medium text-adm-problem" data-error="1">
          <ExclamationCircleIcon className="mt-px h-4 w-4 flex-none" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : help ? (
        <p id={helpId} className="text-[13px] text-adm-text-3">
          {help}
        </p>
      ) : null}
    </div>
  );
}

/** A 44px text input. Pass the mobile attributes that fit: type="tel" inputMode="tel", inputMode="decimal", enterKeyHint, autoCapitalize. */
export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, type = "text", ...rest }, ref) {
  return <input ref={ref} type={type} className={cx("adm-input", className)} {...rest} />;
});

export type SelectOption = { value: string; label: string; disabled?: boolean };

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { options?: SelectOption[] }>(function Select(
  { className, options, children, ...rest },
  ref
) {
  return (
    <select ref={ref} className={cx("adm-input", className)} {...rest}>
      {options
        ? options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))
        : children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cx("adm-input", className)} {...rest} />;
});
