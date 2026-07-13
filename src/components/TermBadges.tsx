import { termColor, type Term } from "../data/courses";

type TermBadgesProps = {
  /** One entry per offering-row; each is a list of term ids that row covers. */
  offerings: string[][];
  termById: Map<string, Term>;
  className?: string;
  /** When false, badges stay on one line (for clipping / marquee). Default true. */
  wrap?: boolean;
};

/**
 * Renders a course's term(s) as colored badges. Terms within one offering are
 * separated by "+"; multiple offerings are separated by "/".
 */
function TermBadges({
  offerings,
  termById,
  className,
  wrap = true,
}: TermBadgesProps) {
  const valid = offerings.filter((o) => o.length > 0);
  if (valid.length === 0) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${
        wrap ? "flex-wrap" : "flex-nowrap"
      } ${className ?? ""}`}
    >
      {valid.map((offering, index) => (
        <span key={index} className="inline-flex items-center gap-1.5">
          {index > 0 && (
            <span className="text-xs font-semibold text-gray-400">/</span>
          )}
          {offering.map((termId, termIndex) => {
            const term = termById.get(termId);
            const { bg, fg } = termColor(term?.position ?? 0);
            return (
              <span key={termId} className="inline-flex items-center gap-1.5">
                {termIndex > 0 && (
                  <span className="text-xs font-semibold text-gray-400">+</span>
                )}
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
                  style={{ backgroundColor: bg, color: fg }}
                >
                  {term?.name ?? "Unknown term"}
                </span>
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

export default TermBadges;
