import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  orderBy,
  query,
} from "firebase/firestore";
import {
  ArrowLeft,
  Calendar,
  User,
  Tag,
  BookOpen,
  Plus,
  X,
  FileText,
  Send,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

// Firestore Error handler exact specification from skill instructions
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
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Pre-populated default core launch blog posts
const DEFAULT_LAUNCH_POSTS = [
  {
    id: "launch-origin-mission",
    title: "Who We Are, What We Do, and Why We Built SPARKZ.TV",
    slug: "who-we-are-what-we-do-and-why-we-built-sparkztv",
    summary: "We built an independent, uncompromised live video streaming platform dedicated entirely to sound-system culture and underground electronic music. Here is our story and why mainstream platforms no longer serve us.",
    author: "DJ Sparkz",
    author_title: "Founder & Lead Developer",
    published_at: "2026-08-13T18:00:00Z",
    tags: ["MISSION", "UNDERGROUND", "SYSTEM-CULTURE"],
    content: `## Who We Are
We are independent live DJs, selectors, sound engineers, and sound-system culture enthusiasts based in London. We grew up on pirate radio frequencies, custom-built bass bins, warehouse raves, physical dubplates, and independent labels. We are the creators who spend hours crate-digging for white labels and rare vinyl, curating musical narratives that deserve to be heard at full power, without compromise.

## What We Do
SPARKZ.TV is a high-bandwidth, decentralized, and customized live web streaming environment tailored specifically for underground electronic music. We provide high-fidelity audio (320kbps AAC stream quality) and ultra-low latency video, so that the raw weight of your sub-bass and the crispness of your high-hats remain completely pristine and unaltered. Our platform hosts real-time chat rooms, interactive Watts rewards systems, persistent streamer profiles, and a community-driven Lounge.

## Why We Built It
For years, major commercial streaming platforms have turned their backs on independent artists. Rigid automated copyright muting algorithms, unexpected sudden channel bans for playing underground remixes, and predatory monetization cuts have systematically squeezed the life out of sound-system culture. 

Underground music thrives on track selection, rare edits, bootlegs, and live mixtapes. Mainstream platforms treat these artistic expressions as violations.

We built SPARKZ.TV to escape this system entirely. By owning our live infrastructure, we ensure:
- **No Automated Copyright Muting:** Play your white labels, custom dubplates, and underground edits live without fearing sudden sound cuts or automatic copyright strikes.
- **Direct Support & Community Ownership:** Connect directly with listeners through integrated Bits and persistent Watts stream rewards.
- **A True Safe Haven:** Maintain complete control of your performance, your channel, and your live community.

This is a space built by selectors, for selectors. Welcome home.`,
  },
];

export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const selectedSlug = searchParams.get("article") || null;

  const [posts, setPosts] = useState(DEFAULT_LAUNCH_POSTS);
  const [isLoading, setIsLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);

  // Form states for creating a new post
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.email === "markysparks99@gmail.com";

  // Firestore Sync
  useEffect(() => {
    const postsCollection = collection(db, "blog_posts");
    const q = query(postsCollection, orderBy("published_at", "desc"));

    setIsLoading(true);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const fetched = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title || "",
              slug: data.slug || "",
              summary: data.summary || "",
              content: data.content || "",
              author: data.author || "Anonymous",
              author_title: data.author_title || "Contributor",
              published_at: data.published_at || new Date().toISOString(),
              tags: data.tags || [],
            };
          });
          // Merge static defaults with dynamic ones to ensure launch post is always available
          const combined = [...fetched];
          DEFAULT_LAUNCH_POSTS.forEach((dp) => {
            if (!combined.some((p) => p.slug === dp.slug)) {
              combined.push(dp);
            }
          });
          setPosts(combined);
        } else {
          setPosts(DEFAULT_LAUNCH_POSTS);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Firestore loading error, falling back to static posts: ", error);
        setPosts(DEFAULT_LAUNCH_POSTS);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newTitle || !newSummary || !newContent) {
      toast.error("Please fill in the title, summary, and content!");
      return;
    }

    setSubmitting(true);
    const slug = newTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const tagsArray = newTags
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    const postPayload = {
      title: newTitle,
      slug,
      summary: newSummary,
      content: newContent,
      author: user?.display_name || user?.username || "DJ Sparkz",
      author_title: "Platform Creator",
      published_at: new Date().toISOString(),
      tags: tagsArray,
    };

    const pathForWrite = "blog_posts";
    try {
      await addDoc(collection(db, pathForWrite), postPayload);
      toast.success("Blog post published to Firestore successfully! ⚡");
      
      // Reset form
      setNewTitle("");
      setNewSummary("");
      setNewContent("");
      setNewTags("");
      setShowCompose(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathForWrite);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectArticle = (slug) => {
    setSearchParams({ article: slug });
  };

  const handleClearSelection = () => {
    setSearchParams({});
  };

  const activePost = posts.find((p) => p.slug === selectedSlug);

  // Custom visual markdown-like renderer for post contents
  const renderFormattedContent = (text) => {
    if (!text) return null;
    return text.split("\n\n").map((block, idx) => {
      const trimmed = block.trim();
      if (!trimmed) return null;

      // Handle custom headings
      if (trimmed.startsWith("## ")) {
        return (
          <h2
            key={idx}
            className="font-display text-sm font-black tracking-widest text-[#e5ff00] uppercase mt-8 mb-4 border-b border-zinc-800 pb-2 flex items-center gap-2"
          >
            <span className="text-zinc-600 font-mono text-[10px]">//</span>
            {trimmed.slice(3)}
          </h2>
        );
      }
      if (trimmed.startsWith("# ")) {
        return (
          <h1
            key={idx}
            className="font-display text-base font-black tracking-widest text-white uppercase mt-10 mb-4 pb-2"
          >
            {trimmed.slice(2)}
          </h1>
        );
      }

      // Handle custom lists
      if (trimmed.startsWith("- ")) {
        const items = trimmed.split("\n").map((li) => li.replace(/^- /, "").trim());
        return (
          <ul key={idx} className="space-y-2.5 my-4 font-mono text-xs text-zinc-300">
            {items.map((item, lIdx) => {
              // Highlight bold parts
              const boldMatch = item.match(/^\*\*(.*?)\*\*(.*)$/);
              if (boldMatch) {
                return (
                  <li key={lIdx} className="flex items-start gap-2">
                    <span className="text-[#e5ff00] mt-0.5">▪</span>
                    <span>
                      <strong className="text-white font-bold">{boldMatch[1]}</strong>
                      {boldMatch[2]}
                    </span>
                  </li>
                );
              }
              return (
                <li key={lIdx} className="flex items-start gap-2">
                  <span className="text-[#e5ff00] mt-0.5">▪</span>
                  <span>{item}</span>
                </li>
              );
            })}
          </ul>
        );
      }

      // Handle regular paragraph with bold replacements
      return (
        <p key={idx} className="font-sans text-xs text-zinc-300 leading-relaxed mb-4">
          {trimmed.split("**").map((chunk, cIdx) => {
            if (cIdx % 2 === 1) {
              return <strong key={cIdx} className="text-[#e5ff00] font-mono">{chunk}</strong>;
            }
            return chunk;
          })}
        </p>
      );
    });
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 md:px-8">
      
      {/* Blog Hero/Header */}
      <div className="mb-8 border-b border-[#27272a]/80 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] tracking-widest bg-[#e5ff00]/10 border border-[#e5ff00]/30 px-1.5 py-0.5 text-[#e5ff00] font-bold uppercase">
                SPARKZ JOURNAL // DEV LOGS
              </span>
              <span className="animate-pulse h-1.5 w-1.5 rounded-full bg-[#e5ff00]" />
            </div>
            <h1 className="font-display text-lg font-black tracking-tight text-white uppercase mt-1">
              THE TRANSMISSIONS
            </h1>
            <p className="font-mono text-[10px] text-zinc-500 uppercase mt-1">
              Platform specifications, deep-dives into sound-system engineering, and developer updates.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowCompose(true)}
                className="flex items-center gap-2 border border-[#e5ff00] bg-[#e5ff00]/5 px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-widest text-[#e5ff00] hover:bg-[#e5ff00] hover:text-black transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>WRITE ARTICLE</span>
              </button>
            )}

            {selectedSlug && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="flex items-center gap-1.5 border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-widest text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>ALL POSTS</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid gap-8 lg:grid-cols-12">
        
        {/* Left Side: Article Content or List */}
        <div className={selectedSlug ? "lg:col-span-8" : "lg:col-span-12"}>
          {selectedSlug && activePost ? (
            
            /* INDIVIDUAL POST READER */
            <article className="border border-[#27272a] bg-[#07070a] p-6 rounded-sm shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#e5ff00]" />
              
              {/* Post Meta Header */}
              <div className="space-y-3 mb-6 border-b border-zinc-900 pb-5">
                <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-zinc-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-[#e5ff00]" />
                    <span>{new Date(activePost.published_at).toLocaleDateString()}</span>
                  </div>
                  <span>/</span>
                  <div className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-[#e5ff00]" />
                    <span className="text-zinc-300 font-bold">{activePost.author}</span>
                    <span className="text-[9px] text-zinc-600">({activePost.author_title})</span>
                  </div>
                </div>

                <h1 className="font-display text-base sm:text-xl font-black tracking-tight text-white uppercase leading-tight">
                  {activePost.title}
                </h1>

                {activePost.tags && activePost.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activePost.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="font-mono text-[9px] uppercase tracking-wider bg-[#121217] border border-zinc-800 px-2 py-0.5 text-zinc-400"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Styled Summary Eyebrow */}
              <div className="border-l-2 border-[#e5ff00] bg-[#121215] p-3 mb-6 font-mono text-[11px] text-zinc-300 uppercase tracking-wide leading-relaxed">
                {activePost.summary}
              </div>

              {/* Formatted Paragraphs */}
              <div className="space-y-4 text-zinc-300 font-sans leading-relaxed">
                {renderFormattedContent(activePost.content)}
              </div>

              {/* Bottom Nav */}
              <div className="mt-10 pt-6 border-t border-zinc-900 flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="font-mono text-[10px] uppercase font-bold tracking-widest text-[#e5ff00] hover:underline flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>BACK TO JOURNAL</span>
                </button>
                <div className="font-mono text-[9px] text-zinc-600">// TRANSMISSION CLOSED</div>
              </div>
            </article>
          ) : (
            
            /* ARTICLE LIST VIEW */
            <div className="space-y-4">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2].map((n) => (
                    <div key={n} className="border border-[#27272a] bg-[#07070a]/50 p-6 animate-pulse space-y-3">
                      <div className="h-3 w-24 bg-zinc-800" />
                      <div className="h-5 w-2/3 bg-zinc-800" />
                      <div className="h-3 w-full bg-zinc-800" />
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="border border-dashed border-[#27272a] p-12 text-center rounded-sm">
                  <BookOpen className="h-8 w-8 text-zinc-600 mx-auto mb-3" />
                  <p className="font-mono text-xs uppercase text-zinc-500 tracking-wider">No transmissions logged yet.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => handleSelectArticle(post.slug)}
                      className="group relative border border-[#27272a] hover:border-[#e5ff00]/40 bg-[#07070a] p-5 sm:p-6 rounded-sm shadow-md hover:shadow-[0_0_15px_rgba(229,255,0,0.05)] transition-all cursor-pointer overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        {/* Meta */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 font-mono text-[9px] text-zinc-500">
                            <Calendar className="h-3.5 w-3.5 text-zinc-600" />
                            <span>{new Date(post.published_at).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>BY {post.author.toUpperCase()}</span>
                          </div>
                          
                          {/* Corner Tag */}
                          <div className="font-mono text-[8px] text-[#e5ff00] tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                            // READ
                          </div>
                        </div>

                        {/* Title */}
                        <h2 className="font-display text-sm sm:text-base font-black tracking-tight text-white group-hover:text-[#e5ff00] uppercase transition-colors mb-2.5">
                          {post.title}
                        </h2>

                        {/* Summary */}
                        <p className="font-sans text-xs text-zinc-400 group-hover:text-zinc-300 transition-colors line-clamp-2 leading-relaxed mb-4">
                          {post.summary}
                        </p>
                      </div>

                      {/* Footer tags / CTA */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-900/80">
                        <div className="flex flex-wrap gap-1">
                          {post.tags?.slice(0, 3).map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="font-mono text-[8px] tracking-wider bg-zinc-900 px-1.5 py-0.5 text-zinc-400"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="font-mono text-[10px] text-zinc-500 group-hover:text-[#e5ff00] flex items-center gap-1.5 transition-colors uppercase">
                          <span>OPEN LOG</span>
                          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Sidebar Widget when reader is active */}
        {selectedSlug && activePost && (
          <div className="lg:col-span-4 space-y-6">
            
            {/* Quick Index Widget */}
            <div className="border border-[#27272a] bg-[#07070a] p-4 rounded-sm">
              <div className="font-mono text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-3 pb-2 border-b border-zinc-900 flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-[#e5ff00]" />
                <span>JOURNAL ENTRIES</span>
              </div>
              <div className="space-y-2">
                {posts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => handleSelectArticle(post.slug)}
                    className={`w-full text-left font-mono text-[11px] uppercase p-2 rounded transition-all border ${
                      post.slug === selectedSlug
                        ? "bg-[#e5ff00]/5 text-[#e5ff00] border-[#e5ff00]/30 font-bold"
                        : "bg-[#050505] text-zinc-400 border-zinc-900 hover:text-white hover:border-zinc-800"
                    }`}
                  >
                    <div className="truncate">{post.title}</div>
                    <div className="text-[8px] text-zinc-600 mt-0.5">
                      {new Date(post.published_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Author Spotlights */}
            <div className="border border-[#27272a] bg-[#07070a] p-4 rounded-sm">
              <div className="font-mono text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-2 flex items-center gap-1.5">
                <User className="h-4 w-4 text-[#e5ff00]" />
                <span>WRITTEN BY</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-[#18181d] border border-zinc-800 flex items-center justify-center font-display text-sm font-black text-[#e5ff00]">
                  DS
                </div>
                <div>
                  <h4 className="font-mono text-xs font-bold text-white uppercase">{activePost.author}</h4>
                  <p className="font-mono text-[9px] text-zinc-500 uppercase">{activePost.author_title}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===================== COMPOSE MODAL ===================== */}
      {showCompose && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in-50 duration-200">
          <div className="relative w-full max-w-2xl border border-[#27272a] bg-[#0a0a0a] p-6 shadow-2xl rounded-sm max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4 mb-4">
              <div className="flex items-center gap-2 font-mono text-sm uppercase font-black tracking-widest text-[#e5ff00]">
                <FileText className="h-5 w-5 text-[#e5ff00]" />
                <span>TRANSMIT NEW ARTICLE</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCompose(false)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form Content */}
            <form onSubmit={handleCreatePost} className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
              <div>
                <label className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-1.5 block">// ARTICLE TITLE *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bass Weight In London Dubstep"
                  className="w-full border border-zinc-800 bg-black py-2 px-3 font-mono text-xs text-white placeholder-zinc-600 focus:border-[#e5ff00] focus:outline-none"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-1.5 block">// SHORT SUMMARY *</label>
                <input
                  type="text"
                  required
                  placeholder="Summarize the core theme or developer logs..."
                  className="w-full border border-zinc-800 bg-black py-2 px-3 font-mono text-xs text-white placeholder-zinc-600 focus:border-[#e5ff00] focus:outline-none"
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                />
              </div>

              <div>
                <label className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-1.5 block">// TAGS (COMMA SEPARATED)</label>
                <input
                  type="text"
                  placeholder="e.g. MISSION, SYSTEMS, TECH, JUNGLE"
                  className="w-full border border-zinc-800 bg-black py-2 px-3 font-mono text-xs text-white placeholder-zinc-600 focus:border-[#e5ff00] focus:outline-none"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                />
              </div>

              <div>
                <label className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-1.5 block">
                  // BODY CONTENT * (Use '## Heading' for section titles and '- Bullet' for lists)
                </label>
                <textarea
                  required
                  rows={10}
                  placeholder="Write your article body..."
                  className="w-full border border-zinc-800 bg-black py-2.5 px-3 font-mono text-xs text-white placeholder-zinc-600 focus:border-[#e5ff00] focus:outline-none h-48 resize-none"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </div>

              <div className="border border-[#e5ff00]/20 bg-[#e5ff00]/5 p-3 flex gap-2 rounded">
                <ShieldAlert className="h-4 w-4 text-[#e5ff00] shrink-0 mt-0.5" />
                <div className="font-mono text-[9px] text-[#e5ff00] uppercase tracking-wide">
                  SYSTEM OVERRIDE VERIFIED: Only the Platform Founder (@markysparks99) can issue blog logs directly to Firestore.
                </div>
              </div>

              <div className="border-t border-zinc-900 pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCompose(false)}
                  className="border border-zinc-800 bg-zinc-900/40 py-2 px-4 font-mono text-[10px] font-bold uppercase text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 border border-[#e5ff00] bg-[#e5ff00]/10 py-2 px-6 font-mono text-[10px] font-bold uppercase text-[#e5ff00] hover:bg-[#e5ff00] hover:text-black transition-all"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submitting ? "TRANSMITTING..." : "PUBLISH TRANSMISSION"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
