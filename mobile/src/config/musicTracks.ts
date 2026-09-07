export const MUSIC_TRACKS = [
  { id: 'none', title: 'Off', sub: 'Voice only' },
  { id: 'pulse', title: 'Pulse', sub: 'Clean electronic' },
  { id: 'warm', title: 'Warm', sub: 'Soft pad' },
  { id: 'drive', title: 'Drive', sub: 'Low beat' },
  { id: 'lift', title: 'Lift', sub: 'Bright pad' },
  { id: 'night', title: 'Night', sub: 'Quiet dark' },
] as const;

export type MusicTrackId = (typeof MUSIC_TRACKS)[number]['id'];

export const MUSIC_VOLUMES = [
  { id: 'quiet', title: 'Quiet' },
  { id: 'medium', title: 'Medium' },
  { id: 'loud', title: 'Loud' },
] as const;

export type MusicVolumeId = (typeof MUSIC_VOLUMES)[number]['id'];
