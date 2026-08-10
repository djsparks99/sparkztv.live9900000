import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, fileUrl } from "@/lib/api";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot, collection, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import HlsPlayer from "@/components/HlsPlayer";
import ChatPanel from "@/components/ChatPanel";
import FollowButton from "@/components/FollowButton";
import SubscribeButton from "@/components/SubscribeButton";
import ShareButton from "@/components/ShareButton";
import SessionList from "@/components/SessionList";
import ScheduleDisplay from "@/components/ScheduleDisplay";
import LiveDuration from "@/components/LiveDuration";
import UserLocationTime from "@/components/UserLocationTime";
import SEO from "@/components/SEO";
import { useAuth } from "@/lib/auth-context";
import { Eye, ArrowLeft, User, Clock, QrCode, Coins, Flag, Check, Gift, Crown, ChevronLeft, ChevronRight, ChevronDown, Radio, Sparkles, X } from "lucide-react";
import { useLivepeerAutoPoll } from "@/hooks/useLivepeerAutoPoll";
import { QRCodeSVG } from "qrcode.react";

const OperationType = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  LIST: "list",
  GET: "get",
  WRITE: "write",
};

function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

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
    const pathForWrite = "moderation_reports";
    try {
      const reportRef = doc(collection(db, pathForWrite));
      const reportId = reportRef.id;

      const reportData = {
        id: reportId,
        reporter_uid: user.uid,
        reporter_username: user.username || "anonymous",
        reported_stream_id: channel.playback_id || "unknown",
        reported_username: channel.username,
        reason: reportReason,
        details: reportDetails.trim(),
        status: "pending",
        created_at: new Date().toISOString()
      };

      await setDoc(reportRef, reportData);
      toast.success("Flag submitted successfully.", {
        description: "Our moderation team has been notified."
      });
      setIsReportModalOpen(false);
      setReportReason("");
      setReportDetails("");
    } catch (error) {
      toast.error("Failed to submit report. Please try again.");
      handleFirestoreError(error, OperationType.WRITE, pathForWrite);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  useLivepeerAutoPoll(username);

  const isLive = Boolean(channel?.is_live || channel?.isLive);

  const channelImage = channel?.photo_url
    ? fileUrl(channel.photo_url)
    : channel?.banner_url
    ? fileUrl(channel.banner_url)
    : "/og-image.jpg";

  const channelTitle = channel
    ? `${channel.display_name || channel.username} (@${channel.username})`
    : `Broadcaster ${username}`;

  const channelDesc = channel
    ? channel.stream_title || channel.bio || `Watch ${channel.display_name || channel.username} live on Sparkz.TV`
    : `Watch underground live streams on Sparkz.TV`;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [username]);

  useEffect(() => {
    setNotFound(false);
    let cancelled = false;

    const load = async () => {
      if (!username || username === "undefined" || username === "null") {
        return;
      }
      try {
        const { data } = await api.get(`/channels/${username}`, {
          params: {
            uid: user?.uid || "",
            username: user?.username || ""
          },
          headers: {
            "x-user-uid": user?.uid || "",
            "x-username": user?.username || ""
          }
        });
        if (!cancelled && data) {
          let scheduleArray = [];
          if (Array.isArray(data.schedules)) {
            scheduleArray = data.schedules;
          } else if (Array.isArray(data.schedule)) {
            scheduleArray = data.schedule;
          } else if (data.schedule_json) {
            try {
              scheduleArray = JSON.parse(data.schedule_json);
            } catch (e) {}
          } else if (data.schedule) {
            scheduleArray = [data.schedule];
          }

          setChannel((prev) => ({
            ...data,
            schedule: scheduleArray.length > 0 ? scheduleArray : (prev?.schedule || []),
            photo_url: data.photo_url || prev?.photo_url || null,
          }));
        }
      } catch {
        if (!cancelled) setNotFound(true);
      }
    };
    load();

    const targetDocId = username ? username.toLowerCase() : "";
    const unsub = onSnapshot(
      doc(db, "channels", targetDocId),
      (docSnap) => {
        if (docSnap.exists() && !cancelled) {
          const fsData = docSnap.data();
          let fsSchedule = fsData.schedule;
          if (!Array.isArray(fsSchedule) && fsData.schedule_json) {
            try {
              fsSchedule = JSON.parse(fsData.schedule_json);
            } catch (e) {}
          }
          setChannel((prev) => {
            if (!prev) {
              return {
                ...fsData,
                schedule: Array.isArray(fsSchedule) ? fsSchedule : [],
              };
            }

            const merged = { ...prev };
            
            for (const key of Object.keys(fsData)) {
              if (fsData[key] !== null && fsData[key] !== undefined) {
                merged[key] = fsData[key];
              }
            }

            if (!merged.photo_url && prev.photo_url) {
              merged.photo_url = prev.photo_url;
            }

            const finalSchedule = (Array.isArray(fsSchedule) && fsSchedule.length > 0)
              ? fsSchedule
              : (prev.schedule || []);
            
            merged.schedule = finalSchedule;
            return merged;
          });
        }
      },
      (err) => {
        console.warn("Firestore channel snapshot notice:", err);
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [username, user?.uid]);

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

  return (
    <div className="mx-auto max-w-full px-4 lg:px-8 pt-6 pb-24 sm:pb-28 lg:pb-32" data-testid={`channel-page-${username}`}>
      <SEO
        title={channelTitle}
        description={channelDesc}
        image={channelImage}
        isLive={isLive}
        category={channel?.category}
        type="profile"
      />


      {/* Row 1: Player & Chat Panel */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch mb-6">
        {/* Left Column: Player only */}
        <div className="flex-1 min-w-0">
          <HlsPlayer playbackId={channel.playback_id} isLive={isLive} />
        </div>

        {/* Right Column: Desktop Collapsible Chat (Matches player height perfectly) */}
        {!isChatCollapsed ? (
          <aside className="hidden lg:flex w-[320px] xl:w-[360px] flex-col shrink-0 transition-all duration-300">
            <ChatPanel username={channel.username} onCollapse={toggleChatCollapse} />
          </aside>
        ) : (
          <button
            onClick={toggleChatCollapse}
            className="hidden lg:flex flex-col items-center justify-start py-4 w-10 shrink-0 bg-[#0e0e10] border border-[#27272a] text-zinc-400 hover:text-[#e5ff00] hover:border-[#e5ff00]/40 transition-all gap-6 cursor-pointer select-none"
            title="Expand Chat"
          >
            <ChevronLeft className="h-5 w-5 text-[#e5ff00] animate-pulse" />
            <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-zinc-500 [writing-mode:vertical-lr] rotate-180 py-4">
              EXPAND CHAT
            </span>
          </button>
        )}
      </div>

      {/* Row 2: Metadata Bar & Mobile Chat */}
      <div className="flex flex-col lg:flex-row gap-6 mb-6">
        {/* Left Column: Metadata Bar (Aligned with player) */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* CHANNEL METADATA BAR - Directly under the player/chat row */}
        {(() => {
          const avatarUrl = channel?.photo_url || 
                            channel?.photoUrl || 
                            channel?.avatar_url || 
                            channel?.avatar || 
                            channel?.profile_image || 
                            channel?.broadcaster_avatar || 
                            channel?.user?.avatar_url || 
                            channel?.user?.photo_url || 
                            channel?.user?.photoUrl || 
                            channel?.user?.avatar ||
                            channel?.user?.profile_image ||
                            channel?.user?.broadcaster_avatar;

          const resolvedAvatar = avatarUrl ? fileUrl(avatarUrl) : null;

          const initials = (() => {
            const name = channel?.display_name || channel?.username || username || "?";
            const cleanName = typeof name === "string" ? name.trim() : "?";
            const parts = cleanName.split(/\s+/);
            if (parts.length >= 2 && parts[0] && parts[1]) {
              return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
            }
            return cleanName.slice(0, 2).toUpperCase();
          })();

          return (
            <div className="border border-[#27272a] bg-[#0e0e10] py-2 px-3 md:py-2.5 md:px-4 shadow-[0_4px_20px_rgba(0,0,0,0.4)] relative">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                {/* Left Column: Avatar + Profile details */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Spherically-bounded avatar container */}
                  <div className="h-10 w-10 md:h-12 md:w-12 rounded-full border border-[#e5ff00]/20 flex-shrink-0 overflow-hidden relative bg-[#141416] flex items-center justify-center">
                    {resolvedAvatar ? (
                      <img 
                        src={resolvedAvatar} 
                        alt={channel.username} 
                        className="h-full w-full object-cover rounded-full"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#1e1e22] text-[#e4e4e7] rounded-full font-mono text-xs font-black select-none uppercase">
                        {initials}
                      </div>
                    )}
                    {/* Live/Offline status indicator on avatar */}
                    {isLive && (
                      <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-[#e5ff00] border border-[#0e0e10]" />
                    )}
                  </div>

                  {/* Text Area */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h1 className="font-display text-sm font-black tracking-tight text-white hover:text-[#e5ff00] transition-colors flex items-center gap-1">
                        <span>@{channel.username || username}</span>
                        <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-[#9146ff] text-white" title="Verified Sparkz Partner">
                          <Check className="h-2 w-2 stroke-[4]" />
                        </span>
                      </h1>
                      
                      {isLive ? (
                        <div className="flex items-center gap-2">
                          <span className="live-badge !py-0 !px-1 text-[8px] font-bold uppercase tracking-wider bg-[#e5ff00]/10 text-[#e5ff00] border border-[#e5ff00]/20 flex items-center h-4">
                            <span className="dot live-dot bg-[#e5ff00]" /> LIVE
                          </span>
                          
                          {/* Inline live viewer count and uptime directly next to badge */}
                          <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-zinc-400 bg-zinc-900/80 px-1.5 py-0.5 border border-zinc-800/80 rounded h-4" data-testid="live-viewer-uptime">
                            <div className="flex items-center gap-0.5 text-[#ff5c5c]">
                              <User className="h-3 w-3" />
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
                      ) : (
                        <span className="chip !py-0 !px-1 text-[8px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border-zinc-700 flex items-center h-4">
                          OFFLINE
                        </span>
                      )}
                    </div>

                    {/* Stream Title / Custom description */}
                    <h2 className="font-sans text-xs font-semibold leading-snug text-zinc-200 mb-0.5">
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
                <div className="flex flex-wrap items-center gap-1.5 justify-start lg:justify-end">
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

                  <Link
                    to="/payouts?buy=true"
                    data-testid="channel-buy-bits-btn"
                    className="flex items-center gap-1 border border-[#e5ff00]/60 bg-[#e5ff00]/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#e5ff00] hover:border-[#e5ff00] hover:bg-[#e5ff00]/25 transition-all"
                    title="Purchase Vinyl Bits to Support DJ"
                  >
                    <Coins className="h-3.5 w-3.5 text-[#e5ff00] animate-pulse" />
                    <span>BUY BITS</span>
                  </Link>

                  <ShareButton
                    username={channel.username}
                    streamTitle={channel.stream_title}
                  />
                  
                  <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="btn-ghost inline-flex items-center gap-1 text-zinc-400 hover:text-red-400 hover:border-red-400/30 transition-colors !py-1 !px-2"
                    title="Report this broadcast"
                  >
                    <Flag className="h-3 w-3" />
                    <span className="font-mono text-[10px] uppercase tracking-wider">REPORT</span>
                  </button>
                </div>
              </div>

              {/* BOTTOM MUSIC GENRE TAG CONTAINER - Under the player metadata, display their own genre music tags */}
              {channel.tags && channel.tags.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-[#27272a]/30 flex flex-wrap items-center gap-x-2.5 gap-y-1">
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
            </div>
          );
        })()}

        {/* MOBILE CHAT PLACEMENT: Sits directly under the video player metadata on mobile views */}
        <div className="block lg:hidden w-full border border-[#27272a] bg-[#0e0e10]">
          <div className="h-[400px] sm:h-[485px]">
            <ChatPanel username={channel.username} />
          </div>
        </div>
        </div>

        {/* Right Column: QR Code Card under the chat (matches its width/styling and is uniform) */}
        {!isChatCollapsed ? (
          <div className="hidden lg:block w-[320px] xl:w-[360px] shrink-0">
            {/* Channel QR Code Card */}
            <div className="border border-[#27272a] bg-[#0e0e10] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.4)] h-full flex flex-col justify-between" data-testid="channel-qr-card">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-[#e5ff00]" />
                <div className="label-caps mb-0">// CHANNEL QR CODE</div>
              </div>

              <p className="mt-1 font-mono text-[10px] leading-relaxed text-zinc-400">
                Scan or share to tune into <code className="text-[#e5ff00]">@{channel.username}</code>.
              </p>

              <div className="mt-2.5 flex flex-col items-center justify-center border border-dashed border-[#27272a] bg-black p-2">
                <div className="rounded bg-white p-1.5 shadow-lg">
                  <QRCodeSVG
                    value={`${window.location.origin}/channel/${channel.username}`}
                    size={90}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                  />
                </div>
                <span className="mt-1.5 font-mono text-[9px] text-zinc-500 uppercase tracking-widest truncate max-w-[180px]">
                  {channel.username}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:block w-10 shrink-0" />
        )}
      </div>

      {/* Row 3: Secondary Metadata (Schedule & Previous Sessions) & Right Column Cards */}
      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        {/* Left Column (Aligns perfectly with Player and Metadata Bar) */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {/* Schedule */}
          <div>
            <ScheduleDisplay schedule={channel.schedule} username={channel.username} />
          </div>

          {/* Past sets */}
          <div>
            <SessionList username={channel.username} />
          </div>
        </div>

        {/* Right Column (Aligns perfectly with Chat Panel / QR code card) */}
        <aside className={`${isChatCollapsed ? "lg:w-10" : "lg:w-[320px] xl:w-[360px]"} w-full shrink-0 flex flex-col gap-4`}>
          {!isChatCollapsed ? (
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
          ) : (
            <div className="hidden lg:block w-10 shrink-0" />
          )}
        </aside>
      </div>

      {isReportModalOpen && (
        <div
          data-testid="report-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
        >
          <div className="w-full max-w-md border border-[#27272a] bg-[#0e0e10] p-6 shadow-2xl sm:p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-500">
              <Flag className="h-4 w-4 text-red-500" />
              // REPORT BROADCAST
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
                      setChannel(prev => ({
                        ...prev,
                        is_subscribed: false,
                        subscriber_count: Math.max(0, (prev.subscriber_count || 0) - 1)
                      }));
                      toast.success(`Successfully unsubscribed from @${channel.username}.`);
                      setIsManageSubOpen(false);
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
                      setChannel(prev => ({
                        ...prev,
                        is_subscribed: true,
                        subscriber_count: (prev.subscriber_count || 0) + 1
                      }));
                      toast.success(`Subscribed to @${channel.username}! Welcome to the inner circle.`);
                      setIsManageSubOpen(false);
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

                <button
                  type="button"
                  disabled={!giftRecipient || giftingInProgress}
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