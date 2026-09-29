// SYNTHETIC_BAKEOFF — optional local env load; no production secrets.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config({ path: process.env.BAKEOFF_ENV_FILE || '.env' });
} catch {
  /* dotenv optional until install */
}
