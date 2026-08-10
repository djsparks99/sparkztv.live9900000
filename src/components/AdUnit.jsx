import { useEffect, useState } from "react";

export default function AdUnit() {
  return (
    <div 
      id="frame" 
      className="w-full py-6 bg-[#050505] border-t border-zinc-900 flex justify-center items-center"
      style={{ margin: "auto", position: "relative", zIndex: 99998 }}
    >
      <div className="w-full max-w-7xl px-6 flex flex-col items-center">
        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-600 mb-2">
          // SPONSORED TRANSMISSION
        </div>
        <iframe 
          data-aa="2451631" 
          src="//acceptable.a-ads.com/2451631/?size=Adaptive&background_color=000000&title_color=ffffff&title_hover_color=dcff00&link_color=f2ff00"
          style={{ 
            border: 0, 
            padding: 0, 
            width: "70%", 
            height: "90px", 
            overflow: "hidden", 
            display: "block", 
            margin: "auto" 
          }}
          title="Advertisement"
        />
      </div>
    </div>
  );
}
