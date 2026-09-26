// Anagrafica impianti + gestione scadenze fotovroby

let impianti = [];
let filtrati = [];
let clientiCache = [];
let impiantoInEdit = null;
let impiantoScadenze = null; // impianto attuale in modale scadenze
let scadInEdit = null;

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  await Promise.all([caricaClienti(), caricaImpianti()]);

  // Filtro cliente da querystring
  const params = new URLSearchParams(location.search);
  const preCli = params.get('cliente');
  if (preCli) document.getElementById('f-cliente').value = preCli;

  ['f-cliente','f-fascia','f-conn','f-stato'].forEach(id => {
    document.getElementById(id).addEventListener('change', applicaFiltri);
  });
  document.getElementById('f-testo').addEventListener('input', debounce(applicaFiltri, 200));

  applicaFiltri();
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
})();

async function caricaClienti() {
  const { data } = await sb.from('fotovroby_clienti')
    .select('id, nome, tipo')
    .eq('attivo', true)
    .order('nome');
  clientiCache = data || [];

  const fillSelect = (id, includeAll) => {
    const sel = document.getElementById(id);
    sel.innerHTML = includeAll ? '<option value="">Tutti</option>' : '<option value="">Seleziona...</option>';
    clientiCache.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.nome;
      sel.appendChild(o);
    });
  };
  fillSelect('f-cliente', true);
  fillSelect('mi-cliente', false);
}

async function caricaImpianti() {
  const { data, error } = await sb.from('fotovroby_impianti')
    .select('*, cliente:fotovroby_clienti(id, nome, tipo)')
    .order('codice', { ascending: true, nullsFirst: false });
  if (error) { console.error(error); return; }
  impianti = data || [];
}

function applicaFiltri() {
  const cli = document.getElementById('f-cliente').value;
  const fas = document.getElementById('f-fascia').value;
  const con = document.getElementById('f-conn').value;
  const sta = document.getElementById('f-stato').value;
  const txt = document.getElementById('f-testo').value.toLowerCase().trim();

  filtrati = impianti.filter(i => {
    if (cli && i.cliente_id !== cli) return false;
    if (fas && i.fascia !== fas) return false;
    if (con && i.connessione !== con) return false;
    if (sta && i.stato !== sta) return false;
    if (txt) {
      const hay = [i.codice, i.nome, i.comune, i.cliente?.nome].join(' ').toLowerCase();
      if (!hay.includes(txt)) return false;
    }
    return true;
  });
  document.getElementById('cnt-tot').textContent = filtrati.length;
  render();
}

function render() {
  const tbody = document.getElementById('tab-body');
  if (!filtrati.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Nessun impianto</td></tr>';
    return;
  }
  tbody.innerHTML = filtrati.map(i => `
    <tr>
      <td><b>${escapeHtml(i.codice || '–')}</b></td>
      <td>${escapeHtml(i.nome)}</td>
      <td>${escapeHtml(i.cliente?.nome || '')}</td>
      <td>${formatKw(i.potenza_kw)} kW</td>
      <td><span class="chip">${badgeFascia(i.fascia)}</span></td>
      <td>${i.connessione}</td>
      <td>${i.regime_cessione}</td>
      <td>${escapeHtml(i.comune || '–')}</td>
      <td>${statoImpianto(i.stato)}</td>
      <td class="col-azioni">
        <button class="btn-icon" onclick='apriModifica("${i.id}")' title="Modifica">✎</button>
        <button class="btn-icon" onclick='apriScadenze("${i.id}")' title="Scadenze">📋</button>
      </td>
    </tr>
  `).join('');
}

function badgeFascia(f) {
  if (!f) return '–';
  return f.startsWith('F1') ? 'F1' : f.startsWith('F2') ? 'F2' : 'F3';
}
function statoImpianto(s) {
  if (s === 'attivo') return '<span class="chip chip-success">Attivo</span>';
  if (s === 'dismesso') return '<span class="chip chip-warn">Dismesso</span>';
  return '<span class="chip">In costr.</span>';
}
function formatKw(n) { return Number(n).toLocaleString('it-IT', { maximumFractionDigits: 2 }); }

// NUOVO / MODIFICA -----------------------------------------------
function apriNuovo() {
  impiantoInEdit = null;
  document.getElementById('mi-titolo').textContent = 'Nuovo impianto';
  document.getElementById('mi-codice').value = '';
  document.getElementById('mi-cliente').value = '';
  document.getElementById('mi-nome').value = '';
  document.getElementById('mi-potenza').value = '';
  document.getElementById('mi-connessione').value = 'BT';
  document.getElementById('mi-regime').value = 'parziale';
  document.getElementById('mi-allaccio').value = new Date().toISOString().slice(0, 10);
  document.getElementById('mi-adm').value = '';
  document.getElementById('mi-indirizzo').value = '';
  document.getElementById('mi-comune').value = '';
  document.getElementById('mi-monitoraggio').value = '';
  document.getElementById('mi-stato').value = 'attivo';
  document.getElementById('mi-note').value = '';
  document.getElementById('mi-elimina').style.display = 'none';
  document.getElementById('mi-scadenze-info').style.display = 'none';
  anteprimaFascia();
  apriModal('modal-impianto');
}

