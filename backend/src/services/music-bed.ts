import fs from 'fs';
import path from 'path';

/** Quiet under Nora/Alex. Voice stays at full level. */
export const MUSIC_BED_VOLUME = 0.16;

export const PIXABAY_BED = {
  title: 'Corporate Electronic Instrumental 04',
  artist: 'alanajordan',
  pageUrl: 'https://pixabay.com/music/electronic-corporate-electronic-instrumental-04-501883/',
  fileName: 'bed.mp3',
};

export function resolveMusicBedPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'assets', 'music', PIXABAY_BED.fileName),
    path.join(__dirname, '..', '..', 'assets', 'music', PIXABAY_BED.fileName),
    path.join(__dirname, '..', '..', '..', 'assets', 'music', PIXABAY_BED.fileName),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

export function buildVoiceMusicMixFilter(durationSec: number, volume = MUSIC_BED_VOLUME): string {
  const fadeStart = Math.max(0.5, Number(durationSec || 30) - 2);
  // No amix normalize= — Cloud Run FFmpeg is older and rejects it.
  // Default amix scales by 1/n, so volume=2 puts the voice back near full level.
  return `[2:a]volume=${volume},afade=t=in:st=0:d=0.3,afade=t=out:st=${fadeStart}:d=2[m];[1:a][m]amix=inputs=2:duration=first:dropout_transition=2,volume=2[a]`;
}
