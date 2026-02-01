const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const { spawn } = require('child_process');

class MusicQueue {
  constructor(guildId) {
    this.guildId = guildId;
    this.tracks = [];
    this.currentTrack = null;
    this.player = createAudioPlayer();
    this.connection = null;
    this.textChannel = null;
    
    // Handle player state changes
    this.player.on(AudioPlayerStatus.Idle, () => {
      console.log('[player] Idle - playing next');
      this.playNext();
    });
    
    this.player.on('error', (error) => {
      console.error('[player] Error:', error.message);
      if (this.textChannel) {
        this.textChannel.send(`Playback error: ${error.message}`).catch(() => {});
      }
      this.playNext();
    });
  }
  
  async connect(voiceChannel, textChannel) {
    this.textChannel = textChannel;
    
    console.log('[voice] Attempting to join:', voiceChannel.name, voiceChannel.id);
    console.log('[voice] Guild:', voiceChannel.guild.name, voiceChannel.guild.id);
    
    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });
    
    // Debug: log all state changes
    this.connection.on('stateChange', (oldState, newState) => {
      console.log(`[voice] State: ${oldState.status} -> ${newState.status}`);
    });
    
    this.connection.on('error', (error) => {
      console.error('[voice] Connection error:', error);
    });
    
    // Wait for connection to be ready
    try {
      console.log('[voice] Waiting for Ready state...');
      await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
      console.log('[voice] Connected to', voiceChannel.name);
    } catch (error) {
      console.error('[voice] Failed to connect:', error);
      console.error('[voice] Current state:', this.connection.state.status);
      this.connection.destroy();
      throw new Error('Could not connect to voice channel');
    }
    
    // Subscribe the connection to the player
    this.connection.subscribe(this.player);
    
    // Handle disconnection
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        // Seems to be reconnecting
      } catch {
        // Disconnected
        this.destroy();
      }
    });
  }
  
  addTrack(track) {
    this.tracks.push(track);
    console.log('[queue] Added:', track.title);
  }
  
  async playNext() {
    if (this.tracks.length === 0) {
      this.currentTrack = null;
      console.log('[queue] Empty');
      if (this.textChannel) {
        this.textChannel.send('Queue finished.').catch(() => {});
      }
      return;
    }
    
    this.currentTrack = this.tracks.shift();
    console.log('[queue] Playing:', this.currentTrack.title);
    
    try {
      const resource = await this.createResource(this.currentTrack);
      this.player.play(resource);
      
      if (this.textChannel) {
        this.textChannel.send(`Now playing: **${this.currentTrack.title}**`).catch(() => {});
      }
    } catch (error) {
      console.error('[queue] Failed to create resource:', error.message);
      if (this.textChannel) {
        this.textChannel.send(`Failed to play ${this.currentTrack.title}: ${error.message}`).catch(() => {});
      }
      this.playNext();
    }
  }
  
  async createResource(track) {
    console.log('[resource] Creating for:', track.url);
    
    return new Promise((resolve, reject) => {
      // Use yt-dlp to pipe audio through ffmpeg
      const ytdlp = spawn('yt-dlp', [
        '-f', 'bestaudio',
        '-o', '-',
        '--no-playlist',
        '--no-warnings',
        '-q',
        track.url
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
      
      const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-analyzeduration', '0',
        '-loglevel', 'warning',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
      ], { stdio: ['pipe', 'pipe', 'pipe'] });
      
      // Pipe yt-dlp output to ffmpeg
      ytdlp.stdout.pipe(ffmpeg.stdin);
      
      ytdlp.on('error', (err) => {
        console.error('[yt-dlp] error:', err.message);
        reject(err);
      });
      
      ytdlp.stderr.on('data', (d) => {
        const msg = d.toString().trim();
        if (msg) console.log('[yt-dlp]', msg);
      });
      
      ffmpeg.on('error', (err) => {
        console.error('[ffmpeg] error:', err.message);
        reject(err);
      });
      
      ffmpeg.stderr.on('data', (d) => {
        const msg = d.toString().trim();
        if (msg && !msg.includes('size=')) console.log('[ffmpeg]', msg);
      });
      
      // Create audio resource from ffmpeg output
      const resource = createAudioResource(ffmpeg.stdout, {
        inputType: 'raw',
        inlineVolume: true,
      });
      
      // Set metadata
      resource.metadata = track;
      
      console.log('[resource] Created successfully');
      resolve(resource);
    });
  }
  
  skip() {
    this.player.stop();
  }
  
  stop() {
    this.tracks = [];
    this.player.stop();
  }
  
  pause() {
    this.player.pause();
  }
  
  resume() {
    this.player.unpause();
  }
  
  destroy() {
    this.stop();
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
  }
}

function getQueue(client, guildId) {
  if (!client.queues.has(guildId)) {
    client.queues.set(guildId, new MusicQueue(guildId));
  }
  return client.queues.get(guildId);
}

module.exports = { MusicQueue, getQueue };
