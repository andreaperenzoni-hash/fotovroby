// Modulo condiviso: logica form impianto, cambio fase, tecnici, scadenze
// Usato da: impianti.html, progetti.html, autorizzazioni.html, attivi.html, dismessi.html

const FASI = ['progettuale','autorizzazione','attivo','dismesso'];
const FASE_HELP = {
  progettuale: 'Compila dati base, tecnici e progetto. Nessuna scadenza automatica. I dati di progetto resteranno storicizzati.',
  autorizzazione: 'Gestisci pratiche GSE, TICA, Comune, VVF, ecc. Le scadenze autorizzative si aggiungono manualmente.',
  attivo: 'Impianto in esercizio: SPI, SPG, ADM e manutenzione annuale si generano in automatico.',
  dismesso: 'Impianto fuori servizio. Le scadenze ricorrenti aperte vengono annullate. Dati di progetto, autorizzazione e componenti conservati.'
};

const impContext = {
  clientiCache: [],
  tecniciCache: [],
  impiantoInEdit: null,
  impiantoScadenze: null,
  scadInEdit: null,
  onSaved: null  // callback per ricaricare la lista della pagina chiamante
};

async function impCommonInit() {
  await Promise.all([impCaricaClienti(), impCaricaTecnici()]);
}

async function impCaricaClienti() {
  const { data } = await sb.from('fotovroby_clienti')
    .select('id, nome, tipo').eq('attivo', true).order('nome');
  impContext.clientiCache = data || [];
  const sel = document.getElementById('mi-cliente');
  if (sel) {
    sel.innerHTML = '<option value="">Seleziona...</option>';
    impContext.clientiCache.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.nome;
      sel.appendChild(o);
    });
  }
}
async function impCaricaTecnici() {
  const { data } = await sb.from('fotovroby_tecnici')
    .select('id, nome, qualifica, azienda').eq('attivo', true).order('nome');
  impContext.tecniciCache = data || [];
}

// FASE SELECTOR ---------------------------------------------------
function setFase(f) {
  document.getElementById('mi-fase').value = f;
  document.querySelectorAll('.fase-step').forEach(b => {
    b.classList.toggle('active', b.dataset.fase === f);
  });
  const help = document.getElementById('mi-fase-help');
  if (help) help.textContent = FASE_HELP[f] || '';
  mostraSezioniPerFase(f);
}

function mostraSezioniPerFase(f) {
  // Sezioni sempre visibili: base, tecnici
  // Dati progetto: visibili in tutte le fasi (storicizzati)
  // Dati autorizzazione: visibili da autorizzazione in su
  // Dati attivazione: visibili da attivo in su
  // Dati dismissione: visibili solo in dismesso
  const show = (id, cond) => {
    const el = document.getElementById(id);
    if (el) el.style.display = cond ? '' : 'none';
  };
  show('sez-progetto', ['progettuale','autorizzazione','attivo','dismesso'].includes(f));
  show('sez-autorizzazione', ['autorizzazione','attivo','dismesso'].includes(f));
  show('sez-componenti', ['progettuale','autorizzazione','attivo','dismesso'].includes(f));
  show('sez-attivazione', ['attivo','dismesso'].includes(f));
  show('sez-dismissione', f === 'dismesso');
}

// APRI NUOVO / MODIFICA ------------------------------------------
function impSvuotaForm() {
  const campi = [
    'mi-codice','mi-nome','mi-potenza','mi-indirizzo','mi-comune','mi-pod','mi-adm',
    'mi-monitoraggio','mi-note','mi-allaccio',
    'mi-pannello-marca','mi-pannello-modello','mi-pannello-data',
    'mi-inverter-marca','mi-inverter-modello','mi-inverter-data',
    'mi-batteria-marca','mi-batteria-modello','mi-batteria-data',
    'mi-progetto-versione','mi-progetto-avvio','mi-progetto-importo','mi-progetto-note',
    'mi-aut-tica-data','mi-aut-tica-num','mi-aut-gse-data','mi-aut-gse-num',
    'mi-aut-scia-data','mi-aut-scia-num','mi-aut-vvf-data','mi-aut-vvf-num',
    'mi-aut-soprintendenza','mi-aut-catasto','mi-aut-note',
    'mi-dism-data','mi-dism-motivo','mi-dism-gse','mi-dism-smalt','mi-dism-note'
  ];
  campi.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const cli = document.getElementById('mi-cliente'); if (cli) cli.value = '';
  const inst = document.getElementById('mi-installazione'); if (inst) inst.value = '';
  const conn = document.getElementById('mi-connessione'); if (conn) conn.value = 'BT';
  const reg = document.getElementById('mi-regime'); if (reg) reg.value = 'parziale';
}

