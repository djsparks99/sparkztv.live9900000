import { useEffect, useRef, useState } from "react";
import { api, fileUrl, apiErrorMessage, fileToBase64, compressAndResizeImage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { updateUserProfileInFirestore } from "@/lib/firebase";
import HlsPlayer from "@/components/HlsPlayer";
import SessionList from "@/components/SessionList";
import ScheduleManager from "@/components/ScheduleManager";
import EmoteManager from "@/components/EmoteManager";
import PerformanceChart from "@/components/PerformanceChart";
import LiveDuration from "@/components/LiveDuration";
import UserLocationTime from "@/components/UserLocationTime";
import { toast } from "sonner";
import { Copy, RefreshCw, Radio, Eye, ExternalLink, Zap, Clock, Image as ImageIcon, Trash2, LayoutDashboard, Sliders, Calendar, Music, Globe, Link2 } from "lucide-react";
import { useLivepeerAutoPoll } from "@/hooks/useLivepeerAutoPoll";

const CATEGORIES = [
  "music",
  "drum and bass",
  "dnb",
  "house",
  "tech",
  "dubstep",
  "reggae",
  "acid",
  "jungle",
  "old skool",
];

export default function Dashboard() {
  const { user, setUser } = useAuth();
  const [channel, setChannel] = useState(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("music");
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [reveal, setReveal] = useState(false);
  const [creatingStream, setCreatingStream] = useState(false);
  const [autoDetect, setAutoDetect] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("broadcast");

  // Bio and social states
  const [bio, setBio] = useState("");
  const [genre, setGenre] = useState("");
  const [location, setLocation] = useState("");
  const [scLink, setScLink] = useState("");
  const [mcLink, setMcLink] = useState("");
  const [spLink, setSpLink] = useState("");
  const [igLink, setIgLink] = useState("");
  const [ytLink, setYtLink] = useState("");
  const [twLink, setTwLink] = useState("");

  // Viewer trend state
  const [trendPct, setTrendPct] = useState(null);

  const handleAddTag = () => {
    const trimmed = newTag.trim().toLowerCase();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      toast.error("Tag already exists.");
      return;
    }
    if (tags.length >= 8) {
      toast.error("Maximum of 8 tags allowed.");
      return;
    }
    setTags([...tags, trimmed]);
    setNewTag("");
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  useLivepeerAutoPoll(channel?.username);

  const load = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get("/channels/mine", {
        params: {
          uid: user.uid,
          username: user.username
        },
        headers: {
          "x-user-uid": user.uid || "",
          "x-username": user.username || ""
        }
      });
      if (data) {
        setChannel(data);
        setTitle(data.stream_title || "");
        setCategory(data.category || "music");
        setTags(data.tags || []);
      } else {
        setError("No channel metadata returned from server.");
      }
    } catch (e) {
      console.error("Dashboard load channel error:", e);
      setError(apiErrorMessage(e) || "Failed to load channel data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      load();
      api
        .get("/livepeer/webhook/status")
        .then(({ data }) => setAutoDetect(!!data.configured))
        .catch(() => setAutoDetect(true));

      // Initialize bio and social states
      setBio(user.bio || "");
      setGenre(user.genre || "");
      setLocation(user.location || "");
      if (user.socials) {
        setScLink(user.socials.soundcloud || "");
        setMcLink(user.socials.mixcloud || "");
        setSpLink(user.socials.spotify || "");
        setIgLink(user.socials.instagram || "");
        setYtLink(user.socials.youtube || "");
        setTwLink(user.socials.twitter || "");
      }
    } else if (user === null) {
      setLoading(false);
    }
  }, [user]);

  // Fetch metrics to compute current vs. previous viewer trend
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const { data: list } = await api.get("/channels/mine/metrics");
        if (Array.isArray(list) && list.length >= 2) {
          const currentVal = list[list.length - 1]?.viewer_count || 0;
          const prevVal = list[list.length - 2]?.viewer_count || 0;
          if (prevVal > 0) {
            const pct = Math.round(((currentVal - prevVal) / prevVal) * 100);
            setTrendPct(pct);
          } else if (currentVal > 0) {
            setTrendPct(100);
          } else {
            setTrendPct(0);
          }
        } else {
          setTrendPct(0);
        }
      } catch (err) {
        console.warn("Could not calculate viewer trend:", err);
      }
    };
    if (user) {
      loadMetrics();
    }
  }, [user, channel?.viewer_count]);

  // Poll for auto-detected go-live status while dashboard is open
  useEffect(() => {
    const t = setInterval(() => {
      api
        .get("/channels/mine", {
          params: {
            uid: user.uid,
            username: user.username
          },
          headers: {
            "x-user-uid": user.uid || "",
            "x-username": user.username || ""
          }
        })
        .then(({ data }) => {
          if (!data) return;
          setChannel((prev) => {
            if (!prev) return data;
            if (prev.is_live !== data.is_live) {
              toast.success(
                data.is_live
                  ? "AUTO-DETECT: signal picked up — you're LIVE."
                  : "AUTO-DETECT: signal dropped."
              );
            }
            return {
              ...prev,
              ...data,
            };
          });
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const save = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    try {
      const { data } = await api.patch("/channels/mine", {
        stream_title: title,
        category,
        tags,
        stream_key: channel?.stream_key || undefined,
        playback_id: channel?.playback_id || undefined,
        livepeer_stream_id: channel?.livepeer_stream_id || undefined,
        thumbnail_url: channel?.thumbnail_url || undefined,
      });

      if (user?.uid) {
        const firestorePayload = {
          thumbnail_url: channel?.thumbnail_url || null,
          bio,
          genre,
          location,
          socials: {
            soundcloud: scLink,
            mixcloud: mcLink,
            spotify: spLink,
            instagram: igLink,
            youtube: ytLink,
            twitter: twLink,
          }
        };
        await updateUserProfileInFirestore(user.uid, firestorePayload, user.username);
        let updatedData = null;
        try {
          const { data: uData } = await api.patch("/users/me", firestorePayload);
          updatedData = uData;
        } catch (expressErr) {
          console.warn("Could not sync profile changes with Express backend:", expressErr);
        }
        setUser((prev) => {
          const currentPhotoUrl = prev?.photo_url || null;
          const currentSocialShareImg = prev?.social_share_image_url || null;
          const merged = {
            ...prev,
            ...firestorePayload,
            ...(updatedData || {}),
          };
          if (!merged.photo_url && currentPhotoUrl) {
            merged.photo_url = currentPhotoUrl;
          }
          if (!merged.social_share_image_url && currentSocialShareImg) {
            merged.social_share_image_url = currentSocialShareImg;
          }
          return merged;
        });
      }

      const updatedChannel = {
        ...(channel || {}),
        ...data,
      };
      setChannel(updatedChannel);
      window.dispatchEvent(new CustomEvent("channel-updated", { detail: { channel: updatedChannel } }));
      toast.success("Channel & Profile updated successfully.");
    } catch (e) {
      console.error("Save channel error:", e);
      toast.error("Failed to update channel.");
    }
  };

  const createStream = async (forceNew = true) => {
    setCreatingStream(true);
    try {
      const { data } = await api.post("/stream/create", { forceNew });
      if (data) {
        setChannel((prev) => ({
          ...(prev || {}),
          ...data,
        }));
        setReveal(true);
        toast.success("Stream credentials synchronized.");
      }
    } catch (error) {
      console.error("Stream operation error:", error);
      const errMsg = error.response?.data?.message || error.response?.data?.error || "Unable to update stream key. Please try again.";
      toast.error(errMsg);
    } finally {
      setCreatingStream(false);
    }
  };

  const copy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied.`);
  };

  // 1. If authorization is loading
  if (user === undefined) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-24 text-center">
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-[#e5ff00]" />
          <p className="font-mono text-sm uppercase tracking-widest text-zinc-400">
            Checking authorization...
          </p>
        </div>
      </div>
    );
  }

  // 2. If user is logged out (not authenticated)
  if (user === null) {
    return (
      <div className="mx-auto max-w-md px-6 py-24">
        <div className="border border-[#27272a] bg-[#0a0a0a] p-4 sm:p-6 md:p-8 text-center">
          <div className="label-caps text-red-500 mb-4">// ACCESS DENIED</div>
          <h2 className="font-display text-2xl font-black mb-2 tracking-tight">NOT AUTHENTICATED</h2>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
            You must be logged in to access the Creator Studio / Dashboard.
          </p>
          <a href="/login" className="btn-primary inline-block w-full text-center">
            LOG IN TO SPARKZ.TV
          </a>
        </div>
      </div>
    );
  }

  // 3. If loading API data and we don't have channel state yet
  if (loading && !channel) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-16">
        <div className="h-96 animate-pulse bg-[#0a0a0a] border border-[#27272a]" />
      </div>
    );
  }

  // 4. If loading failed and we don't have channel state yet
  if (error && !channel) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="border border-red-950 bg-[#0a0a0a] p-4 sm:p-6 md:p-8 text-center">
          <div className="label-caps text-red-500 mb-2">// LOADING ERROR</div>
          <h2 className="font-display text-xl font-bold mb-4 tracking-tight">FAILED TO LOAD CREATOR STUDIO</h2>
          <p className="text-zinc-400 text-sm mb-6 font-mono border border-[#27272a] bg-black p-3 rounded text-left overflow-x-auto">
            {error}
          </p>
          <button onClick={load} className="btn-primary w-full flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4" /> RETRY LOADING
          </button>
        </div>
      </div>
    );
  }

  // 5. If channel loaded but somehow still empty (safe fallback)
  if (!channel) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="border border-zinc-800 bg-[#0a0a0a] p-4 sm:p-6 md:p-8 text-center">
          <div className="label-caps text-zinc-500 mb-2">// INITIALIZING</div>
          <h2 className="font-display text-xl font-bold mb-4 tracking-tight">SETTING UP CREATOR STUDIO</h2>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
            We are preparing your stream settings. Click below to initialize your channel.
          </p>
          <button onClick={() => createStream(false)} className="btn-primary w-full">
            INITIALIZE STREAM KEY
          </button>
        </div>
      </div>
    );
  }

  const isLive = Boolean(channel?.is_live || channel?.isLive);

  return (
    <div className="mx-auto max-w-[1440px] px-6 pt-8 pb-24 sm:pb-28 lg:pb-32" data-testid="dashboard-page">
      <header className="mb-8 flex flex-col items-start justify-between gap-4 border-b border-[#27272a] pb-6 sm:flex-row sm:items-end">
        <div>
          <div className="label-caps">// STUDIO</div>
          <h1 className="font-display text-4xl font-black tracking-tighter sm:text-5xl">
            {user?.display_name?.toUpperCase() || channel?.username?.toUpperCase()}
          </h1>
          <div className="mt-1 font-mono text-xs text-zinc-500">
            /channel/{channel.username}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <UserLocationTime />
          <span
            data-testid="auto-detect-badge"
            className="inline-flex items-center gap-2 border border-[#e5ff00] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[#e5ff00]"
          >
            <Zap className="h-3 w-3" /> SIGNAL AUTO-DETECT ACTIVE
          </span>
          {isLive ? (
            <span className="live-badge">
              <span className="dot live-dot" /> ON AIR
            </span>
          ) : (
            <span className="chip">OFF AIR</span>
          )}
        </div>
      </header>

      {/* COMPACT TAB NAVIGATION */}
      <div className="mb-8 flex flex-col sm:flex-row border border-[#27272a] bg-[#0c0c0e] p-1.5 font-mono text-[11px] tracking-widest uppercase">
        <button
          onClick={() => setActiveTab("broadcast")}
          className={`flex items-center justify-center gap-2 px-6 py-3.5 transition-all duration-150 ${
            activeTab === "broadcast"
              ? "bg-[#e5ff00] text-black font-extrabold"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
          }`}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          [1] BROADCAST STUDIO
        </button>
        <button
          onClick={() => setActiveTab("customization")}
          className={`flex items-center justify-center gap-2 px-6 py-3.5 transition-all duration-150 ${
            activeTab === "customization"
              ? "bg-[#e5ff00] text-black font-extrabold"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          [2] CHANNEL CUSTOMIZATION
        </button>
        <button
          onClick={() => setActiveTab("utilities")}
          className={`flex items-center justify-center gap-2 px-6 py-3.5 transition-all duration-150 ${
            activeTab === "utilities"
              ? "bg-[#e5ff00] text-black font-extrabold"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          [3] STUDIO UTILITIES
        </button>
      </div>

      {activeTab === "broadcast" && (
        <div className="grid gap-6 lg:grid-cols-12 animate-fadeIn">
          {/* Main Video & Streaming Credentials */}
          <section className="lg:col-span-8">
            <div className="mb-3 flex items-center justify-between">
              <div className="label-caps">// LIVE PREVIEW</div>
              <div className="flex items-center gap-2">
                {isLive ? (
                  <span className="live-badge">
                    <span className="dot live-dot" /> ON AIR
                  </span>
                ) : (
                  <span className="chip">OFF AIR</span>
                )}
                {isLive && channel.stream_started_at && (
                  <span
                    className="inline-flex items-center gap-1.5 border border-[#e5ff00] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[#e5ff00]"
                    data-testid="dashboard-live-duration"
                  >
                    <Clock className="h-3 w-3" />
                    <LiveDuration startedAt={channel.stream_started_at} />
                  </span>
                )}
                <span className="chip inline-flex items-center gap-1.5" data-testid="dashboard-viewer-count-chip">
                  <Eye className="h-3 w-3" />
                  <span>{channel.viewer_count || 0}</span>
                  {trendPct !== null && trendPct !== 0 && (
                    <span
                      data-testid="viewer-trend-indicator"
                      className={`inline-flex items-center text-[10px] font-mono font-bold ml-1 px-1 py-0.2 rounded-sm ${
                        trendPct > 0 ? "text-emerald-400 bg-emerald-950/40" : "text-rose-400 bg-rose-950/40"
                      }`}
                    >
                      {trendPct > 0 ? `▲ +${trendPct}%` : `▼ ${trendPct}%`}
                    </span>
                  )}
                </span>
              </div>
            </div>
            {isLive ? (
              <HlsPlayer playbackId={channel.playback_id} isLive={true} />
            ) : (
              <HlsPlayer playbackId={channel.playback_id} isLive={false} />
            )}

            {/* Broadcast credentials */}
            <div className="mt-6 border border-[#27272a] bg-[#0a0a0a] p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="label-caps mb-0">// BROADCAST CREDENTIALS (IVS CHANNEL)</div>
                <div className="flex items-center gap-3">
                  <button
                    data-testid="create-stream-btn"
                    onClick={() => createStream(true)}
                    disabled={creatingStream}
                    className="btn-ghost inline-flex items-center gap-1.5 text-xs text-[#e5ff00]"
                  >
                    <RefreshCw className={`h-3 w-3 ${creatingStream ? "animate-spin" : ""}`} />
                    {creatingStream
                      ? "GENERATING..."
                      : channel?.stream_key || channel?.streamKey
                      ? "REGENERATE KEY"
                      : "GENERATE KEY"}
                  </button>
                  <a
                    href="https://obsproject.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white"
                  >
                    OBS DOCS <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              <div className="space-y-4">
                <CredentialRow
                  label="RTMP SERVER"
                  value={channel.rtmp_url || channel.rtmpUrl || "rtmps://global-ingest.live-video.net:443/app/"}
                  onCopy={copy}
                  testid="rtmp-url"
                />
                <CredentialRow
                  label="STREAM KEY"
                  value={channel.stream_key || channel.streamKey || ""}
                  secret={!reveal}
                  onCopy={copy}
                  onToggle={() => setReveal((v) => !v)}
                  reveal={reveal}
                  placeholder="Click 'GENERATE KEY' to generate"
                  testid="stream-key"
                />
                <CredentialRow
                  label="PLAYBACK URL"
                  value={channel.playback_url || channel.playbackUrl || channel.playback_id || ""}
                  onCopy={copy}
                  testid="playback-url"
                />
                <CredentialRow
                  label="OBS BROWSER OVERLAY"
                  value={`${window.location.origin}/overlay/${channel.username || ""}`}
                  onCopy={copy}
                  testid="obs-overlay-url"
                />
              </div>
              <p className="mt-4 border-t border-[#27272a] pt-4 font-mono text-[11px] leading-relaxed text-zinc-500">
                → Open OBS → Settings → Stream → Service: Custom → paste RTMP Server + Stream Key → Start
                Streaming. Your channel flips to LIVE automatically the second Amazon IVS detects the
                signal — no need to touch a button.
              </p>
            </div>

            {/* Live Stream performance visualization */}
            <div className="mt-6">
              <PerformanceChart />
            </div>
          </section>

          {/* Quick Stats Sidebar */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="border border-[#27272a] bg-[#0a0a0a] p-6">
              <div className="label-caps">// PUBLIC CHANNEL INFO</div>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto whitespace-nowrap border border-[#27272a] bg-black px-3 py-2 font-mono text-[11px] text-zinc-300">
                  /channel/{channel.username}
                </code>
                <a
                  href={`/channel/${channel.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost"
                  data-testid="open-public-channel"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="mt-4 border-t border-[#27272a] pt-4 flex items-center justify-between">
                <span className="label-caps mb-0">TOTAL FOLLOWERS</span>
                <span className="font-mono text-lg font-bold text-[#e5ff00]" data-testid="follower-count">
                  {channel.follower_count || 0}
                </span>
              </div>
            </div>

            <div className="border border-[#27272a] bg-[#0a0a0a] p-6 font-mono text-xs text-zinc-400 space-y-3 leading-relaxed">
              <div className="label-caps">// QUICK STATS</div>
              <div className="flex justify-between border-b border-[#18181b] pb-2">
                <span className="text-zinc-500">AUTOPLAY SIGNAL</span>
                <span className="text-[#e5ff00] font-bold">READY</span>
              </div>
              <div className="flex justify-between border-b border-[#18181b] pb-2">
                <span className="text-zinc-500">CHAT OVERLAYS</span>
                <span className="text-white">ACTIVE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">ENCODER PROTOCOL</span>
                <span className="text-zinc-300">RTMPS</span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {activeTab === "customization" && (
        <div className="grid gap-6 lg:grid-cols-12 animate-fadeIn">
          {/* Metadata Customization */}
          <form onSubmit={save} className="lg:col-span-7">
            <div className="border border-[#27272a] bg-[#0a0a0a] p-6">
              <div className="label-caps">// STREAM METADATA CONFIG</div>
              <p className="mt-1 text-xs text-zinc-500 font-mono mb-6">
                Update your stream title, music genres, and tags. These updates reflect globally across the platform.
              </p>
              <div className="space-y-5">
                <div>
                  <label className="label-caps" htmlFor="stream-title">STREAM TITLE</label>
                  <input
                    id="stream-title"
                    data-testid="channel-title-input"
                    className="input-terminal"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={140}
                  />
                </div>
                <div>
                  <label className="label-caps" htmlFor="category">CATEGORY</label>
                  <select
                    id="category"
                    data-testid="channel-category-select"
                    className="input-terminal"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-caps" htmlFor="tags-input">MUSIC GENRES & TAGS</label>
                  <div className="flex gap-2">
                    <input
                      id="tags-input"
                      className="input-terminal"
                      placeholder="e.g. neurofunk, liquid, trance"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-4 py-2 bg-[#e5ff00] text-black font-mono text-xs font-bold hover:bg-[#cbe600] whitespace-nowrap"
                    >
                      ADD
                    </button>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#18181b] border border-[#27272a] rounded-sm text-xs font-mono text-zinc-300"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                    {tags.length === 0 && (
                      <p className="text-[11px] font-mono text-zinc-500 italic mt-0.5">
                        No custom tags added yet.
                      </p>
                    )}
                  </div>
                </div>

                {/* DJ Bio and Location */}
                <div className="pt-6 border-t border-[#1a1a20] space-y-5">
                  <div className="label-caps">// RESIDENT DJ BIO & SPECIFICATIONS</div>
                  
                  <div>
                    <label className="label-caps" htmlFor="dj-bio">DJ BIO</label>
                    <textarea
                      id="dj-bio"
                      data-testid="profile-bio"
                      className="input-terminal min-h-[100px] resize-y"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={280}
                      placeholder="Selectors, tracks, tell 'em what you're about."
                    />
                    <div className="mt-1 flex justify-end">
                      <span className="font-mono text-[9px] text-zinc-500">
                        {bio.length}/280 CHARACTERS
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label-caps" htmlFor="dj-genre">PRIMARY DJ GENRE</label>
                      <div className="relative mt-1">
                        <Music className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                        <input
                          id="dj-genre"
                          className="input-terminal pl-10"
                          value={genre}
                          onChange={(e) => setGenre(e.target.value)}
                          placeholder="e.g. Drum & Bass / Jungle"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label-caps" htmlFor="dj-location">OPERATIONAL LOCATION</label>
                      <div className="relative mt-1">
                        <Globe className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                        <input
                          id="dj-location"
                          className="input-terminal pl-10"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g. London, UK"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Social Links Sub-section */}
                <div className="pt-6 border-t border-[#1a1a20] space-y-4">
                  <div className="label-caps">// DJ SOCIAL CHANNELS</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label-caps" htmlFor="soundcloud">SOUNDCLOUD</label>
                      <div className="relative mt-1">
                        <Link2 className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                        <input
                          id="soundcloud"
                          className="input-terminal pl-10"
                          value={scLink}
                          onChange={(e) => setScLink(e.target.value)}
                          placeholder="soundcloud.com/username"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label-caps" htmlFor="mixcloud">MIXCLOUD</label>
                      <div className="relative mt-1">
                        <Link2 className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                        <input
                          id="mixcloud"
                          className="input-terminal pl-10"
                          value={mcLink}
                          onChange={(e) => setMcLink(e.target.value)}
                          placeholder="mixcloud.com/username"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label-caps" htmlFor="spotify">SPOTIFY</label>
                      <div className="relative mt-1">
                        <Link2 className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                        <input
                          id="spotify"
                          className="input-terminal pl-10"
                          value={spLink}
                          onChange={(e) => setSpLink(e.target.value)}
                          placeholder="open.spotify.com/artist/id"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label-caps" htmlFor="instagram">INSTAGRAM</label>
                      <div className="relative mt-1">
                        <Link2 className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                        <input
                          id="instagram"
                          className="input-terminal pl-10"
                          value={igLink}
                          onChange={(e) => setIgLink(e.target.value)}
                          placeholder="instagram.com/username"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label-caps" htmlFor="youtube">YOUTUBE</label>
                      <div className="relative mt-1">
                        <Link2 className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                        <input
                          id="youtube"
                          className="input-terminal pl-10"
                          value={ytLink}
                          onChange={(e) => setYtLink(e.target.value)}
                          placeholder="youtube.com/@username"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label-caps" htmlFor="twitter">TWITTER / X</label>
                      <div className="relative mt-1">
                        <Link2 className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                        <input
                          id="twitter"
                          className="input-terminal pl-10"
                          value={twLink}
                          onChange={(e) => setTwLink(e.target.value)}
                          placeholder="twitter.com/username"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-[#1a1a20]">
                  <button type="submit" data-testid="channel-save-btn" className="btn-primary w-full md:w-auto">
                    SAVE CHANGES
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Thumbnail Uploader column */}
          <div className="lg:col-span-5">
            <ThumbnailUploader channel={channel} onChange={(c) => setChannel(c)} />
          </div>
        </div>
      )}

      {activeTab === "utilities" && (
        <div className="grid gap-6 lg:grid-cols-12 animate-fadeIn">
          {/* Scheduling and Emotes on main left area */}
          <section className="lg:col-span-8 space-y-6">
            <ScheduleManager channel={channel} onChange={(updated) => setChannel(updated)} />
            <EmoteManager channel={channel} />
          </section>

          {/* Past Sessions list on right sidebar */}
          <aside className="lg:col-span-4">
            <SessionList username={channel.username} mine />
          </aside>
        </div>
      )}
    </div>
  );
}

function CredentialRow({ label, value, secret, onCopy, onToggle, reveal, placeholder, testid }) {
  const hasValue = Boolean(value);
  const display = hasValue
    ? secret
      ? "•".repeat(Math.min(value.length, 28))
      : value
    : placeholder || "Not configured";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="label-caps mb-0">{label}</span>
        {onToggle && hasValue && (
          <button
            type="button"
            data-testid={`${testid}-toggle`}
            onClick={onToggle}
            className="font-mono text-[10px] uppercase tracking-widest text-[#e5ff00] hover:underline cursor-pointer"
          >
            {reveal ? "[ HIDE ]" : "[ REVEAL KEY ]"}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <code
          data-testid={testid}
          className={`flex-1 min-w-0 overflow-x-auto whitespace-nowrap border border-[#27272a] bg-black px-3 py-2 font-mono text-[11px] ${
            hasValue
              ? "text-zinc-100 font-bold select-all selection:bg-[#e5ff00] selection:text-black"
              : "text-zinc-500 italic"
          }`}
        >
          {display}
        </code>
        {hasValue && (
          <button
            type="button"
            data-testid={`${testid}-copy`}
            onClick={() => onCopy(value, label)}
            className="btn-ghost flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs hover:text-[#e5ff00] hover:border-[#e5ff00]"
            aria-label={`Copy ${label}`}
          >
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wider">COPY</span>
          </button>
        )}
      </div>
    </div>
  );
}

function ThumbnailUploader({ channel, onChange }) {
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB.");
      return;
    }
    setUploading(true);
    try {
      const base64 = await compressAndResizeImage(file, 640, 360, 0.7);
      const { data } = await api.post("/channels/mine/thumbnail", {
        image: base64,
        thumbnail: base64,
        file: base64,
        filename: file.name
      });
      onChange?.({ ...channel, thumbnail_url: data.thumbnail_url });
      window.dispatchEvent(new CustomEvent("channel-updated", { detail: { channel: { ...channel, thumbnail_url: data.thumbnail_url } } }));
      if (user?.uid) {
        updateUserProfileInFirestore(user.uid, { thumbnail_url: data.thumbnail_url }, channel?.username || user?.username).catch(() => {});
      }
      toast.success("Preview thumbnail updated.");
    } catch (err) {
      console.error("Thumbnail upload error:", err);
      toast.error(apiErrorMessage(err) || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clear = async () => {
    setClearing(true);
    try {
      await api.delete("/channels/mine/thumbnail");
      onChange?.({ ...channel, thumbnail_url: null });
      window.dispatchEvent(new CustomEvent("channel-updated", { detail: { channel: { ...channel, thumbnail_url: null } } }));
      if (user?.uid) {
        updateUserProfileInFirestore(user.uid, { thumbnail_url: null }).catch(() => {});
      }
      toast.success("Thumbnail cleared.");
    } catch {
      toast.error("Could not clear thumbnail.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="border border-[#27272a] bg-[#0a0a0a] p-6" data-testid="thumbnail-uploader">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-3.5 w-3.5 text-[#e5ff00]" />
        <div className="label-caps mb-0">// PREVIEW THUMBNAIL</div>
      </div>
      <p className="mt-2 font-mono text-[10px] leading-relaxed text-zinc-500">
        Shown on the homepage card. Landscape 16:9 works best.
      </p>

      <div className="mt-4 aspect-video w-full overflow-hidden border border-[#27272a] bg-black">
        {channel.thumbnail_url ? (
          <img
            src={fileUrl(channel.thumbnail_url)}
            alt="Channel thumbnail"
            data-testid="thumbnail-preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="text-center">
              <ImageIcon className="mx-auto h-6 w-6 text-zinc-700" />
              <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                DEFAULT COVER IN USE
              </div>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFile}
        className="hidden"
        data-testid="thumbnail-input"
      />

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          data-testid="thumbnail-upload-btn"
          className="btn-primary flex-1 inline-flex items-center justify-center gap-2"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          {uploading ? "UPLOADING..." : channel.thumbnail_url ? "REPLACE" : "UPLOAD"}
        </button>
        {channel.thumbnail_url && (
          <button
            onClick={clear}
            disabled={clearing}
            data-testid="thumbnail-clear-btn"
            className="btn-ghost"
            aria-label="Clear thumbnail"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        JPG / PNG / WEBP — MAX 8MB
      </p>
    </div>
  );
}
