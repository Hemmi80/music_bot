const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current queue'),

  async execute(interaction) {
    const queue = interaction.client.queues.get(interaction.guildId);
    if (!queue) {
      return interaction.reply({ content: 'Nothing in the queue.', ephemeral: true });
    }
    
    const lines = [];
    
    if (queue.currentTrack) {
      lines.push(`**Now playing:** ${queue.currentTrack.title}`);
    }
    
    if (queue.tracks.length > 0) {
      const list = queue.tracks.slice(0, 10).map((t, i) => `${i + 1}. ${t.title}`).join('\n');
      lines.push(`**Up next:**\n${list}`);
      if (queue.tracks.length > 10) {
        lines.push(`...and ${queue.tracks.length - 10} more`);
      }
    }
    
    if (lines.length === 0) {
      return interaction.reply({ content: 'Queue is empty.', ephemeral: true });
    }
    
    return interaction.reply(lines.join('\n\n'));
  },
};
