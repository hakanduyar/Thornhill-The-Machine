"use client";
import { useEffect, useRef } from "react";

/**
 * Readiness panel driven only by the player's real status: it is shown while
 * the scene loads and prepares, and is removed as soon as the runtime reports
 * ready (first frame rendered and presented). No timer, percentage or
 * scripted sequence is involved; errors are rendered by the player itself.
 */
export function Startup({ ready, onComplete, detail = "PREPARING SCENE", loadedBytes }: { ready: boolean; onComplete(): void; detail?: string; loadedBytes?: number }) {
  const completed = useRef(false);
  useEffect(() => {
    if (!ready || completed.current) return;
    completed.current = true;
    onComplete();
  }, [ready, onComplete]);
  if (ready || completed.current) return null;
  return <div className="sam-startup machine-startup" role="status" aria-live="polite" aria-label="Preparing scene">
    <div className="machine-panel">
      <div className="machine-panel-title">SYSTEM</div>
      <div className="machine-panel-rule" />
      <div className="machine-panel-row"><span className="machine-panel-mark" aria-hidden="true" />{detail}</div>
      {loadedBytes !== undefined && <div className="machine-panel-progress">{(loadedBytes / 1_000_000).toFixed(1)} MB received</div>}
    </div>
  </div>;
}
