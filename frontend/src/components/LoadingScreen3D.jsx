import React, { useState, useEffect, useRef } from 'react';

export default function LoadingScreen3D({ onComplete }) {
  const [progress, setProgress] = useState(1);
  const [exiting, setExiting] = useState(false);
  const canvasRef = useRef(null);

  // 1. Smooth 1 -> 100% Counter with variable acceleration
  useEffect(() => {
    let current = 1;
    const interval = setInterval(() => {
      // Accelerate nicely toward 100
      const step = current < 35 ? 2 : current < 80 ? 3 : 2;
      current = Math.min(100, current + step);
      setProgress(current);

      if (current >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setExiting(true);
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 550);
        }, 250);
      }
    }, 32);

    return () => clearInterval(interval);
  }, [onComplete]);

  // 2. Full 3D Warp Tunnel & Rotating Gyro-Rings Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // 3D Warp Stars
    const stars = Array.from({ length: 110 }, (_, i) => ({
      x: (Math.random() - 0.5) * 1600,
      y: (Math.random() - 0.5) * 1000,
      z: Math.random() * 1000 + 50,
      isRed: i % 3 === 0
    }));

    // 3D Sphere / Gyro Ring Points
    const ringPoints = [];
    const numLat = 6;
    const numLon = 16;
    const radius = 190;
    for (let i = 0; i < numLat; i++) {
      const lat = (Math.PI * (i + 1)) / (numLat + 1) - Math.PI / 2;
      for (let j = 0; j < numLon; j++) {
        const lon = (2 * Math.PI * j) / numLon;
        ringPoints.push({
          x: radius * Math.cos(lat) * Math.cos(lon),
          y: radius * Math.sin(lat),
          z: radius * Math.cos(lat) * Math.sin(lon),
          isRed: (i + j) % 3 === 0
        });
      }
    }

    let angleX = 0;
    let angleY = 0;
    let angleZ = 0;

    const render = () => {
      ctx.fillStyle = 'rgba(14, 14, 18, 0.32)';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      angleY += 0.018;
      angleX += 0.011;
      angleZ += 0.007;

      // Warp speed starfield
      stars.forEach((s) => {
        s.z -= 12;
        if (s.z <= 10) {
          s.z = 1000;
          s.x = (Math.random() - 0.5) * 1600;
          s.y = (Math.random() - 0.5) * 1000;
        }
        const scale = 420 / s.z;
        const sx = cx + s.x * scale;
        const sy = cy + s.y * scale;

        const prevScale = 420 / (s.z + 28);
        const px = cx + s.x * prevScale;
        const py = cy + s.y * prevScale;

        ctx.strokeStyle = s.isRed
          ? `rgba(255, 42, 42, ${Math.min(0.9, scale * 0.45)})`
          : `rgba(192, 192, 200, ${Math.min(0.75, scale * 0.35)})`;
        ctx.lineWidth = Math.max(1, scale * 1.4);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      });

      // Project & Draw 3D Gyro-Sphere around the typography
      const projected = ringPoints.map((p) => {
        // Rotate Y
        let x1 = p.x * Math.cos(angleY) - p.z * Math.sin(angleY);
        let z1 = p.z * Math.cos(angleY) + p.x * Math.sin(angleY);
        // Rotate X
        let y1 = p.y * Math.cos(angleX) - z1 * Math.sin(angleX);
        let z2 = z1 * Math.cos(angleX) + p.y * Math.sin(angleX);
        // Rotate Z
        let x2 = x1 * Math.cos(angleZ) - y1 * Math.sin(angleZ);
        let y2 = y1 * Math.cos(angleZ) + x1 * Math.sin(angleZ);

        const depth = z2 + 520;
        const scale = 440 / Math.max(80, depth);
        return {
          x: cx + x2 * scale,
          y: cy + y2 * scale,
          scale,
          isRed: p.isRed
        };
      });

      // Connect nearby 3D gyro vertices
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 82) {
            const alpha = (1 - dist / 82) * 0.25;
            ctx.strokeStyle =
              projected[i].isRed || projected[j].isRed
                ? `rgba(255, 42, 42, ${alpha})`
                : `rgba(192, 192, 200, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.stroke();
          }
        }
      }

      projected.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1.3, pt.scale * 2.1), 0, Math.PI * 2);
        ctx.fillStyle = pt.isRed ? '#FF2A2A' : '#E2E8F0';
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Dynamic loading status label based on progress
  const statusLabel =
    progress < 30
      ? 'INITIALIZING 3D CONVERSATIONAL CORE...'
      : progress < 65
      ? 'CONNECTING LIVE INDIAN SHOPPING INVENTORY...'
      : progress < 95
      ? 'CALIBRATING 6-MONTH PRICE INTELLIGENCE...'
      : 'READY • LAUNCHING KHOJO AI VAULT';

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#0E0E12] flex flex-col items-center justify-center overflow-hidden select-none transition-all duration-500 ${
        exiting ? 'opacity-0 scale-110 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{ perspective: '1200px' }}
    >
      {/* 3D WebGL-Style Warp & Gyro Sphere Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Ambient Signal Red & Moonlit Silver Radial Glow */}
      <div className="absolute w-[340px] sm:w-[520px] h-[340px] sm:h-[520px] rounded-full bg-[#FF2A2A]/15 blur-[130px] pointer-events-none" />

      {/* 3D Floating Center Stage */}
      <div
        className="relative z-10 flex flex-col items-center text-center px-4 max-w-3xl w-full"
        style={{
          transform: `rotateX(${(50 - progress * 0.5) * 0.15}deg) translateZ(20px)`,
          transformStyle: 'preserve-3d'
        }}
      >
        {/* Top Cyber Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#18181F]/90 border border-[#C0C0C8]/30 text-[10px] sm:text-xs font-bold uppercase tracking-[0.28em] text-[#C0C0C8] mb-5 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-[#FF2A2A] animate-ping" />
          <span>NEXT-GEN AI COMMERCE ENGINE</span>
        </div>

        {/* 3D Extruded Typography: KHOJO AI */}
        <h1
          className="font-harmond text-6xl sm:text-8xl md:text-9xl font-extrabold tracking-wider leading-none text-white"
          style={{
            textShadow:
              '0 4px 0 #272730, 0 8px 0 #18181E, 0 18px 45px rgba(255, 42, 42, 0.45)'
          }}
        >
          KHOJO{' '}
          <span className="italic bg-gradient-to-r from-[#C0C0C8] via-white to-[#FF2A2A] bg-clip-text text-transparent">
            AI
          </span>
        </h1>

        {/* Subtitle: where shopping made eazyyy */}
        <p className="mt-3 sm:mt-4 text-sm sm:text-xl md:text-2xl font-medium tracking-[0.18em] lowercase text-[#E2E8F0]">
          where shopping made{' '}
          <span className="font-harmond italic font-bold text-xl sm:text-3xl text-[#FF2A2A] tracking-widest underline decoration-[#C0C0C8]/40 underline-offset-4">
            eazyyy
          </span>
        </p>

        {/* 3D Digital 1 - 100 Counter + Circular Ring */}
        <div className="mt-8 sm:mt-10 relative flex items-center justify-center">
          <svg className="w-36 h-36 sm:w-44 sm:h-44 -rotate-90" viewBox="0 0 140 140">
            <circle
              cx="70"
              cy="70"
              r="58"
              fill="none"
              stroke="rgba(192, 192, 200, 0.14)"
              strokeWidth="4"
            />
            <circle
              cx="70"
              cy="70"
              r="58"
              fill="none"
              stroke="#FF2A2A"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="364"
              strokeDashoffset={364 - (364 * progress) / 100}
              className="transition-all duration-75"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex items-baseline">
              <span className="font-harmond text-5xl sm:text-6xl font-extrabold text-white tracking-tight">
                {progress}
              </span>
              <span className="text-lg sm:text-xl font-bold text-[#FF2A2A] ml-0.5">
                %
              </span>
            </div>
            <span className="text-[9px] uppercase tracking-[0.25em] text-[#C0C0C8] mt-0.5">
              LOADED
            </span>
          </div>
        </div>

        {/* Sleek Horizontal 3D Progress Bar */}
        <div className="w-64 sm:w-80 h-1.5 rounded-full bg-[#1C1C24] border border-[#C0C0C8]/20 overflow-hidden mt-6 p-[1px]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#C0C0C8] via-[#FF2A2A] to-white transition-all duration-75 shadow-[0_0_15px_#FF2A2A]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Dynamic Telemetry Status */}
        <p className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.22em] text-[#C0C0C8] mt-3">
          {statusLabel}
        </p>
      </div>
    </div>
  );
}