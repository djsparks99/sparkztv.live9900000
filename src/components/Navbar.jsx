import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Radio, User, LogOut, LayoutDashboard, Settings, Tv, ChevronDown, Search, Sun, Moon, Compass, Layers, MessageSquare, Coins, Download, Smartphone, Monitor, Star, BookOpen, MoreVertical } from "lucide-react";
import { fileUrl, DEFAULT_AVATAR } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import { usePWA } from "@/hooks/usePWA";
import { toast } from "sonner";

function SpeechBubbleLogo({ className = "h-10 w-10" }) {
  return (
    <img
      src="/logo.svg"
      alt="Sparkz.TV Logo"
      className={`${className} object-contain`}
      referrerPolicy="no-referrer"
    />
  );
}

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isInstallable, installApp } = usePWA();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") || "";
  const [navSearch, setNavSearch] = useState(urlQuery);
  const [isLight, setIsLight] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sparkz_theme") === "light";
    }
    return false;
  });

  useEffect(() => {
    if (isLight) {
      document.documentElement.classList.add("light");
      localStorage.setItem("sparkz_theme", "light");
    } else {
      document.documentElement.classList.remove("light");
      localStorage.setItem("sparkz_theme", "dark");
    }
  }, [isLight]);

  // Sync navbar search state with URL search query parameter
  useEffect(() => {
    setNavSearch(urlQuery);
  }, [urlQuery]);

  const toggleTheme = () => setIsLight((prev) => !prev);

  const onLogout = () => {
    logout();
    navigate("/");
  };

  const handleSearchInputChange = (val) => {
    setNavSearch(val);
    const pathname = window.location.pathname;
    const isSearchablePage = pathname === "/" || pathname === "/directory";
    if (isSearchablePage) {
      if (val.trim()) {
        setSearchParams({ q: val }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (navSearch.trim()) {
      navigate(`/directory?q=${encodeURIComponent(navSearch.trim())}`);
    } else {
      navigate("/directory");
    }
  };

  return (
    <header
      data-testid="site-navbar"
      className="sticky top-0 left-0 right-0 z-40 border-b border-[#1f1f23] bg-[#0f0f12]/95 backdrop-blur w-full h-16 flex items-center shrink-0"
    >
      <div className="w-full flex items-center justify-between px-4">
        {/* Left Section: Logo & Twitch-style Browse/Directory Links */}
        <div className="flex items-center gap-4 md:gap-6">
          <Link to="/" data-testid="brand-logo" className="flex items-center gap-2 shrink-0">
            <SpeechBubbleLogo className="h-9 w-9 animate-flip-2min drop-shadow shrink-0" />
            <span className="hidden md:inline-block font-display text-lg font-black tracking-tighter uppercase">
              SPARKZ<span className="text-[#e5ff00]">.TV</span>
            </span>
          </Link>

          {/* Core Twitch Nav Links on Desktop */}
          <nav className="hidden lg:flex items-center gap-5 border-l border-zinc-800 pl-5 h-6">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `font-mono text-xs uppercase tracking-widest font-black transition-colors hover:text-[#e5ff00] ${
                  isActive ? "text-[#e5ff00]" : "text-zinc-300"
                }`
              }
            >
              BROWSE
            </NavLink>
            <NavLink
              to="/directory"
              className={({ isActive }) =>
                `font-mono text-xs uppercase tracking-widest font-black transition-colors hover:text-[#e5ff00] ${
                  isActive ? "text-[#e5ff00]" : "text-zinc-300"
                }`
              }
            >
              DIRECTORY
            </NavLink>

            {/* Twitch-style extra links inside dropdown ... */}
            <DropdownMenu>
              <DropdownMenuTrigger className="text-zinc-400 hover:text-white transition-colors focus:outline-none">
                <MoreVertical className="h-4.5 w-4.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={6}
                className="w-48 border-[#27272a] bg-[#0a0a0d] p-0"
                style={{ borderRadius: 0 }}
              >
                <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
                  <Link
                    to="/lounge"
                    className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#121216] focus:bg-[#121216]"
                  >
                    THE LOUNGE
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
                  <Link
                    to="/blog"
                    className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#121216] focus:bg-[#121216]"
                  >
                    THE BLOG
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
                  <a
                    href="/#featured-djs"
                    className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#121216] focus:bg-[#121216]"
                  >
                    FEATURED DJS
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>

        {/* Middle Section: Centered Search Bar with integrated search button (Twitch-style) */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-[360px] mx-3 xs:mx-4">
          <div className="flex w-full items-center bg-[#18181b] border border-zinc-800 focus-within:border-[#e5ff00]/60 hover:border-zinc-700 transition rounded-md overflow-hidden h-9">
            <input
              type="text"
              value={navSearch}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent py-1 px-3.5 font-sans text-xs text-white placeholder-zinc-500 focus:outline-none"
              data-testid="navbar-search-input"
            />
            <button
              type="submit"
              className="bg-[#242429] hover:bg-zinc-800 border-l border-zinc-800 px-3 h-full text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Submit search"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>

        {/* Right Section: Install app, notifications & user profile settings */}
        <div className="flex items-center gap-2 sm:gap-3.5">
          {/* Get App button */}
          <button
            type="button"
            onClick={async () => {
              if (isInstallable) {
                const success = await installApp();
                if (success) {
                  toast.success("Thank you for installing SPARKZ.TV! ⚡");
                }
              } else {
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                if (isMobile) {
                  toast.info("TAP YOUR BROWSER'S SHARE BUTTON AND SELECT 'ADD TO HOME SCREEN' 📱", { duration: 8000 });
                } else {
                  toast.info("CLICK THE INSTALL/PWA ICON IN YOUR BROWSER'S ADDRESS BAR 💻", { duration: 8000 });
                }
              }
            }}
            data-testid="pwa-install-btn"
            className="group flex items-center gap-1.5 border border-[#e5ff00]/40 bg-black px-2.5 py-1.5 font-mono text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-[#e5ff00] hover:bg-[#e5ff00] hover:text-black transition-all shadow-[0_0_8px_rgba(229,255,0,0.1)] shrink-0"
            title="Install SPARKZ.TV to your Device"
          >
            <Smartphone className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#e5ff00] group-hover:text-black transition-all shrink-0" />
            <span className="hidden sm:inline">GET APP</span>
          </button>

          {/* Theme Switcher Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            data-testid="theme-toggle-btn"
            className="hidden md:flex h-9 w-9 items-center justify-center border border-zinc-800 bg-black text-zinc-400 hover:text-[#e5ff00] hover:border-[#e5ff00] transition-colors"
            title={isLight ? "Dark Theme" : "Light Theme"}
          >
            {isLight ? <Moon className="h-4 w-4 text-indigo-400" /> : <Sun className="h-4 w-4 text-[#e5ff00]" />}
          </button>

          {/* User state */}
          {user === undefined ? null : user ? (
            <div className="flex items-center gap-2">
              {/* Notification bell and user avatar */}
              <div className="hidden sm:block">
                <NotificationBell />
              </div>
              <UserMenu user={user} onLogout={onLogout} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Mobile menu trigger */}
              <div className="lg:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      data-testid="nav-menu-trigger"
                      className="flex h-9 items-center gap-1 border border-zinc-800 bg-black px-2.5 font-mono text-[10px] uppercase tracking-wider text-zinc-300 hover:border-[#e5ff00] hover:text-[#e5ff00] transition-colors"
                    >
                      <span>MENU</span>
                      <ChevronDown className="h-3 w-3 text-zinc-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    sideOffset={6}
                    data-testid="nav-menu-content"
                    className="w-48 border-[#27272a] bg-[#0a0a0d] p-0"
                    style={{ borderRadius: 0 }}
                  >
                    <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
                      <Link
                        to="/"
                        data-testid="nav-browse"
                        className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#121216] focus:bg-[#121216]"
                      >
                        BROWSE
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
                      <Link
                        to="/directory"
                        data-testid="nav-directory"
                        className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#121216] focus:bg-[#121216]"
                      >
                        DIRECTORY
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
                      <Link
                        to="/lounge"
                        data-testid="nav-lounge"
                        className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#121216] focus:bg-[#121216]"
                      >
                        THE LOUNGE
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
                      <Link
                        to="/blog"
                        data-testid="nav-blog"
                        className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#121216] focus:bg-[#121216]"
                      >
                        THE BLOG
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <button
                onClick={() => window.dispatchEvent(new CustomEvent("open-auth-modal", { detail: { view: "login" } }))}
                data-testid="nav-login"
                className="font-mono text-xs font-black uppercase text-zinc-300 hover:text-[#e5ff00] px-3 py-2 transition-colors focus:outline-none"
              >
                LOGIN
              </button>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("open-auth-modal", { detail: { view: "register" } }))}
                data-testid="nav-register"
                className="bg-[#e5ff00] hover:bg-white text-black px-3.5 py-1.5 font-mono text-xs font-black uppercase tracking-wider transition-colors focus:outline-none shadow-[0_0_10px_rgba(229,255,0,0.2)]"
              >
                SIGN UP
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function UserMenu({ user, onLogout }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="user-menu-trigger"
          className="flex items-center justify-center rounded-full overflow-hidden h-9 w-9 border border-zinc-800 bg-black hover:border-white focus:border-[#e5ff00] focus:outline-none transition-all duration-200 shrink-0"
        >
          <img
            src={user.photo_url ? fileUrl(user.photo_url) : DEFAULT_AVATAR}
            alt={user.display_name}
            className="h-full w-full object-cover"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        data-testid="user-menu-content"
        className="w-56 border-[#27272a] bg-[#0a0a0d] p-0"
        style={{ borderRadius: 0 }}
      >
        <DropdownMenuLabel className="border-b border-[#27272a] px-3 py-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
            SIGNED IN AS
          </div>
          <div className="mt-1 truncate font-display text-sm font-black text-white">
            {user.display_name}
          </div>
          <div className="truncate font-mono text-[9px] text-zinc-500">
            @{user.username}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuItem asChild data-testid="user-menu-buy-bits" style={{ borderRadius: 0 }}>
          <Link
            to="/payouts?buy=true"
            className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-[#e5ff00] hover:bg-[#121216] focus:bg-[#121216] font-bold"
          >
            <Coins className="h-3.5 w-3.5 text-[#e5ff00]" />
            BUY BITS
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-0 bg-[#27272a]" />

        <MenuLink
          to={`/channel/${user.username}`}
          icon={<Tv className="h-3.5 w-3.5 text-[#e5ff00]" />}
          testid="user-menu-my-channel"
        >
          MY CHANNEL
        </MenuLink>

        <MenuLink
          to="/dashboard"
          icon={<LayoutDashboard className="h-3.5 w-3.5" />}
          testid="user-menu-studio"
        >
          STUDIO
        </MenuLink>

        <MenuLink
          to="/profile"
          icon={<Settings className="h-3.5 w-3.5" />}
          testid="user-menu-profile"
        >
          PROFILE SETTINGS
        </MenuLink>

        <MenuLink
          to="/payouts"
          icon={<Coins className="h-3.5 w-3.5" />}
          testid="user-menu-payouts"
        >
          PAYOUTS
        </MenuLink>

        <DropdownMenuSeparator className="my-0 bg-[#27272a]" />

        <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
          <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
            <Link
              to="/lounge"
              className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#121216]"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              THE LOUNGE
            </Link>
          </DropdownMenuItem>
        </DropdownMenuItem>

        <MenuLink
          to="/blog"
          icon={<BookOpen className="h-3.5 w-3.5" />}
          testid="user-menu-blog"
        >
          THE BLOG
        </MenuLink>

        <DropdownMenuSeparator className="my-0 bg-[#27272a]" />

        <DropdownMenuItem
          data-testid="user-menu-logout"
          onSelect={onLogout}
          className="flex cursor-pointer items-center gap-2 border-t border-[#27272a] px-3 py-3 font-mono text-xs uppercase tracking-widest text-[#ff3b30] focus:bg-[#121216]"
          style={{ borderRadius: 0 }}
        >
          <LogOut className="h-3.5 w-3.5" />
          LOG OUT
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuLink({ to, icon, children, testid }) {
  return (
    <DropdownMenuItem asChild data-testid={testid} style={{ borderRadius: 0 }}>
      <Link
        to={to}
        className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#121216] focus:bg-[#121216]"
      >
        {icon}
        {children}
      </Link>
    </DropdownMenuItem>
  );
}
