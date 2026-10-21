begin;

alter table public.household_invitations
  add column display_name text not null default 'Integrante'
    check (char_length(btrim(display_name)) between 1 and 80),
  add column token_hash text unique check (token_hash ~ '^[a-f0-9]{64}$'),
  add column accepted_by uuid references public.profiles(id) on delete restrict,
  add column accepted_at timestamptz;
create unique index household_invitation_pending_email_idx
  on public.household_invitations(household_id, lower(email)) where status = 'pending';

-- Ni el hash de los enlaces ni las credenciales se exponen al navegador.
revoke select on public.household_invitations from authenticated;
grant select (id, household_id, email, invited_by, status, expires_at, created_at,
  display_name, accepted_by, accepted_at) on public.household_invitations to authenticated;

-- Estas funciones solo se ejecutan desde la Edge Function. p_actor_id proviene
-- de auth.getUser(token), nunca de los datos enviados por el navegador.
create function public.manage_household_invitation(
  p_actor_id uuid, p_household_id uuid, p_action text, p_invitation_id uuid,
  p_email text default null, p_display_name text default null, p_token_hash text default null
) returns public.household_invitations
language plpgsql security definer set search_path = '' as $$
declare v_invitation public.household_invitations;
begin
  if not exists (select 1 from public.household_members where household_id = p_household_id
      and user_id = p_actor_id and role = 'admin') then
    raise exception 'Solo admin puede administrar integrantes' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('create', 'renew', 'revoke') or p_invitation_id is null then
    raise exception 'Acción de invitación inválida' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('invitations/' || p_household_id::text, 0));
  select * into v_invitation from public.household_invitations where id = p_invitation_id for update;
  if found then
    if v_invitation.household_id <> p_household_id or (p_action = 'create' and
        (v_invitation.invited_by <> p_actor_id or v_invitation.email <> lower(btrim(p_email))
        or v_invitation.display_name <> btrim(p_display_name))) then
      raise exception 'Invitación no disponible' using errcode = '42501';
    end if;
    if v_invitation.status not in ('pending', 'expired') then
      raise exception 'La invitación ya fue utilizada o revocada' using errcode = '22023';
    end if;
    if p_action = 'revoke' then
      update public.household_invitations set status = 'revoked', token_hash = null
        where id = p_invitation_id returning * into v_invitation;
      return v_invitation;
    end if;
  elsif p_action <> 'create' then
    raise exception 'Invitación no disponible' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Enlace no válido' using errcode = '22023';
  end if;
  if v_invitation.id is not null then
    -- Reintentar/renovar rota el enlace anterior. No genera otra invitación.
    update public.household_invitations set token_hash = p_token_hash, expires_at = clock_timestamp() + interval '7 days', status = 'pending'
      where id = p_invitation_id returning * into v_invitation;
  else
    if p_email is null or lower(btrim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        or p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 80 then
      raise exception 'Nombre o correo inválido' using errcode = '22023';
    end if;
    if exists (select 1 from auth.users u join public.household_members m on m.user_id = u.id
        where m.household_id = p_household_id and lower(u.email) = lower(btrim(p_email))) then
      raise exception 'Esta persona ya pertenece al hogar' using errcode = '22023';
    end if;
    insert into public.household_invitations(id, household_id, email, display_name, invited_by, token_hash, expires_at)
      values (p_invitation_id, p_household_id, lower(btrim(p_email)), btrim(p_display_name), p_actor_id,
        p_token_hash, clock_timestamp() + interval '7 days') returning * into v_invitation;
  end if;
  return v_invitation;
end;
$$;

create function public.inspect_household_invitation(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  select jsonb_build_object('id', i.id, 'household_id', i.household_id, 'household_name', h.name,
      'email', i.email, 'display_name', i.display_name, 'expires_at', i.expires_at)
    into v_result from public.household_invitations i join public.households h on h.id = i.household_id
    where i.token_hash = p_token_hash and i.status = 'pending' and i.expires_at > clock_timestamp();
  if v_result is null then
    raise exception 'El enlace venció, fue revocado o ya se utilizó' using errcode = '22023';
  end if;
  return v_result;
end;
$$;

create function public.accept_household_invitation(p_token_hash text, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_invitation public.household_invitations; v_email text;
begin
  select * into v_invitation from public.household_invitations where token_hash = p_token_hash for update;
  if not found then
    raise exception 'Enlace no disponible' using errcode = '22023';
  end if;
  -- Reintentar con la misma identidad verificada conserva la pertenencia.
  if v_invitation.status = 'accepted' and v_invitation.accepted_by = p_user_id then
    return v_invitation.household_id;
  end if;
  if v_invitation.status <> 'pending' or v_invitation.expires_at <= clock_timestamp() then
    raise exception 'El enlace venció, fue revocado o ya se utilizó' using errcode = '22023';
  end if;
  select lower(email) into v_email from auth.users where id = p_user_id;
  if v_email is null or v_email <> v_invitation.email then
    raise exception 'El correo no coincide con la invitación' using errcode = '42501';
  end if;
  insert into public.profiles(id, display_name) values (p_user_id, v_invitation.display_name)
    on conflict (id) do nothing;
  insert into public.household_members(household_id, user_id, role)
    values (v_invitation.household_id, p_user_id, 'integrante') on conflict (household_id, user_id) do nothing;
  update public.household_invitations set status = 'accepted', accepted_by = p_user_id, accepted_at = clock_timestamp()
    where id = v_invitation.id;
  return v_invitation.household_id;
end;
$$;

revoke all on function public.manage_household_invitation(uuid,uuid,text,uuid,text,text,text),
  public.inspect_household_invitation(text), public.accept_household_invitation(text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.manage_household_invitation(uuid,uuid,text,uuid,text,text,text),
  public.inspect_household_invitation(text), public.accept_household_invitation(text,uuid) to service_role;
notify pgrst, 'reload schema';
commit;
