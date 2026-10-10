# fotovroby v0.7 · Modulo Contratti di Manutenzione

Pacchetto **aggiuntivo** sopra l'installazione v0.6 esistente.
**Non sovrascrive nulla** di quello che hai già: aggiunge solo nuovi file e
una voce di menu da attivare manualmente nelle pagine esistenti.

## Contenuto del pacchetto

```
fotovroby_v0.7_contratti/
├── contratti.html                       NUOVO: pagina Contratti
├── js/contratti.js                      NUOVO: logica Contratti
├── css/style_append.css                 DA APPENDERE a css/style.css
└── (schema SQL e dati prova a parte)
```

## Procedura di installazione

### STEP 1 · Lancia il SQL

In Supabase SQL Editor, esegui in questo ordine:

1. **`fotovroby_schema_v0.5_contratti.sql`** → crea tabelle contratti,
   trigger per scadenze commerciali -90/-30/-7, viste aggiornate.
   Alla fine mostra `v_kpi` con nuovi campi `contratti_attivi` e `canoni_annui_totali`.

2. **`fotovroby_dati_prova_contratti_v0.1.sql`** → popola 8 contratti DEMO:
   - 4 scaduti a -36/-18/-12/-6 mesi (storico/follow-up/critico/recente)
   - 4 attivi che scadono a +6/+12/+18/+36 mesi
   - Uno dei contratti attivi è un **contratto quadro** su 2 impianti

### STEP 2 · Copia i file in `C:/progetti/fotovroby/`

1. Copia `contratti.html` nella root del repo.
2. Copia `js/contratti.js` dentro `js/`.
3. Apri `css/style.css` esistente e **APPENDI** il contenuto di `css/style_append.css`
   alla fine del file (non sostituire!).

### STEP 3 · Aggiungi la voce "Contratti" al menu delle altre pagine

In OGNI pagina HTML esistente (index.html, scadenziario.html, impianti.html, ecc.),
cerca questa riga nel menu:

```html
<a href="scadenziario.html">Scadenziario</a>
```

E AGGIUNGI SUBITO PRIMA:

```html
<a href="contratti.html">Contratti</a>
```

Oppure, da Git Bash in `C:/progetti/fotovroby/`:

```bash
for f in index.html scadenziario.html progetti.html autorizzazioni.html \
         attivi.html impianti.html interventi.html clienti.html tecnici.html; do
  if [ -f "$f" ] && ! grep -q "contratti.html" "$f"; then
    sed -i 's|<a href="scadenziario.html"[^>]*>Scadenziario</a>|<a href="contratti.html">Contratti</a>\n    &|' "$f"
  fi
done
```

### STEP 4 · Deploy

```bash
cd /c/progetti/fotovroby && \
git add . && \
git commit -m "v0.7 modulo contratti di manutenzione

- Tabella contratti con multi-impianto per cliente
- Scadenze commerciali auto -90/-30/-7 giorni rinnovo
- Scadenze contrattuali attive solo con contratto
- Scadenze normative (SPI/SPG/ADM) sempre attive
- Rinnovo rapido con un click
- 8 contratti di prova a -36/-18/-12/-6 mesi e +6/+12/+18/+36 mesi

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01KAsctVrmT4qbJNDEZkY6CW" && \
git push
```

## Cosa aspettarsi dopo il deploy

### Pagina Contratti

- **6 KPI in alto**: attivi, in scadenza 90gg, scaduti, canoni totali, kW sotto contratto,
  impianti senza contratto (opportunità commerciale!)
- **Filtri**: stato, semaforo rinnovo, cliente, ricerca
- **Tabella** con numero (↻ se è un rinnovo), cliente, oggetto, impianti coperti,
  canone, visite/anno, periodo, "scade tra X giorni", stato colorato
- **Pulsante ↻** su contratti in scadenza entro 180gg per rinnovo rapido

### Modale Nuovo/Modifica contratto

- Dati contratto + selezione cliente
- Checklist dinamica degli impianti del cliente (solo attivi/autorizzazione)
- Supporto contratto quadro (più impianti)
- Al salvataggio: info-box che spiega cosa succede automaticamente
- Pulsante **Rinnova** sui contratti attivi: copia tutto, chiude il vecchio come
  "rinnovato", apre nuovo per 1 anno

### Automatismi lato database

- Contratto salvato come "attivo" → 3 scadenze commerciali di rinnovo generate
  automaticamente (-90, -30, -7 giorni dalla data_fine)
- Impianti del contratto → scadenze contrattuali (MAN-ORD) attivate se non c'erano
- Contratto che diventa "rinnovato/scaduto/disdetto" → scadenze commerciali annullate
- Impianto rimosso dal contratto → sue scadenze contrattuali annullate
- Impianto senza contratto attivo → VEDE solo le scadenze normative (SPI, SPG, ADM)

## Verifiche dopo deploy

1. Vai in **Contratti** → vedi 8 righe DEMO con semafori diversi
2. Vai in **Scadenziario** → vedi le nuove scadenze commerciali di rinnovo
   (filtra per categoria "commerciale")
3. Vai in **Impianti** → gli impianti sotto contratto hanno `contratto_attivo_id` valorizzato
4. Crea un nuovo contratto, poi aprilo in modifica, cambia stato a "scaduto" → le scadenze
   commerciali spariscono e le MAN-ORD si fermano

## Note su integrazione con le altre pagine

- La pagina **Scadenziario** mostra già le scadenze contrattuali (sono comuni scadenze);
  per distinguere il tipo nella UI, al prossimo step aggiungo una colonna "Tipo"
  (normativa/contrattuale/commerciale) col filtro.
- La pagina **Interventi** si deve collegare al contratto per sapere se è "coperto
  dal canone" o "da fatturare": il campo `contratto_id` sugli interventi c'è già
  nel database, al prossimo step aggiungo il selettore nel form intervento.

## Prossimi step suggeriti

1. **Interventi collegati al contratto** (flag "coperto da contratto")
2. **Scadenziario con filtro tipo** (normativa/contrattuale/commerciale/manuale)
3. **Preventivi** (step 3 roadmap)
4. **Report commerciale** per cliente/anno con margine canoni vs costi
