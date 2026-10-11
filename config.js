/* ============================================================
   INSTELLINGEN  -  hier pas je alles aan voor jullie weekend
   ============================================================ */
const CONFIG = {
  // Uit Supabase: Project Settings > API
  SUPABASE_URL: 'https://JOUW-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'JOUW-ANON-KEY',   // de "anon public" key. Deze mag openbaar zijn.

  // Moet gelijk zijn aan EMAIL_DOMEIN in scripts/create-users.mjs.
  // Er worden nooit e-mails naar dit adres gestuurd; het is alleen een intern label.
  EMAIL_DOMEIN: 'weekend-gala.nl',

  // Teksten in de kop
  EVENT_KOP: 'Lustrum',
  EVENT_TITEL: 'Gala Weekend',
  EVENT_ONDERTITEL: 'Een weekend vol glans, glamour en vriendschap',

  // Optioneel: aftelklok op de startpagina, bijvoorbeeld '2026-11-13T17:00'. Leeg laten = geen klok.
  WEEKEND_START: '',

  // Maximale grootte van een filmpje in MB (gratis Supabase: 50)
  MAX_VIDEO_MB: 50,
};
