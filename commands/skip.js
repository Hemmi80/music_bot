const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current track'),

  async execute(interaction) {
    const queue = interaction.client.queues.get(interaction.guildId);
    if (!queue || !queue.currentTrack) {
      return interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
    }
    
    queue.skip();
    return interaction.reply('Skipped.');
  },
};
