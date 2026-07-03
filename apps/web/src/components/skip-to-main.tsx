/** Visually hidden until focused — lets keyboard users bypass repetitive nav. */
export function SkipToMain() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-[rgb(var(--sr-card))] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-[rgb(var(--sr-fg))] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--sr-coral))]"
    >
      Skip to main content
    </a>
  );
}
