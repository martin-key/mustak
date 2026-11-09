import { initials } from "@/lib/format";

/**
 * Портрет на бръснар в рамка като огледало. Без снимка показва монограм.
 * photoUrl е само локален път (от /public), защото не зареждаме външни ресурси.
 */
export function BarberPortrait({
  name,
  photoUrl,
  className = "",
  size = "lg",
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
  size?: "sm" | "lg";
}) {
  return (
    <div
      className={`mirror relative overflow-hidden border border-gold/35 bg-gradient-to-b from-bottle-600 via-bottle-700 to-bottle-800 p-1.5 ${className}`}
    >
      <div className="mirror relative flex h-full w-full items-center justify-center overflow-hidden border border-gold/15 bg-[radial-gradient(ellipse_at_30%_20%,rgb(239_230_210/0.10),transparent_60%)]">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={`Снимка на ${name}`} className="h-full w-full object-cover" />
        ) : (
          <span
            className={`gilded font-display ${size === "lg" ? "text-6xl" : "text-xl"}`}
            role="img"
            aria-label={`${name}, снимката предстои`}
          >
            {initials(name)}
          </span>
        )}
      </div>
    </div>
  );
}
