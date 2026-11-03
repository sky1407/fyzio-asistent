"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card text-center">
      <h1 className="text-lg font-semibold">Niečo sa pokazilo</h1>
      <p className="mt-1 text-slate-600">Údaje sa nepodarilo načítať. Skontrolujte pripojenie a skúste to znova.</p>
      <button type="button" onClick={reset} className="btn-primary mt-4">
        Skúsiť znova
      </button>
    </div>
  );
}
