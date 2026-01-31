const { spawn } = require('child_process');

const YOUTUBE_URL_REGEX = /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;

function isYoutubeUrl(query) {
  return typeof query === 'string' && YOUTUBE_URL_REGEX.test(query.trim());
}

/**
 * Get direct audio stream URL and title for a YouTube URL using yt-dlp.
 * Returns { streamUrl, title } or null if yt-dlp fails or is not installed.
 */
function getStreamInfo(youtubeUrl) {
  return new Promise((resolve) => {
    const trimmed = youtubeUrl.trim();
    if (!isYoutubeUrl(trimmed)) {
      resolve(null);
      return;
    }
    const proc = spawn(
      'yt-dlp',
      ['-x', '-g', '--get-title', '--no-playlist', '--no-warnings', '--quiet', trimmed],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', () => resolve(null));
    proc.on('close', (code) => {
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
