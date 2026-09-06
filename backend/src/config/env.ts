import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 8080,
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || 'linkreel-app-3190',
  GCS_TEMP_BUCKET: process.env.GCS_TEMP_BUCKET || 'linkreel-temp-assets-3190',
  GCS_PUBLIC_BUCKET: process.env.GCS_PUBLIC_BUCKET || 'linkreel-public-videos-3190',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  DEFAULT_VOICE_ID: process.env.DEFAULT_VOICE_ID || 'en-US-Neural2-F',
};

/** Live read so tests and Cloud Run env updates stay in sync after restart. Default off. */
export function isPlayStoreEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test(String(process.env.ENABLE_PLAY_STORE || '').trim());
}

export function validateEnv() {
  const missing: string[] = [];
  if (!ENV.GCP_PROJECT_ID) missing.push('GCP_PROJECT_ID');
  if (!ENV.GCS_TEMP_BUCKET) missing.push('GCS_TEMP_BUCKET');
  if (!ENV.GCS_PUBLIC_BUCKET) missing.push('GCS_PUBLIC_BUCKET');

  if (missing.length > 0) {
    console.warn(`[WARN] Some environment variables are not set: ${missing.join(', ')}`);
  }
}
