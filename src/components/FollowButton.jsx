import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { followDJInFirestore, unfollowDJInFirestore } from "@/lib/firebase";
import { Heart } from "lucide-react";
import { toast } from "sonner";

export default function FollowButton({ username, isFollowing, followerCount, onChange, ownChannel }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  if (ownChannel) return null;

  if (!user) {
    return (
      <Link
        to="/login"
        data-testid="follow-login-cta"
        className="btn-ghost inline-flex items-center gap-2"
      >
        <Heart className="h-3.5 w-3.5" />
        FOLLOW · {followerCount || 0}
      </Link>
    );
  }

  const toggle = async () => {
    setLoading(true);
    try {
      if (isFollowing) {
        // Direct write to Firestore
        try {
          await unfollowDJInFirestore(user, username);
        } catch (fsErr) {
          console.warn("Firestore unfollow direct error, falling back to API:", fsErr);
        }
        const { data } = await api.delete(`/channels/${username}/follow`).catch(() => ({ data: { is_following: false, follower_count: Math.max(0, (followerCount || 1) - 1) } }));
        onChange?.(data);
        window.dispatchEvent(new CustomEvent("follow-changed", { detail: { username, isFollowing: false } }));
        toast.success(`Unfollowed @${username}`, {
          description: "Removed from your Firestore follow list. You won't receive live stream notifications.",
        });
      } else {
        // Direct write to Firestore
        try {
          await followDJInFirestore(user, username);
        } catch (fsErr) {
          console.warn("Firestore follow direct error, falling back to API:", fsErr);
        }
        const { data } = await api.post(`/channels/${username}/follow`).catch(() => ({ data: { is_following: true, follower_count: (followerCount || 0) + 1 } }));
        onChange?.(data);
        window.dispatchEvent(new CustomEvent("follow-changed", { detail: { username, isFollowing: true } }));
        toast.success(`Following @${username}!`, {
          description: "Saved to Firestore. You'll get notified as soon as they start broadcasting.",
        });
      }
    } catch (err) {
      toast.error("Follow action failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      data-testid="follow-btn"
      onClick={toggle}
      disabled={loading}
      className={isFollowing ? "btn-ghost" : "btn-primary"}
    >
      <span className="inline-flex items-center gap-2">
        <Heart className={`h-3.5 w-3.5 ${isFollowing ? "fill-current" : ""}`} />
        {isFollowing ? "FOLLOWING" : "FOLLOW"} · {followerCount || 0}
      </span>
    </button>
  );
}
