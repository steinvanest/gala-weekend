/* ============================================================
   Organisatie: alle schermen
   ============================================================ */

const schakelaar = (id, aan, label, sub = '') => html`
  <label class="schakelaar">
    <input type="checkbox" id="${id}" ${aan ? 'checked' : ''}>
    <span class="knop"></span>
    <span class="tekst"><b>${label}</b><small>${sub}</small></span>
  </label>`;

async function setInstelling(sleutel, waarde) {
  must(await sb.from('instellingen').upsert({ sleutel, waarde }, { onConflict: 'sleutel' }));
  state.instellingen[sleutel] = waarde;
}

function koppelSchakelaars(root, kaart) {
  Object.entries(kaart).forEach(([id, [sleutel, aanTekst, uitTekst]]) => {
    const cb = $('#' + id, root);
    if (!cb) return;
    cb.addEventListener('change', async () => {
      try {
        await setInstelling(sleutel, cb.checked);
        toast(cb.checked ? aanTekst : uitTekst);
      } catch (err) { cb.checked = !cb.checked; toast(foutTekst(err), 'err'); }
    });
  });
}

async function orgBadge() {
  try {
    const { count } = await sb.from('berichten').select('id', { count: 'exact', head: true }).is('antwoord', null).eq('gelezen', false);
    const b = $('#badge-berichten');
    if (b) { b.textContent = count || ''; b.hidden = !count; }
  } catch (e) { /* stil */ }
}

/* ---------------- Overzicht ---------------- */
async function orgOverzicht(root) {
  await laadBasis();
  const [prof, pag, ber, foto, vid, stops] = await Promise.all([
    sb.from('profiles').select('id,rol,groep'),
    sb.from('paginas').select('id,vrijgegeven,zichtbaar_vanaf'),
    sb.from('berichten').select('id,antwoord,gelezen'),
    sb.from('fotos').select('id', { count: 'exact', head: true }),
    sb.from('videos').select('id,vrijgegeven'),
    sb.from('cg_stops').select('id,groep'),
  ]);
  const deel = (prof.data || []).filter(p => p.rol === 'deelnemer');
  const zonderGroep = deel.filter(p => !p.groep).length;
  const open = (ber.data || []).filter(b => !b.antwoord && !b.gelezen).length;
  const paginas = pag.data || [];
  const vrij = paginas.filter(p => p.vrijgegeven).length;
  const videos = vid.data || [];
  const i = state.instellingen;

  const stat = (titel, waarde, sub, href) => html`
    <a class="stat" href="${href}"><small>${titel}</small><b>${waarde}</b><span>${sub}</span></a>`;

  root.innerHTML = html`<div class="vw">
    <h1 class="titel">Overzicht</h1>

    <div class="kaart">
      <h3>Schakelaars voor het weekend</h3>
      <div class="schakelaars">
        ${schakelaar('sw-cg', i.citygame_open === true, 'Citygame is open', 'Deelnemers zien dan hun route en kunnen antwoorden insturen')}
        ${schakelaar('sw-gal', i.galerij_open === true, 'Fotogalerij is open voor iedereen', 'Aan = alle foto\'s van alle groepen zijn zichtbaar voor alle deelnemers')}
      </div>
    </div>

    <div class="statgrid">
      ${stat('Deelnemers', deel.length, zonderGroep ? zonderGroep + ' zonder groep' : 'allemaal ingedeeld', '#/deelnemers')}
      ${stat('Open berichten', open, open ? 'wachten op jou' : 'alles beantwoord', '#/berichten')}
      ${stat('Pagina\'s vrijgegeven', `${vrij}/${paginas.length}`, 'bekijk of beheer', '#/info')}
      ${stat('Opdrachten', (stops.data || []).length, 'in de 4 routes', '#/citygame')}
      ${stat('Foto\'s', foto.count || 0, 'ingestuurd', '#/fotos')}
      ${stat('Filmpjes', `${videos.filter(v => v.vrijgegeven).length}/${videos.length}`, 'vrijgegeven', '#/filmpjes')}
    </div>

    <form id="mededelingForm" class="kaart formulier">
      <h3>Mededeling voor alle deelnemers</h3>
      <p class="klein">Verschijnt bovenaan de startpagina, bijvoorbeeld "Verzamelen om 14:00 bij de voordeur".</p>
      <textarea name="tekst" rows="2" maxlength="300" placeholder="Laat leeg om de mededeling te verbergen">${i.mededeling || ''}</textarea>
      <button class="knop-goud klein">Plaatsen</button>
    </form>
  </div>`.s;

  koppelSchakelaars(root, {
    'sw-cg': ['citygame_open', 'Citygame geopend. Deelnemers zien nu hun route.', 'Citygame gesloten.'],
    'sw-gal': ['galerij_open', 'Fotogalerij is nu zichtbaar voor iedereen.', 'Fotogalerij weer verborgen.'],
  });
  $('#mededelingForm', root).addEventListener('submit', async e => {
    e.preventDefault();
    try { await setInstelling('mededeling', e.target.tekst.value.trim()); toast('Mededeling bijgewerkt.'); }
    catch (err) { toast(foutTekst(err), 'err'); }
  });
}

