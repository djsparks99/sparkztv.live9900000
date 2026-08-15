import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { db, followDJInFirestore, unfollowDJInFirestore, handleFirestoreError } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { toast } from "sonner";
import {
  Heart,
  Radio,
  ExternalLink,
  Search,
  Sparkles,
  Zap,
  Music,
  Share2,
  Check,
  Disc3,
  Sliders,
  Volume2,
  Globe,
  Flame,
  Star,
  Users
} from "lucide-react";

// Curated resident & featured underground DJs with rich social links & metadata
const DEFAULT_FEATURED_DJS = [];

const GENRE_FILTERS = [
  { id: "all", label: "ALL DJS" },
  { id: "drum and bass", label: "DRUM & BASS" },
  { id: "jungle", label: "JUNGLE" },
  { id: "dubstep", label: "DUBSTEP" },
  { id: "acid", label: "ACID TECHNO" },
  { id: "tech", label: "TECHNO / HOUSE" },
  { id: "old skool", label: "OLD SKOOL WAX" },
];

export default function FeaturedDJProfiles({ title = "FEATURED RESIDENT DJS", subtitle = "Underground Artists & Broadcasters" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") || "";
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [liveChannels, setLiveChannels] = useState({});
  const [followerCounts, setFollowerCounts] = useState({});
  const [myFollowsMap, setMyFollowsMap] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [copiedDJ, setCopiedDJ] = useState(null);

  // Fetch initial follow counts
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch("/api/follows/counts");
        if (res.ok) {
          const data = await res.json();
          setFollowerCounts(data);
        }
      } catch (err) {
        console.error("Failed to fetch follow counts:", err);
      }
    };
    fetchCounts();
  }, []);

  // Sync local search query with global URL search parameters
  useEffect(() => {
    setSearchQuery(urlQuery);
  }, [urlQuery]);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (val.trim()) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("q", val);
          return next;
        },
        { replace: true }
      );
    } else {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("q");
          return next;
        },
        { replace: true }
      );
    }
  };

  // 1. Real-time Firestore listener for live status and channels
  useEffect(() => {
    const unsubChannels = onSnapshot(
      collection(db, "channels"),
      (snapshot) => {
        const liveMap = {};
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (data) {
            const docId = docSnap.id.toLowerCase();
            const username = (data.username || data.channel_id || docSnap.id).toLowerCase();
            
            const liveInfo = {
              is_live: Boolean(data.is_live || data.isLive),
              stream_title: data.stream_title || "",
              viewer_count: data.viewer_count || 0,
              photo_url: data.photo_url || data.photoUrl || null,
              category: data.category || "music",
              raw: data,
            };

            // Map all possible reference keys for robust lookups
            liveMap[docId] = liveInfo;
            liveMap[username] = liveInfo;
            if (data.username) liveMap[data.username.toLowerCase()] = liveInfo;
            if (data.channel_id) liveMap[data.channel_id.toLowerCase()] = liveInfo;
          }
        });
        setLiveChannels(liveMap);
      },
      (err) => {
        console.warn("Firestore channels listener in FeaturedDJProfiles:", err);
      }
    );

    // 2. Real-time Firestore listener for ONLY the current user's follows (O(1) footprint)
    let unsubFollows = () => {};
    if (user && user.uid) {
      const q = query(collection(db, "follows"), where("user_uid", "==", user.uid));
      unsubFollows = onSnapshot(
        q,
        (snapshot) => {
          const myMap = {};
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            if (data && data.dj_username) {
              myMap[data.dj_username.toLowerCase()] = true;
            }
          });
          setMyFollowsMap(myMap);
        },
        (err) => {
          console.warn("Firestore follows listener in FeaturedDJProfiles:", err);
        }
      );
    } else {
      setMyFollowsMap({});
    }

    return () => {
      unsubChannels();
      unsubFollows();
    };
  }, [user]);

  // Combine static curated list with dynamic Firestore updates
  const djList = useMemo(() => {
    // 1. Process default curated list
    const list = DEFAULT_FEATURED_DJS.map((dj) => {
      const uname = dj.username.toLowerCase();
      const liveInfo = liveChannels[uname] || liveChannels[uname.toLowerCase()];
      const isLive = liveInfo ? liveInfo.is_live : (uname === "djsparkz" ? Boolean(liveChannels["nsu1v44xfnnn3flojvnepqj6cbg2"]?.is_live || liveChannels["nsU1v44XFnNn3FloJvNePqj6cBG2"]?.is_live) : false);
      const followersFromDb = followerCounts[uname] || 0;
      const baseFollowers = uname === "djsparkz" ? 248 : 42;
      const totalFollowers = baseFollowers + followersFromDb;

      // Extract raw socials if updated in firestore and filter out empty fields
      const fsSocials = {};
      if (liveInfo?.raw?.socials) {
        Object.entries(liveInfo.raw.socials).forEach(([k, v]) => {
          if (v && String(v).trim()) {
            fsSocials[k] = String(v).trim();
          }
        });
      }
      const mergedSocials = {
        ...(dj.socials || {}),
        ...fsSocials
      };

      const rawBio = liveInfo?.raw?.bio;
      const finalBio = (rawBio && String(rawBio).trim()) ? String(rawBio).trim() : dj.bio;

      const rawGenre = liveInfo?.raw?.genre;
      const finalGenre = (rawGenre && String(rawGenre).trim()) ? String(rawGenre).trim() : (dj.genre || "Multi-genre Selector");

      const rawLocation = liveInfo?.raw?.location;
      const finalLocation = (rawLocation && String(rawLocation).trim()) ? String(rawLocation).trim() : (dj.location || "London, UK");

      return {
        ...dj,
        is_live: isLive,
        live_title: liveInfo?.stream_title || dj.tagline,
        viewer_count: liveInfo?.viewer_count || 0,
        photo_url: liveInfo?.photo_url || dj.photo_url,
        follower_count: totalFollowers,
        is_following: Boolean(myFollowsMap[uname]),
        socials: mergedSocials,
        bio: finalBio,
        genre: finalGenre,
        location: finalLocation,
      };
    });

    // 2. Dynamically add other registered community DJs from Firestore
    const DUMMY_USERNAMES = ["pirate_fm", "acid_vault", "dub_station"];
    const existingUsernames = new Set(list.map((d) => d.username.toLowerCase()));

    Object.keys(liveChannels).forEach((uname) => {
      const cleanUname = uname.toLowerCase();
      if (existingUsernames.has(cleanUname)) return;
      if (DUMMY_USERNAMES.includes(cleanUname)) return;
      if (cleanUname === "nsu1v44xfnnn3flojvnepqj6cbg2" || cleanUname === "djsparkz") return;

      const info = liveChannels[uname];
      const raw = info?.raw || {};
      if (!raw.username) return;

      const followersFromDb = followerCounts[cleanUname] || 0;
      const rawSocials = raw.socials || {};

      list.push({
        username: raw.username,
        display_name: raw.display_name || raw.username.toUpperCase(),
        tagline: raw.stream_title || "Underground Selector",
        genre: raw.genre || raw.category || "General Selection",
        categories: raw.tags || [raw.category || "music"],
        location: raw.location || "Underground",
        bio: raw.bio || "Resident selector live on SPARKZ.TV.",
        photo_url: raw.photo_url || raw.photoUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${raw.username}`,
        cover_gradient: "from-zinc-500/20 via-zinc-600/10 to-transparent",
        watts: raw.watts || 120,
        accent_color: "#e5ff00",
        badge: raw.badge || "COMMUNITY DJ",
        socials: rawSocials,
        is_live: info.is_live,
        live_title: raw.stream_title || "Broadcast",
        viewer_count: info.viewer_count || 0,
        follower_count: followersFromDb,
        is_following: Boolean(myFollowsMap[cleanUname]),
      });
    });

    return list;
  }, [liveChannels, followerCounts, myFollowsMap]);

  // Filter and search
  const filteredDJs = useMemo(() => {
    return djList.filter((dj) => {
      const matchesFilter =
        activeFilter === "all" ||
        dj.categories.includes(activeFilter) ||
        dj.genre.toLowerCase().includes(activeFilter);

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        dj.display_name.toLowerCase().includes(q) ||
        dj.username.toLowerCase().includes(q) ||
        dj.genre.toLowerCase().includes(q) ||
        dj.location.toLowerCase().includes(q) ||
        dj.bio.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [djList, activeFilter, searchQuery]);

  // Direct Firestore follow toggle
  const handleToggleFollow = async (dj) => {
    if (!user) {
      toast("Authentication Required", {
        description: "Please sign in to follow DJs and receive live stream notifications.",
        action: {
          label: "Sign In",
          onClick: () => navigate("/login"),
        },
      });
      return;
    }

    const cleanDj = dj.username.toLowerCase();
    const isCurrentlyFollowing = Boolean(myFollowsMap[cleanDj]);

    setActionLoading((prev) => ({ ...prev, [cleanDj]: true }));

    try {
      if (isCurrentlyFollowing) {
        // Direct Firestore delete write
        await unfollowDJInFirestore(user, cleanDj);
        setFollowerCounts(prev => ({
          ...prev,
          [cleanDj]: Math.max(0, (prev[cleanDj] || 0) - 1)
        }));
        toast.success(`Unfollowed @${dj.username}`, {
          description: "Removed from your Firestore follow list. You won't receive live stream notifications.",
        });
        window.dispatchEvent(
          new CustomEvent("follow-changed", {
            detail: { username: dj.username, isFollowing: false },
          })
        );
      } else {
        // Direct Firestore create write
        await followDJInFirestore(user, cleanDj, dj.display_name);
        setFollowerCounts(prev => ({
          ...prev,
          [cleanDj]: (prev[cleanDj] || 0) + 1
        }));
        toast.success(`Following @${dj.username}!`, {
          description: "Saved to Firestore. You'll get notified as soon as they start broadcasting.",
        });
        window.dispatchEvent(
          new CustomEvent("follow-changed", {
            detail: { username: dj.username, isFollowing: true },
          })
        );
      }
    } catch (err) {
      toast.error("Follow operation failed", {
        description: err.message || "Please check connection to Firestore.",
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, [cleanDj]: false }));
    }
  };

  const handleShareDJ = (dj, e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/channel/${dj.username}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedDJ(dj.username);
      toast.success(`Copied link for @${dj.username}!`);
      setTimeout(() => setCopiedDJ(null), 2000);
    }
  };

  if (djList.length === 0) {
    return null;
  }

  return (
    <section
      id="featured-djs"
      aria-label="Featured DJ Profiles"
      className="relative w-full py-12 px-4 sm:px-6 lg:px-8 border-t border-[#1f1f24] bg-[#09090b]/60"
    >
      {/* Background Ambience Glow */}
      <div className="absolute top-0 left-1/4 -z-10 h-72 w-72 rounded-full bg-[#e5ff00]/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 -z-10 h-72 w-72 rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />

      <div className="mx-auto max-w-[1440px]">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-[#e5ff00] animate-ping" />
              <span className="font-mono text-xs uppercase tracking-widest text-[#e5ff00] font-bold">
                {subtitle}
              </span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tighter text-white">
              {title}
            </h2>
            <p className="mt-2 text-sm text-zinc-400 max-w-xl font-mono">
              Connect with top resident selectors, follow your favorite broadcasters with real-time Firestore persistence, and tune in to raw underground frequencies.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              id="search-djs"
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search DJ, genre, city..."
              className="w-full bg-[#121215] border border-[#27272a] focus:border-[#e5ff00] text-zinc-100 placeholder-zinc-500 text-xs font-mono py-2.5 pl-9 pr-4 rounded outline-none transition-colors"
            />
            {searchQuery && (
              <button
                id="clear-dj-search"
                onClick={() => handleSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Genre Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 mb-8 border-b border-[#1c1c20] pb-4">
          <div className="flex items-center gap-1.5 text-zinc-500 font-mono text-[11px] uppercase mr-2">
            <Sliders className="h-3.5 w-3.5" />
            <span>Filter:</span>
          </div>
          {GENRE_FILTERS.map((f) => (
            <button
              key={f.id}
              id={`filter-dj-${f.id.replace(/\s+/g, "-")}`}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all ${
                activeFilter === f.id
                  ? "bg-[#e5ff00] text-black font-bold shadow-[0_0_12px_rgba(229,255,0,0.3)]"
                  : "bg-[#141418] text-zinc-400 hover:text-white border border-[#222228] hover:border-zinc-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* DJ Profiles Grid */}
        {filteredDJs.length === 0 ? (
          <div
            id="empty-dj-search"
            className="p-12 text-center border border-dashed border-[#27272a] bg-[#0c0c0e] rounded-lg"
          >
            <Disc3 className="h-10 w-10 text-zinc-600 mx-auto animate-spin mb-3" />
            <div className="font-display text-lg font-bold text-zinc-400 uppercase tracking-wider">
              No matching DJ profiles found
            </div>
            <p className="text-zinc-600 font-mono text-xs mt-1">
              Try adjusting your search query or reset the genre filter.
            </p>
            <button
              id="reset-dj-filters"
              onClick={() => {
                setActiveFilter("all");
                handleSearchChange("");
              }}
              className="mt-4 px-4 py-2 bg-[#18181b] hover:bg-[#27272a] text-zinc-300 font-mono text-xs uppercase tracking-wider rounded border border-[#333]"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div
            id="featured-dj-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredDJs.map((dj) => {
              const isLoading = Boolean(actionLoading[dj.username.toLowerCase()]);
              const isFollowing = dj.is_following;

              return (
                <div
                  key={dj.username}
                  id={`dj-card-${dj.username}`}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#222228] bg-[#0e0e11] p-6 transition-all duration-300 hover:border-zinc-600 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)]"
                >
                  {/* Subtle dynamic backdrop gradient */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${dj.cover_gradient} opacity-40 pointer-events-none group-hover:opacity-70 transition-opacity`}
                  />

                  <div>
                    {/* Card Header: Avatar, Badge & Live Indicator */}
                    <div className="flex items-start justify-between gap-4 mb-4 relative z-10">
                      <div className="relative">
                        <Link
                          to={`/channel/${dj.username}`}
                          className="block relative rounded-full overflow-hidden border-2 border-[#2c2c34] group-hover:border-[#e5ff00] transition-colors"
                        >
                          <img
                            src={dj.photo_url}
                            alt={`${dj.display_name} avatar`}
                            className="h-16 w-16 object-cover bg-black rounded-full transition-transform duration-300 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${dj.username}`;
                            }}
                          />
                        </Link>
                        {dj.is_live && (
                          <div
                            id={`live-pulse-${dj.username}`}
                            className="absolute -bottom-1 -right-1 flex items-center gap-1 bg-red-600 text-white font-mono text-[9px] font-black uppercase px-2 py-0.5 rounded-full border-2 border-black shadow-lg animate-pulse"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                            LIVE
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-wider border"
                            style={{
                              borderColor: `${dj.accent_color}40`,
                              backgroundColor: `${dj.accent_color}15`,
                              color: dj.accent_color,
                            }}
                          >
                            {dj.badge}
                          </span>
                          <button
                            id={`share-dj-${dj.username}`}
                            onClick={(e) => handleShareDJ(dj, e)}
                            title="Share DJ Profile"
                            className="p-1 text-zinc-500 hover:text-white bg-[#18181c] hover:bg-[#25252b] rounded transition-colors"
                          >
                            {copiedDJ === dj.username ? (
                              <Check className="h-3.5 w-3.5 text-green-400" />
                            ) : (
                              <Share2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-400">
                          <span className="flex items-center gap-1 text-amber-400 font-bold">
                            <Zap className="h-3 w-3 fill-current" />
                            {dj.watts}W
                          </span>
                          <span>•</span>
                          <span className="text-zinc-400 flex items-center gap-1">
                            <Globe className="h-3 w-3 text-zinc-500" />
                            {dj.location}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* DJ Name & Handle */}
                    <div className="relative z-10">
                      <Link
                        to={`/channel/${dj.username}`}
                        className="font-display text-xl font-black uppercase tracking-tight text-white hover:text-[#e5ff00] transition-colors flex items-center gap-2"
                      >
                        {dj.display_name}
                        <ExternalLink className="h-3.5 w-3.5 text-zinc-500 group-hover:text-[#e5ff00] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                      <div className="font-mono text-xs text-zinc-500 mb-1">
                        @{dj.username}
                      </div>

                      {/* Genre Tag */}
                      <div className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-300 bg-[#16161b] px-2.5 py-1 rounded border border-[#27272f] mb-3">
                        <Music className="h-3 w-3 text-[#e5ff00]" />
                        <span className="font-semibold text-zinc-200">{dj.genre}</span>
                      </div>

                      {/* Bio */}
                      <p className="text-xs text-zinc-400 leading-relaxed font-sans line-clamp-3 mb-4">
                        {dj.bio}
                      </p>
                    </div>

                    {/* Social Media Links Bar */}
                    <div className="relative z-10 mb-5 border-t border-[#1a1a20] pt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase text-zinc-500 tracking-wider">
                          Official Links
                        </span>
                        <div className="flex items-center gap-2">
                          {dj.socials.soundcloud && (
                            <a
                              id={`social-sc-${dj.username}`}
                              href={dj.socials.soundcloud}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="SoundCloud"
                              className="p-1.5 rounded-full bg-[#18181d] text-zinc-400 hover:text-[#ff5500] hover:bg-[#222228] transition-all"
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {dj.socials.mixcloud && (
                            <a
                              id={`social-mc-${dj.username}`}
                              href={dj.socials.mixcloud}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Mixcloud"
                              className="p-1.5 rounded-full bg-[#18181d] text-zinc-400 hover:text-cyan-400 hover:bg-[#222228] transition-all"
                            >
                              <Disc3 className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {dj.socials.spotify && (
                            <a
                              id={`social-sp-${dj.username}`}
                              href={dj.socials.spotify}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Spotify"
                              className="p-1.5 rounded-full bg-[#18181d] text-zinc-400 hover:text-[#1db954] hover:bg-[#222228] transition-all"
                            >
                              <Music className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {dj.socials.instagram && (
                            <a
                              id={`social-ig-${dj.username}`}
                              href={dj.socials.instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Instagram"
                              className="p-1.5 rounded-full bg-[#18181d] text-zinc-400 hover:text-[#e1306c] hover:bg-[#222228] transition-all"
                            >
                              <span className="font-mono text-[10px] font-bold">IG</span>
                            </a>
                          )}
                          {dj.socials.youtube && (
                            <a
                              id={`social-yt-${dj.username}`}
                              href={dj.socials.youtube}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="YouTube"
                              className="p-1.5 rounded-full bg-[#18181d] text-zinc-400 hover:text-[#ff0000] hover:bg-[#222228] transition-all"
                            >
                              <span className="font-mono text-[10px] font-bold">YT</span>
                            </a>
                          )}
                          {dj.socials.twitter && (
                            <a
                              id={`social-tw-${dj.username}`}
                              href={dj.socials.twitter}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="X / Twitter"
                              className="p-1.5 rounded-full bg-[#18181d] text-zinc-400 hover:text-white hover:bg-[#222228] transition-all"
                            >
                              <span className="font-mono text-[10px] font-bold">𝕏</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Live Status & Follow Button (Firestore integrated) */}
                  <div className="relative z-10 pt-4 border-t border-[#1c1c22] flex items-center justify-between gap-3">
                    {/* Follow Button directly writing to Firestore */}
                    <button
                      id={`btn-follow-dj-${dj.username}`}
                      onClick={() => handleToggleFollow(dj)}
                      disabled={isLoading}
                      className={`flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded font-mono text-xs uppercase tracking-wider font-bold transition-all ${
                        isFollowing
                          ? "bg-[#1e1e24] text-[#e5ff00] border border-[#e5ff00]/40 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40"
                          : "bg-[#e5ff00] text-black hover:bg-[#f2ff44] shadow-[0_0_15px_rgba(229,255,0,0.2)]"
                      } ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <Heart
                        className={`h-3.5 w-3.5 transition-transform group-hover:scale-110 ${
                          isFollowing ? "fill-current" : ""
                        }`}
                      />
                      <span>
                        {isLoading
                          ? "SAVING..."
                          : isFollowing
                          ? "FOLLOWING"
                          : "FOLLOW"}
                      </span>
                      <span className="opacity-70 text-[10px]">
                        • {dj.follower_count}
                      </span>
                    </button>

                    {/* View Channel / Tune In */}
                    <Link
                      id={`btn-tune-in-${dj.username}`}
                      to={`/channel/${dj.username}`}
                      className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded font-mono text-xs uppercase tracking-wider font-bold border transition-colors ${
                        dj.is_live
                          ? "bg-red-600/20 text-red-400 border-red-500/50 hover:bg-red-600 hover:text-white"
                          : "bg-[#141418] text-zinc-300 border-[#27272f] hover:bg-[#202026] hover:text-white"
                      }`}
                    >
                      {dj.is_live ? (
                        <>
                          <Radio className="h-3.5 w-3.5 animate-pulse" />
                          <span>TUNE IN</span>
                        </>
                      ) : (
                        <span>CHANNEL</span>
                      )}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Callout: Become a Resident */}
        <div
          id="become-resident-cta"
          className="mt-12 p-6 rounded-xl border border-dashed border-[#2e2e38] bg-[#0c0c0f] flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-[#e5ff00]/10 border border-[#e5ff00]/30 flex items-center justify-center text-[#e5ff00]">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="font-display text-base font-bold uppercase text-white">
                Are you an Underground DJ or Electronic Producer?
              </div>
              <p className="font-mono text-xs text-zinc-400">
                Broadcast in ultra-low latency, connect your social profiles, build your follower base on Firestore, and monetize with Vinyl Bits.
              </p>
            </div>
          </div>
          <Link
            id="start-broadcasting-btn"
            to="/register"
            className="btn-primary whitespace-nowrap text-xs py-2.5 px-5 font-mono"
          >
            START BROADCASTING
          </Link>
        </div>
      </div>
    </section>
  );
}
