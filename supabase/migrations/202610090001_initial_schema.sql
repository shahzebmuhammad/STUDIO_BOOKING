-- Studio operations initial schema for Supabase Postgres.
-- Apply only to a new Supabase project; review before applying to a database with existing data.

begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create type public.organization_role as enum ('owner', 'admin', 'reception', 'studio_manager', 'editor', 'finance', 'client');
create type public.booking_status as enum ('inquiry', 'quote_sent', 'pending_payment', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.payment_method as enum ('cash', 'card', 'bank_transfer');
create type public.payment_status as enum ('unpaid', 'partially_paid', 'paid', 'refunded');
create type public.equipment_status as enum ('available', 'in_use', 'maintenance', 'damaged');
create type public.membership_plan as enum ('starter', 'professional', 'enterprise');
create type public.episode_status as enum ('recorded', 'editing', 'review', 'approved', 'published');

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Dubai',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text,
  avatar_path text,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role not null default 'reception',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if length(trim(org_name)) < 2 or length(trim(org_name)) > 120 then
    raise exception 'Organization name must be between 2 and 120 characters';
  end if;

  insert into public.organizations (name) values (trim(org_name)) returning id into new_org_id;
  insert into public.organization_members (organization_id, user_id, role)
    values (new_org_id, current_user_id, 'owner');
  insert into public.studios (organization_id, name, capacity) values
    (new_org_id, 'Studio A', 1),
    (new_org_id, 'Studio B', 1);
  return new_org_id;
end;
$$;

revoke all on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;

create table public.studios (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  capacity integer not null default 1 check (capacity > 0),
  hourly_rate numeric(12,2) not null default 0 check (hourly_rate >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, name)
);

create table public.clients (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  company text not null default '',
  email text not null default '',
  phone text not null default '',
  emirate text,
  vat_number text,
  notes text,
  photo_path text,
  portal_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.equipment (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  studio_id uuid,
  name text not null,
  category text not null,
  serial_number text not null,
  status public.equipment_status not null default 'available',
  condition text,
  photo_path text,
  purchased_on date,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, serial_number),
  foreign key (organization_id, studio_id) references public.studios(organization_id, id)
);

create table public.bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  studio_id uuid not null,
  booking_number bigint generated always as identity,
  session_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'inquiry',
  package_name text,
  assigned_staff_id uuid references public.profiles(id) on delete set null,
  special_requests text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (organization_id, id),
  foreign key (organization_id, client_id) references public.clients(organization_id, id),
  foreign key (organization_id, studio_id) references public.studios(organization_id, id),
  exclude using gist (
    studio_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status not in ('cancelled', 'no_show'))
);

create table public.invoices (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  booking_id uuid,
  invoice_number text not null,
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null default 'AED',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, invoice_number),
  foreign key (organization_id, client_id) references public.clients(organization_id, id),
  foreign key (organization_id, booking_id) references public.bookings(organization_id, id)
);

create table public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null,
  client_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  method public.payment_method not null,
  status public.payment_status not null default 'unpaid',
  provider text,
  provider_reference text,
  payment_link text,
  receipt_path text,
  paid_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, invoice_id) references public.invoices(organization_id, id),
  foreign key (organization_id, client_id) references public.clients(organization_id, id)
);

create table public.memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  plan public.membership_plan not null,
  starts_on date not null,
  renews_on date not null,
  included_hours numeric(8,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (renews_on >= starts_on),
  unique (organization_id, id),
  foreign key (organization_id, client_id) references public.clients(organization_id, id)
);

create table public.episodes (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  booking_id uuid,
  name text not null,
  show_name text,
  recorded_at timestamptz,
  editor_id uuid references public.profiles(id) on delete set null,
  status public.episode_status not null default 'recorded',
  asset_paths jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, client_id) references public.clients(organization_id, id),
  foreign key (organization_id, booking_id) references public.bookings(organization_id, id)
);

create table public.tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  booking_id uuid,
  title text not null,
  category text not null default 'operations',
  assigned_to uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, booking_id) references public.bookings(organization_id, id)
);

