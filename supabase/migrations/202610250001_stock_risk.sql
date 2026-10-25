begin;

alter table public.products
  add column risk_quantity integer not null default 0 check (risk_quantity between 0 and 1000000),
  add column risk_version bigint not null default 1 check (risk_version > 0);

-- Mantener create_product de siete argumentos para clientes anteriores y reintentos pendientes.
-- El nuevo RPC guarda umbral y producto atómicamente; el payload incluye el umbral.
create function public.create_product_with_risk(
  p_household_id uuid, p_category_id uuid, p_name text, p_description text,
  p_icon_id text, p_initial_stock integer, p_operation_id uuid, p_risk_quantity integer
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
    'name', btrim(p_name), 'description', p_description, 'icon_id', p_icon_id, 'initial_stock', p_initial_stock, 'risk_quantity', p_risk_quantity);
  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || '/' || p_operation_id::text, 0));
  select * into v_movement from public.stock_movements
    where actor_id = v_actor and operation_id = p_operation_id;
  if found then
    if v_movement.kind <> 'initial' or v_movement.request_payload <> v_request then
      raise exception 'Identificador de operación reutilizado con otros datos' using errcode = '22023';
    end if;
    return v_movement;
  end if;
  insert into public.products (household_id, category_id, name, description, icon_id, stock, created_by, risk_quantity)
    values (p_household_id, p_category_id, btrim(p_name), p_description, p_icon_id, p_initial_stock, v_actor, p_risk_quantity)
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


revoke all on function public.create_product_with_risk(uuid,uuid,text,text,text,integer,uuid,integer) from public, anon;
grant execute on function public.create_product_with_risk(uuid,uuid,text,text,text,integer,uuid,integer) to authenticated;

create function public.set_product_risk(p_product_id uuid, p_risk_quantity integer, p_expected_version bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_product public.products;
begin
  select * into v_product from public.products where id = p_product_id for update;
  if auth.uid() is null or not found or not private.is_member(v_product.household_id) then
    raise exception 'No tienes acceso a este producto' using errcode = '42501';
  end if;
  if p_risk_quantity is null or p_risk_quantity < 0 or p_risk_quantity > 1000000
    or p_expected_version is null or p_expected_version < 1 then
    raise exception 'Revisa la cantidad en riesgo' using errcode = '22023';
  end if;
  -- Repetir la misma escritura ya aplicada no suma otra versión ni pisa cambios posteriores.
  if v_product.risk_version = p_expected_version + 1 and v_product.risk_quantity = p_risk_quantity then
    return;
  end if;
  if v_product.risk_version <> p_expected_version then
    raise exception 'La cantidad en riesgo cambió en otra sesión' using errcode = 'PT412';
  end if;
  update public.products set risk_quantity = p_risk_quantity,
    risk_version = risk_version + 1, updated_at = clock_timestamp()
    where id = p_product_id;
end;
$$;
revoke all on function public.set_product_risk(uuid,integer,bigint) from public, anon;
grant execute on function public.set_product_risk(uuid,integer,bigint) to authenticated;

commit;
