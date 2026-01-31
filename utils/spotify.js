// Resolve Spotify URLs to track info (no Spotify API needed). Used to find YouTube alternatives.
const spotifyUrlInfo = require('spotify-url-info');

const SPOTIFY_URL_REGEX = /^https?:\/\/(open|play)\.spotify\.com\/(track|playlist|album)\/([a-zA-Z0-9]+)/;

function isSpotifyUrl(query) {
  return typeof query === 'string' && SPOTIFY_URL_REGEX.test(query.trim());
}

async function getSpotifyTracks(url) {
  const trimmed = url.trim();
  const match = trimmed.match(SPOTIFY_URL_REGEX);
  if (!match) return [];

  const type = match[2]; // track | playlist | album

  try {
    if (type === 'track') {
      const preview = await spotifyUrlInfo.getPreview(trimmed);
      if (preview?.title) {
        return [{ title: preview.title, artist: preview.artist || 'Unknown' }];
      }
      return [];
    }
    // playlist or album
    const data = await spotifyUrlInfo.getTracks(trimmed);
    if (!Array.isArray(data)) return [];
    return data
      .map((t) => {
        const track = t?.track ?? t;
        const name = track?.name ?? t?.name;
        if (!name) return null;
        const artist = track?.artists?.[0]?.name ?? track?.artist ?? t?.artists?.[0]?.name ?? t?.artist ?? 'Unknown';
        return { title: name, artist };
      })
      .filter(Boolean);
  } catch (err) {
    console.error('Spotify URL resolve error:', err.message);
    return [];
  }
}

module.exports = { isSpotifyUrl, getSpotifyTracks };
