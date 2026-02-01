# Discord Music Bot v2

A simple Discord music bot that plays YouTube audio using **@discordjs/voice** and **yt-dlp**.

## Features

- `/play <query>` - Play from YouTube URL, Spotify URL, or search term
- `/skip` - Skip the current track
- `/stop` - Stop and disconnect
- `/pause` - Pause/resume playback
- `/queue` - Show the queue

## Supported Sources

- **YouTube** - Direct URLs (youtube.com, youtu.be)
- **Spotify** - Track URLs (looks up on YouTube and plays)
- **Search** - Just type a song name

## How it works

1. **Spotify URLs** → Extract track info → Search YouTube
2. **yt-dlp** downloads the audio stream from YouTube
3. **FFmpeg** converts it to PCM
4. **@discordjs/voice** plays it in Discord

No complex extractor libraries - just simple piping.

## Requirements

- Node.js 18+
- FFmpeg
- yt-dlp
- A Discord bot token

## Setup

1. Clone this repo
2. `npm install`
3. Create `.env` with `DISCORD_TOKEN=your_token`
4. `npm start`

## Hosting on Railway

Uses Dockerfile which installs ffmpeg and yt-dlp automatically.

1. Connect repo to Railway
2. Set `DISCORD_TOKEN` environment variable
3. Deploy

## License

MIT
