import { useEffect, useRef } from "react";

/**
 * High-performance animated nebula background.
 * - Static gradient nebula painted to an offscreen canvas (no per-frame cost).
 * - Twinkling parallax starfield (3 layers) for a 3D feel.
 * - Two crossing comets traveling on opposite diagonals.
 * - Pauses when tab/window is hidden. Respects prefers-reduced-motion.
 */
const NebulaBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: true })!;
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0;
    let nebula: HTMLCanvasElement | null = null;
    let stars: { x: number; y: number; r: number; layer: number; tw: number; ph: number }[] = [];

    type Comet = { x: number; y: number; vx: number; vy: number; len: number; life: number; max: number; hue: number };
    let comets: Comet[] = [];

    const buildNebula = () => {
      // Offscreen canvas with the static colorful gradient nebula
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const g = c.getContext("2d")!;
      g.fillStyle = "#03020a";
      g.fillRect(0, 0, w, h);

      const blobs = [
        { x: w * 0.2, y: h * 0.25, r: Math.max(w, h) * 0.55, color: "rgba(220, 38, 95, 0.55)" },   // pink/red
        { x: w * 0.85, y: h * 0.15, r: Math.max(w, h) * 0.5,  color: "rgba(99, 102, 241, 0.45)" }, // indigo
        { x: w * 0.7, y: h * 0.85, r: Math.max(w, h) * 0.6,  color: "rgba(168, 85, 247, 0.4)" }, // purple
        { x: w * 0.1, y: h * 0.9,  r: Math.max(w, h) * 0.5,  color: "rgba(244, 114, 22, 0.35)" }, // orange
        { x: w * 0.5, y: h * 0.5,  r: Math.max(w, h) * 0.4,  color: "rgba(14, 165, 233, 0.25)" },  // cyan accent
      ];
      g.globalCompositeOperation = "screen";
      for (const b of blobs) {
        const grad = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        grad.addColorStop(0, b.color);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
      }
      g.globalCompositeOperation = "source-over";

      // Vignette
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.7)");
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);
      nebula = c;
    };

    const buildStars = () => {
      const density = Math.min(0.00018, 0.00022);
      const count = Math.floor(w * h * density);
      stars = new Array(count).fill(0).map(() => {
        const layer = Math.random() < 0.6 ? 0 : Math.random() < 0.85 ? 1 : 2; // 0 = far, 2 = near
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: layer === 2 ? Math.random() * 1.6 + 0.8 : layer === 1 ? Math.random() * 1.0 + 0.4 : Math.random() * 0.6 + 0.2,
          layer,
          tw: Math.random() * 0.6 + 0.4,
          ph: Math.random() * Math.PI * 2,
        };
      });
    };

    const spawnComets = () => {
      // Two comets on opposite diagonals
      comets = [
        { x: -100, y: h * 0.15, vx: 6.5, vy: 2.2, len: 220, life: 0, max: 1, hue: 12 },   // top-left → bottom-right
        { x: w + 100, y: h * 0.85, vx: -5.5, vy: -1.8, len: 200, life: 0, max: 1, hue: 280 }, // bottom-right → top-left
      ];
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildNebula();
      buildStars();
      spawnComets();
    };

    let raf = 0;
    let t0 = performance.now();
    let running = true;
    let cometRespawn = [0, 0];

    const drawComet = (c: Comet) => {
      const grad = ctx.createLinearGradient(c.x, c.y, c.x - c.vx * 30, c.y - c.vy * 30);
      grad.addColorStop(0, `hsla(${c.hue}, 100%, 75%, 0.95)`);
      grad.addColorStop(0.4, `hsla(${c.hue}, 100%, 60%, 0.4)`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      // Tail length proportional to velocity
      const tailX = c.x - c.vx * (c.len / Math.hypot(c.vx, c.vy));
      const tailY = c.y - c.vy * (c.len / Math.hypot(c.vx, c.vy));
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      // Head glow
      const hg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 9);
      hg.addColorStop(0, `hsla(${c.hue}, 100%, 90%, 1)`);
      hg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
      ctx.fill();
    };

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(64, now - t0); t0 = now;
      const time = now * 0.001;

      // Background nebula (cheap blit)
      if (nebula) ctx.drawImage(nebula, 0, 0, w, h);

      // Slow nebula breathing tint (very cheap — single full-canvas alpha rect)
      ctx.fillStyle = `rgba(120, 30, 60, ${0.04 + Math.sin(time * 0.4) * 0.02})`;
      ctx.fillRect(0, 0, w, h);

      // Stars with parallax + twinkle
      const drift = time * 6;
      for (const s of stars) {
        const speed = s.layer === 2 ? 0.08 : s.layer === 1 ? 0.04 : 0.015;
        const x = (s.x + drift * speed) % w;
        const a = 0.4 + Math.sin(time * 1.5 + s.ph) * 0.45 * s.tw;
        ctx.fillStyle = `rgba(255, 240, 250, ${Math.max(0.1, a)})`;
        ctx.beginPath();
        ctx.arc(x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Comets
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < comets.length; i++) {
        const c = comets[i];
        c.x += c.vx * (dt / 16);
        c.y += c.vy * (dt / 16);
        drawComet(c);
        const out = c.x < -300 || c.x > w + 300 || c.y < -200 || c.y > h + 200;
        if (out) {
          // respawn after a delay so they aren't constantly on screen
          if (!cometRespawn[i]) cometRespawn[i] = now + 2500 + Math.random() * 4000;
          if (now > cometRespawn[i]) {
            cometRespawn[i] = 0;
            const fromLeft = i === 0;
            c.x = fromLeft ? -150 : w + 150;
            c.y = fromLeft ? Math.random() * h * 0.4 : h * 0.5 + Math.random() * h * 0.4;
            c.vx = fromLeft ? 5 + Math.random() * 3 : -(5 + Math.random() * 3);
            c.vy = fromLeft ? 1.5 + Math.random() * 1.5 : -(1.5 + Math.random() * 1.5);
            c.hue = fromLeft ? 0 + Math.random() * 30 : 260 + Math.random() * 40;
          }
        }
      }
      ctx.globalCompositeOperation = "source-over";

      raf = requestAnimationFrame(tick);
    };

    resize();
    if (!reduceMotion) raf = requestAnimationFrame(tick);
    else if (nebula) ctx.drawImage(nebula, 0, 0, w, h);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!reduceMotion && !running) { running = true; t0 = performance.now(); raf = requestAnimationFrame(tick); }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

export default NebulaBackground;
