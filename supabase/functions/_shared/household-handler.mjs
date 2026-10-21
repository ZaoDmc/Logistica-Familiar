const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function tokenHash(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function inviteToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function rpcError(error) {
  if (error.code === '42501') throw new HttpError(403, 'No tienes permiso para realizar esta acción.');
  if (error.code === '23505') throw new HttpError(409, 'Ya existe una invitación pendiente para ese correo. Puedes renovar su enlace.');
  if (error.code === '22023') throw new HttpError(409, error.message);
  throw new HttpError(503, 'No pudimos completar la operación. Intenta nuevamente.');
}

export function createHouseholdHandler({ admin, origins }) {
  const allowed = new Set(origins);
  return async request => {
    const origin = request.headers.get('Origin');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'Vary': 'Origin', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (origin && allowed.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const respond = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
    try {
      if (origin && !allowed.has(origin)) throw new HttpError(403, 'Esta dirección no está habilitada para la aplicación.');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (request.method !== 'POST') throw new HttpError(405, 'Método no permitido.');
      if (Number(request.headers.get('Content-Length')) > 8192) throw new HttpError(413, 'Solicitud demasiado grande.');
      const text = await request.text();
      if (text.length > 8192) throw new HttpError(413, 'Solicitud demasiado grande.');
      let body;
      try { body = JSON.parse(text); } catch { throw new HttpError(400, 'Solicitud inválida.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Solicitud inválida.');
      const bearer = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
      const user = async () => {
        if (!bearer) throw new HttpError(401, 'Inicia sesión para continuar.');
        const { data, error } = await admin.auth.getUser(bearer);
        if (error || !data.user) throw new HttpError(401, 'Tu sesión venció. Inicia sesión nuevamente.');
        return data.user;
      };
      const inspect = async () => {
        if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) throw new HttpError(400, 'Enlace inválido.');
        const hash = await tokenHash(body.token);
        const { data, error } = await admin.rpc('inspect_household_invitation', { p_token_hash: hash });
        if (error) throw new HttpError(410, 'El enlace venció, fue revocado o ya se utilizó. Pide uno nuevo al admin.');
        return { invitation: data, hash };
      };

      if (body.action === 'inspect') {
        return respond((await inspect()).invitation);
      }
      if (body.action === 'accept') {
        const { invitation, hash } = await inspect();
        let acceptingUser;
        if (bearer) {
          acceptingUser = await user();
          if (acceptingUser.email?.toLowerCase() !== invitation.email.toLowerCase()) throw new HttpError(403, 'Inicia sesión con el correo al que se hizo la invitación.');
        } else {
          if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 128) throw new HttpError(400, 'Elige una contraseña de entre 10 y 128 caracteres.');
          const { data, error } = await admin.auth.admin.createUser({ email: invitation.email, password: body.password, email_confirm: true });
          if (error || !data.user) {
            if (error?.code === 'email_exists' || error?.code === 'user_already_exists') throw new HttpError(409, 'Este correo ya tiene cuenta. Inicia sesión con ella y vuelve a aceptar el enlace.');
            throw new HttpError(400, 'No pudimos crear la cuenta. Revisa la contraseña o intenta iniciar sesión si ya tienes cuenta.');
          }
          acceptingUser = data.user;
        }
        const { data, error } = await admin.rpc('accept_household_invitation', { p_token_hash: hash, p_user_id: acceptingUser.id });
        // Si Auth terminó pero SQL falla, la cuenta queda sin acceso al hogar.
        // No borrar a ciegas: SQL podría haber confirmado antes de un corte de red.
        if (error) rpcError(error);
        return respond({ household_id: data, email: invitation.email });
      }

      if (!['create', 'renew', 'revoke', 'recovery'].includes(body.action)) throw new HttpError(400, 'Acción inválida.');
      const actor = await user();
      if (!uuidPattern.test(body.household_id || '')) throw new HttpError(400, 'Hogar inválido.');
      if (body.action === 'recovery') {
        if (!uuidPattern.test(body.user_id || '')) throw new HttpError(400, 'Integrante inválido.');
        const { data: caller, error: callerError } = await admin.from('household_members').select('role').eq('household_id', body.household_id).eq('user_id', actor.id).maybeSingle();
        if (callerError || caller?.role !== 'admin') throw new HttpError(403, 'Solo admin puede recuperar el acceso de integrantes.');
        const { data: target, error: targetError } = await admin.from('household_members').select('role').eq('household_id', body.household_id).eq('user_id', body.user_id).maybeSingle();
        if (targetError || target?.role !== 'integrante') throw new HttpError(403, 'Solo puedes recuperar cuentas de integrantes de tu hogar.');
        const { data: targetUser, error } = await admin.auth.admin.getUserById(body.user_id);
        if (error || !targetUser.user?.email) throw new HttpError(404, 'Cuenta no disponible.');
        const appOrigin = origin || origins[0];
        const result = await admin.auth.admin.generateLink({ type: 'recovery', email: targetUser.user.email, options: { redirectTo: appOrigin } });
        if (result.error) throw new HttpError(503, 'No pudimos preparar el enlace de recuperación.');
        // generateLink no envía correo. El admin comparte el enlace manualmente.
        return respond({ url: result.data.properties.action_link });
      }
      if (!uuidPattern.test(body.invitation_id || '')) throw new HttpError(400, 'Identificador de invitación inválido.');
      if (body.action === 'create' && (typeof body.email !== 'string' || !emailPattern.test(body.email.trim()) || body.email.length > 254 || typeof body.display_name !== 'string' || !body.display_name.trim() || body.display_name.trim().length > 80)) throw new HttpError(400, 'Revisa el nombre y el correo del integrante.');
      const token = body.action === 'revoke' ? null : inviteToken();
      const { data, error } = await admin.rpc('manage_household_invitation', {
        p_actor_id: actor.id, p_household_id: body.household_id, p_action: body.action,
        p_invitation_id: body.invitation_id, p_email: body.email || null,
        p_display_name: body.display_name || null, p_token_hash: token ? await tokenHash(token) : null,
      });
      if (error) rpcError(error);
      return respond({ id: data.id, status: data.status, expires_at: data.expires_at,
        ...(token ? { url: `${origin || origins[0]}/#invite=${token}` } : {}) });
    } catch (error) {
      if (error instanceof HttpError) return respond({ error: error.message }, error.status);
      return respond({ error: 'No pudimos conectar con el servicio. Intenta nuevamente.' }, 503);
    }
  };
}
