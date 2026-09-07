import fs from 'fs';
import path from 'path';

export const MUSIC_TRACKS = [
  { id: 'none', title: 'Off', sub: 'Voice only', fileName: null as string | null },
  { id: 'pulse', title: 'Pulse', sub: 'Clean electronic', fileName: 'bed.mp3' },
  { id: 'warm', title: 'Warm', sub: 'Soft pad', fileName: 'warm.mp3' },
  { id: 'drive', title: 'Drive', sub: 'Low beat', fileName: 'drive.mp3' },
  { id: 'lift', title: 'Lift', sub: 'Bright pad', fileName: 'lift.mp3' },
  { id: 'night', title: 'Night', sub: 'Quiet dark', fileName: 'night.mp3' },
] as const;

export type MusicTrackId = (typeof MUSIC_TRACKS)[number]['id'];

export const MUSIC_VOLUMES = [
  { id: 'quiet', title: 'Quiet', volume: 0.10 },
  { id: 'medium', title: 'Medium', volume: 0.16 },
  { id: 'loud', title: 'Loud', volume: 0.24 },
] as const;

export type MusicVolumeId = (typeof MUSIC_VOLUMES)[number]['id'];

export const DEFAULT_MUSIC_TRACK: MusicTrackId = 'pulse';
export const DEFAULT_MUSIC_VOLUME: MusicVolumeId = 'medium';
/** @deprecated use volumeForLevel('medium') */
export const MUSIC_BED_VOLUME = 0.16;

export function normalizeMusicTrack(raw?: string | null): MusicTrackId {
  return MUSIC_TRACKS.some((t) => t.id === raw) ? (raw as MusicTrackId) : DEFAULT_MUSIC_TRACK;
}

export function normalizeMusicVolume(raw?: string | null): MusicVolumeId {
  return MUSIC_VOLUMES.some((v) => v.id === raw) ? (raw as MusicVolumeId) : DEFAULT_MUSIC_VOLUME;
}

export function volumeForLevel(level?: string | null): number {
  const id = normalizeMusicVolume(level);
  return MUSIC_VOLUMES.find((v) => v.id === id)?.volume ?? MUSIC_BED_VOLUME;
}

export function resolveMusicBedPath(trackId?: string | null): string | null {
  const id = normalizeMusicTrack(trackId);
  const track = MUSIC_TRACKS.find((t) => t.id === id);
  if (!track?.fileName) return null;
  const candidates = [
    path.join(process.cwd(), 'assets', 'music', track.fileName),
    path.join(__dirname, '..', '..', 'assets', 'music', track.fileName),
    path.join(__dirname, '..', '..', '..', 'assets', 'music', track.fileName),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

export function buildVoiceMusicMixFilter(durationSec: number, volume = MUSIC_BED_VOLUME): string {
  const fadeStart = Math.max(0.5, Number(durationSec || 30) - 2);
  const vol = Number.isFinite(volume) ? Math.min(0.4, Math.max(0.04, volume)) : MUSIC_BED_VOLUME;
  // No amix normalize= — Cloud Run FFmpeg is older and rejects it.
  // Default amix scales by 1/n, so volume=2 puts the voice back near full level.
  return `[2:a]volume=${vol},afade=t=in:st=0:d=0.3,afade=t=out:st=${fadeStart}:d=2[m];[1:a][m]amix=inputs=2:duration=first:dropout_transition=2,volume=2[a]`;
}