/* ---------------- Informatiepagina's ---------------- */
function paginaStatus(p) {
  const nu = new Date();
  if (p.vrijgegeven) return html`<span class="pil groen">Zichtbaar</span>`;
  if (p.zichtbaar_vanaf && new Date(p.zichtbaar_vanaf) <= nu) return html`<span class="pil groen">Zichtbaar (gepland)</span>`;
  if (p.zichtbaar_vanaf) return html`<span class="pil goud">Gepland: ${fmtDatum(p.zichtbaar_vanaf)}</span>`;
  return html`<span class="pil grijs">Verborgen</span>`;
}

async function orgInfo(root, [id]) {
  if (id) return orgInfoEdit(root, id);
  const lijst = must(await sb.from('paginas').select('*').order('volgorde'));
  root.innerHTML = html`<div class="vw">
    <div class="kopregel"><h1 class="titel">Informatiepagina's</h1><a class="knop-goud klein" href="#/info/nieuw">+ Nieuwe pagina</a></div>
    <p class="uitleg">Geef een pagina vrij zodra deelnemers hem mogen zien. Je kunt ook een moment instellen waarop hij vanzelf verschijnt.</p>
    <div class="rijen">${lijst.map((p, i) => html`
      <div class="rij" data-id="${p.id}">
        <div class="rij-icoon">${p.icoon}</div>
        <div class="rij-tekst"><b>${p.titel}</b><small>${paginaStatus(p)}</small></div>
        <div class="rij-acties">
          <button class="mini" data-act="up" ${i === 0 ? 'disabled' : ''} title="Omhoog">↑</button>
          <button class="mini" data-act="down" ${i === lijst.length - 1 ? 'disabled' : ''} title="Omlaag">↓</button>
          <button class="mini ${p.vrijgegeven ? '' : 'goud'}" data-act="toggle">${p.vrijgegeven ? 'Verberg' : 'Geef vrij'}</button>
          <a class="mini" href="#/info/${p.id}">Bewerken</a>
        </div>
      </div>`)}</div>
  </div>`.s;

  $('.rijen', root).addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const pid = b.closest('[data-id]').dataset.id;
    const idx = lijst.findIndex(p => p.id === pid);
    try {
      if (b.dataset.act === 'toggle') {
        const p = lijst[idx];
        must(await sb.from('paginas').update({ vrijgegeven: !p.vrijgegeven, bijgewerkt_op: new Date().toISOString() }).eq('id', pid));
        toast(p.vrijgegeven ? `"${p.titel}" is verborgen.` : `"${p.titel}" is vrijgegeven.`);
      } else {
        const naar = b.dataset.act === 'up' ? idx - 1 : idx + 1;
        const orde = lijst.map(p => p.id);
        [orde[idx], orde[naar]] = [orde[naar], orde[idx]];
        await Promise.all(orde.map((oid, n) => sb.from('paginas').update({ volgorde: (n + 1) * 10 }).eq('id', oid).then(must)));
      }
      await orgInfo(root, []);
    } catch (err) { toast(foutTekst(err), 'err'); }
  });
}

