/* ============================================================
   Deelnemers: alle schermen
   ============================================================ */

const dnLeeg = (icoon, titel, tekst = '') => html`
  <div class="leeg"><div class="leeg-icoon">${icoon}</div><h3>${titel}</h3>${tekst ? html`<p>${tekst}</p>` : ''}</div>`;

const groepChip = nr => nr
  ? html`<span class="groepchip" style="--gk:${groepKleur(nr)}">${groepNaam(nr)}</span>`
  : html`<span class="groepchip" style="--gk:#777">Nog geen groep</span>`;

const sierlijn = () => html`<div class="sierlijn"><span>◆</span></div>`;

/* ---------------- Home ---------------- */
async function dnHome(root) {
  await laadBasis();
  const paginas = must(await sb.from('paginas').select('slug,titel,icoon').order('volgorde'));
  const i = state.instellingen;
  const voornaam = state.profiel.naam.split(' ')[0];
  const cgOpen = i.citygame_open === true;
  const start = CONFIG.WEEKEND_START ? new Date(CONFIG.WEEKEND_START) : null;
  const aftellen = start && start > new Date();

  const tegel = (href, ico, titel, sub, slot = false) => html`
    <a class="tegel ${slot ? 'slot' : ''}" href="${href}">
      <span class="tegel-ico">${ico}</span>
      <b>${titel}</b><small>${sub}</small>
      ${slot ? html`<span class="hangslot">🔒</span>` : ''}
    </a>`;

  root.innerHTML = html`
    <section class="hero">
      <div class="zon"></div>
      <p class="kop">${CONFIG.EVENT_KOP}</p>
      <h1 class="goud">${CONFIG.EVENT_TITEL}</h1>
      <p class="onder">${CONFIG.EVENT_ONDERTITEL}</p>
      ${sierlijn()}
      <p class="welkom">Welkom, <b>${voornaam}</b></p>
      ${aftellen ? html`<div class="aftellen" id="aftellen"></div>` : ''}
    </section>

    ${i.mededeling ? html`<div class="mededeling"><span>✦ Mededeling van de organisatie</span><p>${i.mededeling}</p></div>` : ''}

    <div class="tegels">
      ${tegel('#/citygame', '⚑', 'Citygame', cgOpen ? 'Het spel is geopend!' : 'Opent tijdens het weekend', !cgOpen)}
      ${tegel('#/filmpjes', '▶', 'Filmpjes', 'Bekijk de berichten')}
      ${tegel('#/vragen', '✉', 'Vragen & input', 'Praat mee met de organisatie')}
      ${tegel('#/fotos', '◉', "Foto's", i.galerij_open === true ? 'Alle foto\'s staan online' : 'Jullie momenten')}
    </div>

    <h2 class="sectie">Informatie</h2>
    ${paginas.length
      ? html`<div class="tegels">${paginas.map(p => tegel('#/info/' + p.slug, p.icoon, p.titel, 'Bekijken'))}</div>
             <p class="klein midden">De organisatie maakt stap voor stap meer informatie zichtbaar.</p>`
      : dnLeeg('✦', 'Binnenkort meer', 'Zodra de organisatie informatie vrijgeeft, verschijnt die hier.')}
  `.s;

  if (aftellen) {
    const el = $('#aftellen', root);
    const tick = () => {
      const ms = start - new Date();
      if (ms <= 0) { el.textContent = 'Het weekend is begonnen!'; return; }
      const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
      el.innerHTML = [[d, 'dagen'], [h, 'uur'], [m, 'min'], [s, 'sec']].map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('');
    };
    tick();
    const t = setInterval(tick, 1000);
    onLeave(() => clearInterval(t));
  }
}

