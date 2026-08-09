"use client";

import { useRef, useState } from "react";
import type { LabRecipe } from "../lab/lab-core";
import { buildEmbedSnippet } from "./embed-core";

const PRODUCTION_ORIGIN = "https://spectra.8538690.xyz";

const getEmbedOrigin = () =>
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? window.location.origin
    : PRODUCTION_ORIGIN;

export function CopyEmbedButton({ recipe }: { recipe: LabRecipe }) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual" | "error">("idle");
  const [snippet, setSnippet] = useState("");
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  const copy = async () => {
    try {
      const next = buildEmbedSnippet(recipe, getEmbedOrigin());
      setSnippet(next);
      await navigator.clipboard.writeText(next);
      setStatus("copied");
    } catch (error) {
      if (error instanceof RangeError) {
        setStatus("error");
        return;
      }
      setStatus("manual");
      requestAnimationFrame(() => {
        fallbackRef.current?.focus();
        fallbackRef.current?.select();
      });
    }
  };

  return (
    <div className="embed-copy">
      <button onClick={() => void copy()}>{status === "copied" ? "已复制" : "复制 HTML"}</button>
      {status === "manual" ? (
        <label className="embed-copy-fallback">
          <span>浏览器未允许自动复制，请手动复制：</span>
          <textarea
            ref={fallbackRef}
            readOnly
            rows={3}
            value={snippet}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      ) : null}
      <span className="visually-hidden" aria-live="polite">
        {status === "copied" ? "HTML 调用代码已复制" : status === "error" ? "配方过长，无法生成调用代码" : ""}
      </span>
    </div>
  );
}
