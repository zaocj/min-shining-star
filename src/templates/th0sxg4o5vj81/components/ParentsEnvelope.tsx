import { useEffect, useRef, useState } from 'react';
import { openInvitation, useReducedMotion } from "@/hooks/useMotionPreferences";
import { ArrowDown } from 'lucide-react';
import type { InvitationData } from '@/lib/content/invitation-schema';
import '../theme.css';
/** 父母版独立封面；打开折页后才移交给正文，不影响新人版信封。 */
export default function ParentsEnvelope({ people, dateText, weekdayText, envelopeRoles, hostSignature }: {
  people: InvitationData['people']; dateText: string; weekdayText: string; envelopeRoles: string | null; hostSignature: string | null;
}) {
    const coverRef = useRef<HTMLElement>(null);
    const invitation = { people: people.map((p) => ({ ...p, role: p.label })), dateText, weekdayText, envelopeRoles, hostLine: hostSignature };
    const [opening, setOpening] = useState(false);
    const reducedMotion = useReducedMotion();
    const children = invitation.people;
    useEffect(() => {
      if (!opening) return;
      const timer = window.setTimeout(() => openInvitation(coverRef.current), reducedMotion ? 100 : 1100);
      return () => window.clearTimeout(timer);
    }, [opening, reducedMotion]);
    return (<section ref={coverRef} data-opening={opening} className="invitation-cover parents-cover" aria-label="婚礼请柬信封">
      <div className="parents-cover-frame" aria-hidden="true"/>
      <div className={`parents-envelope${opening ? ' is-opening' : ''}`}>
        <div className="parents-envelope-letter">
          <p className="parents-envelope-title">婚礼请柬</p>
          <p className="parents-envelope-wish">两姓缔良缘 · 一帖邀至亲</p>
          <span className="parents-envelope-happiness" aria-hidden="true">囍</span>
          <p className="parents-envelope-roles">{invitation.envelopeRoles}</p>
          <p className="parents-envelope-names">
            {children[0].name}<span aria-hidden="true"> · </span>{children[1].name}
          </p>
          <p className="parents-envelope-date">{invitation.dateText} · {invitation.weekdayText}</p>
          {invitation.hostLine && <p className="parents-envelope-hosts">{invitation.hostLine}</p>}
        </div>
        <div className="parents-envelope-fold" aria-hidden="true"/>
        <div className="parents-envelope-flap" aria-hidden="true"/>
        <button type="button" className="parents-envelope-open" onClick={() => setOpening(true)} disabled={opening} aria-label="开启喜帖">
          <span className="parents-envelope-seal" aria-hidden="true">囍</span>
          <span>{opening ? '喜帖开启中' : '开启喜帖'}</span>
          <ArrowDown size={15} aria-hidden="true"/>
        </button>
      </div>
      <p className="parents-cover-note">一封喜帖，一份诚挚的邀请</p>
    </section>);
}
