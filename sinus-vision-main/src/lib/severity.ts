export type Severity = "Normal" | "Mild" | "Moderate" | "Severe";

export const SEVERITY_COLORS: Record<Severity, string> = {
  Normal: "var(--color-severity-normal)",
  Mild: "var(--color-severity-mild)",
  Moderate: "var(--color-severity-moderate)",
  Severe: "var(--color-severity-severe)",
};

export const SEVERITY_BADGE_CLASS: Record<Severity, string> = {
  Normal: "severity-badge-normal",
  Mild: "severity-badge-mild",
  Moderate: "severity-badge-moderate",
  Severe: "severity-badge-severe",
};

export const SEVERITY_RECOMMENDATION: Record<Severity, string> = {
  Normal:
    "No radiographic evidence of sinusitis. Routine follow-up only; no antibiotic therapy indicated.",
  Mild:
    "Mucosal thickening consistent with mild sinusitis. Recommend symptomatic management (saline irrigation, decongestants) and clinical reassessment in 7–10 days.",
  Moderate:
    "Moderate sinusitis with significant opacification. Consider oral antibiotics, intranasal corticosteroids, and ENT consultation if symptoms persist beyond two weeks.",
  Severe:
    "Severe sinusitis with extensive opacification. Urgent ENT referral recommended; evaluate for endoscopic intervention and broad-spectrum antibiotic therapy.",
};
