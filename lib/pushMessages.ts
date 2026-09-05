import type { NotifyKind } from './notify';

// Thai text for a push notification's body, one per NotifyKind. Kept separate
// from lib/i18n.tsx (a 'use client' module meant for the browser) rather than
// imported from it, so a server-only send never drags a client component
// module into a Route Handler's bundle. The site is Thai-first and a student's
// language choice lives only in their browser's localStorage, unreachable from
// the server that sends the push — so, like the rest of the server (email
// templates, admin exports), this speaks Thai only.
const TEMPLATES: Record<NotifyKind, string> = {
  trade_offer: '{actor} เสนอแลกกับ "{subject}" ของคุณ',
  trade_accepted: '{actor} ตกลงแลกแล้ว — นัดเจอกันที่ห้องสมุดคอวนิชได้เลย',
  trade_rejected: '{actor} ปฏิเสธข้อเสนอแลกของคุณ',
  trade_cancelled: '{actor} ยกเลิกการแลกเปลี่ยน',
  trade_completed: '🎉 แลกเปลี่ยนสำเร็จแล้ว!',
  trade_postponed: '{actor} ไปตามเวลาที่นัดไม่ได้ — เลื่อนไปเป็นเวลาถัดไปที่ว่างตรงกัน',
  trade_no_show: '{actor} แจ้งว่าคุณไม่ได้ไปตามนัด — การแลกเปลี่ยนถูกยกเลิกและหนังสือกลับไปอยู่ชั้นของทั้งคู่แล้ว',
  wonderbox_match: '✨ กล่องมหัศจรรย์จับคู่ให้แล้ว — เปิดดูเลย!',
};

export function pushBody(kind: NotifyKind, params: { actor?: string | null; subject?: string | null }): string {
  let str = TEMPLATES[kind];
  str = str.replace('{actor}', params.actor ?? '');
  str = str.replace('{subject}', params.subject ?? '');
  return str;
}
