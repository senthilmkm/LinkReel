import { ttsService } from '../../src/services/tts.service';

describe('Unit Tests: TTS & Word Alignment', () => {
  it('should synthesize audio buffer and word-level timecodes', async () => {
    const text = 'Stop wasting hours on manual work. Meet LinkReel today!';
    const result = await ttsService.synthesizeNarration(text, 'en-US-Neural2-F');

    expect(result.audioBuffer).toBeDefined();
    expect(result.durationSeconds).toBeGreaterThan(0);
    expect(result.timecodes.length).toBe(text.split(/\s+/).length);

    // Verify timecodes are sequential
    for (let i = 1; i < result.timecodes.length; i++) {
      expect(result.timecodes[i].startSec).toBeGreaterThanOrEqual(result.timecodes[i - 1].startSec);
    }
  });
});
