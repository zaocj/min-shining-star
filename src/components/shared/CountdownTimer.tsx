import { useCountdown } from '../../hooks/useCountdown';

export default function CountdownTimer({ at, initialNow, prefix, done, theme }: {
  at: string; initialNow: number; prefix: string; done: string; theme: 'couple' | 'parents';
}) {
  const { days, hours, minutes, seconds, past } = useCountdown(at, initialNow);
  const values = [[days, '天'], [hours, '时'], [minutes, '分'], [seconds, '秒']] as const;
  if (theme === 'parents') return <div className="parents-countdown">
    <p>{past ? done : prefix}</p>
    {!past && <div className="parents-countdown-values" aria-label={`距离婚礼还有${days}天${hours}时${minutes}分${seconds}秒`}>
      {values.map(([value, label]) => <div key={label}><strong>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>)}
    </div>}
  </div>;
  return <>
    {past ? <p className="text-center text-2xl tracking-[0.3em] text-cream">{done}</p>
      : <div className="flex items-start justify-center gap-3 sm:gap-8" aria-label={`距离婚礼还有${days}天${hours}时${minutes}分${seconds}秒`}>
        {values.map(([value, label]) => <div key={label} className="flex flex-col items-center gap-2">
          <div className="flex h-18 w-16 items-center justify-center rounded-2xl border border-champagne/30 bg-cream/10 sm:h-24 sm:w-24">
            <span className="font-script text-4xl text-cream tabular-nums sm:text-5xl">{String(value).padStart(2, '0')}</span>
          </div><span className="text-xs tracking-[0.3em] text-champagne/80">{label}</span>
        </div>)}
      </div>}
    <p className="mt-10 text-center text-sm tracking-[0.3em] text-champagne/70">{prefix} {past ? '' : '还有'}</p>
  </>;
}
