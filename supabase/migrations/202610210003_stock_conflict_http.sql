-- La versión antigua es un conflicto de edición, no un fallo de serialización.
-- PT409 entrega HTTP 409 sin los reintentos internos de PostgREST para 40001.
-- CREATE OR REPLACE conserva los permisos de la función existente.
begin;

create or replace function public.change_stock(
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
    raise exception 'El stock cambió; actualiza antes de confirmar' using errcode = 'PT409';
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

notify pgrst, 'reload schema';
commit;
