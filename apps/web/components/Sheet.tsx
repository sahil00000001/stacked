"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { t } from "@/lib/i18n/en";

/**
 * Bottom sheet on mobile, right drawer from 720px. Built on <dialog> so focus
 * is trapped, Esc closes, and focus returns to the trigger.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="sheet-title"
      className="sheet grain m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto border-edge p-0 text-bone backdrop:bg-ink/70"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="sheet-title" className="text-20">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="min-h-11 px-2 text-14 font-medium text-mint underline">
            {t.common.close}
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
