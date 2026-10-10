// Contratti di manutenzione fotovroby

let contratti = [];
let filtrati = [];
let clientiCache = [];
let impiantiCliente = [];
let impiantiContratto = new Set();   // id impianti selezionati nel form
let contrattoInEdit = null;

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  await Promise.all([caricaClienti(), caricaContratti(), caricaImpiantiSenzaContratto()]);
  ['f-stato','f-semaforo','f-cliente'].forEach(id =>
    document.getElementById(id).addEventListener('change', applicaFiltri));
  document.getElementById('f-testo').addEventListener('input', debounce(applicaFiltri, 200));
  applicaFiltri();
  aggiornaKPI();
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
})();

async function caricaClienti() {
  const { data } = await sb.from('fotovroby_clienti')
    .select('id, nome, tipo').eq('attivo', true).order('nome');
  clientiCache = data || [];
  // riempi filtro
  const sel = document.getElementById('f-cliente');
  clientiCache.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.nome;
    sel.appendChild(o);
  });
  // riempi modale
  const sel2 = document.getElementById('mc-cliente');
  sel2.innerHTML = '<option value="">Seleziona cliente...</option>';
  clientiCache.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.nome;
    sel2.appendChild(o);
  });
}

async function caricaContratti() {
  const { data, error } = await sb.from('fotovroby_v_contratti_riepilogo')
    .select('*')
    .order('data_fine');
  if (error) { console.error(error); return; }
  contratti = data || [];
}

async function caricaImpiantiSenzaContratto() {
  const { data } = await sb.from('fotovroby_v_impianti_riepilogo')
    .select('id, contratto_attivo_id')
    .eq('fase', 'attivo');
  const senza = (data || []).filter(i => !i.contratto_attivo_id).length;
  document.getElementById('kpi-nocontratto').textContent = senza;
}

function applicaFiltri() {
  const stato = document.getElementById('f-stato').value;
  const sem = document.getElementById('f-semaforo').value;
  const cli = document.getElementById('f-cliente').value;
  const txt = document.getElementById('f-testo').value.toLowerCase().trim();

  filtrati = contratti.filter(c => {
    if (stato && c.stato !== stato) return false;
    if (sem && c.semaforo_rinnovo !== sem) return false;
    if (cli && c.cliente_id !== cli) return false;
    if (txt) {
      const hay = [c.numero, c.oggetto, c.note, c.cliente_nome, c.commerciale_riferimento].join(' ').toLowerCase();
      if (!hay.includes(txt)) return false;
    }
    return true;
  });
  document.getElementById('cnt-tot').textContent = filtrati.length;
  render();
}

function aggiornaKPI() {
  const oggi = new Date().toISOString().slice(0,10);
  const attivi = contratti.filter(c => c.stato === 'attivo'
    && c.data_inizio <= oggi && c.data_fine >= oggi);
  const in90 = attivi.filter(c => c.giorni_a_scadenza <= 90 && c.giorni_a_scadenza >= 0);
  const scaduti = contratti.filter(c => c.stato === 'scaduto'
    || (c.stato === 'attivo' && c.data_fine < oggi));
  const canoni = attivi.reduce((s,c) => s + Number(c.canone_annuo || 0), 0);
  const kw = attivi.reduce((s,c) => s + Number(c.kw_totali || 0), 0);

  document.getElementById('kpi-attivi').textContent = attivi.length;
  document.getElementById('kpi-90').textContent = in90.length;
  document.getElementById('kpi-scaduti').textContent = scaduti.length;
  document.getElementById('kpi-canoni').textContent = canoni.toLocaleString('it-IT', {maximumFractionDigits: 0}) + ' €';
  document.getElementById('kpi-kw').textContent = kw.toLocaleString('it-IT', {maximumFractionDigits: 1});
}

