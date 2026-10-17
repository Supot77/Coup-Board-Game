import { useState } from 'react';
import Modal from './Modal';
import Tutorial from './Tutorial';
import { actionHelp, roleHelp } from '../core/gameHelp';

export default function RulesModal({ onClose }: { onClose: () => void }) {
  const [tutorial, setTutorial] = useState(false);
  return <Modal title="กติกาสภาลับ" onClose={onClose} className="rules-dialog">
    <div className="rules-content">
      <nav className="rules-toolbar" aria-label="เลือกอ่านกติกาหรือเรียนวิธีเล่น">
        <button className="utility-button" aria-pressed={!tutorial} onClick={() => setTutorial(false)}>อ่านกติกา</button>
        <button className="action-choice" aria-pressed={tutorial} onClick={() => setTutorial(true)}>Tutorial สำหรับมือใหม่</button>
      </nav>
      <p className="rules-timer-note">ถ้าเปิดหน้านี้ระหว่างเกม เวลาตัดสินใจในเกมยังเดินต่อ</p>
      {tutorial ? <Tutorial onExit={() => setTutorial(false)} /> : <>
        <section className="rules-section">
          <h3>เริ่มเกมและชนะอย่างไร</h3>
          <p>แต่ละคนเริ่มด้วย 2 เหรียญและไพ่คว่ำ 2 ใบ ไพ่ 1 ใบแทน 1 อิทธิพล ผู้เล่นคนสุดท้ายที่ยังมีไพ่ไม่เปิดเผยเป็นผู้ชนะ</p>
          <p>เมื่อเสียอิทธิพล ให้เลือกเปิดเผยไพ่ 1 ใบ ใบนั้นจะใช้ยืนยันบทบาทไม่ได้อีก เปิดเผยครบทุกใบแล้วคุณตกรอบ</p>
        </section>

        <section className="rules-section">
          <h3>เลือกแอคชั่นในตาของคุณ</h3>
          <p>เลือกแอคชั่น 1 อย่าง ถ้ามีตั้งแต่ 10 เหรียญ ต้องเลือก Coup</p>
          <div className="rules-action-grid">{actionHelp.map(action => <article className="rules-action" key={action.name}>
            <h4>{action.label}</h4>
            <p>{action.description}</p>
            <small>{action.role === 'ทั่วไป' ? 'ใช้ได้โดยไม่ต้องอ้างบทบาท' : `ต้องอ้างว่ามี ${action.role}`}</small>
            <p className="muted-copy">{action.response}</p>
          </article>)}</div>
        </section>

        <section className="rules-section">
          <h3>ไพ่แต่ละบทบาทช่วยอะไรได้บ้าง</h3>
          <p>ดาวหมายถึงมีบทบาทนั้นบนไพ่ที่ยังไม่เปิดเผย หน้ากากยิ้มหมายถึงต้องสวมบทบาท คุณเลือกอ้างบทบาทที่ไม่มีได้ แต่เสี่ยงเสียไพ่เมื่อถูกจับโกหก</p>
          <div className="rules-role-grid">{Object.entries(roleHelp).map(([role, help]) => <article className="rules-role" key={role}>
            <h4>{role}</h4><p>{help.action}</p><p>{help.defence}</p>
          </article>)}</div>
        </section>

        <section className="rules-section">
          <h3>เมื่อผู้เล่นอื่นลงมือ</h3>
          <dl className="rules-definitions">
            <div><dt>ปล่อยผ่าน</dt><dd>ยอมให้แอคชั่นดำเนินต่อเมื่อผู้เล่นที่เหลือยอมรับด้วย ถ้าเป็นการตอบรับบล็อก แอคชั่นเดิมจะถูกยกเลิกเมื่อทุกคนยอมรับ</dd></div>
            <div><dt>บล็อก</dt><dd>อ้างบทบาทเพื่อหยุดแอคชั่น Duke บล็อก Foreign Aid ได้ ส่วนการขโมยและลอบสังหาร บล็อกได้เฉพาะคนที่ถูกเลือกเป็นเป้าหมาย</dd></div>
            <div><dt>จับโกหก</dt><dd>ขอตรวจบทบาทที่อีกฝ่ายอ้าง ถ้าเขามีจริง คุณต้องเปิดเผยไพ่ 1 ใบ แล้วเขาคืนไพ่ที่พิสูจน์เข้ากองเพื่อรับใบใหม่ ถ้าเขาไม่มี เขาต้องเปิดเผยไพ่ 1 ใบ</dd></div>
          </dl>
          <p>Income, Foreign Aid และ Coup ไม่ได้อ้างบทบาท จึงจับโกหกแอคชั่นเหล่านี้ไม่ได้ ส่วนการบล็อกด้วยบทบาทยังถูกจับโกหกได้</p>
          <p>ถ้าเป็นเป้าหมาย Assassinate แล้วจับโกหกผิด คุณอาจต้องเปิดเผยไพ่จากการท้าผิดและจากการลอบสังหาร รวม 2 ใบ</p>
        </section>
      </>}
    </div>
  </Modal>;
}
