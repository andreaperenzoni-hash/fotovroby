# fotovroby

Gestionale impianti fotovoltaici · manutenzioni, verifiche periodiche (SPI, SPG), adempimenti ADM e scadenziario.

## Stack
- Frontend HTML/JS vanilla su Vercel
- Backend Supabase (progetto condiviso con Bollicine e Polizze)
- Tabelle prefissate `fotovroby_`
- Accesso ristretto tramite tabella `fotovroby_utenti` (RLS)

## Struttura
- `index.html` — Dashboard con KPI, calendario scadenze e prossime 10
- `login.html` — Login Supabase Auth
- `scadenziario.html` — TODO step 2
- `impianti.html` — TODO step 3
- `clienti.html` — TODO step 4
- `js/supabase.js` — client Supabase (endpoint + anon key)
- `js/auth.js` — guardia autenticazione
- `js/dashboard.js` — logica Dashboard
- `css/style.css` — palette ispirata a Polizze-Gest

## Setup

1. Eseguire `fotovroby_schema_v0.2.sql` sul progetto Supabase.
2. Eseguire le viste `fotovroby_v_kpi` e `fotovroby_v_impianti_per_fascia` (blocco SQL fornito a parte).
3. Creare utente in Authentication > Users e inserirlo in `fotovroby_utenti`.
4. Aprire `js/supabase.js` e sostituire `INCOLLA_QUI_ANON_KEY` con l'anon key del progetto.
5. Aprire `login.html` in locale, oppure deployare su Vercel.

## Deploy su Vercel
- Collegare il repo `andreaperenzoni-hash/fotovroby`.
- Preset: Other. Root directory: `.`. Build command: nessuno. Output directory: `.`.
- Ogni push su `main` pubblica su `fotovroby.vercel.app`.

## TODO
- Ruotare anon key (esposta in chat precedenti)
- Aggiungere `fotovroby_%` al workflow di backup notturno `backup-supabase-v1.0.yml`
- Step 2: scadenziario a semafori con filtri
- Step 3: anagrafica impianti con calcolo fascia
- Step 4: anagrafica clienti
