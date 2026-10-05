// Scadenziario fotovroby

let scadenze = [];       // dataset completo
let filtrate = [];       // dopo filtri
let sceltaCorrente = null; // scadenza su cui agisce la modale

(async () => {
  const auth = await requireAuth();
  if (!auth) return;

  await Promise.all([caricaClienti(), caricaScadenze()]);

  // Aggancia filtri
  ['f-semaforo','f-categoria','f-cliente','f-fascia'].forEach(id => {
    document.getElementById(id).addEventListener('change', applicaFiltri);
  });
  document.getElementById('f-testo').addEventListener('input', debounce(applicaFiltri, 200));

  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
})();

async function caricaClienti() {
  const { data } = await sb.from('fotovroby_clienti')
    .select('id, nome')
    .eq('attivo', true)
    .order('nome');
  const sel = document.getElementById('f-cliente');
  (data || []).forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.nome;
    sel.appendChild(o);
  });
}

async function caricaScadenze() {
  const { data, error } = await sb.from('fotovroby_v_scadenziario')
    .select('*')
    .order('data_scadenza', { ascending: true });
  if (error) { console.error(error); return; }
  scadenze = data || [];
  applicaFiltri();
}

function applicaFiltri() {
  const sem = document.getElementById('f-semaforo').value;
  const cat = document.getElementById('f-categoria').value;
  const cli = document.getElementById('f-cliente').value;
  const fas = document.getElementById('f-fascia').value;
  const txt = document.getElementById('f-testo').value.toLowerCase().trim();

  filtrate = scadenze.filter(s => {
    if (sem && s.semaforo !== sem) return false;
    if (cat && s.categoria !== cat) return false;
    if (cli && s.cliente_id !== cli) return false;
    if (fas && s.fascia !== fas) return false;
    if (txt) {
      const hay = (s.impianto + ' ' + s.cliente + ' ' + s.descrizione).toLowerCase();
      if (!hay.includes(txt)) return false;
    }
    return true;
  });

  // Contatori
  const cnt = { rosso: 0, giallo: 0, verde: 0 };
  filtrate.forEach(s => cnt[s.semaforo]++);
  document.getElementById('cnt-rosso').textContent  = `${cnt.rosso} scadute`;
  document.getElementById('cnt-giallo').textContent = `${cnt.giallo} in scadenza`;
  document.getElementById('cnt-verde').textContent  = `${cnt.verde} future`;
  document.getElementById('cnt-tot').textContent = filtrate.length;

  render();
}

function render() {
  const tbody = document.getElementById('tab-body');
  if (!filtrate.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Nessuna scadenza corrisponde ai filtri</td></tr>';
    return;
  }
  tbody.innerHTML = filtrate.map(s => {
    const azioni = s.fonte === 'regola'
      ? `<button class="btn-icon" onclick='apriPianifica(${JSON.stringify(s)})' title="Pianifica">📅</button>
         <button class="btn-icon" onclick='apriEseguito(${JSON.stringify(s)})' title="Segna eseguito">✔</button>
         <button class="btn-icon" onclick='apriModificaScadenza(${JSON.stringify(s)})' title="Modifica">✎</button>`
      : `<span class="text-muted">–</span>`;
    return `
      <tr>
        <td>
          <span class="badge ${s.semaforo}">${etichettaSemaforo(s)}</span>
          <div class="data-piccola">${formatData(s.data_scadenza)}</div>
        </td>
        <td>${escapeHtml(s.cliente)}<div class="text-muted">${escapeHtml(s.tipo_cliente)}</div></td>
        <td>${escapeHtml(s.impianto)}<div class="text-muted">${escapeHtml(s.fascia)} · ${s.connessione}</div></td>
        <td>${escapeHtml(s.descrizione)}</td>
        <td><span class="chip">${escapeHtml(s.categoria)}</span></td>
        <td>${statoLabel(s.stato)}</td>
        <td class="col-azioni">${azioni}</td>
      </tr>
    `;
  }).join('');
}

function etichettaSemaforo(s) {
  const g = s.giorni_mancanti;
  if (s.semaforo === 'rosso')  return `Scad. ${Math.abs(g)}gg fa`;
  if (s.semaforo === 'giallo') return `Fra ${g}gg`;
  return `Fra ${g}gg`;
}
function statoLabel(s) {
  if (s === 'pianificata') return '<span class="chip chip-info">Pianificata</span>';
  return '<span class="chip">Aperta</span>';
}

// PIANIFICA -------------------------------------------------------
function apriPianifica(s) {
  sceltaCorrente = s;
  document.getElementById('mp-info').innerHTML = `
    <div><b>${escapeHtml(s.impianto)}</b> · ${escapeHtml(s.cliente)}</div>
    <div class="text-muted">${escapeHtml(s.descrizione)} · scadenza ${formatData(s.data_scadenza)}</div>
  `;
  document.getElementById('mp-data').value = s.data_scadenza;
  document.getElementById('mp-tecnico').value = '';
  document.getElementById('mp-note').value = '';
  apriModal('modal-pianifica');
}

