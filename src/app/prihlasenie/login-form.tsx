"use client";

import { useActionState, useState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const [visible, setVisible] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label htmlFor="password" className="text-sm font-medium text-slate-700">
        Heslo
      </label>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus
          className="w-full rounded-xl border border-slate-300 bg-white py-3 pr-24 pl-4 text-base outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30"
          aria-invalid={state ? true : undefined}
          aria-describedby={state ? "login-error" : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-controls="password"
          className="absolute inset-y-1.5 right-1.5 rounded-lg px-3 text-sm font-medium text-teal-800 hover:bg-teal-50"
        >
          {visible ? "Skryť" : "Zobraziť"}
        </button>
      </div>
      {state && (
        <p id="login-error" role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-teal-700 px-4 py-3 text-base font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
      >
        {pending ? "Prihlasujem…" : "Prihlásiť sa"}
      </button>
    </form>
  );
}
