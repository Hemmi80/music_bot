const { Client, GatewayIntentBits } = require('discord.js');
const { Player } = require('discord-player');
const { SoundCloudExtractor, AttachmentExtractor } = require('@discord-player/extractor');
const { token } = require('./config');
const { checkYtDlp } = require('./utils/yt-dlp');
const path = require('path');
const fs = require('fs');

console.log('=== Music Bot Starting ===');

// Check yt-dlp availability at startup
const ytDlpOk = checkYtDlp();
console.log('yt-dlp available:', ytDlpOk);

// Find FFmpeg path
let ffmpegPath = null;
try {
  require('child_process').execSync('ffmpeg -version', { stdio: 'ignore' });
  ffmpegPath = 'ffmpeg'; // system ffmpeg
  console.log('ffmpeg: available (system)');
} catch {
  try {
    ffmpegPath = require('ffmpeg-static');
    console.log('ffmpeg: available (ffmpeg-static):', ffmpegPath);
  } catch {
    console.error('ffmpeg: NOT FOUND - audio will not work!');
  }
}

// Set FFMPEG_PATH environment variable for discord-player
if (ffmpegPath) {
  process.env.FFMPEG_PATH = ffmpegPath;
}

if (!token || typeof token !== 'string' || !token.trim()) {
  console.error('DISCORD_TOKEN is missing or empty.');
  process.exit(1);
}
console.log('Token: present');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Create player with explicit FFmpeg configuration and longer timeouts
const player = new Player(client, {
  skipFFmpeg: false,
  probeTimeout: 30000,        // 30 seconds to probe stream
  connectionTimeout: 30000,   // 30 seconds to connect
});
client.player = player;
console.log('Player created with extended timeouts');

// Custom stream handler for YouTube URLs with FFmpeg reconnection
player.extractors.context.onBeforeCreateStream = async (track, source, queue) => {
  // Only handle googlevideo URLs (from yt-dlp)
  if (!track.url || !track.url.includes('googlevideo.com')) {
    return null; // Let default handler process it
  }
  
  console.log('[onBeforeCreateStream] Creating FFmpeg stream for YouTube');
  const { spawn } = require('child_process');
  
  // FFmpeg with reconnection options for YouTube streams
  const ffmpeg = spawn('ffmpeg', [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', track.url,
    '-analyzeduration', '0',
    '-loglevel', 'warning',
    '-f', 's16le',
    '-ar', '48000',
    '-ac', '2',
    'pipe:1'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  
  ffmpeg.on('error', (err) => console.error('[ffmpeg] error:', err.message));
  ffmpeg.stderr.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) console.log('[ffmpeg]', msg);
  });
  
  return {
    stream: ffmpeg.stdout,
    type: 'raw'
  };
};

const playerEvents = require('./events/playerEvents');
for (const ev of playerEvents) {
  player.events.on(ev.name, ev.execute);
}

// Also listen for player-level errors
player.on('error', (error) => {
  console.error('[player] error:', error);
});

// Only load extractors that work reliably - skip broken YouTube extractor
async function loadExtractors() {
  console.log('Loading extractors...');
  // SoundCloud extractor
  await player.extractors.register(SoundCloudExtractor, {});
  console.log('- SoundCloudExtractor loaded');
  // Attachment extractor for direct URLs (used by yt-dlp fallback)
  await player.extractors.register(AttachmentExtractor, {});
  console.log('- AttachmentExtractor loaded');
  console.log('Extractors ready');
}

// Load command files
client.commands = new Map();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if (command.data?.name) client.commands.set(command.data.name, command);
  }
}

// Load event files
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'));
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.name && event.execute) {
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
      } else {
        client.on(event.name, (...args) => event.execute(...args));
      }
    }
  }
}

(async () => {
  await loadExtractors();
  await client.login(token);
})();
