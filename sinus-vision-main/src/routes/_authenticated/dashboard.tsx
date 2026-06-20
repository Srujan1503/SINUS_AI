import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from "recharts";
import { Activity, FileText, Layers, Users } from "lucide-react";
import { SEVERITY_COLORS, type Severity } from "@/lib/severity";
import { SeverityBadge } from "@/components/severity-badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · SinusAI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [patientsR, scansR, predsR, segsR] = await Promise.all([
        supabase.from("patients").select("id", { count: "exact", head: true }),
        supabase.from("scans").select("id, upload_date, status").order("upload_date", { ascending: false }),
        supabase.from("predictions").select("severity, confidence, created_at, scan_id").order("created_at", { ascending: false }),
        supabase.from("segmentation_results").select("dice_score, hd95"),
      ]);
      const scans = scansR.data ?? [];
      const preds = predsR.data ?? [];
      const segs = segsR.data ?? [];
      return {
        patients: patientsR.count ?? 0,
        scans,
        preds,
        segs,
        recent: preds.slice(0, 5),
      };
    },
  });

  const severities: Severity[] = ["Normal", "Mild", "Moderate", "Severe"];
  const sevCounts = severities.map((s) => ({
    name: s,
    value: (data?.preds ?? []).filter((p) => p.severity === s).length,
  }));

  // last 14 days scan count
  const today = new Date();
  const trend = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (13 - i));
    const day = d.toISOString().slice(0, 10);
    const count = (data?.scans ?? []).filter((s) => s.upload_date?.slice(0, 10) === day).length;
    return { day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), scans: count };
  });

  const avgDice = data?.segs?.length
    ? (data.segs.reduce((a, b) => a + Number(b.dice_score ?? 0), 0) / data.segs.length)
    : 0;
  const avgConf = data?.preds?.length
    ? (data.preds.reduce((a, b) => a + Number(b.confidence ?? 0), 0) / data.preds.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Users} label="Patients" value={data?.patients ?? 0} />
        <Kpi icon={Layers} label="Total scans" value={data?.scans?.length ?? 0} />
        <Kpi icon={Activity} label="Avg Dice" value={avgDice.toFixed(3)} />
        <Kpi icon={FileText} label="Avg confidence" value={(avgConf * 100).toFixed(1) + "%"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Scans — last 14 days</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="scans" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Severity distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sevCounts} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {sevCounts.map((s) => (
                      <Cell key={s.name} fill={SEVERITY_COLORS[s.name as Severity]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Severity by count</CardTitle></CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sevCounts}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {sevCounts.map((s) => <Cell key={s.name} fill={SEVERITY_COLORS[s.name as Severity]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent predictions</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> :
          (data?.recent?.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No scans yet. <Link to="/upload" className="text-primary underline">Upload your first CT scan</Link> to begin.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data!.recent.map((p) => (
                <Link key={p.scan_id} to="/scans/$scanId" params={{ scanId: p.scan_id }} className="flex items-center justify-between py-3 hover:opacity-80">
                  <div>
                    <div className="font-medium">Scan {p.scan_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{(Number(p.confidence) * 100).toFixed(1)}%</span>
                    <SeverityBadge severity={p.severity as Severity} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-6">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
