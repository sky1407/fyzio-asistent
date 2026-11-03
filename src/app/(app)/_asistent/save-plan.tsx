"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PLAN_TITLE_MAX } from "@/lib/plans/model";
import { savePlanFromChat } from "../pacienti/plan-actions";

type State = { kind: "idle" } | { kind: "editing" } | { kind: "saving" } | { kind: "saved"; planId: string };

export function SavePlan({ patientId, content, defaultTitle }: { patientId: string; content: string; defaultTitle: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [title, setTitle] = useState(defaultTitle);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setState({ kind: "saving" });
    try {
      const result = await savePlanFromChat(patientId, title, content);
      if (result.ok) {
        setState({ kind: "saved", planId: result.planId });
      } else {
        setError(result.error);
        setState({ kind: "editing" });
      }
    } catch {
      setError("Plán sa nepodarilo uložiť. Skúste to znova.");
      setState({ kind: "editing" });
    }
  }

  if (state.kind === "saved") {
    return (
      <p className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm text-teal-800">
        <span className="font-medium">✓ Uložené ako plán.</span>
        <Link href={`/pacienti/${patientId}/plany/${state.planId}`} className="font-semibold underline">
          Otvoriť plán
        </Link>
      </p>
    );
  }

  if (state.kind === "idle") {
    return (
      <div className="mt-3 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setState({ kind: "editing" })}
          className="rounded-full border border-teal-200 bg-white px-3 py-1.5 text-sm font-medium text-teal-800 hover:bg-teal-50"
        >
          Uložiť ako plán
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <label className="block text-sm font-medium text-slate-700">
        Názov plánu
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={PLAN_TITLE_MAX}
          required
          autoFocus
          className="field-input mt-1 py-2"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={state.kind === "saving" || !title.trim()} className="btn-primary px-3 py-1.5 text-sm">
          {state.kind === "saving" ? "Ukladám…" : "Uložiť"}
        </button>
        <button
          type="button"
          onClick={() => setState({ kind: "idle" })}
          disabled={state.kind === "saving"}
          className="btn-secondary px-3 py-1.5 text-sm"
        >
          Zrušiť
        </button>
      </div>
    </form>
  );
}
