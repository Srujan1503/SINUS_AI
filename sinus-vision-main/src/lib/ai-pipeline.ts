// Deterministic, realistic-looking AI pipeline output.
// Structure mirrors a real SwinUNETR + SegResNet + ViT pipeline so swapping
// in a remote inference endpoint later is a single function replacement.

import type { Severity } from "./severity";

export interface RegionVolumes {
  left_nasal_cavity: number;
  right_nasal_cavity: number;
  nasopharynx: number;
  left_maxillary_sinus: number;
  right_maxillary_sinus: number;
}

export interface AnalysisResult {
  segmentation: {
    dice_score: number;
    hd95: number;
    region_volumes: RegionVolumes; // cm^3
  };
  features: {
    sinus_volume_total: number;
    opacity_percentage: number;
    shape_irregularity: number;
    spatial_spread: number;
  };
  prediction: {
    severity: Severity;
    confidence: number;
    infection_volume: number;
    opacity_score: number;
    affected_regions: string[];
  };
}

// Deterministic PRNG from a string (so each scan id always returns the same numbers)
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REGION_LABELS: Record<keyof RegionVolumes, string> = {
  left_nasal_cavity: "Left Nasal Cavity",
  right_nasal_cavity: "Right Nasal Cavity",
  nasopharynx: "Nasopharynx",
  left_maxillary_sinus: "Left Maxillary Sinus",
  right_maxillary_sinus: "Right Maxillary Sinus",
};

export function runAnalysis(scanId: string): AnalysisResult {
  const rnd = mulberry32(hashSeed(scanId));
  const r = () => rnd();

  const opacity = r(); // 0..1 drives severity
  let severity: Severity;
  if (opacity < 0.28) severity = "Normal";
  else if (opacity < 0.55) severity = "Mild";
  else if (opacity < 0.8) severity = "Moderate";
  else severity = "Severe";

  const region_volumes: RegionVolumes = {
    left_nasal_cavity: +(8 + r() * 4).toFixed(2),
    right_nasal_cavity: +(8 + r() * 4).toFixed(2),
    nasopharynx: +(12 + r() * 5).toFixed(2),
    left_maxillary_sinus: +(14 + r() * 6).toFixed(2),
    right_maxillary_sinus: +(14 + r() * 6).toFixed(2),
  };
  const sinus_volume_total = +Object.values(region_volumes).reduce((a, b) => a + b, 0).toFixed(2);

  // Affected regions: weighted by opacity
  const affected: string[] = [];
  (Object.keys(region_volumes) as (keyof RegionVolumes)[]).forEach((k) => {
    if (r() < opacity * 0.85) affected.push(REGION_LABELS[k]);
  });
  if (severity !== "Normal" && affected.length === 0) {
    affected.push(REGION_LABELS.left_maxillary_sinus);
  }

  const infection_volume = +(sinus_volume_total * opacity * (0.3 + r() * 0.2)).toFixed(2);

  return {
    segmentation: {
      dice_score: +(0.93 + r() * 0.05).toFixed(4),
      hd95: +(2.5 + r() * 3).toFixed(2),
      region_volumes,
    },
    features: {
      sinus_volume_total,
      opacity_percentage: +(opacity * 100).toFixed(2),
      shape_irregularity: +(r() * 0.4 + 0.1).toFixed(3),
      spatial_spread: +(r() * 0.6 + 0.2).toFixed(3),
    },
    prediction: {
      severity,
      confidence: +(0.78 + r() * 0.2).toFixed(4),
      infection_volume,
      opacity_score: +opacity.toFixed(4),
      affected_regions: affected,
    },
  };
}
