/**
 * Backend configuration. Empty by default, meaning the site runs entirely on
 * its bundled static data (assets/js/data.js) — no backend required, nothing
 * to configure to use the tool.
 *
 * To enable live, admin-editable data shared across every visitor, follow
 * SETUP.md to create a free Supabase project, then paste its values here:
 *
 *   export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
 *   export const SUPABASE_ANON_KEY = 'eyJhbGciOi...'; // the PUBLIC "anon" key,
 *     safe to ship in client code — it only grants what your RLS policies
 *     allow (public read, admin-only write). Never paste the "service_role" key here.
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
