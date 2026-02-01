// GuildQueueEvents - listen for various events to debug
function getChannel(queue) {
  const meta = queue.metadata;
  if (!meta) return null;
  return meta.channel ?? meta.reply?.channel ?? null;
}

module.exports = [
  {
    name: 'playerStart',
    execute(queue, track) {
      console.log('[event] playerStart:', track.title);
      const channel = getChannel(queue);
      if (channel) channel.send(`Now playing: **${track.title}**`).catch(() => {});
    },
  },
  {
    name: 'emptyQueue',
    execute(queue) {
      console.log('[event] emptyQueue');
      const channel = getChannel(queue);
      if (channel) channel.send('Queue finished.').catch(() => {});
    },
  },
  {
    name: 'playerError',
    execute(queue, error) {
      console.error('[event] playerError:', error.message);
      const channel = getChannel(queue);
      if (channel) channel.send(`Playback error: ${error.message}`).catch(() => {});
    },
  },
  {
    name: 'error',
    execute(queue, error) {
      console.error('[event] error:', error.message);
    },
  },
  {
    name: 'connection',
    execute(queue) {
      console.log('[event] connection - voice connected');
    },
  },
  {
    name: 'connectionError',
    execute(queue, error) {
      console.error('[event] connectionError:', error.message);
    },
  },
  {
    name: 'debug',
    execute(queue, message) {
      console.log('[event] debug:', message);
    },
  },
];
