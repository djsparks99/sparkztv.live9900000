import { useEffect, useRef, useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { getToken, setToken, fileUrl, BACKEND, api, getAbsoluteOrigin, apiErrorMessage, DEFAULT_AVATAR } from "@/lib/api";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, addDoc, limit } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { Send, LogIn, User, Smile, Zap, Crown, Shield, Gem, Sparkles, X, Flame, Calendar, Users, Disc, Coins, ChevronRight, Headphones, Search, Volume2, Reply } from "lucide-react";
import { Link } from "react-router-dom";
import FloatingReactions from "./FloatingReactions";
import { toast } from "sonner";

const REACTIONS = [
  { char: "💿", label: "BANGER", color: "hover:border-cyan-500 hover:bg-cyan-500/10 text-cyan-400" },
  { char: "🔥", label: "FIRE", color: "hover:border-[#e5ff00] hover:bg-[#e5ff00]/10 text-[#e5ff00]" },
  { char: "🔊", label: "BASS", color: "hover:border-purple-500 hover:bg-purple-500/10 text-purple-400" },
  { char: "👻", label: "SICK", color: "hover:border-pink-500 hover:bg-pink-500/10 text-pink-400" },
];

function wsUrl(username, token, guestName = "") {
  const httpUrl = BACKEND || getAbsoluteOrigin() || window.location.origin;
  const wsBase = httpUrl.replace(/^http/i, "ws");
  const query = `token=${encodeURIComponent(token)}${guestName ? `&guest_name=${encodeURIComponent(guestName)}` : ""}`;
  return `${wsBase}/api/ws/chat/${encodeURIComponent(username)}?${query}`;
}

