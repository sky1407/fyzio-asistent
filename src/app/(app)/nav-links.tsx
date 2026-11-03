"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Pacienti", matches: (path: string) => path === "/" || path.startsWith("/pacienti") },
  { href: "/cviky", label: "Cviky", matches: (path: string) => path.startsWith("/cviky") },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Hlavná navigácia" className="flex gap-1">
      {LINKS.map((link) => {
        const active = link.matches(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              active ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
