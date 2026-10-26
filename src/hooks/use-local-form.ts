"use client";

import { useState } from "react";

type CachedForm = { value: unknown; baseline: string; revision: number };
const drafts = new Map<string, CachedForm>();

export function hasUnsavedForms(mode: string): boolean {
  return [...drafts.keys()].some((key) => key.startsWith(mode + ":"));
}

export function discardUnsavedForms(mode: string) {
  for (const key of drafts.keys())
    if (key.startsWith(mode + ":")) drafts.delete(key);
}

export function unsavedText(mode: string): string {
  return JSON.stringify(
    [...drafts.entries()]
      .filter(([key]) => key.startsWith(mode + ":"))
      .map(([screen, form]) => ({ screen, fields: form.value })),
    null,
    2,
  );
}

export function useLocalForm<T>(key: string, initial: T, revision: number) {
  const [form, setForm] = useState(() => {
    const cached = drafts.get(key);
    return cached
      ? { ...cached, value: cached.value as T }
      : { value: initial, baseline: JSON.stringify(initial), revision };
  });
  const dirty = JSON.stringify(form.value) !== form.baseline;
  function update(value: T | ((previous: T) => T)) {
    setForm((previous) => {
      const next = {
        ...previous,
        value:
          typeof value === "function"
            ? (value as (previous: T) => T)(previous.value)
            : value,
      };
      if (JSON.stringify(next.value) === next.baseline) drafts.delete(key);
      else drafts.set(key, next);
      return next;
    });
  }
  function saved(value: T, nextRevision: number) {
    drafts.delete(key);
    setForm({ value, baseline: JSON.stringify(value), revision: nextRevision });
  }
  return { value: form.value, update, dirty, revision: form.revision, saved };
}
