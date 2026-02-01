const { SlashCommandBuilder } = require('discord.js');
const { AudioPlayerStatus } = require('@discordjs/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause or resume playback'),

  async execute(interaction) {
    const queue = interaction.client.queues.get(interaction.guildId);
    if (!queue || !queue.currentTrack) {
      return interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
    }
    
    if (queue.player.state.status === AudioPlayerStatus.Paused) {
      queue.resume();
      return interaction.reply('Resumed.');
    } else {
      queue.pause();
      return interaction.reply('Paused.');
    }
  },
};
