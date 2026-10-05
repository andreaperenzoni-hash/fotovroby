// Carica un partial HTML e lo inserisce nel DOM alla fine del body
async function loadPartial(path) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error('Impossibile caricare partial: ' + path);
  const html = await resp.text();
  const div = document.createElement('div');
  div.innerHTML = html;
  while (div.firstChild) document.body.appendChild(div.firstChild);
}
window.loadPartial = loadPartial;
