import { useEffect, useState, useRef } from "react";

export default function AudioVisualizer({ isLive = false, analyser = null }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 220, height: 32 });

  // Number of frequency bands (32-band high-density digital readout)
  const numBars = 32;
  const barHeightsRef = useRef(Array(numBars).fill(2));
  const peakHeightsRef = useRef(Array(numBars).fill(2));
  const peakDecayRef = useRef(Array(numBars).fill(0));

  // Sensitivity State (Defaults to 1.0, ranges to 3.0)
  const [sensitivity, setSensitivity] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sparkz_visualizer_sensitivity");
      return saved ? parseFloat(saved) : 1.0;
    }
    return 1.0;
  });

  const sensitivityRef = useRef(sensitivity);
  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  const handleSensitivityChange = (val) => {
    setSensitivity(val);
    localStorage.setItem("sparkz_visualizer_sensitivity", val.toString());
  };

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

      // Limit deltaTime to avoid huge jumps on tab wake
      const dt = Math.min(deltaTime, 0.1);

      const numBars = barHeightsRef.current.length;
      const t = now * 0.001; // Time in seconds

      // Get real audio frequency data if analyser is provided
      let dataArray = null;
      let hasSignal = false;
      if (analyser) {
        try {
          const bufferLength = analyser.frequencyBinCount;
          dataArray = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(dataArray);
          // Check if there is some active signal
          hasSignal = dataArray.some((val) => val > 0);
        } catch (e) {
          console.warn("Error reading audio data from analyser:", e);
        }
      }

      for (let i = 0; i < numBars; i++) {
        let target = 2;

        if (isLive) {
          if (hasSignal && dataArray) {
            // Logarithmic/exponential spacing for bars over the frequency spectrum
            const totalBins = dataArray.length;
            const startRatio = Math.pow(i / numBars, 1.5);
            const endRatio = Math.pow((i + 1) / numBars, 1.5);
            
            let startBin = Math.floor(startRatio * totalBins);
            let endBin = Math.floor(endRatio * totalBins);
            if (endBin <= startBin) endBin = startBin + 1;
            
            let sum = 0;
            let count = 0;
            for (let bin = startBin; bin < endBin && bin < totalBins; bin++) {
              sum += dataArray[bin];
              count++;
            }
            const avg = count > 0 ? sum / count : 0;
            
            // Soft-compression power curve with user gain modulation
            const currentSens = sensitivityRef.current;
            const normalized = Math.min(1.0, (avg / 255) * currentSens);
            // Height formula leaving a tiny bit of room at the top (dimensions.height - 3)
            const peakTarget = Math.pow(normalized, 0.82) * (dimensions.height - 3) * 0.95;
            target = Math.max(2, peakTarget);
          } else {
            // Dynamic music pattern when live (fallback/muted)
            const isBass = i < Math.floor(numBars * 0.15);
            const isMid = i >= Math.floor(numBars * 0.15) && i < Math.floor(numBars * 0.65);

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
          }
        } else {
          // Calm standby sweeping wave when offline
          const sweep = Math.sin(t * 2.5 - i * 0.4) * 6;
          const pulse = Math.sin(t * 0.8) * 2;
          target = Math.max(2, 6 + sweep + pulse + Math.sin(t * 12 + i) * 1);
        }

        // Limit target height to fit the actual available height (minus some padding)
        const maxHeight = dimensions.height - 2;
        target = Math.min(maxHeight, target);

        // Professional audio-meter physics:
        // - Instantaneous Attack (jump to target if target is higher)
        // - Natural Fluid Decay (glide down at a natural gravity rate)
        const currentHeight = barHeightsRef.current[i];
        let speed = 8; // Offline speed
        if (isLive) {
          if (target > currentHeight) {
            speed = 60; // Instant response to sound transients/beat peaks
          } else {
            speed = 20; // Smooth falling decay
          }
        }
        
        const newHeight = currentHeight + (target - currentHeight) * Math.min(1, speed * dt);
        barHeightsRef.current[i] = newHeight;

        // Update Peak hold indicators
        const peak = peakHeightsRef.current[i];
        if (newHeight >= peak) {
          peakHeightsRef.current[i] = newHeight;
          peakDecayRef.current[i] = 0; // Reset decay velocity
        } else {
          // Peak holds for a brief moment, then drops quickly
          const gravity = 18; // px/sec^2
          peakDecayRef.current[i] += gravity * dt;
          const newPeak = peak - peakDecayRef.current[i] * dt;
          peakHeightsRef.current[i] = Math.max(newHeight, Math.max(2, newPeak));
        }
      }

      // Trigger re-render
      setRenderTrigger((prev) => prev + 1);

      animationId = requestAnimationFrame(updateVisualizer);
    };

    animationId = requestAnimationFrame(updateVisualizer);
    return () => cancelAnimationFrame(animationId);
  }, [isLive, dimensions.height, analyser]);

  // Compute SVG elements
  const padding = 1.2;
  const barWidth = Math.max(1.5, (dimensions.width - (numBars - 1) * padding) / numBars);

  return (
    <div 
      className="hidden md:flex flex-col justify-center flex-1 mx-8 max-w-[240px] select-none py-1"
      title={isLive ? "Active Stream Visualizer. Double click slider to reset GAIN." : "Receiver Standby"}
    >
      {/* Sized container observed for canvas/responsive width */}
      <div ref={containerRef} className="w-full h-8 flex items-center justify-center">
        <svg 
          width={dimensions.width} 
          height={dimensions.height} 
          className="overflow-visible"
        >
          <defs>
            {/* High-contrast hardware linear gradient for live audio */}
            <linearGradient id="sparkz-cyber-grad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#00f6ff" /> {/* Vibrant Neon Cyan bottom */}
              <stop offset="45%" stopColor="#00f6ff" />
              <stop offset="75%" stopColor="#e5ff00" /> {/* Branded Yellow middle */}
              <stop offset="100%" stopColor="#ff2a5f" /> {/* Warning Pink-Red peak */}
            </linearGradient>

            {/* Gray gradient for standby state */}
            <linearGradient id="sparkz-standby-grad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#52525b" />
              <stop offset="100%" stopColor="#a1a1aa" />
            </linearGradient>
          </defs>

          {/* Horizontal high-frequency grid line */}
          <line 
            x1={0} 
            y1={dimensions.height - 1} 
            x2={dimensions.width} 
            y2={dimensions.height - 1} 
            stroke="#27272a" 
            strokeWidth={0.5} 
          />

          {/* Draw Segmented Equalizer Bars and Peak holds */}
          {barHeightsRef.current.map((height, i) => {
            const x = i * (barWidth + padding);
            const midX = x + barWidth / 2;
            
            // Peak level top coordinates
            const barTopY = dimensions.height - height;
            const peakTopY = dimensions.height - peakHeightsRef.current[i];

            // Setup active theme color schemes
            const strokeColor = isLive ? "url(#sparkz-cyber-grad)" : "url(#sparkz-standby-grad)";
            const peakColor = isLive ? "#ffffff" : "#a1a1aa";

            // Define the LED block patterns
            // segment size: 2.2px block, 1px space
            const dashPattern = "2.2 1";

            return (
              <g key={i}>
                {/* 1. Background Grid Track: Empty "LED sockets" when silent */}
                <line
                  x1={midX}
                  y1={dimensions.height}
                  x2={midX}
                  y2={1}
                  stroke="#18181b"
                  strokeWidth={barWidth}
                  strokeDasharray={dashPattern}
                  opacity={0.7}
                />

                {/* 2. Audio Spectrum Bar: Stacked glowing active LEDs */}
                <line
                  x1={midX}
                  y1={dimensions.height}
                  x2={midX}
                  y2={Math.min(dimensions.height - 1, barTopY)}
                  stroke={strokeColor}
                  strokeWidth={barWidth}
                  strokeDasharray={dashPattern}
                  opacity={isLive ? 0.95 : 0.45}
                />

                {/* 3. Floating Peak indicator cell */}
                <rect
                  x={x}
                  y={Math.max(0, peakTopY - 1)}
                  width={barWidth}
                  height={1}
                  fill={peakColor}
                  opacity={isLive ? 0.9 : 0.45}
                />
              </g>
            );
          })}
        </svg>
      </div>
      
      {/* Tiny frequency labels at the very bottom */}
      <div className="w-full flex justify-between text-[6px] font-mono tracking-widest text-zinc-600 mt-0.5 px-0.5">
        <span>32Hz</span>
        <span>500Hz</span>
        <span>16kHz</span>
      </div>

      {/* Tactile Hardware Gain Control slider */}
      <div className="w-full flex items-center gap-1.5 mt-1 px-0.5 text-[7px] font-mono text-zinc-500 uppercase tracking-widest">
        <span className="text-zinc-600 font-bold">GAIN</span>
        <input
          type="range"
          min="0.2"
          max="3.0"
          step="0.1"
          value={sensitivity}
          onDoubleClick={() => handleSensitivityChange(1.0)}
          onChange={(e) => handleSensitivityChange(parseFloat(e.target.value))}
          className="flex-1 appearance-none bg-zinc-850 border border-zinc-800/60 rounded-full h-[5px] cursor-pointer outline-none transition-all
            [&::-webkit-slider-runnable-track]:bg-transparent
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-2.5
            [&::-webkit-slider-thumb]:w-2.5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-[#e5ff00]
            [&::-webkit-slider-thumb]:shadow-[0_0_4px_#e5ff00]
            [&::-webkit-slider-thumb]:transition-all
            [&::-webkit-slider-thumb]:hover:scale-125
            [&::-moz-range-thumb]:h-2.5
            [&::-moz-range-thumb]:w-2.5
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-[#e5ff00]
            [&::-moz-range-thumb]:shadow-[0_0_4px_#e5ff00]
            [&::-moz-range-thumb]:transition-all
            [&::-moz-range-thumb]:hover:scale-125"
          title="Adjust visualizer sensitivity (double click to reset)"
        />
        <span className="min-w-[28px] text-right font-bold text-[#e5ff00]/90 select-none">
          {Math.round(sensitivity * 100)}%
        </span>
      </div>
    </div>
  );
}

