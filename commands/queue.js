const { SlashCommandBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

const MAX_LIST = 10;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current queue'),

  async execute(interaction) {
    const queue = useQueue(interaction.guildId);
    if (!queue) {
      return interaction.reply({ content: 'Nothing in the queue.', ephemeral: true });
    }

    const current = queue.currentTrack;
    const tracks = queue.tracks.toArray();
    const lines = [];
    if (current) {
      lines.push(`**Now playing:** ${current.title}`);
    }
    if (tracks.length) {
      const list = tracks.slice(0, MAX_LIST).map((t, i) => `${i + 1}. ${t.title}`).join('\n');
      lines.push(`**Up next:**\n${list}`);
      if (tracks.length > MAX_LIST) {
        lines.push(`… and ${tracks.length - MAX_LIST} more`);
      }
    }
    if (lines.length === 0) {
      return interaction.reply({ content: 'Queue is empty.', ephemeral: true });
    }
    return interaction.reply({ content: lines.join('\n\n') });
  },
};