/* ---------------- Informatie ---------------- */
async function dnInfo(root, [slug]) {
  if (slug) return dnInfoDetail(root, slug);
  const paginas = must(await sb.from('paginas').select('slug,titel,icoon,bijgewerkt_op').order('volgorde'));
  root.innerHTML = html`
    <h1 class="titel">Informatie</h1>
    ${paginas.length
      ? html`<div class="lijstkaarten">${paginas.map(p => html`
          <a class="kaart link" href="#/info/${p.slug}"><span class="kaart-ico">${p.icoon}</span>
            <span><b>${p.titel}</b><small>Bijgewerkt ${fmtDatum(p.bijgewerkt_op)}</small></span><span class="pijl">›</span></a>`)}</div>
         <p class="klein midden">Er komt stap voor stap meer informatie bij.</p>`
      : dnLeeg('✦', 'Nog niets beschikbaar', 'De organisatie geeft binnenkort de eerste informatie vrij.')}
  `.s;
}

async function dnInfoDetail(root, slug) {
  const p = must(await sb.from('paginas').select('*').eq('slug', slug).maybeSingle());
  if (!p) {
    root.innerHTML = html`<a class="terug" href="#/info">‹ Terug</a>${dnLeeg('🔒', 'Nog niet beschikbaar', 'Deze pagina is nog niet vrijgegeven.')}`.s;
    return;
  }
  root.innerHTML = html`
    <a class="terug" href="#/info">‹ Alle informatie</a>
    <article class="kaart artikel">
      <div class="artikel-ico">${p.icoon}</div>
      <div class="inhoud">${md(p.inhoud, { naam: state.profiel.naam })}</div>
      <p class="klein midden">Bijgewerkt ${fmtDatum(p.bijgewerkt_op)}</p>
    </article>`.s;
  koppelChecklist(root, p.id + ':' + state.user.id);
}

/* ---------------- Vragen en input ---------------- */
async function dnVragen(root) {
  const lijst = must(await sb.from('berichten').select('*').order('aangemaakt_op', { ascending: false }));
  root.innerHTML = html`
    <h1 class="titel">Vragen &amp; input</h1>
    <p class="uitleg">Heb je een vraag, wil je iets laten weten of heb je een idee? Stuur het hier naar de organisatie. Alleen jij en de organisatie zien je bericht.</p>
    <form id="vraagForm" class="kaart formulier">
      <label>Wat wil je doen?
        <select name="soort"><option value="vraag">Een vraag stellen</option><option value="input">Input of een idee geven</option></select>
      </label>
      <label>Je bericht<textarea name="tekst" rows="4" maxlength="2000" required placeholder="Typ hier…"></textarea></label>
      <button class="knop-goud">Versturen</button>
    </form>
    <h2 class="sectie">Jouw berichten</h2>
    ${lijst.length ? html`<div class="berichten">${lijst.map(b => html`
      <div class="bericht">
        <div class="bericht-kop"><span class="tag">${b.soort === 'vraag' ? 'Vraag' : 'Input'}</span><small>${fmtDatum(b.aangemaakt_op)}</small></div>
        <p>${b.tekst}</p>
        ${b.antwoord
          ? html`<div class="antwoord"><span>Antwoord van de organisatie</span><p>${b.antwoord}</p></div>`
          : html`<p class="wacht">${b.soort === 'vraag' ? 'Wacht op antwoord…' : 'Ontvangen. Bedankt!'}</p>`}
      </div>`)}</div>`
      : dnLeeg('✉', 'Nog geen berichten', 'Je eerste bericht verschijnt hier.')}
  `.s;

  $('#vraagForm', root).addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, tekst = f.tekst.value.trim();
    if (!tekst) return;
    const knop = $('button', f);
    knop.disabled = true;
    try {
      must(await sb.from('berichten').insert({ user_id: state.user.id, soort: f.soort.value, tekst }));
      toast('Verstuurd! De organisatie ziet het meteen.');
      await dnVragen(root);
    } catch (err) { toast(foutTekst(err), 'err'); knop.disabled = false; }
  });
}

