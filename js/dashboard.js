// Dashboard fotovroby

let meseCorrente = new Date();
meseCorrente.setDate(1);
let scadenzeMese = []; // popolato per il mese visualizzato

(async () => {
  const auth = await requireAuth();
  if (!auth) return;

  await Promise.all([
    caricaKPI(),
    caricaFasce(),
    caricaProssimeScadenze(),
    caricaCalendario()
  ]);

  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
})();

// KPI ---------------------------------------------------------------
async function caricaKPI() {
  const { data, error } = await sb.from('fotovroby_v_kpi').select('*').single();
  if (error) { console.error(error); return; }
  document.getElementById('kpi-clienti').textContent  = data.clienti_attivi;
  document.getElementById('kpi-impianti').textContent = data.impianti_attivi;
  document.getElementById('kpi-kw').textContent       = formatNumero(data.kw_totali) + ' kW totali';
  document.getElementById('kpi-rosso').textContent    = data.scadute;
  document.getElementById('kpi-giallo').textContent   = data.in_scadenza;
  document.getElementById('kpi-verde').textContent    = data.future;
  document.getElementById('kpi-mese').textContent     = data.interventi_mese;
  document.getElementById('kpi-prossimi').textContent = data.interventi_prossimi_30gg + ' prossimi 30 gg';
}

// Distribuzione per fascia -----------------------------------------
async function caricaFasce() {
  const { data, error } = await sb.from('fotovroby_v_impianti_per_fascia').select('*');
  if (error) { console.error(error); return; }
  const el = document.getElementById('fasce');
  if (!data.length) { el.innerHTML = '<div class="loading">Nessun impianto</div>'; return; }
  el.innerHTML = data.map(r => `
    <div class="list-item">
      <div class="info">
        <div class="titolo">${r.fascia} · ${r.connessione}</div>
        <div class="meta">${r.n_impianti} impianti · ${formatNumero(r.kw_totali)} kW</div>
      </div>
    </div>
  `).join('');
}

// Prossime 10 scadenze ---------------------------------------------
async function caricaProssimeScadenze() {
  const { data, error } = await sb.from('fotovroby_v_scadenziario')
    .select('*')
    .order('data_scadenza', { ascending: true })
    .limit(10);
  if (error) { console.error(error); return; }
  const el = document.getElementById('lista-scadenze');
  if (!data.length) { el.innerHTML = '<div class="loading">Nessuna scadenza</div>'; return; }
  el.innerHTML = data.map(s => `
    <div class="list-item">
      <div class="info">
        <div class="titolo">${s.descrizione}</div>
        <div class="meta">${s.cliente} · ${s.impianto} · ${formatData(s.data_scadenza)}</div>
      </div>
      <span class="badge ${s.semaforo}">${labelSemaforo(s.semaforo, s.giorni_mancanti)}</span>
    </div>
  `).join('');
}

// Calendario -------------------------------------------------------
async function caricaCalendario() {
  const y = meseCorrente.getFullYear();
  const m = meseCorrente.getMonth();
  const primoGiorno = new Date(y, m, 1);
  const ultimoGiorno = new Date(y, m + 1, 0);

  // Prendi tutte le scadenze del mese
  const dal = toIsoDate(primoGiorno);
  const al  = toIsoDate(ultimoGiorno);
  const { data, error } = await sb.from('fotovroby_v_scadenziario')
    .select('*')
    .gte('data_scadenza', dal)
    .lte('data_scadenza', al);
  if (error) { console.error(error); scadenzeMese = []; }
  else scadenzeMese = data || [];

  renderCalendario();
}

function renderCalendario() {
  const y = meseCorrente.getFullYear();
  const m = meseCorrente.getMonth();
  const nomeMese = meseCorrente.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  document.getElementById('cal-titolo').textContent = nomeMese;

  const primoGiorno = new Date(y, m, 1);
  const ultimoGiorno = new Date(y, m + 1, 0);
  // Lun=0 ... Dom=6
  const offset = (primoGiorno.getDay() + 6) % 7;
  const oggi = toIsoDate(new Date());

  // Raggruppa scadenze per giorno
  const perGiorno = {};
  for (const s of scadenzeMese) {
    (perGiorno[s.data_scadenza] ||= []).push(s);
  }

  const dow = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  let html = dow.map(d => `<div class="cal-dow">${d}</div>`).join('');

  // Celle vuote iniziali
  for (let i = 0; i < offset; i++) html += `<div class="cal-day other-month"></div>`;

  // Giorni del mese
  for (let d = 1; d <= ultimoGiorno.getDate(); d++) {
    const iso = toIsoDate(new Date(y, m, d));
    const items = perGiorno[iso] || [];
    const cls = ['cal-day'];
    if (iso === oggi) cls.push('today');
    const dots = [...new Set(items.map(s => s.semaforo))]
      .map(sem => `<span class="cal-dot ${sem}"></span>`).join('');
    const onclick = items.length
      ? `onclick="mostraGiorno('${iso}', event)"` : '';
    html += `<div class="${cls.join(' ')}" ${onclick}>
               <span class="num">${d}</span>
               <div class="cal-dots">${dots}</div>
             </div>`;
  }
  document.getElementById('calendario').innerHTML = html;
}

function cambiaMese(delta) {
  meseCorrente.setMonth(meseCorrente.getMonth() + delta);
  caricaCalendario();
}

function mostraGiorno(iso, ev) {
  ev.stopPropagation();
  chiudiPopover();
  const items = scadenzeMese.filter(s => s.data_scadenza === iso);
  if (!items.length) return;
  const pop = document.createElement('div');
  pop.className = 'day-popover';
  pop.id = 'day-popover';
  pop.innerHTML = `
    <div style="font-weight:600;margin-bottom:6px">${formatData(iso)}</div>
    ${items.map(s => `
      <div class="item">
        <div class="cliente">${s.cliente}</div>
        <div>${s.descrizione}</div>
        <div class="desc">${s.impianto} · <span class="badge ${s.semaforo}">${s.categoria}</span></div>
      </div>
    `).join('')}
  `;
  ev.currentTarget.appendChild(pop);
  setTimeout(() => document.addEventListener('click', chiudiPopover, { once: true }), 10);
}

function chiudiPopover() {
  const p = document.getElementById('day-popover');
  if (p) p.remove();
}

// Helpers ---------------------------------------------------------
function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const g = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${g}`;
}
function formatData(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function formatNumero(n) {
  return Number(n).toLocaleString('it-IT', { maximumFractionDigits: 1 });
}
function labelSemaforo(sem, gg) {
  if (sem === 'rosso')  return `Scad. ${Math.abs(gg)}gg fa`;
  if (sem === 'giallo') return `Fra ${gg}gg`;
  return `Fra ${gg}gg`;
}

window.cambiaMese = cambiaMese;
window.mostraGiorno = mostraGiorno;
