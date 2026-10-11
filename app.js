/* ============================================================
   Hoofdprogramma: inlogscherm, navigatie en routering
   ============================================================ */

const DEELNEMER_NAV = [
  { k: '', label: 'Home', ico: '✦', f: dnHome },
  { k: 'info', label: 'Info', ico: '❖', f: dnInfo },
  { k: 'citygame', label: 'Citygame', ico: '⚑', f: dnCitygame },
  { k: 'fotos', label: "Foto's", ico: '◉', f: dnFotos },
  { k: 'filmpjes', label: 'Filmpjes', ico: '▶', f: dnFilmpjes },
  { k: 'vragen', label: 'Vragen', ico: '✉', f: dnVragen },
];

const ORG_NAV = [
  { k: '', label: 'Overzicht', ico: '✦', f: orgOverzicht },
  { k: 'info', label: "Pagina's", ico: '❖', f: orgInfo },
  { k: 'berichten', label: 'Berichten', ico: '✉', f: orgBerichten, badge: true },
  { k: 'citygame', label: 'Citygame', ico: '⚑', f: orgCitygame },
  { k: 'fotos', label: "Foto's", ico: '◉', f: orgFotos },
  { k: 'filmpjes', label: 'Filmpjes', ico: '▶', f: orgFilmpjes },
  { k: 'deelnemers', label: 'Deelnemers', ico: '♀', f: orgDeelnemers },
];

/* Opruimfuncties per scherm (bijvoorbeeld timers) */
let _leaveFns = [];
const onLeave = fn => _leaveFns.push(fn);
const runLeave = () => { _leaveFns.forEach(f => { try { f(); } catch (e) { /* negeren */ } }); _leaveFns = []; };

let _routeToken = 0;
let _badgeTimer = null;

/* ---------------- Inlogscherm ---------------- */
function toonLogin() {
  clearInterval(_badgeTimer);
  $('#app').innerHTML = html`
    <div class="login">
      <div class="zon"></div>
      <div class="login-kaart kaart">
        <p class="kop">${CONFIG.EVENT_KOP}</p>
        <h1 class="goud">${CONFIG.EVENT_TITEL}</h1>
        <p class="onder">${CONFIG.EVENT_ONDERTITEL}</p>
        ${sierlijn()}
        <div class="tabs" role="tablist">
          <button class="tab actief" type="button" data-tab="deelnemer">Deelnemer</button>
          <button class="tab" type="button" data-tab="organisatie">Organisatie</button>
        </div>
        <form id="loginForm" autocomplete="on">
          <label>Naam<input name="naam" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
          <label>Wachtwoord<input name="wachtwoord" type="password" autocomplete="current-password" required></label>
          <button class="knop-goud breed" id="loginKnop">Betreed het gala</button>
          <p class="fout" id="loginFout" role="alert"></p>
        </form>
        <p class="klein midden">Je naam en wachtwoord krijg je van de organisatie.</p>
      </div>
    </div>`.s;

  let tab = 'deelnemer';
  $$('.tab').forEach(b => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    $$('.tab').forEach(x => x.classList.toggle('actief', x === b));
    $('#loginKnop').textContent = tab === 'organisatie' ? 'Naar de organisatie' : 'Betreed het gala';
    $('.login-kaart').classList.toggle('org', tab === 'organisatie');
    $('#loginFout').textContent = '';
  }));

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, knop = $('#loginKnop'), fout = $('#loginFout');
    fout.textContent = '';
    knop.disabled = true;
    try {
      await inloggen(f.naam.value, f.wachtwoord.value, tab);
      await laadBasis();
      location.hash = '#/';
      route();
    } catch (err) {
      fout.textContent = foutTekst(err);
      knop.disabled = false;
    }
  });
}

