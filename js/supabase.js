// Client Supabase - progetto condiviso con Bollicine e Polizze
// Sostituire SUPABASE_ANON_KEY con la chiave attuale del progetto.
// La chiave va ruotata dopo l'esposizione precedente (TODO).

const SUPABASE_URL = 'https://fysrnwybfhtmjvthljuz.supabase.co';
const SUPABASE_ANON_KEY = 'INCOLLA_QUI_ANON_KEY';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export globale per le altre pagine
window.sb = sb;
