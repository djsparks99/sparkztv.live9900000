import { useEffect, useRef, useState } from "react";
import { api, fileUrl, apiErrorMessage, fileToBase64, compressAndResizeImage, DEFAULT_AVATAR } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { updateUserProfileInFirestore, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Upload, User, Copy, RefreshCw, Radio, Eye, EyeOff, Music, Globe, Link2 } from "lucide-react";

export default function Profile() {
  const { user, setUser, refresh } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [genre, setGenre] = useState("");
  const [location, setLocation] = useState("");
  const [scLink, setScLink] = useState("");
  const [mcLink, setMcLink] = useState("");
  const [spLink, setSpLink] = useState("");
  const [igLink, setIgLink] = useState("");
  const [ytLink, setYtLink] = useState("");
  const [twLink, setTwLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingSocial, setUploadingSocial] = useState(false);
  const [channel, setChannel] = useState(null);
  const [revealKey, setRevealKey] = useState(false);
  const [loadingStream, setLoadingStream] = useState(false);
  const [activeTab, setActiveTab] = useState("identity");
  const fileRef = useRef(null);
  const socialFileRef = useRef(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || "");
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

      // Fetch authoritative Firestore document to ensure fresh metadata
      getDoc(doc(db, "users", user.uid))
        .then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.display_name) setDisplayName(data.display_name);
            if (data.bio !== undefined) setBio(data.bio);
            if (data.genre !== undefined) setGenre(data.genre);
            if (data.location !== undefined) setLocation(data.location);
            if (data.socials) {
              setScLink(data.socials.soundcloud || "");
              setMcLink(data.socials.mixcloud || "");
              setSpLink(data.socials.spotify || "");
              setIgLink(data.socials.instagram || "");
              setYtLink(data.socials.youtube || "");
              setTwLink(data.socials.twitter || "");
            }
          }
        })
        .catch((err) => console.warn("Error fetching user profile metadata from Firestore:", err));

      api.get("/channels/mine", {
        params: {
          uid: user.uid,
          username: user.username
        },
        headers: {
          "x-user-uid": user.uid || "",
          "x-username": user.username || ""
        }
      })
        .then(({ data }) => setChannel(data))
        .catch(() => {});
    }
  }, [user]);

  const generateNewStreamKey = async () => {
    setLoadingStream(true);
    try {
      const { data } = await api.post("/stream/create");
      setChannel(data.channel || data);
      toast.success("AWS IVS stream credentials generated & synced to Firestore!");
    } catch {
      toast.error("Failed to generate AWS IVS stream credentials.");
    } finally {
      setLoadingStream(false);
    }
  };

  const save = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    setSaving(true);
    try {
      const payload = {
        display_name: displayName,
        bio,
      };

      const firestorePayload = {
        display_name: displayName,
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

      if (user?.uid) {
        await updateUserProfileInFirestore(user.uid, firestorePayload, user.username);
      }

      let updatedData = null;
      try {
        const { data } = await api.patch("/users/me", firestorePayload);
        updatedData = data;
      } catch (err1) {
        try {
          const { data } = await api.put("/users/me", firestorePayload);
          updatedData = data;
        } catch (err2) {
          try {
            const { data } = await api.post("/users/me", firestorePayload);
            updatedData = data;
          } catch (err3) {
            console.warn("Backend sync fallback:", err3);
          }
        }
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

      toast.success("Profile updated successfully!");
    } catch (err) {
      console.error("Save profile error:", err);
      toast.error(apiErrorMessage(err) || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB.");
      return;
    }
    setUploading(true);
    try {
      const base64 = await compressAndResizeImage(file, 400, 400, 0.7);
      const { data } = await api.post("/users/me/photo", {
        image: base64,
        photo: base64,
        file: base64,
        filename: file.name
      });
      const photoUrl = data?.photo_url || data?.url || data?.avatar_url;
      if (photoUrl) {
        setUser((prev) => ({ ...prev, photo_url: photoUrl }));
        if (user?.uid) {
          await updateUserProfileInFirestore(user.uid, { photo_url: photoUrl }, user.username);
        }
      }
      if (typeof refresh === "function") {
        await refresh();
      }
      toast.success("Photo updated.");
    } catch (err) {
      console.error("Photo upload error:", err);
      toast.error(apiErrorMessage(err) || "Upload photo failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSocialFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB.");
      return;
    }
    setUploadingSocial(true);
    try {
      const base64 = await compressAndResizeImage(file, 1200, 630, 0.85);
      const { data } = await api.post("/users/me/social-share", {
        image: base64,
        photo: base64,
        file: base64,
        filename: file.name
      });
      const socialShareUrl = data?.social_share_image_url || data?.url || data?.socialShareImageUrl;
      if (socialShareUrl) {
        setUser((prev) => ({ ...prev, social_share_image_url: socialShareUrl }));
        if (user?.uid) {
          await updateUserProfileInFirestore(user.uid, { social_share_image_url: socialShareUrl }, user.username);
        }
      }
      if (typeof refresh === "function") {
        await refresh();
      }
      toast.success("Social share preview image updated!");
    } catch (err) {
      console.error("Social share photo upload error:", err);
      toast.error(apiErrorMessage(err) || "Upload social share photo failed.");
    } finally {
      setUploadingSocial(false);
      if (socialFileRef.current) socialFileRef.current.value = "";
    }
  };

  const resetSocialFile = async () => {
    setUploadingSocial(true);
    try {
      const payload = {
        social_share_image_url: null
      };
      await api.patch("/users/me", payload);
      setUser((prev) => ({ ...prev, social_share_image_url: null }));
      if (user?.uid) {
        await updateUserProfileInFirestore(user.uid, payload, user.username);
      }
      toast.success("Social share preview reset to default.");
    } catch (err) {
      toast.error("Failed to reset social share preview.");
    } finally {
      setUploadingSocial(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-5xl px-6 pt-12 pb-24 sm:pb-28 lg:pb-32" data-testid="profile-page">
      <div className="label-caps">// USER DASHBOARD</div>
      <h1 className="mb-2 font-display text-4xl font-black tracking-tighter sm:text-5xl">
        PROFILE SETTINGS
      </h1>
      <p className="mb-8 font-mono text-xs text-zinc-500 uppercase tracking-wider">
        Customize your DJ signature, streaming parameters, and social links in one view.
      </p>

      {/* COMPACT TAB NAVIGATION */}
      <div className="mb-8 flex flex-col sm:flex-row border border-[#27272a] bg-[#0c0c0e] p-1.5 font-mono text-[11px] tracking-widest uppercase">
        <button
          onClick={() => setActiveTab("identity")}
          className={`flex items-center justify-center gap-2 px-6 py-3.5 transition-all duration-150 ${
            activeTab === "identity"
              ? "bg-[#e5ff00] text-black font-extrabold"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
          }`}
        >
          <User className="h-3.5 w-3.5" />
          [1] IDENTITY & AVATAR
        </button>
        <button
          onClick={() => setActiveTab("stream_settings")}
          className={`flex items-center justify-center gap-2 px-6 py-3.5 transition-all duration-150 ${
            activeTab === "stream_settings"
              ? "bg-[#e5ff00] text-black font-extrabold"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          [2] STREAM CREDENTIALS
        </button>
      </div>

      {/* RENDER ACTIVE TAB */}
      {activeTab === "identity" && (
        <div className="grid gap-6 lg:grid-cols-3 animate-fadeIn">
          {/* Sidebar Area: Avatar and OG */}
          <div className="lg:col-span-1 space-y-6">
            {/* AVATAR */}
            <div className="border border-[#27272a] bg-[#0a0a0a] p-6">
              <div className="label-caps">// AVATAR IMAGE</div>
              <div className="mt-4 flex flex-col items-center">
                <img
                  src={user.photo_url ? fileUrl(user.photo_url) : DEFAULT_AVATAR}
                  alt=""
                  className="h-40 w-40 border border-[#27272a] object-cover bg-black"
                  data-testid="profile-avatar"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={onFile}
                  className="hidden"
                  data-testid="profile-photo-input"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  data-testid="profile-photo-upload"
                  className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2 text-xs py-2.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "UPLOADING..." : "UPLOAD PHOTO"}
                </button>
                <p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-zinc-500">
                  JPG / PNG / WEBP — MAX 5MB
                </p>
              </div>
            </div>

            {/* Social Share Preview (Open Graph) */}
            <div className="border border-[#27272a] bg-[#0a0a0a] p-6" data-testid="profile-social-share-section">
              <div className="label-caps">// OG SOCIAL PREVIEW</div>
              <div className="mt-4 flex flex-col items-center">
                {user.social_share_image_url ? (
                  <img
                    src={fileUrl(user.social_share_image_url)}
                    alt="Social Share"
                    className="aspect-[1.91/1] w-full border border-[#27272a] object-cover"
                    data-testid="profile-social-share-preview"
                  />
                ) : user.photo_url ? (
                  <div className="relative aspect-[1.91/1] w-full border border-[#27272a] bg-black flex flex-col items-center justify-center p-4 text-center">
                    <img
                      src={fileUrl(user.photo_url)}
                      alt="Fallback Avatar"
                      className="h-16 w-16 border border-[#27272a] object-cover mb-2 opacity-50"
                    />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
                      FALLBACK: STANDARD AVATAR
                    </span>
                  </div>
                ) : (
                  <div className="relative aspect-[1.91/1] w-full border border-[#27272a] bg-black flex flex-col items-center justify-center p-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center border border-[#27272a] bg-black rounded-full mb-2 opacity-50">
                      <User className="h-6 w-6 text-zinc-700" />
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
                      FALLBACK: DEFAULT OG IMAGE
                    </span>
                  </div>
                )}

                <input
                  ref={socialFileRef}
                  type="file"
                  accept="image/*"
                  onChange={onSocialFile}
                  className="hidden"
                  data-testid="profile-social-share-input"
                />
                <div className="mt-6 flex w-full flex-col gap-2">
                  <button
                    onClick={() => socialFileRef.current?.click()}
                    disabled={uploadingSocial}
                    data-testid="profile-social-share-upload"
                    className="btn-primary inline-flex items-center justify-center gap-2 text-xs py-2.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingSocial ? "UPLOADING..." : "UPLOAD PREVIEW"}
                  </button>
                  {user.social_share_image_url && (
                    <button
                      onClick={resetSocialFile}
                      disabled={uploadingSocial}
                      data-testid="profile-social-share-reset"
                      className="btn-ghost inline-flex items-center justify-center gap-2 text-xs border border-zinc-800 text-zinc-400 hover:text-white py-1.5"
                    >
                      RESET TO DEFAULT
                    </button>
                  )}
                </div>
                <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-widest text-zinc-500 leading-normal">
                  RECOMMENDED: 1200 × 630 PNG/JPG
                </p>
              </div>
            </div>
          </div>

          {/* Form Area: Identity */}
          <form onSubmit={save} className="lg:col-span-2">
            <div className="border border-[#27272a] bg-[#0a0a0a] p-6 h-full flex flex-col justify-between">
              <div className="space-y-5">
                <div className="label-caps">// IDENTITY CONFIG</div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="label-caps" htmlFor="username">USERNAME (PERMANENT HANDLE)</label>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#e5ff00]">
                      🔒 FIRESTORE LOCKED
                    </span>
                  </div>
                  <input
                    id="username"
                    className="input-terminal opacity-70 bg-[#050505] text-[#e5ff00] cursor-not-allowed"
                    value={user.username}
                    readOnly
                  />
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                    Permanent handle locked on sign-up. Cannot be reset or reverted.
                  </p>
                </div>
                <div>
                  <label className="label-caps" htmlFor="email-ro">EMAIL</label>
                  <input
                    id="email-ro"
                    className="input-terminal opacity-60"
                    value={user.email}
                    readOnly
                  />
                </div>
                <div>
                  <label className="label-caps" htmlFor="display-name">DISPLAY NAME</label>
                  <input
                    id="display-name"
                    data-testid="profile-display-name"
                    className="input-terminal"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={48}
                  />
                </div>
                <div>
                  <label className="label-caps" htmlFor="bio">BIO</label>
                  <textarea
                    id="bio"
                    data-testid="profile-bio"
                    className="input-terminal min-h-[140px] resize-y"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={280}
                    placeholder="Selectors, tracks, tell 'em what you're about."
                  />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#1a1a20]">
                <button
                  type="submit"
                  disabled={saving}
                  data-testid="profile-save"
                  className="btn-primary w-full md:w-auto"
                >
                  {saving ? "SAVING..." : "SAVE PROFILE"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}



      {activeTab === "stream_settings" && (
        <div className="border border-[#27272a] bg-[#0a0a0a] p-6 animate-fadeIn max-w-4xl" data-testid="profile-stream-settings">
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="label-caps">// BROADCAST & STREAM KEY (AMAZON IVS)</div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-1">
                Configure your encoder (OBS / Streamlabs) to stream live to SparkzTV.
              </p>
            </div>
            <button
              onClick={generateNewStreamKey}
              disabled={loadingStream}
              data-testid="generate-stream-key-btn"
              className="btn-ghost inline-flex items-center gap-1.5 text-xs text-[#e5ff00] border border-zinc-800 px-3 py-1.5 self-start md:self-auto hover:bg-zinc-900"
            >
              <RefreshCw className={`h-3 w-3 ${loadingStream ? "animate-spin" : ""}`} />
              {loadingStream ? "GENERATING..." : "REGENERATE KEY"}
            </button>
          </div>

          {channel ? (
            <div className="space-y-4 mt-6">
              <div>
                <div className="mb-1 label-caps">RTMP SERVER</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto whitespace-nowrap border border-[#27272a] bg-black px-3 py-2.5 font-mono text-[11px] text-zinc-200">
                    {channel.rtmp_url || channel.rtmpUrl || "rtmps://global-ingest.live-video.net:443/app/"}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(channel.rtmp_url || channel.rtmpUrl || "rtmps://global-ingest.live-video.net:443/app/");
                      toast.success("RTMP Server copied!");
                    }}
                    className="btn-ghost border border-zinc-800 p-2.5 hover:bg-zinc-900"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="label-caps">STREAM KEY</span>
                  <button
                    onClick={() => setRevealKey(!revealKey)}
                    className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 hover:text-[#e5ff00]"
                  >
                    {revealKey ? "HIDE" : "REVEAL"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto whitespace-nowrap border border-[#27272a] bg-black px-3 py-2.5 font-mono text-[11px] text-zinc-200">
                    {revealKey ? (channel.stream_key || channel.streamKey) : "•".repeat(Math.min((channel.stream_key || channel.streamKey || "").length || 16, 24))}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(channel.stream_key || channel.streamKey || "");
                      toast.success("Stream Key copied!");
                    }}
                    className="btn-ghost border border-zinc-800 p-2.5 hover:bg-zinc-900"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-1 label-caps">PLAYBACK URL</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto whitespace-nowrap border border-[#27272a] bg-black px-3 py-2.5 font-mono text-[11px] text-zinc-300">
                    {channel.playback_url || channel.playbackUrl || channel.playback_id || "None"}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(channel.playback_url || channel.playbackUrl || channel.playback_id || "");
                      toast.success("Playback URL copied!");
                    }}
                    className="btn-ghost border border-zinc-800 p-2.5 hover:bg-zinc-900"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="font-mono text-xs text-zinc-500 mt-6">
              Loading stream details or no channel created yet...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
