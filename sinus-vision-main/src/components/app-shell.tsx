import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Brain, LayoutDashboard, Users, Upload, FileText, Shield, LogOut, Menu, X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, email, avatar_url, specialty, hospital")
        .eq("id", u.user.id)
        .maybeSingle();
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      return {
        id: u.user.id,
        email: u.user.email ?? p?.email ?? "",
        name: p?.full_name ?? u.user.email ?? "User",
        avatar_url: p?.avatar_url ?? null,
        isAdmin: (roles ?? []).some((r) => r.role === "admin"),
      };
    },
  });

  const nav = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/patients", icon: Users, label: "Patients" },
    { to: "/upload", icon: Upload, label: "New scan" },
    { to: "/reports", icon: FileText, label: "Reports" },
    ...(profile?.isAdmin ? [{ to: "/admin", icon: Shield, label: "Admin" }] : []),
  ];

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (profile?.name ?? "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Brain className="h-4 w-4" />
            </div>
            <span className="font-semibold">SinusAI</span>
          </Link>
          <button className="md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-1 px-3 py-2">
          {nav.map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-sm">
              <div className="truncate font-medium">{profile?.name}</div>
              <div className="truncate text-xs text-sidebar-foreground/60">
                {profile?.isAdmin ? "Administrator" : "Clinician"}
              </div>
            </div>
            <button onClick={signOut} className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-4 md:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
            <PageTitle pathname={pathname} />
          </div>
          <Button asChild size="sm">
            <Link to="/upload">+ New scan</Link>
          </Button>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

function PageTitle({ pathname }: { pathname: string }) {
  const map: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/patients": "Patients",
    "/upload": "Upload CT scan",
    "/reports": "Reports",
    "/admin": "Admin",
  };
  const title = Object.entries(map).find(([k]) => pathname.startsWith(k))?.[1] ?? "SinusAI";
  return <h1 className="text-lg font-semibold">{title}</h1>;
}
