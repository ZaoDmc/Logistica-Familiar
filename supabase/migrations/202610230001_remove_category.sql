begin;

-- Se trasladan productos y se quita la categoría en una sola transacción.
-- Los UUID de categoría hacen que reintentar una eliminación ya aplicada sea seguro.
create function public.remove_category(p_household_id uuid, p_category_id uuid, p_destination_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_member(p_household_id) then
    raise exception 'No tienes acceso a este hogar' using errcode = '42501';
  end if;
  if p_category_id is null or p_category_id = p_destination_id then
    raise exception 'Selecciona otra categoría' using errcode = '22023';
  end if;
  -- Orden estable para dos traslados concurrentes en sentidos opuestos.
  perform id from public.categories
    where household_id = p_household_id and id in (p_category_id, p_destination_id)
    order by id for update;
  if not exists (select 1 from public.categories where id = p_category_id and household_id = p_household_id) then
    return;
  end if;
  if p_destination_id is not null and not exists (
    select 1 from public.categories where id = p_destination_id and household_id = p_household_id
  ) then
    raise exception 'La categoría de destino ya no está disponible' using errcode = '23503';
  end if;
  if p_destination_id is null and exists (
    select 1 from public.products where category_id = p_category_id and household_id = p_household_id
  ) then
    raise exception 'Elige dónde conservar los productos' using errcode = 'P0001';
  end if;
  if p_destination_id is not null then
    update public.products set category_id = p_destination_id, updated_at = clock_timestamp()
      where household_id = p_household_id and category_id = p_category_id;
  end if;
  delete from public.categories where household_id = p_household_id and id = p_category_id;
end;
$$;
revoke all on function public.remove_category(uuid, uuid, uuid) from public, anon;
grant execute on function public.remove_category(uuid, uuid, uuid) to authenticated;

commit;
