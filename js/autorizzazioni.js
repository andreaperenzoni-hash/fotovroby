// Pagina Autorizzazioni (fase = autorizzazione)

let impianti = [];
let filtrati = [];

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  await loadPartial('partials/impianto-modal.html');
  await impCommonInit();
  await caricaDati();
  document.getElementById('f-cliente').addEventListener('change', applicaFiltri);
  document.getElementById('f-pratica').addEventListener('change', applicaFiltri);
  document.getElementById('f-testo').addEventListener('input', debounce(applicaFiltri, 200));
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
})();

async function caricaDati() {
  const { data } = await sb.from('fotovroby_v_impianti_riepilogo')
    .select('*').eq('fase', 'autorizzazione').order('created_at', { ascending: false });
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
  document.getElementById('kpi-tot').textContent = impianti.length;
  document.getElementById('kpi-kw').textContent = kw.toLocaleString('it-IT', { maximumFractionDigits: 1 });
  // scadenze
  document.getElementById('kpi-rosse').textContent = impianti.reduce((s,i) => s + Number(i.n_scadenze_rosse || 0), 0);
  document.getElementById('kpi-giallo').textContent = impianti.reduce((s,i) => s + Number(i.n_scadenze_aperte || 0) - Number(i.n_scadenze_rosse || 0), 0);
}

function applicaFiltri() {
  const cli = document.getElementById('f-cliente').value;
  const prat = document.getElementById('f-pratica').value;
  const txt = document.getElementById('f-testo').value.toLowerCase().trim();
  filtrati = impianti.filter(i => {
    if (cli && i.cliente_id !== cli) return false;
    if (prat === 'tica' && i.aut_data_invio_tica) return false;
    if (prat === 'gse' && i.aut_data_invio_gse) return false;
    if (prat === 'scia' && i.aut_data_scia_comune) return false;
    if (prat === 'vvf' && i.aut_data_vvf) return false;
    if (txt) {
      const hay = [i.codice, i.nome, i.cliente_nome, i.aut_num_pratica_tica,
                   i.aut_num_convenzione_gse, i.aut_num_prot_comune].join(' ').toLowerCase();
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
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Nessuna pratica</td></tr>';
    return;
  }
  tbody.innerHTML = filtrati.map(i => `
    <tr>
      <td><b>${escapeHtml(i.codice || '–')}</b></td>
      <td>${escapeHtml(i.nome)}</td>
      <td>${escapeHtml(i.cliente_nome)}</td>
      <td>${formatKw(i.potenza_kw)} kW</td>
      <td>${statoPratica(i.aut_data_invio_tica, i.aut_num_pratica_tica)}</td>
      <td>${statoPratica(i.aut_data_invio_gse, i.aut_num_convenzione_gse)}</td>
      <td>${statoPratica(i.aut_data_scia_comune, i.aut_num_prot_comune)}</td>
      <td>${statoPratica(i.aut_data_vvf, i.aut_pratica_vvf)}</td>
      <td>${i.n_scadenze_aperte > 0 ? `<span class="chip ${i.n_scadenze_rosse > 0 ? 'chip-danger' : 'chip-warn'}">${i.n_scadenze_aperte}</span>` : '<span class="text-muted">–</span>'}</td>
      <td class="col-azioni">
        <button class="btn-icon" onclick='impApriModifica("${i.id}", caricaDati)' title="Modifica">✎</button>
        <button class="btn-icon" onclick='impApriScadenze("${i.id}")' title="Scadenze">📋</button>
      </td>
    </tr>
  `).join('');
}

function statoPratica(data, numero) {
  if (!data) return '<span class="text-muted">–</span>';
  const titolo = numero ? ` title="${escapeHtml(numero)}"` : '';
  return `<span class="chip chip-success"${titolo}>✓ ${formatData(data)}</span>`;
}

function apriNuovaAutorizz() { impApriNuovo('autorizzazione', caricaDati); }

window.apriNuovaAutorizz = apriNuovaAutorizz;
window.caricaDati = caricaDati;
