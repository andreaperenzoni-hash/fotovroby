// Pagina Attivi (fase = attivo)

let impianti = [];
let filtrati = [];

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  await loadPartial('partials/impianto-modal.html');
  await impCommonInit();
  await caricaDati();
  ['f-cliente','f-fascia','f-conn','f-install'].forEach(id =>
    document.getElementById(id).addEventListener('change', applicaFiltri));
  document.getElementById('f-testo').addEventListener('input', debounce(applicaFiltri, 200));
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
})();

async function caricaDati() {
  const { data } = await sb.from('fotovroby_v_impianti_riepilogo')
    .select('*').eq('fase', 'attivo').order('codice');
  impianti = data || [];

  const clienti = [...new Map(impianti.map(i => [i.cliente_id, { id: i.cliente_id, nome: i.cliente_nome }])).values()]
    .sort((a,b) => a.nome.localeCompare(b.nome));
  const sel = document.getElementById('f-cliente');
  sel.innerHTML = '<option value="">Tutti</option>';
  clienti.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.nome;
    sel.appendChild(o);
  });
  applicaFiltri();
  aggiornaKPI();
}

function aggiornaKPI() {
  const kw = impianti.reduce((s,i) => s + Number(i.potenza_kw || 0), 0);
  const bt = impianti.filter(i => i.connessione === 'BT').length;
  const mt = impianti.filter(i => i.connessione === 'MT').length;
  document.getElementById('kpi-tot').textContent = impianti.length;
  document.getElementById('kpi-kw').textContent = kw.toLocaleString('it-IT', { maximumFractionDigits: 1 });
  document.getElementById('kpi-bt').textContent = bt;
  document.getElementById('kpi-mt').textContent = mt;
  document.getElementById('kpi-rosse').textContent = impianti.reduce((s,i) => s + Number(i.n_scadenze_rosse || 0), 0);
  document.getElementById('kpi-giallo').textContent = impianti.reduce((s,i) => s + (Number(i.n_scadenze_aperte || 0) - Number(i.n_scadenze_rosse || 0)), 0);
}

function applicaFiltri() {
  const cli = document.getElementById('f-cliente').value;
  const fas = document.getElementById('f-fascia').value;
  const con = document.getElementById('f-conn').value;
  const inst = document.getElementById('f-install').value;
  const txt = document.getElementById('f-testo').value.toLowerCase().trim();
  filtrati = impianti.filter(i => {
    if (cli && i.cliente_id !== cli) return false;
    if (fas && i.fascia !== fas) return false;
    if (con && i.connessione !== con) return false;
    if (inst && i.tipo_installazione !== inst) return false;
    if (txt) {
      const hay = [i.codice, i.nome, i.cliente_nome, i.comune].join(' ').toLowerCase();
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
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Nessun impianto attivo</td></tr>';
    return;
  }
  tbody.innerHTML = filtrati.map(i => `
    <tr>
      <td><b>${escapeHtml(i.codice || '–')}</b></td>
      <td>${escapeHtml(i.nome)}</td>
      <td>${escapeHtml(i.cliente_nome)}</td>
      <td>${formatKw(i.potenza_kw)} kW</td>
      <td><span class="chip">${badgeFascia(i.fascia)}</span></td>
      <td>${installLabel(i.tipo_installazione)}</td>
      <td>${i.connessione}</td>
      <td>${i.regime_cessione}</td>
      <td>${badgeScadenze(i)}</td>
      <td class="col-azioni">
        <button class="btn-icon" onclick='impApriModifica("${i.id}", caricaDati)' title="Modifica">✎</button>
        <button class="btn-icon" onclick='impApriScadenze("${i.id}")' title="Scadenze">📋</button>
      </td>
    </tr>
  `).join('');
}

function badgeScadenze(i) {
  if (!i.n_scadenze_aperte) return '<span class="text-muted">–</span>';
  if (i.n_scadenze_rosse > 0) return `<span class="chip chip-danger">${i.n_scadenze_rosse} / ${i.n_scadenze_aperte}</span>`;
  return `<span class="chip chip-info">${i.n_scadenze_aperte}</span>`;
}
function installLabel(x) {
  if (!x) return '<span class="text-muted">–</span>';
  return ({tetto:'🏠', terra:'🌱', float:'💧', tracker:'☀️'}[x] || '') + ' ' + x;
}
function apriNuovoAttivo() { impApriNuovo('attivo', caricaDati); }

window.apriNuovoAttivo = apriNuovoAttivo;
window.caricaDati = caricaDati;
