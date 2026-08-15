import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Eye, Radio, Play, Disc, ExternalLink, Sparkles, Zap, Shield, Bell, ArrowRight, Volume2, VolumeX } from "lucide-react";
import { fileUrl, api, DEFAULT_AVATAR } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import HlsPlayer from "@/components/HlsPlayer";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, deleteDoc, query, where, onSnapshot } from "firebase/firestore";

const FALLBACK_THUMBS = [
  "https://images.unsplash.com/photo-1541126274323-dbac58d14741?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
  "https://images.unsplash.com/photo-1516873240891-4bf014598ab4?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
  "https://images.unsplash.com/photo-1496337589254-7e19d01cec44?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
  "https://images.unsplash.com/photo-1574169208507-84376144848b?crop=entropy&cs=srgb&fm=jpg&w=800&q=80",
  "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?crop=entropy&cs=srgb&fm=jpg&w=800&q=80"
];

function hashPick(str, arr) {
  if (!str) return arr[0];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

export default function StreamCarousel({ allChannels = [], channels = [], isLoading = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subscribedBroadcasters, setSubscribedBroadcasters] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);

  // Listen to the user's live notification subscriptions in Firestore
  useEffect(() => {
    if (!user?.uid) {
      setSubscribedBroadcasters([]);
      return;
    }

    const q = query(
      collection(db, "subscriptions"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subs = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.broadcaster_username) {
          subs.push(data.broadcaster_username.toLowerCase());
        }
      });
      setSubscribedBroadcasters(subs);
    }, (err) => {
      console.warn("Failed to listen to subscriptions:", err);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const channelsList = (allChannels && allChannels.length > 0) ? allChannels : channels;

  // Filter channels to remove generic / empty names and select ONLY live ones
  const seenUsernames = new Set();
  const carouselItems = (channelsList || []).filter((c) => {
    if (!c) return false;
    const username = (c.username || "").trim().toLowerCase();
    if (!username || username === "undefined" || username === "channel" || username === "null") {
      return false;
    }
    if (seenUsernames.has(username)) return false;
    seenUsernames.add(username);
    return Boolean(c.is_live || c.isLive);
  });

  const handleToggleNotification = async (e, channel) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.error("Please log in to sign up for notifications.");
      navigate("/login");
      return;
    }

    const slug = (channel.username || channel.channel_id || channel.id || "channel").toLowerCase();
    const isSubbed = subscribedBroadcasters.includes(slug);
    const subId = `${user.uid}_${slug}`;
    const subRef = doc(db, "subscriptions", subId);

    try {
      if (isSubbed) {
        await deleteDoc(subRef);
        toast.success(`Notifications disabled for @${slug}`);
      } else {
        await setDoc(subRef, {
          id: subId,
          userId: user.uid,
          broadcaster_username: slug,
          broadcaster_display_name: channel.display_name || slug,
          created_at: new Date().toISOString(),
          active: true
        });
        toast.success(`Notifications enabled! We'll ping you when @${slug} goes live.`);
      }
    } catch (err) {
      console.error("Failed to toggle subscription:", err);
      toast.error("Subscription failed. Please check rules or connection.");
    }
  };

  const nextSlide = () => {
    if (carouselItems.length === 0) return;
    setActiveIndex((prev) => (prev + 1) % carouselItems.length);
  };

  const prevSlide = () => {
    if (carouselItems.length === 0) return;
    setActiveIndex((prev) => (prev - 1 + carouselItems.length) % carouselItems.length);
  };

  const totalLiveViewers = carouselItems.reduce((sum, c) => sum + Number(c.viewer_count || 0), 0);

  // Active channel details
  const activeChannel = carouselItems[activeIndex];

  return (
    <section 
      id="stream-carousel"
      className="relative border-b border-[#1f1f23] bg-[#08080a] text-white py-6 md:py-8 overflow-hidden select-none"
      data-testid="stream-carousel"
    >
      {/* Dark Ambient Grid Layout */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#121214_1px,transparent_1px),linear-gradient(to_bottom,#121214_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />

      <div className="relative mx-auto max-w-[1440px] px-6">
        {/* Top Header Marquee & Viewer counter */}
        <div className="w-full flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex-1 max-w-xl">
            <div className="flex items-center gap-3 overflow-hidden border border-[#e5ff00]/15 bg-[#050507] px-3.5 py-1.5 font-mono text-[10px] tracking-wider text-[#e5ff00]">
              <span className="shrink-0 bg-[#e5ff00] text-black px-1.5 py-0.5 font-black text-[8px] uppercase tracking-widest flex items-center gap-1">
                <span className="h-1 w-1 bg-black rounded-full animate-pulse" />
                SYSTEM GENRES
              </span>
              <div className="relative flex flex-1 overflow-hidden select-none">
                <div className="flex w-max animate-marquee space-x-6 whitespace-nowrap">
                  {["JUNGLE", "DRUM & BASS", "UK GARAGE", "DUBSTEP", "GRIME", "BASSLINE", "BREAKCORE", "SPEED GARAGE", "TECHNO", "SOUND SYSTEM"].map((genre, index) => (
                    <span key={index} className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-widest text-[#e5ff00]">
                      <span>{genre}</span>
                      <span className="text-zinc-700">//</span>
                    </span>
                  ))}
                  {/* Repeated for continuous loop */}
                  {["JUNGLE", "DRUM & BASS", "UK GARAGE", "DUBSTEP", "GRIME", "BASSLINE", "BREAKCORE", "SPEED GARAGE", "TECHNO", "SOUND SYSTEM"].map((genre, index) => (
                    <span key={`dup-${index}`} className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-widest text-[#e5ff00]">
                      <span>{genre}</span>
                      <span className="text-zinc-700">//</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
            <div className="flex items-center gap-2 border border-[#27272a] bg-[#09090b] px-3.5 py-2 font-mono text-[10px] text-zinc-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`absolute inline-flex h-full w-full rounded-full ${carouselItems.length > 0 ? "bg-red-500" : "bg-[#e5ff00]"} opacity-75 animate-ping`} />
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${carouselItems.length > 0 ? "bg-red-500" : "bg-[#e5ff00]"}`} />
              </span>
              <span className="font-bold text-white uppercase">
                {carouselItems.length > 0 ? `${totalLiveViewers} VIEWERS ACTIVE` : "SCANNING FOR SIGNALS"}
              </span>
            </div>
          </div>
        </div>

        {/* LOADING STATE */}
        {isLoading && carouselItems.length === 0 && (
          <div className="flex gap-6 overflow-x-auto pb-4" data-testid="carousel-loading-skeletons">
            {[1, 2, 3].map((num) => (
              <div key={num} className="shrink-0 w-[310px] sm:w-[360px] md:w-[400px] border border-[#1a1a1d] bg-[#070709] aspect-[16/9] animate-pulse" />
            ))}
          </div>
        )}

        {/* STANDBY STATE (Vinyl deck details for setup) */}
        {!isLoading && carouselItems.length === 0 && (
          <div className="border border-[#27272a] bg-[#070709] p-6 sm:p-8 relative overflow-hidden shadow-2xl" data-testid="carousel-empty-state">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(229,255,0,0.02),transparent_60%)] pointer-events-none" />
            <div className="absolute top-0 right-0 p-3 font-mono text-[8px] text-zinc-600 tracking-widest select-none">// SYSTEM MODULE: standby_v0.9.1</div>
            
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Spinning Vinyl Deck */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center border border-[#1c1c1f] bg-black/60 p-6 relative overflow-hidden group">
                <div className="absolute inset-0 bg-[radial-gradient(#141417_1px,transparent_1px)] [background-size:12px_12px] opacity-40 pointer-events-none" />
                <div className="w-full flex items-center justify-between mb-4 px-2 font-mono text-[8px] text-zinc-500">
                  <span>DECK: A // STANDBY</span>
                  <div className="flex gap-0.5 items-center">
                    <span className="h-1.5 w-1 bg-[#e5ff00] animate-pulse" />
                    <span className="h-2 w-1 bg-[#e5ff00]" />
                    <span className="h-3 w-1 bg-[#e5ff00] animate-pulse" />
                  </div>
                </div>

                <div className="relative h-44 w-44 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-[#e5ff00]/10 animate-ping opacity-25" />
                  <div className="absolute inset-2 rounded-full border border-zinc-800 bg-[#0c0c0e]" />
                  
                  <div className="relative h-32 w-32 rounded-full bg-[#111113] border-4 border-[#1c1c1f] flex items-center justify-center animate-[spin_8s_linear_infinite] group-hover:animate-[spin_2s_linear_infinite] transition-all duration-300 shadow-2xl cursor-pointer">
                    <div className="absolute inset-2 rounded-full border border-black/40" />
                    <div className="absolute inset-4 rounded-full border border-black/40" />
                    <div className="absolute inset-6 rounded-full border border-black/40" />
                    <div className="h-10 w-10 rounded-full bg-[#e5ff00] flex items-center justify-center p-1 text-center shadow-md border-2 border-black">
                      <Disc className="h-4 w-4 text-black animate-spin" />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    try {
                      const AudioContext = window.AudioContext || window.webkitAudioContext;
                      if (!AudioContext) return;
                      const ctx = new AudioContext();
                      const osc = ctx.createOscillator();
                      const gainNode = ctx.createGain();
                      osc.type = "sawtooth";
                      osc.frequency.setValueAtTime(140, ctx.currentTime);
                      osc.frequency.exponentialRampToValueAtTime(580, ctx.currentTime + 0.3);
                      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.6);
                      gainNode.gain.setValueAtTime(0, ctx.currentTime);
                      gainNode.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.1);
                      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
                      osc.connect(gainNode);
                      gainNode.connect(ctx.destination);
                      osc.start();
                      osc.stop(ctx.currentTime + 0.6);
                      toast.success("🚨 SOUNDSYSTEM SIREN TRIGGERED! // HEAVYWEIGHT SIGNALS");
                    } catch (e) {
                      console.warn(e);
                    }
                  }}
                  className="mt-5 inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#e5ff00]/30 bg-black hover:border-[#e5ff00] hover:bg-[#e5ff00]/10 text-[#e5ff00] font-mono text-[9px] font-bold uppercase tracking-wider transition-all"
                >
                  <Volume2 className="h-3.5 w-3.5 animate-bounce" />
                  <span>TRIGGER HYPE SIREN 🚨</span>
                </button>
              </div>

              {/* Creator benefits / Quick SetupOBS terminal */}
              <div className="lg:col-span-7 flex flex-col justify-between border border-[#1c1c1f] bg-[#0a0a0d] p-5 sm:p-6 font-mono text-xs">
                <div className="border-b border-[#1c1c1f] pb-3 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#e5ff00] font-bold">
                    <Sparkles className="h-4 w-4 animate-pulse text-[#e5ff00]" />
                    <span>// CREATOR BENEFITS // CLAIM YOUR FREQUENCY</span>
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                  <p className="text-zinc-400 text-[11px] leading-relaxed mb-2 font-mono">
                    We built <span className="text-[#e5ff00] font-bold">SPARKZ.TV</span> specifically for underground music curators, sound-system crews, and independent DJs. No DMCA muted mixes. Just pure high-fidelity transmission.
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-black/40 border border-[#1c1c1f]/60 p-3 flex items-start gap-3">
                      <div className="bg-[#e5ff00]/5 p-2 border border-[#e5ff00]/20 rounded-none shrink-0 text-[#e5ff00]">
                        <Disc className="h-4 w-4 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[#e5ff00] font-extrabold text-[10px] uppercase tracking-wider">
                          100% TIP EARNINGS VIA VINYL BITS
                        </div>
                        <p className="text-zinc-500 text-[10px] leading-relaxed uppercase">
                          Keep 100% of your support. Our tipping system lets your community drop custom bits straight into your live mix.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#1c1c1f] pt-4 mt-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  <Link to="/directory" className="inline-flex items-center gap-1 text-[9px] text-zinc-500 hover:text-[#e5ff00] uppercase tracking-widest font-bold">
                    <span>Browse Active Channels</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <div className="flex gap-2">
                    <Link
                      to={user ? `/channel/${user.username || "djsparkz"}` : "/register"}
                      className="btn-primary px-6 py-2.5 text-[10px] flex items-center justify-center gap-1.5 font-bold tracking-widest bg-[#e5ff00] text-black hover:bg-white transition-colors"
                    >
                      <span>{user ? "ENTER CREATOR DASHBOARD" : "CLAIM YOUR FREQUENCY"}</span>
                      <ArrowRight className="h-4 w-4 text-black" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TWITCH-STYLE 3D DECK CAROUSEL FOR LIVE CHANNELS */}
        {!isLoading && carouselItems.length > 0 && (
          <div className="relative w-full flex flex-col items-center">
            {/* Carousel Core */}
            <div className="relative w-full h-[250px] sm:h-[350px] md:h-[450px] flex items-center justify-center select-none overflow-visible">
              
              {/* Arrow navigation inside the stage boundary */}
              <button 
                onClick={prevSlide}
                className="absolute left-2 md:left-6 z-30 h-11 w-11 flex items-center justify-center rounded-full bg-black/80 hover:bg-black border border-zinc-800 text-zinc-400 hover:text-[#e5ff00] hover:border-[#e5ff00] transition-all shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                aria-label="Previous stream"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              <button 
                onClick={nextSlide}
                className="absolute right-2 md:right-6 z-30 h-11 w-11 flex items-center justify-center rounded-full bg-black/80 hover:bg-black border border-zinc-800 text-zinc-400 hover:text-[#e5ff00] hover:border-[#e5ff00] transition-all shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                aria-label="Next stream"
              >
                <ChevronRight className="h-6 w-6" />
              </button>

              {/* Slider Deck containing active (center) and flanking cards */}
              <div className="relative w-full max-w-[1000px] h-full flex items-center justify-center overflow-visible">
                {carouselItems.map((item, index) => {
                  const isCenter = index === activeIndex;
                  const isLeft = index === (activeIndex - 1 + carouselItems.length) % carouselItems.length;
                  const isRight = index === (activeIndex + 1) % carouselItems.length;

                  // Resolve final thumb image
                  const thumbSrc = item.thumbnail_url || item.thumbnailUrl || item.preview_image || item.previewImage;
                  const finalThumb = thumbSrc
                    ? (thumbSrc.startsWith("http") ? thumbSrc : fileUrl(thumbSrc))
                    : hashPick(item.username, FALLBACK_THUMBS);

                  if (!isCenter && !isLeft && !isRight) return null;

                  let cardStyle = "";
                  let zIndex = 10;
                  let animateProps = {};

                  if (isCenter) {
                    cardStyle = "w-[80%] md:w-[65%] lg:w-[60%] aspect-[16/9] opacity-100 scale-100 shadow-[0_12px_36px_rgba(0,0,0,0.8)] border border-[#1f1f23]";
                    zIndex = 20;
                    animateProps = { scale: 1, x: 0, opacity: 1, rotateY: 0 };
                  } else if (isLeft) {
                    cardStyle = "w-[50%] md:w-[45%] lg:w-[40%] aspect-[16/9] opacity-40 scale-[0.85] cursor-pointer hover:opacity-60 border border-zinc-900";
                    zIndex = 5;
                    animateProps = { scale: 0.8, x: "-32%", opacity: 0.35, rotateY: 25 };
                  } else if (isRight) {
                    cardStyle = "w-[50%] md:w-[45%] lg:w-[40%] aspect-[16/9] opacity-40 scale-[0.85] cursor-pointer hover:opacity-60 border border-zinc-900";
                    zIndex = 5;
                    animateProps = { scale: 0.8, x: "32%", opacity: 0.35, rotateY: -25 };
                  }

                  return (
                    <motion.div
                      key={`${item.username || index}`}
                      className={`absolute rounded-none overflow-hidden bg-[#09090c] transition-all flex flex-col ${cardStyle}`}
                      style={{ zIndex, transformStyle: "preserve-3d" }}
                      animate={animateProps}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                      onClick={() => {
                        if (isLeft) prevSlide();
                        if (isRight) nextSlide();
                      }}
                    >
                      {/* Video Player Stage for Active Center Card */}
                      <div className="relative w-full h-full bg-black flex-1 overflow-hidden">
                        {isCenter ? (
                          <HlsPlayer
                            playbackId={item.playback_id || item.playbackId}
                            isLive={true}
                            autoPlay={true}
                            muted={isMuted}
                            streamTitle={item.stream_title}
                            viewerCount={item.viewer_count}
                            username={item.username}
                            controls={true}
                          />
                        ) : (
                          <img
                            src={finalThumb}
                            alt={item.display_name}
                            className="w-full h-full object-cover select-none pointer-events-none"
                            referrerPolicy="no-referrer"
                          />
                        )}

                        {/* Top Overlays */}
                        <div className="absolute left-3 top-3 flex items-center gap-2 z-10 pointer-events-none">
                          <span className="inline-flex items-center gap-1.5 bg-red-600 px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            LIVE
                          </span>
                          <span className="inline-flex items-center gap-1 bg-black/75 px-2 py-0.5 font-mono text-[9px] text-zinc-300">
                            <Eye className="h-3 w-3 text-[#e5ff00]" />
                            {item.viewer_count || 0}
                          </span>
                        </div>

                        {/* Mute toggle button directly on the video player */}
                        {isCenter && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsMuted(!isMuted);
                            }}
                            className="absolute bottom-3 right-3 z-20 h-8 w-8 flex items-center justify-center rounded-full bg-black/70 hover:bg-black border border-zinc-800 text-[#e5ff00]"
                            title={isMuted ? "Unmute Stream Preview" : "Mute Stream Preview"}
                          >
                            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Centered Active Metadata Section directly below player */}
            <AnimatePresence mode="wait">
              {activeChannel && (
                <motion.div
                  key={activeChannel.username}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className="w-full max-w-[800px] mt-4 p-4 border border-[#1f1f23] bg-[#0a0a0d] shadow-lg flex flex-col md:flex-row items-center md:items-start justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Link to={`/channel/${activeChannel.username}`} className="shrink-0 relative">
                      <div className="absolute inset-0 rounded-full bg-[#bf94ff]/20 blur-[1px]" />
                      <img
                        src={activeChannel.photo_url ? fileUrl(activeChannel.photo_url) : DEFAULT_AVATAR}
                        alt=""
                        className="relative h-11 w-11 rounded-full object-cover border border-[#e5ff00]"
                        referrerPolicy="no-referrer"
                      />
                    </Link>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link to={`/channel/${activeChannel.username}`} className="font-display font-black text-sm text-white hover:text-[#e5ff00] transition">
                          {activeChannel.display_name || activeChannel.username}
                        </Link>
                        <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-[#9146ff] text-white">
                          <Shield className="h-2 w-2 fill-current" />
                        </span>
                        <span className="font-mono text-[9px] text-zinc-500">@{activeChannel.username}</span>
                      </div>

                      <h4 className="font-sans text-xs text-zinc-200 mt-1 font-semibold leading-relaxed line-clamp-1">
                        {activeChannel.stream_title || "High fidelity electronic session"}
                      </h4>

                      <div className="flex items-center gap-2 mt-1.5">
                        <Link to="/browse" className="font-mono text-[9px] uppercase tracking-widest text-[#bf94ff] hover:underline">
                          {activeChannel.category || "music"}
                        </Link>
                        <span className="text-zinc-600 font-mono text-[9px]">•</span>
                        <span className="font-mono text-[9px] text-zinc-500">
                          {activeChannel.bio || "Resident Selectors"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Notify, Tune In) */}
                  <div className="flex items-center gap-2 shrink-0 self-stretch md:self-auto justify-end w-full md:w-auto">
                    <button
                      onClick={(e) => handleToggleNotification(e, activeChannel)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider border transition-all ${
                        subscribedBroadcasters.includes(activeChannel.username.toLowerCase())
                          ? "border-[#e5ff00] bg-[#e5ff00]/10 text-[#e5ff00]"
                          : "border-zinc-800 bg-black text-zinc-400 hover:text-white hover:border-zinc-500"
                      }`}
                    >
                      <Bell className="h-3.5 w-3.5" />
                      <span>{subscribedBroadcasters.includes(activeChannel.username.toLowerCase()) ? "NOTIFIED" : "NOTIFY ME"}</span>
                    </button>

                    <Link
                      to={`/channel/${activeChannel.username}`}
                      className="inline-flex items-center gap-1 bg-[#9146ff] hover:bg-[#772ce8] border border-transparent text-white px-4 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider transition-all"
                    >
                      <span>TUNE IN NOW</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}
