const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('../utils/music');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback and clear the queue'),

  async execute(interaction) {
    const queue = interaction.client.queues.get(interaction.guildId);
    if (!queue || !queue.connection) {
      return interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
    }
    
    queue.destroy();
    interaction.client.queues.delete(interaction.guildId);
    return interaction.reply('Stopped and disconnected.');
  },
};
