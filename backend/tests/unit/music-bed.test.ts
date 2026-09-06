import { buildVoiceMusicMixFilter, MUSIC_BED_VOLUME } from '../../src/services/music-bed';

describe('Music bed mix', () => {
  it('keeps voice as the first mix input and ducks music', () => {
    const filter = buildVoiceMusicMixFilter(30);
    expect(filter).toContain(`volume=${MUSIC_BED_VOLUME}`);
    expect(filter).toContain('amix=inputs=2:duration=first:dropout_transition=2,volume=2');
    expect(filter).toContain('afade=t=out:st=28:d=2');
    expect(filter).toContain('[1:a][m]amix');
  });
});
