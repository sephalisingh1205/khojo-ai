import React, { useEffect, useRef } from 'react';

export default function Interactive3DBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    let width = (canvas.width = canvas.parentElement.offsetWidth);
    let height = (canvas.height = canvas.parentElement.offsetHeight);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.offsetWidth;
      height = canvas.height = canvas.parentElement.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / width - 0.5) * 2;
      mouseY = ((e.clientY - rect.top) / height - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 3D Particles in Charcoal/Silver/Signal Red space
    const particles = Array.from({ length: 48 }, (_, i) => ({
      x: (Math.random() - 0.5) * 600,
      y: (Math.random() - 0.5) * 350,
      z: Math.random() * 400 + 80,
      isRed: i % 4 === 0
    }));

    let angleX = 0;
    let angleY = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      angleY += 0.004 + mouseX * 0.008;
      angleX += 0.002 + mouseY * 0.008;

      const cx = width / 2;
      const cy = height / 2;

      const projected = particles.map((p) => {
        // Rotate around Y
        const cosY = Math.cos(angleY);
        const sinY = Math.sin(angleY);
        let x1 = p.x * cosY - p.z * sinY;
        let z1 = p.z * cosY + p.x * sinY;

        // Rotate around X
        const cosX = Math.cos(angleX);
        const sinX = Math.sin(angleX);
        let y1 = p.y * cosX - z1 * sinX;
        let z2 = z1 * cosX + p.y * sinX + 420;

        const scale = 340 / Math.max(60, z2);
        return {
          x: cx + x1 * scale,
          y: cy + y1 * scale,
          scale,
          isRed: p.isRed
        };
      });

      // Draw 3D constellation mesh lines
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 115) {
            const alpha = (1 - dist / 115) * 0.22;
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

      // Draw glowing nodes
      projected.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1.5, pt.scale * 2.4), 0, Math.PI * 2);
        ctx.fillStyle = pt.isRed ? '#FF2A2A' : '#E2E8F0';
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none opacity-65"
    />
  );
}