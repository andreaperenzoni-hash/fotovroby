// Interventi fotovroby: ordinari, straordinari, guasti

let interventi = [];
let filtrati = [];
let impiantiCache = [];
let clientiCache = [];
let intInEdit = null;

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  await Promise.all([caricaImpianti(), caricaClienti(), caricaInterventi()]);

  ['f-tipo','f-stato','f-esito','f-cliente','f-dal','f-al'].forEach(id => {
    document.getElementById(id).addEventListener('change', applicaFiltri);
  });
  document.getElementById('f-testo').addEventListener('input', debounce(applicaFiltri, 200));

  applicaFiltri();
  aggiornaKPI();
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
})();

async function caricaImpianti() {
  const { data } = await sb.from('fotovroby_impianti')
    .select('id, codice, nome, cliente_id, cliente:fotovroby_clienti(nome)')
    .order('codice');
  impiantiCache = data || [];

  const sel = document.getElementById('mi-impianto');
  sel.innerHTML = '<option value="">Seleziona impianto...</option>';
  impiantiCache.forEach(i => {
    const o = document.createElement('option');
    o.value = i.id;
    o.textContent = `${i.codice || '–'} · ${i.nome} (${i.cliente?.nome || ''})`;
    sel.appendChild(o);
  });
}

async function caricaClienti() {
  const { data } = await sb.from('fotovroby_clienti')
    .select('id, nome').eq('attivo', true).order('nome');
  clientiCache = data || [];
  const sel = document.getElementById('f-cliente');
  clientiCache.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.nome;
    sel.appendChild(o);
  });
}

async function caricaInterventi() {
  const { data, error } = await sb.from('fotovroby_interventi')
    .select(`
      *,
      impianto:fotovroby_impianti(id, codice, nome, cliente_id,
        cliente:fotovroby_clienti(nome))
    `)
    .order('data', { ascending: false });
  if (error) { console.error(error); return; }
  interventi = data || [];
}

function applicaFiltri() {
  const tipo = document.getElementById('f-tipo').value;
  const stato = document.getElementById('f-stato').value;
  const esito = document.getElementById('f-esito').value;
  const cli = document.getElementById('f-cliente').value;
  const dal = document.getElementById('f-dal').value;
  const al = document.getElementById('f-al').value;
  const txt = document.getElementById('f-testo').value.toLowerCase().trim();

  filtrati = interventi.filter(i => {
    if (tipo && i.tipo !== tipo) return false;
    if (stato && i.stato !== stato) return false;
    if (esito && i.esito !== esito) return false;
    if (cli && i.impianto?.cliente_id !== cli) return false;
    if (dal && i.data < dal) return false;
    if (al && i.data > al) return false;
    if (txt) {
      const hay = [i.descrizione, i.tecnico, i.note,
                   i.impianto?.nome, i.impianto?.codice, i.impianto?.cliente?.nome]
                  .join(' ').toLowerCase();
      if (!hay.includes(txt)) return false;
    }
    return true;
  });
  document.getElementById('cnt-tot').textContent = filtrati.length;
  render();
}

function aggiornaKPI() {
  const oggi = new Date().toISOString().slice(0, 10);
  const meseStr = oggi.slice(0, 7);
  const annoStr = oggi.slice(0, 4);

  let prog = 0, mese = 0, anno = 0, ore = 0, costo = 0, anomalie = 0;
  interventi.forEach(i => {
    if (i.stato === 'programmato' && i.data >= oggi) prog++;
    if (i.stato === 'eseguito') {
      if (i.data.startsWith(meseStr)) mese++;
      if (i.data.startsWith(annoStr)) {
        anno++;
        ore += Number(i.ore || 0);
        costo += Number(i.costo_materiali || 0);
      }
      if (['anomalia','da_ripetere'].includes(i.esito)) anomalie++;
    }
  });
  document.getElementById('kpi-prog').textContent = prog;
  document.getElementById('kpi-mese').textContent = mese;
  document.getElementById('kpi-anno').textContent = anno;
  document.getElementById('kpi-ore').textContent = ore.toLocaleString('it-IT', { maximumFractionDigits: 1 });
  document.getElementById('kpi-costo').textContent = costo.toLocaleString('it-IT', { maximumFractionDigits: 2 }) + ' €';
  document.getElementById('kpi-anomalie').textContent = anomalie;
}

function render() {
  const tbody = document.getElementById('tab-body');
  if (!filtrati.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="loading">Nessun intervento</td></tr>';
    return;
  }
  tbody.innerHTML = filtrati.map(i => `
    <tr>
      <td>${formatData(i.data)}</td>
      <td>${tipoBadge(i.tipo)}</td>
      <td>
        <b>${escapeHtml(i.impianto?.codice || '–')}</b>
        <div class="text-muted">${escapeHtml(i.impianto?.nome || '')}</div>
      </td>
      <td>${escapeHtml(i.impianto?.cliente?.nome || '')}</td>
      <td class="col-desc">${escapeHtml(i.descrizione || '–')}</td>
      <td>${escapeHtml(i.tecnico || '–')}</td>
      <td>${i.ore || 0}</td>
      <td>${Number(i.costo_materiali || 0).toLocaleString('it-IT', { maximumFractionDigits: 2 })} €</td>
      <td>${statoBadge(i.stato)}</td>
      <td>${esitoBadge(i.esito)}</td>
      <td class="col-azioni">
        <button class="btn-icon" onclick='apriModifica("${i.id}")' title="Modifica">✎</button>
      </td>
    </tr>
  `).join('');
}

