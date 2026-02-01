const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  StreamType,
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
    
    // Step 1: Get the direct stream URL from yt-dlp (fast, just metadata)
    const streamUrl = await this.getStreamUrl(track.url);
    if (!streamUrl) {
      throw new Error('Could not get stream URL');
    }
    
    console.log('[resource] Got stream URL, starting FFmpeg...');
    
    // Just copy the audio stream - no re-encoding! Source is already opus.
    const ffmpeg = spawn('ffmpeg', [
      '-reconnect', '1',
      '-reconnect_streamed', '1', 
      '-reconnect_delay_max', '5',
      '-i', streamUrl,
      '-vn',                     // No video
      '-c:a', 'copy',            // COPY audio, don't re-encode!
      '-f', 'ogg',               // OGG container
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    
    ffmpeg.on('error', (err) => {
      console.error('[ffmpeg] error:', err.message);
    });
    
    ffmpeg.stderr.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg && (msg.includes('Audio:') || msg.includes('Stream') || msg.includes('error') || msg.includes('Output'))) {
        console.log('[ffmpeg]', msg);
      }
    });
    
    // Create audio resource with OggOpus (passthrough, no quality loss)
    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.OggOpus,
      inlineVolume: false,
    });
    
    resource.metadata = track;
    console.log('[resource] Created (opus passthrough - no re-encoding)');
    return resource;
  }
  
  // Get direct stream URL from yt-dlp
  getStreamUrl(videoUrl) {
    return new Promise((resolve) => {
      const proc = spawn('yt-dlp', [
        '-f', 'bestaudio[acodec=opus]/bestaudio/best',
        '-g',  // Just print URL, don't download
        '--no-playlist',
        videoUrl
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
      
      let url = '';
      proc.stdout.on('data', (d) => { url += d.toString(); });
      
      proc.stderr.on('data', (d) => {
        const msg = d.toString().trim();
        if (msg) console.log('[yt-dlp]', msg);
      });
      
      proc.on('close', (code) => {
        const streamUrl = url.trim();
        if (code === 0 && streamUrl.startsWith('http')) {
          console.log('[yt-dlp] Got stream URL');
          resolve(streamUrl);
        } else {
          console.error('[yt-dlp] Failed to get URL, code:', code);
          resolve(null);
        }
      });
      
      proc.on('error', () => resolve(null));
      
      // Timeout
      setTimeout(() => {
        proc.kill();
        resolve(null);
      }, 15000);
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