/* ---------------- Filmpjes ---------------- */
async function speelVideo(box, v) {
  box.innerHTML = '<div class="laden">Laden…</div>';
  if (v.bestandspad) {
    const u = (await signedUrls('videos', [v.bestandspad]))[v.bestandspad];
    box.innerHTML = u
      ? html`<video controls playsinline preload="metadata" autoplay src="${u}"></video>`.s
      : '<p class="fout">Dit filmpje kon niet worden geladen.</p>';
    return;
  }
  const e = videoEmbed(v.externe_url || '');
  if (e.type === 'iframe') box.innerHTML = html`<div class="embed"><iframe src="${e.src}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`.s;
  else if (e.type === 'video') box.innerHTML = html`<video controls playsinline autoplay src="${e.src}"></video>`.s;
  else box.innerHTML = html`<a class="knop-goud" href="${safeUrl(e.src)}" target="_blank" rel="noopener">Open filmpje</a>`.s;
}

async function dnFilmpjes(root) {
  const lijst = must(await sb.from('videos').select('*').order('volgorde').order('aangemaakt_op'));
  root.innerHTML = html`
    <h1 class="titel">Filmpjes</h1>
    ${lijst.length ? html`<div class="filmlijst">${lijst.map(v => html`
      <article class="kaart film" data-id="${v.id}">
        <button class="film-start" type="button"><span class="speel">▶</span><span><b>${v.titel}</b>${v.beschrijving ? html`<small>${v.beschrijving}</small>` : ''}</span></button>
        <div class="speler"></div>
      </article>`)}</div>`
      : dnLeeg('▶', 'Nog geen filmpjes', 'De organisatie zet hier binnenkort filmpjes klaar.')}
  `.s;

  $$('.film', root).forEach(el => {
    $('.film-start', el).addEventListener('click', () => {
      const v = lijst.find(x => x.id === el.dataset.id);
      $$('.speler', root).forEach(s => { if (s !== $('.speler', el)) s.innerHTML = ''; });
      speelVideo($('.speler', el), v).catch(err => toast(foutTekst(err), 'err'));
    });
  });
}

/* ---------------- Foto's ---------------- */
function fotoGrid(fotos, urls, { toonNaam = true } = {}) {
  return html`<div class="fotogrid">${fotos.map((f, idx) => html`
    <figure class="foto" data-idx="${idx}">
      <img loading="lazy" src="${urls[f.bestandspad]}" alt="">
      <figcaption>
        <span class="groepdot" style="--gk:${groepKleur(f.groep)}"></span>
        ${f.bijschrift ? html`<span>${f.bijschrift}</span>` : ''}
        ${toonNaam && f.profiles ? html`<small>${f.profiles.naam}</small>` : ''}
      </figcaption>
    </figure>`)}</div>`;
}

function koppelFotoGrid(box, fotos, urls) {
  const items = fotos.map(f => ({
    src: urls[f.bestandspad],
    caption: [f.profiles ? f.profiles.naam : '', groepNaam(f.groep), f.bijschrift || ''].filter(Boolean).join(' · '),
  }));
  $$('.foto', box).forEach(el => el.addEventListener('click', () => openLightbox(items, Number(el.dataset.idx))));
}

async function dnFotos(root) {
  await laadBasis();
  const galerijOpen = state.instellingen.galerij_open === true;
  const spelOpen = state.instellingen.citygame_open === true;
  const fotos = must(await sb.from('fotos').select('*, profiles(naam)').order('aangemaakt_op', { ascending: false }));
  const urls = await signedUrls('fotos', fotos.map(f => f.bestandspad));

  root.innerHTML = html`
    <h1 class="titel">Foto's</h1>
    <p class="uitleg">${galerijOpen
      ? 'Alle foto\'s van alle groepen. Klik op een foto om hem groot te bekijken.'
      : 'De fotogalerij met de foto\'s van alle groepen opent na het weekend. Tot dan zie je hier de foto\'s van je eigen groep.'}</p>
    ${spelOpen ? html`<label class="knop-goud uploadknop">+ Foto toevoegen
        <input type="file" accept="image/*" multiple hidden id="fotoInput"></label>` : ''}
    ${fotos.length ? fotoGrid(fotos, urls) : dnLeeg('◉', 'Nog geen foto\'s', spelOpen ? 'Voeg de eerste foto toe!' : 'Tijdens de citygame verschijnen hier jullie foto\'s.')}
  `.s;

  koppelFotoGrid(root, fotos, urls);
  const inp = $('#fotoInput', root);
  if (inp) inp.addEventListener('change', async () => {
    const files = Array.from(inp.files);
    if (!files.length) return;
    toast(`${files.length} foto${files.length > 1 ? '\'s' : ''} uploaden…`);
    try {
      for (const f of files) await uploadFoto(f);
      toast('Foto\'s toegevoegd!');
      await dnFotos(root);
    } catch (err) { toast(foutTekst(err), 'err'); }
  });
}