function tipoBadge(t) {
  if (t === 'ordinario') return '<span class="chip">Ordinario</span>';
  if (t === 'straordinario') return '<span class="chip chip-info">Straordinario</span>';
  if (t === 'guasto') return '<span class="chip chip-danger">Guasto</span>';
  return t;
}
function statoBadge(s) {
  if (s === 'programmato') return '<span class="chip chip-info">Programmato</span>';
  if (s === 'eseguito') return '<span class="chip chip-success">Eseguito</span>';
  if (s === 'annullato') return '<span class="chip chip-warn">Annullato</span>';
  return s || '–';
}
function esitoBadge(e) {
  if (!e) return '<span class="text-muted">–</span>';
  const map = {
    ok: '<span class="chip chip-success">OK</span>',
    ok_con_note: '<span class="chip chip-info">OK con note</span>',
    anomalia: '<span class="chip chip-danger">Anomalia</span>',
    da_ripetere: '<span class="chip chip-warn">Da ripetere</span>'
  };
  return map[e] || e;
}

// NUOVO / MODIFICA ------------------------------------------------
function apriNuovo(tipo) {
  intInEdit = null;
  document.getElementById('mi-titolo').textContent = tipo === 'guasto'
    ? 'Nuovo guasto' : tipo === 'straordinario'
    ? 'Nuovo intervento straordinario' : 'Nuovo intervento';
  document.getElementById('mi-impianto').value = '';
  document.getElementById('mi-tipo').value = tipo || 'straordinario';
  document.getElementById('mi-data').value = new Date().toISOString().slice(0, 10);
  document.getElementById('mi-stato').value = tipo === 'guasto' ? 'eseguito' : 'programmato';
  document.getElementById('mi-descrizione').value = '';
  document.getElementById('mi-tecnico').value = '';
  document.getElementById('mi-ore').value = 0;
  document.getElementById('mi-costo').value = 0;
  document.getElementById('mi-esito').value = tipo === 'guasto' ? 'anomalia' : '';
  document.getElementById('mi-note').value = '';
  document.getElementById('mi-elimina').style.display = 'none';
  apriModal('modal-int');
}

function apriModifica(id) {
  const i = interventi.find(x => x.id === id);
  if (!i) return;
  intInEdit = id;
  document.getElementById('mi-titolo').textContent = 'Modifica intervento';
  document.getElementById('mi-impianto').value = i.impianto?.id || '';
  document.getElementById('mi-tipo').value = i.tipo;
  document.getElementById('mi-data').value = i.data;
  document.getElementById('mi-stato').value = i.stato;
  document.getElementById('mi-descrizione').value = i.descrizione || '';
  document.getElementById('mi-tecnico').value = i.tecnico || '';
  document.getElementById('mi-ore').value = i.ore || 0;
  document.getElementById('mi-costo').value = i.costo_materiali || 0;
  document.getElementById('mi-esito').value = i.esito || '';
  document.getElementById('mi-note').value = i.note || '';
  document.getElementById('mi-elimina').style.display = '';
  apriModal('modal-int');
}

async function salvaIntervento() {
  const payload = {
    impianto_id: document.getElementById('mi-impianto').value,
    tipo: document.getElementById('mi-tipo').value,
    data: document.getElementById('mi-data').value,
    stato: document.getElementById('mi-stato').value,
    descrizione: document.getElementById('mi-descrizione').value.trim() || null,
    tecnico: document.getElementById('mi-tecnico').value.trim() || null,
    ore: parseFloat(document.getElementById('mi-ore').value) || 0,
    costo_materiali: parseFloat(document.getElementById('mi-costo').value) || 0,
    esito: document.getElementById('mi-esito').value || null,
    note: document.getElementById('mi-note').value.trim() || null
  };
  if (!payload.impianto_id) { alert('Impianto obbligatorio'); return; }
  if (!payload.data) { alert('Data obbligatoria'); return; }
  if (!payload.descrizione) { alert('Descrizione obbligatoria'); return; }

  const q = intInEdit
    ? sb.from('fotovroby_interventi').update(payload).eq('id', intInEdit)
    : sb.from('fotovroby_interventi').insert(payload);
  const { error } = await q;
  if (error) { alert('Errore: ' + error.message); return; }
  chiudiModal('modal-int');
  await caricaInterventi();
  applicaFiltri();
  aggiornaKPI();
}

async function eliminaIntervento() {
  if (!intInEdit) return;
  if (!confirm('Eliminare questo intervento?')) return;
  const { error } = await sb.from('fotovroby_interventi').delete().eq('id', intInEdit);
  if (error) { alert('Errore: ' + error.message); return; }
  chiudiModal('modal-int');
  await caricaInterventi();
  applicaFiltri();
  aggiornaKPI();
}

// UTILS
function apriModal(id) { document.getElementById(id).classList.add('open'); }
function chiudiModal(id) { document.getElementById(id).classList.remove('open'); }
function resetFiltri() {
  ['f-tipo','f-stato','f-esito','f-cliente','f-dal','f-al'].forEach(i => document.getElementById(i).value = '');
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

window.apriNuovo = apriNuovo;
window.apriModifica = apriModifica;
window.salvaIntervento = salvaIntervento;
window.eliminaIntervento = eliminaIntervento;
window.resetFiltri = resetFiltri;
window.chiudiModal = chiudiModal;
