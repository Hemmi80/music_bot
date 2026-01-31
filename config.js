require('dotenv').config();

const raw = process.env.DISCORD_TOKEN;
let token = typeof raw === 'string' ? raw.trim() : raw;
if (token && (token.startsWith('"') || token.startsWith("'"))) {
  token = token.slice(1, -1);
}
module.exports = { token };
