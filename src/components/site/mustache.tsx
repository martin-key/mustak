/** Мустакът от табелата. Дясната половина е нарисувана, лявата е огледален образ. */
export function Mustache({ className = "", title }: { className?: string; title?: string }) {
  const half =
    "M60 13 C70 3 87 4 97 12 C102 16 107 15 109.5 10 C111 6.5 109 3.5 105.5 4.5 " +
    "C108 6.5 107.5 10 104.5 11.5 C99 19 91 24.5 80 24.5 C70.5 24.5 64 21 60 18.5 Z";
  return (
    <svg
      viewBox="0 0 120 30"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="currentColor"
    >
      <path d={half} />
      <path d={half} transform="translate(120 0) scale(-1 1)" />
    </svg>
  );
}
