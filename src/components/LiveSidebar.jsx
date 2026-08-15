import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, fileUrl, DEFAULT_AVATAR } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { ChevronLeft, ChevronRight, User, Radio, Bell, BellOff, Tv, Calendar, Heart, ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import StoriesSection from "@/components/StoriesSection";

const STORAGE_KEY = "sparkz_sidebar_collapsed";
const CHIMES_KEY = "sparkz_chime_reminders";
const SHOW_OFFLINE_KEY = "sparkz_sidebar_show_offline";
const DUMMY_USERNAMES = ["pirate_fm", "acid_vault", "dub_station"];

function isDocId(str) {
  if (!str || typeof str !== "string") return false;
  const trimmed = str.trim();
  return (
    trimmed.length >= 20 &&
    /^[A-Za-z0-9_-]+$/.test(trimmed)
  );
}

function isValidString(str) {
  if (!str || typeof str !== "string") return false;
  const trimmed = str.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower === "undefined" ||
    lower === "null" ||
    lower === "channel" ||
    isDocId(trimmed)
  ) {
    return false;
  }
  return true;
}

function cleanString(str) {
  if (!isValidString(str)) return null;
  return str.trim();
}

function isValidChannel(c) {
  if (!c || typeof c !== "object") return false;
  return Boolean(c.username || c.display_name || c.channel_id || c.id);
}

function getNormalizedKey(data, docId) {
  const uname = cleanString(data?.username);
  if (uname) return uname.toLowerCase();

  const chanId = cleanString(data?.channel_id);
  if (chanId) return chanId.toLowerCase();

  const id = cleanString(docId || data?.id);
  if (id) return id.toLowerCase();

  return "djsparkz";
}

function getDisplayName(c) {
  const cid = c?.channel_id || c?.id;
  if (cid === "nsU1v44XFnNn3FloJvNePqj6cBG2" || c?.user_uid === "nsU1v44XFnNn3FloJvNePqj6cBG2" || c?.username === "djsparkz") {
    return "djsparkz";
  }
  if (c?.display_name && typeof c.display_name === "string" && c.display_name.trim()) {
    const trimmed = c.display_name.trim();
    if (!isDocId(trimmed) && trimmed.toLowerCase() !== "undefined") {
      if (trimmed === "SPARKS 108 FM") return "djsparkz";
      return trimmed;
    }
  }
  if (c?.username && typeof c.username === "string" && c.username.trim()) {
    const trimmed = c.username.trim();
    if (!isDocId(trimmed) && trimmed.toLowerCase() !== "undefined") return trimmed;
  }
  return "DJ Sparkz";
}

function getTargetUsername(c) {
  const cid = c?.channel_id || c?.id;
  if (cid === "nsU1v44XFnNn3FloJvNePqj6cBG2" || c?.user_uid === "nsU1v44XFnNn3FloJvNePqj6cBG2" || c?.username === "djsparkz") {
    return "djsparkz";
  }

  const uName = cleanString(c?.username);
  if (uName) return uName;

  if (c?.display_name && typeof c.display_name === "string" && c.display_name.trim()) {
    const trimmed = c.display_name.trim();
    if (!isDocId(trimmed) && trimmed.toLowerCase() !== "undefined") {
      if (trimmed === "SPARKS 108 FM") return "djsparkz";
      return trimmed.toLowerCase().replace(/\s+/g, "_");
    }
  }

  return cid || "djsparkz";
}

