const { Events, REST, Routes } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { token } = require('../config');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);

    const commands = [];
    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));
    for (const file of commandFiles) {
      const command = require(path.join(commandsPath, file));
      if (command.data) commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(token);
    const clientId = client.user.id;
    try {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log(`Registered ${commands.length} slash command(s).`);
    } catch (err) {
      console.error('Failed to register slash commands:', err);
    }
  },
};
