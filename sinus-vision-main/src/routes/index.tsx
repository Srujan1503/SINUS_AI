import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Brain, FileText, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SinusAI — Automated Sinusitis Severity Grading from CT" },
      {
        name: "description",
        content:
          "Vision Transformer–powered segmentation, severity prediction, and explainable visualizations for paranasal sinus CT scans.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Brain className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">SinusAI</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Button asChild>
              <Link to="/auth">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 md:pt-28">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              SwinUNETR · ViT · Gradient Boosting
            </div>
            <h1 className="text-balance text-4xl font-semibold leading-tight md:text-5xl">
              Automated sinusitis grading from paranasal CT,{" "}
              <span className="text-primary">in seconds.</span>
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base text-muted-foreground md:text-lg">
              Upload a CT scan and SinusAI segments the sinus regions, predicts severity
              (Normal · Mild · Moderate · Severe), localizes the affected anatomy, and
              produces a clinician-ready PDF report.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Launch console</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#workflow">See the workflow</a>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
              <Stat label="Dice score" value="0.96" />
              <Stat label="R² (severity)" value="0.93" />
              <Stat label="Accuracy" value="83%" />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-clinical)]">
            <SyntheticScanPreview />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/60 bg-card/40 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-semibold md:text-3xl">A complete clinical AI pipeline</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Every stage — preprocessing, segmentation, feature extraction, severity prediction,
            explainability and reporting — wired into one workflow.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Feature icon={Workflow} title="Multi-region segmentation"
              text="SwinUNETR + SegResNet ensemble segments left/right nasal cavities, nasopharynx, and maxillary sinuses." />
            <Feature icon={Brain} title="ViT severity grading"
              text="Vision Transformer + Gradient Boosting predicts Normal · Mild · Moderate · Severe with confidence." />
            <Feature icon={Activity} title="Explainable visualization"
              text="Attention heatmaps and region importance maps overlay the original CT for transparent decisions." />
            <Feature icon={FileText} title="Clinical PDF reports"
              text="One-click downloadable report including findings, volumes, recommendation and AI metrics." />
            <Feature icon={ShieldCheck} title="Role-based access"
              text="Doctors only see their own patients. Admins manage users, scans and analytics." />
            <Feature icon={Sparkles} title="Realtime dashboard"
              text="Track scan volume, severity distribution, segmentation Dice and model performance over time." />
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-semibold md:text-3xl">The end-to-end workflow</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              ["1", "Upload CT", "Drop .png / .jpg / .nii scans"],
              ["2", "Preprocess + Segment", "Normalize, patch, run SwinUNETR"],
              ["3", "Predict severity", "ViT + Gradient Boosting"],
              ["4", "Report", "PDF + dashboard analytics"],
            ].map(([n, t, d]) => (
              <li key={n} className="rounded-xl border border-border bg-card p-5">
                <div className="text-xs font-medium text-accent">STEP {n}</div>
                <div className="mt-2 font-semibold">{t}</div>
                <div className="mt-1 text-sm text-muted-foreground">{d}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} SinusAI · Research prototype — not for clinical use.
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      <div className="text-xs uppercase tracking-wider">{label}</div>
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 font-semibold">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{text}</div>
    </div>
  );
}

function SyntheticScanPreview() {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[oklch(0.18_0.03_235)]">
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="bone" cx="50%" cy="48%" r="48%">
            <stop offset="0%" stopColor="#f4f1e8" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#9aa39b" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0a0f14" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="heat" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.7 0.22 25)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="oklch(0.7 0.22 25)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="400" fill="#080d12" />
        <ellipse cx="200" cy="200" rx="160" ry="180" fill="url(#bone)" />
        <ellipse cx="200" cy="190" rx="110" ry="130" fill="#0a0f14" opacity="0.75" />
        <ellipse cx="140" cy="220" rx="40" ry="32" fill="#1a1f24" />
        <ellipse cx="260" cy="220" rx="40" ry="32" fill="#1a1f24" />
        <ellipse cx="200" cy="270" rx="28" ry="22" fill="#1a1f24" />
        {/* heatmap overlays */}
        <circle cx="142" cy="220" r="55" fill="url(#heat)" />
        <circle cx="262" cy="222" r="40" fill="url(#heat)" opacity="0.7" />
      </svg>
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-md bg-background/85 px-3 py-2 text-xs backdrop-blur">
        <span className="font-mono">CT · axial · 224×224</span>
        <span className="rounded-md px-2 py-0.5 severity-badge-moderate">Moderate · 0.87</span>
      </div>
    </div>
  );
}