async function confermaPianifica() {
  const dataPianificata = document.getElementById('mp-data').value;
  const tecnico = document.getElementById('mp-tecnico').value.trim();
  const note = document.getElementById('mp-note').value.trim();
  if (!dataPianificata) { alert('Inserisci una data'); return; }

  // Aggiorna scadenza a "pianificata"
  const { error: e1 } = await sb.from('fotovroby_scadenze')
    .update({ stato: 'pianificata', note: note || null })
    .eq('id', sceltaCorrente.id);
  if (e1) { alert('Errore: ' + e1.message); return; }

  // Crea intervento programmato
  const { error: e2 } = await sb.from('fotovroby_interventi').insert({
    impianto_id: sceltaCorrente.impianto_id ||
                 (await risalIsciImpiantoId(sceltaCorrente)),
    scadenza_id: sceltaCorrente.id,
    tipo: 'ordinario',
    stato: 'programmato',
    data: dataPianificata,
    tecnico: tecnico || null,
    descrizione: sceltaCorrente.descrizione
  });
  if (e2) { alert('Errore: ' + e2.message); return; }

  chiudiModal('modal-pianifica');
  await caricaScadenze();
}

// SEGNA ESEGUITO --------------------------------------------------
function apriEseguito(s) {
  sceltaCorrente = s;
  document.getElementById('me-info').innerHTML = `
    <div><b>${escapeHtml(s.impianto)}</b> · ${escapeHtml(s.cliente)}</div>
    <div class="text-muted">${escapeHtml(s.descrizione)} · scadenza ${formatData(s.data_scadenza)}</div>
    <div class="text-muted">La scadenza si chiuderà e verrà generata la successiva.</div>
  `;
  document.getElementById('me-data').value = new Date().toISOString().slice(0, 10);
  document.getElementById('me-tecnico').value = '';
  document.getElementById('me-esito').value = 'ok';
  document.getElementById('me-ore').value = 1;
  document.getElementById('me-costo').value = 0;
  document.getElementById('me-descrizione').value = '';
  apriModal('modal-eseguito');
}

async function confermaEseguito() {
  const data = document.getElementById('me-data').value;
  const tecnico = document.getElementById('me-tecnico').value.trim();
  const esito = document.getElementById('me-esito').value;
  const ore = parseFloat(document.getElementById('me-ore').value) || 0;
  const costo = parseFloat(document.getElementById('me-costo').value) || 0;
  const descrizione = document.getElementById('me-descrizione').value.trim();
  if (!data) { alert('Inserisci la data'); return; }

  const impianto_id = sceltaCorrente.impianto_id
    || await risalIsciImpiantoId(sceltaCorrente);

  const { error } = await sb.from('fotovroby_interventi').insert({
    impianto_id,
    scadenza_id: sceltaCorrente.id,
    tipo: 'ordinario',
    stato: 'eseguito', // il trigger chiude la scadenza e genera la successiva
    data,
    tecnico: tecnico || null,
    descrizione: descrizione || sceltaCorrente.descrizione,
    esito,
    ore,
    costo_materiali: costo
  });
  if (error) { alert('Errore: ' + error.message); return; }

  chiudiModal('modal-eseguito');
  await caricaScadenze();
}

// MODIFICA / RIMANDA SCADENZA -------------------------------------
let scadEditCorrente = null;

function apriModificaScadenza(s) {
  scadEditCorrente = s;
  document.getElementById('mes-info').innerHTML = `
    <div><b>${escapeHtml(s.impianto)}</b> · ${escapeHtml(s.cliente)}</div>
    <div class="text-muted">${escapeHtml(s.descrizione)}</div>
  `;
  document.getElementById('mes-data').value = s.data_scadenza;
  document.getElementById('mes-preavviso').value = s.giorni_preavviso;
  document.getElementById('mes-stato').value = s.stato;
  document.getElementById('mes-note').value = '';
  apriModal('modal-edit-scad');
}

function rimanda(giorni) {
  const el = document.getElementById('mes-data');
  const d = new Date(el.value || new Date());
  d.setDate(d.getDate() + giorni);
  el.value = d.toISOString().slice(0, 10);
}

async function confermaModificaScad() {
  const payload = {
    data_scadenza: document.getElementById('mes-data').value,
    giorni_preavviso: parseInt(document.getElementById('mes-preavviso').value) || 30,
    stato: document.getElementById('mes-stato').value
  };
  const note = document.getElementById('mes-note').value.trim();
  if (note) payload.note = note;
  if (!payload.data_scadenza) { alert('Data obbligatoria'); return; }
  const { error } = await sb.from('fotovroby_scadenze')
    .update(payload).eq('id', scadEditCorrente.id);
  if (error) { alert('Errore: ' + error.message); return; }
  chiudiModal('modal-edit-scad');
  await caricaScadenze();
}

// La view non porta impianto_id direttamente: fallback via codice
async function risalIsciImpiantoId(s) {
  if (s.impianto_id) return s.impianto_id;
  const { data } = await sb.from('fotovroby_impianti')
    .select('id').eq('codice', s.impianto_codice).maybeSingle();
  return data?.id;
}

// UTILS -----------------------------------------------------------
function apriModal(id) { document.getElementById(id).classList.add('open'); }
function chiudiModal(id) { document.getElementById(id).classList.remove('open'); }
function resetFiltri() {
  ['f-semaforo','f-categoria','f-cliente','f-fascia'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('f-testo').value = '';
  applicaFiltri();
}
function formatData(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
  ));
}
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

window.resetFiltri = resetFiltri;
window.apriPianifica = apriPianifica;
window.apriEseguito = apriEseguito;
window.apriModificaScadenza = apriModificaScadenza;
window.confermaPianifica = confermaPianifica;
window.confermaEseguito = confermaEseguito;
window.confermaModificaScad = confermaModificaScad;
window.rimanda = rimanda;
window.chiudiModal = chiudiModal;
