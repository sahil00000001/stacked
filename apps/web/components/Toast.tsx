"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});

/** One toast at a time, past tense, same verb as the action ("Claim plan saved"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMessage(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 4000);
  }, []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="no-print pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4"
        style={{ bottom: "calc(var(--tabbar-height) + var(--space-4) + env(safe-area-inset-bottom))" }}
      >
        {message && (
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="pointer-events-auto rounded-button border border-edge bg-slate px-4 py-3 text-16 font-medium text-bone"
            data-testid="toast"
          >
            {message}
          </button>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
