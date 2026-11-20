import { useEffect, useRef, useState } from 'react';
import Swiper from 'swiper';
import { A11y } from 'swiper/modules';
import { Pause, Play } from 'lucide-react';
import type { InvitationData } from '../../../lib/content/invitation-schema';
import { useInView, useInvitationOpened, useReducedMotion } from '../../../hooks/useMotionPreferences';
import Image from '../../../components/shared/Image';
import 'swiper/css';

type Props = { photos: InvitationData['gallery']; opening: 'envelope' | 'none' };
export default function ParentsGallery({ photos, opening }: Props) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [swiper, setSwiper] = useState<Swiper | null>(null);
  const [index, setIndex] = useState(0);
  const [autoPlaying, setAutoPlaying] = useState(true);
  const [touching, setTouching] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const opened = useInvitationOpened(mediaRef, opening);
  const inView = useInView(mediaRef);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!container.current || !photos.length) return;
    const instance = new Swiper(container.current, {
      modules: [A11y], loop: photos.length > 1, speed: reduced ? 0 : 350,
      simulateTouch: false, lazyPreloadPrevNext: 1,
      a11y: { wrapperLiveRegion: false, containerMessage: '婚纱相册，可左右滑动查看' },
      on: { slideChange: (current) => setIndex(current.realIndex), touchStart: () => setTouching(true), touchEnd: () => setTouching(false) },
    });
    setSwiper(instance);
    return () => { instance.destroy(true, true); };
  }, [photos, reduced]);
  useEffect(() => {
    const sync = () => setPageVisible(!document.hidden);
    sync(); document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  useEffect(() => {
    if (!opened || !inView || !pageVisible || !autoPlaying || touching || reduced || !swiper || swiper.destroyed || photos.length < 2) return;
    const timer = window.setTimeout(() => swiper.slideNext(), 2000);
    return () => window.clearTimeout(timer);
  }, [opened, inView, pageVisible, autoPlaying, touching, reduced, swiper, index, photos.length]);
  if (!photos.length) return null;
  return <section className="parents-gallery" aria-label="新人婚纱相册">
    <div className="parents-gallery-copy"><h2>良缘天定<br />佳偶天成</h2><p>从此，良辰与共<br />往后，美景同看</p></div>
    <div className="parents-gallery-media" ref={mediaRef}>
      <div className="parents-gallery-photo">
        <div className="swiper parents-gallery-swiper" ref={container}>
          <div className="swiper-wrapper">{photos.map((photo) => <div key={photo.url} className="swiper-slide">
            <Image src={photo.url} alt={photo.alt} width={photo.width} height={photo.height} className="aspect-[3/4] w-full" loading="lazy" draggable={false} />
          </div>)}</div>
        </div>
      </div>
      <div className="parents-gallery-status">
        <span className="parents-gallery-hint">{photos.length > 1 ? '左右滑动' : '婚纱相册'}</span>
        <span aria-live={autoPlaying ? 'off' : 'polite'}>{String(index + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}</span>
        {photos.length > 1 && <button type="button" aria-label={autoPlaying ? '暂停相册自动播放' : '继续相册自动播放'} onClick={() => setAutoPlaying(!autoPlaying)}>{autoPlaying ? <Pause size={18} /> : <Play size={18} />}</button>}
      </div>
    </div>
  </section>;
}
