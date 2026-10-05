// Pagina Progetti (fase = progettuale)

let impianti = [];
let filtrati = [];

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  await loadPartial('partials/impianto-modal.html');
  await impCommonInit();
  await caricaDati();
  document.getElementById('f-cliente').addEventListener('change', applicaFiltri);
  document.getElementById('f-testo').addEventListener('input', debounce(applicaFiltri, 200));
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
})();

async function caricaDati() {
  const { data } = await sb.from('fotovroby_v_impianti_riepilogo')
    .select('*').eq('fase', 'progettuale').order('created_at', { ascending: false });
  impianti = data || [];

  // Popola filtro clienti
  const clienti = [...new Set(impianti.map(i => i.cliente_id))]
    .map(id => impianti.find(x => x.cliente_id === id))
    .map(x => ({ id: x.cliente_id, nome: x.cliente_nome }));
  const sel = document.getElementById('f-cliente');
  clienti.sort((a,b) => a.nome.localeCompare(b.nome));
  clienti.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.nome;
    sel.appendChild(o);
  });

  applicaFiltri();
  aggiornaKPI();
}

function aggiornaKPI() {
  const seiMesiFa = new Date(); seiMesiFa.setMonth(seiMesiFa.getMonth() - 6);
  const vecchi = impianti.filter(i => i.fase_dal && new Date(i.fase_dal) < seiMesiFa).length;
  const kw = impianti.reduce((s,i) => s + Number(i.potenza_kw || 0), 0);
  const imp = impianti.reduce((s,i) => s + Number(i.progetto_importo_preventivato || 0), 0);
  document.getElementById('kpi-tot').textContent = impianti.length;
  document.getElementById('kpi-kw').textContent = kw.toLocaleString('it-IT', { maximumFractionDigits: 1 });
  document.getElementById('kpi-vecchi').textContent = vecchi;
  document.getElementById('kpi-importo').textContent = imp.toLocaleString('it-IT', { maximumFractionDigits: 0 });
}

function applicaFiltri() {
  const cli = document.getElementById('f-cliente').value;
  const txt = document.getElementById('f-testo').value.toLowerCase().trim();
  filtrati = impianti.filter(i => {
    if (cli && i.cliente_id !== cli) return false;
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
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Nessun progetto</td></tr>';
    return;
  }
  tbody.innerHTML = filtrati.map(i => {
    const daMesi = i.fase_dal ? mesiDa(i.fase_dal) : '–';
    return `
      <tr>
        <td><b>${escapeHtml(i.codice || '–')}</b></td>
        <td>${escapeHtml(i.nome)}</td>
        <td>${escapeHtml(i.cliente_nome)}</td>
        <td>${formatKw(i.potenza_kw)} kW</td>
        <td><span class="chip">${badgeFascia(i.fascia)}</span></td>
        <td>${installLabel(i.tipo_installazione)}</td>
        <td>${daMesi}</td>
        <td>${i.progetto_importo_preventivato ? Number(i.progetto_importo_preventivato).toLocaleString('it-IT') + ' €' : '<span class="text-muted">–</span>'}</td>
        <td>${formatData(i.progetto_data_stima_avvio) || '<span class="text-muted">–</span>'}</td>
        <td class="col-azioni">
          <button class="btn-icon" onclick='impApriModifica("${i.id}", caricaDati)' title="Modifica">✎</button>
        </td>
      </tr>
    `;
  }).join('');
}

function apriNuovoProgetto() { impApriNuovo('progettuale', caricaDati); }

function installLabel(x) {
  if (!x) return '<span class="text-muted">–</span>';
  return ({tetto:'🏠', terra:'🌱', float:'💧', tracker:'☀️'}[x] || '') + ' ' + x;
}
function mesiDa(iso) {
  const d = new Date(iso), now = new Date();
  const m = (now.getFullYear()-d.getFullYear())*12 + (now.getMonth()-d.getMonth());
  if (m < 1) return 'questo mese';
  if (m < 12) return `${m} mesi`;
  return `${Math.floor(m/12)} anni`;
}

window.apriNuovoProgetto = apriNuovoProgetto;
window.caricaDati = caricaDati;
