import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  initializeFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  onSnapshot,
  orderBy,
  where,
  serverTimestamp,
} from "firebase/firestore";

import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with experimentalForceLongPolling to ensure reliable connections in sandboxed/iframe environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

// OAuth Providers
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
export const yahooProvider = new OAuthProvider("yahoo.com");

// Helper Auth Functions
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInWithGithub = () => signInWithPopup(auth, githubProvider);
export const signInWithYahoo = () => signInWithPopup(auth, yahooProvider);
export const signInWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);
export const signUpWithEmail = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);
export const logOut = () => signOut(auth);

// Firestore Profile Helpers
export async function fetchUserDoc(uid) {
  if (!uid) return null;

  // 1. Always query Firestore directly first as the persistent source of truth
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data) {
        return data;
      }
    }
  } catch (err) {
    console.warn("Firestore fetchUserDoc warning (trying fallback):", err);
  }

  // 2. Fallback to Express backend if Firestore is temporarily offline or unreachable
  try {
    const res = await fetch(`/api/users/profile-by-uid/${uid}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.uid && data.username && !data.username.startsWith("user_")) {
        return data;
      }
    }
  } catch (err) {
    console.warn("Express profile cache fetch fallback notice:", err);
  }

  return null;
}

export async function savePermanentUsername(uid, { username, display_name, email }) {
  const cleanUsername = username.toLowerCase().trim();
  const userRef = doc(db, "users", uid);

  // Check if user already has a locked username in Firestore
  let existingData = null;
  try {
    const existingSnap = await getDoc(userRef);
    if (existingSnap.exists()) {
      existingData = existingSnap.data();
    }
  } catch (e) {
    console.warn("Firestore savePermanentUsername getDoc notice:", e);
  }

  if (existingData && existingData.username_locked) {
    // Permanent lock prevents overwriting username
    return existingData;
  }

  const userData = {
    uid,
    email: email || (existingData ? existingData.email : "") || "",
    username: cleanUsername,
    display_name: display_name || cleanUsername,
    username_locked: true,
    photo_url: auth.currentUser?.photoURL || (existingData ? existingData.photo_url : null) || null,
    social_share_image_url: existingData ? existingData.social_share_image_url || null : null,
    bio: existingData ? existingData.bio || "" : "",
    genre: existingData ? existingData.genre || "" : "",
    location: existingData ? existingData.location || "" : "",
    socials: existingData ? existingData.socials || null : null,
    watts: existingData?.watts !== undefined ? existingData.watts : 100,
    vinyl_bits: existingData?.vinyl_bits !== undefined ? existingData.vinyl_bits : 0,
    accumulated_bits_balance: existingData?.accumulated_bits_balance !== undefined ? existingData.accumulated_bits_balance : 0,
    created_at: existingData
      ? existingData.created_at || new Date().toISOString()
      : new Date().toISOString(),
    last_updated: new Date().toISOString(),
  };

  try {
    await setDoc(userRef, userData, { merge: true });
  } catch (err) {
    console.warn("Firestore setDoc user warning:", err);
  }

  // Also sync or create channel doc in Firestore
  const channelRef = doc(db, "channels", uid);
  let channelExists = false;
  try {
    const channelSnap = await getDoc(channelRef);
    channelExists = channelSnap.exists();
  } catch (err) {
    // assume false
  }

  if (!channelExists) {
    try {
      const channelData = {
        channel_id: uid,
        user_uid: uid,
        username: cleanUsername,
        display_name: display_name || cleanUsername,
        photo_url: auth.currentUser?.photoURL || null,
        thumbnail_url: null,
        playback_id: uid.substring(0, 16),
        stream_title: `${display_name || cleanUsername}'s Live Stream`,
        category: "music",
        is_live: false,
        viewer_count: 0,
        last_updated: new Date().toISOString(),
      };
      await setDoc(channelRef, channelData);
      await setDoc(doc(db, "channels", cleanUsername), {
        ...channelData,
        channel_id: cleanUsername
      }, { merge: true });
    } catch (err) {
      console.warn("Firestore setDoc channel warning:", err);
    }
  }

  return userData;
}

