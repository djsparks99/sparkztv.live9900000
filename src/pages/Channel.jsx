import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, fileUrl, DEFAULT_AVATAR } from "@/lib/api";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import HlsPlayer from "@/components/HlsPlayer";
import ChatPanel from "@/components/ChatPanel";
import FollowButton from "@/components/FollowButton";
import ShareButton from "@/components/ShareButton";
import SessionList from "@/components/SessionList";
import ScheduleDisplay from "@/components/ScheduleDisplay";
import LiveDuration from "@/components/LiveDuration";
import SEO from "@/components/SEO";
import { useAuth } from "@/lib/auth-context";
import { Eye, User, QrCode, Coins, Flag, Check, Gift, Crown, ChevronLeft, ChevronDown, Radio, Sparkles, X, Instagram, Volume2, Disc3, Music, Youtube, Shield } from "lucide-react";
import { useLivepeerAutoPoll } from "@/hooks/useLivepeerAutoPoll";
import { QRCodeSVG } from "qrcode.react";

export default function Channel() {
  const { username } = useParams();
  const { user } = useAuth();
  const [channel, setChannel] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const [isManageSubOpen, setIsManageSubOpen] = useState(false);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(() => {
    try {
      return localStorage.getItem(`chat-collapsed-${username}`) === "true";
    } catch {
      return false;
    }
  });

  const toggleChatCollapse = () => {
    setIsChatCollapsed(prev => {
      const newVal = !prev;
      try {
        localStorage.setItem(`chat-collapsed-${username}`, String(newVal));
      } catch {}
      return newVal;
    });
  };

  const [giftRecipient, setGiftRecipient] = useState("");
  const [giftSuccess, setGiftSuccess] = useState(false);
  const [giftingInProgress, setGiftingInProgress] = useState(false);

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please log in to submit a community moderation report.");
      return;
    }
    if (!reportReason) {
      toast.error("Please select a reason for reporting.");
      return;
    }

    setIsSubmittingReport(true);
    try {
      await api.post(`/channels/${username}/report`, {
        reason: reportReason,
        details: reportDetails,
      });
      toast.success("Thank you for your report. Our moderators will review this signal.");
      setIsReportModalOpen(false);
      setReportReason("");
      setReportDetails("");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to submit report. Please try again.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  useLivepeerAutoPoll();

  useEffect(() => {
    setChannel(null);
    setNotFound(false);

    let cancelled = false;
    let unsub = null;
    const cleanUsername = (username || "").toLowerCase().trim();

    const loadChannel = async () => {
      try {
        const { data } = await api.get(`/channels/${cleanUsername}`, {
          params: {
            uid: user?.uid || "",
            username: user?.username || ""
          }
        });

        if (cancelled) return;

        if (!data) {
          setNotFound(true);
          return;
        }

        setChannel(data);

        // Real-time listener for live status and viewer changes
        const targetDocId = data.channel_id || data.id || cleanUsername;
        if (targetDocId) {
          unsub = onSnapshot(
            doc(db, "channels", targetDocId),
            (docSnap) => {
              if (cancelled) return;
              if (docSnap.exists()) {
                const fsData = docSnap.data();
                if (fsData) {
                  setChannel((prev) => {
                    if (!prev) return prev;
                    
                    const updated = {
                      ...prev,
                      ...fsData,
                      playback_id: fsData.playback_id || fsData.playbackId || prev.playback_id,
                      is_live: fsData.is_live !== undefined ? fsData.is_live : (fsData.isLive !== undefined ? fsData.isLive : prev.is_live),
                      isLive: fsData.is_live !== undefined ? fsData.is_live : (fsData.isLive !== undefined ? fsData.isLive : prev.isLive),
                    };
                    
                    const fsSchedule = fsData.schedule || (fsData.schedule_json ? JSON.parse(fsData.schedule_json) : null);
                    if (Array.isArray(fsSchedule) && fsSchedule.length > 0) {
                      updated.schedule = fsSchedule;
                    }
                    
                    return updated;
                  });
                }
              }
            },
            (err) => {
              console.warn("Firestore channel snapshot notice:", err);
            }
          );
        }
      } catch (err) {
        console.error("Failed to load channel from backend API:", err);
        if (!cancelled) {
          setNotFound(true);
        }
      }
    };

    loadChannel();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [username, user?.uid, user?.username]);

  useEffect(() => {
    let cancelled = false;
    const beat = async () => {
      try {
        const { data } = await api.post(`/channels/${username}/view`);
        if (!cancelled && data && typeof data.viewer_count === "number") {
          setChannel((prev) =>
            prev ? { ...prev, viewer_count: data.viewer_count } : prev
          );
        }
      } catch {}
    };
    beat();
    const t = setInterval(beat, 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [username]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <div className="font-display text-6xl font-black tracking-tighter text-zinc-700">404</div>
        <div className="mt-2 font-mono text-sm uppercase tracking-widest text-zinc-500">
          NO SUCH FREQUENCY
        </div>
        <Link to="/" className="btn-primary mt-8 inline-flex">
          BACK TO GRID
        </Link>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="mx-auto max-w-[1440px] px-6 py-8">
        <div className="aspect-video animate-pulse bg-[#111]" />
      </div>
    );
  }

  const ownChannel = user?.username === channel.username;
  const isLive = Boolean(channel.is_live || channel.isLive);

  const channelTitle = isLive
    ? `🔴 LIVE: ${channel.stream_title || "Underground Radio"} - SPARKZ.TV`
    : `@${channel.username || username}'s Broadcast Station - SPARKZ.TV`;

  const channelDesc = channel.bio || `Tune into high-fidelity live sets from @${channel.username} on SPARKZ.TV.`;
  
  const avatarUrl = channel.photo_url || 
                    channel.photoUrl || 
                    channel.avatar_url || 
                    channel.avatar || 
                    channel.profile_image || 
                    channel.broadcaster_avatar || 
                    channel.user?.avatar_url || 
                    channel.user?.photo_url || 
                    channel.user?.photoUrl || 
                    channel.user?.avatar ||
                    channel.user?.profile_image ||
                    channel.user?.broadcaster_avatar;

  const resolvedAvatar = avatarUrl ? fileUrl(avatarUrl) : null;

  // Render Metadata Bar Component
  const renderMetadataBar = (borderless = false) => (
    <div className={`bg-[#0e0e10] py-4 px-4 relative ${borderless ? "" : "border border-[#27272a] shadow-[0_4px_20px_rgba(0,0,0,0.4)]"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Column: Avatar + Profile details */}
        <div className="flex items-center gap-4 min-w-0 lg:flex-1">
          <div className="relative h-12 w-12 md:h-14 md:w-14 flex-shrink-0 flex items-center justify-center">
            {/* Spinning border container */}
            <div className="absolute inset-0 rounded-full overflow-hidden bg-zinc-900">
              {isLive && (
                <div 
                  className="absolute inset-[-50%] animate-[spin_2s_linear_infinite]"
                  style={{
                    background: "conic-gradient(from 0deg, transparent 50%, #ff0000 80%, #ff5c5c 95%, #ff0000 100%)"
                  }}
                />
              )}
            </div>
            
            {/* Inner image container */}
            <div className="absolute inset-[2px] rounded-full overflow-hidden bg-[#141416] flex items-center justify-center z-10">
              <img 
                src={resolvedAvatar || DEFAULT_AVATAR} 
                alt={channel.username} 
                className="h-full w-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Live/Offline status indicator on avatar bottom-center */}
            {isLive ? (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 z-20 bg-red-600 text-[8px] font-black tracking-widest text-white px-1.5 py-0.5 border border-red-500 rounded-sm scale-90 whitespace-nowrap shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                LIVE
              </span>
            ) : (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 z-20 bg-zinc-800 text-[8px] font-black tracking-widest text-zinc-400 px-1.5 py-0.5 border border-zinc-700 rounded-sm scale-90 whitespace-nowrap shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                OFF
              </span>
            )}
          </div>

          {/* Text Area */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="font-display text-base font-black tracking-tight text-white hover:text-[#e5ff00] transition-colors flex items-center gap-1.5">
                <span>@{channel.username || username}</span>
                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-[#9146ff] text-white" title="Verified Sparkz Partner">
                  <Check className="h-2.5 w-2.5 stroke-[4]" />
                </span>
                {(() => {
                  const isCreator = (channel.username || "").toLowerCase() === "djsparkz";
                  const viewCount = Number(channel.views || 0);
                  const meetsViewsThreshold = viewCount >= 3000;
                  
                  if (isCreator) {
                    return (
                      <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-[#e5ff00] text-black" title="Platform Creator & Founder">
                        <Shield className="h-3 w-3 fill-black stroke-[2]" />
                      </span>
                    );
                  } else if (meetsViewsThreshold) {
                    return (
                      <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-zinc-800 text-[#e5ff00] border border-zinc-700" title={`Elite Broadcaster (${viewCount.toLocaleString()} Views)`}>
                        <Shield className="h-2.5 w-2.5 fill-[#e5ff00] stroke-[2]" />
                      </span>
                    );
                  }
                  return null;
                })()}
              </h1>
              
              {isLive && (
                <div className="flex items-center gap-2">
                  <span className="live-badge !py-0.5 !px-1.5 text-[8px] font-bold uppercase tracking-wider bg-[#e5ff00]/10 text-[#e5ff00] border border-[#e5ff00]/20 flex items-center h-5">
                    <span className="dot live-dot bg-[#e5ff00]" /> LIVE
                  </span>
                  
                  {/* Inline live viewer count and uptime directly next to badge */}
                  <div className="hidden lg:flex items-center gap-2 font-mono text-[10px] font-bold text-zinc-400 bg-zinc-900/80 px-2 py-0.5 border border-zinc-800/80 rounded h-5" data-testid="live-viewer-uptime">
                    <div className="flex items-center gap-1 text-[#ff5c5c]">
                      <User className="h-3.5 w-3.5" />
                      <span>{channel.viewer_count || 0}</span>
                    </div>
                    <span className="text-zinc-600">|</span>
                    <div className="text-zinc-300">
                      {channel.stream_started_at ? (
                        <LiveDuration startedAt={channel.stream_started_at} />
                      ) : (
                        "00:00:00"
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stream Title / Custom description */}
            <h2 className="font-sans text-xs md:text-sm font-semibold leading-snug text-zinc-200 mb-1">
              {channel.stream_title || "Welcome to my underground broadcast"}
            </h2>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-zinc-500">
              {channel.category && (
                <Link to="/browse" className="text-[#bf94ff] hover:underline font-bold uppercase tracking-wider">
                  {channel.category}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Buttons (Follow, Manage Sub, Gift Sub, buy bits) */}
        <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end lg:flex-1">
          <FollowButton
            username={channel.username}
            isFollowing={channel.is_following}
            followerCount={channel.follower_count}
            ownChannel={ownChannel}
            onChange={(res) =>
              setChannel((prev) => ({
                ...prev,
                is_following: res.following,
                follower_count: res.follower_count,
              }))
            }
          />

          <button
            onClick={() => setIsManageSubOpen(true)}
            className="flex items-center gap-1.5 border border-[#bf94ff] bg-[#bf94ff]/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#bf94ff] hover:bg-[#bf94ff] hover:text-black transition-all"
            title="Subscribe or Manage Channel Perks"
          >
            <Crown className="h-3.5 w-3.5" />
            <span>{channel?.is_subscribed ? "SUBSCRIBED" : "SUBSCRIBE"}</span>
          </button>

          <button
            onClick={() => setIsGiftModalOpen(true)}
            className="flex items-center gap-1.5 border border-zinc-700 bg-black px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:border-[#bf94ff] hover:text-[#bf94ff] transition-all"
            title="Gift a Sub to another viewer"
          >
            <Gift className="h-3.5 w-3.5" />
            <span>GIFT SUB</span>
          </button>

          <Link
            to="/payouts?buy=true"
            data-testid="channel-buy-bits-btn"
            className="flex items-center gap-1.5 border border-[#27272a] bg-black px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#e5ff00] hover:border-[#e5ff00] hover:bg-zinc-900 transition-all"
            title="Purchase Vinyl Bits to Support DJ"
          >
            <Coins className="h-3.5 w-3.5 text-[#e5ff00] animate-pulse" />
            <span>BUY BITS</span>
          </Link>

          <button
            onClick={() => setIsReportModalOpen(true)}
            className="btn-ghost inline-flex items-center gap-1.5 text-zinc-400 hover:text-red-400 hover:border-red-400/30 transition-colors !py-1.5 !px-2.5 border border-zinc-800"
            title="Report this broadcast"
          >
            <Flag className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] uppercase tracking-wider">REPORT</span>
          </button>
        </div>
      </div>

      {/* BOTTOM MUSIC GENRE TAG CONTAINER */}
      {channel.tags && channel.tags.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#27272a]/30 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">// GENRE TARGETS:</div>
          <div className="flex flex-wrap gap-1">
            {channel.tags.map((tag, idx) => (
              <Link
                key={idx}
                to={`/browse?search=${encodeURIComponent(tag)}`}
                className="inline-flex items-center px-2 py-0.5 bg-zinc-900 hover:bg-[#e5ff00] border border-zinc-800 hover:border-[#e5ff00] text-[10px] font-mono text-zinc-400 hover:text-black transition-all rounded-sm"
              >
                #{tag.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* BIO & SOCIAL LINKS ROW */}
      {(channel.bio || (channel.socials && Object.values(channel.socials).some(Boolean))) && (
        <div className="mt-4 pt-3 border-t border-[#27272a]/30 flex flex-col md:flex-row md:items-start justify-between gap-4">
          {/* Bio block */}
          {channel.bio && (
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">// BIO</div>
              <p className="font-mono text-xs text-zinc-300 leading-relaxed max-w-3xl whitespace-pre-wrap">
                {channel.bio}
              </p>
            </div>
          )}

          {/* Social Links block */}
          {channel.socials && Object.values(channel.socials).some(Boolean) && (
            <div className="flex flex-col gap-1 min-w-[200px] md:items-end">
              <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 md:text-right">// LINKS</div>
              <div className="flex flex-wrap gap-2 items-center justify-start md:justify-end font-mono text-[10px]">
                {channel.socials.soundcloud && (
                  <a
                    href={channel.socials.soundcloud.startsWith("http") ? channel.socials.soundcloud : `https://${channel.socials.soundcloud}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="SoundCloud"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18181d] border border-zinc-800/80 text-zinc-400 hover:text-[#ff5500] hover:border-[#ff5500]/40 transition-all uppercase"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>SOUNDCLOUD</span>
                  </a>
                )}
                {channel.socials.mixcloud && (
                  <a
                    href={channel.socials.mixcloud.startsWith("http") ? channel.socials.mixcloud : `https://${channel.socials.mixcloud}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Mixcloud"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18181d] border border-zinc-800/80 text-zinc-400 hover:text-[#00e6ff] hover:border-[#00e6ff]/40 transition-all uppercase"
                  >
                    <Disc3 className="h-3.5 w-3.5" />
                    <span>MIXCLOUD</span>
                  </a>
                )}
                {channel.socials.instagram && (
                  <a
                    href={channel.socials.instagram.startsWith("http") ? channel.socials.instagram : `https://${channel.socials.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Instagram"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18181d] border border-zinc-800/80 text-zinc-400 hover:text-[#e1306c] hover:border-[#e1306c]/40 transition-all uppercase"
                  >
                    <Instagram className="h-3.5 w-3.5" />
                    <span>INSTAGRAM</span>
                  </a>
                )}
                {channel.socials.spotify && (
                  <a
                    href={channel.socials.spotify.startsWith("http") ? channel.socials.spotify : `https://${channel.socials.spotify}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Spotify"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18181d] border border-zinc-800/80 text-zinc-400 hover:text-[#1db954] hover:border-[#1db954]/40 transition-all uppercase"
                  >
                    <Music className="h-3.5 w-3.5" />
                    <span>SPOTIFY</span>
                  </a>
                )}
                {channel.socials.youtube && (
                  <a
                    href={channel.socials.youtube.startsWith("http") ? channel.socials.youtube : `https://${channel.socials.youtube}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="YouTube"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18181d] border border-zinc-800/80 text-zinc-400 hover:text-[#ff0000] hover:border-[#ff0000]/40 transition-all uppercase"
                  >
                    <Youtube className="h-3.5 w-3.5" />
                    <span>YOUTUBE</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const streamInfoCard = (
    <div className="border border-[#27272a] bg-[#0e0e10] p-4 md:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
      <div className="label-caps">// STREAM INFO</div>
      <dl className="mt-4 space-y-3 font-mono text-xs">
        <Row label="STATUS">{isLive ? "LIVE" : "OFF AIR"}</Row>
        <Row label="CATEGORY">{channel.category}</Row>
        <Row label="VIEWERS">
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-[#e5ff00]" />
            <span>{channel.viewer_count || 0}</span>
          </span>
        </Row>
        <Row label="PLAYBACK ID" mono>
          {channel.playback_id}
        </Row>
      </dl>
    </div>
  );

  const qrCodeCard = (
    <div className="border border-[#27272a] bg-[#0e0e10] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.4)] h-full flex flex-col justify-between" data-testid="channel-qr-card">
      <div className="flex items-center gap-2">
        <QrCode className="h-4 w-4 text-[#e5ff00]" />
        <div className="label-caps mb-0">// CHANNEL QR CODE</div>
      </div>

      <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-zinc-400">
        Scan or share to tune into <code className="text-[#e5ff00]">@{channel.username}</code>.
      </p>

      <div className="mt-3 flex flex-col items-center justify-center border border-dashed border-[#27272a] bg-black p-3">
        <div className="rounded bg-white p-1.5 shadow-lg">
          <QRCodeSVG
            value={`${window.location.origin}/channel/${channel.username}`}
            size={95}
            bgColor="#ffffff"
            fgColor="#000000"
            level="M"
          />
        </div>
        <span className="mt-2 font-mono text-[9px] text-zinc-500 uppercase tracking-widest truncate max-w-[180px]">
          {channel.username}
        </span>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full bg-black text-white relative flex flex-col overflow-hidden" data-testid={`channel-page-${username}`}>
      <SEO
        title={channelTitle}
        description={channelDesc}
        image={resolvedAvatar || DEFAULT_AVATAR}
        isLive={isLive}
        category={channel?.category}
        type="profile"
      />

      {/* DESKTOP VIEW: Side-by-Side Split View (Video + Profile details scroll on the left, Chat stays locked on the right) */}
      <div className="hidden lg:flex w-full h-full overflow-hidden items-stretch">
        {/* Left Column (Main Scrollable Content Area) */}
        <div className="flex-1 h-full overflow-y-auto no-scrollbar flex flex-col">
          
          {/* Unified Player + Metadata Panel: Sits completely flush directly underneath with zero gaps, spanning 100% width */}
          <div className="w-full bg-[#0e0e10] border-b border-[#1f1f23] flex flex-col shrink-0">
            {/* Video Player */}
            <div className="w-full bg-black flex justify-center items-center h-[calc(100vh-175px)] min-h-[300px] relative">
              <div className="h-full max-w-full aspect-video">
                <HlsPlayer
                  playbackId={channel.playback_id}
                  isLive={isLive}
                  viewerCount={channel.viewer_count || 0}
                  isSubscriber={channel?.is_subscribed}
                  isPro={user?.is_pro}
                  username={channel?.username}
                  borderless={true}
                />
              </div>
            </div>

            {/* Bottom Avatar & Stream Info Container (separated by a border, zero margins/paddings between blocks, edge-to-edge) */}
            <div className="border-t border-[#1f1f23] w-full">
              {renderMetadataBar(true)}
            </div>
          </div>

          {/* Under-player details block (beautifully padded for readability, centered) */}
          <div className="w-full max-w-5xl xl:max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6 pb-12">
            {/* Split row for schedules, past sessions, and cards */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
              {/* Main content subcolumn */}
              <div className="xl:col-span-2 space-y-6">
                <ScheduleDisplay
                  schedule={channel.schedule}
                  username={channel.username}
                  isOwner={ownChannel}
                  onScheduleUpdated={(updatedSchedules) => {
                    setChannel((prev) => ({
                      ...prev,
                      schedule: updatedSchedules,
                    }));
                  }}
                />
                <SessionList username={channel.username} />
              </div>

              {/* Side cards subcolumn */}
              <aside className="space-y-6">
                {streamInfoCard}
                {qrCodeCard}
              </aside>
            </div>
          </div>
        </div>

        {/* Right Column (Locked Sidebar Chat Panel - Matches exact height, doesn't scroll with content) */}
        {!isChatCollapsed ? (
          <aside className="w-[320px] xl:w-[360px] h-full flex flex-col border-l border-[#1f1f23] bg-[#0e0e10] shrink-0">
            <ChatPanel username={channel.username} onCollapse={toggleChatCollapse} />
          </aside>
        ) : (
          <button
            onClick={toggleChatCollapse}
            className="flex flex-col items-center justify-start py-6 w-10 shrink-0 bg-[#0e0e10] border-l border-[#1f1f23] text-zinc-400 hover:text-[#e5ff00] hover:border-[#e5ff00]/40 transition-all gap-6 cursor-pointer select-none"
            title="Expand Chat"
          >
            <ChevronLeft className="h-5 w-5 text-[#e5ff00] animate-pulse" />
            <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-zinc-500 [writing-mode:vertical-lr] rotate-180 py-4">
              EXPAND CHAT
            </span>
          </button>
        )}
      </div>

      {/* MOBILE VIEW: Snap-Scrolling Dual-Fold View (Stacking Video & Mobile Chat with native feel) */}
      <div className="lg:hidden w-full h-full overflow-y-auto no-scrollbar snap-y snap-mandatory scroll-smooth bg-black">
        {/* Fold 1: Video Player & Chat Interface (Fits exactly 100% height) */}
        <section className="snap-start h-full w-full flex flex-col overflow-hidden relative">
          {/* Top Sticky Video Player */}
          <div className="w-full bg-black shrink-0">
            <HlsPlayer
              playbackId={channel.playback_id}
              isLive={isLive}
              viewerCount={channel.viewer_count || 0}
              isSubscriber={channel?.is_subscribed}
              isPro={user?.is_pro}
              username={channel?.username}
              borderless={true}
            />
          </div>

          {/* Interactive Chat Panel (Takes up remaining viewport height) */}
          <div className="flex-1 min-h-0 bg-[#0e0e10] border-t border-[#1f1f23] flex flex-col relative z-10">
            <ChatPanel username={channel.username} />
          </div>

          {/* Simple overlay suggestion prompt to swipe */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1 bg-black/75 px-3 py-1 border border-zinc-800/80 rounded shadow-md">
            <ChevronDown className="h-3.5 w-3.5 text-[#e5ff00] animate-bounce" />
            <span className="font-mono text-[8px] font-black uppercase tracking-widest text-zinc-400">
              SWIPE DOWN FOR INFO
            </span>
          </div>
        </section>

        {/* Fold 2: Broadcaster Biography, Schedules, and Past Sessions */}
        <section className="snap-start min-h-full w-full overflow-y-auto no-scrollbar p-4 space-y-6 bg-black pb-24 relative">
          <div className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2 border-b border-zinc-800 pb-2">
            <span>// BROADCASTER BIO & SCHEDULES</span>
          </div>

          {/* Metadata bar */}
          {renderMetadataBar()}

          {/* Stream info & QR code */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {streamInfoCard}
            <div>{qrCodeCard}</div>
          </div>

          {/* Schedule display */}
          <ScheduleDisplay
            schedule={channel.schedule}
            username={channel.username}
            isOwner={ownChannel}
            onScheduleUpdated={(updatedSchedules) => {
              setChannel((prev) => ({
                ...prev,
                schedule: updatedSchedules,
              }));
            }}
          />

          {/* Session list */}
          <SessionList username={channel.username} />
        </section>
      </div>

      {/* REPORT MODAL */}
      {isReportModalOpen && (
        <div
          data-testid="report-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
        >
          <div className="w-full max-w-md border border-[#27272a] bg-[#0e0e10] p-6 shadow-2xl sm:p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-500">
              <Flag className="h-4 w-4 text-red-500" />
              <span>// REPORT BROADCAST</span>
            </div>
            <h2 className="mt-2 font-display text-2xl font-black uppercase text-white sm:text-3xl">
              COMMUNITY FLAG
            </h2>
            <p className="mt-2 text-xs text-zinc-400">
              Help us keep the airwaves safe. Let us know if <span className="text-[#e5ff00] font-bold">@{channel.username}</span> is in violation of our community standards.
            </p>

            {!user ? (
              <div className="mt-6 space-y-4 text-center">
                <p className="font-mono text-xs text-red-400 uppercase">
                  You must be signed in to submit a community moderation report.
                </p>
                <Link
                  to="/login"
                  className="btn-primary w-full flex items-center justify-center py-2.5 text-xs text-black font-bold font-mono tracking-wider bg-[#e5ff00] hover:bg-white transition-colors"
                >
                  SIGN IN TO CONTINUE
                </Link>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="w-full border border-zinc-700 bg-black py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                >
                  CLOSE
                </button>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="label-caps mb-1 block text-zinc-300">
                    REASON FOR REPORTING
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full text-white bg-black border border-[#27272a] p-2 rounded-none font-mono text-xs focus:border-[#e5ff00] focus:outline-none"
                    required
                  >
                    <option value="" disabled>-- Select a reason --</option>
                    <option value="harassment">Harassment / Hate Speech</option>
                    <option value="explicit">Explicit / Adult Content</option>
                    <option value="copyright">Copyright Violation</option>
                    <option value="spam">Spam / Scam / Phishing</option>
                    <option value="guidelines">General Guidelines Violation</option>
                    <option value="other">Other / Custom Details</option>
                  </select>
                </div>

                <div>
                  <label className="label-caps mb-1 block text-zinc-300">
                    ADDITIONAL DETAILS (OPTIONAL)
                  </label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    className="w-full text-white bg-black border border-[#27272a] p-2 rounded-none font-mono text-xs focus:border-[#e5ff00] focus:outline-none h-24 resize-none"
                    placeholder="Provide timestamps or specific details..."
                    maxLength={500}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsReportModalOpen(false);
                      setReportReason("");
                      setReportDetails("");
                    }}
                    className="flex-1 border border-zinc-700 bg-black py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReport}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                  >
                    {isSubmittingReport ? "SUBMITTING..." : "SUBMIT FLAG"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MANAGE SUBSCRIPTION MODAL */}
      {isManageSubOpen && (
        <div
          data-testid="manage-sub-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
        >
          <div className="w-full max-w-md border border-[#27272a] bg-[#0e0e10] p-6 shadow-2xl sm:p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-3 mb-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#bf94ff]">
                <Crown className="h-4 w-4 text-[#bf94ff]" />
                <span>// MANAGE SUBSCRIPTION</span>
              </div>
              <button 
                onClick={() => setIsManageSubOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-zinc-900/50 p-3 border border-zinc-800">
                <div className="h-10 w-10 rounded-full bg-[#bf94ff]/10 flex items-center justify-center border border-[#bf94ff]/35">
                  <Crown className="h-5 w-5 text-[#bf94ff]" />
                </div>
                <div>
                  <div className="font-mono text-[10px] text-zinc-500 uppercase">SUBSCRIBER STATUS</div>
                  <div className="font-display font-black text-sm uppercase text-white">
                    {channel?.is_subscribed ? "ACTIVE (TIER 1)" : "NOT SUBSCRIBED"}
                  </div>
                </div>
              </div>

              {channel?.is_subscribed ? (
                <div className="space-y-3 font-mono text-xs">
                  <p className="text-zinc-400 leading-relaxed">
                    You are currently subscribed to <span className="text-[#e5ff00] font-bold">@{channel.username}</span>! This unlocks ad-free streaming, user badge perks, and exclusive subscriber emotes.
                  </p>
                  <div className="bg-[#0c0c0e] border border-zinc-800 p-3 space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">RENEWAL:</span>
                      <span className="text-zinc-300">AUTO-RENEWS MONTHLY</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">TIER:</span>
                      <span className="text-zinc-300">1 (500 WATTS VALUE)</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={async () => {
                      try {
                        const { data } = await api.delete(`/channels/${channel.username}/subscribe`);
                        setChannel(prev => ({
                          ...prev,
                          is_subscribed: false,
                          subscriber_count: typeof data.subscriber_count === "number" ? data.subscriber_count : Math.max(0, (prev.subscriber_count || 0) - 1)
                        }));
                        toast.success(`Successfully unsubscribed from @${channel.username}.`);
                        setIsManageSubOpen(false);
                      } catch (err) {
                        toast.error(err.response?.data?.error || "Failed to unsubscribe.");
                      }
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-mono text-xs uppercase tracking-wider py-2.5 transition-colors font-bold"
                  >
                    CANCEL SUBSCRIPTION
                  </button>
                </div>
              ) : (
                <div className="space-y-3 font-mono text-xs">
                  <p className="text-zinc-400 leading-relaxed">
                    Support <span className="text-[#e5ff00] font-bold">@{channel.username}</span> directly! Unlock exclusive subscriber benefits, custom vinyl badges, and an ad-free stream.
                  </p>
                  
                  <button
                    onClick={async () => {
                      try {
                        const { data } = await api.post(`/channels/${channel.username}/subscribe`);
                        setChannel(prev => ({
                          ...prev,
                          is_subscribed: true,
                          subscriber_count: typeof data.subscriber_count === "number" ? data.subscriber_count : ((prev.subscriber_count || 0) + 1)
                        }));
                        toast.success(`Subscribed to @${channel.username}! Welcome to the inner circle.`);
                        setIsManageSubOpen(false);
                      } catch (err) {
                        toast.error(err.response?.data?.error || "Failed to subscribe. Please load Vinyl Bits first.");
                      }
                    }}
                    className="w-full bg-[#9146ff] hover:bg-[#772ce8] text-white font-mono text-xs uppercase tracking-wider py-2.5 transition-colors font-bold flex items-center justify-center gap-2"
                  >
                    <Crown className="h-4 w-4 fill-current text-white" />
                    <span>SUBSCRIBE FOR 500 WATTS</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GIFT A SUBSCRIPTION MODAL */}
      {isGiftModalOpen && (
        <div
          data-testid="gift-sub-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
        >
          <div className="w-full max-w-md border border-[#27272a] bg-[#0e0e10] p-6 shadow-2xl sm:p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-3 mb-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#bf94ff]">
                <Gift className="h-4 w-4 text-purple-400" />
                <span>// GIFT A SUBSCRIPTION</span>
              </div>
              <button 
                onClick={() => {
                  setIsGiftModalOpen(false);
                  setGiftSuccess(false);
                  setGiftRecipient("");
                }}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {giftSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/30 text-green-400">
                  <Sparkles className="h-8 w-8 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-display font-black text-xl text-white uppercase tracking-tight">GIFT SENT SUCCESS!</h3>
                  <p className="font-mono text-xs text-zinc-400 mt-2">
                    Successfully gifted a Tier 1 subscription to <span className="text-[#e5ff00] font-bold">@{giftRecipient}</span>! They have been notified on the stream.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsGiftModalOpen(false);
                    setGiftSuccess(false);
                    setGiftRecipient("");
                  }}
                  className="w-full bg-[#18181b] border border-zinc-700 text-white font-mono text-xs uppercase tracking-wider py-2.5 hover:bg-zinc-800 transition-colors"
                >
                  RETURN TO STREAM
                </button>
              </div>
            ) : (
              <div className="space-y-4 font-mono text-xs">
                <p className="text-zinc-400 leading-relaxed">
                  Gift a subscription to another active listener in the community to share the love and support <span className="text-[#e5ff00] font-bold">@{channel.username}</span>.
                </p>

                <div>
                  <label className="label-caps mb-1.5 block text-zinc-400">SELECT FROM ACTIVE VIEWERS</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["djsparkz", "kevo24_7", "spacetaco", "Lurxx", "Sery_Bot"].map((viewer) => (
                      <button
                        key={viewer}
                        type="button"
                        onClick={() => setGiftRecipient(viewer)}
                        className={`flex items-center gap-2 p-2.5 border text-left rounded-sm transition-all ${
                          giftRecipient === viewer 
                            ? "border-[#e5ff00] bg-[#e5ff00]/10 text-white font-bold" 
                            : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700"
                        }`}
                      >
                        <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center font-mono text-[9px] font-bold text-white uppercase">
                          {viewer[0]}
                        </div>
                        <span className="truncate">@{viewer}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label-caps mb-1.5 block text-zinc-400">OR ENTER RECIPIENT HANDLE</label>
                  <input
                    type="text"
                    value={giftRecipient}
                    onChange={(e) => setGiftRecipient(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    className="w-full bg-black border border-zinc-800 text-white p-2.5 text-xs rounded-none focus:border-[#e5ff00] focus:outline-none"
                    placeholder="e.g. soundseeker"
                  />
                </div>

                <div className="bg-[#0c0c0e] border border-zinc-800 p-3 space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">COST:</span>
                    <span className="text-[#e5ff00] font-bold">500 WATTS</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">BENEFITS:</span>
                    <span className="text-zinc-300">1 MONTH TIER 1 SUB</span>
                  </div>
                </div>

                {!user ? (
                  <div className="rounded-none border border-red-500/30 bg-red-500/10 p-3 text-red-200">
                    Please log in to gift a subscription.
                  </div>
                ) : (user.watts || 0) < 20000 ? (
                  <div className="rounded-none border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200 space-y-1">
                    <p className="font-bold">// ELIGIBILITY REQUIREMENT</p>
                    <p>To gift a subscription, you must have at least <span className="text-[#e5ff00] font-bold">20,000 Watts</span>. Your current balance is <span className="text-white font-bold">{(user.watts || 0).toLocaleString()} Watts</span>.</p>
                  </div>
                ) : null}

                <button
                  type="button"
                  disabled={!user || (user.watts || 0) < 20000 || !giftRecipient || giftingInProgress}
                  onClick={async () => {
                    setGiftingInProgress(true);
                    setTimeout(() => {
                      setGiftingInProgress(false);
                      setGiftSuccess(true);
                      setChannel(prev => ({
                        ...prev,
                        subscriber_count: (prev.subscriber_count || 0) + 1
                      }));
                      toast.success(`Successfully gifted Tier 1 subscription to @${giftRecipient}!`);
                    }, 1200);
                  }}
                  className="w-full bg-[#9146ff] hover:bg-[#772ce8] text-white font-mono text-xs uppercase tracking-wider py-3 transition-colors font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {giftingInProgress ? "PROCESSING TRANSACTION..." : "GIFT TIER 1 SUBSCRIPTION"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children, mono }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#27272a] pb-2 last:border-0 last:pb-0">
      <span className="text-zinc-500">{label}</span>
      <span className={`text-right ${mono ? "break-all font-mono text-[10px]" : "font-bold uppercase"}`}>
        {children}
      </span>
    </div>
  );
}
