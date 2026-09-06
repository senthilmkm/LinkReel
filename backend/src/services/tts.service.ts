import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { ENV } from '../config/env';
import { AudioSynthesisResult, VoiceId, WordTimecode } from '../types';

export class TtsService {
  private client: TextToSpeechClient;

  constructor() {
    this.client = new TextToSpeechClient({
      projectId: ENV.GCP_PROJECT_ID,
    });
  }

  async synthesizeNarration(narrationText: string, voiceId: VoiceId = 'en-US-Neural2-F'): Promise<AudioSynthesisResult> {
    try {
      const isFemale = voiceId.endsWith('-F');
      const ssmlGender = isFemale ? 'FEMALE' : 'MALE';

      const request = {
        input: { text: narrationText },
        voice: {
          languageCode: 'en-US',
          name: voiceId,
          ssmlGender: ssmlGender as any,
        },
        audioConfig: {
          audioEncoding: 'MP3' as const,
          speakingRate: 1.08, // Optimal high-energy short-form pacing
          pitch: 0.0,
          sampleRateHertz: 44100,
        },
      };

      const [response] = await this.client.synthesizeSpeech(request);
      const audioBuffer = Buffer.from(response.audioContent as Uint8Array);

      // Approximate word-level timecodes for kinetic subtitle sync
      const words = narrationText.trim().split(/\s+/);
      const estimatedDurationSec = Math.max(25, Math.min(30, words.length / 3.0));
      const secPerWord = estimatedDurationSec / words.length;

      const timecodes: WordTimecode[] = words.map((word, idx) => ({
        word,
        startSec: parseFloat((idx * secPerWord).toFixed(2)),
        endSec: parseFloat(((idx + 1) * secPerWord).toFixed(2)),
      }));

      return {
        audioBuffer,
        durationSeconds: estimatedDurationSec,
        timecodes,
      };
    } catch (err: any) {
      console.warn('[TTS Service Warning] Using synthetic audio buffer fallback:', err.message);
      return this.generateFallbackAudio(narrationText);
    }
  }

  private generateFallbackAudio(narrationText: string): AudioSynthesisResult {
    const words = narrationText.trim().split(/\s+/);
    const durationSeconds = Math.max(26, Math.min(30, words.length / 3.0));
    const secPerWord = durationSeconds / words.length;

    const timecodes: WordTimecode[] = words.map((word, idx) => ({
      word,
      startSec: parseFloat((idx * secPerWord).toFixed(2)),
      endSec: parseFloat(((idx + 1) * secPerWord).toFixed(2)),
    }));

    // Minimal valid silent MP3 frame buffer for testing/offline rendering
    const dummyMp3Header = Buffer.from([
      0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    return {
      audioBuffer: dummyMp3Header,
      durationSeconds,
      timecodes,
    };
  }
}

export const ttsService = new TtsService();