/* ---------------- Citygame ---------------- */
async function dnCitygame(root) {
  await laadBasis();
  if (state.instellingen.citygame_open !== true) {
    root.innerHTML = html`
      <h1 class="titel">Citygame</h1>
      <div class="kaart vergrendeld">
        <div class="slot-groot">🔒</div>
        <h2>De citygame opent tijdens het weekend</h2>
        <p>Zodra de organisatie het spel start, verschijnt hier jullie route. Deze pagina ververst vanzelf.</p>
      </div>`.s;
    const t = setInterval(async () => {
      await laadBasis();
      if (state.instellingen.citygame_open === true) { clearInterval(t); dnCitygame(root); }
    }, 15000);
    onLeave(() => clearInterval(t));
    return;
  }

  const groep = state.profiel.groep;
  if (!groep) {
    root.innerHTML = html`<h1 class="titel">Citygame</h1>${dnLeeg('⚑', 'Je bent nog niet ingedeeld', 'Vraag de organisatie in welke groep je zit.')}`.s;
    return;
  }

  const [stops, antw, voortgang] = await Promise.all([
    sb.from('cg_stops').select('*').eq('groep', groep).order('volgorde').then(must),
    sb.from('cg_antwoorden').select('*').eq('groep', groep).order('aangemaakt_op').then(must),
    sb.rpc('cg_voortgang').then(must),
  ]);

  const totaal = voortgang ? voortgang.totaal : stops.length;
  const goed = new Set(antw.filter(a => a.juist !== false).map(a => a.stop_id));
  const huidigIdx = stops.findIndex(s => !goed.has(s.id));
  const huidig = huidigIdx >= 0 ? stops[huidigIdx] : null;
  const klaar = !huidig && totaal > 0 && goed.size >= totaal;
  const afgerond = Math.min(goed.size, totaal);
  const pct = totaal ? Math.round(afgerond / totaal * 100) : 0;
  const antwoordVan = id => (antw.filter(a => a.stop_id === id && a.juist !== false).pop() || {}).tekst;

  root.innerHTML = html`
    <div class="cg-kop">
      <h1 class="titel">Citygame</h1>
      ${groepChip(groep)}
    </div>
    ${totaal ? html`<div class="voortgang-blok"><div class="voortgang"><div class="balk" style="width:${pct}%"></div></div>
      <small>${afgerond} van ${totaal} opdrachten afgerond</small></div>` : ''}

    ${klaar ? html`<div class="kaart finale"><div class="finale-ico">♛</div><h2>Jullie hebben de route afgerond!</h2>
        <p>Geweldig gedaan, ${groepNaam(groep)}. Meld jullie bij de organisatie.</p></div>` : ''}

    ${!stops.length && !klaar ? dnLeeg('⚑', 'De route wordt nog klaargezet', 'Even geduld, de organisatie is bezig.') : ''}

    ${huidig ? html`
      <article class="kaart opdracht">
        <div class="opdracht-kop"><span class="nummer">Opdracht ${huidigIdx + 1}</span><h2>${huidig.titel}</h2></div>
        ${huidig.opdracht ? html`<div class="inhoud">${md(huidig.opdracht)}</div>` : ''}
        ${huidig.vraag ? html`<div class="vraagblok"><h4>De vraag</h4><div class="inhoud">${md(huidig.vraag)}</div></div>` : ''}
        ${huidig.hint ? html`<details class="hint"><summary>Tip nodig?</summary><p>${huidig.hint}</p></details>` : ''}
        <form id="antwoordForm" class="formulier">
          ${huidig.antwoord_type !== 'foto' ? html`<label>Jullie antwoord<input name="antwoord" autocomplete="off" required></label>` : ''}
          ${huidig.antwoord_type !== 'tekst' ? html`
            <label class="foto-kies">${huidig.antwoord_type === 'foto' ? 'Maak of kies jullie foto' : 'Voeg een foto toe'}
              <input type="file" name="foto" accept="image/*" ${huidig.antwoord_type === 'foto' ? 'required' : ''}></label>
            <img id="fotoVoorbeeld" class="voorbeeld" alt="" hidden>` : ''}
          <button class="knop-goud">Antwoord insturen</button>
        </form>
      </article>` : ''}

    ${huidigIdx !== 0 && stops.some(s => goed.has(s.id)) ? html`
      <h2 class="sectie">Afgerond</h2>
      <div class="afgerond">${stops.filter(s => goed.has(s.id)).map(s => html`
        <details class="kaart"><summary><span class="vink">✓</span> ${s.titel}</summary>
          ${antwoordVan(s.id) ? html`<p>Antwoord: <b>${antwoordVan(s.id)}</b></p>` : html`<p>Foto ingestuurd.</p>`}</details>`)}</div>` : ''}
  `.s;

  const form = $('#antwoordForm', root);
  if (!form) return;
  const bestandVeld = form.foto;
  if (bestandVeld) bestandVeld.addEventListener('change', () => {
    const v = $('#fotoVoorbeeld', root), f = bestandVeld.files[0];
    if (f) { v.src = URL.createObjectURL(f); v.hidden = false; } else v.hidden = true;
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const knop = $('button', form);
    knop.disabled = true;
    knop.textContent = 'Bezig met insturen…';
    try {
      let fotoId = null;
      if (bestandVeld && bestandVeld.files[0]) fotoId = await uploadFoto(bestandVeld.files[0], { stop_id: huidig.id });
      const tekst = form.antwoord ? form.antwoord.value.trim() : null;
      const juist = must(await sb.rpc('dien_antwoord_in', { p_stop: huidig.id, p_tekst: tekst, p_foto: fotoId }));
      if (juist === false) {
        toast('Helaas, dat is niet het juiste antwoord. Probeer het nog eens!', 'err');
        knop.disabled = false; knop.textContent = 'Antwoord insturen';
        return;
      }
      confetti();
      toast(juist === true ? 'Goed zo! Op naar de volgende opdracht.' : 'Ingestuurd! De organisatie kijkt mee.');
      await dnCitygame(root);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast(foutTekst(err), 'err');
      knop.disabled = false; knop.textContent = 'Antwoord insturen';
    }
  });
}

