import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { runAnalysis } from "@/lib/ai-pipeline";
import { SEVERITY_RECOMMENDATION } from "@/lib/severity";
import { toast } from "sonner";
import { Upload as UploadIcon, FileImage, Loader2 } from "lucide-react";

const search = z.object({ patient: z.string().optional() });

export const Route = createFileRoute("/_authenticated/upload")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Upload CT scan · SinusAI" }] }),
  component: UploadPage,
});

const ACCEPTED = [".png", ".jpg", ".jpeg", ".nii", ".nrrd"];

function UploadPage() {
  const navigate = useNavigate();
  const sp = Route.useSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string>(sp.patient ?? "");
  const [stage, setStage] = useState<string>("");

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-min"],
    queryFn: async () => {
      const { data } = await supabase.from("patients").select("id, full_name, patient_code").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  function onPick(f: File | null) {
    if (!f) return;
    const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
    if (!ACCEPTED.includes(ext)) return toast.error("Unsupported file type. Use PNG, JPG, NII or NRRD.");
    if (f.size > 50 * 1024 * 1024) return toast.error("File too large (max 50 MB).");
    setFile(f);
    if (ext === ".png" || ext === ".jpg" || ext === ".jpeg") {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  const analyze = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      if (!patientId) throw new Error("Please select a patient");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");

      setStage("Uploading scan…");
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("ct-scans").upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      setStage("Registering scan…");
      const { data: scan, error: scanErr } = await supabase
        .from("scans")
        .insert({
          patient_id: patientId,
          uploaded_by: u.user.id,
          file_path: path,
          file_name: file.name,
          file_type: file.type || ext,
          status: "processing",
        })
        .select()
        .single();
      if (scanErr) throw scanErr;

      // Run AI pipeline (simulated, deterministic per scan id)
      setStage("Preprocessing CT…");
      await wait(500);
      setStage("Running SwinUNETR + SegResNet segmentation…");
      await wait(900);
      setStage("Extracting features…");
      await wait(500);
      setStage("Vision Transformer severity prediction…");
      await wait(700);

      const result = runAnalysis(scan.id);

      const { error: segErr } = await supabase.from("segmentation_results").insert({
        scan_id: scan.id,
        dice_score: result.segmentation.dice_score,
        hd95: result.segmentation.hd95,
        region_volumes: result.segmentation.region_volumes as unknown as Record<string, number>,
      });
      if (segErr) throw segErr;

      const { error: predErr } = await supabase.from("predictions").insert({
        scan_id: scan.id,
        severity: result.prediction.severity,
        confidence: result.prediction.confidence,
        infection_volume: result.prediction.infection_volume,
        opacity_score: result.prediction.opacity_score,
        features: result.features as unknown as Record<string, number>,
        affected_regions: result.prediction.affected_regions,
        recommendation: SEVERITY_RECOMMENDATION[result.prediction.severity],
      });
      if (predErr) throw predErr;

      await supabase.from("scans").update({ status: "completed" }).eq("id", scan.id);
      return scan.id;
    },
    onSuccess: (scanId) => {
      toast.success("Analysis complete");
      navigate({ to: "/scans/$scanId", params: { scanId } });
    },
    onError: (e: any) => {
      setStage("");
      toast.error(e.message ?? "Upload failed");
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Upload CT scan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onPick(e.dataTransfer.files?.[0] ?? null); }}
            onClick={() => inputRef.current?.click()}
            className="grid cursor-pointer place-items-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center hover:bg-muted/50"
          >
            <input
              ref={inputRef}
              type="file"
              hidden
              accept=".png,.jpg,.jpeg,.nii,.nrrd"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
            <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              <UploadIcon className="h-5 w-5" />
            </div>
            <div className="font-medium">{file ? file.name : "Drop CT scan here or click to select"}</div>
            <div className="text-xs text-muted-foreground">PNG · JPG · NII · NRRD · up to 50 MB</div>
          </div>

          {preview && (
            <div className="overflow-hidden rounded-lg border border-border">
              <img src={preview} alt="CT preview" className="mx-auto max-h-72 object-contain" />
            </div>
          )}
          {file && !preview && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <FileImage className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">{file.name}</div>
                <div className="text-xs text-muted-foreground">Volumetric format — preview will render after analysis.</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Scan details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Patient</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger><SelectValue placeholder="Select a patient…" /></SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name} · {p.patient_code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {patients.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No patients yet. Create one from the Patients page first.
              </div>
            )}
          </div>

          <Button className="w-full" disabled={!file || !patientId || analyze.isPending} onClick={() => analyze.mutate()}>
            {analyze.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…</> : "Analyze scan"}
          </Button>

          {analyze.isPending && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div className="font-medium">{stage}</div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
