import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const PAGE_TIMEOUT_MS = 8_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const PREVIEW_MAX_SEC = 30;

export function isAllowedStoreVideoUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    const extOk = /\.(m3u8|mp4|m4v)(\?|$)/i.test(url.pathname);
    if (!extOk) return false;
    return host === 'apptrailers.itunes.apple.com'
      || host === 'play.itunes.apple.com'
      || host.endsWith('.mzstatic.com')
      || host === 'mzstatic.com';
  } catch {
    return false;
  }
}

export function extractPreviewVideoUrls(html: string): string[] {
  const found = [...(html || '').matchAll(
    /https:\/\/(?:apptrailers\.itunes\.apple\.com|play\.itunes\.apple\.com|[A-Za-z0-9.-]+\.mzstatic\.com)\/[^"'\\\s<>]+\.(?:m3u8|mp4|m4v)/gi
  )].map((m) => m[0].replace(/&amp;/g, '&'));

  const unique = [...new Set(found)].filter(isAllowedStoreVideoUrl);
  unique.sort((a, b) => Number(/default\.m3u8/i.test(b)) - Number(/default\.m3u8/i.test(a)));
  return unique.slice(0, 3);
}

export function appStoreProductPageUrl(storeUrl: string, appleId: string): string {
  let cc = 'us';
  try {
    const raw = /^https?:\/\//i.test(storeUrl) ? storeUrl : `https://${storeUrl}`;
    const url = new URL(raw);
    const m = url.pathname.match(/^\/([a-z]{2})(?:\/|$)/i);
    if (m?.[1]) cc = m[1].toLowerCase();
  } catch {
    /* default us */
  }
  return `https://apps.apple.com/${cc}/app/id${appleId}`;
}

export async function fetchListingPreviewUrls(storeUrl: string, appleId: string): Promise<string[]> {
  try {
    const res = await fetch(appStoreProductPageUrl(storeUrl, appleId), {
      method: 'GET',
      headers: {
        Accept: 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    return extractPreviewVideoUrls(await res.text());
  } catch {
    return [];
  }
}

export async function downloadPreviewVideo(videoUrl: string, destPath: string): Promise<number> {
  if (!isAllowedStoreVideoUrl(videoUrl)) {
    throw new Error('INVALID_STORE_VIDEO: Only App Store trailer URLs are allowed.');
  }
  if (!fs.existsSync(path.dirname(destPath))) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
  }

  const ffmpegBin = resolveBin('ffmpeg');
  await runProcess(ffmpegBin, [
    '-y',
    '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    '-i', videoUrl,
    '-t', String(PREVIEW_MAX_SEC),
    '-an',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    destPath,
  ], DOWNLOAD_TIMEOUT_MS);

  const size = fs.existsSync(destPath) ? fs.statSync(destPath).size : 0;
  if (size < 40_000) {
    throw new Error('STORE_VIDEO_FAILED: Preview download was empty.');
  }
  return probeDurationSec(destPath);
}

export function previewSliceTimes(previewDur: number, sceneIndex: number): { startSec: number; sliceSec: number } {
  const safeDur = Math.max(2, Number(previewDur) || 8);
  const sliceSec = Math.max(2, safeDur / 4);
  const startSec = Math.min(sceneIndex * sliceSec, Math.max(0, safeDur - sliceSec));
  return { startSec, sliceSec };
}

function probeDurationSec(filePath: string): number {
  try {
    const { spawnSync } = require('child_process');
    const out = spawnSync(resolveBin('ffprobe'), [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1',
      filePath,
    ], { encoding: 'utf8', timeout: 8000 });
    const n = Number(String(out.stdout || '').trim());
    if (Number.isFinite(n) && n > 1) return Math.min(PREVIEW_MAX_SEC, n);
  } catch {
    /* fall through */
  }
  return 15;
}

function resolveBin(name: 'ffmpeg' | 'ffprobe'): string {
  try {
    const installerPath = require('@ffmpeg-installer/ffmpeg').path as string;
    if (name === 'ffmpeg' && installerPath && fs.existsSync(installerPath)) return installerPath;
    if (name === 'ffprobe' && installerPath) {
      const probe = installerPath.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
      if (fs.existsSync(probe)) return probe;
    }
  } catch {
    /* system binary */
  }
  return name;
}

function runProcess(bin: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`FFmpeg timeout downloading store preview`));
    }, timeoutMs);
    proc.on('close', (code: number) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg preview download failed: ${stderr.slice(-400)}`));
    });
    proc.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
