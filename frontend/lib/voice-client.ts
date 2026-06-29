// WebSocket voice connection module for EduAgent.
// Provides a VoiceClient class that connects to the backend WebSocket
// endpoint for real-time voice interaction with server-generated TTS audio.

type VoiceMessageHandler = (data: any) => void;
type AudioHandler = (audioBlob: Blob) => void;
type StatusHandler = (status: string) => void;
type ErrorHandler = (error: string) => void;

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, "ws")!;

export class VoiceClient {
  private ws: WebSocket | null = null;
  private onMessage: VoiceMessageHandler;
  private onAudio: AudioHandler;
  private onStatus: StatusHandler;
  private onError: ErrorHandler;
  private onTranscript: VoiceMessageHandler;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioQueue: Blob[] = [];
  private isPlaying = false;
  private audioContext: AudioContext | null = null;

  constructor(opts: {
    onMessage?: VoiceMessageHandler;
    onAudio?: AudioHandler;
    onStatus?: StatusHandler;
    onError?: ErrorHandler;
    onTranscript?: VoiceMessageHandler;
  }) {
    this.onMessage = opts.onMessage || (() => {});
    this.onAudio = opts.onAudio || (() => {});
    this.onStatus = opts.onStatus || (() => {});
    this.onError = opts.onError || (() => {});
    this.onTranscript = opts.onTranscript || (() => {});
    this.url = `${WS_BASE}/ws/voice`;
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.onStatus("connected");
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          // Handle binary audio data
          if (event.data instanceof Blob) {
            this.handleAudioBlob(event.data);
            this.onAudio(event.data);
            return;
          }

          // Handle JSON messages
          try {
            const data = JSON.parse(event.data);
            switch (data.type) {
              case "agent_reply":
                this.onMessage(data);
                break;
              case "transcript":
                this.onTranscript(data);
                break;
              case "status":
                this.onStatus(data.text);
                break;
              case "error":
                this.onError(data.text);
                break;
            }
          } catch {
            // Ignore unparseable messages
          }
        };

        this.ws.onerror = () => {
          this.onError("WebSocket connection error");
          resolve(false);
        };

        this.ws.onclose = () => {
          this.onStatus("disconnected");
          this.cleanupMedia();
          // Auto-reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(
              () => this.connect(),
              this.reconnectAttempts * 2000
            );
          }
        };
      } catch (e: any) {
        this.onError(`Connection failed: ${e.message}`);
        resolve(false);
      }
    });
  }

  sendText(text: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "text", text }));
    } else {
      this.onError("WebSocket not connected");
    }
  }

  async startMicrophone(): Promise<boolean> {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      // Send raw audio chunks through WebSocket
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(event.data);
        }
      };

      // Collect audio in 1-second chunks
      this.mediaRecorder.start(1000);
      return true;
    } catch (e: any) {
      this.onError(`Microphone error: ${e.message}`);
      return false;
    }
  }

  stopMicrophone() {
    this.cleanupMedia();
  }

  disconnect() {
    this.maxReconnectAttempts = 0; // Prevent reconnect
    this.ws?.close();
    this.ws = null;
    this.cleanupMedia();
    this.audioQueue = [];
    this.isPlaying = false;
  }

  private cleanupMedia() {
    this.mediaRecorder?.stop();
    this.audioStream?.getTracks().forEach((t) => t.stop());
    this.mediaRecorder = null;
    this.audioStream = null;
  }

  private handleAudioBlob(blob: Blob) {
    this.audioQueue.push(blob);
    if (!this.isPlaying) {
      this.playNextAudio();
    }
  }

  private async playNextAudio() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const blob = this.audioQueue.shift()!;

    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      source.onended = () => {
        this.playNextAudio();
      };

      source.start();
    } catch (e) {
      // If decoding fails, try playing as a blob URL
      try {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          URL.revokeObjectURL(url);
          this.playNextAudio();
        };
        audio.play();
      } catch {
        this.playNextAudio();
      }
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
