import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import ChannelCard from "@/components/ChannelCard";
import Marquee from "@/components/Marquee";
import StreamCarousel from "@/components/StreamCarousel";
import FeaturedDJProfiles from "@/components/FeaturedDJProfiles";
import ChatPanel from "@/components/ChatPanel";
import SEO from "@/components/SEO";
import { ArrowRight, Radio, Zap, Heart } from "lucide-react";
import { useLivepeerAutoPoll } from "@/hooks/useLivepeerAutoPoll";
import { useStableLiveChannels } from "@/hooks/useStableLiveChannels";

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

export default function Browse() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const { user } = useAuth();
  const hasLoadedOnceRef = useRef(false);
  const [category, setCategory] = useState(null);
  const [liveOnly, setLiveOnly] = useState(true);
  const [followingOnly, setFollowingOnly] = useState(false);
  const [followingList, setFollowingList] = useState([]);
  const [rawChannels, setRawChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backendLoading, setBackendLoading] = useState(true);
  const isScreenLoading = (loading || backendLoading) && !hasLoadedOnceRef.current;

  useLivepeerAutoPoll();

  useEffect(() => {
    if (!user) {
      setFollowingList([]);
      return;
    }
    const fetchFollowing = () => {
      api.get("/users/mine/following")
        .then(({ data }) => {
          if (data && Array.isArray(data.following)) {
            setFollowingList(data.following.map((u) => u.toLowerCase()));
          }
        })
        .catch(() => {});
    };
    fetchFollowing();
    window.addEventListener("follow-changed", fetchFollowing);
    return () => window.removeEventListener("follow-changed", fetchFollowing);
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!hasLoadedOnceRef.current) {
      setLoading(true);
      setBackendLoading(true);
    }

    async function load() {
      try {
        const { data } = await api.get("/channels");
        if (active && Array.isArray(data)) {
          const DUMMY_USERNAMES = ["pirate_fm", "acid_vault", "dub_station"];
          const cleaned = data.filter(
            (c) =>
              !DUMMY_USERNAMES.includes((c.username || "").toLowerCase()) &&
              !c.is_dummy &&
              !c.channel_id?.startsWith("chan-pirate") &&
              !c.channel_id?.startsWith("chan-acid") &&
              !c.channel_id?.startsWith("chan-dub")
          );
          setRawChannels(cleaned);
        }
      } catch (err) {
        console.warn("Initial channels fetch on Browse failed/timed out:", err);
      } finally {
        if (active) {
          setBackendLoading(false);
          setLoading(false);
          hasLoadedOnceRef.current = true;
        }
      }
    }
    load();

    const q = collection(db, "channels");
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!active) return;
        const fsDocs = snapshot.docs.map((docSnap) => {
          const docId = docSnap.id;
          const data = docSnap.data();
          if (!data) return null;

          const isUndefinedId = (
            docId === "undefined" ||
            docId === "null" ||
            docId.toLowerCase() === "undefined" ||
            docId.toLowerCase() === "null"
          );
          if (isUndefinedId) return null;

          const channelKey = data.channel_id || data.username || docId;
          if (channelKey === "undefined" || channelKey === "null" || data.username === "undefined" || data.username === "null") {
            return null;
          }

          let playbackId = data.playback_id || data.playbackId || "";
          let livepeerStreamId = data.livepeer_stream_id || "";

          // Force correct values for djsparkz
          if (data.username?.toLowerCase() === "djsparkz" || docId === "nsU1v44XFnN3FloJvNePqj6cBG2" || data.user_uid === "nsU1v44XFnN3FloJvNePqj6cBG2") {
            playbackId = data.playback_url || data.playbackUrl || data.playback_id || "https://a1b2c3d4e5f6.us-east-1.playback.live-video.net/api/video/v1/us-east-1.123456789012.channel.djsparkz-channel.m3u8";
            livepeerStreamId = data.livepeer_stream_id || "arn:aws:ivs:us-east-1:123456789012:channel/djsparkz-channel";
          }

          return {
            channel_id: docId,
            ...data,
            playback_id: playbackId,
            playbackId: playbackId,
            livepeer_stream_id: livepeerStreamId,
            is_live: Boolean(data.is_live || data.isLive),
            isLive: Boolean(data.is_live || data.isLive),
          };
        }).filter(Boolean);

        setRawChannels((prev) => {
          const DUMMY_USERNAMES = ["pirate_fm", "acid_vault", "dub_station"];

          if (!prev || prev.length === 0) {
            const mappedFs = fsDocs.map((d) => ({
              id: d.channel_id,
              channel_id: d.channel_id,
              username: d.username,
              display_name: d.display_name || d.username,
              photo_url: d.photo_url || null,
              thumbnail_url: d.thumbnail_url || null,
              category: d.category || "music",
              stream_title: d.stream_title || "",
              is_live: Boolean(d.is_live || d.isLive),
              isLive: Boolean(d.is_live || d.isLive),
              viewer_count: d.viewer_count || 0,
              schedule: d.schedule || (d.schedule_json ? JSON.parse(d.schedule_json) : []),
              playback_id: d.playback_id,
              playbackId: d.playbackId,
              livepeer_stream_id: d.livepeer_stream_id,
            }));

            return mappedFs.filter(
              (c) =>
                !DUMMY_USERNAMES.includes((c.username || "").toLowerCase()) &&
                !c.is_dummy &&
                !c.channel_id?.startsWith("chan-pirate") &&
                !c.channel_id?.startsWith("chan-acid") &&
                !c.channel_id?.startsWith("chan-dub")
            );
          }

          // Merge Firestore live updates with API list
          const fsMap = new Map();
          fsDocs.forEach((d) => {
            if (d.username) fsMap.set(d.username.toLowerCase(), d);
            if (d.channel_id) fsMap.set(d.channel_id.toLowerCase(), d);
          });

          return prev.map((c) => {
            const fsData = fsMap.get(c.username?.toLowerCase()) || fsMap.get(c.channel_id?.toLowerCase());
            if (fsData) {
              return {
                ...c,
                photo_url: fsData.photo_url !== undefined ? fsData.photo_url : c.photo_url,
                display_name: fsData.display_name || c.display_name,
                thumbnail_url: fsData.thumbnail_url !== undefined ? fsData.thumbnail_url : c.thumbnail_url,
                is_live: Boolean(fsData.is_live || fsData.isLive),
                isLive: Boolean(fsData.is_live || fsData.isLive),
                viewer_count: fsData.viewer_count ?? c.viewer_count,
                stream_title: fsData.stream_title || c.stream_title,
                category: fsData.category || c.category,
                playback_id: fsData.playback_id || c.playback_id,
                playbackId: fsData.playbackId || c.playbackId,
                livepeer_stream_id: fsData.livepeer_stream_id || c.livepeer_stream_id,
                schedule:
                  fsData.schedule ||
                  (fsData.schedule_json
                    ? (() => {
                        try {
                          return JSON.parse(fsData.schedule_json);
                        } catch (e) {
                          return c.schedule;
                        }
                      })()
                    : c.schedule),
              };
            }
            return c;
          });
        });
      },
      (err) => {
        console.warn("Firestore on Browse snapshot warning:", err);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    const handleChannelUpdated = (e) => {
      const updatedChan = e.detail?.channel;
      if (!updatedChan) return;
      setRawChannels((prev) => {
        return prev.map((c) => {
          const isMatch = (
            (c.id && c.id === updatedChan.id) ||
            (c.username && c.username.toLowerCase() === (updatedChan.username || "").toLowerCase()) ||
            (c.user_uid && c.user_uid === updatedChan.user_uid)
          );
          if (isMatch) {
            return {
              ...c,
              ...updatedChan,
              thumbnail_url: updatedChan.thumbnail_url,
              thumbnailUrl: updatedChan.thumbnail_url,
            };
          }
          return c;
        });
      });
    };

    window.addEventListener("channel-updated", handleChannelUpdated);
    return () => window.removeEventListener("channel-updated", handleChannelUpdated);
  }, []);

  const rawStableChannels = useStableLiveChannels(rawChannels);

  const stableChannels = (() => {
    const unique = new Map();
    (rawStableChannels || []).forEach((c) => {
      const key = (c.username || "").toLowerCase().trim();
      if (key && !unique.has(key)) {
        unique.set(key, c);
      }
    });
    return Array.from(unique.values());
  })();

  let filteredChannels = stableChannels;
  if (q.trim()) {
    const qLower = q.toLowerCase().trim();
    filteredChannels = filteredChannels.filter((c) => {
      return (
        (c.display_name || c.username || "").toLowerCase().includes(qLower) ||
        (c.stream_title || "").toLowerCase().includes(qLower) ||
        (c.category || "").toLowerCase().includes(qLower) ||
        (c.bio || "").toLowerCase().includes(qLower)
      );
    });
  }
  if (followingOnly) {
    filteredChannels = filteredChannels.filter((c) =>
      followingList.includes((c.username || "").toLowerCase())
    );
  }
  if (liveOnly) {
    filteredChannels = filteredChannels.filter((c) => Boolean(c.is_live || c.isLive) === true);
  }
  if (category) {
    filteredChannels = filteredChannels.filter((c) => c.category === category);
  }

  const safeChannels = Array.isArray(filteredChannels) ? filteredChannels : [];

  return (
    <div className="min-h-screen">
      <SEO
        title="Underground Live Radio, DJ Sets & Broadcasters"
        description="Discover the finest underground music streams, breakbeat jungle, drum & bass, tech house, dubstep, and roots reggae broadcasts on SPARKZ.TV. Join the Signal."
        image="/og-image.jpg"
        keywords="sparkztv, sparkz, live DJ streams, underground radio, dnb livestream, drum and bass set, breakbeat jungle, tech house live, garage music, dubplate selector, sound system culture"
      />
      <h1 className="sr-only">Underground Live Radio, DJ Sets &amp; Broadcasters on SPARKZ.TV</h1>
      {/* Dynamic Twitch-style stream carousel */}
      <StreamCarousel channels={stableChannels} allChannels={stableChannels} isLoading={isScreenLoading} />

      <Marquee items={CATEGORIES.map((c) => c.toUpperCase())} />

      {/* Filters + Grid */}
      <section id="grid" className="mx-auto max-w-[1440px] px-6 pt-12 pb-24 sm:pb-28 lg:pb-32">
        <div className="flex flex-col">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="label-caps">Signal Directory</div>
            <h2 className="font-display text-3xl font-black tracking-tighter sm:text-4xl">
              {followingOnly ? "FOLLOWING" : liveOnly ? "LIVE NOW" : "ALL CHANNELS"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <button
                data-testid="filter-following"
                onClick={() => setFollowingOnly((v) => !v)}
                className={`chip inline-flex items-center gap-1 ${followingOnly ? "active" : ""}`}
              >
                <Heart className={`h-3 w-3 ${followingOnly ? "fill-current" : ""}`} />
                {followingOnly ? "FOLLOWING" : "SHOW FOLLOWED"}
              </button>
            )}
            <button
              data-testid="filter-live-only"
              onClick={() => setLiveOnly((v) => !v)}
              className={`chip ${liveOnly ? "active" : ""}`}
            >
              {liveOnly ? "◉ LIVE ONLY" : "○ SHOW ALL"}
            </button>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          <button
            data-testid="category-all"
            onClick={() => setCategory(null)}
            className={`chip ${category === null ? "active" : ""}`}
          >
            ALL
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              data-testid={`category-${c.replace(/\s+/g, "-")}`}
              onClick={() => setCategory(c)}
              className={`chip ${category === c ? "active" : ""}`}
            >
              {c}
            </button>
          ))}
        </div>

        {isScreenLoading && rawChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[#27272a] bg-[#09090b]/40 relative overflow-hidden" data-testid="directory-loading">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(229,255,0,0.02),transparent_70%)] pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center">
              {/* Spinning / Pulsing Radar Scan Animation */}
              <div className="relative h-16 w-16 mb-6 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-[#e5ff00]/10 animate-ping" />
                <div className="absolute h-12 w-12 rounded-full border border-[#e5ff00]/30 animate-pulse" />
                <Radio className="h-6 w-6 text-[#e5ff00] animate-bounce" />
              </div>
              <div className="font-display text-lg font-black uppercase tracking-widest text-[#e5ff00] animate-pulse">
                // SCANNING NETWORK SIGNALS...
              </div>
              <p className="mt-2 font-mono text-[10px] text-zinc-500 uppercase tracking-widest text-center max-w-sm">
                Awaiting connection response from primary transmitter. Please standby.
              </p>
            </div>
            
            {/* 4 Skeleton Cards underneath the Scanner to maintain visual weight */}
            <div className="w-full mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 opacity-35">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-[#1a1a1d] bg-[#070709] flex flex-col relative overflow-hidden">
                  <div className="aspect-video w-full bg-[#121215] relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#1c1c22] to-transparent animate-shimmer-slide" />
                  </div>
                  <div className="p-4 flex flex-col gap-2">
                    <div className="h-4 w-3/4 bg-[#121215] rounded" />
                    <div className="h-3 w-1/2 bg-[#121215] rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : safeChannels.length === 0 ? (
          <div
            data-testid="empty-state"
            className="border border-dashed border-[#27272a] p-16 text-center"
          >
            <div className="font-display text-2xl font-black uppercase tracking-tighter text-zinc-500">
              // NO SIGNAL
            </div>
            <p className="mt-3 font-mono text-sm text-zinc-500">
              {followingOnly
                ? "None of the channels you follow are live right now."
                : liveOnly
                  ? "No streams currently live. Check back soon."
                  : "No channels registered yet. Be the first to broadcast."}
            </p>
            <Link to="/register" className="btn-primary mt-6 inline-flex">
              START A CHANNEL
            </Link>
          </div>
        ) : (
          <div className="relative">
            {isScreenLoading && (
              <div className="absolute -top-12 right-0 flex items-center gap-1.5 font-mono text-[9px] text-[#e5ff00] uppercase tracking-widest animate-pulse z-20 bg-black/80 px-2.5 py-1 rounded border border-[#e5ff00]/20">
                <span className="h-1.5 w-1.5 rounded-full bg-[#e5ff00] animate-ping" />
                Updating Grid...
              </div>
            )}
            <div
              data-testid="channels-grid"
              className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 transition-opacity duration-300 ${isScreenLoading ? "opacity-75 select-none pointer-events-none" : ""}`}
            >
              {safeChannels.map((c, idx) => {
                const cardKey = c.id || c.channel_id || c.username || `channel-card-${idx}`;
                return <ChannelCard key={cardKey} channel={c} />;
              })}
            </div>
          </div>
        )}
        </div>
      </section>

      {/* Featured DJ Profiles Section with Firestore Follow Integration */}
      <FeaturedDJProfiles />

      {/* Search Crawler Friendly Sitemap & Platform Index Hub */}
      <section className="border-t border-[#1c1c1f] bg-[#050506] py-16 px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-[#e5ff00] mb-4">// PLATFORM DIRECTORY &amp; STATION INDEX</h2>
          <p className="text-zinc-400 font-sans text-sm leading-relaxed mb-8">
            Welcome to <strong className="text-[#e5ff00]">SPARKZ.TV</strong>, the definitive underground broadcasting hub for electronic music creators, selectors, and pirate-radio sound system selectors. Stream high-fidelity, high-bandwidth live audio/video sets spanning deep drum and bass, jungle, dubstep, UK garage, and deep tech house. Discover dynamic transmissions, browse schedules, read our journal, or start your own channel.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-xs font-mono">
            <div>
              <h3 className="text-white uppercase font-bold tracking-widest mb-3 text-xs border-b border-[#27272a] pb-1">// SIGNALS</h3>
              <ul className="space-y-2">
                <li><Link to="/directory" className="text-zinc-400 hover:text-[#e5ff00] transition-colors">✦ MAIN STATION DIRECTORY</Link></li>
                <li><Link to="/live" className="text-zinc-400 hover:text-[#e5ff00] transition-colors">✦ QUICK LIVE PLAYER</Link></li>
                <li><Link to="/lounge" className="text-zinc-400 hover:text-[#e5ff00] transition-colors">✦ SELECTOR LOUNGE CHAT</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white uppercase font-bold tracking-widest mb-3 text-xs border-b border-[#27272a] pb-1">// RESOURCES</h3>
              <ul className="space-y-2">
                <li><Link to="/blog" className="text-zinc-400 hover:text-[#e5ff00] transition-colors">✦ THE JOURNAL (NEWS &amp; CULTURE)</Link></li>
                <li><Link to="/register" className="text-zinc-400 hover:text-[#e5ff00] transition-colors">✦ CREATE BROADCASTER ACCOUNT</Link></li>
                <li><Link to="/login" className="text-zinc-400 hover:text-[#e5ff00] transition-colors">✦ MEMBER LOGIN PORTAL</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white uppercase font-bold tracking-widest mb-3 text-xs border-b border-[#27272a] pb-1">// BROADCASTING ARCHETYPE</h3>
              <p className="text-zinc-500 font-sans leading-relaxed text-[11px] uppercase">
                SPARKZ.TV is optimized for high-fidelity 320kbps audio performance. No third-party advertisements or algorithmic dampeners.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
