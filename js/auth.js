// Guardia autenticazione per tutte le pagine tranne login.html
// Verifica che ci sia una sessione E che l'utente sia in fotovroby_utenti attivi.

async function requireAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }

  // Controlla che sia utente autorizzato di fotovroby
  const { data: utente, error } = await sb
    .from('fotovroby_utenti')
    .select('nome, ruolo, attivo')
    .eq('user_id', session.user.id)
    .eq('attivo', true)
    .maybeSingle();

  if (error || !utente) {
    alert('Utente non autorizzato per fotovroby.\n' +
          'Chiedi all\'amministratore di aggiungerti alla tabella fotovroby_utenti.');
    await sb.auth.signOut();
    window.location.href = 'login.html';
    return null;
  }

  // Mostra nome utente se c'è l'elemento nella pagina
  const el = document.getElementById('user-nome');
  if (el) el.textContent = utente.nome;

  return { session, utente };
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

window.requireAuth = requireAuth;
window.logout = logout;
