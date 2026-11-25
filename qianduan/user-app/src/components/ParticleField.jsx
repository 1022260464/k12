import { useEffect, useRef } from "react";
import { EXPERIENCE } from "../experience/experience.js";

const PALETTES = {
  [EXPERIENCE.PRIMARY]: ["255,176,66", "64,190,168", "80,150,230"],
  [EXPERIENCE.TEEN]: ["119,97,214", "38,190,230", "36,170,140"],
};

export function ParticleField({ experience = EXPERIENCE.TEEN }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext("2d");
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const palette = PALETTES[experience] || PALETTES[EXPERIENCE.TEEN];
    let width = 0;
    let height = 0;
    let frame = 0;
    let particles = [];
    let resizeFrame = 0;

    function createParticle() {
      const angle = Math.random() * Math.PI * 2;
      const speed = reduceMotion ? 0 : 0.08 + Math.random() * 0.22;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 1.1 + Math.random() * 2.2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: palette[Math.floor(Math.random() * palette.length)],
        alpha: 0.25 + Math.random() * 0.48,
      };
    }

    function resize() {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        const count = width < 720 ? 20 : 40;
        particles = Array.from({ length: count }, createParticle);
      });
    }

    function draw() {
      context.clearRect(0, 0, width, height);
      particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < -8) particle.x = width + 8;
        if (particle.x > width + 8) particle.x = -8;
        if (particle.y < -8) particle.y = height + 8;
        if (particle.y > height + 8) particle.y = -8;

        context.beginPath();
        context.fillStyle = `rgba(${particle.color},${particle.alpha})`;
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();

        for (let otherIndex = index + 1; otherIndex < particles.length; otherIndex += 1) {
          const other = particles[otherIndex];
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distance = Math.hypot(dx, dy);
          if (distance >= 110) continue;
          context.beginPath();
          context.strokeStyle = `rgba(${particle.color},${(1 - distance / 110) * 0.12})`;
          context.lineWidth = 0.7;
          context.moveTo(particle.x, particle.y);
          context.lineTo(other.x, other.y);
          context.stroke();
        }
      });
      if (!reduceMotion) frame = window.requestAnimationFrame(draw);
    }

    resize();
    frame = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(resizeFrame);
    };
  }, [experience]);

  return <canvas ref={canvasRef} className="fx-particle-field" aria-hidden="true" />;
}
