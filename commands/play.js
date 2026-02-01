const { SlashCommandBuilder } = require('discord.js');
const { isSpotifyUrl, getSpotifyTracks } = require('../utils/spotify');
const { isYoutubeUrl, getStreamInfo } = require('../utils/yt-dlp');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a YouTube, SoundCloud, or Spotify link')
    .addStringOption((opt) =>
      opt.setName('query').setDescription('URL or search term').setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.member?.voice?.channel;
    if (!channel) {
      return interaction.reply({ content: 'You need to be in a voice channel.', ephemeral: true });
    }

    const query = interaction.options.getString('query', true).trim();
    await interaction.deferReply();

    const player = interaction.client.player;
    const nodeOptions = { metadata: interaction };

    try {
      // YouTube: use yt-dlp
      if (isYoutubeUrl(query)) {
        console.log('[play] YouTube URL:', query);
        const info = await getStreamInfo(query);
        if (!info?.streamUrl) {
          return interaction.followUp({ content: 'Could not get stream from YouTube. yt-dlp may have failed.' });
        }
        console.log('[play] Got stream URL, title:', info.title);
        const result = await player.play(channel, info.streamUrl, { nodeOptions });
        if (result?.track) {
          result.track.title = info.title || 'YouTube Video';
          return interaction.followUp({ content: `**${result.track.title}** enqueued!` });
        }
        return interaction.followUp({ content: 'Could not play the stream.' });
      }

      // Spotify: get track info and search on SoundCloud
      if (isSpotifyUrl(query)) {
        console.log('[play] Spotify URL:', query);
        const tracks = await getSpotifyTracks(query);
        if (!tracks.length) {
          return interaction.followUp({ content: "Couldn't get track info from Spotify link." });
        }
        const searchQuery = `${tracks[0].artist} ${tracks[0].title}`;
        console.log('[play] Searching SoundCloud for:', searchQuery);
        const result = await player.play(channel, searchQuery, {
          nodeOptions,
          searchEngine: 'soundcloud',
        }).catch((e) => {
          console.log('[play] SoundCloud search error:', e.message);
          return null;
        });
        if (result?.track) {
          return interaction.followUp({ content: `**${result.track.title}** enqueued (from Spotify via SoundCloud)!` });
        }
        return interaction.followUp({ content: `Could not find "${searchQuery}" on SoundCloud.` });
      }

      // SoundCloud or other: use discord-player directly
      console.log('[play] Direct query:', query);
      const result = await player.play(channel, query, { nodeOptions }).catch((e) => {
        console.log('[play] Player error:', e.message);
        return null;
      });
      if (result?.track) {
        console.log('[play] Success:', result.track.title);
        return interaction.followUp({ content: `**${result.track.title}** enqueued!` });
      }
      return interaction.followUp({ content: 'Nothing found for that query.' });

    } catch (err) {
      console.error('[play] Error:', err);
      return interaction.followUp({ content: `Something went wrong: ${err.message}` });
    }
  },
};
