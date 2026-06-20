
-- ============ ROLES ============
create type public.app_role as enum ('admin', 'doctor');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  specialty text,
  hospital text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles select" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid());
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());

-- ============ PATIENTS ============
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  patient_code text not null,
  full_name text not null,
  age int,
  gender text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.patients to authenticated;
grant all on public.patients to service_role;
alter table public.patients enable row level security;
create policy "patients owner or admin select" on public.patients for select to authenticated using (created_by = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "patients insert" on public.patients for insert to authenticated with check (created_by = auth.uid());
create policy "patients owner update" on public.patients for update to authenticated using (created_by = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "patients owner delete" on public.patients for delete to authenticated using (created_by = auth.uid() or public.has_role(auth.uid(),'admin'));

-- ============ SCANS ============
create type public.scan_status as enum ('uploaded','processing','completed','failed');

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_type text,
  status scan_status not null default 'uploaded',
  upload_date timestamptz not null default now(),
  notes text
);
grant select, insert, update, delete on public.scans to authenticated;
grant all on public.scans to service_role;
alter table public.scans enable row level security;
create policy "scans owner select" on public.scans for select to authenticated using (uploaded_by = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "scans insert" on public.scans for insert to authenticated with check (uploaded_by = auth.uid());
create policy "scans owner update" on public.scans for update to authenticated using (uploaded_by = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "scans owner delete" on public.scans for delete to authenticated using (uploaded_by = auth.uid() or public.has_role(auth.uid(),'admin'));

-- ============ SEGMENTATION ============
create table public.segmentation_results (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  dice_score numeric(5,4),
  hd95 numeric(8,3),
  region_volumes jsonb,
  mask_url text,
  heatmap_url text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.segmentation_results to authenticated;
grant all on public.segmentation_results to service_role;
alter table public.segmentation_results enable row level security;
create policy "seg select via scan" on public.segmentation_results for select to authenticated using (
  exists(select 1 from public.scans s where s.id = scan_id and (s.uploaded_by = auth.uid() or public.has_role(auth.uid(),'admin')))
);
create policy "seg insert via scan" on public.segmentation_results for insert to authenticated with check (
  exists(select 1 from public.scans s where s.id = scan_id and s.uploaded_by = auth.uid())
);
create policy "seg update via scan" on public.segmentation_results for update to authenticated using (
  exists(select 1 from public.scans s where s.id = scan_id and (s.uploaded_by = auth.uid() or public.has_role(auth.uid(),'admin')))
);

-- ============ PREDICTIONS ============
create type public.severity_level as enum ('Normal','Mild','Moderate','Severe');

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  severity severity_level not null,
  confidence numeric(5,4) not null,
  infection_volume numeric(10,3),
  opacity_score numeric(5,4),
  features jsonb,
  affected_regions text[],
  recommendation text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.predictions to authenticated;
grant all on public.predictions to service_role;
alter table public.predictions enable row level security;
create policy "pred select via scan" on public.predictions for select to authenticated using (
  exists(select 1 from public.scans s where s.id = scan_id and (s.uploaded_by = auth.uid() or public.has_role(auth.uid(),'admin')))
);
create policy "pred insert via scan" on public.predictions for insert to authenticated with check (
  exists(select 1 from public.scans s where s.id = scan_id and s.uploaded_by = auth.uid())
);

-- ============ REPORTS ============
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  generated_by uuid not null references auth.users(id) on delete cascade,
  pdf_url text,
  summary text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create policy "reports select via scan" on public.reports for select to authenticated using (
  exists(select 1 from public.scans s where s.id = scan_id and (s.uploaded_by = auth.uid() or public.has_role(auth.uid(),'admin')))
);
create policy "reports insert" on public.reports for insert to authenticated with check (generated_by = auth.uid());

-- ============ TIMESTAMP TRIGGERS ============
create or replace function public.tg_set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.tg_set_updated_at();
create trigger trg_patients_updated before update on public.patients for each row execute function public.tg_set_updated_at();

-- ============ AUTO PROFILE + ROLE ============
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url');
  insert into public.user_roles (user_id, role) values (new.id, 'doctor');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ============ STORAGE POLICIES (ct-scans bucket) ============
create policy "ct-scans owner read" on storage.objects for select to authenticated using (
  bucket_id = 'ct-scans' and (auth.uid()::text = (storage.foldername(name))[1] or public.has_role(auth.uid(),'admin'))
);
create policy "ct-scans owner insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'ct-scans' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "ct-scans owner delete" on storage.objects for delete to authenticated using (
  bucket_id = 'ct-scans' and (auth.uid()::text = (storage.foldername(name))[1] or public.has_role(auth.uid(),'admin'))
);
