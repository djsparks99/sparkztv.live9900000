import { useState, useEffect } from "react";

let globalDeferredPrompt = null;
const listeners = new Set();

// Try to capture the event as early as possible if this file loads before the component mounts
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    listeners.forEach((l) => l(true));
  });

  window.addEventListener("appinstalled", () => {
    globalDeferredPrompt = null;
    listeners.forEach((l) => l(false));
  });
}

export function usePWA() {
  const [isInstallable, setIsInstallable] = useState(!!globalDeferredPrompt);

  useEffect(() => {
    const handlePrompt = (e) => {
      e.preventDefault();
      globalDeferredPrompt = e;
      setIsInstallable(true);
      listeners.forEach((l) => l(true));
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);

    const handleAppInstalled = () => {
      globalDeferredPrompt = null;
      setIsInstallable(false);
      listeners.forEach((l) => l(false));
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    const onChange = (val) => setIsInstallable(val);
    listeners.add(onChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      listeners.delete(onChange);
    };
  }, []);

  const installApp = async () => {
    if (!globalDeferredPrompt) {
      console.warn("Install prompt is not available yet.");
      return false;
    }
    try {
      globalDeferredPrompt.prompt();
      const { outcome } = await globalDeferredPrompt.userChoice;
      globalDeferredPrompt = null;
      setIsInstallable(false);
      listeners.forEach((l) => l(false));
      return outcome === "accepted";
    } catch (err) {
      console.error("Failed to prompt install:", err);
      return false;
    }
  };

  return { isInstallable, installApp };
}