function impApriNuovo(faseIniziale, onSaved) {
  impContext.impiantoInEdit = null;
  impContext.onSaved = onSaved;
  document.getElementById('mi-titolo').textContent = 'Nuovo impianto';
  impSvuotaForm();
  setFase(faseIniziale || 'progettuale');
  const el = document.getElementById('mi-elimina'); if (el) el.style.display = 'none';
  const tec = document.getElementById('mi-tecnici-lista');
  if (tec) tec.innerHTML = '<div class="text-muted">Salva prima l\'impianto per assegnare tecnici</div>';
  mostraStoricoFase(null);
  impAnteprimaFascia();
  apriModal('modal-impianto');
}

async function impApriModifica(id, onSaved) {
  const { data: i, error } = await sb.from('fotovroby_impianti')
    .select('*, cliente:fotovroby_clienti(id, nome, tipo)')
    .eq('id', id).single();
  if (error) { alert('Errore: ' + error.message); return; }

  impContext.impiantoInEdit = id;
  impContext.onSaved = onSaved;
  document.getElementById('mi-titolo').textContent = 'Modifica impianto';

  // Base
  setVal('mi-codice', i.codice);
  setVal('mi-cliente', i.cliente_id);
  setVal('mi-nome', i.nome);
  setVal('mi-potenza', i.potenza_kw);
  setVal('mi-installazione', i.tipo_installazione);
  setVal('mi-connessione', i.connessione);
  setVal('mi-regime', i.regime_cessione);
  setVal('mi-indirizzo', i.indirizzo);
  setVal('mi-comune', i.comune);
  setVal('mi-monitoraggio', i.portale_monitoraggio);
  setVal('mi-note', i.note);

  // Componenti
  setVal('mi-pannello-marca', i.pannello_marca);
  setVal('mi-pannello-modello', i.pannello_modello);
  setVal('mi-pannello-data', i.pannello_data);
  setVal('mi-inverter-marca', i.inverter_marca);
  setVal('mi-inverter-modello', i.inverter_modello);
  setVal('mi-inverter-data', i.inverter_data);
  setVal('mi-batteria-marca', i.batteria_marca);
  setVal('mi-batteria-modello', i.batteria_modello);
  setVal('mi-batteria-data', i.batteria_data);

  // Progetto
  setVal('mi-progetto-versione', i.progetto_versione);
  setVal('mi-progetto-avvio', i.progetto_data_stima_avvio);
  setVal('mi-progetto-importo', i.progetto_importo_preventivato);
  setVal('mi-progetto-note', i.progetto_note);

  // Autorizzazione
  setVal('mi-aut-tica-data', i.aut_data_invio_tica);
  setVal('mi-aut-tica-num', i.aut_num_pratica_tica);
  setVal('mi-aut-gse-data', i.aut_data_invio_gse);
  setVal('mi-aut-gse-num', i.aut_num_convenzione_gse);
  setVal('mi-aut-scia-data', i.aut_data_scia_comune);
  setVal('mi-aut-scia-num', i.aut_num_prot_comune);
  setVal('mi-aut-vvf-data', i.aut_data_vvf);
  setVal('mi-aut-vvf-num', i.aut_pratica_vvf);
  setVal('mi-aut-soprintendenza', i.aut_soprintendenza);
  setVal('mi-aut-catasto', i.aut_catasto);
  setVal('mi-aut-note', i.aut_note);

  // Attivazione
  setVal('mi-allaccio', i.data_allaccio);
  setVal('mi-pod', i.pod);
  setVal('mi-adm', i.codice_ditta_adm);

  // Dismissione
  setVal('mi-dism-data', i.dism_data);
  setVal('mi-dism-motivo', i.dism_motivo);
  setVal('mi-dism-gse', i.dism_comunicazione_gse);
  setVal('mi-dism-smalt', i.dism_smaltimento);
  setVal('mi-dism-note', i.dism_note);

  setFase(i.fase || 'progettuale');
  const el = document.getElementById('mi-elimina'); if (el) el.style.display = '';
  impAnteprimaFascia();
  await impCaricaTecniciImpianto(id);
  await mostraStoricoFase(id);
  apriModal('modal-impianto');
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v ?? '';
}

