const { spawn, execSync } = require('child_process');

const YOUTUBE_URL_REGEX = /^https?:\/\/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/;

function isYoutubeUrl(query) {
  return typeof query === 'string' && YOUTUBE_URL_REGEX.test(query.trim());
}

// Check if yt-dlp is available
let ytDlpAvailable = null;
function checkYtDlp() {
  if (ytDlpAvailable !== null) return ytDlpAvailable;
  try {
    execSync('yt-dlp --version', { stdio: 'ignore' });
    ytDlpAvailable = true;
    console.log('[yt-dlp] Available');
  } catch {
    ytDlpAvailable = false;
    console.log('[yt-dlp] Not available');
  }
  return ytDlpAvailable;
}

/**
 * Get direct audio stream URL and title for a YouTube URL using yt-dlp.
 * Returns { streamUrl, title } or null if yt-dlp fails or is not installed.
 */
const YT_DLP_TIMEOUT_MS = 20000;

function getStreamInfo(youtubeUrl) {
  return new Promise((resolve) => {
    const trimmed = youtubeUrl.trim();
    if (!isYoutubeUrl(trimmed)) {
      console.log('[yt-dlp] Not a YouTube URL:', trimmed);
      resolve(null);
      return;
    }
    if (!checkYtDlp()) {
      console.log('[yt-dlp] Skipping (not installed)');
      resolve(null);
      return;
    }
    console.log('[yt-dlp] Getting stream for:', trimmed);
    const proc = spawn(
      'yt-dlp',
      ['-f', 'bestaudio', '-g', '--get-title', '--no-playlist', '--no-warnings', trimmed],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => {
      console.log('[yt-dlp] Spawn error:', err.message);
      resolve(null);
    });
    const t = setTimeout(() => {
      console.log('[yt-dlp] Timeout, killing process');
      try { proc.kill('SIGKILL'); } catch (_) {}
      resolve(null);
    }, YT_DLP_TIMEOUT_MS);
    proc.on('close', (code) => {
      clearTimeout(t);
      console.log('[yt-dlp] Exit code:', code);
      if (stderr.trim()) console.log('[yt-dlp] stderr:', stderr.trim());
      if (code !== 0) {
        resolve(null);
        return;
      }
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      console.log('[yt-dlp] Output lines:', lines.length);
      const streamUrl = lines.find((l) => /^https?:\/\//.test(l));
      const title = lines.find((l) => !/^https?:\/\//.test(l)) || null;
      if (streamUrl) {
        console.log('[yt-dlp] Got stream URL, title:', title);
        resolve({ streamUrl, title: title || 'YouTube' });
      } else {
        console.log('[yt-dlp] No stream URL in output');
        resolve(null);
      }
    });
  });
}

module.exports = { isYoutubeUrl, getStreamInfo, checkYtDlp };
