import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { householdAction, supabase } from '../lib/supabase';
import { Inventory } from './inventory/Inventory';

type Member = { user_id: string; role: string; name: string };
type Invite = { id: string; email: string; display_name: string; status: string; expires_at: string };
type LinkResult = { url?: string; expires_at?: string };
export function Household({ id, name, userId }: { id: string; name: string; userId: string }) {
  const [members, setMembers] = useState<Member[]>([]), [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [link, setLink] = useState(''), [linkKind, setLinkKind] = useState('');
  const [personName, setPersonName] = useState(''), [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<'products' | 'restock' | 'history' | 'members'>('products');
  const [historyProduct, setHistoryProduct] = useState('');
  const operation = useRef<string | null>(null);
  const admin = members.find(member => member.user_id === userId)?.role === 'admin';
  const reload = useCallback(async () => {
    if (!supabase) return;
    setError('');
    const { data: rows, error } = await supabase.from('household_members').select('user_id,role').eq('household_id', id);
    if (error || !rows?.length) throw new Error('No pudimos cargar los integrantes. Actualiza o vuelve a iniciar sesión.');
    const profiles = await supabase.from('profiles').select('id,display_name').in('id', rows.map(row => row.user_id));
    if (profiles.error) throw new Error('No pudimos cargar los nombres. Intenta nuevamente.');
    setMembers(rows.map(row => ({ ...row, name: profiles.data?.find(profile => profile.id === row.user_id)?.display_name || 'Integrante' })).sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name)));
    if (rows.find(row => row.user_id === userId)?.role === 'admin') {
      const result = await supabase.from('household_invitations').select('id,email,display_name,status,expires_at').eq('household_id', id).order('created_at', { ascending: false });
      if (result.error) throw new Error('No pudimos cargar las invitaciones.');
      setInvites(result.data || []);
    } else setInvites([]);
  }, [id, userId]);
  useEffect(() => { let active = true; void reload().catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [reload]);
  async function act(action: string, extra: Record<string, unknown>, title: string) {
    if (busy) return false;
    setBusy(true); setError(''); setLink(''); setCopied(false);
    try {
      const result = await householdAction<LinkResult>({ action, household_id: id, ...extra });
      if (result.url) { setLink(result.url); setLinkKind(title); }
      await reload(); return true;
    } catch (error) { setError(error instanceof Error ? error.message : 'No pudimos completar la operación.'); return false; }
    finally { setBusy(false); }
  }
  async function invite(event: FormEvent) {
    event.preventDefault(); operation.current ||= crypto.randomUUID();
    if (await act('create', { invitation_id: operation.current, email: email.trim(), display_name: personName.trim() }, 'Invitación preparada')) {
      operation.current = null; setEmail(''); setPersonName('');
    }
  }
  if (loading) return <section className="card" role="status">Cargando tu hogar…</section>;
  return <div className="dashboard">
    <section className="home-summary"><p className="eyebrow">NUESTRO ESPACIO COMPARTIDO</p><h1>{name}</h1><p>{members.length} {members.length === 1 ? 'persona cuidando' : 'personas cuidando'} lo cotidiano.</p><span className="badge">{admin ? 'Admin' : 'Integrante'}</span></section>
    <nav className="household-nav" aria-label="Secciones del hogar"><button aria-pressed={view === 'products'} onClick={() => setView('products')}>Productos</button><button aria-pressed={view === 'restock'} onClick={() => setView('restock')}>Reposición</button><button aria-pressed={view === 'history'} onClick={() => { setHistoryProduct(''); setView('history'); }}>Movimientos</button><button aria-pressed={view === 'members'} onClick={() => setView('members')}>Integrantes</button></nav>
    <Inventory home={id} userId={userId} view={view} historyProduct={historyProduct} setHistoryProduct={setHistoryProduct} showHistory={product => { setHistoryProduct(product); setView('history'); }} />
    <div hidden={view !== 'members'}>
    {error && <div className="alert error" role="alert">{error}<button className="text-button" disabled={busy} onClick={() => void reload().catch(error => setError(error.message))}>Reintentar</button></div>}
    <section className="card" aria-labelledby="members-title">
      <div className="section-heading"><h2 id="members-title">Quienes hacemos hogar</h2><span className="count">{members.length}</span></div>
      <ul className="people-list">{members.map(member => <li key={member.user_id}>
        <span className="avatar" aria-hidden="true">{member.name.slice(0, 1).toLocaleUpperCase()}</span><div className="person"><strong>{member.name}{member.user_id === userId ? ' · Tú' : ''}</strong><span className="small">{member.role === 'admin' ? 'Admin del hogar' : 'Integrante'}</span></div>
        {admin && member.role === 'integrante' && <button className="secondary compact" disabled={busy} onClick={() => void act('recovery', { user_id: member.user_id }, `Recuperación para ${member.name}`)}>Recuperar acceso</button>}
      </li>)}</ul>
    </section>
    {admin && <section className="card" aria-labelledby="invite-title"><span className="eyebrow">COMPARTIR LA ORGANIZACIÓN</span><h2 id="invite-title">Invita a alguien al hogar</h2><p>Prepara un enlace privado. La otra persona elegirá su contraseña al abrirlo.</p>
      <form onSubmit={invite} className="form-stack" aria-busy={busy}>
        <label htmlFor="person-name">Nombre</label><input id="person-name" autoComplete="off" required maxLength={80} value={personName} onChange={event => { setPersonName(event.target.value); operation.current = null; }} disabled={busy} placeholder="Por ejemplo, Mamá" />
        <label htmlFor="person-email">Correo electrónico</label><input id="person-email" type="email" autoComplete="off" required maxLength={254} value={email} onChange={event => { setEmail(event.target.value); operation.current = null; }} disabled={busy} placeholder="Su correo personal" />
        <button className="primary" disabled={busy}>{busy ? 'Preparando…' : 'Crear enlace de invitación'}</button>
      </form><p className="small">Válido por 7 días. Se comparte manualmente; no se envía por correo.</p>
    </section>}
    {admin && link && <section className="card link-card" aria-labelledby="link-title"><h2 id="link-title">{linkKind}</h2><p>Compártelo solo con esa persona. Cualquier persona que tenga el enlace podrá usarlo.</p><label className="sr-only" htmlFor="private-link">Enlace privado</label><input id="private-link" readOnly value={link} onFocus={event => event.target.select()} />
      <button className="primary" onClick={() => { if (!navigator.clipboard) { setError('Mantén presionado el enlace para seleccionarlo y copiarlo.'); return; } void navigator.clipboard.writeText(link).then(() => setCopied(true)).catch(() => setError('Mantén presionado el enlace para seleccionarlo y copiarlo.')); }}>Copiar enlace</button><p role="status" className="small">{copied ? 'Enlace copiado.' : 'También puedes seleccionar y copiar el enlace.'}</p><button className="text-button" onClick={() => setLink('')}>Ocultar enlace</button></section>}
    {admin && <section className="card" aria-labelledby="pending-title"><h2 id="pending-title">Invitaciones</h2>{invites.length ? <ul className="invite-list">{invites.map(invitation => {
      const pending = invitation.status === 'pending' || invitation.status === 'expired';
      const expired = new Date(invitation.expires_at).getTime() <= Date.now();
      const status = invitation.status === 'accepted' ? 'Aceptada' : invitation.status === 'revoked' ? 'Revocada' : expired ? 'Vencida' : 'Pendiente';
      return <li key={invitation.id}><div><strong>{invitation.display_name}</strong><p className="small">{invitation.email}</p><span className="badge">{status}</span></div>{pending && <div className="button-row"><button className="secondary compact" disabled={busy} onClick={() => void act('renew', { invitation_id: invitation.id }, 'Nuevo enlace preparado')}>Renovar enlace</button><button className="text-button danger" disabled={busy} onClick={() => void act('revoke', { invitation_id: invitation.id }, '')}>Revocar</button></div>}</li>;
    })}</ul> : <p>Aquí aparecerán las invitaciones que prepares.</p>}<p className="small">Renovar un enlace invalida el anterior. Revocar una invitación pendiente impide usarla.</p></section>}
    </div>
  </div>;
}