export async function updateUserProfileInFirestore(uid, updates, username = null) {
  if (!uid || !updates) return;
  try {
    const userRef = doc(db, "users", uid);
    const payload = {
      ...updates,
      last_updated: new Date().toISOString()
    };
    try {
      await setDoc(userRef, payload, { merge: true });
    } catch (err) {
      console.warn("Firestore setDoc user profile update warning:", err);
    }

    const channelUpdates = {};
    if (updates.display_name !== undefined) channelUpdates.display_name = updates.display_name;
    if (updates.photo_url !== undefined) channelUpdates.photo_url = updates.photo_url;
    if (updates.thumbnail_url !== undefined) channelUpdates.thumbnail_url = updates.thumbnail_url;
    if (updates.bio !== undefined) channelUpdates.bio = updates.bio;
    if (updates.genre !== undefined) channelUpdates.genre = updates.genre;
    if (updates.location !== undefined) channelUpdates.location = updates.location;
    if (updates.socials !== undefined) channelUpdates.socials = updates.socials;

    // Ensure username and channel_id are always populated in the channel document
    let resolvedUsername = username;
    if (!resolvedUsername) {
      try {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data()?.username) {
          resolvedUsername = userSnap.data().username;
        }
      } catch (err) {
        console.warn("Could not get username from firestore due to error:", err);
      }
    }

    if (resolvedUsername) {
      channelUpdates.username = resolvedUsername;
      channelUpdates.channel_id = resolvedUsername.toLowerCase();
    }

    if (Object.keys(channelUpdates).length > 0) {
      channelUpdates.last_updated = new Date().toISOString();
      try {
        await setDoc(doc(db, "channels", uid), channelUpdates, { merge: true });
        if (resolvedUsername) {
          await setDoc(doc(db, "channels", resolvedUsername.toLowerCase()), channelUpdates, { merge: true });
        }
      } catch (err) {
        console.warn("Firestore channel update warning:", err);
      }
    }
  } catch (err) {
    console.warn("Client Firestore user profile update warning:", err);
  }
}

export function handleFirestoreError(error, operationType, path) {
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
  return errInfo;
}

export async function followDJInFirestore(user, djUsername, djDisplayName = "") {
  if (!user || !user.uid || !djUsername) {
    throw new Error("Authentication and valid DJ username required to follow.");
  }
  const cleanDj = String(djUsername).toLowerCase().trim();
  const followId = `${user.uid}_${cleanDj}`;
  const path = `follows/${followId}`;

  try {
    const followRef = doc(db, "follows", followId);
    const payload = {
      id: followId,
      user_uid: user.uid,
      follower_username: user.username || user.email?.split("@")[0] || "user",
      follower_display_name: user.display_name || user.username || "User",
      dj_username: cleanDj,
      dj_display_name: djDisplayName || djUsername,
      created_at: new Date().toISOString(),
    };
    await setDoc(followRef, payload, { merge: true });
    return { success: true, isFollowing: true, followId };
  } catch (err) {
    handleFirestoreError(err, "create", path);
    throw err;
  }
}

export async function unfollowDJInFirestore(user, djUsername) {
  if (!user || !user.uid || !djUsername) {
    throw new Error("Authentication and valid DJ username required to unfollow.");
  }
  const cleanDj = String(djUsername).toLowerCase().trim();
  const followId = `${user.uid}_${cleanDj}`;
  const path = `follows/${followId}`;

  try {
    const followRef = doc(db, "follows", followId);
    await deleteDoc(followRef);
    return { success: true, isFollowing: false, followId };
  } catch (err) {
    handleFirestoreError(err, "delete", path);
    throw err;
  }
}

export { onAuthStateChanged };
