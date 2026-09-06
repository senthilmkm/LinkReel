import ffmpeg from 'fluent-ffmpeg';
import installer from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs';

ffmpeg.setFfmpegPath(installer.path);

async function testFilterConcat() {
  const f1 = path.join(process.cwd(), 'diagnostic_frames', 'scene_1.png');
  const f2 = path.join(process.cwd(), 'diagnostic_frames', 'scene_2.png');
  const f3 = path.join(process.cwd(), 'diagnostic_frames', 'scene_3.png');
  const f4 = path.join(process.cwd(), 'diagnostic_frames', 'scene_4.png');
  const audio = path.join(process.cwd(), 'test_narration.mp3');
  const out = path.join(process.cwd(), 'diagnostic_frames', 'perfect_video.mp4');

  return new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg()
      .input(f1).inputOptions(['-loop 1', '-t 6'])
      .input(f2).inputOptions(['-loop 1', '-t 6'])
      .input(f3).inputOptions(['-loop 1', '-t 6'])
      .input(f4).inputOptions(['-loop 1', '-t 7']);

    if (fs.existsSync(audio)) {
      cmd.input(audio);
    }

    cmd
      .complexFilter([
        '[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[outv]',
      ])
      .outputOptions([
        '-map [outv]',
        ...(fs.existsSync(audio) ? ['-map 4:a', '-c:a aac', '-b:a 192k'] : []),
        '-c:v libx264',
        '-preset ultrafast',
        '-crf 24',
        '-pix_fmt yuv420p',
        '-r 24',
        '-shortest',
        '-movflags +faststart',
      ])
      .output(out)
      .on('start', (commandLine) => {
        console.log('Spawned FFmpeg command:', commandLine);
      })
      .on('end', () => {
        const stats = fs.statSync(out);
        console.log(`✅ Success! Video generated: ${out} (${stats.size} bytes)`);
        resolve();
      })
      .on('error', (err, stdout, stderr) => {
        console.error('❌ FFmpeg Error:', err.message);
        console.error('Stderr:', stderr);
        reject(err);
      });

    cmd.run();
  });
}

testFilterConcat().catch(console.error);
