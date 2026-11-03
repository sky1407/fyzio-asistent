"use client";

import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-danger">
      {pending ? "Mažem…" : "Vymazať"}
    </button>
  );
}

export function ConfirmDeleteButton({ action, confirmMessage }: { action: () => Promise<void>; confirmMessage: string }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <SubmitButton />
    </form>
  );
}
