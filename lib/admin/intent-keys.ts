"use client";
/**
 * One idempotency key per intent (BE gap fix: document sends replay a stored
 * answer for a repeated key). The intent string names the document and what
 * is being sent (recipient, subject, message); a retry of the same intent
 * reuses its key, so a timeout-then-retry sends once, while a changed email
 * is a new intent with a new key. Call `done` after a success. The key always
 * travels in the JSON body: the API's CORS allow-list has no Idempotency-Key
 * header.
 */
import { useMemo, useRef } from "react";
import { newIdempotencyKey } from "@/lib/admin/projects";

export type IntentKeys = { key: (intent: string) => string; done: (intent: string) => void };

export function useIntentKeys(): IntentKeys {
  const keys = useRef(new Map<string, string>());
  return useMemo(
    () => ({
      key(intent: string) {
        let k = keys.current.get(intent);
        if (!k) {
          k = newIdempotencyKey();
          keys.current.set(intent, k);
        }
        return k;
      },
      done(intent: string) {
        keys.current.delete(intent);
      },
    }),
    []
  );
}