create index bookings_org_starts_idx on public.bookings (organization_id, starts_at);
create index bookings_client_idx on public.bookings (organization_id, client_id, starts_at desc);
create index payments_client_idx on public.payments (organization_id, client_id, created_at desc);
create index equipment_org_status_idx on public.equipment (organization_id, status);
create index memberships_client_idx on public.memberships (organization_id, client_id, is_active);
create index episodes_client_idx on public.episodes (organization_id, client_id, created_at desc);
create index tasks_assignee_due_idx on public.tasks (organization_id, assigned_to, due_at);

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed public.organization_role[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.role = any(allowed)
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, public.organization_role[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.organization_role[]) to authenticated;

create or replace function public.record_payment(
  p_client_id uuid,
  p_invoice_number text,
  p_amount numeric,
  p_method public.payment_method,
  p_status public.payment_status,
  p_payment_link text default null,
  p_receipt_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_org_id uuid;
  new_invoice_id uuid;
  new_payment_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if length(trim(p_invoice_number)) < 2 or length(trim(p_invoice_number)) > 64 then raise exception 'Invalid invoice number'; end if;

  select m.organization_id into current_org_id
  from public.organization_members m
  where m.user_id = current_user_id
    and m.role = any(array['owner','admin','finance']::public.organization_role[])
  order by m.created_at asc limit 1;
  if current_org_id is null then raise exception 'Finance permission is required'; end if;

  insert into public.invoices (organization_id, client_id, invoice_number, amount)
  values (current_org_id, p_client_id, trim(p_invoice_number), p_amount)
  returning id into new_invoice_id;

  insert into public.payments (organization_id, invoice_id, client_id, amount, method, status, payment_link, receipt_path, paid_at, created_by)
  values (
    current_org_id, new_invoice_id, p_client_id, p_amount, p_method, p_status, p_payment_link, p_receipt_path,
    case when p_status = 'paid' then now() else null end, current_user_id
  ) returning id into new_payment_id;

  return jsonb_build_object('payment_id', new_payment_id, 'invoice_id', new_invoice_id, 'invoice_number', trim(p_invoice_number));
end;
$$;

revoke all on function public.record_payment(uuid, text, numeric, public.payment_method, public.payment_status, text, text) from public;
grant execute on function public.record_payment(uuid, text, numeric, public.payment_method, public.payment_status, text, text) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.studios enable row level security;
alter table public.clients enable row level security;
alter table public.equipment enable row level security;
alter table public.bookings enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.memberships enable row level security;
alter table public.episodes enable row level security;
alter table public.tasks enable row level security;

create policy "organization members can read their organization" on public.organizations
  for select to authenticated using (public.is_org_member(id));
create policy "organization owners and admins can update organization" on public.organizations
  for update to authenticated using (public.has_org_role(id, array['owner','admin']::public.organization_role[]))
  with check (public.has_org_role(id, array['owner','admin']::public.organization_role[]));

create policy "users can read their profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "users can update their profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "staff can read organization roster and clients see themselves" on public.organization_members for select to authenticated
  using (
    public.has_org_role(organization_id, array['owner','admin','reception','studio_manager','editor','finance']::public.organization_role[])
    or user_id = (select auth.uid())
  );
create policy "owners and admins manage organization roster" on public.organization_members
  for all to authenticated using (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy "staff read studios" on public.studios for select to authenticated using (public.has_org_role(organization_id, array['owner','admin','reception','studio_manager','editor','finance']::public.organization_role[]));
create policy "managers manage studios" on public.studios for all to authenticated using (public.has_org_role(organization_id, array['owner','admin','studio_manager']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','admin','studio_manager']::public.organization_role[]));

create policy "staff read clients and clients read their own profile" on public.clients for select to authenticated
  using (
    public.has_org_role(organization_id, array['owner','admin','reception','studio_manager','editor','finance']::public.organization_role[])
    or portal_user_id = (select auth.uid())
  );
create policy "front desk roles manage clients" on public.clients for all to authenticated using (public.has_org_role(organization_id, array['owner','admin','reception','finance']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','admin','reception','finance']::public.organization_role[]));

create policy "staff read equipment" on public.equipment for select to authenticated using (public.has_org_role(organization_id, array['owner','admin','reception','studio_manager','editor']::public.organization_role[]));
create policy "managers manage equipment" on public.equipment for all to authenticated using (public.has_org_role(organization_id, array['owner','admin','studio_manager']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','admin','studio_manager']::public.organization_role[]));

create policy "staff read bookings and clients read their own" on public.bookings for select to authenticated
  using (
    public.has_org_role(organization_id, array['owner','admin','reception','studio_manager','editor','finance']::public.organization_role[])
    or exists (
      select 1 from public.clients c
      where c.organization_id = bookings.organization_id
        and c.id = bookings.client_id
        and c.portal_user_id = (select auth.uid())
    )
  );
create policy "front desk manages bookings" on public.bookings for all to authenticated using (public.has_org_role(organization_id, array['owner','admin','reception','studio_manager']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','admin','reception','studio_manager']::public.organization_role[]));

create policy "finance roles and client owners read invoices" on public.invoices for select to authenticated using (
  public.has_org_role(organization_id, array['owner','admin','reception','finance']::public.organization_role[])
  or exists (select 1 from public.clients c where c.organization_id = invoices.organization_id and c.id = invoices.client_id and c.portal_user_id = (select auth.uid()))
);
create policy "finance roles manage invoices" on public.invoices for all to authenticated using (public.has_org_role(organization_id, array['owner','admin','finance']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','admin','finance']::public.organization_role[]));
create policy "finance roles and client owners read payments" on public.payments for select to authenticated using (
  public.has_org_role(organization_id, array['owner','admin','finance','reception']::public.organization_role[])
  or exists (select 1 from public.clients c where c.organization_id = payments.organization_id and c.id = payments.client_id and c.portal_user_id = (select auth.uid()))
);
create policy "finance roles manage payments" on public.payments for all to authenticated using (public.has_org_role(organization_id, array['owner','admin','finance']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','admin','finance']::public.organization_role[]));

create policy "staff and membership owners read memberships" on public.memberships for select to authenticated using (
  public.has_org_role(organization_id, array['owner','admin','reception','finance']::public.organization_role[])
  or exists (select 1 from public.clients c where c.organization_id = memberships.organization_id and c.id = memberships.client_id and c.portal_user_id = (select auth.uid()))
);
create policy "finance roles manage memberships" on public.memberships for all to authenticated using (public.has_org_role(organization_id, array['owner','admin','finance','reception']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','admin','finance','reception']::public.organization_role[]));
create policy "staff and episode clients read episodes" on public.episodes for select to authenticated using (
  public.has_org_role(organization_id, array['owner','admin','studio_manager','editor','reception']::public.organization_role[])
  or exists (select 1 from public.clients c where c.organization_id = episodes.organization_id and c.id = episodes.client_id and c.portal_user_id = (select auth.uid()))
);
create policy "production roles manage episodes" on public.episodes for all to authenticated using (public.has_org_role(organization_id, array['owner','admin','studio_manager','editor']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','admin','studio_manager','editor']::public.organization_role[]));
create policy "staff read tasks" on public.tasks for select to authenticated using (public.has_org_role(organization_id, array['owner','admin','studio_manager','reception','editor']::public.organization_role[]));
create policy "managers manage tasks" on public.tasks for all to authenticated using (public.has_org_role(organization_id, array['owner','admin','studio_manager','reception','editor']::public.organization_role[])) with check (public.has_org_role(organization_id, array['owner','admin','studio_manager','reception','editor']::public.organization_role[]));

-- Private object storage buckets. Create the buckets once in the Supabase dashboard or CLI.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('client-media', 'client-media', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('equipment-media', 'equipment-media', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('payment-receipts', 'payment-receipts', false, 8388608, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy "members read organization files" on storage.objects for select to authenticated
  using (
    bucket_id in ('client-media','equipment-media','payment-receipts')
    and (
      public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin','reception','studio_manager','editor','finance']::public.organization_role[])
      or (bucket_id = 'client-media' and exists (
        select 1 from public.clients c
        where c.organization_id = (storage.foldername(name))[1]::uuid
          and c.photo_path = storage.objects.name
          and c.portal_user_id = (select auth.uid())
      ))
      or (bucket_id = 'payment-receipts' and exists (
        select 1 from public.payments p join public.clients c on c.organization_id = p.organization_id and c.id = p.client_id
        where p.organization_id = (storage.foldername(name))[1]::uuid
          and p.receipt_path = storage.objects.name
          and c.portal_user_id = (select auth.uid())
      ))
    )
  );
create policy "authorized staff upload organization files" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('client-media','equipment-media','payment-receipts')
    and (
      (bucket_id = 'client-media' and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin','reception','finance']::public.organization_role[]))
      or (bucket_id = 'equipment-media' and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin','studio_manager']::public.organization_role[]))
      or (bucket_id = 'payment-receipts' and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin','finance']::public.organization_role[]))
    )
  );
create policy "authorized staff update organization files" on storage.objects for update to authenticated
  using (
    bucket_id in ('client-media','equipment-media','payment-receipts')
    and (
      (bucket_id = 'client-media' and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin','reception']::public.organization_role[]))
      or (bucket_id = 'equipment-media' and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin','studio_manager']::public.organization_role[]))
      or (bucket_id = 'payment-receipts' and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin','finance']::public.organization_role[]))
    )
  )
  with check (
    bucket_id in ('client-media','equipment-media','payment-receipts')
    and (
      (bucket_id = 'client-media' and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin','reception']::public.organization_role[]))
      or (bucket_id = 'equipment-media' and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin','studio_manager']::public.organization_role[]))
      or (bucket_id = 'payment-receipts' and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin','finance']::public.organization_role[]))
    )
  );
create policy "authorized staff delete organization files" on storage.objects for delete to authenticated
  using (
    bucket_id in ('client-media','equipment-media','payment-receipts')
    and (
      (bucket_id = 'client-media' and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin','reception']::public.organization_role[]))
      or (bucket_id = 'equipment-media' and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin','studio_manager']::public.organization_role[]))
      or (bucket_id = 'payment-receipts' and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin','finance']::public.organization_role[]))
    )
  );

commit;
