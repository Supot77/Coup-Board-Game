import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import Modal from './Modal';

type Notice = { message: string; resolve?: (confirmed: boolean) => void };
const DialogContext = createContext<{
  notify: (message: string) => void; confirm: (message: string) => Promise<boolean>;
} | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(true);
  const busy = useRef(false);
  const notify = useCallback((message: string) => {
    setNotices(items => [...items, { message }]);
    setOpen(true);
  }, []);
  const confirm = useCallback((message: string) => {
    // Ignore repeated taps while the same confirmation is pending.
    if (busy.current) return Promise.resolve(false);
    busy.current = true;
    return new Promise<boolean>(resolve => {
      setNotices(items => [...items, { message, resolve }]);
      setOpen(true);
    });
  }, []);
  const notice = notices[0];
  const finish = (confirmed: boolean) => {
    notice.resolve?.(confirmed);
    if (notice.resolve) busy.current = false;
    setNotices(items => items.slice(1));
    setOpen(true);
  };
  return <DialogContext.Provider value={{ notify, confirm }}>
    {children}
    {notice && (open ? <Modal title={notice.resolve ? 'ยืนยันการดำเนินการ' : 'แจ้งเตือน'} onClose={() => setOpen(false)}>
      <p className="event-description">{notice.message}</p>
      <div className="response-buttons">
        {notice.resolve && <button className="utility-button" onClick={() => finish(false)}>ยกเลิก</button>}
        <button className="action-choice" onClick={() => finish(true)}>{notice.resolve ? 'ยืนยัน' : 'รับทราบ'}</button>
      </div>
      <p className="muted-copy">ปิดพักไว้และเปิดใหม่ได้{notice.resolve && ' · ยังไม่ดำเนินการจนกว่าจะกดยืนยัน'}</p>
    </Modal> : <button className="utility-button notice-reopen" onClick={() => setOpen(true)}>เปิด{notice.resolve ? 'คำยืนยัน' : 'แจ้งเตือน'} ({notices.length})</button>)}
  </DialogContext.Provider>;
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error('DialogProvider is required');
  return context;
}
