import { useEffect, useState } from 'react';

// Progress counts completed preparation tasks, not downloaded bytes.
const assets = [
  '/BG-LOGIN.png',
  '/assets/secret-council/council-entry-v2.webp',
  '/assets/secret-council/create-room-invitation.webp',
  '/assets/secret-council/join-room-invitation.webp',
  '/assets/secret-council/loading-sword.webp',
];

export function useStartupLoading(sessionReady: boolean) {
  const [settled, setSettled] = useState(0);
  const [failed, setFailed] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    let active = true;
    const cleanups = assets.map(src => {
      const image = new Image();
      let done = false;
      const finish = (success: boolean) => {
        if (done || !active) return;
        done = true;
        window.clearTimeout(timeout);
        setSettled(count => count + 1);
        if (!success) setFailed(count => count + 1);
      };
      const timeout = window.setTimeout(() => finish(false), 8000);
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      image.src = src;
      return () => { window.clearTimeout(timeout); image.onload = null; image.onerror = null; };
    });
    return () => { active = false; cleanups.forEach(cleanup => cleanup()); };
  }, []);
  const complete = settled === assets.length && sessionReady;
  useEffect(() => {
    if (!complete) return;
    const timer = window.setTimeout(() => setDismissed(true), 220);
    return () => window.clearTimeout(timer);
  }, [complete]);
  const finished = settled + Number(sessionReady);
  return {
    visible: !dismissed,
    progress: finished / (assets.length + 1) * 100,
    detail: complete && failed > 0 ? 'รูปบางส่วนยังไม่พร้อม สามารถเข้าเล่นต่อได้'
      : settled === assets.length && !sessionReady ? 'กำลังตรวจเซสชันผู้เล่น'
      : `เตรียมภาพและข้อมูล ${finished}/${assets.length + 1} ขั้นตอน`,
  };
}
