import { useState, useRef, useEffect } from "react";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX, Maximize, Radio, Settings, Square } from "lucide-react";
import FloatingReactions from "./FloatingReactions";

export default function HlsPlayer({
  playbackId,
  isLive = true,
  autoPlay = true,
  muted = true,
  streamTitle = "Live Stream",
  controls = true,
  poster = null,
}) {
  const playerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState(muted ? 0 : 0.8);
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [hlsSupported, setHlsSupported] = useState(true);

  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const [analyser, setAnalyser] = useState(null);

  const offline = !playbackId || !isLive;
  const hlsUrl = playbackId
    ? (playbackId.startsWith("http") ? playbackId : `https://livepeercdn.studio/hls/${playbackId}/index.m3u8`)
    : "";

  useEffect(() => {
    const video = videoRef.current;
    if (!video || offline) return;

    const setupAudio = () => {
      if (video.__audioConnected) return;

      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;

        const analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 128; // 64 frequency bins, perfect width
        
        const source = audioCtx.createMediaElementSource(video);
        sourceNodeRef.current = source;
        source.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);

        video.__audioConnected = true;
        setAnalyser(analyserNode);

        const resumeCtx = () => {
          if (audioCtx.state === "suspended") {
            audioCtx.resume();
          }
        };

        video.addEventListener("play", resumeCtx);
        window.addEventListener("click", resumeCtx);

        return () => {
          video.removeEventListener("play", resumeCtx);
          window.removeEventListener("click", resumeCtx);
        };
      } catch (err) {
        console.warn("Could not setup audio analyser:", err);
      }
    };

    video.addEventListener("play", setupAudio);
    video.addEventListener("playing", setupAudio);

    if (!video.paused) {
      setupAudio();
    }

    return () => {
      if (video) {
        video.removeEventListener("play", setupAudio);
        video.removeEventListener("playing", setupAudio);
      }
    };
  }, [offline, hlsUrl]);

  useEffect(() => {
    if (offline || !hlsUrl || !videoRef.current) return;

    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
        lowLatencyMode: true,
      });

      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setLevels(data.levels || []);
        if (autoPlay) {
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {
            setIsPlaying(false);
          });
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        if (hls.autoLevelEnabled) {
          setCurrentLevel(-1);
        } else {
          setCurrentLevel(data.level);
        }
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      if (autoPlay) {
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => setIsPlaying(false));
      }
    }
  }, [hlsUrl, offline, autoPlay]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(e => {
        console.warn("HLS video playback failed:", e);
      });
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const stopStream = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
    setIsPlaying(false);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    if (!nextMuted && volume === 0) {
      setVolume(0.8);
      videoRef.current.volume = 0.8;
    }
  };

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  };

  const selectQuality = (levelIndex) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelIndex;
    setCurrentLevel(levelIndex);
    setShowQualityMenu(false);
  };

  const toggleFullscreen = () => {
    if (!playerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      playerRef.current.requestFullscreen();
    }
  };

  if (offline) {
    return (
      <div
        className="video-shell aspect-video w-full flex flex-col items-center justify-center bg-[#0a0a0a] p-4 sm:p-8 text-center border border-[#27272a]"
        data-testid="hls-player-offline"
      >
        <div className="live-badge" style={{ background: "#27272a", color: "#a1a1aa" }}>
          <span className="dot" style={{ background: "#a1a1aa" }} /> OFF AIR
        </div>
        <div className="mt-4 sm:mt-6 flex items-center gap-2 font-display text-lg sm:text-2xl font-black uppercase tracking-tighter text-zinc-500">
          <Radio className="h-5 w-5 sm:h-6 sm:w-6 text-zinc-600" />
          BROADCASTER IS OFFLINE
        </div>
        <div className="mt-2 max-w-md font-mono text-[10px] sm:text-xs text-zinc-600 px-2">
          The stream will resume automatically the second the DJ starts pushing.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3">
      <div
        ref={playerRef}
        className="video-shell aspect-video w-full group relative overflow-hidden bg-black border border-[#27272a]"
        data-testid="hls-player"
      >
        {/* Video Element */}
        <video
          ref={videoRef}
          playsInline
          muted={isMuted}
          autoPlay={autoPlay}
          crossOrigin="anonymous"
          poster={poster}
          className="h-full w-full object-contain"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Floating Reactions overlay */}
        <FloatingReactions position="right" />

        {/* Initial Muted Autoplay Warning Banner if Muted */}
        {controls && isMuted && isPlaying && (
          <button
            onClick={toggleMute}
            data-testid="unmute-overlay-btn"
            className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded bg-black/80 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#e5ff00] border border-[#e5ff00]/40 backdrop-blur-md transition hover:bg-[#e5ff00] hover:text-black"
          >
            <VolumeX className="h-4 w-4" />
            CLICK TO UNMUTE AUDIO
          </button>
        )}

        {/* Control Bar */}
        {controls && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="flex items-center gap-3">
              {/* Play / Pause */}
              <button
                onClick={togglePlay}
                data-testid="player-play-btn"
                className="text-white hover:text-[#e5ff00]"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>

              {/* Stop Button */}
              <button
                onClick={stopStream}
                data-testid="player-stop-btn"
                className="text-white hover:text-red-400"
                title="Stop Playback"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>

              {/* Volume Control */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  data-testid="player-mute-btn"
                  className="text-white hover:text-[#e5ff00]"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-5 w-5 text-red-400" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  data-testid="player-volume-slider"
                  className="h-1.5 w-16 accent-[#e5ff00] cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 border-l border-zinc-700 pl-3">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                </span>
                <span className="font-mono text-[10px] font-bold tracking-widest text-white">
                  LIVE
                </span>
              </div>
            </div>

            {/* Right Controls: Quality Selector & Fullscreen */}
            <div className="relative flex items-center gap-3">
              {/* Quality Submenu */}
              {levels.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    data-testid="player-quality-btn"
                    className="flex items-center gap-1.5 font-mono text-xs font-bold text-zinc-300 hover:text-[#e5ff00]"
                    title="Select Quality"
                  >
                    <Settings className="h-4 w-4" />
                    <span>
                      {currentLevel === -1
                        ? "AUTO"
                        : `${levels[currentLevel]?.height || "HD"}p`}
                    </span>
                  </button>

                  {showQualityMenu && (
                    <div
                      data-testid="player-quality-menu"
                      className="absolute bottom-8 right-0 z-30 min-w-[120px] rounded border border-[#333] bg-[#0f0f11] py-1 shadow-xl"
                    >
                      <button
                        onClick={() => selectQuality(-1)}
                        className={`block w-full px-3 py-1.5 text-left font-mono text-xs ${
                          currentLevel === -1 ? "text-[#e5ff00] font-bold" : "text-zinc-300"
                        } hover:bg-zinc-800`}
                      >
                        AUTO (Adaptive)
                      </button>
                      {levels.map((lvl, index) => (
                        <button
                          key={index}
                          onClick={() => selectQuality(index)}
                          className={`block w-full px-3 py-1.5 text-left font-mono text-xs ${
                            currentLevel === index ? "text-[#e5ff00] font-bold" : "text-zinc-300"
                          } hover:bg-zinc-800`}
                        >
                          {lvl.height}p ({Math.round(lvl.bitrate / 1000)}k)
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                data-testid="player-fullscreen-btn"
                className="text-white hover:text-[#e5ff00]"
                title="Fullscreen"
              >
                <Maximize className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full-width Audio Visualizer Section directly under the player */}
      <AudioVisualizer 
        analyser={analyser} 
        isMuted={isMuted} 
        isPlaying={isPlaying} 
      />
    </div>
  );
}

function AudioVisualizer({ analyser, isMuted, isPlaying }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    const bufferLength = analyser ? analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);
    let simPhase = 0;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;

      // Solid black terminal backplate
      ctx.fillStyle = "#070708";
      ctx.fillRect(0, 0, w, h);

      // Fine terminal oscilloscope raster lines
      ctx.strokeStyle = "rgba(229, 255, 0, 0.05)";
      ctx.lineWidth = 1;
      
      // Horizontal raster
      for (let y = 10; y < h; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // Vertical grid segments
      for (let x = 30; x < w; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      let active = isPlaying && !isMuted && analyser;
      let isSilent = true;

      if (active) {
        analyser.getByteFrequencyData(dataArray);
        for (let i = 0; i < bufferLength; i++) {
          if (dataArray[i] > 2) {
            isSilent = false;
            break;
          }
        }
      }

      if (!active || isSilent) {
        // Aesthetic ambient movement fallback (so the terminal always feels active)
        simPhase += 0.04;
        for (let i = 0; i < bufferLength; i++) {
          if (isPlaying) {
            const wave1 = Math.sin(i * 0.15 + simPhase);
            const wave2 = Math.cos(i * 0.07 - simPhase * 0.8);
            const val = Math.abs(wave1 * wave2) * 55 + (i % 2 === 0 ? 12 : 3);
            dataArray[i] = val * (isMuted ? 0.25 : 0.7);
          } else {
            // Static ground floor noise
            dataArray[i] = Math.max(0, Math.sin(i + simPhase * 5) * 1.5 + 1);
          }
        }
      }

      // Draw standard symmetrical visualizer or spectrum bar configuration
      const barCount = Math.min(bufferLength, 64);
      const barSpacing = 3;
      const totalSpacing = (barCount - 1) * barSpacing;
      const barWidth = (w - totalSpacing) / barCount;

      let x = 0;

      // Start drawing frequency blocks
      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i];
        const percent = value / 255;
        // Exponential scale to exaggerate mid-low frequencies elegantly
        const scaledPercent = Math.pow(percent, 0.85);
        const barHeight = Math.max(3, scaledPercent * (h - 18));

        // Create sleek high-tech vertical bar gradients
        const gradient = ctx.createLinearGradient(x, h, x, h - barHeight);
        gradient.addColorStop(0, "rgba(229, 255, 0, 0.08)");
        gradient.addColorStop(0.5, "rgba(229, 255, 0, 0.45)");
        gradient.addColorStop(1, "rgba(229, 255, 0, 0.95)");

        ctx.fillStyle = gradient;
        
        // Render stylized segment bars
        ctx.fillRect(x, h - barHeight, barWidth, barHeight);

        // Glowing fluorescent peak indicators
        ctx.fillStyle = "#e5ff00";
        ctx.fillRect(x, Math.max(2, h - barHeight - 2), barWidth, 1.5);

        x += barWidth + barSpacing;
      }

      // Readout Text
      ctx.fillStyle = "rgba(229, 255, 0, 0.75)";
      ctx.font = "bold 8px monospace";
      ctx.letterSpacing = "1px";
      
      const signalText = active && !isSilent 
        ? "SIGNAL STATUS: ONLINE // CAPTURING LIVE AUDIO STREAM" 
        : isPlaying && isMuted 
          ? "SIGNAL STATUS: MUTED // RENDERING AMBIENT PREVIEW" 
          : "SIGNAL STATUS: STANDBY // NO INPUT DETECTED";
      
      ctx.fillText(signalText, 12, 14);

      ctx.textAlign = "right";
      ctx.fillText("48.0 KHZ // STEREO DSP ANALYSER", w - 12, 14);
      ctx.textAlign = "left";
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
    };
  }, [analyser, isMuted, isPlaying]);

  return (
    <div className="w-full h-[52px] border border-[#27272a] bg-[#070708] relative overflow-hidden flex flex-col justify-end">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
