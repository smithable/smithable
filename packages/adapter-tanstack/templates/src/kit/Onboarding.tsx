// Smithable app kit: the frame of a first-time setup in steps, with its progress.
// To change it, copy this file into src/custom/components/ and edit the copy.
import { cn } from "#/lib/utils";
import { w } from "./words";

export function OnboardingLayout({
  title,
  subtitle,
  step,
  count,
  stepTitle,
  stepText,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  /** The current step, from 0. */
  step: number;
  count: number;
  stepTitle: string;
  stepText?: string;
  /** E.g. a "Do this later" link. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main data-kit="onboarding" className="mx-auto max-w-3xl px-5 py-12 sm:py-20">
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
      <p className="mt-8 text-xs font-semibold label-text text-muted-foreground">
        {w.stepOf(step + 1, count)}
      </p>
      <div aria-hidden className="mt-2 flex gap-2">
        {Array.from({ length: count }, (_, i) => i).map((n) => (
          <span
            key={n}
            className={cn("h-1 flex-1 rounded-full", n <= step ? "bg-primary" : "bg-border")}
          />
        ))}
      </div>
      <h2 className="mt-8 text-xl font-semibold">{stepTitle}</h2>
      {stepText && <p className="mt-1 text-muted-foreground">{stepText}</p>}
      <div className="mt-4">{children}</div>
      {footer && <div className="mt-6">{footer}</div>}
    </main>
  );
}
