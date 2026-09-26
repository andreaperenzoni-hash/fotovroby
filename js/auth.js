async function requireAuth() {
  console.log('1. requireAuth chiamata');
  const { data: { session }, error: eSess } = await sb.auth.getSession();
  console.log('2. sessione:', session, 'errore:', eSess);

  if (!session) {
    console.log('3. NO sessione, vado a login');
    window.location.href = 'login.html';
    return null;
  }

  console.log('4. cerco utente in fotovroby_utenti con id:', session.user.id);
  const { data: utente, error } = await sb
    .from('fotovroby_utenti')
    .select('nome, ruolo, attivo')
    .eq('user_id', session.user.id)
    .eq('attivo', true)
    .maybeSingle();

  console.log('5. utente trovato:', utente, 'errore:', error);

  if (error || !utente) {
    console.log('6. utente NON autorizzato, sign out e torno a login');
    alert('Utente non autorizzato: ' + JSON.stringify(error));
    await sb.auth.signOut();
    window.location.href = 'login.html';
    return null;
  }

  const el = document.getElementById('user-nome');
  if (el) el.textContent = utente.nome;

  console.log('7. autenticato, procedo');
  return { session, utente };
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

window.requireAuth = requireAuth;
window.logout = logout;