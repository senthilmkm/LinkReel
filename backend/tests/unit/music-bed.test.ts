import fs from 'fs';
import {
  buildVoiceMusicMixFilter,
  MUSIC_BED_VOLUME,
  MUSIC_TRACKS,
  normalizeMusicTrack,
  normalizeMusicVolume,
  resolveMusicBedPath,
  volumeForLevel,
} from '../../src/services/music-bed';

describe('Music picker', () => {
  it('keeps voice as the first mix input and ducks music', () => {
    const filter = buildVoiceMusicMixFilter(30);
    expect(filter).toContain(`volume=${MUSIC_BED_VOLUME}`);
    expect(filter).toContain('amix=inputs=2:duration=first:dropout_transition=2,volume=2');
    expect(filter).toContain('afade=t=out:st=28:d=2');
    expect(filter).toContain('[1:a][m]amix');
  });

  it('maps Off to no file and every other track to a real mp3', () => {
    expect(normalizeMusicTrack('nope')).toBe('pulse');
    expect(normalizeMusicVolume('nope')).toBe('medium');
    expect(resolveMusicBedPath('none')).toBeNull();
    expect(volumeForLevel('loud')).toBeGreaterThan(volumeForLevel('quiet'));

    for (const track of MUSIC_TRACKS.filter((t) => t.id !== 'none')) {
      const file = resolveMusicBedPath(track.id);
      expect(file).toBeTruthy();
      expect(fs.existsSync(file as string)).toBe(true);
    }
  });

  it('puts loud vs quiet into the mix filter', () => {
    const quiet = buildVoiceMusicMixFilter(20, volumeForLevel('quiet'));
    const loud = buildVoiceMusicMixFilter(20, volumeForLevel('loud'));
    expect(quiet).toContain('volume=0.1');
    expect(loud).toContain('volume=0.24');
  });
});

describe('Music mix in a real render', () => {
  it('encodes a reel with Off and with Drive', async () => {
    const { videoRendererService } = require('../../src/services/renderer.service');
    const voice = fs.readFileSync(resolveMusicBedPath('warm') as string);
    const branding = {
      url: 'https://example.com',
      title: 'Example',
      description: 'desc',
      primaryColor: '#3DB8A0',
      accentColor: '#C6A75E',
      heroScreenshotPath: '',
      featureScreenshotPaths: [],
    };
    const storyboard = {
      hook: 'Hook',
      fullNarration: 'Hook line.',
      scenes: [
        { id: 1, durationSec: 4, caption: 'HOOK', narrationText: 'hook', assetType: 'screenshot_hero', motionEffect: 'zoom_in' },
      ],
    };

    const off = await videoRendererService.renderVideo({
      jobId: 'music_off',
      branding,
      storyboard,
      audioResult: { audioBuffer: voice, durationSeconds: 4, timecodes: [] },
      aspectRatio: '9:16',
      sceneClips: [{ sceneIndex: 0 }],
      musicTrack: 'none',
    });
    const on = await videoRendererService.renderVideo({
      jobId: 'music_drive',
      branding,
      storyboard,
      audioResult: { audioBuffer: voice, durationSeconds: 4, timecodes: [] },
      aspectRatio: '9:16',
      sceneClips: [{ sceneIndex: 0 }],
      musicTrack: 'drive',
      musicVolume: 'medium',
    });

    expect(fs.existsSync(off.outputVideoPath)).toBe(true);
    expect(fs.existsSync(on.outputVideoPath)).toBe(true);
    expect(fs.statSync(on.outputVideoPath).size).toBeGreaterThan(1000);
  }, 60000);
});
