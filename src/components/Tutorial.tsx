import { useEffect, useRef, useState } from 'react';
import RoleSimulation from './RoleSimulation';
import { tutorialRoles, type TutorialRole } from '../core/tutorialScenarios';

const lessons = ['เริ่มจากไพ่ในมือ', 'เลือกแอคชั่นในตาของคุณ', 'ลองบล็อกผู้เล่นอื่น', 'ก่อนกดจับโกหก', 'เปิดเผยไพ่กับสลับไพ่', 'พร้อมเข้าเล่น'];

function BasicsTutorial({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const body = heading.current?.closest('.dialog-body');
    if (body) body.scrollTop = 0;
  }, [step]);
  const answer = answers[step];
  const choose = (value: string) => setAnswers(previous => ({ ...previous, [step]: value }));

  return <section className="tutorial" aria-label="บทเรียนสำหรับมือใหม่">
    <p className="tutorial-progress">บทที่ {step + 1} จาก {lessons.length}</p>
    <progress value={step + 1} max={lessons.length} aria-label="ความคืบหน้าบทเรียน" />
    <h3 ref={heading} tabIndex={-1}>{lessons[step]}</h3>
    <p className="muted-copy">ตัวอย่างในบทเรียนใช้ไพ่สมมติ การกดตอบจะไม่ส่งแอคชั่นเข้าเกม</p>

    {step === 0 && <>
      <p>เริ่มเกมด้วยไพ่คว่ำ 2 ใบและเงิน 2 เหรียญ ไพ่แต่ละใบแทน 1 อิทธิพล คุณชนะเมื่อเป็นคนสุดท้ายที่ยังมีไพ่ไม่เปิดเผย</p>
      <div className="tutorial-hand">
        <figure><img src="/img/duk.jpg" alt="ไพ่ตัวอย่าง Duke" /><figcaption>Duke</figcaption></figure>
        <figure><img src="/img/cont.jpg" alt="ไพ่ตัวอย่าง Contessa" /><figcaption>Contessa</figcaption></figure>
      </div>
      <p>สมมติว่าคุณมี Duke กับ Contessa คุณใช้ Tax เพื่อรับ 3 เหรียญ และบล็อกการลอบสังหารด้วย Contessa ได้</p>
      <p>ดาวหมายถึงมีไพ่บทบาทนั้นที่ยังใช้ได้ หน้ากากยิ้มหมายถึงต้องอ้างบทบาทที่ไม่มีในมือ</p>
    </>}

    {step === 1 && <>
      <p>เมื่อถึงตาคุณ เลือกแอคชั่น 1 อย่าง Income รับ 1 เหรียญได้โดยไม่ต้องมีบทบาทใด ส่วน Tax ต้องอ้าง Duke</p>
      <p>คุณมี Duke กับ Contessa ถ้าต้องการรับเหรียญด้วยบทบาทที่มีจริง ควรเลือกอะไร?</p>
      <div className="tutorial-choices">
        <button className="action-choice" aria-pressed={answer === 'tax'} onClick={() => choose('tax')}>Tax ด้วย Duke</button>
        <button className="action-choice" aria-pressed={answer === 'steal'} onClick={() => choose('steal')}>Steal ด้วย Captain</button>
      </div>
      {answer && <p className="tutorial-feedback" role="status">{answer === 'tax'
        ? 'ถูกต้อง คุณมี Duke จึงใช้ Tax เพื่อรับ 3 เหรียญได้'
        : 'Steal ต้องอ้าง Captain ซึ่งคุณไม่มีในตัวอย่างนี้ ลองเลือก Tax ที่ใช้ Duke ในมือ'}</p>}
      <p>คุณยังสวมบทบาทอื่นได้ ถ้าถูกจับโกหกแล้วไม่มีไพ่บทบาทนั้น คุณต้องเปิดเผยไพ่ 1 ใบ</p>
    </>}

    {step === 2 && <>
      <p>เพื่อนเลือก Foreign Aid เพื่อรับ 2 เหรียญ คุณมี Duke และต้องการหยุดการรับเงินครั้งนี้ ควรกดอะไร?</p>
      <div className="tutorial-choices">
        <button className="action-choice" aria-pressed={answer === 'block'} onClick={() => choose('block')}>บล็อกด้วย Duke</button>
        <button className="action-choice" aria-pressed={answer === 'challenge'} onClick={() => choose('challenge')}>จับโกหก Foreign Aid</button>
        <button className="action-choice" aria-pressed={answer === 'pass'} onClick={() => choose('pass')}>ปล่อยผ่าน</button>
      </div>
      {answer && <p className="tutorial-feedback" role="status">{answer === 'block'
        ? 'ถูกต้อง Duke บล็อก Foreign Aid ได้ หากทุกคนยอมรับการบล็อก เพื่อนจะไม่ได้ 2 เหรียญ'
        : answer === 'challenge'
          ? 'Foreign Aid ไม่ได้อ้างบทบาท จึงจับโกหกแอคชั่นนี้ไม่ได้ คุณใช้ Duke บล็อกได้'
          : 'ปล่อยผ่านคือยอมให้แอคชั่นดำเนินต่อ ถ้าอยากหยุดการรับเงิน ให้เลือกบล็อกด้วย Duke'}</p>}
      <p>ผู้เล่นอื่นยังจับโกหกการบล็อกของคุณได้ เพราะคุณกำลังอ้างว่ามี Duke</p>
    </>}

    {step === 3 && <>
      <p>เพื่อนใช้ Tax โดยอ้างว่ามี Duke คุณก็มี Duke อยู่ในมือ จึงรู้แน่หรือไม่ว่าเพื่อนกำลังโกหก?</p>
      <div className="tutorial-choices">
        <button className="action-choice" aria-pressed={answer === 'unknown'} onClick={() => choose('unknown')}>ยังยืนยันไม่ได้</button>
        <button className="action-choice" aria-pressed={answer === 'certain'} onClick={() => choose('certain')}>เพื่อนไม่มี Duke แน่นอน</button>
      </div>
      {answer && <p className="tutorial-feedback" role="status">{answer === 'unknown'
        ? 'ถูกต้อง ไพ่บทบาทเดียวกันมีหลายใบ ไพ่ของคุณจึงบอกไม่ได้ว่าเพื่อนมีอะไร'
        : 'ไพ่ Duke มีหลายใบ เพื่อนอาจมี Duke อีกใบได้ การมีไพ่ใบเดียวกันไม่ได้ยืนยันว่าเพื่อนโกหก'}</p>}
      <p>กดจับโกหกเพื่อขอตรวจบทบาทที่อีกฝ่ายอ้าง ถ้าเขามีจริง คุณต้องเปิดเผยไพ่ 1 ใบ ถ้าเขาไม่มี เขาต้องเปิดเผยไพ่ 1 ใบ</p>
      <p>ถ้าอีกฝ่ายพิสูจน์ว่ามีไพ่จริง เขาจะคืนไพ่ใบนั้นเข้ากองแล้วรับใบใหม่</p>
    </>}

    {step === 4 && <>
      <dl className="rules-definitions">
        <div><dt>เปิดเผยไพ่</dt><dd>เลือกไพ่ 1 ใบให้ทุกคนเห็น ใบนั้นเสียอิทธิพลและใช้ยืนยันบทบาทต่อไปไม่ได้ ถ้าเปิดเผยครบทุกใบ คุณตกรอบ</dd></div>
        <div><dt>สลับไพ่ด้วย Ambassador</dt><dd>จั่ว 2 ใบ รวมกับไพ่ที่ยังใช้ได้ แล้วเลือกเก็บเท่าจำนวนเดิม คืนใบที่เหลือเข้ากอง ไพ่ที่เปิดเผยแล้วจะอยู่เหมือนเดิม</dd></div>
      </dl>
      <p>ถ้าคุณเป็นเป้าหมายการลอบสังหารแล้วจับโกหกผิด คุณอาจเสียทั้งไพ่จากการท้าผิดและจากการลอบสังหาร รวม 2 ใบ</p>
    </>}

    {step === 5 && <>
      <p>ก่อนเลือกแอคชั่น ดูไพ่ที่ยังใช้ได้และจำนวนเหรียญ ถ้ามี 10 เหรียญขึ้นไป ต้องเลือก Coup ในตาของคุณ</p>
      <p>เมื่อถูกขโมย บล็อกด้วย Captain หรือ Ambassador ได้ เมื่อถูกลอบสังหาร บล็อกด้วย Contessa ได้ ส่วน Duke บล็อก Foreign Aid ได้แม้คุณไม่ได้เป็นเป้าหมาย</p>
      <p>อ่านคำแนะนำในหน้าต่างเหตุการณ์ก่อนกดตอบ ปล่อยผ่านคือยอมให้ดำเนินต่อ บล็อกคืออ้างบทบาทเพื่อหยุดแอคชั่น ส่วนจับโกหกคือขอตรวจบทบาทของอีกฝ่าย</p>
      <button className="action-choice" onClick={onExit}>กลับไปดูกติกา</button>
    </>}

    <nav className="tutorial-navigation" aria-label="เปลี่ยนบทเรียน">
      <button className="utility-button" disabled={step === 0} onClick={() => setStep(step - 1)}>ย้อนกลับ</button>
      {step < lessons.length - 1 ? <button className="action-choice" onClick={() => setStep(step + 1)}>ถัดไป</button>
        : <button className="utility-button" onClick={() => { setAnswers({}); setStep(0); }}>เริ่มบทเรียนใหม่</button>}
    </nav>
  </section>;
}

export default function Tutorial({ onExit }: { onExit: () => void }) {
  const [track, setTrack] = useState<'basics' | TutorialRole>('basics');
  return <div className="tutorial-library">
    <h3>เลือกบทเรียนที่ต้องการฝึก</h3>
    <nav className="tutorial-tracks" aria-label="เลือกบทบาทใน Tutorial">
      {(['basics', ...tutorialRoles] as const).map(role => <button key={role} className="utility-button" aria-pressed={track === role}
        onClick={() => setTrack(role)}>{role === 'basics' ? 'พื้นฐาน' : role}</button>)}
    </nav>
    {track === 'basics' ? <BasicsTutorial onExit={onExit} /> : <RoleSimulation key={track} role={track} />}
  </div>;
}
