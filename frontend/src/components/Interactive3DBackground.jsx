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

    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetRotX = 0;
    let targetRotY = 0;

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
      targetRotY = ((mouseX / width) - 0.5) * 1.6;
      targetRotX = ((mouseY / height) - 0.5) * 1.2;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 3D Torus / Cyber Shopping Ring Vertices
    const ringVertices = [];
    const majorR = 230;
    const minorR = 65;
    for (let i = 0; i < 18; i++) {
      const u = (i / 18) * Math.PI * 2;
      for (let j = 0; j < 8; j++) {
        const v = (j / 8) * Math.PI * 2;
        ringVertices.push({
          x: (majorR + minorR * Math.cos(v)) * Math.cos(u),
          y: (majorR + minorR * Math.cos(v)) * Math.sin(u),
          z: minorR * Math.sin(v),
          isRed: (i + j) % 3 === 0
        });
      }
    }

    // 3D Floating Shopping Tag Particles
    const labels = ['₹499', '55% OFF', 'DEAL', '★ 4.8', 'STEAL', 'AI PICK', 'PRICE DROP', 'LIVE'];
    const particles = Array.from({ length: 42 }, (_, i) => ({
      x: (Math.random() - 0.5) * 1100,
      y: (Math.random() - 0.5) * 580,
      z: Math.random() * 500 + 60,
      vz: -(Math.random() * 1.4 + 0.4),
      isRed: i % 3 === 0,
      tag: i % 5 === 0 ? labels[i % labels.length] : null
    }));

    let rotX = 0.35;
    let rotY = 0;
    let gridOffset = 0;

    const project3D = (pt, rx, ry, cx, cy) => {
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      let x1 = pt.x * cosY - pt.z * sinY;
      let z1 = pt.z * cosY + pt.x * sinY;

      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      let y1 = pt.y * cosX - z1 * sinX;
      let z2 = z1 * cosX + pt.y * sinX + 520;

      const scale = 420 / Math.max(70, z2);
      return {
        x: cx + x1 * scale,
        y: cy + y1 * scale,
        scale,
        z: z2
      };
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // 1. Dynamic Mouse-Following Signal Red & Silver Spotlight
      const spotGrad = ctx.createRadialGradient(
        mouseX,
        mouseY,
        10,
        mouseX,
        mouseY,
        360
      );
      spotGrad.addColorStop(0, 'rgba(255, 42, 42, 0.16)');
      spotGrad.addColorStop(0.5, 'rgba(192, 192, 200, 0.05)');
      spotGrad.addColorStop(1, 'rgba(18, 18, 21, 0)');
      ctx.fillStyle = spotGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. 3D Moving Perspective Horizon Grid
      gridOffset = (gridOffset + 0.6) % 40;
      const horizonY = height * 0.68;
      ctx.strokeStyle = 'rgba(255, 42, 42, 0.12)';
      ctx.lineWidth = 1;

      for (let i = -12; i <= 12; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 35, horizonY);
        ctx.lineTo(cx + i * 190, height + 40);
        ctx.stroke();
      }

      for (let y = horizonY; y < height; y += 26) {
        const drawY = y + (gridOffset * ((y - horizonY) / (height - horizonY)));
        if (drawY < height) {
          ctx.strokeStyle = `rgba(192, 192, 200, ${((drawY - horizonY) / (height - horizonY)) * 0.18})`;
          ctx.beginPath();
          ctx.moveTo(0, drawY);
          ctx.lineTo(width, drawY);
          ctx.stroke();
        }
      }

      // 3. Rotate & Render 3D Cyber Shopping Ring
      rotY += 0.005 + (targetRotY - rotY) * 0.04;
      rotX += 0.002 + (targetRotX - rotX) * 0.04;

      const projRing = ringVertices.map((v) => project3D(v, rotX, rotY, cx, cy));
      for (let i = 0; i < projRing.length; i++) {
        const next = projRing[(i + 1) % projRing.length];
        const dx = projRing[i].x - next.x;
        const dy = projRing[i].y - next.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 95) {
          ctx.strokeStyle = projRing[i].isRed
            ? 'rgba(255, 42, 42, 0.22)'
            : 'rgba(192, 192, 200, 0.16)';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(projRing[i].x, projRing[i].y);
          ctx.lineTo(next.x, next.y);
          ctx.stroke();
        }
      }

      // 4. Render Floating 3D Price & Deal Nodes Moving Toward User
      particles.forEach((p) => {
        p.z += p.vz;
        if (p.z < 60) {
          p.z = 550;
          p.x = (Math.random() - 0.5) * 1100;
          p.y = (Math.random() - 0.5) * 550;
        }
        const pt = project3D(p, rotX * 0.3, rotY * 0.3, cx, cy);

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1.5, pt.scale * 2.5), 0, Math.PI * 2);
        ctx.fillStyle = p.isRed
          ? 'rgba(255, 42, 42, 0.85)'
          : 'rgba(226, 232, 240, 0.75)';
        ctx.fill();

        if (p.tag && pt.scale > 0.75) {
          ctx.font = `bold ${Math.round(pt.scale * 10)}px Plus Jakarta Sans, sans-serif`;
          ctx.fillStyle = p.isRed
            ? 'rgba(255, 80, 80, 0.75)'
            : 'rgba(192, 192, 200, 0.65)';
          ctx.fillText(p.tag, pt.x + 6, pt.y + 3);
        }
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
      className="absolute inset-0 w-full h-full pointer-events-none opacity-95"
    />
  );
}