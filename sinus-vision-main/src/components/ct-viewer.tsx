import { useEffect, useRef } from "react";

interface Props {
  imageUrl: string;
  /** 0..1 intensity drives heatmap blob count & spread */
  intensity: number;
  /** seed for deterministic blobs */
  seed: string;
  showHeatmap?: boolean;
  showMask?: boolean;
}

function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function CTViewer({ imageUrl, intensity, seed, showHeatmap = true, showMask = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width = 512;
    const H = canvas.height = 512;
    ctx.clearRect(0, 0, W, H);
    if (!showHeatmap && !showMask) return;

    const r = rng(hashSeed(seed));
    const blobCount = Math.max(3, Math.round(3 + intensity * 8));

    if (showMask) {
      // colored segmentation mask regions (5 anatomical regions)
      const regions = [
        { x: 0.32, y: 0.55, rx: 0.10, ry: 0.07, color: "oklch(0.7 0.13 200 / 0.45)" }, // left nasal
        { x: 0.68, y: 0.55, rx: 0.10, ry: 0.07, color: "oklch(0.65 0.15 280 / 0.45)" }, // right nasal
        { x: 0.50, y: 0.70, rx: 0.09, ry: 0.06, color: "oklch(0.7 0.14 160 / 0.45)" }, // nasopharynx
        { x: 0.27, y: 0.62, rx: 0.13, ry: 0.10, color: "oklch(0.78 0.14 90 / 0.45)" },  // left max
        { x: 0.73, y: 0.62, rx: 0.13, ry: 0.10, color: "oklch(0.65 0.18 30 / 0.45)" },  // right max
      ];
      regions.forEach((reg) => {
        ctx.beginPath();
        ctx.ellipse(reg.x * W, reg.y * H, reg.rx * W, reg.ry * H, 0, 0, Math.PI * 2);
        ctx.fillStyle = reg.color;
        ctx.fill();
        ctx.strokeStyle = reg.color.replace("0.45", "0.9");
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    if (showHeatmap) {
      for (let i = 0; i < blobCount; i++) {
        const cx = (0.25 + r() * 0.5) * W;
        const cy = (0.45 + r() * 0.35) * H;
        const rad = (30 + r() * 60) * (0.5 + intensity);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        const hue = 25 + (1 - intensity) * 90; // red->yellow
        g.addColorStop(0, `oklch(0.7 0.22 ${hue} / ${0.5 + intensity * 0.4})`);
        g.addColorStop(1, `oklch(0.7 0.22 ${hue} / 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }, [seed, intensity, showHeatmap, showMask]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-[oklch(0.1_0.02_235)]">
      <img
        ref={imgRef}
        src={imageUrl}
        alt="CT scan"
        className="absolute inset-0 h-full w-full object-contain"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full mix-blend-screen" />
    </div>
  );
}
