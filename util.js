/* ============================================================
   Kleine hulpfuncties
   ============================================================ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------- Veilig HTML maken ----------
   html`...` escapet automatisch alles wat je erin zet, behalve
   andere html`...` blokken. Zo kan tekst van deelnemers nooit
   als code worden uitgevoerd. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
const raw = s => new Raw(String(s ?? ''));
function fmt(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(fmt).join('');
  if (v === null || v === undefined || v === false) return '';
  return esc(String(v));
}
const html = (strings, ...vals) =>
  new Raw(strings.reduce((out, s, i) => out + s + (i < vals.length ? fmt(vals[i]) : ''), ''));
function mount(el, tpl) { el.innerHTML = tpl instanceof Raw ? tpl.s : esc(tpl); return el; }

/* ---------- Tijd ---------- */
const _dtf = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDatum = ts => (ts ? _dtf.format(new Date(ts)) : '');
function toLocalInput(ts) {
  if (!ts) return '';
  const d = new Date(ts), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = v => (v ? new Date(v).toISOString() : null);

/* ---------- Namen en adressen ---------- */
function slugNaam(naam) {
  return String(naam || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
}
const naamNaarEmail = naam => `${slugNaam(naam)}@${CONFIG.EMAIL_DOMEIN}`;
const slugify = t => slugNaam(t).replace(/\./g, '-') || 'pagina';
const safeUrl = u => (/^https?:\/\//i.test(u || '') ? u : '');
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const foutTekst = e => (e && e.message) ? e.message : 'Er ging iets mis. Probeer het opnieuw.';

/* ---------- Meldingen ---------- */
function toast(msg, type = 'ok') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('weg'); setTimeout(() => t.remove(), 400); }, 3800);
}

function confetti(n = 40) {
  const box = document.createElement('div');
  box.className = 'confetti';
  const kleuren = ['#d8b45a', '#f1dc9a', '#fff6d6', '#c0304e', '#a8812f'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.style.setProperty('--x', Math.random() * 100 + 'vw');
    s.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
    s.style.setProperty('--d', (1.8 + Math.random() * 1.6) + 's');
    s.style.setProperty('--r', Math.random() * 720 + 'deg');
    s.style.background = kleuren[i % kleuren.length];
    s.style.animationDelay = Math.random() * 0.4 + 's';
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4200);
}

/* ---------- Mini-opmaaktaal voor informatiepagina's ----------
   # Kop   ## Subkop   - lijstje   1. genummerd   [ ] afvinklijst
   > opvallend blok   | tabel |   --- scheidingslijn   **vet**  _cursief_  [tekst](https://...) */
function maakMijMatcher(naam, tekst) {
  if (!naam) return null;
  const re = s => new RegExp('(^|[^\\p{L}])' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}])', 'iu');
  const vol = re(naam.trim());
  if (vol.test(tekst || '')) return vol;
  const voor = naam.trim().split(/\s+/)[0];
  return voor.length > 1 ? re(voor) : null;
}