async function orgInfoEdit(root, id) {
  const nieuw = id === 'nieuw';
  let p = { titel: '', icoon: '❖', inhoud: '', vrijgegeven: false, zichtbaar_vanaf: null };
  if (!nieuw) {
    const r = must(await sb.from('paginas').select('*').eq('id', id).maybeSingle());
    if (!r) { root.innerHTML = html`<a class="terug" href="#/info">‹ Terug</a>${dnLeeg('?', 'Pagina niet gevonden')}`.s; return; }
    p = r;
  }
  root.innerHTML = html`<div class="vw">
    <a class="terug" href="#/info">‹ Alle pagina's</a>
    <h1 class="titel">${nieuw ? 'Nieuwe pagina' : 'Pagina bewerken'}</h1>
    <form id="pForm" class="formulier">
      <div class="kaart">
        <div class="twee smal-eerst">
          <label>Icoon<input name="icoon" maxlength="4" value="${p.icoon}"></label>
          <label>Titel<input name="titel" value="${p.titel}" required></label>
        </div>
        <label>Inhoud
          <textarea name="inhoud" rows="14" spellcheck="true">${p.inhoud}</textarea>
        </label>
        <details class="hulp"><summary>Hoe maak ik een mooie pagina?</summary>
          <pre># Grote kop
## Kleinere kop
Gewone tekst met **vet** en _cursief_.
- Een lijstje
1. Een genummerde lijst
[ ] Een afvinklijst (deelnemers kunnen vinken)
&gt; Een opvallend blok
---
| Auto | Chauffeur | Meerijders |
|---|---|---|
| Auto 1 | Anna | Bo, Cleo |
[Een link](https://voorbeeld.nl)</pre>
          <p>Staat de naam van een deelnemer in een regel of tabelrij? Dan licht die regel voor haar goud op, zodat ze direct ziet in welke auto of kamer ze zit.</p>
        </details>
      </div>
      <div class="kaart">
        <h3>Zichtbaarheid</h3>
        <label class="vink"><input type="checkbox" name="vrijgegeven" ${p.vrijgegeven ? 'checked' : ''}> Direct zichtbaar voor deelnemers</label>
        <label>Of: automatisch zichtbaar vanaf<input type="datetime-local" name="vanaf" value="${toLocalInput(p.zichtbaar_vanaf)}"></label>
      </div>
      <div class="kaart"><h3>Voorbeeld voor deelnemers</h3><div class="inhoud" id="voorbeeld"></div></div>
      <div class="knoppenrij">
        <button class="knop-goud">Opslaan</button>
        ${nieuw ? '' : html`<button type="button" class="knop-rand gevaar" id="wisPagina">Verwijderen</button>`}
      </div>
    </form>
  </div>`.s;

  const f = $('#pForm', root);
  const voorbeeld = () => { $('#voorbeeld', root).innerHTML = md(f.inhoud.value, { naam: state.profiel.naam }).s; };
  f.inhoud.addEventListener('input', voorbeeld);
  voorbeeld();

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const rec = {
      titel: f.titel.value.trim(), icoon: f.icoon.value.trim() || '❖', inhoud: f.inhoud.value,
      vrijgegeven: f.vrijgegeven.checked, zichtbaar_vanaf: fromLocalInput(f.vanaf.value),
      bijgewerkt_op: new Date().toISOString(),
    };
    try {
      if (nieuw) {
        const { data: m } = await sb.from('paginas').select('volgorde').order('volgorde', { ascending: false }).limit(1);
        rec.volgorde = ((m && m[0] ? m[0].volgorde : 0) || 0) + 10;
        let basis = slugify(rec.titel), ok = false;
        for (let poging = 0; poging < 4 && !ok; poging++) {
          rec.slug = poging ? `${basis}-${Math.random().toString(36).slice(2, 5)}` : basis;
          const { error } = await sb.from('paginas').insert(rec);
          if (!error) ok = true; else if (error.code !== '23505') throw error;
        }
        if (!ok) throw new Error('Kon geen unieke naam voor de pagina maken.');
      } else {
        must(await sb.from('paginas').update(rec).eq('id', id));
      }
      toast('Opgeslagen.');
      location.hash = '#/info';
    } catch (err) { toast(foutTekst(err), 'err'); }
  });

  const wis = $('#wisPagina', root);
  if (wis) wis.addEventListener('click', async () => {
    if (!confirm(`Pagina "${p.titel}" definitief verwijderen?`)) return;
    try { must(await sb.from('paginas').delete().eq('id', id)); toast('Pagina verwijderd.'); location.hash = '#/info'; }
    catch (err) { toast(foutTekst(err), 'err'); }
  });
}

/* ---------------- Berichten ---------------- */
let berFilter = 'open';

async function orgBerichten(root) {
  const alle = must(await sb.from('berichten').select('*, profiles(naam,groep)').order('aangemaakt_op', { ascending: false }));
  const isOpen = b => !b.antwoord && !b.gelezen;
  const telling = { open: alle.filter(isOpen).length, klaar: alle.filter(b => !isOpen(b)).length, alle: alle.length };
  const lijst = alle.filter(b => berFilter === 'alle' || (berFilter === 'open' ? isOpen(b) : !isOpen(b)));
  const chip = (k, t) => html`<button class="chip ${berFilter === k ? 'actief' : ''}" data-filter="${k}">${t} <span>${telling[k]}</span></button>`;

  root.innerHTML = html`<div class="vw">
    <h1 class="titel">Vragen &amp; input</h1>
    <div class="chips">${chip('open', 'Open')}${chip('klaar', 'Afgehandeld')}${chip('alle', 'Alles')}</div>
    ${lijst.length ? html`<div class="berichten">${lijst.map(b => html`
      <div class="bericht" data-id="${b.id}">
        <div class="bericht-kop">
          <b>${b.profiles ? b.profiles.naam : 'Onbekend'}</b>
          <span class="tag">${b.soort === 'vraag' ? 'Vraag' : 'Input'}</span>
          ${b.profiles && b.profiles.groep ? groepChip(b.profiles.groep) : ''}
          <small>${fmtDatum(b.aangemaakt_op)}</small>
        </div>
        <p>${b.tekst}</p>
        <form class="antwoordForm formulier">
          <textarea name="antwoord" rows="2" placeholder="Schrijf een antwoord…">${b.antwoord || ''}</textarea>
          <div class="knoppenrij">
            <button class="knop-goud klein">${b.antwoord ? 'Antwoord aanpassen' : 'Beantwoorden'}</button>
            ${!b.antwoord && !b.gelezen ? html`<button type="button" class="knop-rand klein" data-act="gelezen">Gelezen, geen antwoord nodig</button>` : ''}
            <button type="button" class="knop-rand klein gevaar" data-act="wis">Verwijderen</button>
          </div>
        </form>
      </div>`)}</div>`
      : dnLeeg('✉', berFilter === 'open' ? 'Alles is beantwoord' : 'Niets te tonen')}
  </div>`.s;

  $('.chips', root).addEventListener('click', e => {
    const c = e.target.closest('[data-filter]');
    if (c) { berFilter = c.dataset.filter; orgBerichten(root); }
  });

  $$('.bericht', root).forEach(el => {
    const id = el.dataset.id;
    const herlaad = async () => { await orgBerichten(root); orgBadge(); };
    $('.antwoordForm', el).addEventListener('submit', async e => {
      e.preventDefault();
      const tekst = e.target.antwoord.value.trim();
      if (!tekst) return toast('Schrijf eerst een antwoord.', 'err');
      try {
        must(await sb.from('berichten').update({
          antwoord: tekst, beantwoord_door: state.user.id, beantwoord_op: new Date().toISOString(), gelezen: true,
        }).eq('id', id));
        toast('Antwoord verstuurd.');
        await herlaad();
      } catch (err) { toast(foutTekst(err), 'err'); }
    });
    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      try {
        if (b.dataset.act === 'gelezen') must(await sb.from('berichten').update({ gelezen: true }).eq('id', id));
        if (b.dataset.act === 'wis') {
          if (!confirm('Dit bericht verwijderen?')) return;
          must(await sb.from('berichten').delete().eq('id', id));
        }
        await herlaad();
      } catch (err) { toast(foutTekst(err), 'err'); }
    });
  });
}

