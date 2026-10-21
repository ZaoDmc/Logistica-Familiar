import { useId, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export function LoginForm({ initialEmail = '' }: { initialEmail?: string }) {
  const id = useId();
  const [email, setEmail] = useState(initialEmail), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [help, setHelp] = useState(false);
  async function login(event: FormEvent) {
    event.preventDefault(); if (!supabase || busy) return;
    setBusy(true); setError('');
    try {
      const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) setError('No pudimos entrar. Revisa tu correo y contraseña e intenta nuevamente.');
      else setPassword('');
    } catch { setError('No pudimos conectar. Revisa tu conexión e intenta nuevamente.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={login} className="form-stack" aria-busy={busy}>
    <label htmlFor={`${id}-email`}>Correo electrónico</label><input id={`${id}-email`} type="email" autoComplete="username" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="tu@correo.cl" disabled={busy} />
    <label htmlFor={`${id}-password`}>Contraseña</label><input id={`${id}-password`} type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
    {error && <p className="alert error" role="alert">{error}</p>}
    <button className="primary" disabled={busy}>{busy ? 'Entrando…' : 'Entrar a mi hogar'}<span aria-hidden="true">→</span></button>
    <button type="button" className="text-button" onClick={() => setHelp(!help)} aria-expanded={help}>¿Olvidaste tu contraseña?</button>
    {help && <p className="alert">Pídele al admin un enlace privado para elegir una nueva contraseña. Si eres admin, tienes el procedimiento de recuperación en la guía del proyecto.</p>}
  </form>;
}
export function PasswordForm({ onDone, onCancel, recovery = false }: { onDone: () => void; onCancel?: () => void; recovery?: boolean }) {
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault(); if (!supabase || busy) return;
    if (password !== confirmation) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true); setError('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setError('No pudimos guardar la contraseña. El enlace puede haber vencido; solicita uno nuevo.');
      else { setPassword(''); setConfirmation(''); onDone(); }
    } catch { setError('No pudimos conectar. Intenta nuevamente.'); }
    finally { setBusy(false); }
  }
  return <section className="card narrow" aria-labelledby="password-title">
    <span className="badge">Tu cuenta</span><h1 className="card-title" id="password-title">{recovery ? 'Recupera tu acceso' : 'Cambia tu contraseña'}</h1>
    <p>Elige una contraseña de al menos 10 caracteres que solo tú conozcas.</p>
    <form onSubmit={save} className="form-stack" aria-busy={busy}>
      <label htmlFor="new-password">Nueva contraseña</label><input id="new-password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
      <label htmlFor="confirm-password">Repetir contraseña</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
      {error && <p className="alert error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
      {!recovery && <button type="button" className="secondary" onClick={onCancel || onDone} disabled={busy}>Volver al hogar</button>}
    </form>
  </section>;
}
