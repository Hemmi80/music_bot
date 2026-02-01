const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('../utils/music');
const { spawn } = require('child_process');

// Get video title from yt-dlp
async function getVideoInfo(url) {
  return new Promise((resolve) => {
    const proc = spawn('yt-dlp', [
      '--get-title',
      '--no-playlist',
      '--no-warnings',
      '-q',
      url
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    
    let title = '';
    proc.stdout.on('data', (d) => { title += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0 && title.trim()) {
        resolve({ title: title.trim(), url });
      } else {
        resolve(null);
      }
    });
    proc.on('error', () => resolve(null));
    
    // Timeout after 10 seconds
    setTimeout(() => {
      proc.kill();
      resolve(null);
    }, 10000);
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a YouTube URL')
    .addStringOption(opt =>
      opt.setName('url')
        .setDescription('YouTube URL to play')
        .setRequired(true)
    ),

  async execute(interaction) {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: 'Join a voice channel first!', ephemeral: true });
    }

    const url = interaction.options.getString('url', true).trim();
    await interaction.deferReply();

    // Check if it's a valid URL
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return interaction.followUp('Please provide a YouTube URL.');
    }

    console.log('[play] URL:', url);

    // Get video info
    const info = await getVideoInfo(url);
    if (!info) {
      return interaction.followUp('Could not get video info. Make sure the URL is valid.');
    }

    console.log('[play] Title:', info.title);

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