export default function ChatPanel({ username, onCollapse }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState("chat"); // "chat" or "listeners"
  const [listenerSearch, setListenerSearch] = useState("");
  const [text, setText] = useLocalStorage(`sparkz_chat_draft_${username}`, "");
  const [replyTo, setReplyTo] = useState(null);
  const [connected, setConnected] = useState(false);
  const [systemLine, setSystemLine] = useState(null);
  
  // Twitch-style profile inspection popup state
  const [inspectUser, setInspectUser] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  
  // Guest Name State (for guests chatting without an account)
  const [guestName, setGuestName] = useState(() => {
    return localStorage.getItem("sparkz_guest_name") || "";
  });
  const [isEditingGuestName, setIsEditingGuestName] = useState(false);
  const [tempGuestName, setTempGuestName] = useState(guestName);
  
  // Watts state
  const [watts, setWatts] = useState(250);
  const [userVinylBits, setUserVinylBits] = useState(0);
  const [accruedNotice, setAccruedNotice] = useState(null);
  const [isHighlight, setIsHighlight] = useState(false);

  // Emotes state
  const [emotes, setEmotes] = useState([]);
  const [showEmotePicker, setShowEmotePicker] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [emoteTab, setEmoteTab] = useState("all"); 
  const [emoteSearch, setEmoteSearch] = useState("");

  // Typing state
  const [typingUsers, setTypingUsers] = useState({});
  const lastTypingSentRef = useRef(0);
  const typingTimerRef = useRef(null);

  const wsRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch chatter profile for the Twitch-style popup card
  const handleInspectChatter = async (targetUsername, senderPhotoUrl = null) => {
    if (!targetUsername) return;
    setInspectLoading(true);
    setInspectUser({ username: targetUsername, display_name: targetUsername, photo_url: senderPhotoUrl });
    try {
      const { data } = await api.get(`/users/profile/${encodeURIComponent(targetUsername)}`);
      if (data) {
        setInspectUser({
          ...data,
          photo_url: data.photo_url || senderPhotoUrl
        });
      }
    } catch {
      // Fallback with basic username if fetch fails
    } finally {
      setInspectLoading(false);
    }
  };

  // Fetch initial messages & Watts balance & Emotes list
  useEffect(() => {
    let cancelled = false;

    api
      .get(`/channels/${username}/messages`, { params: { limit: 100 } })
      .then(({ data }) => {
        if (!cancelled) {
          setMessages(Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : []);
        }
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });

    api
      .get(`/channels/${username}/emotes`)
      .then(({ data }) => {
        if (!cancelled && data?.emotes) {
          setEmotes(data.emotes);
        }
      })
      .catch(() => {});

    if (user) {
      api
        .get("/users/me/watts")
        .then(({ data }) => {
          if (!cancelled && typeof data?.watts === "number") {
            setWatts(data.watts);
          }
        })
        .catch(() => {});

      api
        .get("/users/me/vinyl-bits")
        .then(({ data }) => {
          if (!cancelled && typeof data?.vinyl_bits === "number") {
            setUserVinylBits(data.vinyl_bits);
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [username, user]);

  // Real-Time Firestore Chat Sync
  useEffect(() => {
    if (!username) return;

    const q = query(
      collection(db, "chat_messages"),
      where("channel_username", "==", username),
      orderBy("created_at", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbMsgs = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        dbMsgs.push({
          id: doc.id,
          text: d.text,
          sender_uid: d.sender_uid || "",
          sender_username: d.sender_username || "guest",
          sender_display_name: d.sender_display_name || "Guest Selector",
          sender_photo_url: d.sender_photo_url || null,
          created_at: d.created_at || new Date().toISOString(),
          is_highlighted: d.is_highlighted || false,
          highlight_type: d.highlight_type || "",
          sender_badges: d.sender_badges || [],
          sender_color: d.sender_color || "",
          is_system_command: d.is_system_command || false,
        });
      });

      if (dbMsgs.length > 0) {
        setMessages((prev) => {
          const prevList = Array.isArray(prev) ? prev : [];
          const merged = [...prevList];
          dbMsgs.forEach((msg) => {
            if (!merged.some((m) => m.id === msg.id)) {
              merged.push(msg);
            }
          });
          return merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });
      }
    }, (error) => {
      console.warn("Firestore chat listener warning:", error);
    });

    return () => unsubscribe();
  }, [username]);

  const saveGuestName = (e) => {
    e?.preventDefault();
    const clean = tempGuestName.trim().slice(0, 24);
    if (clean) {
      setGuestName(clean);
      localStorage.setItem("sparkz_guest_name", clean);
    }
    setIsEditingGuestName(false);
  };

  const handleDropVinylBits = async (amount) => {
    if (!user) {
      toast.error("Please log in to support the streamer with Vinyl Bits!");
      return;
    }
    try {
      const { data } = await api.post(`/channels/${username}/vinyl-bits/drop`, { amount });
      setUserVinylBits(data.vinyl_bits);
      toast.success(`Dropped ${amount} Vinyl Bits! 💿✨`);
    } catch (err) {
      toast.error(apiErrorMessage(err) || "Failed to drop Vinyl Bits.");
    }
  };

  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(async () => {
      try {
        if (user) {
          const { data } = await api.post(`/channels/${username}/watts/ping`);
          if (data && typeof data.watts === "number") {
            setWatts(data.watts);
            if (data.accrued > 0) {
              setAccruedNotice(`+${data.accrued}  WATTS ACCRUED`);
              setTimeout(() => setAccruedNotice(null), 3000);
            }
          }
        } else {
          setWatts((prev) => prev + 15);
          setAccruedNotice(`+15  WATTS ACCRUED`);
          setTimeout(() => setAccruedNotice(null), 3000);
        }
      } catch {}
    }, 10000);

    return () => clearInterval(interval);
  }, [username, user, connected]);

  useEffect(() => {
    if (!username) return;
    let active = true;
    let ws = null;
    let reconnectTimeout = null;
    let retryCount = 0;

    const connect = async () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      
      let token = getToken();
      if (!token && user && auth?.currentUser) {
        try {
          token = await auth.currentUser.getIdToken();
          if (token) setToken(token);
        } catch {}
      }
      token = token || "guest";
      if (!active) return;

      const url = wsUrl(username, token, !user ? guestName : "");
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!active) {
          ws.close();
          return;
        }
        setConnected(true);
        retryCount = 0;
      };

      ws.onclose = (event) => {
        if (!active) return;
        setConnected(false);
        wsRef.current = null;
        
        const backoff = Math.min(10000, 1000 * Math.pow(2, retryCount));
        retryCount++;
        
        reconnectTimeout = setTimeout(() => {
          if (active) connect();
        }, backoff);
      };

      ws.onerror = (err) => {
        if (ws) {
          try { ws.close(); } catch {}
        }
      };

      ws.onmessage = (ev) => {
        if (!active) return;
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "message") {
            setMessages((prev) => {
              const list = Array.isArray(prev) ? prev : [];
              if (list.some((m) => m.id === data.id)) return list;
              return [
                ...list,
                {
                  id: data.id,
                  text: data.text,
                  sender_uid: data.sender_uid,
                  sender_username: data.sender_username,
                  sender_display_name: data.sender_display_name,
                  sender_photo_url: data.sender_photo_url,
                  created_at: data.created_at,
                  is_highlighted: data.is_highlighted,
                  highlight_type: data.highlight_type,
                  sender_badges: data.sender_badges,
                  sender_color: data.sender_color,
                  is_system_command: data.is_system_command,
                },
              ];
            });

            if (data.sender_uid) {
              setTypingUsers((prev) => {
                if (!prev[data.sender_uid]) return prev;
                const next = { ...prev };
                if (next[data.sender_uid]?.timeout) clearTimeout(next[data.sender_uid].timeout);
                delete next[data.sender_uid];
                return next;
              });
            }

            if (typeof data.user_watts === "number" && user && data.sender_uid === user.uid) {
              setWatts(data.user_watts);
            }
          } else if (data.type === "typing") {
            if (data.is_typing) {
              setTypingUsers((prev) => {
                const next = { ...prev };
                if (next[data.uid]?.timeout) clearTimeout(next[data.uid].timeout);
                const timeout = setTimeout(() => {
                  setTypingUsers((current) => {
                    const copy = { ...current };
                    delete copy[data.uid];
                    return copy;
                  });
                }, 3500);
                next[data.uid] = {
                  username: data.username,
                  displayName: data.display_name || data.username,
                  timeout,
                };
                return next;
              });
            } else {
              setTypingUsers((prev) => {
                const next = { ...prev };
                if (next[data.uid]?.timeout) clearTimeout(next[data.uid].timeout);
                delete next[data.uid];
                return next;
              });
            }
          } else if (data.type === "system") {
            setSystemLine(data.message);
            setTimeout(() => setSystemLine(null), 6000);
          } else if (data.type === "reaction") {
            window.dispatchEvent(
              new CustomEvent("stream-reaction", {
                detail: { reaction: data.reaction, sender: data.sender_username }
              })
            );
          }
        } catch {}
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        try { ws.close(); } catch {}
      }
      wsRef.current = null;
    };
  }, [username, user, guestName]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, systemLine]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setText(val);

    if (wsRef.current && wsRef.current.readyState === 1) {
      const now = Date.now();
      if (val.trim().length > 0) {
        if (now - lastTypingSentRef.current > 2000) {
          wsRef.current.send(
            JSON.stringify({
              type: "typing",
              is_typing: true,
              sender_display_name: user?.display_name || null,
              sender_username: user?.username || null,
              sender_photo_url: user?.photo_url || user?.photoUrl || null,
            })
          );
          lastTypingSentRef.current = now;
        }

        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === 1) {
            wsRef.current.send(
              JSON.stringify({
                type: "typing",
                is_typing: false,
                sender_display_name: user?.display_name || null,
                sender_username: user?.username || null,
                sender_photo_url: user?.photo_url || user?.photoUrl || null,
              })
            );
          }
          lastTypingSentRef.current = 0;
        }, 2500);
      } else {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        wsRef.current.send(
          JSON.stringify({
            type: "typing",
            is_typing: false,
            sender_display_name: user?.display_name || null,
            sender_username: user?.username || null,
            sender_photo_url: user?.photo_url || user?.photoUrl || null,
          })
        );
        lastTypingSentRef.current = 0;
      }
    }
  };

  const sendReaction = (reactionEmoji) => {
    if (!wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(
      JSON.stringify({
        type: "reaction",
        reaction: reactionEmoji,
      })
    );
  };

  const send = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;

    // Send via WebSocket if open
    if (wsRef.current && wsRef.current.readyState === 1) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      wsRef.current.send(
        JSON.stringify({
          type: "typing",
          is_typing: false,
          sender_display_name: user?.display_name || null,
          sender_username: user?.username || null,
          sender_photo_url: user?.photo_url || user?.photoUrl || null,
        })
      );
      lastTypingSentRef.current = 0;

      wsRef.current.send(
        JSON.stringify({
          text: t,
          is_highlighted: isHighlight,
          highlight_type: "neon_glow",
          sender_display_name: user?.display_name || null,
          sender_username: user?.username || null,
          sender_photo_url: user?.photo_url || user?.photoUrl || null,
          parent_message_id: replyTo?.id || null,
          parent_message_text: replyTo?.text || null,
          parent_message_sender: replyTo?.sender_display_name || replyTo?.sender_username || null,
        })
      );
    }

    // Always write to Firestore to fully integrate real-time collections and provide 100% reliability
    const messagePayload = {
      channel_username: username,
      text: t,
      sender_uid: user?.uid || "guest",
      sender_username: user?.username || guestName || "Guest Selector",
      sender_display_name: user?.display_name || guestName || "Guest Selector",
      created_at: new Date().toISOString(),
      is_highlighted: isHighlight,
      highlight_type: isHighlight ? "neon_glow" : "",
      sender_photo_url: user?.photo_url || user?.photoUrl || null,
    };

    addDoc(collection(db, "chat_messages"), messagePayload)
      .then(() => {
        // Written to Firestore successfully
      })
      .catch((err) => {
        console.warn("Firestore message write warning:", err);
      });

    if (isHighlight) {
      setWatts((prev) => Math.max(0, prev - 50));
      setIsHighlight(false);
    }

    setText("");
    setReplyTo(null);
    setShowEmotePicker(false);
  };

  const handleEmoteSelect = (emoteCode) => {
    setText((prev) => (prev ? `${prev} ${emoteCode}` : emoteCode));
    setShowEmotePicker(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const filteredEmotes = emotes.filter((e) => {
    const matchesSearch =
      !emoteSearch ||
      e.code.toLowerCase().includes(emoteSearch.toLowerCase()) ||
      e.name.toLowerCase().includes(emoteSearch.toLowerCase());

    if (emoteTab === "channel") {
      return matchesSearch && e.channel_username.toLowerCase() === username.toLowerCase();
    }
    if (emoteTab === "global") {
      return matchesSearch && e.channel_username === "global";
    }
    return matchesSearch;
  });

  // Get unique list of chatters from messages to build a real live list of listeners
  const uniqueChatters = [];
  const seenChatters = new Set();

  // Add the current viewer (user or guest)
  if (user) {
    const currentUsername = user.username || user.displayName || "viewer";
    seenChatters.add(currentUsername.toLowerCase());
    uniqueChatters.push({
      username: currentUsername,
      display_name: user.display_name || user.displayName || currentUsername,
      photo_url: user.photo_url || user.photoURL,
      badges: ["supporter"],
      color: "#e5ff00",
      isReal: true,
      listeningStatus: "Watching Stream Live 🎧",
      quality: "320kbps AAC",
      latency: "12ms"
    });
  } else if (guestName) {
    seenChatters.add(guestName.toLowerCase());
    uniqueChatters.push({
      username: guestName,
      display_name: `${guestName} (Guest)`,
      photo_url: null,
      badges: [],
      color: "#a1a1aa",
      isReal: true,
      listeningStatus: "Listening as Guest 🎧",
      quality: "192kbps AAC",
      latency: "45ms"
    });
  }

  if (Array.isArray(messages)) {
    messages.forEach((m) => {
      if (
        m.sender_username &&
        !seenChatters.has(m.sender_username.toLowerCase()) &&
        m.sender_username !== "sparkz_bot" &&
        m.sender_username !== "system-bot"
      ) {
        seenChatters.add(m.sender_username.toLowerCase());
        uniqueChatters.push({
          username: m.sender_username,
          display_name: m.sender_display_name || m.sender_username,
          photo_url: m.sender_photo_url,
          badges: m.sender_badges || [],
          color: m.sender_color,
          isReal: true,
          listeningStatus: "Listening to Live Feed 🎧",
          quality: "320kbps AAC",
          latency: "24ms"
        });
      }
    });
  }

  // Search filter
  const searchedListeners = uniqueChatters.filter(
    (l) =>
      l.username.toLowerCase().includes(listenerSearch.toLowerCase()) ||
      l.display_name.toLowerCase().includes(listenerSearch.toLowerCase()) ||
      l.listeningStatus.toLowerCase().includes(listenerSearch.toLowerCase())
  );

  return (
    <div
      data-testid="chat-panel"
      className="relative flex h-full flex-col border border-[#27272a] bg-[#0e0e10]"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#27272a] px-3 py-2 bg-[#0d0d0e]">
        <div className="flex items-center gap-2">
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="text-zinc-400 hover:text-[#e5ff00] transition-colors p-1 hover:bg-zinc-800/40"
              title="Collapse Chat"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          <Users className="h-4 w-4 text-zinc-400" />
        </div>

        <span className="font-display font-black text-white text-xs uppercase tracking-wider">Stream Chat</span>

        <div className="flex items-center gap-1.5">
          <div
            data-testid="watts-counter"
            className="inline-flex items-center gap-1 border border-[#27272a] bg-black px-2 py-0.5 font-mono text-[10px] uppercase font-bold text-[#e5ff00]"
          >
            <Zap className="h-3 w-3 fill-[#e5ff00]" />
            <span>{watts} WATTS</span>
          </div>
        </div>
      </header>
      
      {/* Tab switcher: Chat vs Vibers/Listeners */}
      <div className="flex border-b border-[#27272a] bg-[#09090b] text-[10px] font-mono uppercase tracking-wider shrink-0">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2 text-center font-bold border-r border-[#27272a] transition-all ${
            activeTab === "chat" ? "bg-black text-[#e5ff00]" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Stream Chat
        </button>
        <button
          onClick={() => setActiveTab("listeners")}
          className={`flex-1 py-2 text-center font-bold transition-all relative flex items-center justify-center gap-1.5 ${
            activeTab === "listeners" ? "bg-black text-[#00f6ff]" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Disc className={`h-3 w-3 ${activeTab === "listeners" ? "animate-spin text-[#00f6ff]" : ""}`} />
          Who's Listening ({uniqueChatters.length})
        </button>
      </div>

      {activeTab === "chat" ? (
        /* Message List */
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 scrollbar-thin relative">
          <FloatingReactions position="right" />
          {(!Array.isArray(messages) || messages.length === 0) && !systemLine && (
            <div className="py-12 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-zinc-700 mb-2" />
              <div className="font-mono text-xs uppercase tracking-widest text-zinc-500">
                // NO SIGNAL YET — BE THE FIRST TO SHOUT
              </div>
              <p className="mt-1 font-mono text-[10px] text-zinc-600">
                Earn +15 Watts every 10 seconds active in chat!
              </p>
            </div>
          )}

          {(() => {
            const rootMessages = [];
            const replyMap = new Map();

            if (Array.isArray(messages)) {
              messages.forEach((m) => {
                if (m.parent_message_id) {
                  if (!replyMap.has(m.parent_message_id)) {
                    replyMap.set(m.parent_message_id, []);
                  }
                  replyMap.get(m.parent_message_id).push(m);
                }
              });

              messages.forEach((m) => {
                if (!m.parent_message_id) {
                  rootMessages.push(m);
                } else {
                  const parentExists = messages.some((parent) => parent.id === m.parent_message_id);
                  if (!parentExists) {
                    rootMessages.push(m);
                  }
                }
              });
            }

            return rootMessages.map((m) => {
              const replies = replyMap.get(m.id) || [];
              return (
                <div key={m.id || Math.random()} className="space-y-2 mb-3">
                  <ChatMessage
                    m={m}
                    emotes={emotes}
                    onInspectUser={handleInspectChatter}
                    onReply={(msg) => {
                      setReplyTo(msg);
                      if (inputRef.current) inputRef.current.focus();
                    }}
                  />
                  {replies.length > 0 && (
                    <div className="pl-4 ml-5 border-l border-zinc-850 space-y-2 mt-1.5">
                      {replies.map((reply) => (
                        <ChatMessage
                          key={reply.id || Math.random()}
                          m={reply}
                          emotes={emotes}
                          onInspectUser={handleInspectChatter}
                          onReply={(msg) => {
                            setReplyTo(msg);
                            if (inputRef.current) inputRef.current.focus();
                          }}
                          isReply={true}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()}

          {systemLine && (
            <div className="border border-[#e5ff00]/40 bg-[#e5ff00]/5 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-[#e5ff00]">
              {systemLine}
            </div>
          )}
        </div>
      ) : (
        /* Who's Listening List */
        <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0c]">
          {/* Search bar inside the Tab */}
          <div className="p-3 border-b border-[#27272a] bg-[#0c0c0e] flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search listeners or track vibes..."
              className="bg-black border border-[#27272a] hover:border-zinc-800 focus:border-[#00f6ff] px-2.5 py-1 text-[10px] text-white focus:outline-none flex-1 rounded-sm font-mono uppercase placeholder-zinc-600 transition-all"
              value={listenerSearch}
              onChange={(e) => setListenerSearch(e.target.value)}
            />
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
            {searchedListeners.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto h-6 w-6 text-zinc-800 mb-2" />
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  No matching listeners found
                </div>
              </div>
            ) : (
              searchedListeners.map((listener) => (
                <div
                  key={listener.username}
                  onClick={() => handleInspectChatter(listener.username, listener.photo_url)}
                  className="flex items-center gap-2.5 p-2 bg-black/40 border border-[#27272a]/80 hover:border-[#00f6ff]/40 hover:bg-[#00f6ff]/5 transition-all duration-200 rounded-sm cursor-pointer group"
                >
                  {/* Avatar with dynamic live glow */}
                  <div className="relative">
                    <img
                      src={listener.photo_url ? fileUrl(listener.photo_url) : DEFAULT_AVATAR}
                      alt=""
                      className="h-8 w-8 object-cover border border-zinc-800 rounded-sm group-hover:border-[#00f6ff] transition-all"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-mono text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: listener.color || "#e5ff00" }}
                      >
                        {listener.display_name}
                      </span>
                      <BadgeFlares badges={listener.badges} />
                    </div>

                    {/* What they are listening to/vibing to */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Headphones className="h-3 w-3 text-cyan-400 shrink-0" />
                      <span className="font-mono text-[9px] text-zinc-300 truncate tracking-wide leading-tight">
                        {listener.listeningStatus}
                      </span>
                    </div>

                    {/* Technical Stream details - Hardware feel */}
                    <div className="flex items-center gap-2 mt-1 text-[8px] font-mono text-zinc-600 uppercase">
                      <span className="flex items-center gap-0.5">
                        <Volume2 className="h-2.5 w-2.5 text-zinc-600" /> {listener.quality}
                      </span>
                      <span>•</span>
                      <span>Lat: {listener.latency}</span>
                    </div>
                  </div>
                  
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-[#00f6ff] group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Twitch-Style Chatter Profile Inspect Card Modal */}
      {inspectUser && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setInspectUser(null)}
        >
          <div
            className="w-full max-w-xs border border-[#e5ff00]/50 bg-[#0c0c0e] p-4 shadow-[0_0_25px_rgba(229,255,0,0.15)] rounded-sm relative"
            onClick={(e) => e.stopPropagation()}
            data-testid="chatter-profile-card"
          >
            <button
              onClick={() => setInspectUser(null)}
              className="absolute top-3 right-3 text-zinc-400 hover:text-[#e5ff00]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#27272a] pb-3">
              <img
                src={
                  (inspectUser.photo_url || inspectUser.photoUrl || inspectUser.avatar || inspectUser.sender_photo_url)
                    ? fileUrl(inspectUser.photo_url || inspectUser.photoUrl || inspectUser.avatar || inspectUser.sender_photo_url)
                    : DEFAULT_AVATAR
                }
                alt=""
                className="h-12 w-12 border border-[#e5ff00] object-cover rounded-sm"
              />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs font-bold uppercase text-white truncate">
                  {inspectUser.display_name || inspectUser.username}
                </div>
                <div className="font-mono text-[10px] text-zinc-400 truncate">
                  @{inspectUser.username}
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2 font-mono text-[11px]">
              {inspectUser.bio && (
                <div className="text-zinc-300 italic text-[10px] border-l-2 border-[#e5ff00] pl-2 py-0.5">
                  &ldquo;{inspectUser.bio}&rdquo;
                </div>
              )}

              <div className="flex items-center justify-between text-zinc-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-[#e5ff00]" /> Watts Balance:
                </span>
                <span className="font-bold text-[#e5ff00]">{inspectUser.watts ?? 100}</span>
              </div>

              <div className="flex items-center justify-between text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3 w-3 text-cyan-400" /> Followers:
                </span>
                <span className="font-bold text-white">{inspectUser.followers_count ?? 0}</span>
              </div>

              <div className="flex items-center justify-between text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-zinc-500" /> Joined:
                </span>
                <span className="text-[10px] text-zinc-300">
                  {inspectUser.created_at ? new Date(inspectUser.created_at).toLocaleDateString() : "Recent"}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#27272a] flex justify-end">
              <Link
                to={`/channel/${inspectUser.username}`}
                onClick={() => setInspectUser(null)}
                className="w-full text-center btn-primary py-1.5 text-[10px] uppercase font-bold"
              >
                VISIT CHANNEL
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Reaction Picker Popover */}
      {showReactionPicker && (
        <div
          data-testid="reaction-picker-popover"
          className="absolute bottom-16 right-3 z-30 border border-[#27272a] bg-[#050505] p-2.5 shadow-2xl rounded-sm max-w-[240px] animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-[#27272a] pb-1.5 mb-2">
            <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-zinc-400">
              SELECT REACTION
            </span>
            <button
              type="button"
              onClick={() => setShowReactionPicker(false)}
              className="text-zinc-500 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {REACTIONS.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => {
                  sendReaction(r.char);
                  setShowReactionPicker(false);
                }}
                disabled={!connected}
                title={r.label}
                className={`flex items-center gap-1 border border-zinc-800 bg-zinc-950 px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase transition-all duration-150 active:scale-90 ${r.color} ${
                  !connected ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <span className="text-xs leading-none">{r.char}</span>
                <span className="text-[8px] font-mono tracking-wider">{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Emote Picker Popover */}
      {showEmotePicker && (
        <div
          data-testid="emote-picker-popover"
          className="absolute bottom-16 right-3 left-3 z-30 border border-[#27272a] bg-[#050505] p-3 shadow-2xl rounded-sm"
        >
          <div className="flex items-center justify-between border-b border-[#27272a] pb-2">
            <div className="flex items-center gap-2">
              <Smile className="h-3.5 w-3.5 text-[#e5ff00]" />
              <span className="font-mono text-[10px] uppercase tracking-widest font-bold text-white">
                EMOTE VAULT
              </span>
            </div>
            <button
              onClick={() => setShowEmotePicker(false)}
              className="text-zinc-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="flex gap-1 border border-[#27272a] bg-black p-0.5 font-mono text-[9px] uppercase">
              <button
                type="button"
                onClick={() => setEmoteTab("all")}
                className={`px-2 py-0.5 ${
                  emoteTab === "all" ? "bg-[#e5ff00] text-black font-bold" : "text-zinc-400"
                }`}
              >
                ALL
              </button>
              <button
                type="button"
                onClick={() => setEmoteTab("channel")}
                className={`px-2 py-0.5 ${
                  emoteTab === "channel" ? "bg-[#e5ff00] text-black font-bold" : "text-zinc-400"
                }`}
              >
                CHANNEL
              </button>
              <button
                type="button"
                onClick={() => setEmoteTab("global")}
                className={`px-2 py-0.5 ${
                  emoteTab === "global" ? "bg-[#e5ff00] text-black font-bold" : "text-zinc-400"
                }`}
              >
                GLOBAL
              </button>
            </div>
            <input
              className="input-terminal flex-1 py-1 text-[10px]"
              placeholder="Search emote..."
              value={emoteSearch}
              onChange={(e) => setEmoteSearch(e.target.value)}
            />
          </div>

          <div className="mt-3 grid max-h-40 grid-cols-5 gap-2 overflow-y-auto p-1 scrollbar-thin">
            {filteredEmotes.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => handleEmoteSelect(e.code)}
                className="flex flex-col items-center justify-center border border-[#27272a] bg-black p-1.5 hover:border-[#e5ff00] transition-colors rounded-sm group"
                title={`${e.name} (${e.code})`}
              >
                <img
                  src={e.image_url.startsWith("http") ? e.image_url : fileUrl(e.image_url)}
                  alt={e.code}
                  className="h-7 w-7 object-contain group-hover:scale-110 transition-transform"
                />
                <span className="mt-1 font-mono text-[8px] text-zinc-400 group-hover:text-[#e5ff00] truncate max-w-full">
                  {e.code}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Typing Indicator Bar */}
      {Object.keys(typingUsers).length > 0 && (
        <div
          className="px-3 py-1 bg-[#0d0d10] border-t border-[#27272a] text-[10px] font-mono flex items-center gap-1.5"
          data-testid="chat-typing-indicator"
        >
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e5ff00] animate-ping" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#e5ff00] animate-bounce" />
          </div>
          <span className="text-[#e5ff00] font-bold">
            {Object.values(typingUsers)
              .map((u) => u.displayName || u.username)
              .join(", ")}
          </span>
          <span className="text-zinc-400">
            {Object.keys(typingUsers).length === 1 ? "is typing..." : "are typing..."}
          </span>
        </div>
      )}

      {/* Input Bar */}
      <footer className="border-t border-[#27272a] p-3 bg-[#0a0a0a]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setIsHighlight(!isHighlight)}
              disabled={watts < 50}
              data-testid="toggle-highlight-btn"
              className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] uppercase font-bold tracking-wider transition-all rounded-sm ${
                isHighlight
                  ? "border-[#e5ff00] bg-[#e5ff00] text-black shadow-[0_0_12px_rgba(229,255,0,0.6)]"
                  : watts >= 50
                  ? "border-[#27272a] text-[#e5ff00] hover:border-[#e5ff00] bg-black hover:bg-zinc-900"
                  : "border-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed bg-black/40"
              }`}
            >
              <Flame className={`h-3 w-3 ${isHighlight ? "animate-pulse" : ""}`} />
              <span>HIGH VOLTAGE SHOUT (50)</span>
            </button>

            {!user ? (
              <div className="flex items-center gap-1 text-zinc-400">
                <span className="border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-bold text-emerald-400 text-[9px] uppercase rounded-xs">
                  UNLOCKED (GUEST)
                </span>
                {isEditingGuestName ? (
                  <form onSubmit={saveGuestName} className="flex items-center gap-1">
                    <input
                      className="bg-black border border-[#e5ff00] px-1 py-0.5 text-[10px] text-white focus:outline-none w-24"
                      value={tempGuestName}
                      onChange={(e) => setTempGuestName(e.target.value)}
                      placeholder="Guest Name"
                      autoFocus
                    />
                    <button type="submit" className="text-[#e5ff00] hover:underline font-bold text-[9px]">
                      SAVE
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setTempGuestName(guestName);
                      setIsEditingGuestName(true);
                    }}
                    className="hover:text-[#e5ff00] text-zinc-400 underline text-[9px] uppercase"
                  >
                    Name: {guestName || "Guest"}
                  </button>
                )}
              </div>
            ) : (
              <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
                EARN 15 / 10S
              </span>
            )}
          </div>

          {replyTo && (
            <div className="flex items-center justify-between border border-[#e5ff00]/40 bg-[#e5ff00]/5 px-2 py-1.5 rounded-sm text-[10px] font-mono animate-fade-in">
              <div className="flex items-center gap-1.5 text-zinc-300 min-w-0">
                <Reply className="h-3 w-3 text-[#e5ff00] shrink-0" />
                <span className="shrink-0 uppercase font-bold text-[#e5ff00]">REPLYING TO</span>
                <span className="shrink-0 text-white font-mono font-bold">@{replyTo.sender_display_name || replyTo.sender_username}</span>
                <span className="text-zinc-500 truncate italic">"{replyTo.text}"</span>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-zinc-500 hover:text-[#e5ff00] p-1 transition-colors ml-2 shrink-0"
                title="Cancel Reply"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={send} className="flex gap-2" data-testid="chat-form">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                data-testid="chat-input"
                className={`input-terminal w-full pr-14 ${
                  isHighlight ? "border-[#e5ff00] bg-[#e5ff00]/10 text-white font-bold" : ""
                }`}
                value={text}
                onChange={handleInputChange}
                placeholder={
                  isHighlight
                    ? "SHOUT WITH HIGH VOLTAGE GLOW..."
                    : "SHOUT INTO CHAT..."
                }
                maxLength={500}
                disabled={!connected}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReactionPicker(!showReactionPicker);
                    setShowEmotePicker(false);
                  }}
                  className={`text-zinc-400 hover:text-[#e5ff00] transition-colors ${
                    showReactionPicker ? "text-[#e5ff00]" : ""
                  }`}
                  title="Send Quick Reaction"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmotePicker(!showEmotePicker);
                    setShowReactionPicker(false);
                  }}
                  className={`text-zinc-400 hover:text-[#e5ff00] transition-colors ${
                    showEmotePicker ? "text-[#e5ff00]" : ""
                  }`}
                  title="Insert Emote"
                >
                  <Smile className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <button
              data-testid="chat-send"
              type="submit"
              className={`btn-primary ${isHighlight ? "bg-[#e5ff00] text-black hover:bg-[#c8de00]" : ""}`}
              disabled={!connected || !text.trim()}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}

function ChatMessage({ m, emotes, onInspectUser, onReply, isReply = false }) {
  const isHighVoltage = m.is_highlighted;
  const isSystemCommand = m.is_system_command || m.sender_uid === "system-bot" || m.sender_username === "sparkz_bot";

  const renderMessageContent = (text, emoteList) => {
    if (!text) return null;
    if (!emoteList || emoteList.length === 0) return text;

    const emoteMap = new Map();
    emoteList.forEach((e) => emoteMap.set(e.code, e));

    const parts = text.split(/(:[a-zA-Z0-9_]+:)/g);

    return parts.map((part, idx) => {
      if (emoteMap.has(part)) {
        const e = emoteMap.get(part);
        const url = e.image_url.startsWith("http") ? e.image_url : fileUrl(e.image_url);
        return (
          <img
            key={idx}
            src={url}
            alt={e.code}
            title={e.name || e.code}
            className="inline-block h-5 w-5 mx-0.5 object-contain align-middle rounded-sm shadow-sm hover:scale-125 transition-transform"
          />
        );
      }
      return part;
    });
  };

  if (m.highlight_type === "vinyl_bits_drop") {
    return (
      <div className="relative overflow-hidden p-3.5 my-3 border border-dashed animate-flash-yellow rounded-sm font-mono text-xs">
        <div className="absolute top-0 right-0 p-3 opacity-15 pointer-events-none">
          <Disc className="h-10 w-10 text-[#e5ff00] animate-spin" />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-5 w-5 items-center justify-center border border-[#e5ff00] bg-[#e5ff00] rounded-xs animate-bounce">
            <Disc className="h-3 w-3 text-black" />
          </div>
          <span className="text-[9px] uppercase font-black text-[#e5ff00] tracking-widest">
            SPARKZ // VINYL BITS ALERT!
          </span>
        </div>
        <div className="text-zinc-100 font-bold leading-relaxed text-xs">
          <span className="text-[#e5ff00] uppercase font-black">@{m.donor_username || "Someone"}</span> supported with <span className="inline-flex items-center gap-1 border border-[#e5ff00]/40 bg-[#e5ff00]/25 px-1.5 py-0.5 text-[11px] text-white font-black rounded-xs">💿 {m.vinyl_bits_amount} VINYL BITS</span>
        </div>
        <div className="text-[8px] text-zinc-500 uppercase mt-1">
          100% OF FUNDS GO DIRECTLY TO STREAMER!
        </div>
      </div>
    );
  }

  if (isSystemCommand) {
    return (
      <div className="relative overflow-hidden p-3 my-2 border border-[#e5ff00] bg-black/60 shadow-[0_0_15px_rgba(229,255,0,0.15)] rounded-sm font-mono text-xs">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex h-5 w-5 items-center justify-center border border-[#e5ff00] bg-[#e5ff00]/10 rounded-xs">
            <Sparkles className="h-3 w-3 text-[#e5ff00] animate-pulse" />
          </div>
          <span className="text-[9px] uppercase font-bold text-[#e5ff00] tracking-widest">
            SPARKZ ALERT // SYSTEM BOT
          </span>
        </div>
        <div className="text-zinc-100 font-bold leading-relaxed">
          {renderMessageContent(m.text, emotes)}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex items-start gap-2.5 p-1.5 transition-all rounded-sm ${
        isHighVoltage
          ? "border border-[#e5ff00] bg-gradient-to-r from-[#e5ff00]/15 via-[#e5ff00]/5 to-transparent shadow-[0_0_15px_rgba(229,255,0,0.2)]"
          : "hover:bg-white/5"
      } ${isReply ? "bg-[#0c0c0e]/40 border-l border-[#e5ff00]/30 pl-2" : ""}`}
    >
      {/* Reply Icon on Hover */}
      {onReply && !isSystemCommand && (
        <div className="absolute right-2 top-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center bg-[#121214] border border-[#27272a] p-1 rounded-sm shadow-md z-10">
          <button
            type="button"
            onClick={() => onReply(m)}
            className="p-1 text-zinc-400 hover:text-[#e5ff00] hover:bg-white/5 rounded-xs transition-colors cursor-pointer"
            title="Reply directly"
          >
            <Reply className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <img
        src={m.sender_photo_url ? fileUrl(m.sender_photo_url) : DEFAULT_AVATAR}
        alt=""
        className={`h-7 w-7 flex-shrink-0 border object-cover grayscale-0 md:grayscale rounded-sm ${
          isHighVoltage ? "border-[#e5ff00]" : "border-[#27272a]"
        }`}
      />

      <div className="min-w-0 flex-1">
        {m.parent_message_id && !isReply && (
          <div className="flex items-center gap-1 text-[9px] text-zinc-400 bg-zinc-900/60 px-1.5 py-0.5 rounded-sm mb-1.5 font-mono max-w-max border border-zinc-800">
            <Reply className="h-2.5 w-2.5 text-zinc-500 shrink-0" />
            <span className="text-[#e5ff00]">@{m.parent_message_sender}</span>:
            <span className="truncate max-w-[150px] italic">"{m.parent_message_text}"</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <BadgeFlares badges={m.sender_badges} />

          {/* Clickable Chatter Username to inspect profile */}
          <button
            type="button"
            onClick={() => onInspectUser(m.sender_username, m.sender_photo_url)}
            className="truncate font-mono text-[11px] font-bold uppercase tracking-widest hover:underline cursor-pointer text-left"
            style={{ color: m.sender_color || "#e5ff00" }}
            title="Click to inspect chatter profile"
          >
            {m.sender_display_name}
          </button>

          <span className="truncate font-mono text-[10px] text-zinc-500">
            @{m.sender_username}
          </span>

          {isHighVoltage && (
            <span className="inline-flex items-center gap-1 border border-[#e5ff00] bg-[#e5ff00] px-1.5 py-0.2 font-mono text-[8px] uppercase font-black text-black tracking-widest rounded-xs">
              <Zap className="h-2.5 w-2.5 fill-black" /> VOLTAGE
            </span>
          )}
        </div>

        <div
          className={`mt-1 break-words font-mono text-xs leading-relaxed ${
            isHighVoltage ? "font-bold text-white text-[13px] drop-shadow-md" : "text-zinc-200"
          }`}
        >
          {renderMessageContent(m.text, emotes)}
        </div>
      </div>
    </div>
  );
}

function BadgeFlares({ badges }) {
  if (!Array.isArray(badges) || badges.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {badges.includes("guest") && (
        <span className="inline-flex items-center gap-0.5 border border-zinc-700 bg-zinc-800/80 px-1 py-0.2 font-mono text-[8px] uppercase font-bold text-zinc-300 rounded-xs">
          <User className="h-2.5 w-2.5" /> GUEST
        </span>
      )}
      {badges.includes("broadcaster") && (
        <span className="inline-flex items-center gap-0.5 border border-[#e5ff00] bg-[#e5ff00]/15 px-1 py-0.2 font-mono text-[8px] uppercase font-bold text-[#e5ff00] rounded-xs">
          <Crown className="h-2.5 w-2.5 fill-[#e5ff00]" /> HOST
        </span>
      )}
      {badges.includes("mod") && (
        <span className="inline-flex items-center gap-0.5 border border-emerald-400 bg-emerald-500/15 px-1 py-0.2 font-mono text-[8px] uppercase font-bold text-emerald-400 rounded-xs">
          <Shield className="h-2.5 w-2.5 fill-emerald-400" /> MOD
        </span>
      )}
      {badges.includes("vip") && (
        <span className="inline-flex items-center gap-0.5 border border-fuchsia-400 bg-fuchsia-500/15 px-1 py-0.2 font-mono text-[8px] uppercase font-bold text-fuchsia-400 rounded-xs">
          <Gem className="h-2.5 w-2.5 fill-fuchsia-400" /> VIP
        </span>
      )}
      {badges.includes("supporter") && (
        <span className="inline-flex items-center gap-0.5 border border-cyan-400 bg-cyan-500/15 px-1 py-0.2 font-mono text-[8px] uppercase font-bold text-cyan-400 rounded-xs">
          <Zap className="h-2.5 w-2.5 fill-cyan-400" /> SUPPORTER
        </span>
      )}
      {badges.includes("pro") && (
        <span className="inline-flex items-center gap-0.5 border border-[#e5ff00] bg-black text-[#e5ff00] px-1 py-0.2 font-mono text-[8px] uppercase font-bold rounded-xs shadow-[0_0_8px_rgba(229,255,0,0.4)]">
          <Sparkles className="h-2.5 w-2.5 animate-pulse" /> PRO
        </span>
      )}
      {badges.includes("subscriber") && (
        <span className="inline-flex items-center gap-0.5 border border-purple-400 bg-purple-500/15 px-1 py-0.2 font-mono text-[8px] uppercase font-bold text-purple-400 rounded-xs">
          <Crown className="h-2.5 w-2.5" /> SUB
        </span>
      )}
    </div>
  );
}