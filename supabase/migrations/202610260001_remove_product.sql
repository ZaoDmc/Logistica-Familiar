begin;

-- Baja lógica: conservar el producto referenciado por sus movimientos.
-- Se desvincula de su categoría para que una categoría vacía pueda quitarse.
alter table public.products
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.profiles(id) on delete restrict,
  alter column category_id drop not null,
  add constraint products_active_category_check check (
    (deleted_at is null and deleted_by is null and category_id is not null)
    or (deleted_at is not null and deleted_by is not null and category_id is null)
  );
create index products_active_household_idx on public.products(household_id,id) where deleted_at is null;

-- Protege también los RPC anteriores de stock y riesgo, incluso clientes antiguos.
create function private.guard_removed_product()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.deleted_at is not null and new is distinct from old then
    raise exception 'Este producto fue eliminado; actualiza el inventario' using errcode = 'PT410';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_removed_product() from public, anon, authenticated;
create trigger products_guard_removed before update on public.products
  for each row execute function private.guard_removed_product();

create function public.remove_product(p_product_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_product public.products;
begin
  select * into v_product from public.products where id = p_product_id for update;
  if auth.uid() is null or not found or not private.is_member(v_product.household_id) then
    raise exception 'No tienes acceso a este producto' using errcode = '42501';
  end if;
  if v_product.deleted_at is not null then return; end if;
  update public.products set deleted_at = clock_timestamp(), deleted_by = auth.uid(),
    category_id = null, updated_at = clock_timestamp()
    where id = p_product_id;
end;
$$;
revoke all on function public.remove_product(uuid) from public, anon;
grant execute on function public.remove_product(uuid) to authenticated;

commit;