/* ---------------- Citygame ---------------- */
let cgGroep = 1;

async function orgCitygame(root) {
  await laadBasis();
  const groep = cgGroep;
  const [stops, sleutels, antw, leden] = await Promise.all([
    sb.from('cg_stops').select('*').eq('groep', groep).order('volgorde').then(must),
    sb.from('cg_sleutels').select('*').then(must),
    sb.from('cg_antwoorden').select('*, profiles(naam), cg_stops(titel,volgorde), fotos(bestandspad)')
      .eq('groep', groep).order('aangemaakt_op', { ascending: false }).then(must),
    sb.from('profiles').select('id,naam').eq('groep', groep).order('naam').then(must),
  ]);
  const sleutelVan = Object.fromEntries(sleutels.map(s => [s.stop_id, s.juist]));
  const urls = await signedUrls('fotos', antw.filter(a => a.fotos).map(a => a.fotos.bestandspad));
  const i = state.instellingen;
  const goed = new Set(antw.filter(a => a.juist !== false).map(a => a.stop_id));
  const opties = (waarde) => [['tekst', 'Alleen tekst'], ['foto', 'Alleen foto'], ['tekst_foto', 'Tekst en foto']]
    .map(([v, t]) => html`<option value="${v}" ${waarde === v ? 'selected' : ''}>${t}</option>`);

  root.innerHTML = html`<div class="vw">
    <h1 class="titel">Citygame</h1>

    <div class="kaart">
      <div class="schakelaars">
        ${schakelaar('sw-cg', i.citygame_open === true, 'Citygame is open', 'Aan = deelnemers zien hun route; uit = niemand ziet iets')}
      </div>
    </div>

    <div class="chips groepen">${[1, 2, 3, 4].map(n => html`
      <button class="chip ${n === groep ? 'actief' : ''}" data-groep="${n}" style="--gk:${groepKleur(n)}">
        <span class="groepdot" style="--gk:${groepKleur(n)}"></span>${groepNaam(n)}</button>`)}</div>

    <p class="klein">${leden.length ? 'Leden: ' + leden.map(l => l.naam).join(', ') : 'Nog niemand in deze groep. Deel mensen in bij Deelnemers.'}</p>
    <p class="klein">Opdrachten worden één voor één zichtbaar. De groep moet een opdracht goed afronden voor de volgende verschijnt. Jullie zien hier ${stops.length ? `${[...goed].filter(id => stops.some(s => s.id === id)).length} van ${stops.length}` : 'nog geen'} afgerond.</p>

    <h2 class="sectie">Route van ${groepNaam(groep)}</h2>
    <div class="stops">${stops.map((s, idx) => html`
      <form class="stop kaart formulier" data-id="${s.id}">
        <div class="stop-kop">
          <b>Opdracht ${idx + 1} ${goed.has(s.id) ? html`<span class="pil groen">afgerond</span>` : ''}</b>
          <span class="rij-acties">
            <button type="button" class="mini" data-act="up" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="mini" data-act="down" ${idx === stops.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="mini gevaar" data-act="del">✕</button>
          </span>
        </div>
        <label>Titel<input name="titel" value="${s.titel}" required></label>
        <label>Opdracht en route-aanwijzing
          <textarea name="opdracht" rows="3" placeholder="Bijvoorbeeld: loop naar de kerk aan het plein.">${s.opdracht}</textarea></label>
        <label>Vraag
          <textarea name="vraag" rows="2" placeholder="Wat staat er boven de deur?">${s.vraag}</textarea></label>
        <div class="twee">
          <label>Soort antwoord<select name="antwoord_type">${opties(s.antwoord_type)}</select></label>
          <label>Juiste antwoord (optioneel)<input name="juist" value="${sleutelVan[s.id] || ''}" placeholder="bijv. 1648 | zestienachtenveertig"></label>
        </div>
        <p class="klein">Met een juist antwoord controleert de app automatisch (hoofdletters en leestekens maken niet uit). Gebruik | voor meerdere goede antwoorden. Zonder juist antwoord beoordeel jij het zelf hieronder.</p>
        <label>Tip (optioneel)<input name="hint" value="${s.hint || ''}"></label>
        <button class="knop-goud klein">Opslaan</button>
      </form>`)}</div>
    <button class="knop-rand" id="nieuweStop">+ Opdracht toevoegen aan ${groepNaam(groep)}</button>

    <div class="kaart" style="margin-top:1.2rem">
      <h3>Route kopiëren</h3>
      <p class="klein">Kopieer de opdrachten van ${groepNaam(groep)} naar een andere groep als startpunt, en pas daar daarna de volgorde en details aan.</p>
      <div class="knoppenrij">
        <select id="kopieerNaar">${[1, 2, 3, 4].filter(n => n !== groep).map(n => html`<option value="${n}">${groepNaam(n)}</option>`)}</select>
        <button class="knop-rand klein" id="kopieerKnop" ${stops.length ? '' : 'disabled'}>Kopiëren</button>
      </div>
    </div>

    <h2 class="sectie">Ingestuurde antwoorden</h2>
    ${antw.length ? html`<div class="antwoordlijst">${antw.map(a => html`
      <div class="ant" data-id="${a.id}">
        ${a.fotos && urls[a.fotos.bestandspad] ? html`<img class="ant-foto" src="${urls[a.fotos.bestandspad]}" alt="" data-src="${urls[a.fotos.bestandspad]}">` : ''}
        <div class="ant-tekst">
          <b>${a.cg_stops ? a.cg_stops.titel : 'Opdracht'}</b>
          <p>${a.tekst || html`<i>(alleen foto)</i>`}</p>
          <small>${a.profiles ? a.profiles.naam : ''} · ${fmtDatum(a.aangemaakt_op)}</small>
        </div>
        <div class="ant-status">
          ${a.juist === true ? html`<span class="pil groen">Goed</span>` : a.juist === false ? html`<span class="pil rood">Fout</span>` : html`<span class="pil goud">Te beoordelen</span>`}
          <button class="mini" data-act="goed" title="Goedkeuren">✓</button>
          <button class="mini" data-act="fout" title="Afkeuren">✗</button>
        </div>
      </div>`)}</div>`
      : html`<p class="klein">Nog niets ingestuurd door deze groep.</p>`}

    <form id="groepForm" class="kaart formulier" style="margin-top:1.2rem">
      <h3>Groepsnamen</h3>
      <div class="vier">${[1, 2, 3, 4].map(n => html`<label>Groep ${n}<input name="g${n}" value="${groepNaam(n)}" maxlength="24"></label>`)}</div>
      <button class="knop-rand klein">Namen opslaan</button>
    </form>
  </div>`.s;

  koppelSchakelaars(root, { 'sw-cg': ['citygame_open', 'Citygame geopend.', 'Citygame gesloten.'] });
  const vw = $('.vw', root);
  const herlaad = () => orgCitygame(root);

  $('.chips.groepen', root).addEventListener('click', e => {
    const c = e.target.closest('[data-groep]');
    if (c) { cgGroep = Number(c.dataset.groep); herlaad(); }
  });

  /* opdracht opslaan en verplaatsen */
  $$('.stop', root).forEach(form => {
    const id = form.dataset.id;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        must(await sb.from('cg_stops').update({
          titel: form.titel.value.trim(), opdracht: form.opdracht.value, vraag: form.vraag.value,
          antwoord_type: form.antwoord_type.value, hint: form.hint.value.trim() || null,
        }).eq('id', id));
        const juist = form.juist.value.trim();
        if (juist) must(await sb.from('cg_sleutels').upsert({ stop_id: id, juist }, { onConflict: 'stop_id' }));
        else must(await sb.from('cg_sleutels').delete().eq('stop_id', id));
        toast('Opdracht opgeslagen.');
      } catch (err) { toast(foutTekst(err), 'err'); }
    });
    form.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const idx = stops.findIndex(s => s.id === id);
      try {
        if (b.dataset.act === 'del') {
          if (!confirm('Deze opdracht verwijderen? Eventuele antwoorden verdwijnen ook.')) return;
          must(await sb.from('cg_stops').delete().eq('id', id));
        } else {
          const naar = b.dataset.act === 'up' ? idx - 1 : idx + 1;
          const orde = stops.map(s => s.id);
          [orde[idx], orde[naar]] = [orde[naar], orde[idx]];
          await Promise.all(orde.map((oid, n) => sb.from('cg_stops').update({ volgorde: (n + 1) * 10 }).eq('id', oid).then(must)));
        }
        await herlaad();
      } catch (err) { toast(foutTekst(err), 'err'); }
    });
  });

  $('#nieuweStop', root).addEventListener('click', async () => {
    try {
      const max = stops.reduce((m, s) => Math.max(m, s.volgorde), 0);
      must(await sb.from('cg_stops').insert({ groep, volgorde: max + 10, titel: `Opdracht ${stops.length + 1}` }));
      await herlaad();
    } catch (err) { toast(foutTekst(err), 'err'); }
  });

  $('#kopieerKnop', root).addEventListener('click', async () => {
    const doel = Number($('#kopieerNaar', root).value);
    if (!confirm(`${stops.length} opdrachten kopiëren naar ${groepNaam(doel)}? Bestaande opdrachten daar blijven staan.`)) return;
    try {
      const { data: bestaand } = await sb.from('cg_stops').select('volgorde').eq('groep', doel).order('volgorde', { ascending: false }).limit(1);
      const start = (bestaand && bestaand[0] ? bestaand[0].volgorde : 0) + 10;
      const nieuwe = must(await sb.from('cg_stops').insert(stops.map((s, n) => ({
        groep: doel, volgorde: start + n * 10, titel: s.titel, opdracht: s.opdracht, vraag: s.vraag,
        antwoord_type: s.antwoord_type, hint: s.hint,
      }))).select());
      const perVolgorde = Object.fromEntries(nieuwe.map(n => [n.volgorde, n.id]));
      const keys = stops.map((s, n) => sleutelVan[s.id] ? { stop_id: perVolgorde[start + n * 10], juist: sleutelVan[s.id] } : null).filter(Boolean);
      if (keys.length) must(await sb.from('cg_sleutels').insert(keys));
      toast(`Gekopieerd naar ${groepNaam(doel)}.`);
      cgGroep = doel;
      await herlaad();
    } catch (err) { toast(foutTekst(err), 'err'); }
  });

  /* antwoorden beoordelen en foto's bekijken */
  $('.antwoordlijst', root)?.addEventListener('click', async e => {
    const img = e.target.closest('.ant-foto');
    if (img) return openLightbox([{ src: img.dataset.src, caption: '' }]);
    const b = e.target.closest('[data-act]');
    if (!b) return;
    try {
      must(await sb.from('cg_antwoorden').update({ juist: b.dataset.act === 'goed' }).eq('id', b.closest('[data-id]').dataset.id));
      await herlaad();
    } catch (err) { toast(foutTekst(err), 'err'); }
  });

  $('#groepForm', root).addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    try {
      for (const n of [1, 2, 3, 4]) {
        const naam = f['g' + n].value.trim();
        if (naam) must(await sb.from('groepen').update({ naam }).eq('nr', n));
      }
      toast('Groepsnamen opgeslagen.');
      await herlaad();
    } catch (err) { toast(foutTekst(err), 'err'); }
  });
}

