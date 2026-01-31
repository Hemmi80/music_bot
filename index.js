const { Client, GatewayIntentBits } = require('discord.js');
const { Player } = require('discord-player');
const { YoutubeiExtractor } = require('discord-player-youtubei');
const { DefaultExtractors } = require('@discord-player/extractor');
const { token } = require('./config');
const path = require('path');
const fs = require('fs');

if (!token || typeof token !== 'string' || !token.trim()) {
  const tokenLikeKeys = Object.keys(process.env).filter(
    (k) => k.includes('DISCORD') || k.includes('TOKEN')
  );
  console.error(
    'DISCORD_TOKEN is missing or empty. On Railway: set DISCORD_TOKEN in your service Variables tab.'
  );
  if (tokenLikeKeys.length) {
    console.error('Env keys that might be relevant:', tokenLikeKeys.join(', '));
  }
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const player = new Player(client);
client.player = player;

const playerEvents = require('./events/playerEvents');
for (const ev of playerEvents) {
  player.events.on(ev.name, ev.execute);
}

// ANDROID client + disablePlayer avoids signature decipher (fixes "Failed to extract signature decipher algorithm" and reduces memory)
async function loadExtractors() {
  await player.extractors.register(YoutubeiExtractor, {
    disablePlayer: true,
    streamOptions: { useClient: 'ANDROID' },
  });
  await player.extractors.loadMulti(DefaultExtractors);
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
