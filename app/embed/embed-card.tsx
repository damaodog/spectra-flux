"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import type { LabRecipe } from "../lab/lab-core";
import { LabPreview } from "../lab/lab-preview";

export function EmbedCard({ recipe }: { recipe: LabRecipe }) {
  const rootRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.01 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateMotion();
    updateVisibility();
    media.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      media.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  const cardStyle = {
    "--card-a": recipe.palette[0],
    "--card-b": recipe.palette[1] ?? recipe.palette[0],
    "--card-radius": "10px",
  } as CSSProperties;
  const active = visible && pageVisible && !reducedMotion;

  return (
    <article
      ref={rootRef}
      className="preview-card lab-preview-card embed-card"
      style={cardStyle}
      aria-label="SPECTRA 动态卡片"
    >
      <div className="card-copy">
        <h1>SPECTRA</h1>
        <p>COLOR AS A LIVING SYSTEM.</p>
      </div>
      <div className="card-visual">
        <LabPreview
          recipe={recipe}
          playing
          active={active}
          onFallbackChange={setFallback}
        />
        {fallback ? <span className="embed-fallback">STATIC</span> : null}
      </div>
    </article>
  );
}
