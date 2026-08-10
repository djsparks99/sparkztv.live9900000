import { useState } from "react";
import { Calendar, Clock, Radio, Music, Trash2, Loader2 } from "lucide-react";
import { fileUrl, api, apiErrorMessage } from "@/lib/api";
import { toast } from "sonner";

export default function ScheduleDisplay({ schedule, username, isOwner, onScheduleUpdated }) {
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (itemId) => {
    if (!itemId) {
      toast.error("Invalid schedule slot ID.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this upcoming broadcast from your schedule?")) {
      return;
    }

    setDeletingId(itemId);
    try {
      const { data } = await api.delete(`/channels/mine/schedules/${itemId}`);
      if (data && data.success) {
        toast.success("Schedule slot successfully deleted!");
        if (onScheduleUpdated) {
          onScheduleUpdated(data.schedules || []);
        }
      } else {
        toast.error("Failed to delete schedule slot.");
      }
    } catch (err) {
      toast.error(apiErrorMessage(err) || "Failed to delete schedule slot.");
    } finally {
      setDeletingId(null);
    }
  };

  if (!schedule || !Array.isArray(schedule) || schedule.length === 0) {
    return (
      <div className="border border-[#27272a] bg-[#0e0e10] p-4 md:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.4)]" data-testid="channel-schedule-display">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#e5ff00]" />
          <div className="label-caps mb-0">// BROADCAST SCHEDULE</div>
        </div>
        <div className="mt-4 border border-dashed border-[#27272a] p-5 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
            No upcoming sets scheduled at this time. Follow @{username} to get notified when they go live.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-[#27272a] bg-[#0e0e10] p-4 md:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.4)]" data-testid="channel-schedule-display">
      <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#e5ff00]" />
          <div className="label-caps mb-0">// UPCOMING BROADCAST SCHEDULE</div>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          {schedule.length} {schedule.length === 1 ? "SET" : "SETS"} PROGRAMMED
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-1 md:grid-cols-2">
        {schedule.map((item, idx) => (
          <div
            key={item.id || idx}
            className="relative flex items-center gap-4 border border-[#27272a] bg-black p-3.5 pr-10 transition-all hover:border-[#e5ff00]/50 group"
            data-testid={`public-schedule-item-${item.id || idx}`}
          >
            {isOwner && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(item.id);
                }}
                disabled={deletingId === item.id}
                className="absolute top-2 right-2 p-1.5 rounded-sm border border-transparent bg-zinc-950 text-zinc-500 hover:text-red-500 hover:border-red-500/20 hover:bg-red-500/10 transition-all duration-150 active:scale-95 z-10"
                title="Delete schedule slot"
                data-testid={`delete-schedule-item-${item.id || idx}`}
              >
                {deletingId === item.id ? (
                  <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            )}

            {item.imageUrl && (
              <div className="shrink-0 relative overflow-hidden">
                <img
                  src={fileUrl(item.imageUrl)}
                  alt=""
                  className="h-14 w-14 sm:h-16 sm:w-16 object-cover border border-[#27272a] rounded-sm grayscale-0 md:grayscale md:hover:grayscale-0 transition-all duration-300"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            <div className="flex flex-col items-center justify-center border border-[#e5ff00] bg-[#e5ff00]/10 px-2.5 py-1.5 text-center min-w-[54px] shrink-0 self-stretch justify-self-center">
              <span className="font-mono text-xs font-black text-[#e5ff00]">{item.day}</span>
              <Radio className="mt-1 h-3 w-3 text-[#e5ff00]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-400">
                  <Clock className="h-3 w-3 text-zinc-500" />
                  {item.time}
                </span>
                {item.genre && (
                  <span className="chip text-[9px] uppercase tracking-wider">
                    {item.genre}
                  </span>
                )}
              </div>
              <h3 className="mt-1.5 truncate font-display text-sm font-bold text-white tracking-wide pr-4">
                {item.title}
              </h3>
              {item.description && (
                <p className="mt-1 text-[10px] text-zinc-500 uppercase tracking-tight line-clamp-1">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
