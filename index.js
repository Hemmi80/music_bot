const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { token } = require('./config');
const fs = require('fs');
const path = require('path');

console.log('=== Music Bot v2 Starting ===');

// Check yt-dlp
try {
  require('child_process').execSync('yt-dlp --version', { stdio: 'pipe' });
  console.log('yt-dlp: available');
} catch {
  console.error('yt-dlp: NOT FOUND - YouTube will not work!');
}

// Check ffmpeg
try {
  require('child_process').execSync('ffmpeg -version', { stdio: 'ignore' });
  console.log('ffmpeg: available');
} catch {
  console.error('ffmpeg: NOT FOUND - audio will not work!');
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

// Store for music queues per guild
client.queues = new Map();

// Load commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.data?.name) {
      client.commands.set(command.data.name, command);
    }
  }
  console.log(`Loaded ${client.commands.size} commands`);
}

// Handle interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error('Command error:', error);
    const reply = { content: `Error: ${error.message}`, ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

// Register slash commands on ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  const commands = [];
  for (const [, cmd] of client.commands) {
    if (cmd.data) commands.push(cmd.data.toJSON());
  }
  
  try {
    await client.application.commands.set(commands);
    console.log(`Registered ${commands.length} slash commands`);
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
});

client.login(token);
