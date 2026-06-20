import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityBadge } from "@/components/severity-badge";
import type { Severity } from "@/lib/severity";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports · SinusAI" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: rows = [] } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scans")
        .select("id, file_name, upload_date, status, patients(full_name, patient_code), predictions(severity, confidence), segmentation_results(dice_score)")
        .order("upload_date", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">All scans & reports</CardTitle></CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No scans uploaded yet. <Link to="/upload" className="text-primary underline">Upload your first scan</Link>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Patient</th>
                  <th className="px-6 py-3">File</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Severity</th>
                  <th className="px-6 py-3">Confidence</th>
                  <th className="px-6 py-3">Dice</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r: any) => {
                  const pred = r.predictions?.[0] ?? r.predictions;
                  const seg = r.segmentation_results?.[0] ?? r.segmentation_results;
                  return (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-6 py-3">
                        <div className="font-medium">{r.patients?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.patients?.patient_code}</div>
                      </td>
                      <td className="px-6 py-3"><div className="max-w-[200px] truncate">{r.file_name}</div></td>
                      <td className="px-6 py-3 text-muted-foreground">{new Date(r.upload_date).toLocaleDateString()}</td>
                      <td className="px-6 py-3">{pred?.severity ? <SeverityBadge severity={pred.severity as Severity} /> : "—"}</td>
                      <td className="px-6 py-3">{pred ? `${(Number(pred.confidence) * 100).toFixed(1)}%` : "—"}</td>
                      <td className="px-6 py-3">{seg ? Number(seg.dice_score).toFixed(3) : "—"}</td>
                      <td className="px-6 py-3 text-right">
                        <Link to="/scans/$scanId" params={{ scanId: r.id }} className="inline-flex items-center gap-1 text-primary hover:underline">
                          <FileText className="h-4 w-4" /> Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
