import { useEffect, useState, useRef } from "react";

export default function AudioVisualizer({ isLive = false, analyser = null }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 220, height: 32 });

  // Number of frequency bands
  const numBars = 28;
  const barHeightsRef = useRef(Array(numBars).fill(2));
  const peakHeightsRef = useRef(Array(numBars).fill(2));
  const peakDecayRef = useRef(Array(numBars).fill(0));

  // Sensitivity State (Defaults to 1.0, ranges from 0.2 to 3.0)
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
            const startRatio = Math.pow(i / numBars, 1.6);
            const endRatio = Math.pow((i + 1) / numBars, 1.6);
            
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
            const peakTarget = Math.pow(normalized, 0.85) * (dimensions.height - 4) * 0.90;
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
        const maxHeight = dimensions.height - 4;
        target = Math.min(maxHeight, target);

        // Smoothly interpolate current bar heights towards targets
        const speed = isLive ? (hasSignal ? 24 : 18) : 8; // Snappier response with real frequency input
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
  }, [isLive, dimensions.height, analyser]);

  // Compute SVG elements
  const padding = 1.5;
  const barWidth = Math.max(1.5, (dimensions.width - (numBars - 1) * padding) / numBars);

  return (
    <div 
      className="hidden md:flex flex-col justify-center flex-1 mx-8 max-w-[240px] select-none py-1"
      title={isLive ? "Audio Feed active. Double click slider to reset GAIN." : "Receiver Standby"}
    >
      {/* Sized container observed for canvas/responsive width */}
      <div ref={containerRef} className="w-full h-8 flex items-center justify-center">
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