export default function LiveSidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [channels, setChannels] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [showOffline, setShowOffline] = useState(() => {
    try {
      return localStorage.getItem(SHOW_OFFLINE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1"
  );
  const [loaded, setLoaded] = useState(false);

  const [chimes, setChimes] = useState(() => {
    try {
      const saved = localStorage.getItem(CHIMES_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleChime = (username, displayName, e) => {
    e.preventDefault();
    e.stopPropagation();

    const normUser = username.toLowerCase();
    const nextState = !chimes[normUser];

    const updated = { ...chimes, [normUser]: nextState };
    setChimes(updated);

    try {
      localStorage.setItem(CHIMES_KEY, JSON.stringify(updated));
    } catch {}

    if (nextState) {
      toast.success(`Chime set! You will be notified when @${username} goes live.`, {
        description: `Green room reminder active for ${displayName || username}.`,
        icon: "",
      });
    } else {
      toast.info(`Chime reminder removed for @${username}.`);
    }
  };

  const toggleShowOffline = () => {
    const next = !showOffline;
    setShowOffline(next);
    try {
      localStorage.setItem(SHOW_OFFLINE_KEY, next ? "1" : "0");
    } catch {}
  };

  useEffect(() => {
    if (!user) {
      setFollowingList([]);
      return;
    }

    let cancelled = false;

    const fetchFollowing = () => {
      api
        .get("/users/mine/following")
        .then(({ data }) => {
          if (!cancelled && data && Array.isArray(data.following)) {
            setFollowingList(data.following.map((u) => u.toLowerCase()));
          }
        })
        .catch(() => {});
    };

    fetchFollowing();

    const handleFollowChange = () => {
      fetchFollowing();
    };

    window.addEventListener("follow-changed", handleFollowChange);
    window.addEventListener("focus", handleFollowChange);
    const interval = setInterval(fetchFollowing, 3000);

    return () => {
      cancelled = true;
      window.removeEventListener("follow-changed", handleFollowChange);
      window.removeEventListener("focus", handleFollowChange);
      clearInterval(interval);
    };
  }, [user]);

  const followedSet = useMemo(() => {
    return new Set(followingList.map((u) => u.toLowerCase()));
  }, [followingList]);

  useEffect(() => {
    let cancelled = false;

    api
      .get("/channels")
      .then(({ data }) => {
        if (cancelled) return;
        const rawList = Array.isArray(data) ? data : [];
        const map = new Map();

        rawList.forEach((c) => {
          if (!isValidChannel(c)) return;
          const normKey = getNormalizedKey(c, c.channel_id || c.id);
          if (DUMMY_USERNAMES.includes(normKey) || c.is_dummy) return;

          map.set(normKey, c);
        });

        setChannels(Array.from(map.values()));
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });

    const q = collection(db, "channels");
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (cancelled) return;

        setChannels((prev) => {
          const map = new Map();

          prev.forEach((c) => {
            const key = getNormalizedKey(c, c.id);
            if (!DUMMY_USERNAMES.includes(key) && !c.is_dummy) {
              map.set(key, c);
            }
          });

          snapshot.forEach((docSnap) => {
            const docId = docSnap.id;
            const data = docSnap.data();
            if (!data) return;

            const isUndefinedId = (
              docId === "undefined" ||
              docId === "null" ||
              docId.toLowerCase() === "undefined" ||
              docId.toLowerCase() === "null"
            );
            if (isUndefinedId) return;

            const normKey = getNormalizedKey(data, docId);
            if (normKey === "undefined" || normKey === "null" || data.username === "undefined" || data.username === "null") {
              return;
            }

            let playbackId = data.playback_id || data.playbackId || "";
            let livepeerStreamId = data.livepeer_stream_id || "";

            if (data.username?.toLowerCase() === "djsparkz" || docId === "nsU1v44XFnNn3FloJvNePqj6cBG2" || data.user_uid === "nsU1v44XFnNn3FloJvNePqj6cBG2") {
              playbackId = data.playback_url || data.playbackUrl || data.playback_id || "https://a1b2c3d4e5f6.us-east-1.playback.live-video.net/api/video/v1/us-east-1.123456789012.channel.djsparkz-channel.m3u8";
              livepeerStreamId = data.livepeer_stream_id || "arn:aws:ivs:us-east-1:123456789012:channel/djsparkz-channel";
            }

            const merged = { 
              id: docId, 
              ...data,
              playback_id: playbackId,
              playbackId: playbackId,
              livepeer_stream_id: livepeerStreamId,
            };
            if (!isValidChannel(merged)) return;

            if (DUMMY_USERNAMES.includes(normKey) || data.is_dummy) return;

            const existing = map.get(normKey) || {};
            map.set(normKey, {
              ...existing,
              ...merged,
              is_live: Boolean(data.is_live || data.isLive),
              isLive: Boolean(data.is_live || data.isLive),
              viewer_count: data.viewer_count ?? existing.viewer_count ?? 0,
              stream_title: data.stream_title || existing.stream_title,
              category: data.category || existing.category,
              schedule:
                Array.isArray(data.schedule)
                  ? data.schedule
                  : data.schedule_json
                  ? (() => {
                      try {
                        return JSON.parse(data.schedule_json);
                      } catch (e) {
                        return existing.schedule;
                      }
                    })()
                  : existing.schedule,
            });
          });

          return Array.from(map.values()).filter(isValidChannel);
        });

        setLoaded(true);
      },
      (err) => {
        setLoaded(true);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      window.dispatchEvent(new Event("sidebar-toggle"));
    } catch {}
  };

  const safeChannels = (Array.isArray(channels) ? channels : []).filter((c) => {
    if (!isValidChannel(c)) return false;
    const norm = getNormalizedKey(c, c.id);
    return !DUMMY_USERNAMES.includes(norm) && !c.is_dummy;
  });

  // Strict Follower Filter: Only allow channels in followedSet and EXCLUDE the logged-in user themselves from showing up as "live" in their own sidebar feed
  const followedChannels = safeChannels.filter((c) => {
    if (!user) return false;
    const targetUname = getTargetUsername(c).toLowerCase();
    const myUname = (user.username || "").toLowerCase();
    if (myUname && targetUname === myUname) return false; // Prevent showing own channel in followed list
    return followedSet.has(targetUname);
  });

  const recommendedChannels = safeChannels.filter((c) => {
    const targetUname = getTargetUsername(c).toLowerCase();
    const myUname = user ? (user.username || "").toLowerCase() : "";
    if (myUname && targetUname === myUname) return false;
    return !user || !followedSet.has(targetUname);
  });

  const followedLive = followedChannels.filter((c) => Boolean(c.is_live || c.isLive));
  const followedUpcoming = followedChannels.filter(
    (c) => !Boolean(c.is_live || c.isLive) && Array.isArray(c.schedule) && c.schedule.length > 0
  );
  const followedOffline = followedChannels.filter(
    (c) => !Boolean(c.is_live || c.isLive) && (!Array.isArray(c.schedule) || c.schedule.length === 0)
  );

  const recommendedLive = recommendedChannels.filter((c) => Boolean(c.is_live || c.isLive));
  const recommendedOffline = recommendedChannels.slice(0, 5);

  const hasAnyChannels =
    followedChannels.length > 0 || recommendedLive.length > 0 || recommendedChannels.length > 0;

  return (
    <aside
      data-testid="live-sidebar"
      className={`fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] flex-col border-r border-[#1f1f23] bg-[#0e0e10] lg:flex ${
        collapsed ? "w-[60px]" : "w-[240px]"
      } transition-[width,top,height] duration-150 overflow-x-hidden`}
    >
      <header className="flex flex-col border-b border-[#1f1f23] px-3 py-3 gap-1 min-w-0 bg-[#0e0e10]">
        <div className="flex items-center justify-between gap-1 min-w-0">
          {!collapsed ? (
            <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
              <span className="font-sans text-xs font-bold text-[#efeff1] uppercase tracking-wider">
                For You
              </span>
            </div>
          ) : (
            <div className="flex w-full justify-center">
              <Heart className="h-4 w-4 text-zinc-400" />
            </div>
          )}
          <button
            data-testid="sidebar-toggle"
            onClick={toggle}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-all"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto divide-y divide-[#1f1f23]">
        <StoriesSection sidebar={true} collapsed={collapsed} />

        {!loaded ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-8 w-8 flex-shrink-0 animate-pulse bg-[#1f1f23]" />
                {!collapsed && <div className="h-3 flex-1 animate-pulse bg-[#1f1f23]" />}
              </div>
            ))}
          </div>
        ) : !hasAnyChannels ? (
          <EmptyState
            collapsed={collapsed}
            isLoggedIn={Boolean(user)}
          />
        ) : (
          <>
            {/* STRICT FOLLOWED LIVE SECTION (Only shows if you follow them, never yourself) */}
            {followedLive.length > 0 && (
              <div className="py-1">
                {!collapsed && (
                  <div className="px-3 py-1.5 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#efeff1]">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        Followed Channels
                      </span>
                      <button className="text-zinc-400 hover:text-white" title="Sort by Viewers">
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                      Viewers (High to Low)
                    </span>
                  </div>
                )}
                <ul>
                  {followedLive.map((c) => (
                    <SidebarBroadcasterItem
                      key={getNormalizedKey(c, c.id)}
                      channel={c}
                      collapsed={collapsed}
                      isChimed={Boolean(chimes[getTargetUsername(c).toLowerCase()])}
                      onToggleChime={toggleChime}
                      navigate={navigate}
                      showLiveIndicator={true}
                    />
                  ))}
                </ul>
              </div>
            )}

            {/* RECOMMENDED LIVE (Only for guests or users following no channels) */}
            {recommendedLive.length > 0 && (!user || followedChannels.length === 0) && (
              <div className="py-1">
                {!collapsed && (
                  <div className="px-3 py-1.5 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#efeff1]">
                      <span>Recommended Channels</span>
                    </div>
                  </div>
                )}
                <ul>
                  {recommendedLive.map((c) => (
                    <SidebarBroadcasterItem
                      key={getNormalizedKey(c, c.id)}
                      channel={c}
                      collapsed={collapsed}
                      isChimed={Boolean(chimes[getTargetUsername(c).toLowerCase()])}
                      onToggleChime={toggleChime}
                      navigate={navigate}
                      showLiveIndicator={true}
                    />
                  ))}
                </ul>
              </div>
            )}

            {/* FOLLOWED SCHEDULED SECTION */}
            {followedUpcoming.length > 0 && (
              <div>
                {!collapsed && (
                  <div className="px-3 pt-3 pb-1.5 flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-[#e5ff00]" />
                      FOLLOWED SCHEDULED ({followedUpcoming.length})
                    </span>
                  </div>
                )}
                <ul>
                  {followedUpcoming.map((c) => (
                    <SidebarBroadcasterItem
                      key={getNormalizedKey(c, c.id)}
                      channel={c}
                      collapsed={collapsed}
                      isChimed={Boolean(chimes[getTargetUsername(c).toLowerCase()])}
                      onToggleChime={toggleChime}
                      navigate={navigate}
                      showLiveIndicator={false}
                    />
                  ))}
                </ul>
              </div>
            )}

            {/* OFFLINE FOLLOWED CHANNELS SECTION */}
            {followedOffline.length > 0 && (
              <div>
                {!collapsed && (
                  <button
                    type="button"
                    onClick={toggleShowOffline}
                    className="w-full px-3 py-2 flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors border-t border-[#27272a]/40 bg-[#080808]"
                  >
                    <span>OFFLINE FOLLOWED ({followedOffline.length})</span>
                    {showOffline ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                )}
                {(showOffline || collapsed) && (
                  <ul>
                    {followedOffline.map((c) => (
                      <SidebarBroadcasterItem
                        key={getNormalizedKey(c, c.id)}
                        channel={c}
                        collapsed={collapsed}
                        isChimed={Boolean(chimes[getTargetUsername(c).toLowerCase()])}
                        onToggleChime={toggleChime}
                        navigate={navigate}
                        showLiveIndicator={false}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* RECOMMENDED CHANNELS */}
            {followedChannels.length === 0 && recommendedOffline.length > 0 && (
              <div>
                {!collapsed && (
                  <button
                    type="button"
                    onClick={toggleShowOffline}
                    className="w-full px-3 py-2 flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors border-t border-[#27272a]/40 bg-[#080808]"
                  >
                    <span>RECOMMENDED CHANNELS</span>
                    {showOffline ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                )}
                {(showOffline || collapsed) && (
                  <ul>
                    {recommendedOffline.map((c) => (
                      <SidebarBroadcasterItem
                        key={getNormalizedKey(c, c.id)}
                        channel={c}
                        collapsed={collapsed}
                        isChimed={Boolean(chimes[getTargetUsername(c).toLowerCase()])}
                        onToggleChime={toggleChime}
                        navigate={navigate}
                        showLiveIndicator={false}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>


    </aside>
  );
}

function SidebarBroadcasterItem({ channel, collapsed, isChimed, onToggleChime, navigate, showLiveIndicator }) {
  const isLive = Boolean(channel.is_live || channel.isLive);
  const hasSchedule = Array.isArray(channel.schedule) && channel.schedule.length > 0;
  const targetUsername = getTargetUsername(channel);
  const displayName = getDisplayName(channel);
  const nextSet = hasSchedule ? channel.schedule[0] : null;

  const formattedViewers = useMemo(() => {
    const count = channel.viewer_count || 0;
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + "K";
    }
    return count.toString();
  }, [channel.viewer_count]);

  const ringStyle = (isLive && showLiveIndicator)
    ? "p-[1.5px] rounded-full border border-red-500 animate-fade-in"
    : hasSchedule
    ? "p-[1.5px] rounded-full border border-[#e5ff00]"
    : "p-[1px] rounded-full border border-zinc-700";

  return (
    <li>
      <div
        className="group relative flex items-center justify-between px-2.5 py-1.5 transition-all hover:bg-zinc-800/40"
        data-testid={`sidebar-broadcaster-${targetUsername}`}
      >
        <Link
          to={`/channel/${targetUsername}`}
          title={`${displayName} (@${targetUsername}) ${isLive && showLiveIndicator ? '— LIVE NOW' : hasSchedule ? '— SCHEDULED SET' : ''}`}
          className="flex items-center gap-2.5 min-w-0 flex-1"
        >
          {/* Avatar Container */}
          <div className="relative flex-shrink-0">
            <div className={ringStyle}>
              <img
                src={channel.photo_url ? fileUrl(channel.photo_url) : DEFAULT_AVATAR}
                alt={displayName}
                className="h-8 w-8 rounded-full object-cover transition-all"
              />
            </div>
            {isLive && showLiveIndicator && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-black bg-red-600 animate-pulse" />
            )}
          </div>

          {/* Details (Only visible when sidebar is expanded) */}
          {!collapsed && (
            <div className="min-w-0 flex-1 pr-1">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate font-sans text-[13px] font-semibold text-[#efeff1] group-hover:text-[#bf94ff] transition-colors leading-tight">
                  {displayName}
                </span>
                {isLive && showLiveIndicator ? (
                  <div className="flex items-center gap-1 flex-shrink-0 text-[#efeff1] font-sans text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                    <span>{formattedViewers}</span>
                  </div>
                ) : hasSchedule ? (
                  <span className="font-mono text-[8px] uppercase tracking-wider text-[#e5ff00] border border-[#e5ff00]/40 px-1 py-0.2 shrink-0">
                    {nextSet.day}
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-600 uppercase font-mono shrink-0">
                    off
                  </span>
                )}
              </div>

              <div className="mt-0.5 flex items-center justify-between font-sans text-[11px] text-zinc-400 leading-none">
                <span className="truncate text-zinc-400 group-hover:text-zinc-300">
                  {isLive && showLiveIndicator && channel.stream_title
                    ? channel.stream_title
                    : hasSchedule && nextSet
                    ? nextSet.title
                    : channel.category || "music"}
                </span>
              </div>
            </div>
          )}
        </Link>

        {/* Chime and Enter buttons (only visible when expanded) */}
        {!collapsed && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => onToggleChime(targetUsername, displayName, e)}
              className={`p-1 rounded hover:bg-zinc-700/50 transition-all ${
                isChimed
                  ? "text-[#e5ff00]"
                  : "text-zinc-500 hover:text-[#efeff1]"
              }`}
              title={isChimed ? "Chime Active — Click to remove" : "Set Chime Reminder"}
              aria-label="Set Chime Reminder"
            >
              {isChimed ? <Bell className="h-3.5 w-3.5 fill-[#e5ff00]" /> : <BellOff className="h-3 w-3" />}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(`/channel/${targetUsername}`);
              }}
              className="p-1 rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-[#efeff1] transition-all"
              title="Enter Green Room / Channel"
              aria-label="Enter Green Room"
            >
              <Tv className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function EmptyState({ collapsed, isLoggedIn }) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
        <Radio className="h-4 w-4 text-zinc-700" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="px-4 py-8 text-center">
        <Heart className="mx-auto h-5 w-5 text-zinc-600" />
        <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-[#e5ff00] font-bold">
          // CLAIM YOUR FREQUENCY
        </div>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-zinc-300">
          STREAM TO THE WORLD
        </p>
        <Link
          to="/login"
          className="mt-4 inline-block border border-[#27272a] bg-[#111] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#e5ff00] hover:border-[#e5ff00] transition-colors"
        >
          SIGN IN / REGISTER
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 text-center">
      <Heart className="mx-auto h-5 w-5 text-zinc-600" />
      <div className="mt-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
        // NO FOLLOWED CHANNELS YET
      </div>
      <p className="mt-2 font-mono text-[10px] leading-relaxed text-zinc-600">
        Follow your favorite DJs from the Directory or Channel pages to customize your live green room sidebar.
      </p>
      <Link
        to="/directory"
        className="mt-4 inline-block border border-[#27272a] bg-[#111] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#e5ff00] hover:border-[#e5ff00] transition-colors"
      >
        BROWSE BROADCASTER DIRECTORY
      </Link>
    </div>
  );
}