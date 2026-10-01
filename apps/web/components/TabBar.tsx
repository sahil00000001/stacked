"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { t } from "@/lib/i18n/en";

/* 24px line icons, 1.75 stroke, drawn in currentColor */
const Icon = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {children}
  </svg>
);
const ICONS = {
  vault: (
    <Icon>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
      <path d="M7 14h4" />
    </Icon>
  ),
  simulate: (
    <Icon>
      <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
    </Icon>
  ),
  insurers: (
    <Icon>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  ),
  you: (
    <Icon>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c1.2-3.5 3.8-5.2 7-5.2s5.8 1.7 7 5.2" />
    </Icon>
  ),
};

const TABS = [
  {
    href: "/",
    label: t.tabs.vault,
    icon: ICONS.vault,
    match: (p: string) => p === "/" || p.startsWith("/add") || p.startsWith("/welcome"),
  },
  {
    href: "/simulate",
    label: t.tabs.simulate,
    icon: ICONS.simulate,
    match: (p: string) => p.startsWith("/simulate") || p.startsWith("/plan"),
  },
  { href: "/insurers", label: t.tabs.insurers, icon: ICONS.insurers, match: (p: string) => p.startsWith("/insurers") },
  { href: "/you", label: t.tabs.you, icon: ICONS.you, match: (p: string) => p.startsWith("/you") },
];

/**
 * Bottom tab bar on phones (icon over label, fixed, safe-area aware); a top
 * navigation row inside the column from 768px.
 */
export function TabBar() {
  const path = usePathname() ?? "/";
  return (
    <nav
      aria-label={t.tabs.label}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-edge bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:static md:border-t-0 md:border-b md:bg-ink md:pb-0 md:backdrop-blur-none"
    >
      <ul className="mx-auto grid max-w-[var(--column)] grid-cols-4 md:flex md:gap-2 md:px-4">
        {TABS.map((tab) => {
          const active = tab.match(path);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-12 font-medium no-underline transition-colors md:h-12 md:flex-row md:gap-2 md:px-3 md:text-14",
                  active ? "text-mint" : "text-ash hover:text-bone",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-mint md:inset-x-2 md:top-auto md:bottom-0 md:rounded-t md:rounded-b-none"
                  />
                )}
                {tab.icon}
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
