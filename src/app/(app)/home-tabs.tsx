"use client";

import { useState, type ReactNode } from "react";

type Tab = "patients" | "assistant";

const TABS: { id: Tab; label: string }[] = [
  { id: "patients", label: "Pacienti" },
  { id: "assistant", label: "AI asistent" },
];

export function HomeTabs({
  patients,
  assistant,
  initialTab,
}: {
  patients: ReactNode;
  assistant: ReactNode;
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <>
      <div role="tablist" aria-label="Sekcie" className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1 lg:hidden">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              tab === id ? "bg-white text-teal-800 shadow-sm" : "text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section
          id="panel-patients"
          role="tabpanel"
          aria-labelledby="tab-patients"
          className={tab === "patients" ? "" : "hidden lg:block"}
        >
          {patients}
        </section>
        <section
          id="panel-assistant"
          role="tabpanel"
          aria-labelledby="tab-assistant"
          className={`h-[calc(100dvh-10rem)] min-h-[30rem] lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)] ${
            tab === "assistant" ? "" : "hidden lg:block"
          }`}
        >
          {assistant}
        </section>
      </div>
    </>
  );
}
