const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('../utils/music');
const { spawn } = require('child_process');

// Get video info from yt-dlp (works with URLs and search queries)
async function getVideoInfo(query) {
  return new Promise((resolve) => {
    const proc = spawn('yt-dlp', [
      '--get-title',
      '--get-id',
      '--no-playlist',
      '--no-warnings',
      '-q',
      query
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    
    let output = '';
    proc.stdout.on('data', (d) => { output += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0 && output.trim()) {
        const lines = output.trim().split('\n');
        // First line is title, second is video ID
        const title = lines[0];
        const videoId = lines[1];
        const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : query;
        resolve({ title, url });
      } else {
        resolve(null);
      }
    });
    proc.on('error', () => resolve(null));
    
    // Timeout after 15 seconds
    setTimeout(() => {
      proc.kill();
      resolve(null);
    }, 15000);
  });
}

// Check if URL is Spotify
function isSpotifyUrl(url) {
  return url.includes('spotify.com') || url.includes('spotify:');
}

// Check if URL is YouTube
function isYoutubeUrl(url) {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

// Get track info from Spotify using oEmbed API (no auth needed)
async function getSpotifyInfo(url) {
  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    console.log('[spotify] Fetching oEmbed:', oembedUrl);
    
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      console.error('[spotify] oEmbed failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    console.log('[spotify] Got oEmbed:', data.title);
    
    // oEmbed title format is usually "Song Name - Artist" or "Song Name"
    const title = data.title || '';
    return { searchQuery: title, title: title };
  } catch (error) {
    console.error('[spotify] Error:', error.message);
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play from YouTube or Spotify')
    .addStringOption(opt =>
      opt.setName('query')
        .setDescription('YouTube URL, Spotify URL, or search term')
        .setRequired(true)
    ),

  async execute(interaction) {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: 'Join a voice channel first!', ephemeral: true });
    }

    let query = interaction.options.getString('query', true).trim();
    await interaction.deferReply();

    let displayTitle = query;

    // Handle Spotify URLs
    if (isSpotifyUrl(query)) {
      console.log('[play] Spotify URL detected:', query);
      const spotifyInfo = await getSpotifyInfo(query);
      
      if (!spotifyInfo) {
        return interaction.followUp('Could not get Spotify track info.');
      }
      
      displayTitle = spotifyInfo.title;
      // Search YouTube for this track
      query = `ytsearch:${spotifyInfo.searchQuery}`;
      console.log('[play] Searching YouTube for:', spotifyInfo.searchQuery);
    } 
    // Handle YouTube URLs
    else if (isYoutubeUrl(query)) {
      console.log('[play] YouTube URL:', query);
    }
    // Handle search terms
    else {
      console.log('[play] Search term:', query);
      query = `ytsearch:${query}`;
    }

    // Get video info from yt-dlp
    const info = await getVideoInfo(query);
    if (!info) {
      return interaction.followUp('Could not find anything for that query.');
    }

    console.log('[play] Found:', info.title);

    // Get or create queue
    const queue = getQueue(interaction.client, interaction.guildId);

    // Connect if not connected
    if (!queue.connection) {
      try {
        await queue.connect(voiceChannel, interaction.channel);
      } catch (error) {
        return interaction.followUp(`Could not connect: ${error.message}`);
      }
    }

    // Add track to queue
    queue.addTrack({ title: info.title, url: info.url });

    // If nothing is playing, start playback
    if (!queue.currentTrack) {
      await queue.playNext();
      // "Now playing" is sent by the queue, just delete our deferred reply
      return interaction.deleteReply().catch(() => {});
    } else {
      return interaction.followUp(`Added to queue: **${info.title}**`);
    }
  },
};
