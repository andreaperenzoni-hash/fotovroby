// Impianti fotovroby v2 - fasi, tecnici, componenti inline

let impianti = [];
let filtrati = [];
let clientiCache = [];
let tecniciCache = [];
let impiantoInEdit = null;
let impiantoScadenze = null;
let scadInEdit = null;

const FASE_HELP = {
  progettuale: 'Compila dati tecnici e progettista. Nessuna scadenza automatica.',
  autorizzazione: 'Pratiche in corso (GSE, distributore, Comune). Scadenze automatiche solo manuali.',
  attivo: 'Impianto in esercizio: SPI, SPG, ADM e manutenzione annuale si generano in automatico.',
  dismesso: 'Impianto fuori servizio. Le scadenze aperte vengono annullate.'
};

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  await Promise.all([caricaClienti(), caricaTecnici(), caricaImpianti()]);

  const params = new URLSearchParams(location.search);
  const preCli = params.get('cliente');
  if (preCli) document.getElementById('f-cliente').value = preCli;

  ['f-cliente','f-fase','f-fascia','f-install'].forEach(id => {
    document.getElementById(id).addEventListener('change', applicaFiltri);
  });
  document.getElementById('f-testo').addEventListener('input', debounce(applicaFiltri, 200));

  applicaFiltri();
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
})();