/* ---------------- Foto's ---------------- */
let fotoFilter = 0;

async function orgFotos(root) {
  await laadBasis();
  const alle = must(await sb.from('fotos').select('*, profiles(naam), cg_stops(titel)').order('aangemaakt_op', { ascending: false }));
  const fotos = fotoFilter ? alle.filter(f => f.groep === fotoFilter) : alle;
  const urls = await signedUrls('fotos', fotos.map(f => f.bestandspad));
  const i = state.instellingen;

  root.innerHTML = html`<div class="vw">
    <h1 class="titel">Foto's</h1>
    <div class="kaart"><div class="schakelaars">
      ${schakelaar('sw-gal', i.galerij_open === true, 'Fotogalerij is open voor iedereen', 'Zet aan na het weekend: dan zien alle deelnemers alle foto\'s')}
    </div></div>
    <div class="chips groepen">
      <button class="chip ${!fotoFilter ? 'actief' : ''}" data-groep="0">Alle (${alle.length})</button>
      ${[1, 2, 3, 4].map(n => html`<button class="chip ${fotoFilter === n ? 'actief' : ''}" data-groep="${n}">
        <span class="groepdot" style="--gk:${groepKleur(n)}"></span>${groepNaam(n)}</button>`)}
    </div>
    ${fotos.length ? html`<div class="fotogrid">${fotos.map((f, idx) => html`
      <figure class="foto" data-idx="${idx}" data-id="${f.id}">
        <img loading="lazy" src="${urls[f.bestandspad]}" alt="">
        <figcaption>
          <span class="groepdot" style="--gk:${groepKleur(f.groep)}"></span>
          <span>${f.cg_stops ? f.cg_stops.titel : (f.bijschrift || 'Extra foto')}</span>
          <small>${f.profiles ? f.profiles.naam : ''}</small>
          <button class="mini gevaar foto-wis" data-wis="${f.id}" title="Verwijderen">✕</button>
        </figcaption>
      </figure>`)}</div>`
      : dnLeeg('◉', 'Nog geen foto\'s')}
  </div>`.s;

  koppelSchakelaars(root, { 'sw-gal': ['galerij_open', 'Fotogalerij is nu zichtbaar voor iedereen.', 'Fotogalerij weer verborgen.'] });
  $('.chips.groepen', root).addEventListener('click', e => {
    const c = e.target.closest('[data-groep]');
    if (c) { fotoFilter = Number(c.dataset.groep); orgFotos(root); }
  });

  const items = fotos.map(f => ({
    src: urls[f.bestandspad],
    caption: [f.profiles ? f.profiles.naam : '', groepNaam(f.groep), f.cg_stops ? f.cg_stops.titel : '', f.bijschrift || ''].filter(Boolean).join(' · '),
  }));
  $$('.foto', root).forEach(el => el.addEventListener('click', async e => {
    const w = e.target.closest('[data-wis]');
    if (w) {
      e.stopPropagation();
      if (!confirm('Deze foto definitief verwijderen?')) return;
      const f = fotos.find(x => x.id === w.dataset.wis);
      try {
        await sb.storage.from('fotos').remove([f.bestandspad]);
        must(await sb.from('fotos').delete().eq('id', f.id));
        toast('Foto verwijderd.');
        await orgFotos(root);
      } catch (err) { toast(foutTekst(err), 'err'); }
      return;
    }
    openLightbox(items, Number(el.dataset.idx));
  }));
}

