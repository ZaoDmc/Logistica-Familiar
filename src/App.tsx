import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { productIcons } from './catalogs/icons';
import { LoginForm, PasswordForm } from './components/AuthForms';
import { Invitation } from './components/Invitation';
import { Household } from './components/Household';
import { supabase } from './lib/supabase';
import { useTheme } from './theme';
import { PwaControls } from './components/PwaControls';

const initialInvite = new URLSearchParams(location.hash.slice(1)).get('invite');
const initialRecovery = new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';
if (initialInvite) history.replaceState(null, '', location.pathname + location.search);
type Home = { id: string; name: string };

export function App() {
  const { theme, setTheme } = useTheme();
  const [session, setSession] = useState<Session | null>(null), [booting, setBooting] = useState(true);
  const [inviteToken, setInviteToken] = useState(initialInvite), [passwordView, setPasswordView] = useState(initialRecovery);
  const [homes, setHomes] = useState<Home[]>([]), [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0), [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    if (!supabase) { setBooting(false); return; }
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next); setBooting(false);
      if (event === 'PASSWORD_RECOVERY') setPasswordView(true);
      if (event === 'SIGNED_OUT') { setHomes([]); setSelected(''); setPasswordView(false); }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const userId = session?.user.id;
  const load = useCallback(async () => {
    if (!supabase || !userId) return [] as Home[];
    const { error: identityError } = await supabase.auth.getUser();
    if (identityError) throw new Error('No pudimos verificar tu sesión. Vuelve a iniciar sesión.');
    const membership = await supabase.from('household_members').select('household_id').eq('user_id', userId);
    if (membership.error) throw new Error('No pudimos cargar tu hogar. Intenta nuevamente.');
    if (!membership.data.length) return [] as Home[];
    const result = await supabase.from('households').select('id,name').in('id', membership.data.map(row => row.household_id));
    if (result.error) throw new Error('No pudimos cargar tu hogar. Intenta nuevamente.');
    return result.data as Home[];
  }, [userId]);
  useEffect(() => {
    if (!userId) return;
    let active = true; setLoading(true); setError('');
    void load().then(data => {
      if (!active) return;
      setHomes(data); setSelected(previous => data.some(home => home.id === previous) ? previous : data[0]?.id || '');
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, userId, revision]);
  async function logout() {
    if (!supabase || signingOut) return;
    setSigningOut(true);
    try { const { error } = await supabase.auth.signOut({ scope: 'local' }); if (error) setError('No pudimos cerrar la sesión. Intenta nuevamente.'); }
    catch { setError('No pudimos cerrar la sesión. Intenta nuevamente.'); }
    finally { setSigningOut(false); }
  }
  const home = homes.find(home => home.id === selected);
  return <main>
    <header className="app-header"><a className="brand" href="/" aria-label="Logística Familiar, inicio"><img className="mark" src="/icons/Logitan%20Bello.png" alt="Logan, nuestro cachorro" width="44" height="44" /><span>Logística Familiar<small>Nos organizamos en casa</small></span></a>
      <div className="theme-control" role="group" aria-label="Tema">
        <button type="button" aria-label="Tema claro" title="Tema claro" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg><span>Claro</span></button>
        <button type="button" aria-label="Tema oscuro" title="Tema oscuro" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" /></svg><span>Oscuro</span></button>
      </div>
    </header>
    {notice && <p className="alert" role="status">{notice}</p>}
    {booting ? <p className="card" role="status">Preparando tu acceso…</p> : !supabase ? <section className="card"><h1 className="card-title">La conexión está pendiente</h1><p>Completa la configuración del proyecto para comenzar.</p></section> : inviteToken ? <Invitation token={inviteToken} session={session} onDone={() => { setInviteToken(null); setRevision(value => value + 1); }} /> : session ? <>
      <nav className="account-bar" aria-label="Tu cuenta"><span className="small account-email">{session.user.email}</span><div className="button-row"><button className="text-button" onClick={() => { setPasswordView(!passwordView); setNotice(''); }}>{passwordView ? 'Mi hogar' : 'Cambiar contraseña'}</button><button className="secondary compact" onClick={() => void logout()} disabled={signingOut}>{signingOut ? 'Saliendo…' : 'Salir'}</button></div></nav>
      {passwordView ? <PasswordForm recovery={initialRecovery} onCancel={() => setPasswordView(false)} onDone={() => { setPasswordView(false); setNotice('Tu contraseña quedó actualizada.'); }} /> : loading ? <p className="card" role="status">Cargando tu hogar…</p> : error ? <section className="card"><p className="alert error" role="alert">{error}</p><button className="secondary" onClick={() => setRevision(value => value + 1)}>Reintentar</button></section> : home ? <>
        {homes.length > 1 && <div className="home-picker"><label htmlFor="home">Hogar</label><select id="home" value={selected} onChange={event => setSelected(event.target.value)}>{homes.map(home => <option key={home.id} value={home.id}>{home.name}</option>)}</select></div>}
        <Household key={`${home.id}/${revision}`} id={home.id} name={home.name} userId={session.user.id} />
      </> : <section className="card narrow"><span className="badge">Tu cuenta está lista</span><h1 className="card-title">Falta unirte a tu hogar</h1><p>Abre el enlace privado que te compartió el admin. Si estás preparando tu primer hogar, completa el alta inicial indicada en la guía del proyecto.</p><button className="secondary" onClick={() => setRevision(value => value + 1)}>Actualizar</button></section>}
    </> : <div className="welcome-layout"><section className="intro" aria-labelledby="title"><p className="eyebrow">ENTRE MAMÁ Y YO</p><h1 id="title">Para que llevemos<br /><em>un orden</em></h1><p className="lead">mamita querida &lt;3 <svg className="welcome-heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 3.5 12.5a5.3 5.3 0 0 1 7.5-7.5l1 1 1-1a5.3 5.3 0 0 1 7.5 7.5Z" /></svg></p><ul className="category-preview" aria-label="Para todo lo cotidiano">{productIcons.filter(icon => ['food', 'cleaning', 'pet', 'paper'].includes(icon.id)).map(icon => <li key={icon.id}><span aria-hidden="true">{icon.symbol}</span>{icon.label}</li>)}</ul><p className="small">Nuestra lista para cuidar la casita.</p></section>
      <section className="card login-card" aria-labelledby="login-title"><span className="badge">Qué bueno tenerte aquí</span><h2 id="login-title">Entra a tu hogar</h2><p>Entremos a ver qué hace falta en casa.</p><LoginForm /><p className="note">¿Es tu primera vez? Abre el enlace de invitación que te compartió el admin.</p></section></div>}
    <PwaControls />
    <footer>Lo cotidiano se lleva mejor en familia.</footer>
  </main>;
}
