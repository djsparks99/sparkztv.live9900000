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
  viewerCount = 0,
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

  const wrapWithIndustrialFrame = (innerContent) => (
    <div className="relative p-2.5 bg-[#141416] border-2 border-[#2a2a2e] shadow-[0_0_30px_rgba(0,0,0,0.85)] select-none">
      {/* High-tech corner rivets */}
      <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-zinc-600 border border-zinc-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]" />
      <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-zinc-600 border border-zinc-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]" />
      <div className="absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full bg-zinc-600 border border-zinc-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]" />
      <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-zinc-600 border border-zinc-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]" />
      
      {/* Accent lines or brackets on the corners */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#e5ff00]" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#e5ff00]" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#e5ff00]" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#e5ff00]" />

      {innerContent}
    </div>
  );

  if (offline) {
    return wrapWithIndustrialFrame(
      <div
        className="video-shell aspect-video w-full flex flex-col items-center justify-center bg-[#070708] p-4 sm:p-8 text-center border border-[#27272a]/50"
        data-testid="hls-player-offline"
      >
        <div className="live-badge" style={{ background: "#1f1f23", color: "#a1a1aa", borderColor: "#3f3f46" }}>
          <span className="dot" style={{ background: "#a1a1aa" }} /> OFF AIR
        </div>
        <div className="mt-4 sm:mt-6 flex items-center gap-2 font-display text-lg sm:text-2xl font-black uppercase tracking-tighter text-zinc-500">
          <Radio className="h-5 w-5 sm:h-6 sm:w-6 text-zinc-600 animate-pulse" />
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
      {wrapWithIndustrialFrame(
        <div
          ref={playerRef}
          className="video-shell aspect-video w-full group relative overflow-hidden bg-black border border-[#27272a]/50"
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

          {/* Mobile Viewer Count Overlay inside the player */}
          {isLive && typeof viewerCount === "number" && (
            <div className="absolute top-4 right-4 z-20 block lg:hidden bg-black/75 border border-[#e5ff00]/30 px-2 py-0.5 rounded font-mono text-[10px] font-bold text-[#e5ff00] backdrop-blur-sm shadow-md flex items-center gap-1.5 animate-pulse">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e5ff00] opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#e5ff00]"></span>
              </span>
              <span>{viewerCount} VIEWERS</span>
            </div>
          )}

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
                  <span className="font-mono text-[10px] font-bold tracking-widest text-white animate-pulse">
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
      )}
    </div>
  );
}