function impAnteprimaFascia() {
  const p = parseFloat(document.getElementById('mi-potenza').value);
  const el = document.getElementById('mi-fascia-preview');
  if (!el) return;
  if (isNaN(p) || p <= 0) { el.textContent = '—'; el.className = 'fascia-preview'; return; }
  if (p <= 11.08) { el.textContent = 'F1 · fino a 11,08 kW'; el.className = 'fascia-preview fascia-f1'; }
  else if (p <= 20) { el.textContent = 'F2 · 11,08–20 kW'; el.className = 'fascia-preview fascia-f2'; }
  else { el.textContent = 'F3 · oltre 20 kW'; el.className = 'fascia-preview fascia-f3'; }
}

async function mostraStoricoFase(id) {
  const el = document.getElementById('mi-fase-storico');
  if (!el) return;
  if (!id) { el.innerHTML = ''; return; }
  const { data } = await sb.from('fotovroby_impianto_fase_log')
    .select('*').eq('impianto_id', id).order('data_cambio', { ascending: false });
  if (!data || !data.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="storico-fase"><b>Storico fasi:</b> ' +
    data.map(l => `${l.fase_da || 'nuovo'} → <b>${l.fase_a}</b> <span class="text-muted">(${formatData(l.data_cambio.slice(0,10))})</span>`).join(' · ') +
    '</div>';
}

async function impSalva() {
  const faseScelta = document.getElementById('mi-fase').value;
  const payload = {
    codice: val('mi-codice') || null,
    cliente_id: val('mi-cliente'),
    nome: val('mi-nome'),
    potenza_kw: parseFloat(val('mi-potenza')),
    tipo_installazione: val('mi-installazione') || null,
    connessione: val('mi-connessione'),
    regime_cessione: val('mi-regime'),
    fase: faseScelta,
    indirizzo: val('mi-indirizzo') || null,
    comune: val('mi-comune') || null,
    portale_monitoraggio: val('mi-monitoraggio') || null,
    note: val('mi-note') || null,
    // componenti
    pannello_marca: val('mi-pannello-marca') || null,
    pannello_modello: val('mi-pannello-modello') || null,
    pannello_data: val('mi-pannello-data') || null,
    inverter_marca: val('mi-inverter-marca') || null,
    inverter_modello: val('mi-inverter-modello') || null,
    inverter_data: val('mi-inverter-data') || null,
    batteria_marca: val('mi-batteria-marca') || null,
    batteria_modello: val('mi-batteria-modello') || null,
    batteria_data: val('mi-batteria-data') || null,
    // progetto (sempre salvati)
    progetto_versione: val('mi-progetto-versione') || null,
    progetto_data_stima_avvio: val('mi-progetto-avvio') || null,
    progetto_importo_preventivato: parseFloat(val('mi-progetto-importo')) || null,
    progetto_note: val('mi-progetto-note') || null,
    // autorizzazione (sempre salvati)
    aut_data_invio_tica: val('mi-aut-tica-data') || null,
    aut_num_pratica_tica: val('mi-aut-tica-num') || null,
    aut_data_invio_gse: val('mi-aut-gse-data') || null,
    aut_num_convenzione_gse: val('mi-aut-gse-num') || null,
    aut_data_scia_comune: val('mi-aut-scia-data') || null,
    aut_num_prot_comune: val('mi-aut-scia-num') || null,
    aut_data_vvf: val('mi-aut-vvf-data') || null,
    aut_pratica_vvf: val('mi-aut-vvf-num') || null,
    aut_soprintendenza: val('mi-aut-soprintendenza') || null,
    aut_catasto: val('mi-aut-catasto') || null,
    aut_note: val('mi-aut-note') || null,
    // attivazione
    data_allaccio: val('mi-allaccio') || null,
    pod: val('mi-pod') || null,
    codice_ditta_adm: val('mi-adm') || null,
    // dismissione
    dism_data: val('mi-dism-data') || null,
    dism_motivo: val('mi-dism-motivo') || null,
    dism_comunicazione_gse: val('mi-dism-gse') || null,
    dism_smaltimento: val('mi-dism-smalt') || null,
    dism_note: val('mi-dism-note') || null
  };
  if (!payload.nome) { alert('Nome obbligatorio'); return; }
  if (!payload.cliente_id) { alert('Cliente obbligatorio'); return; }
  if (!(payload.potenza_kw > 0)) { alert('Inserisci una potenza valida'); return; }

  // Validazioni specifiche per fase
  if (faseScelta === 'attivo' && !payload.data_allaccio) {
    if (!confirm('Impianto Attivo senza data allaccio: le scadenze automatiche partiranno da oggi. Procedo?')) return;
  }
  if (faseScelta === 'dismesso' && !payload.dism_data) {
    alert('In fase Dismesso serve la data di dismissione');
    return;
  }

  if (!payload.codice) {
    const y = new Date().getFullYear();
    const { count } = await sb.from('fotovroby_impianti')
      .select('*', { count: 'exact', head: true }).like('codice', `FV-${y}-%`);
    payload.codice = `FV-${y}-${String((count || 0) + 1).padStart(3, '0')}`;
  }

  let result;
  if (impContext.impiantoInEdit) {
    result = await sb.from('fotovroby_impianti').update(payload).eq('id', impContext.impiantoInEdit).select().single();
  } else {
    result = await sb.from('fotovroby_impianti').insert(payload).select().single();
  }
  if (result.error) { alert('Errore: ' + result.error.message); return; }

  // Feedback scadenze
  const nuovoId = result.data?.id;
  if (payload.fase === 'attivo' && nuovoId) {
    const { count } = await sb.from('fotovroby_scadenze')
      .select('*', { count: 'exact', head: true })
      .eq('impianto_id', nuovoId).in('stato', ['aperta','pianificata']);
    toast(`Impianto salvato. ${count || 0} scadenze automatiche attive.`);
  } else {
    toast(`Impianto salvato in fase "${payload.fase}". Dati storicizzati conservati.`);
  }

  chiudiModal('modal-impianto');
  if (impContext.onSaved) await impContext.onSaved();
}

async function impElimina() {
  if (!impContext.impiantoInEdit) return;
  if (!confirm('Eliminare l\'impianto? Verranno cancellati scadenze, interventi, tecnici assegnati e lo storico.')) return;
  const { error } = await sb.from('fotovroby_impianti').delete().eq('id', impContext.impiantoInEdit);
  if (error) { alert('Errore: ' + error.message); return; }
  chiudiModal('modal-impianto');
  if (impContext.onSaved) await impContext.onSaved();
}

// TECNICI --------------------------------------------------------
async function impCaricaTecniciImpianto(impId) {
  const { data, error } = await sb.from('fotovroby_impianto_tecnici')
    .select('*, tecnico:fotovroby_tecnici(id, nome, qualifica, azienda, telefono, email)')
    .eq('impianto_id', impId).order('ruolo');
  const el = document.getElementById('mi-tecnici-lista');
  if (!el) return;
  if (error) { el.innerHTML = '<div class="text-muted">Errore</div>'; return; }
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
        <button class="btn-icon" onclick="impRimuoviTecnico('${a.id}')" title="Rimuovi">✕</button>
      </div>
    </div>
  `).join('');
}
function ruoloLabel(r) {
  return { progettista:'Progettista', installatore:'Installatore', direttore_lavori:'DL',
           taratura:'Taratura', manutenzione:'Manutenzione', altro:'Altro' }[r] || r;
}

function impApriAggiungiTecnico() {
  if (!impContext.impiantoInEdit) { alert('Salva prima l\'impianto'); return; }
  const sel = document.getElementById('ta-tecnico');
  sel.innerHTML = '<option value="">Seleziona tecnico...</option>';
  impContext.tecniciCache.forEach(t => {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = `${t.nome}${t.qualifica ? ' - ' + t.qualifica : ''}${t.azienda ? ' (' + t.azienda + ')' : ''}`;
    sel.appendChild(o);
  });
  document.getElementById('ta-ruolo').value = 'progettista';
  document.getElementById('ta-dal').value = new Date().toISOString().slice(0,10);
  document.getElementById('ta-al').value = '';
  document.getElementById('ta-note').value = '';
  apriModal('modal-tec-assign');
}

async function impConfermaAssegnaTecnico() {
  const payload = {
    impianto_id: impContext.impiantoInEdit,
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
  await impCaricaTecniciImpianto(impContext.impiantoInEdit);
}

async function impRimuoviTecnico(assegnazioneId) {
  if (!confirm('Rimuovere assegnazione?')) return;
  await sb.from('fotovroby_impianto_tecnici').delete().eq('id', assegnazioneId);
  await impCaricaTecniciImpianto(impContext.impiantoInEdit);
}

// SCADENZE -------------------------------------------------------
async function impApriScadenze(id) {
  const { data: i } = await sb.from('fotovroby_impianti')
    .select('*, cliente:fotovroby_clienti(nome)').eq('id', id).single();
  if (!i) return;
  impContext.impiantoScadenze = i;
  document.getElementById('ms-nome').textContent = i.codice || i.nome;
  document.getElementById('ms-info').innerHTML = `
    <b>${escapeHtml(i.nome)}</b> · ${escapeHtml(i.cliente?.nome || '')}<br>
    <span class="text-muted">${Number(i.potenza_kw).toLocaleString('it-IT',{maximumFractionDigits:2})} kW · ${i.connessione} · ${i.regime_cessione} · ${faseBadge(i.fase)}</span>
  `;
  await impCaricaScadenzeImpianto();
  apriModal('modal-scadenze');
}

async function impCaricaScadenzeImpianto() {
  const { data } = await sb.from('fotovroby_scadenze')
    .select('*, regola:fotovroby_regole(codice, descrizione)')
    .eq('impianto_id', impContext.impiantoScadenze.id)
    .in('stato', ['aperta','pianificata']).order('data_scadenza');
  const tbody = document.getElementById('ms-lista');
  if (!data || !data.length) { tbody.innerHTML = '<tr><td colspan="6" class="loading">Nessuna scadenza</td></tr>'; return; }
  const oggi = new Date().toISOString().slice(0,10);
  tbody.innerHTML = data.map(s => {
    const sem = s.data_scadenza < oggi ? 'rosso' :
                s.data_scadenza <= addDays(oggi, s.giorni_preavviso) ? 'giallo' : 'verde';
    const origine = s.regola_id
      ? `<span class="chip chip-info" title="${escapeHtml(s.regola?.descrizione||'')}">${escapeHtml(s.regola?.codice||'auto')}</span>`
      : '<span class="chip">manuale</span>';
    return `<tr>
      <td><span class="badge ${sem}">${formatData(s.data_scadenza)}</span></td>
      <td>${escapeHtml(s.descrizione)}</td>
      <td>${escapeHtml(s.categoria)}</td>
      <td>${s.stato === 'pianificata' ? '<span class="chip chip-info">Pianif.</span>' : '<span class="chip">Aperta</span>'}</td>
      <td>${origine}</td>
      <td class="col-azioni"><button class="btn-icon" onclick='impApriModificaScad(${JSON.stringify(s)})' title="Modifica">✎</button></td>
    </tr>`;
  }).join('');
}

async function impRigeneraScadenze() {
  if (!impContext.impiantoScadenze) return;
  const { data, error } = await sb.rpc('fotovroby_genera_scadenze', { p_impianto: impContext.impiantoScadenze.id });
  if (error) { alert('Errore: ' + error.message); return; }
  toast(`Rigenerate ${data || 0} scadenze`);
  await impCaricaScadenzeImpianto();
}

function impApriNuovaScadenza() {
  impContext.scadInEdit = null;
  document.getElementById('mse-titolo').textContent = 'Nuova scadenza';
  ['mse-desc','mse-data','mse-note'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('mse-cat').value = 'manutenzione';
  document.getElementById('mse-preavviso').value = 30;
  document.getElementById('mse-stato').value = 'aperta';
  document.getElementById('mse-elimina').style.display = 'none';
  apriModal('modal-scad-edit');
}

function impApriModificaScad(s) {
  impContext.scadInEdit = s;
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

async function impSalvaScadenza() {
  const payload = {
    descrizione: val('mse-desc'),
    categoria: val('mse-cat'),
    data_scadenza: val('mse-data'),
    giorni_preavviso: parseInt(val('mse-preavviso')) || 30,
    stato: val('mse-stato'),
    note: val('mse-note') || null
  };
  if (!payload.descrizione || !payload.data_scadenza) { alert('Descrizione e data obbligatorie'); return; }
  let q;
  if (impContext.scadInEdit) {
    q = sb.from('fotovroby_scadenze').update(payload).eq('id', impContext.scadInEdit.id);
  } else {
    payload.impianto_id = impContext.impiantoScadenze.id;
    q = sb.from('fotovroby_scadenze').insert(payload);
  }
  const { error } = await q;
  if (error) { alert('Errore: ' + error.message); return; }
  chiudiModal('modal-scad-edit');
  await impCaricaScadenzeImpianto();
}

async function impEliminaScadenza() {
  if (!impContext.scadInEdit) return;
  if (!confirm('Eliminare questa scadenza?')) return;
  await sb.from('fotovroby_scadenze').delete().eq('id', impContext.scadInEdit.id);
  chiudiModal('modal-scad-edit');
  await impCaricaScadenzeImpianto();
}

// UTILS pubblici -------------------------------------------------
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function apriModal(id) { document.getElementById(id).classList.add('open'); }
function chiudiModal(id) { document.getElementById(id).classList.remove('open'); }
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}
function formatData(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function addDays(iso, n) {
  const d = new Date(iso); d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function faseBadge(f) {
  const map = {
    progettuale: '<span class="chip chip-info">Progetto</span>',
    autorizzazione: '<span class="chip chip-warn">Autorizz.</span>',
    attivo: '<span class="chip chip-success">Attivo</span>',
    dismesso: '<span class="chip">Dismesso</span>'
  };
  return map[f] || f;
}
function badgeFascia(f) {
  if (!f) return '–';
  return f.startsWith('F1') ? 'F1' : f.startsWith('F2') ? 'F2' : 'F3';
}
function formatKw(n) { return Number(n).toLocaleString('it-IT',{maximumFractionDigits:2}); }

// Esponi tutto globalmente
Object.assign(window, {
  setFase, impApriNuovo, impApriModifica, impSalva, impElimina,
  impAnteprimaFascia, impApriAggiungiTecnico, impConfermaAssegnaTecnico, impRimuoviTecnico,
  impApriScadenze, impRigeneraScadenze, impApriNuovaScadenza, impApriModificaScad,
  impSalvaScadenza, impEliminaScadenza,
  chiudiModal, apriModal, toast, formatData, escapeHtml, debounce,
  faseBadge, badgeFascia, formatKw, impCommonInit
});
