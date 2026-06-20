import type { Severity } from "@/lib/severity";
import { SEVERITY_BADGE_CLASS } from "@/lib/severity";

export function SeverityBadge({ severity, className = "" }: { severity: Severity; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${SEVERITY_BADGE_CLASS[severity]} ${className}`}>
      {severity}
    </span>
  );
}
