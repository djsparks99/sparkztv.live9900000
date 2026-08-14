import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp, RefreshCw, Users, Activity } from "lucide-react";

export default function PerformanceChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalStreamHours, setTotalStreamHours] = useState(0);
  const [peakViewers, setPeakViewers] = useState(0);
  const [avgViewers, setAvgViewers] = useState(0);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: metrics } = await api.get("/channels/mine/metrics");
      
      if (Array.isArray(metrics)) {
        // Format the date for the X-Axis
        const formatted = metrics.map((item) => {
          const d = new Date(item.created_at);
          return {
            ...item,
            timeLabel: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            rawDate: d,
          };
        });
        
        setData(formatted);

        // Calculate stats
        if (formatted.length > 0) {
          const counts = formatted.map((d) => d.viewer_count || 0);
          const max = Math.max(...counts);
          const sum = counts.reduce((acc, curr) => acc + curr, 0);
          const avg = Math.round(sum / formatted.length);
          
          setPeakViewers(max);
          setAvgViewers(avg);
          setTotalStreamHours(formatted.length);
        }
      } else {
        setError("Invalid data returned from server.");
      }
    } catch (err) {
      console.error("Failed to load stream metrics:", err);
      setError("Failed to fetch stream performance metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const fullDate = new Date(dataPoint.created_at).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      });
      return (
        <div className="border border-[#27272a] bg-[#0c0c0e] p-3 font-mono text-[11px] uppercase tracking-wider text-white shadow-xl">
          <p className="text-zinc-500 mb-1">{fullDate}</p>
          <p className="font-bold text-[#e5ff00]">
            VIEWERS: <span className="text-white">{dataPoint.viewer_count}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="border border-[#27272a] bg-[#0a0a0a] p-6" data-testid="performance-chart">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#27272a] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#e5ff00]" />
            <div className="label-caps mb-0">// STREAM PERFORMANCE METRICS</div>
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            Strict viewer counts registered across the last 24 stream hours
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          REFRESH DATA
        </button>
      </header>

      {loading ? (
        <div className="flex h-64 items-center justify-center font-mono text-xs uppercase tracking-widest text-zinc-500">
          Syncing Metrics with Firestore…
        </div>
      ) : error ? (
        <div className="flex h-64 items-center justify-center font-mono text-xs uppercase tracking-widest text-red-500">
          {error}
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-64 items-center justify-center font-mono text-xs uppercase tracking-widest text-zinc-500">
          No metrics logged yet.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sparkz TV Terminal Metrics Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="border border-[#1f1f23] bg-[#0c0c0e] p-4 font-mono">
              <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase tracking-widest">
                <Users className="h-3.5 w-3.5 text-zinc-500" />
                PEAK LIVE VIEWERS
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">
                {peakViewers} <span className="text-[10px] text-zinc-500 font-normal">MAX</span>
              </div>
            </div>

            <div className="border border-[#1f1f23] bg-[#0c0c0e] p-4 font-mono">
              <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase tracking-widest">
                <Activity className="h-3.5 w-3.5 text-zinc-500" />
                AVERAGE AUDIENCE
              </div>
              <div className="mt-2 text-2xl font-bold text-[#e5ff00] tracking-tight">
                {avgViewers} <span className="text-[10px] text-zinc-500 font-normal">AVG</span>
              </div>
            </div>

            <div className="border border-[#1f1f23] bg-[#0c0c0e] p-4 font-mono">
              <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase tracking-widest">
                <TrendingUp className="h-3.5 w-3.5 text-zinc-500" />
                MONITORED PERIOD
              </div>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">
                {totalStreamHours}h <span className="text-[10px] text-zinc-500 font-normal">LOGGED</span>
              </div>
            </div>
          </div>

          {/* Actual Chart canvas */}
          <div className="h-72 w-full border border-[#1f1f23] bg-[#08080a] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorViewers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e5ff00" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#e5ff00" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" horizontal={true} vertical={false} />
                <XAxis
                  dataKey="timeLabel"
                  stroke="#52525b"
                  fontSize={9}
                  fontFamily="monospace"
                  tickLine={false}
                  axisLine={{ stroke: "#1f1f23" }}
                />
                <YAxis
                  stroke="#52525b"
                  fontSize={9}
                  fontFamily="monospace"
                  tickLine={false}
                  axisLine={{ stroke: "#1f1f23" }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="viewer_count"
                  stroke="#e5ff00"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorViewers)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
