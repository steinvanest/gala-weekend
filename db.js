/* ============================================================
   Verbinding met Supabase, inloggen en opslag
   ============================================================ */
const GECONFIGUREERD = !/JOUW/.test(CONFIG.SUPABASE_URL) && !/JOUW/.test(CONFIG.SUPABASE_ANON_KEY);

const sb = GECONFIGUREERD
  ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'gala-weekend-auth' },
    })
  : null;

const state = { user: null, profiel: null, instellingen: {}, groepen: [] };

/* Gooit de fout door als een Supabase-aanroep mislukt, anders geeft het de data terug */
const must = res => { if (res.error) throw res.error; return res.data; };

async function laadProfiel() {
  const { data } = await sb.auth.getSession();
  const user = data && data.session ? data.session.user : null;
  if (!user) return null;
  const res = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (res.error || !res.data) return null;
  state.user = user;
  return res.data;
}

async function laadBasis() {
  const [i, g] = await Promise.all([
    sb.from('instellingen').select('*'),
    sb.from('groepen').select('*').order('nr'),
  ]);
  state.instellingen = Object.fromEntries((i.data || []).map(r => [r.sleutel, r.waarde]));
  state.groepen = g.data || [];
}

const groepNaam = nr => (state.groepen.find(g => g.nr === nr) || {}).naam || (nr ? 'Groep ' + nr : '-');
const groepKleur = nr => (state.groepen.find(g => g.nr === nr) || {}).kleur || '#d8b45a';

async function inloggen(naam, wachtwoord, tab) {
  const { error } = await sb.auth.signInWithPassword({ email: naamNaarEmail(naam), password: wachtwoord });
  if (error) throw new Error('Naam of wachtwoord klopt niet.');
  const p = await laadProfiel();
  if (!p) {
    await sb.auth.signOut();
    throw new Error('Dit account is nog niet klaargezet. Neem contact op met de organisatie.');
  }
  if (tab === 'organisatie' && p.rol !== 'organisatie') {
    await sb.auth.signOut();
    throw new Error('Dit account heeft geen toegang tot het organisatiegedeelte.');
  }
  if (tab === 'deelnemer' && p.rol === 'organisatie') {
    await sb.auth.signOut();
    throw new Error('Dit is een organisatie-account. Kies het tabblad Organisatie.');
  }
  state.profiel = p;
}

/* ---------- Opslag ---------- */
const _urlCache = new Map();
async function signedUrls(bucket, paden) {
  const nu = Date.now();
  const nodig = paden.filter(p => { const c = _urlCache.get(bucket + '/' + p); return !c || c.exp < nu; });
  if (nodig.length) {
    const { data } = await sb.storage.from(bucket).createSignedUrls(nodig, 3600);
    (data || []).forEach(d => { if (d.signedUrl) _urlCache.set(bucket + '/' + d.path, { url: d.signedUrl, exp: nu + 3300 * 1000 }); });
  }
  return Object.fromEntries(paden.map(p => [p, (_urlCache.get(bucket + '/' + p) || {}).url || '']));
}

/* Verkleint de foto, zet hem in de opslag en legt hem vast. Geeft het id van de foto terug. */
async function uploadFoto(bestand, { stop_id = null, bijschrift = null } = {}) {
  const blob = await compressImage(bestand);
  const pad = `${state.user.id}/${uuid()}.jpg`;
  const up = await sb.storage.from('fotos').upload(pad, blob, { contentType: 'image/jpeg', upsert: false });
  if (up.error) throw up.error;
  const res = await sb.from('fotos')
    .insert({ user_id: state.user.id, stop_id, bestandspad: pad, bijschrift })
    .select('id').single();
  if (res.error) {
    await sb.storage.from('fotos').remove([pad]);
    throw res.error;
  }
  return res.data.id;
}

/* Upload met voortgangsbalk (voor grote filmpjes) */
async function uploadMetVoortgang(bucket, pad, bestand, onVoortgang) {
  const { data } = await sb.auth.getSession();
  if (!data.session) throw new Error('Je bent uitgelogd. Log opnieuw in.');
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${CONFIG.SUPABASE_URL}/storage/v1/object/${bucket}/${pad}`);
    xhr.setRequestHeader('Authorization', 'Bearer ' + data.session.access_token);
    xhr.setRequestHeader('apikey', CONFIG.SUPABASE_ANON_KEY);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('Content-Type', bestand.type || 'application/octet-stream');
    xhr.upload.onprogress = e => { if (e.lengthComputable) onVoortgang(e.loaded / e.total); };
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Uploaden mislukt (${xhr.status}). ${xhr.responseText || ''}`)));
    xhr.onerror = () => reject(new Error('Netwerkfout tijdens het uploaden.'));
    xhr.send(bestand);
  });
}
