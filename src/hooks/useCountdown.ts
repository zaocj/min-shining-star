import { useEffect, useState } from 'react';

export function countdownParts(target: number, now: number) {
  const remaining = Math.max(0, target - now);
  const seconds = Math.floor(remaining / 1000);
  return { days: Math.floor(seconds / 86400), hours: Math.floor(seconds % 86400 / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60, past: remaining === 0 };
}

export function useCountdown(targetIso: string, initialNow: number) {
  const target = Date.parse(targetIso);
  // The exact same timestamp is serialized into SSR and the first hydration render.
  const [parts, setParts] = useState(() => countdownParts(target, initialNow));
  useEffect(() => {
    const update = () => setParts(countdownParts(target, Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [target]);
  return parts;
}
