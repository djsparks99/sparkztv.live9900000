import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Radio, User, LogOut, LayoutDashboard, Settings, Tv, ChevronDown, Search, Sun, Moon, Compass, Layers, MessageSquare, Coins, Download, Smartphone, Monitor, Star, BookOpen } from "lucide-react";
import { fileUrl, DEFAULT_AVATAR } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import { usePWA } from "@/hooks/usePWA";
import { toast } from "sonner";
// Transparent yellow speech bubble logo sticker icon with cute cartoon eyes
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
      className="fixed top-0 left-0 right-0 z-40 border-b border-[#27272a] bg-[#050505]/95 backdrop-blur w-full"
    >
      <div className="w-full flex h-16 items-center justify-between px-2 sm:px-4">
        <div className="flex items-center gap-6 md:gap-8">
          <Link to="/" data-testid="brand-logo" className="flex items-center gap-1.5 sm:gap-2">
            <SpeechBubbleLogo className="h-8 w-8 sm:h-11 sm:w-11 animate-flip-2min drop-shadow shrink-0" />
            <span className="hidden min-[400px]:inline-block font-display text-lg sm:text-xl font-black tracking-tighter animate-flip-2min">
              SPARKZ<span className="text-[#e5ff00]">.TV</span>
            </span>
          </Link>
        </div>

        {/* Global Nav Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center relative max-w-[140px] xs:max-w-[180px] sm:max-w-xs flex-1 mx-2 sm:mx-4">
          <Search className="absolute left-2.5 sm:left-3 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={navSearch}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            placeholder="Search selectors..."
            className="w-full border border-[#27272a] bg-black py-1 sm:py-1.5 pl-8 sm:pl-9 pr-2.5 font-mono text-[11px] sm:text-xs text-white placeholder-zinc-500 focus:border-[#e5ff00] focus:outline-none transition-colors"
            data-testid="navbar-search-input"
          />
        </form>

        <div className="flex items-center gap-3">
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
                  toast.info(
                    "TO GET THE APP: TAP YOUR BROWSER'S SHARE BUTTON AND SELECT 'ADD TO HOME SCREEN' 📱",
                    { duration: 8000 }
                  );
                } else {
                  toast.info(
                    "TO GET THE APP: CLICK THE INSTALL/PWA ICON IN YOUR BROWSER'S ADDRESS BAR 💻",
                    { duration: 8000 }
                  );
                }
              }
            }}
            data-testid="pwa-install-btn"
            className="group flex items-center gap-1.5 border border-[#e5ff00] bg-black px-2 sm:px-2.5 py-1.5 font-mono text-[10px] sm:text-[11px] uppercase font-bold tracking-wider text-[#e5ff00] hover:bg-[#e5ff00] hover:text-black transition-all shadow-[0_0_8px_rgba(229,255,0,0.3)] shrink-0"
            title="Install SPARKZ.TV to your Device"
            aria-label="Install App"
          >
            <div className="flex items-center gap-0.5 shrink-0">
              <Smartphone className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#e5ff00] group-hover:text-black transition-all shrink-0" />
              <Monitor className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#e5ff00] group-hover:text-black transition-all shrink-0" />
            </div>
            <span className="inline-block sm:hidden">GET APP</span>
            <span className="hidden sm:inline">GET THE APP</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            data-testid="theme-toggle-btn"
            className="flex items-center gap-1.5 border border-[#27272a] bg-black px-2.5 py-1.5 font-mono text-[11px] uppercase font-bold tracking-wider text-zinc-300 hover:border-[#e5ff00] hover:text-[#e5ff00] transition-colors"
            title={isLight ? "Switch to Original Dark Cyber Theme" : "Switch to Light Theme"}
            aria-label="Toggle Color Theme"
          >
            {isLight ? (
              <>
                <Moon className="h-3.5 w-3.5 text-indigo-500" />
                <span className="hidden sm:inline">DARK</span>
              </>
            ) : (
              <>
                <Sun className="h-3.5 w-3.5 text-[#e5ff00]" />
                <span className="hidden sm:inline">LIGHT</span>
              </>
            )}
          </button>

          {user === undefined ? null : user ? (
            <>
              <NotificationBell />
              <UserMenu user={user} onLogout={onLogout} />
            </>
          ) : (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    data-testid="nav-menu-trigger"
                    className="flex items-center gap-1.5 border border-[#27272a] bg-black px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-zinc-300 hover:border-[#e5ff00] hover:text-[#e5ff00] transition-colors"
                  >
                    <span>MENU</span>
                    <ChevronDown className="h-3 w-3 text-zinc-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={6}
                  data-testid="nav-menu-content"
                  className="w-48 border-[#27272a] bg-[#050505] p-0 animate-in fade-in-50 duration-100"
                  style={{ borderRadius: 0 }}
                >
                  <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
                    <Link
                      to="/"
                      data-testid="nav-browse"
                      className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#0f0f0f] focus:bg-[#0f0f0f] focus:text-white"
                    >
                      BROWSE
                    </Link>
                  </DropdownMenuItem>
                   <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
                    <Link
                      to="/directory"
                      data-testid="nav-directory"
                      className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#0f0f0f] focus:bg-[#0f0f0f] focus:text-white"
                    >
                      DIRECTORY
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
                    <a
                      href="/#featured-djs"
                      data-testid="nav-featured-djs"
                      className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#0f0f0f] focus:bg-[#0f0f0f] focus:text-white"
                    >
                      FEATURED DJS
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
                    <Link
                      to="/lounge"
                      data-testid="nav-lounge"
                      className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#0f0f0f] focus:bg-[#0f0f0f] focus:text-white"
                    >
                      THE LOUNGE
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
                    <Link
                      to="/blog"
                      data-testid="nav-blog"
                      className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#0f0f0f] focus:bg-[#0f0f0f] focus:text-white"
                    >
                      THE BLOG
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-0 bg-[#27272a]" />
                  <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
                    <Link
                      to="/payouts?buy=true"
                      data-testid="nav-buy-bits-btn"
                      className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-[#e5ff00] hover:bg-[#0f0f0f] focus:bg-[#0f0f0f] font-bold"
                    >
                      <Coins className="h-3.5 w-3.5 text-[#e5ff00] animate-pulse" />
                      BUY BITS
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Link to="/login" data-testid="nav-login" className="btn-ghost">
                LOGIN
              </Link>
              <Link to="/register" data-testid="nav-register" className="btn-primary">
                START BROADCASTING
              </Link>
            </>
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
          className="flex items-center gap-2 border border-[#27272a] px-3 py-2 transition-colors hover:border-white focus:border-[#e5ff00] focus:outline-none"
        >
          <img
            src={user.photo_url ? fileUrl(user.photo_url) : DEFAULT_AVATAR}
            alt=""
            className="h-6 w-6 object-cover grayscale-0 md:grayscale md:contrast-125"
          />
          <span className="hidden font-mono text-xs uppercase tracking-widest sm:inline">
            {user.username}
          </span>
          <ChevronDown className="h-3 w-3 text-zinc-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        data-testid="user-menu-content"
        className="w-56 border-[#27272a] bg-[#050505] p-0"
        style={{ borderRadius: 0 }}
      >
        <DropdownMenuLabel className="border-b border-[#27272a] px-3 py-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            SIGNED IN AS
          </div>
          <div className="mt-1 truncate font-display text-sm font-black">
            {user.display_name}
          </div>
          <div className="truncate font-mono text-[10px] text-zinc-500">
            @{user.username}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuItem asChild data-testid="user-menu-buy-bits" style={{ borderRadius: 0 }}>
          <Link
            to="/payouts?buy=true"
            className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-[#e5ff00] hover:bg-[#0f0f0f] focus:bg-[#0f0f0f] font-bold"
          >
            <Coins className="h-3.5 w-3.5 text-[#e5ff00] animate-pulse" />
            BUY BITS
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-0 bg-[#27272a]" />
        <MenuLink
          to={`/channel/${user.username}`}
          icon={<Tv className="h-3.5 w-3.5" />}
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
        <MenuLink
          to="/"
          icon={<Compass className="h-3.5 w-3.5" />}
          testid="user-menu-browse"
        >
          BROWSE
        </MenuLink>
        <MenuLink
          to="/directory"
          icon={<Layers className="h-3.5 w-3.5" />}
          testid="user-menu-directory"
        >
          DIRECTORY
        </MenuLink>
        <DropdownMenuItem asChild style={{ borderRadius: 0 }}>
          <a
            href="/#featured-djs"
            data-testid="user-menu-featured-djs"
            className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#0f0f0f] focus:bg-[#0f0f0f] focus:text-white"
          >
            <Star className="h-3.5 w-3.5" />
            FEATURED DJS
          </a>
        </DropdownMenuItem>
        <MenuLink
          to="/lounge"
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          testid="user-menu-lounge"
        >
          THE LOUNGE
        </MenuLink>
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
          className="flex cursor-pointer items-center gap-2 border-t border-[#27272a] px-3 py-3 font-mono text-xs uppercase tracking-widest text-[#ff3b30] focus:bg-[#0f0f0f] focus:text-[#ff3b30]"
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
        className="flex cursor-pointer items-center gap-2 px-3 py-3 font-mono text-xs uppercase tracking-widest text-zinc-200 hover:bg-[#0f0f0f] focus:bg-[#0f0f0f] focus:text-white"
      >
        {icon}
        {children}
      </Link>
    </DropdownMenuItem>
  );
}

function NavItem({ to, children, testid }) {
  return (
    <NavLink
      to={to}
      end
      data-testid={testid}
      className={({ isActive }) =>
        `px-3 py-2 font-mono text-xs uppercase tracking-[0.2em] transition-colors ${
          isActive ? "text-[#e5ff00]" : "text-zinc-400 hover:text-white"
        }`
      }
    >
      {children}
    </NavLink>
  );
}
