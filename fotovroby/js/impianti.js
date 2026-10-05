// Pagina Impianti: tutti, con filtro fase

let impianti = [];
let filtrati = [];

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  await loadPartial('partials/impianto-modal.html');
  await impCommonInit();
  await caricaDati();

  const params = new URLSearchParams(location.search);
  if (params.get('cliente')) document.getElementById('f-cliente').value = params.get('cliente');
  if (params.get('fase')) document.getElementById('f-fase').value = params.get('fase');

  ['f-fase','f-cliente','f-fascia','f-install'].forEach(id =>
    document.getElementById(id).addEventListener('change', applicaFiltri));
  document.getElementById('f-testo').addEventListener('input', debounce(applicaFiltri, 200));

  applicaFiltri();
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
})();

async function caricaDati() {
  const { data } = await sb.from('fotovroby_v_impianti_riepilogo')
    .select('*').order('codice');
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

  // contatori di fase
  const n = { progettuale:0, autorizzazione:0, attivo:0, dismesso:0 };
  impianti.forEach(i => { if (n[i.fase] !== undefined) n[i.fase]++; });
  document.getElementById('cnt-prog').textContent = n.progettuale + ' progetti';
  document.getElementById('cnt-aut').textContent = n.autorizzazione + ' autorizzazione';
  document.getElementById('cnt-att').textContent = n.attivo + ' attivi';
  document.getElementById('cnt-dis').textContent = n.dismesso + ' dismessi';
}

function applicaFiltri() {
  const fase = document.getElementById('f-fase').value;
  const cli = document.getElementById('f-cliente').value;
  const fas = document.getElementById('f-fascia').value;
  const inst = document.getElementById('f-install').value;
  const txt = document.getElementById('f-testo').value.toLowerCase().trim();
  filtrati = impianti.filter(i => {
    if (fase && i.fase !== fase) return false;
    if (cli && i.cliente_id !== cli) return false;
    if (fas && i.fascia !== fas) return false;
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
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Nessun impianto</td></tr>';
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
      <td>${escapeHtml(i.comune || '–')}</td>
      <td>${faseBadge(i.fase)}</td>
      <td class="col-azioni">
        <button class="btn-icon" onclick='impApriModifica("${i.id}", caricaDati)' title="Modifica">✎</button>
        <button class="btn-icon" onclick='impApriScadenze("${i.id}")' title="Scadenze" ${i.fase === 'dismesso' ? 'disabled' : ''}>📋</button>
      </td>
    </tr>
  `).join('');
}

function installLabel(x) {
  if (!x) return '<span class="text-muted">–</span>';
  return ({tetto:'🏠', terra:'🌱', float:'💧', tracker:'☀️'}[x] || '') + ' ' + x;
}
function apriNuovoImpianto() { impApriNuovo('progettuale', caricaDati); }

window.apriNuovoImpianto = apriNuovoImpianto;
window.caricaDati = caricaDati;
