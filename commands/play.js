const { SlashCommandBuilder } = require('discord.js');
const { isSpotifyUrl, getSpotifyTracks } = require('../utils/spotify');

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

      const { track } = await player.play(channel, query, { nodeOptions });
      if (!track) {
        return interaction.followUp({ content: 'Nothing found for that query.' });
      }
      return interaction.followUp({ content: `**${track.title}** enqueued!` });
    } catch (err) {
      console.error('Play error:', err);
      return interaction.followUp({
        content: `Something went wrong: ${err.message}`,
      });
    }
  },
};
