import { roleHelp } from '../core/gameHelp';

export default function HandGuide({ roles, isDead }: { roles: Set<string>; isDead: boolean }) {
  return <details className="hand-guide" open>
    <summary>ไพ่ในมือของคุณทำอะไรได้บ้าง</summary>
    {isDead ? <p>คุณไม่มีไพ่ที่ยังใช้ได้แล้ว จึงเลือกแอคชั่นหรือบล็อกไม่ได้ แต่ดูเกมต่อได้</p>
      : <>
        <ul>{[...roles].map(role => <li key={role}><b>{role}</b><span>{roleHelp[role]?.action}</span><span>{roleHelp[role]?.defence}</span></li>)}</ul>
        <p>ใช้เฉพาะไพ่ที่ยังไม่เปิดเผยในการตรวจบทบาท คุณยังอ้างบทบาทอื่นได้ แต่เสี่ยงเสียไพ่หากถูกจับโกหก</p>
      </>}
  </details>;
}
