const { spawn } = require('child_process');

const YOUTUBE_URL_REGEX = /^https?:\/\/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/;

function isYoutubeUrl(query) {
  return typeof query === 'string' && YOUTUBE_URL_REGEX.test(query.trim());
}

/**
 * Get direct audio stream URL and title for a YouTube URL using yt-dlp.
 * Returns { streamUrl, title } or null if yt-dlp fails or is not installed.
 */
const YT_DLP_TIMEOUT_MS = 15000;

function getStreamInfo(youtubeUrl) {
  return new Promise((resolve) => {
    const trimmed = youtubeUrl.trim();
    if (!isYoutubeUrl(trimmed)) {
      resolve(null);
      return;
    }
    const proc = spawn(
      'yt-dlp',
      ['-x', '-g', '--get-title', '--no-playlist', '--no-warnings', '--quiet', '--no-check-certificate', trimmed],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stdout = '';
    proc.stdout?.on('data', (d) => { stdout += d.toString(); });
    proc.on('error', () => resolve(null));
    const t = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch (_) {}
      resolve(null);
    }, YT_DLP_TIMEOUT_MS);
    proc.on('close', (code) => {
      clearTimeout(t);
      if (code !== 0) {
        resolve(null);
        return;
      }
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      const streamUrl = lines.find((l) => /^https?:\/\//.test(l));
      const title = lines.find((l) => !/^https?:\/\//.test(l)) || null;
      if (streamUrl) {
        resolve({ streamUrl, title: title || 'YouTube' });
      } else {
        resolve(null);
      }
    });
  });
}

module.exports = { isYoutubeUrl, getStreamInfo };
