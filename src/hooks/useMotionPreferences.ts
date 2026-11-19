import { useEffect, useState, type RefObject } from 'react';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return reduced;
}

export function useInView(ref: RefObject<Element | null>, amount = 0.25) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: amount });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, amount]);
  return visible;
}

export function useInvitationOpened(ref: RefObject<Element | null>, opening: 'envelope' | 'none') {
  const [opened, setOpened] = useState(opening === 'none');
  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>('[data-invitation-page]');
    if (!root) return;
    const sync = () => setOpened(root.dataset.opened === 'true');
    sync(); root.addEventListener('invitation:opened', sync);
    return () => root.removeEventListener('invitation:opened', sync);
  }, [ref]);
  return opened;
}

export function openInvitation(element: Element | null) {
  element?.closest('[data-invitation-page]')?.dispatchEvent(new CustomEvent('invitation:open'));
}
