// Anagrafica clienti fotovroby

let clienti = [];
let filtrati = [];
let clienteInEdit = null;

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  await caricaClienti();
  document.getElementById('f-tipo').addEventListener('change', applicaFiltri);
  document.getElementById('f-testo').addEventListener('input', debounce(applicaFiltri, 200));
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
})();

async function caricaClienti() {
  // Prendi clienti + conteggio impianti in un colpo con RPC-like query
  const { data: cli, error } = await sb.from('fotovroby_clienti')
    .select('*, impianti:fotovroby_impianti(count)')
    .order('nome');
  if (error) { console.error(error); return; }
  clienti = (cli || []).map(c => ({
    ...c,
    n_impianti: c.impianti?.[0]?.count || 0
  }));
  applicaFiltri();
}

function applicaFiltri() {
  const tipo = document.getElementById('f-tipo').value;
  const txt = document.getElementById('f-testo').value.toLowerCase().trim();
  filtrati = clienti.filter(c => {
    if (tipo && c.tipo !== tipo) return false;
    if (txt) {
      const hay = [c.nome, c.email, c.telefono, c.comune].join(' ').toLowerCase();
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
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Nessun cliente</td></tr>';
    return;
  }
  tbody.innerHTML = filtrati.map(c => `
    <tr>
      <td>
        <b>${escapeHtml(c.nome)}</b>
        ${!c.attivo ? '<span class="chip chip-warn">disattivato</span>' : ''}
      </td>
      <td>${tipoLabel(c.tipo)}</td>
      <td>${c.email ? `<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>` : '<span class="text-muted">–</span>'}</td>
      <td>${escapeHtml(c.telefono || '–')}</td>
      <td>${escapeHtml(c.comune || '–')}</td>
      <td><a href="impianti.html?cliente=${c.id}" class="chip chip-info">${c.n_impianti} impianti</a></td>
      <td class="col-azioni">
        <button class="btn-icon" onclick='apriModifica(${JSON.stringify(c)})' title="Modifica">✎</button>
      </td>
    </tr>
  `).join('');
}

function tipoLabel(t) {
  const map = {
    privato: '<span class="chip">Privato</span>',
    azienda: '<span class="chip chip-info">Azienda</span>',
    condominio: '<span class="chip chip-warn">Condominio</span>',
    pa: '<span class="chip chip-success">PA</span>'
  };
  return map[t] || t;
}

function apriNuovo() {
  clienteInEdit = null;
  document.getElementById('mc-titolo').textContent = 'Nuovo cliente';
  document.getElementById('mc-nome').value = '';
  document.getElementById('mc-tipo').value = 'privato';
  document.getElementById('mc-email').value = '';
  document.getElementById('mc-telefono').value = '';
  document.getElementById('mc-comune').value = '';
  document.getElementById('mc-cfpiva').value = '';
  document.getElementById('mc-indirizzo').value = '';
  document.getElementById('mc-note').value = '';
  document.getElementById('mc-attivo').checked = true;
  document.getElementById('mc-elimina').style.display = 'none';
  apriModal('modal-cliente');
}

function apriModifica(c) {
  clienteInEdit = c.id;
  document.getElementById('mc-titolo').textContent = 'Modifica cliente';
  document.getElementById('mc-nome').value = c.nome || '';
  document.getElementById('mc-tipo').value = c.tipo || 'privato';
  document.getElementById('mc-email').value = c.email || '';
  document.getElementById('mc-telefono').value = c.telefono || '';
  document.getElementById('mc-comune').value = c.comune || '';
  document.getElementById('mc-cfpiva').value = c.cf_piva || '';
  document.getElementById('mc-indirizzo').value = c.indirizzo || '';
  document.getElementById('mc-note').value = c.note || '';
  document.getElementById('mc-attivo').checked = c.attivo !== false;
  document.getElementById('mc-elimina').style.display = c.n_impianti === 0 ? '' : 'none';
  apriModal('modal-cliente');
}

async function salvaCliente() {
  const payload = {
    nome: document.getElementById('mc-nome').value.trim(),
    tipo: document.getElementById('mc-tipo').value,
    email: document.getElementById('mc-email').value.trim() || null,
    telefono: document.getElementById('mc-telefono').value.trim() || null,
    comune: document.getElementById('mc-comune').value.trim() || null,
    cf_piva: document.getElementById('mc-cfpiva').value.trim() || null,
    indirizzo: document.getElementById('mc-indirizzo').value.trim() || null,
    note: document.getElementById('mc-note').value.trim() || null,
    attivo: document.getElementById('mc-attivo').checked
  };
  if (!payload.nome) { alert('Nome obbligatorio'); return; }

  const q = clienteInEdit
    ? sb.from('fotovroby_clienti').update(payload).eq('id', clienteInEdit)
    : sb.from('fotovroby_clienti').insert(payload);
  const { error } = await q;
  if (error) { alert('Errore: ' + error.message); return; }
  chiudiModal('modal-cliente');
  await caricaClienti();
}

async function eliminaCliente() {
  if (!clienteInEdit) return;
  if (!confirm('Eliminare definitivamente questo cliente?')) return;
  const { error } = await sb.from('fotovroby_clienti').delete().eq('id', clienteInEdit);
  if (error) { alert('Errore: ' + error.message + '\n(Ci sono impianti collegati?)'); return; }
  chiudiModal('modal-cliente');
  await caricaClienti();
}

// UTILS
function apriModal(id) { document.getElementById(id).classList.add('open'); }
function chiudiModal(id) { document.getElementById(id).classList.remove('open'); }
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
window.salvaCliente = salvaCliente;
window.eliminaCliente = eliminaCliente;
window.chiudiModal = chiudiModal;
