import { useEffect, useState, useRef } from "react";

export default function AudioVisualizer({ isLive = false }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 220, height: 32 });

  // Number of frequency bands
  const numBars = 16;
  const barHeightsRef = useRef(Array(numBars).fill(2));
  const peakHeightsRef = useRef(Array(numBars).fill(2));
  const peakDecayRef = useRef(Array(numBars).fill(0));

  // Handle resizing or setting correct dimensions
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const { width, height } = entry.contentRect;
          setDimensions({
            width: width || 220,
            height: height || 32,
          });
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const [renderTrigger, setRenderTrigger] = useState(0);

  useEffect(() => {
    let animationId;
    let lastTime = performance.now();

    const updateVisualizer = (now) => {
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      const numBars = barHeightsRef.current.length;
      const t = now * 0.001; // Time in seconds

      for (let i = 0; i < numBars; i++) {
        let target = 2;

        if (isLive) {
          // Dynamic music pattern when live
          // Sub-bass (left side) pulses heavily
          const isBass = i < 3;
          const isMid = i >= 3 && i < 11;
          const isTreble = i >= 11;

          if (isBass) {
            // Pulsing bass beat + rumble
            const beat = Math.pow(Math.sin(t * 3.2), 4) * 22;
            const rumble = Math.sin(t * 15 + i) * 4;
            target = Math.max(2, beat + rumble + Math.random() * 4);
          } else if (isMid) {
            // Melodic dancing midrange waves
            const wave1 = Math.sin(t * 8 + i * 0.8) * 8;
            const wave2 = Math.sin(t * 14 - i * 0.5) * 6;
            target = Math.max(2, 10 + wave1 + wave2 + Math.random() * 5);
          } else {
            // Rapid high-frequency sizzle
            const sizzle = Math.pow(Math.sin(t * 22 + i * 2), 2) * 12;
            target = Math.max(2, 4 + sizzle + Math.random() * 6);
          }
        } else {
          // Calm standby sweeping wave when offline
          const sweep = Math.sin(t * 2.5 - i * 0.4) * 6;
          const pulse = Math.sin(t * 0.8) * 2;
          target = Math.max(2, 6 + sweep + pulse + Math.sin(t * 12 + i) * 1);
        }

        // Limit target height to fit the actual available height (minus some padding)
        const maxHeight = dimensions.height - 4;
        target = Math.min(maxHeight, target);

        // Smoothly interpolate current bar heights towards targets
        const speed = isLive ? 18 : 8;
        const currentHeight = barHeightsRef.current[i];
        const newHeight = currentHeight + (target - currentHeight) * Math.min(1, speed * deltaTime);
        barHeightsRef.current[i] = newHeight;

        // Update Peak hold dots
        const peak = peakHeightsRef.current[i];
        if (newHeight >= peak) {
          peakHeightsRef.current[i] = newHeight;
          peakDecayRef.current[i] = 0; // Reset decay velocity
        } else {
          // Peak holds for a moment, then accelerates downwards
          const gravity = 15; // px/sec^2
          peakDecayRef.current[i] += gravity * deltaTime;
          const newPeak = peak - peakDecayRef.current[i] * deltaTime;
          peakHeightsRef.current[i] = Math.max(newHeight, Math.max(2, newPeak));
        }
      }

      // Trigger re-render
      setRenderTrigger((prev) => prev + 1);

      animationId = requestAnimationFrame(updateVisualizer);
    };

    animationId = requestAnimationFrame(updateVisualizer);
    return () => cancelAnimationFrame(animationId);
  }, [isLive, dimensions.height]);

  // Compute SVG elements
  const barWidth = Math.max(2, (dimensions.width / numBars) - 2);
  const padding = 2;

  return (
    <div 
      ref={containerRef} 
      className="hidden md:flex flex-col items-center justify-center flex-1 h-9 mx-8 max-w-[240px] select-none"
      title={isLive ? "Audio Feed active: 44.1kHz" : "Receiver Standby"}
    >
      <svg 
        width={dimensions.width} 
        height={dimensions.height} 
        className="overflow-visible"
      >
        {/* Horizontal grid lines */}
        <line 
          x1={0} 
          y1={dimensions.height / 2} 
          x2={dimensions.width} 
          y2={dimensions.height / 2} 
          stroke="#27272a" 
          strokeWidth={0.5} 
          strokeDasharray="2 3" 
        />
        <line 
          x1={0} 
          y1={dimensions.height - 1} 
          x2={dimensions.width} 
          y2={dimensions.height - 1} 
          stroke="#27272a" 
          strokeWidth={0.5} 
        />

        {/* Draw Equalizer Bars and Peak hold indicators */}
        {barHeightsRef.current.map((height, i) => {
          const x = i * (barWidth + padding);
          const y = dimensions.height - height;
          const peakY = dimensions.height - peakHeightsRef.current[i];

          // Color gradient from yellow to cyan or simple branded theme color #e5ff00
          // Live gets highly saturated #e5ff00, offline gets a slightly dimmer or desaturated state
          const barColor = isLive ? "#e5ff00" : "#a1a1aa";
          const peakColor = isLive ? "#ffffff" : "#71717a";

          return (
            <g key={i}>
              {/* Spectrum Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(1, height)}
                fill={barColor}
                opacity={isLive ? 0.85 : 0.4}
                rx={0.5}
              />
              {/* Peak Dot */}
              <rect
                x={x}
                y={Math.max(0, peakY - 1)}
                width={barWidth}
                height={1}
                fill={peakColor}
                opacity={isLive ? 0.9 : 0.6}
              />
            </g>
          );
        })}
      </svg>
      
      {/* Tiny frequency labels at the very bottom */}
      <div className="w-full flex justify-between text-[6px] font-mono tracking-widest text-zinc-600 mt-0.5 px-0.5">
        <span>32Hz</span>
        <span>500Hz</span>
        <span>16kHz</span>
      </div>
    </div>
  );
}
