// GuildQueueEvents: playerStart, emptyQueue, playerError (queue is first arg)
function getChannel(queue) {
  const meta = queue.metadata;
  if (!meta) return null;
  return meta.channel ?? meta.reply?.channel ?? null;
}

module.exports = [
  {
    name: 'playerStart',
    execute(queue, track) {
      const channel = getChannel(queue);
      if (channel) channel.send(`Now playing: **${track.title}**`).catch(() => {});
    },
  },
  {
    name: 'emptyQueue',
    execute(queue) {
      const channel = getChannel(queue);
      if (channel) channel.send('Queue finished.').catch(() => {});
    },
  },
  {
    name: 'playerError',
    execute(queue, error) {
      console.error('Player error:', error);
      const channel = getChannel(queue);
      if (channel) channel.send(`Playback error: ${error.message}`).catch(() => {});
    },
  },
];
