-- Fase 1. Ejecutar como postgres, en una base nueva o con esta migración pendiente.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.icon_catalog (
  id text primary key,
  label text not null
);
insert into public.icon_catalog (id, label) values
  ('food', 'Alimentos'), ('dairy', 'Lácteos'), ('produce', 'Frutas y verduras'),
  ('cleaning', 'Aseo'), ('pet', 'Mascotas'), ('paper', 'Papel higiénico'),
  ('hygiene', 'Higiene'), ('other', 'Otros');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create table public.household_members (
  household_id uuid not null references public.households(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('admin', 'integrante')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members(user_id, household_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  icon_id text not null default 'other' references public.icon_catalog(id),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (household_id, id)
);
create unique index categories_name_idx on public.categories(household_id, lower(btrim(name)));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  category_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text not null default '' check (char_length(description) <= 240),
  icon_id text not null default 'other' references public.icon_catalog(id),
  stock integer not null default 0 check (stock between 0 and 1000000),
  version bigint not null default 1 check (version > 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, category_id) references public.categories(household_id, id) on delete restrict
);
create index products_category_idx on public.products(household_id, category_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  product_id uuid not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  actor_name text not null,
  product_name text not null,
  operation_id uuid not null,
  kind text not null check (kind in ('initial', 'delta', 'set')),
  request_payload jsonb not null,
  previous_stock integer not null check (previous_stock between 0 and 1000000),
  new_stock integer not null check (new_stock between 0 and 1000000),
  delta integer generated always as (new_stock - previous_stock) stored,
  product_version bigint not null check (product_version > 0),
  created_at timestamptz not null default clock_timestamp(),
  foreign key (household_id, product_id) references public.products(household_id, id) on delete restrict,
  unique (actor_id, operation_id),
  unique (product_id, product_version)
);
create index stock_movements_household_date_idx on public.stock_movements(household_id, created_at desc, id);

-- La fase 2 implementará el flujo de invitaciones y sus operaciones de servidor.
create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  email text not null check (char_length(email) between 3 and 254),
  invited_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index household_invitations_household_idx on public.household_invitations(household_id);

-- Helpers en un esquema no expuesto por PostgREST. Solo consultan la pertenencia
-- del usuario autenticado; el propietario evita recursión de RLS sobre integrantes.
create function private.is_member(p_household_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = (select auth.uid())
  );
$$;
create function private.is_admin(p_household_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = (select auth.uid()) and role = 'admin'
  );
$$;
create function private.can_view_profile(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id = (select auth.uid()) or exists (
    select 1 from public.household_members mine
    join public.household_members other on other.household_id = mine.household_id
    where mine.user_id = (select auth.uid()) and other.user_id = p_user_id
  );
$$;

alter table public.icon_catalog enable row level security;
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.household_invitations enable row level security;

create policy icons_read on public.icon_catalog for select to authenticated using (true);
create policy profiles_read on public.profiles for select to authenticated using (private.can_view_profile(id));
create policy households_read on public.households for select to authenticated using (private.is_member(id));
create policy members_read on public.household_members for select to authenticated using (private.is_member(household_id));
create policy categories_read on public.categories for select to authenticated using (private.is_member(household_id));
create policy categories_add on public.categories for insert to authenticated
  with check (private.is_member(household_id) and created_by = (select auth.uid()));
create policy products_read on public.products for select to authenticated using (private.is_member(household_id));
create policy movements_read on public.stock_movements for select to authenticated using (private.is_member(household_id));
create policy invitations_read on public.household_invitations for select to authenticated using (private.is_admin(household_id));

-- Limitar también los privilegios: no depender solamente de las políticas.
revoke all on public.icon_catalog, public.profiles, public.households, public.household_members,
  public.categories, public.products, public.stock_movements, public.household_invitations
  from public, anon, authenticated;
grant select on public.icon_catalog, public.profiles, public.households, public.household_members,
  public.categories, public.products, public.stock_movements, public.household_invitations to authenticated;
grant insert (household_id, name, icon_id) on public.categories to authenticated;

-- Alta de producto con movimiento inicial incluso para stock cero. El bloqueo
-- por actor/operación serializa reintentos antes de comprobar el historial.
create function public.create_product(
  p_household_id uuid, p_category_id uuid, p_name text, p_description text,
  p_icon_id text, p_initial_stock integer, p_operation_id uuid
) returns public.stock_movements
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_product public.products;
  v_movement public.stock_movements;
  v_request jsonb;
begin
  if v_actor is null or not private.is_member(p_household_id) then
    raise exception 'No tienes acceso a este hogar' using errcode = '42501';
  end if;
  if p_operation_id is null then
    raise exception 'Falta el identificador de operación' using errcode = '22023';
  end if;
  v_request := jsonb_build_object('household_id', p_household_id, 'category_id', p_category_id,
    'name', btrim(p_name), 'description', p_description, 'icon_id', p_icon_id, 'initial_stock', p_initial_stock);
  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || '/' || p_operation_id::text, 0));
  select * into v_movement from public.stock_movements
    where actor_id = v_actor and operation_id = p_operation_id;
  if found then
    if v_movement.kind <> 'initial' or v_movement.request_payload <> v_request then
      raise exception 'Identificador de operación reutilizado con otros datos' using errcode = '22023';
    end if;
    return v_movement;
  end if;
  insert into public.products (household_id, category_id, name, description, icon_id, stock, created_by)
    values (p_household_id, p_category_id, btrim(p_name), p_description, p_icon_id, p_initial_stock, v_actor)
    returning * into v_product;
  insert into public.stock_movements (household_id, product_id, actor_id, actor_name, product_name,
      operation_id, kind, request_payload, previous_stock, new_stock, product_version)
    values (p_household_id, v_product.id, v_actor,
      (select display_name from public.profiles where id = v_actor), v_product.name,
      p_operation_id, 'initial', v_request, 0, v_product.stock, v_product.version)
    returning * into v_movement;
  return v_movement;