function apriModifica(id) {
  const i = impianti.find(x => x.id === id);
  if (!i) return;
  impiantoInEdit = id;
  document.getElementById('mi-titolo').textContent = 'Modifica impianto';
  document.getElementById('mi-codice').value = i.codice || '';
  document.getElementById('mi-cliente').value = i.cliente_id || '';
  document.getElementById('mi-nome').value = i.nome || '';
  document.getElementById('mi-potenza').value = i.potenza_kw || '';
  document.getElementById('mi-connessione').value = i.connessione || 'BT';
  document.getElementById('mi-regime').value = i.regime_cessione || 'parziale';
  document.getElementById('mi-allaccio').value = i.data_allaccio || '';
  document.getElementById('mi-adm').value = i.codice_ditta_adm || '';
  document.getElementById('mi-indirizzo').value = i.indirizzo || '';
  document.getElementById('mi-comune').value = i.comune || '';
  document.getElementById('mi-monitoraggio').value = i.portale_monitoraggio || '';
  document.getElementById('mi-stato').value = i.stato || 'attivo';
  document.getElementById('mi-note').value = i.note || '';
  document.getElementById('mi-elimina').style.display = '';
  anteprimaFascia();
  apriModal('modal-impianto');
}

function anteprimaFascia() {
  const p = parseFloat(document.getElementById('mi-potenza').value);
  const el = document.getElementById('mi-fascia-preview');
  if (isNaN(p) || p <= 0) { el.textContent = '—'; el.className = 'fascia-preview'; return; }
  if (p <= 11.08) { el.textContent = 'F1 · fino a 11,08 kW'; el.className = 'fascia-preview fascia-f1'; }
  else if (p <= 20) { el.textContent = 'F2 · 11,08–20 kW'; el.className = 'fascia-preview fascia-f2'; }
  else { el.textContent = 'F3 · oltre 20 kW'; el.className = 'fascia-preview fascia-f3'; }
}

async function salvaImpianto() {
  const payload = {
    codice: document.getElementById('mi-codice').value.trim() || null,
    cliente_id: document.getElementById('mi-cliente').value,
    nome: document.getElementById('mi-nome').value.trim(),
    potenza_kw: parseFloat(document.getElementById('mi-potenza').value),
    connessione: document.getElementById('mi-connessione').value,
    regime_cessione: document.getElementById('mi-regime').value,
    data_allaccio: document.getElementById('mi-allaccio').value || null,
    codice_ditta_adm: document.getElementById('mi-adm').value.trim() || null,
    indirizzo: document.getElementById('mi-indirizzo').value.trim() || null,
    comune: document.getElementById('mi-comune').value.trim() || null,
    portale_monitoraggio: document.getElementById('mi-monitoraggio').value.trim() || null,
    stato: document.getElementById('mi-stato').value,
    note: document.getElementById('mi-note').value.trim() || null
  };
  if (!payload.nome) { alert('Nome obbligatorio'); return; }
  if (!payload.cliente_id) { alert('Cliente obbligatorio'); return; }
  if (!(payload.potenza_kw > 0)) { alert('Inserisci una potenza valida'); return; }

  // Genera codice se vuoto
  if (!payload.codice) {
    const y = new Date().getFullYear();
    const { count } = await sb.from('fotovroby_impianti')
      .select('*', { count: 'exact', head: true })
      .like('codice', `FV-${y}-%`);
    payload.codice = `FV-${y}-${String((count || 0) + 1).padStart(3, '0')}`;
  }

  const q = impiantoInEdit
    ? sb.from('fotovroby_impianti').update(payload).eq('id', impiantoInEdit)
    : sb.from('fotovroby_impianti').insert(payload);
  const { error } = await q;
  if (error) { alert('Errore: ' + error.message); return; }
  chiudiModal('modal-impianto');
  await caricaImpianti();
  applicaFiltri();
}

async function eliminaImpianto() {
  if (!impiantoInEdit) return;
  if (!confirm('Eliminare l\'impianto? Verranno cancellate anche tutte le sue scadenze e interventi.')) return;
  const { error } = await sb.from('fotovroby_impianti').delete().eq('id', impiantoInEdit);
  if (error) { alert('Errore: ' + error.message); return; }
  chiudiModal('modal-impianto');
  await caricaImpianti();
  applicaFiltri();
}

// GESTIONE SCADENZE PER IMPIANTO ---------------------------------
async function apriScadenze(id) {
  const i = impianti.find(x => x.id === id);
  if (!i) return;
  impiantoScadenze = i;
  document.getElementById('ms-nome').textContent = i.codice || i.nome;
  document.getElementById('ms-info').innerHTML = `
    <b>${escapeHtml(i.nome)}</b> · ${escapeHtml(i.cliente?.nome || '')}<br>
    <span class="text-muted">${formatKw(i.potenza_kw)} kW · ${badgeFascia(i.fascia)} · ${i.connessione} · ${i.regime_cessione}</span>
  `;
  await caricaScadenzeImpianto();
  apriModal('modal-scadenze');
}

