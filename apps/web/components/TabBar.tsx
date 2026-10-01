"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";
import { t } from "@/lib/i18n/en";

const TABS = [
  { href: "/", label: t.tabs.vault, match: (p: string) => p === "/" || p.startsWith("/add") },
  {
    href: "/simulate",
    label: t.tabs.simulate,
    match: (p: string) => p.startsWith("/simulate") || p.startsWith("/plan"),
  },
  { href: "/insurers", label: t.tabs.insurers, match: (p: string) => p.startsWith("/insurers") },
  { href: "/you", label: t.tabs.you, match: (p: string) => p.startsWith("/you") },
];

/** Bottom tab bar on mobile; a top row inside the column from 720px. Text-only labels. */
export function TabBar() {
  const path = usePathname() ?? "/";
  return (
    <nav
      aria-label={t.tabs.label}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-edge bg-ink pb-[env(safe-area-inset-bottom)] md:static md:border-t-0 md:border-b md:pb-0"
    >
      <ul className="mx-auto flex max-w-[var(--column)] md:px-4">
        {TABS.map((tab) => {
          const active = tab.match(path);
          return (
            <li key={tab.href} className="flex-1 md:flex-none">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative flex h-16 items-center justify-center px-4 text-14 font-medium no-underline md:h-12 md:justify-start md:pl-0 md:pr-6",
                  active ? "text-mint" : "text-ash",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 top-0 h-0.5 bg-mint md:inset-x-0 md:top-auto md:right-6 md:bottom-0"
                  />
                )}
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
