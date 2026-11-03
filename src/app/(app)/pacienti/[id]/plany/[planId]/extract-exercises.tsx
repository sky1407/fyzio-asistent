"use client";

import Link from "next/link";
import { useState } from "react";
import {
  addExtractedExercises,
  extractExercisesFromPlan,
  type ExerciseCandidate,
} from "../../../../cviky/extract-actions";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "review"; candidates: ExerciseCandidate[]; selected: Set<number> }
  | { kind: "saving"; candidates: ExerciseCandidate[]; selected: Set<number> }
  | { kind: "done"; added: number };

export function ExtractExercises({ patientId, planId }: { patientId: string; planId: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  async function extract() {
    setError(null);
    setState({ kind: "loading" });
    try {
      const result = await extractExercisesFromPlan(patientId, planId);
      if (!result.ok) {
        setError(result.error);
        setState({ kind: "idle" });
        return;
      }
      const selected = new Set(result.candidates.flatMap((candidate, index) => (candidate.exists ? [] : [index])));
      setState({ kind: "review", candidates: result.candidates, selected });
    } catch {
      setError("Cviky sa nepodarilo vytiahnuť. Skúste to znova.");
      setState({ kind: "idle" });
    }
  }

  function toggle(index: number) {
    if (state.kind !== "review") return;
    const selected = new Set(state.selected);
    if (selected.has(index)) selected.delete(index);
    else selected.add(index);
    setState({ ...state, selected });
  }

  async function save() {
    if (state.kind !== "review") return;
    const chosen = state.candidates
      .filter((_, index) => state.selected.has(index))
      .map((candidate) => ({
        name: candidate.name,
        target: candidate.target,
        description: candidate.description,
        video_url: candidate.video_url,
      }));
    setError(null);
    setState({ ...state, kind: "saving" });
    try {
      const result = await addExtractedExercises(chosen);
      if (result.ok) {
        setState({ kind: "done", added: result.added });
      } else {
        setError(result.error);
        setState({ ...state, kind: "review" });
      }
    } catch {
      setError("Cviky sa nepodarilo uložiť. Skúste to znova.");
      setState({ ...state, kind: "review" });
    }
  }

  return (
    <section className="card mt-4 print:hidden" aria-labelledby="extract-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="extract-heading" className="font-semibold text-teal-800">
            Knižnica cvikov
          </h2>
          <p className="text-sm text-slate-600">AI nájde cviky v tomto pláne a vy vyberiete, ktoré si uložíte.</p>
        </div>
        {(state.kind === "idle" || state.kind === "loading") && (
          <button type="button" onClick={() => void extract()} disabled={state.kind === "loading"} className="btn-secondary">
            {state.kind === "loading" ? "Hľadám cviky…" : "Vytiahnuť cviky do knižnice"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {state.kind === "done" && (
        <p className="mt-3 text-sm text-teal-800">
          <span className="font-medium">
            ✓ Pridané do knižnice: {state.added} {state.added === 1 ? "cvik" : state.added >= 2 && state.added <= 4 ? "cviky" : "cvikov"}.
          </span>{" "}
          <Link href="/cviky" className="font-semibold underline">
            Otvoriť knižnicu
          </Link>
        </p>
      )}

      {(state.kind === "review" || state.kind === "saving") &&
        (state.candidates.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">V tomto pláne AI nenašla žiadne cviky.</p>
        ) : (
          <>
            <ul className="mt-4 divide-y divide-slate-100">
              {state.candidates.map((candidate, index) => (
                <li key={candidate.name}>
                  <label className={`flex gap-3 py-3 ${candidate.exists ? "opacity-60" : "cursor-pointer"}`}>
                    <input
                      type="checkbox"
                      checked={state.selected.has(index)}
                      disabled={candidate.exists || state.kind === "saving"}
                      onChange={() => toggle(index)}
                      className="mt-1 h-5 w-5 shrink-0 accent-teal-700"
                    />
                    <span className="min-w-0">
                      <span className="font-medium">{candidate.name}</span>
                      {candidate.exists && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">už v knižnici</span>
                      )}
                      {candidate.target && <span className="block text-sm text-teal-800">{candidate.target}</span>}
                      {candidate.description && <span className="block text-sm text-slate-600">{candidate.description}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={state.selected.size === 0 || state.kind === "saving"}
                className="btn-primary"
              >
                {state.kind === "saving" ? "Ukladám…" : `Uložiť vybrané (${state.selected.size})`}
              </button>
              <button
                type="button"
                onClick={() => setState({ kind: "idle" })}
                disabled={state.kind === "saving"}
                className="btn-secondary"
              >
                Zrušiť
              </button>
            </div>
          </>
        ))}
    </section>
  );
}
