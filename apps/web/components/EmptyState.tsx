import type { ReactNode } from "react";

/** Title, one sentence, one action. No illustration. */
export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="grain flex flex-col items-start gap-3 rounded-card border border-edge p-6">
      <h2 className="text-20">{title}</h2>
      <p className="text-16 text-ash font-medium">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