async function caricaScadenzeImpianto() {
  const { data, error } = await sb.from('fotovroby_scadenze')
    .select('*, regola:fotovroby_regole(codice, descrizione)')
    .eq('impianto_id', impiantoScadenze.id)
    .in('stato', ['aperta','pianificata'])
    .order('data_scadenza');
  if (error) { console.error(error); return; }
  const tbody = document.getElementById('ms-lista');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Nessuna scadenza attiva</td></tr>';
    return;
  }
  const oggi = new Date().toISOString().slice(0, 10);
  tbody.innerHTML = data.map(s => {
    const sem = s.data_scadenza < oggi ? 'rosso' :
                s.data_scadenza <= addDays(oggi, s.giorni_preavviso) ? 'giallo' : 'verde';
    const origine = s.regola_id
      ? `<span class="chip chip-info" title="${escapeHtml(s.regola?.descrizione || '')}">${escapeHtml(s.regola?.codice || 'auto')}</span>`
      : '<span class="chip">manuale</span>';
    return `
      <tr>
        <td>
          <span class="badge ${sem}">${formatData(s.data_scadenza)}</span>
        </td>
        <td>${escapeHtml(s.descrizione)}</td>
        <td>${escapeHtml(s.categoria)}</td>
        <td>${s.stato === 'pianificata' ? '<span class="chip chip-info">Pianificata</span>' : '<span class="chip">Aperta</span>'}</td>
        <td>${origine}</td>
        <td class="col-azioni">
          <button class="btn-icon" onclick='apriModificaScad(${JSON.stringify(s)})' title="Modifica">✎</button>
        </td>
      </tr>
    `;
  }).join('');
}

function apriNuovaScadenza() {
  scadInEdit = null;
  document.getElementById('mse-titolo').textContent = 'Nuova scadenza';
  document.getElementById('mse-desc').value = '';
  document.getElementById('mse-cat').value = 'manutenzione';
  document.getElementById('mse-data').value = '';
  document.getElementById('mse-preavviso').value = 30;
  document.getElementById('mse-stato').value = 'aperta';
  document.getElementById('mse-note').value = '';
  document.getElementById('mse-elimina').style.display = 'none';
  apriModal('modal-scad-edit');
}

function apriModificaScad(s) {
  scadInEdit = s;
  document.getElementById('mse-titolo').textContent = 'Modifica scadenza';
  document.getElementById('mse-desc').value = s.descrizione || '';
  document.getElementById('mse-cat').value = s.categoria || 'manutenzione';
  document.getElementById('mse-data').value = s.data_scadenza || '';
  document.getElementById('mse-preavviso').value = s.giorni_preavviso || 30;
  document.getElementById('mse-stato').value = s.stato || 'aperta';
  document.getElementById('mse-note').value = s.note || '';
  document.getElementById('mse-elimina').style.display = '';
  apriModal('modal-scad-edit');
}

async function salvaScadenza() {
  const payload = {
    descrizione: document.getElementById('mse-desc').value.trim(),
    categoria: document.getElementById('mse-cat').value,
    data_scadenza: document.getElementById('mse-data').value,
    giorni_preavviso: parseInt(document.getElementById('mse-preavviso').value) || 30,
    stato: document.getElementById('mse-stato').value,
    note: document.getElementById('mse-note').value.trim() || null
  };
  if (!payload.descrizione) { alert('Descrizione obbligatoria'); return; }
  if (!payload.data_scadenza) { alert('Data obbligatoria'); return; }

  let q;
  if (scadInEdit) {
    q = sb.from('fotovroby_scadenze').update(payload).eq('id', scadInEdit.id);
  } else {
    payload.impianto_id = impiantoScadenze.id;
    q = sb.from('fotovroby_scadenze').insert(payload);
  }
  const { error } = await q;
  if (error) { alert('Errore: ' + error.message); return; }
  chiudiModal('modal-scad-edit');
  await caricaScadenzeImpianto();
}

async function eliminaScadenza() {
  if (!scadInEdit) return;
  if (!confirm('Eliminare questa scadenza?')) return;
  const { error } = await sb.from('fotovroby_scadenze').delete().eq('id', scadInEdit.id);
  if (error) { alert('Errore: ' + error.message); return; }
  chiudiModal('modal-scad-edit');
  await caricaScadenzeImpianto();
}

// UTILS
function apriModal(id) { document.getElementById(id).classList.add('open'); }
function chiudiModal(id) { document.getElementById(id).classList.remove('open'); }
function formatData(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function addDays(iso, n) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
  ));
}
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

window.apriNuovo = apriNuovo;
window.apriModifica = apriModifica;
window.apriScadenze = apriScadenze;
window.salvaImpianto = salvaImpianto;
window.eliminaImpianto = eliminaImpianto;
window.anteprimaFascia = anteprimaFascia;
window.apriNuovaScadenza = apriNuovaScadenza;
window.apriModificaScad = apriModificaScad;
window.salvaScadenza = salvaScadenza;
window.eliminaScadenza = eliminaScadenza;
window.chiudiModal = chiudiModal;
