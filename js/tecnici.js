// Anagrafica tecnici fotovroby

let tecnici = [];
let filtrati = [];
let tecInEdit = null;

(async () => {
  const auth = await requireAuth();
  if (!auth) return;
  await carica();
  document.getElementById('f-attivo').addEventListener('change', applicaFiltri);
  document.getElementById('f-testo').addEventListener('input', debounce(applicaFiltri, 200));
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
})();

async function carica() {
  const { data, error } = await sb.from('fotovroby_v_tecnici_attivita').select('*');
  if (error) { console.error(error); return; }
  tecnici = data || [];
  applicaFiltri();
}

function applicaFiltri() {
  const txt = document.getElementById('f-testo').value.toLowerCase().trim();
  const att = document.getElementById('f-attivo').value;
  filtrati = tecnici.filter(t => {
    if (att === 'true' && !t.attivo) return false;
    if (att === 'false' && t.attivo) return false;
    if (txt) {
      const hay = [t.nome, t.qualifica, t.azienda, t.email].join(' ').toLowerCase();
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
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Nessun tecnico</td></tr>';
    return;
  }
  tbody.innerHTML = filtrati.map(t => `
    <tr>
      <td>
        <b>${escapeHtml(t.nome)}</b>
        ${!t.attivo ? '<span class="chip chip-warn">disattivato</span>' : ''}
      </td>
      <td>${escapeHtml(t.qualifica || '–')}</td>
      <td>${escapeHtml(t.azienda || '–')}</td>
      <td>${escapeHtml(t.telefono || '–')}</td>
      <td>${t.email ? `<a href="mailto:${escapeHtml(t.email)}">${escapeHtml(t.email)}</a>` : '<span class="text-muted">–</span>'}</td>
      <td><span class="chip chip-info">${t.impianti_assegnati}</span></td>
      <td>${ruoliBadge(t)}</td>
      <td class="col-azioni">
        <button class="btn-icon" onclick='apriModifica("${t.id}")' title="Modifica">✎</button>
      </td>
    </tr>
  `).join('');
}

function ruoliBadge(t) {
  const r = [];
  if (t.come_progettista) r.push(`<span class="chip">P ${t.come_progettista}</span>`);
  if (t.come_installatore) r.push(`<span class="chip">I ${t.come_installatore}</span>`);
  if (t.come_taratura) r.push(`<span class="chip">T ${t.come_taratura}</span>`);
  if (t.come_manutentore) r.push(`<span class="chip">M ${t.come_manutentore}</span>`);
  return r.length ? r.join(' ') : '<span class="text-muted">–</span>';
}

function apriNuovo() {
  tecInEdit = null;
  document.getElementById('mt-titolo').textContent = 'Nuovo tecnico';
  ['mt-nome','mt-qualifica','mt-azienda','mt-telefono','mt-email','mt-pec','mt-albo','mt-note']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('mt-attivo').checked = true;
  document.getElementById('mt-elimina').style.display = 'none';
  apriModal('modal-tec');
}

async function apriModifica(id) {
  tecInEdit = id;
  const { data: t, error } = await sb.from('fotovroby_tecnici').select('*').eq('id', id).single();
  if (error) { alert('Errore: ' + error.message); return; }
  document.getElementById('mt-titolo').textContent = 'Modifica tecnico';
  document.getElementById('mt-nome').value = t.nome || '';
  document.getElementById('mt-qualifica').value = t.qualifica || '';
  document.getElementById('mt-azienda').value = t.azienda || '';
  document.getElementById('mt-telefono').value = t.telefono || '';
  document.getElementById('mt-email').value = t.email || '';
  document.getElementById('mt-pec').value = t.pec || '';
  document.getElementById('mt-albo').value = t.albo || '';
  document.getElementById('mt-note').value = t.note || '';
  document.getElementById('mt-attivo').checked = t.attivo !== false;
  document.getElementById('mt-elimina').style.display = '';
  apriModal('modal-tec');
}

async function salvaTecnico() {
  const payload = {
    nome: document.getElementById('mt-nome').value.trim(),
    qualifica: document.getElementById('mt-qualifica').value.trim() || null,
    azienda: document.getElementById('mt-azienda').value.trim() || null,
    telefono: document.getElementById('mt-telefono').value.trim() || null,
    email: document.getElementById('mt-email').value.trim() || null,
    pec: document.getElementById('mt-pec').value.trim() || null,
    albo: document.getElementById('mt-albo').value.trim() || null,
    note: document.getElementById('mt-note').value.trim() || null,
    attivo: document.getElementById('mt-attivo').checked
  };
  if (!payload.nome) { alert('Nome obbligatorio'); return; }
  const q = tecInEdit
    ? sb.from('fotovroby_tecnici').update(payload).eq('id', tecInEdit)
    : sb.from('fotovroby_tecnici').insert(payload);
  const { error } = await q;
  if (error) { alert('Errore: ' + error.message); return; }
  chiudiModal('modal-tec');
  await carica();
}

async function eliminaTecnico() {
  if (!tecInEdit) return;
  if (!confirm('Eliminare questo tecnico? Verranno rimosse anche le sue assegnazioni.')) return;
  await sb.from('fotovroby_impianto_tecnici').delete().eq('tecnico_id', tecInEdit);
  const { error } = await sb.from('fotovroby_tecnici').delete().eq('id', tecInEdit);
  if (error) { alert('Errore: ' + error.message); return; }
  chiudiModal('modal-tec');
  await carica();
}

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
window.salvaTecnico = salvaTecnico;
window.eliminaTecnico = eliminaTecnico;
window.chiudiModal = chiudiModal;