/* ---------------- Filmpjes ---------------- */
async function orgFilmpjes(root) {
  const lijst = must(await sb.from('videos').select('*').order('volgorde').order('aangemaakt_op'));
  root.innerHTML = html`<div class="vw">
    <h1 class="titel">Filmpjes</h1>
    <p class="uitleg">Upload vooraf opgenomen filmpjes. Ze blijven verborgen totdat je ze vrijgeeft, of tot het moment dat je instelt.</p>

    <form id="uploadForm" class="kaart formulier">
      <h3>Nieuw filmpje</h3>
      <label>Titel<input name="titel" required placeholder="Bijvoorbeeld: Groet van de organisatie"></label>
      <label>Beschrijving (optioneel)<textarea name="beschrijving" rows="2"></textarea></label>
      <label>Videobestand (max ${CONFIG.MAX_VIDEO_MB} MB, mp4 werkt overal)<input type="file" name="bestand" accept="video/mp4,video/webm,video/quicktime"></label>
      <p class="of">of</p>
      <label>Link naar YouTube (niet openbaar) of Vimeo<input type="url" name="link" placeholder="https://…"></label>
      <label class="vink"><input type="checkbox" name="vrij"> Meteen vrijgeven</label>
      <div class="voortgang" id="upVoortgang" hidden><div class="balk" id="upBalk"></div></div>
      <button class="knop-goud">Toevoegen</button>
    </form>

    <h2 class="sectie">Alle filmpjes</h2>
    ${lijst.length ? html`<div class="rijen">${lijst.map((v, idx) => html`
      <div class="rij blok" data-id="${v.id}">
        <div class="rij-bovenrij">
          <div class="rij-icoon">▶</div>
          <div class="rij-tekst"><b>${v.titel}</b><small>${paginaStatus(v)} ${v.externe_url ? 'link' : 'bestand'}</small></div>
          <div class="rij-acties">
            <button class="mini" data-act="up" ${idx === 0 ? 'disabled' : ''}>↑</button>
            <button class="mini" data-act="down" ${idx === lijst.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="mini ${v.vrijgegeven ? '' : 'goud'}" data-act="toggle">${v.vrijgegeven ? 'Verberg' : 'Geef vrij'}</button>
            <button class="mini" data-act="play">Bekijk</button>
          </div>
        </div>
        <div class="speler"></div>
        <details class="hulp"><summary>Bewerken</summary>
          <form class="bewerk formulier">
            <label>Titel<input name="titel" value="${v.titel}" required></label>
            <label>Beschrijving<textarea name="beschrijving" rows="2">${v.beschrijving || ''}</textarea></label>
            <label>Automatisch zichtbaar vanaf<input type="datetime-local" name="vanaf" value="${toLocalInput(v.zichtbaar_vanaf)}"></label>
            <div class="knoppenrij">
              <button class="knop-goud klein">Opslaan</button>
              <button type="button" class="knop-rand klein gevaar" data-act="del">Verwijderen</button>
            </div>
          </form>
        </details>
      </div>`)}</div>`
      : dnLeeg('▶', 'Nog geen filmpjes', 'Voeg hierboven je eerste filmpje toe.')}
  </div>`.s;

  /* nieuw filmpje */
  const up = $('#uploadForm', root);
  up.addEventListener('submit', async e => {
    e.preventDefault();
    const bestand = up.bestand.files[0], link = up.link.value.trim();
    if (!bestand && !link) return toast('Kies een videobestand of plak een link.', 'err');
    if (bestand && bestand.size > CONFIG.MAX_VIDEO_MB * 1024 * 1024)
      return toast(`Dit bestand is ${(bestand.size / 1048576).toFixed(0)} MB. De limiet is ${CONFIG.MAX_VIDEO_MB} MB. Verklein het filmpje of gebruik een link.`, 'err');
    if (link && !safeUrl(link)) return toast('De link moet beginnen met https://', 'err');
    const knop = $('button.knop-goud', up);
    knop.disabled = true;
    try {
      let pad = null;
      if (bestand) {
        const ext = ((bestand.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '')) || 'mp4';
        pad = `${uuid()}.${ext}`;
        $('#upVoortgang', up).hidden = false;
        await uploadMetVoortgang('videos', pad, bestand, x => { $('#upBalk', up).style.width = Math.round(x * 100) + '%'; });
      }
      const volgorde = lijst.reduce((m, v) => Math.max(m, v.volgorde), 0) + 10;
      must(await sb.from('videos').insert({
        titel: up.titel.value.trim(), beschrijving: up.beschrijving.value.trim() || null,
        bestandspad: pad, externe_url: pad ? null : link, volgorde, vrijgegeven: up.vrij.checked,
      }));
      toast('Filmpje toegevoegd.');
      await orgFilmpjes(root);
    } catch (err) { toast(foutTekst(err), 'err'); knop.disabled = false; }
  });

  /* bestaande filmpjes */
  $$('.rij.blok', root).forEach(el => {
    const id = el.dataset.id;
    const v = lijst.find(x => x.id === id);
    $('.bewerk', el).addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      try {
        must(await sb.from('videos').update({
          titel: f.titel.value.trim(), beschrijving: f.beschrijving.value.trim() || null, zichtbaar_vanaf: fromLocalInput(f.vanaf.value),
        }).eq('id', id));
        toast('Opgeslagen.');
        await orgFilmpjes(root);
      } catch (err) { toast(foutTekst(err), 'err'); }
    });
    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      try {
        if (b.dataset.act === 'play') return speelVideo($('.speler', el), v);
        if (b.dataset.act === 'toggle') {
          must(await sb.from('videos').update({ vrijgegeven: !v.vrijgegeven }).eq('id', id));
          toast(v.vrijgegeven ? 'Filmpje verborgen.' : 'Filmpje vrijgegeven.');
        } else if (b.dataset.act === 'del') {
          if (!confirm(`"${v.titel}" definitief verwijderen?`)) return;
          if (v.bestandspad) await sb.storage.from('videos').remove([v.bestandspad]);
          must(await sb.from('videos').delete().eq('id', id));
          toast('Filmpje verwijderd.');
        } else {
          const idx = lijst.findIndex(x => x.id === id);
          const naar = b.dataset.act === 'up' ? idx - 1 : idx + 1;
          const orde = lijst.map(x => x.id);
          [orde[idx], orde[naar]] = [orde[naar], orde[idx]];
          await Promise.all(orde.map((oid, n) => sb.from('videos').update({ volgorde: (n + 1) * 10 }).eq('id', oid).then(must)));
        }
        await orgFilmpjes(root);
      } catch (err) { toast(foutTekst(err), 'err'); }
    });
  });
}

