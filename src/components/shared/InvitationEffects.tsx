import { useEffect, useRef, useState } from 'react';
import { Music, Pause } from 'lucide-react';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { useReducedMotion } from '../../hooks/useMotionPreferences';

export default function InvitationEffects({ musicUrl, autoScroll }: { musicUrl: string | null; autoScroll: boolean }) {
  const anchor = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [opened, setOpened] = useState(false);
  const [playing, setPlaying] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const root = anchor.current?.closest<HTMLElement>('[data-invitation-page]');
    const main = root?.querySelector<HTMLElement>('main');
    if (!root || !main) return;
    const previousOverflow = document.body.style.overflow;
    const update = () => {
      const isOpen = root.dataset.opened === 'true';
      main.inert = !isOpen;
      main.setAttribute('aria-hidden', String(!isOpen));
      document.body.style.overflow = isOpen ? previousOverflow : 'hidden';
      setOpened(isOpen);
    };
    const open = () => {
      root.dataset.opened = 'true'; update();
      window.scrollTo({ top: 0, behavior: 'instant' });
      const heading = main.querySelector<HTMLElement>('h1') ?? main;
      heading.tabIndex = -1; heading.focus({ preventScroll: true });
      root.dispatchEvent(new CustomEvent('invitation:opened'));
    };
    root.dataset.enhanced = 'true';
    root.addEventListener('invitation:open', open); update();
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { (entry.target as HTMLElement).dataset.visible = 'true'; observer.unobserve(entry.target); }
    }), { threshold: 0.1 });
    root.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element));
    return () => {
      root.removeEventListener('invitation:open', open); observer.disconnect();
      delete root.dataset.enhanced; main.inert = false; main.removeAttribute('aria-hidden');
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const gestures = ['pointerdown', 'touchstart', 'keydown', 'click'] as const;
    let disposed = false;
    const detach = () => gestures.forEach((event) => window.removeEventListener(event, retry));
    function retry(event: Event) {
      if ((event.target as Element | null)?.closest?.('.music-toggle')) return;
      if (!disposed) void audio?.play().then(() => { if (!disposed) detach(); }, () => {});
    }
    const sync = () => { setPlaying(!audio.paused); if (!audio.paused) detach(); };
    gestures.forEach((event) => window.addEventListener(event, retry, { passive: true }));
    audio.addEventListener('play', sync); audio.addEventListener('pause', sync);
    return () => { disposed = true; detach(); audio.removeEventListener('play', sync); audio.removeEventListener('pause', sync); };
  }, [musicUrl]);

  useAutoScroll(opened && autoScroll && !reduced);
  return <div ref={anchor}>
    {musicUrl && <>
      <audio ref={audioRef} src={musicUrl} loop preload="none" />
      <button type="button" className={`music-toggle fixed z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-cream shadow-lg shadow-primary/40 transition-transform active:scale-95 ${playing ? 'motion-safe:animate-[spin_6s_linear_infinite]' : ''}`}
        aria-label={playing ? '暂停音乐' : '播放音乐'} onClick={() => {
          const audio = audioRef.current;
          if (audio?.paused) void audio.play().catch(() => {}); else audio?.pause();
        }}>
        {playing ? <Pause className="h-5 w-5" /> : <Music className="h-5 w-5" />}
      </button>
    </>}
  </div>;
}
