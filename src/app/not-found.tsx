import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card max-w-sm text-center">
        <h1 className="text-lg font-semibold">Stránka sa nenašla</h1>
        <p className="mt-1 text-slate-600">Pacient mohol byť vymazaný alebo je odkaz nesprávny.</p>
        <Link href="/" className="btn-primary mt-4">
          Späť na pacientov
        </Link>
      </div>
    </main>
  );
}
