-- Las notificaciones respetan las políticas SELECT existentes por hogar.
-- La publicación la administra Supabase; PGlite no ejecuta replicación lógica.
do $$
declare target text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach target in array array['categories', 'products', 'stock_movements'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = target) then
        execute format('alter publication supabase_realtime add table public.%I', target);
      end if;
    end loop;
  end if;
end $$;
