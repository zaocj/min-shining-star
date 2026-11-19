import { useEffect, useRef } from 'react';
import Swiper from 'swiper';
import { Autoplay, EffectCoverflow, Pagination, A11y } from 'swiper/modules';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { InvitationData } from '../../../../lib/content/invitation-schema';
import { useInView, useInvitationOpened, useReducedMotion } from '../../../../hooks/useMotionPreferences';
import Image from '../../../../components/shared/Image';
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';

type Props = { photos: InvitationData['gallery']; opening: 'envelope' | 'none' };
export default function Gallery({ photos, opening }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<Swiper | null>(null);
  const pagination = useRef<HTMLDivElement>(null);
  const opened = useInvitationOpened(container, opening);
  const visible = useInView(container);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!container.current || !photos.length) return;
    const swiper = new Swiper(container.current, {
      modules: [Autoplay, EffectCoverflow, Pagination, A11y], effect: 'coverflow',
      grabCursor: true, centeredSlides: true, loop: photos.length > 1, slidesPerView: 'auto',
      speed: reduced ? 0 : 350,
      autoplay: { delay: 3200, disableOnInteraction: false, pauseOnMouseEnter: true },
      pagination: { el: pagination.current, clickable: true },
      coverflowEffect: { rotate: 28, stretch: 0, depth: 220, modifier: 1, slideShadows: false },
      a11y: { containerMessage: '婚礼相册，可左右滑动查看', paginationBulletMessage: '跳转到第 {{index}} 张照片' },
    });
    swiper.autoplay.stop(); instance.current = swiper;
    return () => { swiper.destroy(true, true); instance.current = null; };
  }, [photos, reduced]);
  useEffect(() => {
    const sync = () => {
      const swiper = instance.current;
      if (!swiper || swiper.destroyed) return;
      if (opened && visible && !document.hidden && !reduced && photos.length > 1) swiper.autoplay.start();
      else swiper.autoplay.stop();
    };
    sync(); document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [opened, visible, reduced, photos]);
  if (!photos.length) return null;
  return <div className="relative" data-reveal="">
    <div ref={container} className="swiper gallery-swiper pb-14" aria-label="婚礼相册">
      <div className="swiper-wrapper">
        {photos.map((photo) => <div className="swiper-slide w-64! sm:w-80!" key={photo.url}>
          <div className="gallery-photo relative aspect-[3/4] overflow-hidden rounded-2xl transition-all duration-500">
            <Image src={photo.url} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" className="h-full w-full object-cover" />
          </div>
        </div>)}
      </div>
      <div ref={pagination} className="swiper-pagination" />
    </div>
    {photos.length > 1 && <>
      <button type="button" aria-label="上一张" onClick={() => instance.current?.slidePrev()} className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-champagne bg-cream/90 text-primary shadow-md transition-transform active:scale-95 sm:left-[8%]"><ChevronLeft className="h-5 w-5" /></button>
      <button type="button" aria-label="下一张" onClick={() => instance.current?.slideNext()} className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-champagne bg-cream/90 text-primary shadow-md transition-transform active:scale-95 sm:right-[8%]"><ChevronRight className="h-5 w-5" /></button>
    </>}
  </div>;
}
