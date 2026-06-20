import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ShieldAlert, Users, FileScan, Brain } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · SinusAI" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { navigate({ to: "/auth", replace: true }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      setAllowed(isAdmin);
      setChecking(false);
    });
  }, [navigate]);

  const { data } = useQuery({
    queryKey: ["admin-stats"],
    enabled: allowed,
    queryFn: async () => {
      const [users, patients, scans, preds, profiles] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("patients").select("id, full_name, patient_code, created_at"),
        supabase.from("scans").select("id, file_name, upload_date, status"),
        supabase.from("predictions").select("severity, scan_id, created_at"),
        supabase.from("profiles").select("id, full_name, email, specialty, hospital"),
      ]);
      return {
        users: users.data ?? [],
        patients: patients.data ?? [],
        scans: scans.data ?? [],
        preds: preds.data ?? [],
        profiles: profiles.data ?? [],
      };
    },
  });

  if (checking) return <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!allowed) return (
    <Card>
      <CardContent className="grid place-items-center gap-3 p-12 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" />
        <div className="font-medium">Admin access required</div>
        <div className="max-w-md text-sm text-muted-foreground">
          Your account does not have the <code>admin</code> role. Ask a workspace administrator to grant it from the database, or assign yourself via:
          <pre className="mt-3 rounded bg-muted p-3 text-left text-xs">insert into public.user_roles (user_id, role){"\n"}values (auth.uid(), 'admin');</pre>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Kpi icon={Users} label="Users" value={data?.profiles.length ?? 0} />
        <Kpi icon={Users} label="Patients" value={data?.patients.length ?? 0} />
        <Kpi icon={FileScan} label="Scans" value={data?.scans.length ?? 0} />
        <Kpi icon={Brain} label="Predictions" value={data?.preds.length ?? 0} />
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="scans">Scans</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <Card><CardContent className="p-0"><Table head={["Name", "Email", "Specialty", "Role"]}>
            {data?.profiles.map((p) => {
              const role = data.users.find((u) => u.user_id === p.id)?.role ?? "doctor";
              return (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-6 py-3 font-medium">{p.full_name ?? "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground">{p.email}</td>
                  <td className="px-6 py-3 text-muted-foreground">{p.specialty ?? "—"}</td>
                  <td className="px-6 py-3"><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{role}</span></td>
                </tr>
              );
            })}
          </Table></CardContent></Card>
        </TabsContent>
        <TabsContent value="scans">
          <Card><CardContent className="p-0"><Table head={["File", "Date", "Status"]}>
            {data?.scans.map((s) => (
              <tr key={s.id} className="hover:bg-muted/30">
                <td className="px-6 py-3 font-mono text-xs">{s.file_name}</td>
                <td className="px-6 py-3 text-muted-foreground">{new Date(s.upload_date).toLocaleString()}</td>
                <td className="px-6 py-3">{s.status}</td>
              </tr>
            ))}
          </Table></CardContent></Card>
        </TabsContent>
        <TabsContent value="models">
          <Card>
            <CardHeader><CardTitle className="text-base">AI Models</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Model name="SwinUNETR (segmentation)" version="1.2.0" status="active" />
              <Model name="SegResNet (segmentation ensemble)" version="0.9.4" status="active" />
              <Model name="Vision Transformer ViT-B/16 (severity)" version="2.1.0" status="active" />
              <Model name="Gradient Boosting Classifier" version="1.0.3" status="active" />
              <Model name="Gradient Boosting Regressor" version="1.0.3" status="active" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card><CardContent className="flex items-center justify-between pt-6">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </div>
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
    </CardContent></Card>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="px-6 py-3">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

function Model({ name, version, status }: { name: string; version: string; status: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">v{version}</div>
      </div>
      <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-600 dark:text-emerald-400">{status}</span>
    </div>
  );
}
