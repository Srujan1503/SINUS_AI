import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, User2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/patients")({
  head: () => ({ meta: [{ title: "Patients · SinusAI" }] }),
  component: Patients,
});

function Patients() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data: patients = [] } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, patient_code, full_name, age, gender, notes, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (vals: { patient_code: string; full_name: string; age: number | null; gender: string; notes: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("patients").insert({
        ...vals,
        created_by: u.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Patient created");
      qc.invalidateQueries({ queryKey: ["patients"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = patients.filter((p) =>
    !q || p.full_name.toLowerCase().includes(q.toLowerCase()) || p.patient_code.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name or code…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" /> New patient</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create patient</DialogTitle></DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                create.mutate({
                  patient_code: String(fd.get("patient_code") ?? ""),
                  full_name: String(fd.get("full_name") ?? ""),
                  age: fd.get("age") ? Number(fd.get("age")) : null,
                  gender: String(fd.get("gender") ?? ""),
                  notes: String(fd.get("notes") ?? ""),
                });
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Patient code</Label>
                  <Input name="patient_code" required placeholder="P-001" />
                </div>
                <div className="space-y-1.5">
                  <Label>Age</Label>
                  <Input name="age" type="number" min={0} max={130} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input name="full_name" required />
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select name="gender">
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input name="notes" placeholder="Optional clinical notes" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="grid place-items-center gap-3 p-12 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              <User2 className="h-6 w-6" />
            </div>
            <div className="font-medium">No patients yet</div>
            <div className="max-w-sm text-sm text-muted-foreground">
              Add a patient to associate uploaded CT scans with their record.
            </div>
            <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" /> New patient</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Patients ({filtered.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filtered.map((p) => (
                <Link
                  key={p.id}
                  to="/upload"
                  search={{ patient: p.id }}
                  className="flex items-center justify-between px-6 py-4 hover:bg-muted/40"
                >
                  <div>
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.patient_code} · {p.gender || "—"} · {p.age ?? "—"} yrs
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Added {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
