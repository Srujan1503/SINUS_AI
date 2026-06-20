import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SeverityBadge } from "@/components/severity-badge";
import { CTViewer } from "@/components/ct-viewer";
import { SEVERITY_RECOMMENDATION, type Severity } from "@/lib/severity";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { ArrowLeft, Download, Loader2, Trash2 } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/scans/$scanId")({
  head: () => ({ meta: [{ title: "Scan analysis · SinusAI" }] }),
  component: ScanDetail,
});

type RegionVols = Record<string, number>;
type Features = { sinus_volume_total: number; opacity_percentage: number; shape_irregularity: number; spatial_spread: number };

function ScanDetail() {
  const { scanId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showHeat, setShowHeat] = useState(true);
  const [showMask, setShowMask] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["scan", scanId],
    queryFn: async () => {
      const [scanR, segR, predR, repR] = await Promise.all([
        supabase.from("scans").select("*, patients(*)").eq("id", scanId).single(),
        supabase.from("segmentation_results").select("*").eq("scan_id", scanId).maybeSingle(),
        supabase.from("predictions").select("*").eq("scan_id", scanId).maybeSingle(),
        supabase.from("reports").select("*").eq("scan_id", scanId).maybeSingle(),
      ]);
      if (scanR.error) throw scanR.error;
      return { scan: scanR.data, seg: segR.data, pred: predR.data, report: repR.data };
    },
  });

  useEffect(() => {
    if (!data?.scan?.file_path) return;
    let active = true;
    supabase.storage.from("ct-scans").createSignedUrl(data.scan.file_path, 3600).then(({ data: s }) => {
      if (active && s?.signedUrl) setImageUrl(s.signedUrl);
    });
    return () => { active = false; };
  }, [data?.scan?.file_path]);

  const del = useMutation({
    mutationFn: async () => {
      if (data?.scan?.file_path) await supabase.storage.from("ct-scans").remove([data.scan.file_path]);
      const { error } = await supabase.from("scans").delete().eq("id", scanId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Scan deleted"); qc.invalidateQueries(); navigate({ to: "/dashboard" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const intensity = useMemo(() => Number(data?.pred?.opacity_score ?? 0.4), [data]);
  const regionVols = (data?.seg?.region_volumes ?? {}) as RegionVols;
  const regionData = Object.entries(regionVols).map(([k, v]) => ({
    region: k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
    volume: Number(v),
  }));
  const features = (data?.pred?.features ?? {}) as Features;
  const radarData = [
    { metric: "Opacity", value: Math.round((features.opacity_percentage ?? 0)) },
    { metric: "Spread", value: Math.round((features.spatial_spread ?? 0) * 100) },
    { metric: "Irregularity", value: Math.round((features.shape_irregularity ?? 0) * 100) },
    { metric: "Volume %", value: Math.round((Number(data?.pred?.infection_volume ?? 0) / (features.sinus_volume_total || 1)) * 100) },
    { metric: "Confidence", value: Math.round(Number(data?.pred?.confidence ?? 0) * 100) },
  ];

  function downloadPdf() {
    if (!data?.scan || !data.pred || !data.seg) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const M = 48;
    let y = M;
    doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("SinusAI — Clinical Report", M, y); y += 26;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`Generated ${new Date().toLocaleString()}`, M, y); y += 22;
    doc.setTextColor(20);

    // Patient
    section("Patient", [
      ["Name", data.scan.patients?.full_name ?? "—"],
      ["Code", data.scan.patients?.patient_code ?? "—"],
      ["Age / Gender", `${data.scan.patients?.age ?? "—"} / ${data.scan.patients?.gender ?? "—"}`],
      ["Scan ID", data.scan.id],
      ["Uploaded", new Date(data.scan.upload_date).toLocaleString()],
    ]);

    section("Prediction", [
      ["Severity", data.pred.severity],
      ["Confidence", `${(Number(data.pred.confidence) * 100).toFixed(1)}%`],
      ["Infection volume", `${Number(data.pred.infection_volume).toFixed(2)} cm³`],
      ["Opacity score", `${(Number(data.pred.opacity_score) * 100).toFixed(1)}%`],
      ["Affected regions", (data.pred.affected_regions ?? []).join(", ") || "None"],
    ]);

    section("Segmentation metrics", [
      ["Dice score", Number(data.seg.dice_score).toFixed(4)],
      ["HD95 (mm)", Number(data.seg.hd95).toFixed(2)],
    ]);

    section("Region volumes (cm³)", Object.entries(regionVols).map(([k, v]) => [
      k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()), Number(v).toFixed(2),
    ]));

    // Recommendation
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Recommendation", M, y); y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const rec = data.pred.recommendation ?? SEVERITY_RECOMMENDATION[data.pred.severity as Severity];
    const lines = doc.splitTextToSize(rec, 500);
    doc.text(lines, M, y); y += lines.length * 13 + 16;

    doc.setFontSize(8); doc.setTextColor(140);
    doc.text("SinusAI research prototype · Not for clinical use without independent radiologist review.", M, 800);
    doc.save(`SinusAI_${data.scan.patients?.patient_code ?? data.scan.id.slice(0, 6)}.pdf`);

    // log report
    const pred = data.pred;
    supabase.auth.getUser().then(async ({ data: u }) => {
      if (!u.user) return;
      await supabase.from("reports").insert({
        scan_id: data.scan.id,
        generated_by: u.user.id,
        summary: `${pred.severity} (${(Number(pred.confidence) * 100).toFixed(1)}%)`,
      });
      qc.invalidateQueries({ queryKey: ["reports"] });
    });
    toast.success("Report downloaded");

    function section(title: string, rows: [string, any][]) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(title, M, y); y += 14;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      rows.forEach(([k, v]) => {
        doc.setTextColor(120); doc.text(String(k), M, y);
        doc.setTextColor(20); doc.text(String(v), M + 140, y);
        y += 14;
      });
      y += 8;
    }
  }

  if (isLoading || !data?.scan) {
    return <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const severity = (data.pred?.severity ?? "Normal") as Severity;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => del.mutate()} disabled={del.isPending}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete
          </Button>
          <Button size="sm" onClick={downloadPdf} disabled={!data.pred}>
            <Download className="mr-1 h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Imaging</CardTitle>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Switch checked={showMask} onCheckedChange={setShowMask} id="mask" />
                <Label htmlFor="mask" className="text-xs">Segmentation</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={showHeat} onCheckedChange={setShowHeat} id="heat" />
                <Label htmlFor="heat" className="text-xs">Heatmap</Label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overlay">
              <TabsList>
                <TabsTrigger value="overlay">Overlay</TabsTrigger>
                <TabsTrigger value="original">Original</TabsTrigger>
                <TabsTrigger value="xai">Attention map</TabsTrigger>
              </TabsList>
              <TabsContent value="overlay">
                {imageUrl ? <CTViewer imageUrl={imageUrl} intensity={intensity} seed={scanId} showHeatmap={showHeat} showMask={showMask} /> : <Skeleton />}
              </TabsContent>
              <TabsContent value="original">
                {imageUrl ? <CTViewer imageUrl={imageUrl} intensity={0} seed={scanId} showHeatmap={false} showMask={false} /> : <Skeleton />}
              </TabsContent>
              <TabsContent value="xai">
                {imageUrl ? <CTViewer imageUrl={imageUrl} intensity={Math.max(intensity, 0.5)} seed={scanId + "xai"} showHeatmap showMask={false} /> : <Skeleton />}
                <p className="mt-3 text-xs text-muted-foreground">
                  Vision Transformer attention focused on{" "}
                  <span className="font-medium text-foreground">{(data.pred?.affected_regions ?? []).join(", ") || "no specific region"}</span>.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Prediction</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Severity</span>
              <SeverityBadge severity={severity} />
            </div>
            <Row label="Confidence" value={`${(Number(data.pred?.confidence ?? 0) * 100).toFixed(1)}%`} />
            <Row label="Opacity score" value={`${(Number(data.pred?.opacity_score ?? 0) * 100).toFixed(1)}%`} />
            <Row label="Infection volume" value={`${Number(data.pred?.infection_volume ?? 0).toFixed(2)} cm³`} />
            <Row label="Dice score" value={Number(data.seg?.dice_score ?? 0).toFixed(4)} />
            <Row label="HD95" value={`${Number(data.seg?.hd95 ?? 0).toFixed(2)} mm`} />
            <div>
              <div className="mb-1 text-sm text-muted-foreground">Affected regions</div>
              <div className="flex flex-wrap gap-1.5">
                {(data.pred?.affected_regions ?? []).length === 0
                  ? <span className="text-sm">None</span>
                  : (data.pred!.affected_regions as string[]).map((r) => (
                    <span key={r} className="rounded-full bg-muted px-2.5 py-1 text-xs">{r}</span>
                  ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Recommendation</div>
              {data.pred?.recommendation ?? SEVERITY_RECOMMENDATION[severity]}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Region volumes (cm³)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionData} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <YAxis dataKey="region" type="category" width={150} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Bar dataKey="volume" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Feature profile</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} stroke="var(--color-muted-foreground)" />
                  <Radar dataKey="value" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.35} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
function Skeleton() {
  return <div className="aspect-square w-full animate-pulse rounded-xl bg-muted" />;
}
