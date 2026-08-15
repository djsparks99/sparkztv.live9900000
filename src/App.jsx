import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import LiveSidebar from "@/components/LiveSidebar";
import AuthModal from "@/components/AuthModal";
import UsernameLockModal from "@/components/UsernameLockModal";
import Footer from "@/components/Footer";

// Real pages
import Browse from "@/pages/Browse";
import Channel from "@/pages/Channel";
import Dashboard from "@/pages/Dashboard";
import Directory from "@/pages/Directory";
import Blog from "@/pages/Blog";
import Lounge from "@/pages/Lounge";
import Profile from "@/pages/Profile";
import Payouts from "@/pages/Payouts";
import Login from "@/pages/Login";
import Register from "@/pages/Register";

export default function App() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);

  // Responsive mobile checking
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Check if we are on a clean page like Login/Register where a side-by-side stream shell might not be required
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  const isChannelPage = location.pathname.startsWith("/channel/");

  return (
    <div className="h-screen bg-[#0e0e10] text-[#efeff1] font-sans flex flex-col selection:bg-[#e5ff00] selection:text-black overflow-hidden">
      {/* Global Auth Modal */}
      <AuthModal />
      <UsernameLockModal />

      {/* Twitch Top Navigation Bar */}
      <Navbar />

      {/* Main App Container */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        
        {/* Persistent Left Sidebar (hidden on standard login/register screens for clean center layouts) */}
        {!isAuthPage && <LiveSidebar />}

        {/* Scrollable Page Router Viewport */}
        <main className={`flex-1 bg-[#0e0e10] relative flex flex-col min-h-0 ${isChannelPage ? "overflow-hidden h-full" : "overflow-y-auto"}`}>
          <div className={`flex-1 ${isChannelPage ? "h-full min-h-0 flex flex-col" : ""}`}>
            <Routes>
              {/* Standard Routes */}
              <Route path="/" element={<Browse />} />
              <Route path="/directory" element={<Directory />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/channel/:username" element={<Channel />} />
              
              {/* Dynamic Blog & Articles */}
              <Route path="/blog" element={<Blog />} />
              
              {/* Community Lounge & Profiles */}
              <Route path="/lounge" element={<Lounge />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/payouts" element={<Payouts />} />

              {/* Direct Login/Register (Provides full page fallbacks) */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Fallback Catch-All */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          {!isChannelPage && !isAuthPage && <Footer />}
        </main>
      </div>
    </div>
  );
}