function render() {
  const tbody = document.getElementById('tab-body');
  if (!filtrati.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Nessun contratto</td></tr>';
    return;
  }
  tbody.innerHTML = filtrati.map(c => `
    <tr>
      <td><b>${escapeHtml(c.numero || '–')}</b>
          ${c.contratto_padre_id ? '<span class="chip chip-info" title="Rinnovo di contratto precedente">↻</span>' : ''}
      </td>
      <td>${escapeHtml(c.cliente_nome)}</td>
      <td>${escapeHtml(c.oggetto || '–')}</td>
      <td><span class="chip">${c.n_impianti}</span> ${formatKw(c.kw_totali)} kW</td>
      <td>${c.canone_annuo ? Number(c.canone_annuo).toLocaleString('it-IT') + ' €' : '<span class="text-muted">–</span>'}</td>
      <td>${c.visite_anno || '–'}</td>
      <td class="text-muted">${formatData(c.data_inizio)}<br>→ ${formatData(c.data_fine)}</td>
      <td>${scadeTraLabel(c)}</td>
      <td>${statoBadge(c)}</td>
      <td class="col-azioni">
        <button class="btn-icon" onclick='apriModifica("${c.id}")' title="Modifica">✎</button>
        ${c.stato === 'attivo' && c.giorni_a_scadenza <= 180
          ? `<button class="btn-icon" onclick='rinnovaRapido("${c.id}")' title="Rinnova">↻</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function scadeTraLabel(c) {
  const g = c.giorni_a_scadenza;
  if (g === null || g === undefined) return '<span class="text-muted">–</span>';
  if (g < 0) return `<span class="badge rosso">Scad. ${Math.abs(g)}gg fa</span>`;
  if (g <= 30) return `<span class="badge rosso">${g}gg</span>`;
  if (g <= 90) return `<span class="badge giallo">${g}gg</span>`;
  if (g <= 365) return `<span class="badge verde">${g}gg</span>`;
  const anni = Math.floor(g / 365);
  return `<span class="badge verde">${anni} ann${anni === 1 ? 'o' : 'i'}</span>`;
}

function statoBadge(c) {
  const map = {
    bozza: '<span class="chip">Bozza</span>',
    attivo: '<span class="chip chip-success">Attivo</span>',
    in_rinnovo: '<span class="chip chip-warn">In rinnovo</span>',
    rinnovato: '<span class="chip chip-info">Rinnovato</span>',
    scaduto: '<span class="chip chip-danger">Scaduto</span>',
    disdetto: '<span class="chip">Disdetto</span>'
  };
  return map[c.stato] || c.stato;
}

// NUOVO/MODIFICA -------------------------------------------------
function apriNuovo() {
  contrattoInEdit = null;
  document.getElementById('mc-titolo').textContent = 'Nuovo contratto';
  document.getElementById('mc-numero').value = '';
  document.getElementById('mc-stato').value = 'attivo';
  document.getElementById('mc-cliente').value = '';
  document.getElementById('mc-oggetto').value = '';
  document.getElementById('mc-firma').value = new Date().toISOString().slice(0,10);
  document.getElementById('mc-tipologia').value = 'base';
  document.getElementById('mc-inizio').value = new Date().toISOString().slice(0,10);
  const unAnno = new Date();
  unAnno.setFullYear(unAnno.getFullYear() + 1);
  document.getElementById('mc-fine').value = unAnno.toISOString().slice(0,10);
  document.getElementById('mc-canone').value = '';
  document.getElementById('mc-visite').value = 1;
  document.getElementById('mc-preavviso').value = 3;
  document.getElementById('mc-rinnovo-auto').checked = false;
  document.getElementById('mc-commerciale').value = '';
  document.getElementById('mc-note').value = '';
  document.getElementById('mc-impianti-lista').innerHTML = '<div class="text-muted">Seleziona prima un cliente</div>';
  document.getElementById('mc-info-scadenze').style.display = 'block';
  document.getElementById('mc-elimina').style.display = 'none';
  document.getElementById('mc-rinnova').style.display = 'none';
  impiantiContratto.clear();
  apriModal('modal-contratto');
}

async function apriModifica(id) {
  const { data: c, error } = await sb.from('fotovroby_contratti').select('*').eq('id', id).single();
  if (error) { alert('Errore: ' + error.message); return; }
  contrattoInEdit = id;
  document.getElementById('mc-titolo').textContent = 'Modifica contratto';
  document.getElementById('mc-numero').value = c.numero || '';
  document.getElementById('mc-stato').value = c.stato;
  document.getElementById('mc-cliente').value = c.cliente_id;
  document.getElementById('mc-oggetto').value = c.oggetto || '';
  document.getElementById('mc-firma').value = c.data_firma || '';
  document.getElementById('mc-tipologia').value = c.tipologia || 'base';
  document.getElementById('mc-inizio').value = c.data_inizio;
  document.getElementById('mc-fine').value = c.data_fine;
  document.getElementById('mc-canone').value = c.canone_annuo || '';
  document.getElementById('mc-visite').value = c.visite_anno || 1;
  document.getElementById('mc-preavviso').value = c.mesi_preavviso_disdetta || 3;
  document.getElementById('mc-rinnovo-auto').checked = !!c.rinnovo_automatico;
  document.getElementById('mc-commerciale').value = c.commerciale_riferimento || '';
  document.getElementById('mc-note').value = c.note || '';
  document.getElementById('mc-elimina').style.display = '';
  document.getElementById('mc-rinnova').style.display = (c.stato === 'attivo' || c.stato === 'in_rinnovo') ? '' : 'none';
  document.getElementById('mc-info-scadenze').style.display = c.stato === 'attivo' ? 'block' : 'none';

  // Carica impianti selezionati
  const { data: ci } = await sb.from('fotovroby_contratto_impianti')
    .select('impianto_id').eq('contratto_id', id);
  impiantiContratto = new Set((ci || []).map(x => x.impianto_id));
  await caricaImpiantiCliente();

  apriModal('modal-contratto');
}

async function caricaImpiantiCliente() {
  const cid = document.getElementById('mc-cliente').value;
  const el = document.getElementById('mc-impianti-lista');
  if (!cid) {
    el.innerHTML = '<div class="text-muted">Seleziona prima un cliente</div>';
    return;
  }
  const { data } = await sb.from('fotovroby_impianti')
    .select('id, codice, nome, potenza_kw, fascia, connessione, fase')
    .eq('cliente_id', cid)
    .in('fase', ['attivo','autorizzazione'])
    .order('codice');
  impiantiCliente = data || [];
  if (!impiantiCliente.length) {
    el.innerHTML = '<div class="text-muted">Nessun impianto attivo per questo cliente</div>';
    return;
  }
  el.innerHTML = impiantiCliente.map(i => `
    <label class="impianto-check">
      <input type="checkbox" value="${i.id}" ${impiantiContratto.has(i.id) ? 'checked' : ''}
             onchange="toggleImpianto('${i.id}')">
      <b>${escapeHtml(i.codice || '')}</b> ${escapeHtml(i.nome)}
      <span class="text-muted">· ${Number(i.potenza_kw).toLocaleString('it-IT', {maximumFractionDigits:2})} kW · ${i.connessione}</span>
      ${i.fase === 'autorizzazione' ? '<span class="chip chip-warn" style="margin-left:6px">in autorizzazione</span>' : ''}
    </label>
  `).join('');
}

function toggleImpianto(id) {
  if (impiantiContratto.has(id)) impiantiContratto.delete(id);
  else impiantiContratto.add(id);
}

async function salvaContratto() {
  const payload = {
    numero: document.getElementById('mc-numero').value.trim() || null,
    cliente_id: document.getElementById('mc-cliente').value,
    oggetto: document.getElementById('mc-oggetto').value.trim() || null,
    data_firma: document.getElementById('mc-firma').value || null,
    tipologia: document.getElementById('mc-tipologia').value,
    data_inizio: document.getElementById('mc-inizio').value,
    data_fine: document.getElementById('mc-fine').value,
    canone_annuo: parseFloat(document.getElementById('mc-canone').value) || null,
    visite_anno: parseInt(document.getElementById('mc-visite').value) || 1,
    mesi_preavviso_disdetta: parseInt(document.getElementById('mc-preavviso').value) || 3,
    rinnovo_automatico: document.getElementById('mc-rinnovo-auto').checked,
    stato: document.getElementById('mc-stato').value,
    commerciale_riferimento: document.getElementById('mc-commerciale').value.trim() || null,
    note: document.getElementById('mc-note').value.trim() || null
  };
  if (!payload.cliente_id) { alert('Cliente obbligatorio'); return; }
  if (!payload.data_inizio || !payload.data_fine) { alert('Date inizio/fine obbligatorie'); return; }
  if (payload.data_fine < payload.data_inizio) { alert('Data fine deve essere dopo inizio'); return; }

  if (!payload.numero) {
    const y = new Date().getFullYear();
    const { count } = await sb.from('fotovroby_contratti')
      .select('*', {count:'exact', head:true}).like('numero', `CTR-${y}-%`);
    payload.numero = `CTR-${y}-${String((count||0)+1).padStart(3,'0')}`;
  }

  let result;
  if (contrattoInEdit) {
    result = await sb.from('fotovroby_contratti').update(payload).eq('id', contrattoInEdit).select().single();
  } else {
    result = await sb.from('fotovroby_contratti').insert(payload).select().single();
  }
  if (result.error) { alert('Errore: ' + result.error.message); return; }

  const ctrId = result.data.id;

  // Sincronizza impianti
  await sb.from('fotovroby_contratto_impianti').delete().eq('contratto_id', ctrId);
  if (impiantiContratto.size > 0) {
    const rows = [...impiantiContratto].map(iid => ({
      contratto_id: ctrId, impianto_id: iid
    }));
    const { error } = await sb.from('fotovroby_contratto_impianti').insert(rows);
    if (error) { alert('Errore impianti: ' + error.message); return; }
  }

  // Feedback scadenze commerciali generate
  const { count: nScad } = await sb.from('fotovroby_scadenze')
    .select('*', {count:'exact', head:true})
    .eq('contratto_id', ctrId)
    .eq('categoria', 'commerciale')
    .in('stato', ['aperta','pianificata']);

  toast(`Contratto salvato. ${impiantiContratto.size} impianti collegati, ${nScad || 0} scadenze commerciali attive.`);

  chiudiModal('modal-contratto');
  await caricaContratti();
  await caricaImpiantiSenzaContratto();
  applicaFiltri();
  aggiornaKPI();
}

async function eliminaContratto() {
  if (!contrattoInEdit) return;
  if (!confirm('Eliminare il contratto? Verranno rimossi anche i collegamenti impianti e le scadenze commerciali.')) return;
  const { error } = await sb.from('fotovroby_contratti').delete().eq('id', contrattoInEdit);
  if (error) { alert('Errore: ' + error.message); return; }
  chiudiModal('modal-contratto');
  await caricaContratti();
  await caricaImpiantiSenzaContratto();
  applicaFiltri();
  aggiornaKPI();
}

async function rinnovaContratto() {
  await rinnovaRapido(contrattoInEdit);
  chiudiModal('modal-contratto');
}

async function rinnovaRapido(id) {
  const { data: c } = await sb.from('fotovroby_contratti').select('*').eq('id', id).single();
  if (!c) return;
  if (!confirm(`Creare un nuovo contratto di rinnovo di ${c.numero}?\n` +
               `Nuovo periodo: ${c.data_fine} → +1 anno\n` +
               `Impianti e canone verranno copiati.`)) return;

  // Nuovo periodo
  const nuovoInizio = c.data_fine;
  const nuovoFine = new Date(c.data_fine);
  nuovoFine.setFullYear(nuovoFine.getFullYear() + 1);

  const y = new Date().getFullYear();
  const { count } = await sb.from('fotovroby_contratti')
    .select('*', {count:'exact', head:true}).like('numero', `CTR-${y}-%`);

  const nuovo = {
    cliente_id: c.cliente_id,
    numero: `CTR-${y}-${String((count||0)+1).padStart(3,'0')}`,
    oggetto: 'RINNOVO: ' + (c.oggetto || ''),
    data_firma: new Date().toISOString().slice(0,10),
    data_inizio: nuovoInizio,
    data_fine: nuovoFine.toISOString().slice(0,10),
    canone_annuo: c.canone_annuo,
    visite_anno: c.visite_anno,
    tipologia: c.tipologia,
    rinnovo_automatico: c.rinnovo_automatico,
    mesi_preavviso_disdetta: c.mesi_preavviso_disdetta,
    commerciale_riferimento: c.commerciale_riferimento,
    stato: 'attivo',
    contratto_padre_id: c.id
  };
  const { data: nuovoCtr, error } = await sb.from('fotovroby_contratti').insert(nuovo).select().single();
  if (error) { alert('Errore: ' + error.message); return; }

  // Copia impianti
  const { data: ci } = await sb.from('fotovroby_contratto_impianti').select('impianto_id').eq('contratto_id', c.id);
  if (ci && ci.length) {
    await sb.from('fotovroby_contratto_impianti').insert(
      ci.map(x => ({ contratto_id: nuovoCtr.id, impianto_id: x.impianto_id }))
    );
  }
  // Marca il vecchio come rinnovato
  await sb.from('fotovroby_contratti').update({ stato: 'rinnovato' }).eq('id', c.id);

  toast(`Contratto rinnovato: ${nuovoCtr.numero}`);
  await caricaContratti();
  applicaFiltri();
  aggiornaKPI();
}

// UTILS -----------------------------------------------------------
function apriModal(id) { document.getElementById(id).classList.add('open'); }
function chiudiModal(id) { document.getElementById(id).classList.remove('open'); }
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}
function formatData(iso) {
  if (!iso) return '–';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function formatKw(n) { return Number(n || 0).toLocaleString('it-IT', {maximumFractionDigits: 1}); }
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

window.apriNuovo = apriNuovo;
window.apriModifica = apriModifica;
window.caricaImpiantiCliente = caricaImpiantiCliente;
window.toggleImpianto = toggleImpianto;
window.salvaContratto = salvaContratto;
window.eliminaContratto = eliminaContratto;
window.rinnovaContratto = rinnovaContratto;
window.rinnovaRapido = rinnovaRapido;
window.chiudiModal = chiudiModal;
