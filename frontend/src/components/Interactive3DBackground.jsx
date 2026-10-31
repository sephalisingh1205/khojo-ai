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

    let targetRotX = 0;
    let targetRotY = 0;
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      targetRotY = ((e.clientX - rect.left) / width - 0.5) * 1.4;
      targetRotX = ((e.clientY - rect.top) / height - 0.5) * 1.4;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 3D Octahedron / Cyber-Crystal Core Vertices
    const coreRadius = 155;
    const coreVertices = [
      { x: 0, y: -coreRadius, z: 0 },
      { x: 0, y: coreRadius, z: 0 },
      { x: -coreRadius, y: 0, z: 0 },
      { x: coreRadius, y: 0, z: 0 },
      { x: 0, y: 0, z: -coreRadius },
      { x: 0, y: 0, z: coreRadius },
      { x: -95, y: -95, z: -95 },
      { x: 95, y: -95, z: -95 },
      { x: 95, y: 95, z: -95 },
      { x: -95, y: 95, z: -95 },
      { x: -95, y: -95, z: 95 },
      { x: 95, y: -95, z: 95 },
      { x: 95, y: 95, z: 95 },
      { x: -95, y: 95, z: 95 }
    ];

    // 3D Ambient Particles
    const particles = Array.from({ length: 56 }, (_, i) => ({
      x: (Math.random() - 0.5) * 900,
      y: (Math.random() - 0.5) * 480,
      z: (Math.random() - 0.5) * 500,
      isRed: i % 3 === 0
    }));

    let rotX = 0;
    let rotY = 0;

    const project3D = (pt, rx, ry, cx, cy) => {
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      let x1 = pt.x * cosY - pt.z * sinY;
      let z1 = pt.z * cosY + pt.x * sinY;

      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      let y1 = pt.y * cosX - z1 * sinX;
      let z2 = z1 * cosX + pt.y * sinX + 460;

      const scale = 390 / Math.max(80, z2);
      return {
        x: cx + x1 * scale,
        y: cy + y1 * scale,
        scale,
        z: z2
      };
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      rotY += 0.006 + (targetRotY - rotY) * 0.03;
      rotX += 0.003 + (targetRotX - rotX) * 0.03;

      const cx = width / 2;
      const cy = height / 2;

      // 1. Render 3D Rotating Wireframe Core
      const projCore = coreVertices.map((v) => project3D(v, rotX, rotY, cx, cy));
      for (let i = 0; i < projCore.length; i++) {
        for (let j = i + 1; j < projCore.length; j++) {
          const dx = projCore[i].x - projCore[j].x;
          const dy = projCore[i].y - projCore[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 210) {
            const alpha = (1 - dist / 210) * 0.35;
            ctx.strokeStyle =
              (i + j) % 3 === 0
                ? `rgba(255, 42, 42, ${alpha})`
                : `rgba(192, 192, 200, ${alpha})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(projCore[i].x, projCore[i].y);
            ctx.lineTo(projCore[j].x, projCore[j].y);
            ctx.stroke();
          }
        }
      }

      // 2. Render 3D Floating Constellation Nodes
      const projParticles = particles.map((p) => ({
        ...project3D(p, rotX * 0.6, rotY * 0.6, cx, cy),
        isRed: p.isRed
      }));

      projParticles.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1.2, pt.scale * 2.2), 0, Math.PI * 2);
        ctx.fillStyle = pt.isRed
          ? 'rgba(255, 42, 42, 0.85)'
          : 'rgba(192, 192, 200, 0.75)';
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
      className="absolute inset-0 w-full h-full pointer-events-none opacity-80"
    />
  );
}