/* ---------------- Profiel ---------------- */
async function dnProfiel(root) {
  await laadBasis();
  const p = state.profiel;
  root.innerHTML = html`
    <h1 class="titel">Mijn profiel</h1>
    <div class="kaart profiel">
      <p class="profiel-naam">${p.naam}</p>
      <p>${p.rol === 'organisatie' ? html`<span class="tag">Organisatie</span>` : groepChip(p.groep)}</p>
    </div>
    <form id="pwForm" class="kaart formulier">
      <h3>Wachtwoord wijzigen</h3>
      <label>Nieuw wachtwoord<input type="password" name="nieuw" minlength="6" autocomplete="new-password" required></label>
      <label>Herhaal wachtwoord<input type="password" name="nieuw2" minlength="6" autocomplete="new-password" required></label>
      <button class="knop-goud">Opslaan</button>
    </form>
    <button id="uitlogKnop" class="knop-rand">Uitloggen</button>
  `.s;

  $('#pwForm', root).addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    if (f.nieuw.value !== f.nieuw2.value) return toast('De wachtwoorden zijn niet gelijk.', 'err');
    try {
      const { error } = await sb.auth.updateUser({ password: f.nieuw.value });
      if (error) throw error;
      f.reset();
      toast('Wachtwoord gewijzigd.');
    } catch (err) { toast(foutTekst(err), 'err'); }
  });
  $('#uitlogKnop', root).addEventListener('click', () => uitloggen());
}