/* ---------------- Deelnemers ---------------- */
async function orgDeelnemers(root) {
  await laadBasis();
  const lijst = must(await sb.from('profiles').select('*').order('rol').order('naam'));
  const deel = lijst.filter(p => p.rol === 'deelnemer');
  const org = lijst.filter(p => p.rol === 'organisatie');

  root.innerHTML = html`<div class="vw">
    <h1 class="titel">Deelnemers</h1>
    <p class="uitleg">Deel iedereen in een van de 4 groepen in voor de citygame. Wijzigingen worden direct opgeslagen.</p>
    <div class="rijen">${deel.map(p => html`
      <div class="rij" data-id="${p.id}">
        <div class="rij-icoon"><span class="groepdot groot" style="--gk:${p.groep ? groepKleur(p.groep) : '#666'}"></span></div>
        <div class="rij-tekst"><b>${p.naam}</b></div>
        <select class="groepkeuze">
          <option value="">Geen groep</option>
          ${[1, 2, 3, 4].map(n => html`<option value="${n}" ${p.groep === n ? 'selected' : ''}>${groepNaam(n)}</option>`)}
        </select>
      </div>`)}</div>
    ${deel.length ? '' : dnLeeg('♀', 'Nog geen deelnemers', 'Maak accounts aan met het script, zie de handleiding.')}
    <h2 class="sectie">Organisatie</h2>
    <p class="klein">${org.map(p => p.naam).join(', ') || '-'}</p>
    <div class="kaart"><h3>Accounts toevoegen of wachtwoord opnieuw instellen</h3>
      <p class="klein">Dat doe je met <code>scripts/create-users.mjs</code> op je eigen computer. Zo blijft de geheime sleutel buiten de website. De stappen staan in de README.</p></div>
  </div>`.s;

  $$('.groepkeuze', root).forEach(sel => sel.addEventListener('change', async () => {
    const rij = sel.closest('[data-id]');
    const groep = sel.value ? Number(sel.value) : null;
    try {
      must(await sb.from('profiles').update({ groep }).eq('id', rij.dataset.id));
      $('.groepdot', rij).style.setProperty('--gk', groep ? groepKleur(groep) : '#666');
      toast('Groep opgeslagen.');
    } catch (err) { toast(foutTekst(err), 'err'); }
  }));
}
