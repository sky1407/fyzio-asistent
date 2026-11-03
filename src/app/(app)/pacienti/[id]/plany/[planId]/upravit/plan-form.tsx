"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Markdown } from "@/components/markdown";
import { PLAN_CONTENT_MAX, PLAN_TITLE_MAX } from "@/lib/plans/model";
import type { PlanFormState } from "../../../../plan-actions";

type Props = {
  action: (state: PlanFormState, formData: FormData) => Promise<PlanFormState>;
  title: string;
  content: string;
  cancelHref: string;
};

export function PlanForm({ action, title, content, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [draft, setDraft] = useState(content);
  const [preview, setPreview] = useState(false);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {state?.message && (
        <p role="status" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {state.message}
        </p>
      )}

      <div className="card space-y-1.5">
        <label htmlFor="title" className="block text-sm font-medium text-slate-700">
          Názov plánu
        </label>
        <input
          id="title"
          name="title"
          defaultValue={state?.values.title ?? title}
          maxLength={PLAN_TITLE_MAX}
          aria-invalid={state?.errors?.title ? true : undefined}
          className="field-input"
        />
        {state?.errors?.title && <p className="text-sm text-red-700">{state.errors.title}</p>}
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-700">Obsah plánu</span>
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm">
            {[
              { value: false, label: "Upraviť" },
              { value: true, label: "Náhľad" },
            ].map((tab) => (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={preview === tab.value}
                onClick={() => setPreview(tab.value)}
                className={`rounded-md px-3 py-1 font-medium ${preview === tab.value ? "bg-white text-teal-800 shadow-sm" : "text-slate-600"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <textarea
          name="content"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={22}
          maxLength={PLAN_CONTENT_MAX}
          aria-label="Obsah plánu"
          aria-invalid={state?.errors?.content ? true : undefined}
          className={`field-input font-mono text-sm leading-relaxed ${preview ? "hidden" : ""}`}
        />
        {preview && (
          <div className="min-h-64 rounded-xl border border-slate-200 p-4">
            <Markdown text={draft} />
          </div>
        )}
        {state?.errors?.content && <p className="text-sm text-red-700">{state.errors.content}</p>}
        <p className="text-xs text-slate-500">
          Formátovanie: <code>## Nadpis</code>, <code>- odrážka</code>, <code>1. číslovaný bod</code>,{" "}
          <code>**tučné**</code>. Výsledok uvidíte v záložke Náhľad.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="btn-secondary">
          Zrušiť
        </Link>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Ukladám…" : "Uložiť plán"}
        </button>
      </div>
    </form>
  );
}
