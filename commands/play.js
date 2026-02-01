const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('../utils/music');
const { spawn } = require('child_process');
const { getData } = require('spotify-url-info')(fetch);

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

// Get track info from Spotify
async function getSpotifyInfo(url) {
  try {
    const data = await getData(url);
    console.log('[spotify] Got data:', data.type, data.name);
    
    if (data.type === 'track') {
      const artist = data.artists?.[0]?.name || '';
      const title = data.name || '';
      return { searchQuery: `${artist} ${title}`.trim(), title: `${artist} - ${title}` };
    } else if (data.type === 'album' || data.type === 'playlist') {
      // For now just get first track
      return { searchQuery: data.name, title: data.name };
    }
    return null;
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
      return interaction.followUp(`Now playing: **${info.title}**`);
    } else {
      return interaction.followUp(`Added to queue: **${info.title}**`);
    }
  },
};
