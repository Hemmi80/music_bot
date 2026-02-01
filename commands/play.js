const { SlashCommandBuilder } = require('discord.js');
const { isSpotifyUrl, getSpotifyTracks } = require('../utils/spotify');
const { isYoutubeUrl, getStreamInfo } = require('../utils/yt-dlp');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a YouTube, SoundCloud, or Spotify link (Spotify finds YouTube alternative)')
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
      if (isSpotifyUrl(query)) {
        const tracks = await getSpotifyTracks(query);
        if (!tracks.length) {
          return interaction.followUp({
            content: "Couldn't get track info from that Spotify link. Try a different link or search on YouTube.",
          });
        }
        const searchQueries = tracks.map((t) => `${t.artist} ${t.title}`);
        const firstQuery = searchQueries[0];
        const { track: firstTrack, queue } = await player.play(channel, firstQuery, {
          nodeOptions,
          searchEngine: 'youtube',
        });
        if (!firstTrack) {
          return interaction.followUp({
            content: `Couldn't find a YouTube match for "${firstQuery}".`,
          });
        }
        await interaction.followUp({
          content: `**${firstTrack.title}** enqueued (from Spotify link).` + (searchQueries.length > 1 ? ` Adding ${searchQueries.length - 1} more…` : ''),
        });
        for (let i = 1; i < searchQueries.length; i++) {
          const searchResult = await player.search(searchQueries[i], {
            requestedBy: interaction.user,
            searchEngine: 'youtube',
          });
          if (searchResult.hasTracks()) {
            queue.addTrack(searchResult.tracks[0]);
          }
        }
        if (searchQueries.length > 1) {
          await interaction.followUp({
            content: `Added ${searchQueries.length} tracks from the Spotify link.`,
          });
        }
        return;
      }

      let track;
      if (isYoutubeUrl(query)) {
        console.log('[play] YouTube URL detected, trying yt-dlp first');
        const fallback = await getStreamInfo(query);
        if (fallback?.streamUrl) {
          console.log('[play] Got yt-dlp stream, playing...');
          const result = await player.play(channel, fallback.streamUrl, { nodeOptions }).catch((e) => {
            console.log('[play] yt-dlp stream play error:', e.message);
            return null;
          });
          track = result?.track;
          if (track && fallback.title) track.title = fallback.title;
          if (track) console.log('[play] yt-dlp stream worked!');
        } else {
          console.log('[play] yt-dlp returned no stream');
        }
      }
      if (!track) {
        console.log('[play] Trying discord-player extractor for:', query);
        const result = await player.play(channel, query, { nodeOptions }).catch((e) => {
          console.log('[play] Extractor error:', e.message);
          return e;
        });
        track = result?.track;
        if (track) console.log('[play] Extractor worked, track:', track.title);
      }
      if (!track) {
        console.log('[play] No track found');
        return interaction.followUp({ content: 'Nothing found for that query.' });
      }
      return interaction.followUp({ content: `**${track.title}** enqueued!` });
    } catch (err) {
      const msg = err?.message || '';
      if (isYoutubeUrl(query) && (msg.includes('No results found') || msg.includes('No results'))) {
        const fallback = await getStreamInfo(query);
        if (fallback?.streamUrl) {
          try {
            const result = await player.play(channel, fallback.streamUrl, { nodeOptions });
            const track = result?.track;
            if (track) {
              if (fallback.title) track.title = fallback.title;
              return interaction.followUp({ content: `**${track.title}** enqueued (via yt-dlp).` });
            }
          } catch (e) {
            console.error('yt-dlp fallback error:', e);
          }
        }
      }
      console.error('Play error:', err);
      return interaction.followUp({
        content: `Something went wrong: ${err.message}`,
      });
    }
  },
};