end;
$$;

-- delta: botones +/-. set: casilla numérica, con versión obligatoria.
create function public.change_stock(
  p_product_id uuid, p_operation_id uuid, p_kind text, p_quantity integer,
  p_expected_version bigint default null
) returns public.stock_movements
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_product public.products;
  v_movement public.stock_movements;
  v_request jsonb;
  v_new_stock bigint;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesión' using errcode = '42501';
  end if;
  if p_operation_id is null or p_kind is null or p_kind not in ('delta', 'set') or p_quantity is null
      or (p_kind = 'delta' and (p_quantity = 0 or p_expected_version is not null))
      or (p_kind = 'set' and (p_expected_version is null or p_expected_version < 1)) then
    raise exception 'Parámetros de stock no válidos' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || '/' || p_operation_id::text, 0));
  select * into v_product from public.products where id = p_product_id for update;
  if not found or not private.is_member(v_product.household_id) then
    raise exception 'Producto no disponible en tu hogar' using errcode = '42501';
  end if;
  v_request := jsonb_build_object('product_id', p_product_id, 'quantity', p_quantity,
    'expected_version', p_expected_version);
  select * into v_movement from public.stock_movements
    where actor_id = v_actor and operation_id = p_operation_id;
  if found then
    if v_movement.kind <> p_kind or v_movement.request_payload <> v_request then
      raise exception 'Identificador de operación reutilizado con otros datos' using errcode = '22023';
    end if;
    return v_movement;
  end if;
  if p_kind = 'set' and v_product.version <> p_expected_version then
    raise exception 'El stock cambió; actualiza antes de confirmar' using errcode = '40001';
  end if;
  v_new_stock := case when p_kind = 'delta' then v_product.stock::bigint + p_quantity else p_quantity end;
  if v_new_stock < 0 or v_new_stock > 1000000 then
    raise exception 'El stock debe estar entre 0 y 1000000' using errcode = '23514';
  end if;
  update public.products set stock = v_new_stock::integer, version = version + 1, updated_at = clock_timestamp()
    where id = v_product.id;
  insert into public.stock_movements (household_id, product_id, actor_id, actor_name, product_name,
      operation_id, kind, request_payload, previous_stock, new_stock, product_version)
    values (v_product.household_id, v_product.id, v_actor,
      (select display_name from public.profiles where id = v_actor), v_product.name,
      p_operation_id, p_kind, v_request, v_product.stock, v_new_stock::integer, v_product.version + 1)
    returning * into v_movement;
  return v_movement;
end;
$$;

-- Solo uso administrativo desde SQL, nunca desde una sesión de la aplicación.
create function private.bootstrap_household(p_admin_user_id uuid, p_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_household_id uuid;
begin
  if not exists (select 1 from auth.users where id = p_admin_user_id) then
    raise exception 'Primero crea el usuario admin en Supabase Auth' using errcode = '23503';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('bootstrap/' || p_admin_user_id::text, 0));
  if exists (select 1 from public.household_members where user_id = p_admin_user_id) then
    raise exception 'Este usuario ya tiene un hogar; revisa el alta existente' using errcode = '22023';
  end if;
  insert into public.profiles(id, display_name) values (p_admin_user_id, btrim(p_display_name))
    on conflict (id) do nothing;
  insert into public.households(name) values (btrim(p_name)) returning id into v_household_id;
  insert into public.household_members(household_id, user_id, role) values (v_household_id, p_admin_user_id, 'admin');
  return v_household_id;
end;
$$;

-- Revocar los permisos automáticos de Supabase antes de conceder los necesarios.
revoke all on function private.is_member(uuid), private.is_admin(uuid), private.can_view_profile(uuid),
  private.bootstrap_household(uuid, text, text),
  public.create_product(uuid, uuid, text, text, text, integer, uuid),
  public.change_stock(uuid, uuid, text, integer, bigint) from public, anon, authenticated, service_role;
grant execute on function private.is_member(uuid), private.is_admin(uuid), private.can_view_profile(uuid) to authenticated;
grant execute on function public.create_product(uuid, uuid, text, text, text, integer, uuid),
  public.change_stock(uuid, uuid, text, integer, bigint) to authenticated;

-- El propietario de la migración conserva acceso para bootstrap/mantenimiento.
notify pgrst, 'reload schema';
commit;
