import { useEffect, useRef } from "react";

/**
 * Lightweight canvas backdrop for the hero: a slow-drifting film-strip
 * scanline motif with subtle pointer parallax. Plain 2D canvas, not
 * Three.js — there's no spatial/3D story here, just a cheap ambient effect
 * subordinate to the hero copy. Pauses when offscreen/hidden and renders a
 * single static frame under prefers-reduced-motion.
 */
export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    let pointerX = 0.5;
    let scanY = 0;
    let raf = 0;
    let visible = true;

    function resize() {
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvasEl.width = width * dpr;
      canvasEl.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      // sprocket-hole columns, film-strip motif
      const holeGap = 34;
      const holeSize = 5;
      const columns = [24, width - 24];
      ctx!.fillStyle = "rgba(255, 255, 255, 0.05)";
      for (const x of columns) {
        for (let y = -holeGap; y < height + holeGap; y += holeGap) {
          ctx!.fillRect(x - holeSize / 2, (y + scanY * 0.05) % (height + holeGap), holeSize, holeSize);
        }
      }

      // pointer-reactive glow
      const glowX = width * (0.3 + pointerX * 0.4);
      const glow = ctx!.createRadialGradient(glowX, height * 0.35, 0, glowX, height * 0.35, width * 0.5);
      glow.addColorStop(0, "rgba(255, 90, 54, 0.12)");
      glow.addColorStop(1, "rgba(255, 90, 54, 0)");
      ctx!.fillStyle = glow;
      ctx!.fillRect(0, 0, width, height);

      // scanning line, like a script being read
      const y = scanY % (height + 120);
      const scanGrad = ctx!.createLinearGradient(0, y - 60, 0, y + 60);
      scanGrad.addColorStop(0, "rgba(255, 90, 54, 0)");
      scanGrad.addColorStop(0.5, "rgba(255, 90, 54, 0.08)");
      scanGrad.addColorStop(1, "rgba(255, 90, 54, 0)");
      ctx!.fillStyle = scanGrad;
      ctx!.fillRect(0, y - 60, width, 120);
    }

    function tick() {
      if (!visible) return;
      scanY += 0.35;
      draw();
      raf = requestAnimationFrame(tick);
    }

    function onPointerMove(e: PointerEvent) {
      pointerX = Math.min(1, Math.max(0, e.clientX / window.innerWidth));
    }

    function onVisibility() {
      visible = document.visibilityState === "visible" && !document.hidden;
      if (visible && !reduceMotion) {
        raf = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(raf);
      }
    }

    resize();
    draw();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", () => {
      visible = false;
      cancelAnimationFrame(raf);
    });
    window.addEventListener("focus", onVisibility);

    if (!reduceMotion) {
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true" />;
}