function toonConfigFout() {
  $('#app').innerHTML = html`
    <div class="login"><div class="login-kaart kaart">
      <h1 class="goud">Bijna klaar</h1>
      <p>De pagina is nog niet gekoppeld aan Supabase.</p>
      <p class="klein">Open <code>js/config.js</code> en vul <code>SUPABASE_URL</code> en <code>SUPABASE_ANON_KEY</code> in. De stappen staan in de README.</p>
    </div></div>`.s;
}

/* ---------------- Basisopzet na het inloggen ---------------- */
function bouwShell() {
  const org = state.profiel.rol === 'organisatie';
  const nav = org ? ORG_NAV : DEELNEMER_NAV;
  $('#app').innerHTML = html`
    <div class="shell ${org ? 'is-org' : ''}">
      <header class="topbalk">
        <a class="merk" href="#/"><span class="merk-ruit">◆</span><span class="merk-tekst">${CONFIG.EVENT_KOP} <b>${CONFIG.EVENT_TITEL}</b></span></a>
        <div class="wie">
          ${org ? html`<span class="tag">Organisatie</span>` : ''}
          <a href="#/profiel" class="wie-naam">${state.profiel.naam}</a>
          <button id="uitlogTop" class="uitlog" title="Uitloggen" aria-label="Uitloggen">⏻</button>
        </div>
      </header>
      <nav class="nav" id="nav">${nav.map(n => html`
        <a href="#/${n.k}" data-k="${n.k}"><span class="ico">${n.ico}</span><span class="lbl">${n.label}</span>
          ${n.badge ? html`<em class="badge" id="badge-berichten" hidden></em>` : ''}</a>`)}</nav>
      <main id="view" class="view"></main>
      <footer class="voet">${sierlijn()}<small>${CONFIG.EVENT_KOP} ${CONFIG.EVENT_TITEL}</small></footer>
    </div>`.s;
  $('#uitlogTop').addEventListener('click', () => uitloggen());
  if (org) { orgBadge(); _badgeTimer = setInterval(orgBadge, 30000); }
}

async function uitloggen() {
  runLeave();
  clearInterval(_badgeTimer);
  await sb.auth.signOut();
  state.profiel = null; state.user = null;
  location.hash = '';
  route();
}

/* ---------------- Routering ---------------- */
async function route() {
  runLeave();
  if (!sb) return toonConfigFout();
  if (!state.profiel) return toonLogin();
  if (!$('#view')) bouwShell();

  const org = state.profiel.rol === 'organisatie';
  const nav = org ? ORG_NAV : DEELNEMER_NAV;
  const [k = '', ...rest] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const item = nav.find(n => n.k === k) || (k === 'profiel' ? { k: 'profiel', f: dnProfiel } : nav[0]);

  $$('#nav a').forEach(a => a.classList.toggle('actief', a.dataset.k === item.k));

  const token = ++_routeToken;
  const doos = document.createElement('div');
  doos.className = 'pagina';
  doos.innerHTML = '<div class="laden"><span class="spinner"></span></div>';
  $('#view').replaceChildren(doos);

  try {
    await item.f(doos, nav.find(n => n.k === k) ? rest : []);
  } catch (err) {
    if (token !== _routeToken) return;
    console.error(err);
    doos.innerHTML = html`<div class="kaart foutkaart"><h3>Dit scherm kon niet laden</h3><p>${foutTekst(err)}</p>
      <button class="knop-rand" id="opnieuw">Opnieuw proberen</button></div>`.s;
    $('#opnieuw', doos).addEventListener('click', route);
  }
  if (token === _routeToken) window.scrollTo(0, 0);
}

/* ---------------- Start ---------------- */
async function start() {
  if (!sb) return toonConfigFout();
  try {
    const p = await laadProfiel();
    if (p) state.profiel = p;
    if (state.profiel) await laadBasis();
  } catch (e) { console.error(e); }

  window.addEventListener('hashchange', route);
  sb.auth.onAuthStateChange(ev => {
    if (ev === 'SIGNED_OUT' && state.profiel) { state.profiel = null; route(); }
  });
  route();
}

start();