async function caricaClienti() {
  const { data } = await sb.from('fotovroby_clienti')
    .select('id, nome, tipo').eq('attivo', true).order('nome');
  clientiCache = data || [];
  fillSel('f-cliente', clientiCache, true);
  fillSel('mi-cliente', clientiCache, false);
}
async function caricaTecnici() {
  const { data } = await sb.from('fotovroby_tecnici')
    .select('id, nome, qualifica, azienda').eq('attivo', true).order('nome');
  tecniciCache = data || [];
}
function fillSel(id, items, includeAll) {
  const sel = document.getElementById(id);
  sel.innerHTML = includeAll ? '<option value="">Tutti</option>' : '<option value="">Seleziona...</option>';
  items.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.nome;
    sel.appendChild(o);
  });
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
  const fase = document.getElementById('f-fase').value;
  const fas = document.getElementById('f-fascia').value;
  const inst = document.getElementById('f-install').value;
  const txt = document.getElementById('f-testo').value.toLowerCase().trim();

  filtrati = impianti.filter(i => {
    if (cli && i.cliente_id !== cli) return false;
    if (fase && i.fase !== fase) return false;
    if (fas && i.fascia !== fas) return false;
    if (inst && i.tipo_installazione !== inst) return false;
    if (txt) {
      const hay = [i.codice, i.nome, i.comune, i.cliente?.nome,
                   i.pannello_marca, i.pannello_modello,
                   i.inverter_marca, i.inverter_modello].join(' ').toLowerCase();
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
      <td>${installLabel(i.tipo_installazione)}</td>
      <td>${i.connessione}</td>
      <td>${escapeHtml(i.comune || '–')}</td>
      <td>${faseBadge(i.fase)}</td>
      <td class="col-azioni">
        <button class="btn-icon" onclick='apriModifica("${i.id}")' title="Modifica">✎</button>
        <button class="btn-icon" onclick='apriScadenze("${i.id}")' title="Scadenze" ${i.fase !== 'attivo' ? 'disabled' : ''}>📋</button>
      </td>
    </tr>
  `).join('');
}

function badgeFascia(f) {
  if (!f) return '–';
  return f.startsWith('F1') ? 'F1' : f.startsWith('F2') ? 'F2' : 'F3';
}
function installLabel(x) {
  if (!x) return '<span class="text-muted">–</span>';
  return { tetto:'🏠', terra:'🌱', float:'💧', tracker:'☀️' }[x] + ' ' + x;
}
function faseBadge(f) {
  const map = {
    progettuale: '<span class="chip chip-info">Progetto</span>',
    autorizzazione: '<span class="chip chip-warn">Autorizz.</span>',
    attivo: '<span class="chip chip-success">Attivo</span>',
    dismesso: '<span class="chip">Dismesso</span>',
    in_costruzione: '<span class="chip chip-warn">In costr.</span>'
  };
  return map[f] || f;
}
function formatKw(n) { return Number(n).toLocaleString('it-IT', { maximumFractionDigits: 2 }); }

// FASI selettore --------------------------------------------------
function setFase(f) {
  document.getElementById('mi-fase').value = f;
  document.querySelectorAll('.fase-step').forEach(b => {
    b.classList.toggle('active', b.dataset.fase === f);
  });
  document.getElementById('mi-fase-help').textContent = FASE_HELP[f] || '';
}

// NUOVO / MODIFICA ------------------------------------------------
function svuotaForm() {
  ['mi-codice','mi-nome','mi-potenza','mi-indirizzo','mi-comune','mi-pod','mi-adm',
   'mi-monitoraggio','mi-note','mi-pannello-marca','mi-pannello-modello','mi-pannello-data',
   'mi-inverter-marca','mi-inverter-modello','mi-inverter-data',
   'mi-batteria-marca','mi-batteria-modello','mi-batteria-data','mi-allaccio']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('mi-cliente').value = '';
  document.getElementById('mi-installazione').value = '';
  document.getElementById('mi-connessione').value = 'BT';
  document.getElementById('mi-regime').value = 'parziale';
  setFase('progettuale');
}

function apriNuovo() {
  impiantoInEdit = null;
  document.getElementById('mi-titolo').textContent = 'Nuovo impianto';
  svuotaForm();
  document.getElementById('mi-allaccio').value = new Date().toISOString().slice(0, 10);
  document.getElementById('mi-elimina').style.display = 'none';
  document.getElementById('mi-tecnici-lista').innerHTML = '<div class="text-muted">Salva prima l\'impianto per assegnare tecnici</div>';
  anteprimaFascia();
  apriModal('modal-impianto');
}

async function apriModifica(id) {
  const i = impianti.find(x => x.id === id);
  if (!i) return;
  impiantoInEdit = id;
  document.getElementById('mi-titolo').textContent = 'Modifica impianto';
  document.getElementById('mi-codice').value = i.codice || '';
  document.getElementById('mi-cliente').value = i.cliente_id || '';
  document.getElementById('mi-nome').value = i.nome || '';
  document.getElementById('mi-potenza').value = i.potenza_kw || '';
  document.getElementById('mi-installazione').value = i.tipo_installazione || '';
  document.getElementById('mi-connessione').value = i.connessione || 'BT';
  document.getElementById('mi-regime').value = i.regime_cessione || 'parziale';
  document.getElementById('mi-allaccio').value = i.data_allaccio || '';
  document.getElementById('mi-pod').value = i.pod || '';
  document.getElementById('mi-adm').value = i.codice_ditta_adm || '';
  document.getElementById('mi-indirizzo').value = i.indirizzo || '';
  document.getElementById('mi-comune').value = i.comune || '';
  document.getElementById('mi-monitoraggio').value = i.portale_monitoraggio || '';
  document.getElementById('mi-note').value = i.note || '';
  document.getElementById('mi-pannello-marca').value = i.pannello_marca || '';
  document.getElementById('mi-pannello-modello').value = i.pannello_modello || '';
  document.getElementById('mi-pannello-data').value = i.pannello_data || '';
  document.getElementById('mi-inverter-marca').value = i.inverter_marca || '';
  document.getElementById('mi-inverter-modello').value = i.inverter_modello || '';
  document.getElementById('mi-inverter-data').value = i.inverter_data || '';
  document.getElementById('mi-batteria-marca').value = i.batteria_marca || '';
  document.getElementById('mi-batteria-modello').value = i.batteria_modello || '';
  document.getElementById('mi-batteria-data').value = i.batteria_data || '';
  setFase(i.fase || 'progettuale');
  document.getElementById('mi-elimina').style.display = '';
  anteprimaFascia();
  await caricaTecniciImpianto(id);
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
    tipo_installazione: document.getElementById('mi-installazione').value || null,
    connessione: document.getElementById('mi-connessione').value,
    regime_cessione: document.getElementById('mi-regime').value,
    data_allaccio: document.getElementById('mi-allaccio').value || null,
    pod: document.getElementById('mi-pod').value.trim() || null,
    codice_ditta_adm: document.getElementById('mi-adm').value.trim() || null,
    indirizzo: document.getElementById('mi-indirizzo').value.trim() || null,
    comune: document.getElementById('mi-comune').value.trim() || null,
    portale_monitoraggio: document.getElementById('mi-monitoraggio').value.trim() || null,
    fase: document.getElementById('mi-fase').value,
    note: document.getElementById('mi-note').value.trim() || null,
    pannello_marca: document.getElementById('mi-pannello-marca').value.trim() || null,
    pannello_modello: document.getElementById('mi-pannello-modello').value.trim() || null,
    pannello_data: document.getElementById('mi-pannello-data').value || null,
    inverter_marca: document.getElementById('mi-inverter-marca').value.trim() || null,
    inverter_modello: document.getElementById('mi-inverter-modello').value.trim() || null,
    inverter_data: document.getElementById('mi-inverter-data').value || null,
    batteria_marca: document.getElementById('mi-batteria-marca').value.trim() || null,
    batteria_modello: document.getElementById('mi-batteria-modello').value.trim() || null,
    batteria_data: document.getElementById('mi-batteria-data').value || null
  };
  if (!payload.nome) { alert('Nome obbligatorio'); return; }
  if (!payload.cliente_id) { alert('Cliente obbligatorio'); return; }
  if (!(payload.potenza_kw > 0)) { alert('Inserisci una potenza valida'); return; }

  if (!payload.codice) {
    const y = new Date().getFullYear();
    const { count } = await sb.from('fotovroby_impianti')
      .select('*', { count: 'exact', head: true }).like('codice', `FV-${y}-%`);
    payload.codice = `FV-${y}-${String((count || 0) + 1).padStart(3, '0')}`;
  }

  let result;
  if (impiantoInEdit) {
    result = await sb.from('fotovroby_impianti').update(payload).eq('id', impiantoInEdit).select().single();
  } else {
    result = await sb.from('fotovroby_impianti').insert(payload).select().single();
  }
  if (result.error) { alert('Errore: ' + result.error.message); return; }

  const nuovoId = result.data?.id;
  const faseAttivo = payload.fase === 'attivo';

  // Se nuovo impianto e fase=attivo, mostra feedback scadenze generate
  if (faseAttivo) {
    const { count } = await sb.from('fotovroby_scadenze')
      .select('*', { count: 'exact', head: true })
      .eq('impianto_id', nuovoId).in('stato', ['aperta','pianificata']);
    toast(`Impianto salvato. ${count || 0} scadenze automatiche generate.`);
  } else {
    toast('Impianto salvato (fase ' + payload.fase + ', nessuna scadenza automatica).');
  }

  chiudiModal('modal-impianto');
  await caricaImpianti();
  applicaFiltri();
}

async function eliminaImpianto() {
  if (!impiantoInEdit) return;
  if (!confirm('Eliminare l\'impianto? Verranno cancellate anche scadenze, interventi e tecnici assegnati.')) return;
  const { error } = await sb.from('fotovroby_impianti').delete().eq('id', impiantoInEdit);
  if (error) { alert('Errore: ' + error.message); return; }
  chiudiModal('modal-impianto');
  await caricaImpianti();
  applicaFiltri();
}

// TECNICI ASSEGNATI ----------------------------------------------
async function caricaTecniciImpianto(impId) {
  const { data, error } = await sb.from('fotovroby_impianto_tecnici')
    .select('*, tecnico:fotovroby_tecnici(id, nome, qualifica, azienda, telefono, email)')
    .eq('impianto_id', impId)
    .order('ruolo');
  const el = document.getElementById('mi-tecnici-lista');
  if (error) { el.innerHTML = '<div class="text-muted">Errore caricamento</div>'; return; }
  if (!data.length) { el.innerHTML = '<div class="text-muted">Nessun tecnico assegnato</div>'; return; }
  el.innerHTML = data.map(a => `
    <div class="tecnico-row">
      <div>
        <span class="chip chip-info">${escapeHtml(ruoloLabel(a.ruolo))}</span>
        <b>${escapeHtml(a.tecnico?.nome || '')}</b>
        ${a.tecnico?.qualifica ? '<span class="text-muted"> · ' + escapeHtml(a.tecnico.qualifica) + '</span>' : ''}
        ${a.tecnico?.azienda ? '<span class="text-muted"> · ' + escapeHtml(a.tecnico.azienda) + '</span>' : ''}
      </div>
      <div>
        ${a.tecnico?.telefono ? '<span class="text-muted">' + escapeHtml(a.tecnico.telefono) + '</span>' : ''}
        <button class="btn-icon" onclick="rimuoviTecnico('${a.id}')" title="Rimuovi">✕</button>
      </div>
    </div>
  `).join('');
}
function ruoloLabel(r) {
  return { progettista:'Progettista', installatore:'Installatore', direttore_lavori:'DL',
           taratura:'Taratura', manutenzione:'Manutenzione', altro:'Altro' }[r] || r;
}

function apriAggiungiTecnico() {
  if (!impiantoInEdit) {
    alert('Salva prima l\'impianto per assegnare tecnici.');
    return;
  }
  const sel = document.getElementById('ta-tecnico');
  sel.innerHTML = '<option value="">Seleziona tecnico...</option>';
  tecniciCache.forEach(t => {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = `${t.nome}${t.qualifica ? ' - ' + t.qualifica : ''}${t.azienda ? ' (' + t.azienda + ')' : ''}`;
    sel.appendChild(o);
  });
  document.getElementById('ta-ruolo').value = 'progettista';
  document.getElementById('ta-dal').value = new Date().toISOString().slice(0, 10);
  document.getElementById('ta-al').value = '';
  document.getElementById('ta-note').value = '';
  apriModal('modal-tec-assign');
}

async function confermaAssegnaTecnico() {
  const payload = {
    impianto_id: impiantoInEdit,
    tecnico_id: document.getElementById('ta-tecnico').value,
    ruolo: document.getElementById('ta-ruolo').value,
    dal: document.getElementById('ta-dal').value || null,
    al: document.getElementById('ta-al').value || null,
    note: document.getElementById('ta-note').value.trim() || null
  };
  if (!payload.tecnico_id) { alert('Seleziona un tecnico'); return; }
  const { error } = await sb.from('fotovroby_impianto_tecnici').insert(payload);
  if (error) { alert('Errore: ' + error.message); return; }
  chiudiModal('modal-tec-assign');
  await caricaTecniciImpianto(impiantoInEdit);
}

async function rimuoviTecnico(assegnazioneId) {
  if (!confirm('Rimuovere questa assegnazione?')) return;
  const { error } = await sb.from('fotovroby_impianto_tecnici').delete().eq('id', assegnazioneId);
  if (error) { alert('Errore: ' + error.message); return; }
  await caricaTecniciImpianto(impiantoInEdit);
}

// GESTIONE SCADENZE IMPIANTO -------------------------------------
async function apriScadenze(id) {
  const i = impianti.find(x => x.id === id);
  if (!i) return;
  impiantoScadenze = i;
  document.getElementById('ms-nome').textContent = i.codice || i.nome;
  document.getElementById('ms-info').innerHTML = `
    <b>${escapeHtml(i.nome)}</b> · ${escapeHtml(i.cliente?.nome || '')}<br>
    <span class="text-muted">${formatKw(i.potenza_kw)} kW · ${badgeFascia(i.fascia)} · ${i.connessione} · ${i.regime_cessione} · ${faseBadge(i.fase)}</span>
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
        <td><span class="badge ${sem}">${formatData(s.data_scadenza)}</span></td>
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

async function rigeneraScadenze() {
  if (!impiantoScadenze) return;
  const { data, error } = await sb.rpc('fotovroby_genera_scadenze', { p_impianto: impiantoScadenze.id });
  if (error) { alert('Errore: ' + error.message); return; }
  toast(`Rigenerate: ${data || 0} nuove scadenze create.`);
  await caricaScadenzeImpianto();
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

// UTILS -----------------------------------------------------------
function apriModal(id) { document.getElementById(id).classList.add('open'); }
function chiudiModal(id) { document.getElementById(id).classList.remove('open'); }
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}
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

window.setFase = setFase;
window.apriNuovo = apriNuovo;
window.apriModifica = apriModifica;
window.apriScadenze = apriScadenze;
window.salvaImpianto = salvaImpianto;
window.eliminaImpianto = eliminaImpianto;
window.anteprimaFascia = anteprimaFascia;
window.apriAggiungiTecnico = apriAggiungiTecnico;
window.confermaAssegnaTecnico = confermaAssegnaTecnico;
window.rimuoviTecnico = rimuoviTecnico;
window.rigeneraScadenze = rigeneraScadenze;
window.apriNuovaScadenza = apriNuovaScadenza;
window.apriModificaScad = apriModificaScad;
window.salvaScadenza = salvaScadenza;
window.eliminaScadenza = eliminaScadenza;
window.chiudiModal = chiudiModal;
