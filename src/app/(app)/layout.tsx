import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/prihlasenie/actions";
import { NavLinks } from "./nav-links";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link href="/" aria-label="Fyzio asistent – domov" className="flex items-center gap-2 text-lg font-semibold text-teal-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-sm font-bold text-white">
              F
            </span>
            <span className="hidden sm:inline">Fyzio asistent</span>
          </Link>
          <Suspense>
            <NavLinks />
          </Suspense>
          <form action={logout} className="ml-auto">
            <button type="submit" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Odhlásiť sa
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </>
  );
}