function md(tekst, opts = {}) {
  const regels = String(tekst || '').replace(/\r/g, '').split('\n');
  const mij = maakMijMatcher(opts.naam, tekst);
  const cls = r => (mij && mij.test(r) ? ' class="mij"' : '');
  const inl = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])_(.+?)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const blokStart = t => /^(#{1,3}\s|[-*•]\s|\d+[.)]\s|>|\||\[( |x|X)\]\s|-{3,}$)/.test(t);
  const out = [];
  let i = 0, ck = 0, m;

  while (i < regels.length) {
    const t = regels[i].trim();
    if (!t) { i++; continue; }

    if ((m = t.match(/^(#{1,3})\s+(.*)$/))) {
      const n = m[1].length + 1;
      out.push(`<h${n}>${inl(m[2])}</h${n}>`); i++; continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(t)) { out.push('<div class="sierlijn"><span>◆</span></div>'); i++; continue; }

    if (t.startsWith('>')) {
      const buf = [];
      while (i < regels.length && regels[i].trim().startsWith('>')) { buf.push(regels[i].trim().replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote>${buf.map(inl).join('<br>')}</blockquote>`); continue;
    }

    if (t.startsWith('|')) {
      const rijen = [];
      while (i < regels.length && regels[i].trim().startsWith('|')) { rijen.push(regels[i].trim()); i++; }
      const cellen = r => r.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const isSep = r => /^\|?[\s:|-]+\|?$/.test(r) && r.includes('-');
      const kop = rijen.length > 1 && isSep(rijen[1]);
      const body = rijen.filter(r => !isSep(r));
      const tr = (r, tag) => `<tr${cls(r)}>${cellen(r).map(c => `<${tag}>${inl(c)}</${tag}>`).join('')}</tr>`;
      out.push('<div class="tabelwrap"><table>'
        + (kop ? `<thead>${tr(body[0], 'th')}</thead><tbody>${body.slice(1).map(r => tr(r, 'td')).join('')}</tbody>`
               : `<tbody>${body.map(r => tr(r, 'td')).join('')}</tbody>`)
        + '</table></div>');
      continue;
    }

    if (/^\[( |x|X)\]\s/.test(t)) {
      const items = [];
      while (i < regels.length && /^\[( |x|X)\]\s/.test(regels[i].trim())) { items.push(regels[i].trim().replace(/^\[( |x|X)\]\s+/, '')); i++; }
      out.push('<ul class="checklijst">' + items.map(it =>
        `<li${cls(it)}><label><input type="checkbox" data-ck="${ck++}"><span>${inl(it)}</span></label></li>`).join('') + '</ul>');
      continue;
    }

    if (/^[-*•]\s+/.test(t)) {
      const items = [];
      while (i < regels.length && /^[-*•]\s+/.test(regels[i].trim())) { items.push(regels[i].trim().replace(/^[-*•]\s+/, '')); i++; }
      out.push('<ul>' + items.map(it => `<li${cls(it)}>${inl(it)}</li>`).join('') + '</ul>'); continue;
    }

    if (/^\d+[.)]\s+/.test(t)) {
      const items = [];
      while (i < regels.length && /^\d+[.)]\s+/.test(regels[i].trim())) { items.push(regels[i].trim().replace(/^\d+[.)]\s+/, '')); i++; }
      out.push('<ol>' + items.map(it => `<li${cls(it)}>${inl(it)}</li>`).join('') + '</ol>'); continue;
    }

    const buf = [];
    while (i < regels.length && regels[i].trim() && !blokStart(regels[i].trim())) { buf.push(regels[i].trim()); i++; }
    if (!buf.length) { buf.push(t); i++; }
    out.push(`<p${cls(buf.join(' '))}>${buf.map(inl).join('<br>')}</p>`);
  }
  return raw(out.join('\n'));
}

/* Onthoudt afgevinkte items op dit apparaat */
function koppelChecklist(root, sleutel) {
  const k = 'ck:' + sleutel;
  let st = {};
  try { st = JSON.parse(localStorage.getItem(k) || '{}'); } catch (e) { st = {}; }
  $$('input[data-ck]', root).forEach(cb => {
    const li = cb.closest('li');
    cb.checked = !!st[cb.dataset.ck];
    li.classList.toggle('klaar', cb.checked);
    cb.addEventListener('change', () => {
      st[cb.dataset.ck] = cb.checked;
      li.classList.toggle('klaar', cb.checked);
      try { localStorage.setItem(k, JSON.stringify(st)); } catch (e) { /* geen opslag beschikbaar */ }
    });
  });
}

/* ---------- Foto's ---------- */
function compressImage(file, max = 1600, kwaliteit = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('Kies een afbeelding (foto).'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * f));
      c.height = Math.max(1, Math.round(img.naturalHeight * f));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('Foto verkleinen is mislukt.'))), 'image/jpeg', kwaliteit);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Deze foto kan niet worden gelezen.')); };
    img.src = url;
  });
}

/* Groot bekijken, bladeren met pijlen of toetsen. items: [{ src, caption }] */
function openLightbox(items, start = 0) {
  let n = start;
  const ov = document.createElement('div');
  ov.className = 'lightbox';
  const toon = () => {
    const it = items[n];
    ov.innerHTML = html`
      <button class="lb-sluit" aria-label="Sluiten">✕</button>
      ${items.length > 1 ? html`<button class="lb-pijl links" aria-label="Vorige">‹</button><button class="lb-pijl rechts" aria-label="Volgende">›</button>` : ''}
      <figure><img src="${it.src}" alt=""><figcaption>${it.caption || ''}</figcaption></figure>
      <a class="lb-open" href="${it.src}" target="_blank" rel="noopener">Open origineel</a>`.s;
    $('.lb-sluit', ov).onclick = sluit;
    const l = $('.links', ov), r = $('.rechts', ov);
    if (l) l.onclick = e => { e.stopPropagation(); n = (n - 1 + items.length) % items.length; toon(); };
    if (r) r.onclick = e => { e.stopPropagation(); n = (n + 1) % items.length; toon(); };
  };
  const toets = e => {
    if (e.key === 'Escape') sluit();
    if (e.key === 'ArrowLeft' && $('.links', ov)) $('.links', ov).click();
    if (e.key === 'ArrowRight' && $('.rechts', ov)) $('.rechts', ov).click();
  };
  function sluit() { document.removeEventListener('keydown', toets); ov.remove(); }
  ov.addEventListener('click', e => { if (e.target === ov || e.target.tagName === 'FIGURE') sluit(); });
  document.addEventListener('keydown', toets);
  document.body.appendChild(ov);
  toon();
}

/* ---------- Filmpjes ---------- */
function videoEmbed(url) {
  let m;
  if ((m = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/)))
    return { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${m[1]}` };
  if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-z0-9]+))?/i)))
    return { type: 'iframe', src: `https://player.vimeo.com/video/${m[1]}${m[2] ? '?h=' + m[2] : ''}` };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { type: 'video', src: url };
  return { type: 'link', src: url };
}
