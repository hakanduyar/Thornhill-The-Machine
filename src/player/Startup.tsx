"use client";
import { useEffect, useState } from "react";

/** A timed title sequence, not a network progress indicator. */
export function Startup({ ready, onComplete }: { ready: boolean; onComplete(): void }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let elapsed = 0;
    let previous: number | null = null;
    let raf = 0;
    let cancelled = false;
    const visibility = () => { previous = null; };
    const tick = (now: number) => {
      if (cancelled) return;
      if (!document.hidden) {
        if (previous !== null) elapsed += Math.min(now - previous, 100);
        previous = now;
        if (elapsed >= 2000) { setDone(true); onComplete(); return; }
      } else previous = null;
      raf = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", visibility);
    raf = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", visibility); };
  }, [ready, onComplete]);
  if (done) return null;
  return <div className="sam-startup machine-startup" role="status" aria-label={ready ? "Resetting to real time" : "Loading"}>
    {ready ? <div className="machine-reset">RESETTING TO REAL TIME</div> : <div className="machine-wait" />}
  </div>;
}
