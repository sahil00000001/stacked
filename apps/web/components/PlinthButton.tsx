import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { cx } from "@/lib/cx";

interface Common {
  variant?: "primary" | "secondary";
  size?: "md" | "lg";
}

const classes = ({ variant = "primary", size = "md" }: Common, extra?: string) =>
  cx("plinth", `plinth-${variant}`, size === "lg" && "plinth-lg", extra);

/** Flat face on a hard offset plinth; depresses on press (components.md §1). */
export function PlinthButton({
  variant,
  size,
  busy,
  busyLabel,
  className,
  children,
  type = "button",
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; busyLabel?: string }) {
  return (
    <button type={type} className={classes({ variant, size }, className)} aria-busy={busy || undefined} {...rest}>
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

/** A link that navigates, styled as a PlinthButton. */
export function PlinthLink({ variant, size, className, ...rest }: Common & ComponentProps<typeof Link>) {
  return <Link className={classes({ variant, size }, className)} {...rest} />;
}
