# Discord Music Bot

A Discord bot that plays music from **YouTube**, **SoundCloud**, and **Spotify** links. Spotify links are resolved to YouTube (no Spotify Developer app required).

## Requirements

- **Node.js 18+**
- **FFmpeg** installed and on your PATH ([download](https://ffmpeg.org))
- A **Discord bot token** ([Discord Developer Portal](https://discord.com/developers/applications))

## Setup

1. Clone or download this repo.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the project root (or copy `.env.example`) and add your bot token:
   ```
   DISCORD_TOKEN=your_bot_token_here
   ```
4. Invite the bot to your server with these permissions: **View Channels**, **Send Messages**, **Embed Links**, **Use Slash Commands**, **Connect**, **Speak** (and optionally **Read Message History**).

## Run

```bash
npm start
```

Or:

```bash
node index.js
```

## Commands

| Command | Description |
|--------|-------------|
| `/play <url or search>` | Play a YouTube, SoundCloud, or Spotify link (or search). Spotify links are turned into YouTube searches. |
| `/stop` | Stop playback and clear the queue. |
| `/skip` | Skip the current track. |
| `/queue` | Show the current queue. |
| `/pause` | Pause or resume playback. |

## Spotify (no app)

When someone uses a Spotify track, playlist, or album link, the bot:

1. Fetches track titles and artists from the link (no Spotify API).
2. Searches YouTube for each track and plays the match.

So you don’t need a Spotify Developer app; Spotify is supported via YouTube.

## Hosting (e.g. Railway)

1. Push the repo to GitHub and connect it to Railway.
2. Set the **DISCORD_TOKEN** environment variable in the Railway dashboard.
3. Ensure FFmpeg is available (e.g. use an FFmpeg buildpack or a Dockerfile that installs FFmpeg).
4. Deploy; the bot will register slash commands on startup.

## License

MIT
