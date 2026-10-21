import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { householdAction, supabase } from '../lib/supabase';
import { LoginForm } from './AuthForms';
type Details = { email: string; display_name: string; household_name: string; expires_at: string };
export function Invitation({ token, session, onDone }: { token: string; session: Session | null; onDone: () => void }) {
  const [details, setDetails] = useState<Details | null>(null), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [existing, setExisting] = useState(false);
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  useEffect(() => {
    let active = true;
    householdAction<Details>({ action: 'inspect', token }).then(data => { if (active) setDetails(data); }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [token]);
  async function accept(event: FormEvent) {
    event.preventDefault(); if (busy || !details || !supabase) return;
    if (!session && password !== confirmation) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true); setError('');
    try {
      await householdAction({ action: 'accept', token, ...(!session ? { password } : {}) });
      if (!session) await supabase.auth.signInWithPassword({ email: details.email, password });
      setPassword(''); setConfirmation(''); onDone();
    } catch (error) { setError(error instanceof Error ? error.message : 'No pudimos completar el alta.'); }
    finally { setBusy(false); }
  }
  return <section className="card narrow">
    <span className="badge">Te invitaron a casa</span><h1 className="card-title">{details ? `Hola, ${details.display_name}` : 'Tu invitación'}</h1>
    {!details && !error && <p role="status">Revisando el enlace…</p>}
    {details && <><p>Únete a <strong>{details.household_name}</strong> con el correo <strong>{details.email}</strong>.</p><p className="small">Este enlace es personal y vence el {new Date(details.expires_at).toLocaleDateString('es-CL')}.</p>
      {!session && existing ? <LoginForm initialEmail={details.email} /> : <form onSubmit={accept} className="form-stack" aria-busy={busy}>
        {!session && <><label htmlFor="join-password">Elige tu contraseña</label><input id="join-password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
          <label htmlFor="join-confirm">Repetir contraseña</label><input id="join-confirm" type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /><p className="small">Al menos 10 caracteres. No necesitas compartirla con el admin.</p></>}
        {session && <p className="alert">Sesión actual: {session.user.email}. Debe coincidir con el correo de la invitación.</p>}
        <button className="primary" disabled={busy}>{busy ? 'Preparando tu acceso…' : session ? 'Aceptar invitación' : 'Crear mi cuenta y unirme'}</button>
      </form>}
      {!session && <button className="text-button" type="button" onClick={() => { setExisting(!existing); setError(''); }}>{existing ? 'Crear una cuenta nueva' : 'Ya tengo una cuenta'}</button>}
      {session && session.user.email?.toLowerCase() !== details.email.toLowerCase() && <button className="secondary" type="button" onClick={() => void supabase?.auth.signOut({ scope: 'local' })}>Entrar con otra cuenta</button>}
    </>}
    {error && <p className="alert error" role="alert">{error}</p>}
    <button className="text-button" type="button" onClick={onDone} disabled={busy}>Volver al inicio</button>
  </section>;
}
