import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { X, Mail, Lock, User, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function AuthModal() {
  const { login, register, loginWithOAuth } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState("login"); // "login" | "register"
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state
  const [regDisplayName, setRegDisplayName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  useEffect(() => {
    const handleOpen = (e) => {
      setIsOpen(true);
      setAuthError("");
      if (e.detail?.view) {
        setView(e.detail.view);
      }
    };
    window.addEventListener("open-auth-modal", handleOpen);
    return () => window.removeEventListener("open-auth-modal", handleOpen);
  }, []);

  const closeModal = () => {
    setIsOpen(false);
    setAuthError("");
    // Clear states
    setLoginEmail("");
    setLoginPassword("");
    setRegDisplayName("");
    setRegUsername("");
    setRegEmail("");
    setRegPassword("");
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError("");
    const res = await login(loginEmail, loginPassword);
    setLoading(false);
    if (res.ok) {
      toast.success("Welcome back to the SPARKZ.TV network! ⚡");
      closeModal();
    } else {
      setAuthError(res.error || "Login failed");
      toast.error(res.error || "Login failed");
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError("");
    const res = await register({
      email: regEmail,
      password: regPassword,
      username: regUsername.toLowerCase().trim(),
      display_name: regDisplayName.trim(),
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Frequency claimed & username locked successfully! 💿");
      closeModal();
    } else {
      setAuthError(res.error || "Registration failed");
      toast.error(res.error || "Registration failed");
    }
  };

  const handleOAuth = async (provider) => {
    setLoading(true);
    setAuthError("");
    const res = await loginWithOAuth(provider);
    setLoading(false);
    if (res.ok) {
      toast.success(`Authenticated with ${provider}! ⚡`);
      closeModal();
    } else {
      setAuthError(res.error || `${provider} authentication failed`);
      toast.error(res.error || `${provider} authentication failed`);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in"
      onClick={closeModal}
      data-testid="auth-modal"
    >
      <div 
        className="w-full max-w-md border border-[#e5ff00]/40 bg-[#0c0c0e] p-6 sm:p-8 shadow-[0_0_50px_rgba(229,255,0,0.15)] rounded-none relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={closeModal}
          className="absolute top-4 right-4 text-zinc-400 hover:text-[#e5ff00] transition-colors p-1"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-10 h-10 bg-[#e5ff00] rounded-none items-center justify-center font-black text-black text-xl tracking-tighter mb-3 shadow-[0_0_20px_rgba(229,255,0,0.3)]">
            SZ
          </div>
          <h2 className="font-display text-2xl font-black tracking-tight text-white uppercase">
            {view === "login" ? "TUNE IN" : "CLAIM FREQUENCY"}
          </h2>
          <p className="font-mono text-[10px] text-zinc-400 uppercase tracking-widest mt-1">
            {view === "login" ? "RE-ENTER THE UNDERGROUND SESSIONS" : "BECOME A BROADCASTER"}
          </p>
        </div>

        {/* Third-Party Authentication Options */}
        <div className="space-y-2 mb-6" data-testid="modal-oauth-container">
          <button
            type="button"
            onClick={() => handleOAuth("google")}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 border border-zinc-800 bg-[#050505] hover:bg-zinc-900 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white transition hover:border-[#e5ff00] hover:text-[#e5ff00] rounded-none"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
            </svg>
            Google Connection
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleOAuth("github")}
              disabled={loading}
              className="flex items-center justify-center gap-2 border border-zinc-800 bg-[#050505] hover:bg-zinc-900 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white transition hover:border-[#e5ff00] hover:text-[#e5ff00] rounded-none"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </button>

            <button
              type="button"
              onClick={() => handleOAuth("yahoo")}
              disabled={loading}
              className="flex items-center justify-center gap-2 border border-zinc-800 bg-[#050505] hover:bg-zinc-900 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white transition hover:border-[#e5ff00] hover:text-[#e5ff00] rounded-none"
            >
              <span className="font-serif font-black text-purple-400">Y!</span>
              Yahoo
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="relative mb-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800"></div>
          </div>
          <span className="relative bg-[#0c0c0e] px-3 font-mono text-[9px] uppercase tracking-widest text-zinc-500">
            OR TERMINAL ACCESS
          </span>
        </div>

        {authError && (
          <div className="mb-5 rounded-none border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <p className="font-bold uppercase tracking-wider text-[9px] text-red-400 font-mono">// ERROR ENCOUNTERED</p>
                <p className="leading-relaxed font-mono text-[10px] break-words">{authError}</p>
                
                {(authError.toLowerCase().includes("operation-not-allowed") || 
                  authError.toLowerCase().includes("not allowed") || 
                  authError.toLowerCase().includes("disabled") ||
                  authError.toLowerCase().includes("configuration")) && (
                  <div className="mt-3 pt-3 border-t border-red-500/20 text-[11px] leading-relaxed text-zinc-300 font-sans space-y-1.5">
                    <p className="font-bold text-white">How to enable Email & Password Authentication:</p>
                    <ol className="list-decimal pl-4 space-y-1.5 text-zinc-400 text-[10px]">
                      <li>Open the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#e5ff00] hover:underline font-semibold">Firebase Console</a>.</li>
                      <li>Select your project: <strong className="text-white font-mono">ai-studio-applet-webapp-400d5</strong></li>
                      <li>Navigate to <strong className="text-white">Authentication</strong> &gt; <strong className="text-white">Sign-in method</strong>.</li>
                      <li>Click <strong className="text-white">Add new provider</strong>, select <strong className="text-white">Email/Password</strong>, toggle to <strong className="text-white">Enable</strong>, and click <strong className="text-white">Save</strong>.</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Form area */}
        {view === "login" ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4" data-testid="modal-login-form">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1" htmlFor="modal-email">
                EMAIL ADDRESS
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="modal-email"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="input-terminal pl-10"
                  placeholder="dj@pirate.radio"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1" htmlFor="modal-password">
                PASSWORD
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="modal-password"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="input-terminal pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 font-mono text-[10px] uppercase font-bold tracking-widest py-3 rounded-none"
            >
              {loading ? "INITIALIZING SECURE LINK..." : "TUNE IN"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4" data-testid="modal-register-form">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1" htmlFor="modal-reg-display">
                DISPLAY NAME
              </label>
              <div className="relative">
                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="modal-reg-display"
                  type="text"
                  required
                  maxLength={48}
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  className="input-terminal pl-10"
                  placeholder="DJ Resonator"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1" htmlFor="modal-reg-username">
                PERMANENT USERNAME
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="modal-reg-username"
                  type="text"
                  required
                  pattern="[a-zA-Z0-9_]+"
                  maxLength={24}
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="input-terminal pl-10 lowercase"
                  placeholder="dj_resonator"
                />
              </div>
              <p className="mt-1 font-mono text-[8px] text-zinc-500 uppercase tracking-widest">
                permanent locked url handle
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1" htmlFor="modal-reg-email">
                EMAIL ADDRESS
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="modal-reg-email"
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="input-terminal pl-10"
                  placeholder="resonator@sparkz.tv"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1" htmlFor="modal-reg-password">
                PASSWORD
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="modal-reg-password"
                  type="password"
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="input-terminal pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 font-mono text-[10px] uppercase font-bold tracking-widest py-3 rounded-none"
            >
              {loading ? "PROVISIONING FREQUENCY..." : "CLAIM MY FREQUENCY"}
            </button>
          </form>
        )}

        {/* Footer Toggle */}
        <div className="mt-6 border-t border-zinc-800 pt-4 text-center font-mono text-[11px] uppercase tracking-wider text-zinc-400">
          {view === "login" ? (
            <>
              NO STATION PROVISIONED?{" "}
              <button 
                onClick={() => setView("register")}
                className="text-[#e5ff00] hover:underline font-bold focus:outline-none"
              >
                CLAIM ONE →
              </button>
            </>
          ) : (
            <>
              ALREADY HAVE A FREQUENCY?{" "}
              <button 
                onClick={() => setView("login")}
                className="text-[#e5ff00] hover:underline font-bold focus:outline-none"
              >
                LOG IN →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
