import { useEffect, useRef, useState } from 'react';
import { tutorialScenarios, type PracticeChoice, type PracticePlayer, type PracticeStep, type TutorialRole, type TutorialScenario } from '../core/tutorialScenarios';
import RoleBadge from './RoleBadge';
import { roleHelp } from '../core/gameHelp';

const images: Record<string, string> = { Duke: '/img/DUKE.png', Assassin: '/img/ASSASSIN.png', Captain: '/img/CAPTAIN.png', Ambassador: '/img/AMBASSADOR.png', Contessa: '/img/CONTESSA.png' };
const clone = (players: PracticePlayer[]) => players.map(player => ({ ...player, cards: player.cards.map(card => ({ ...card })) }));

function Simulation({ scenario }: { scenario: TutorialScenario }) {
  const [players, setPlayers] = useState(() => clone(scenario.players));
  const [queue, setQueue] = useState<PracticeStep[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [log, setLog] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [eventText, setEventText] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const phase = useRef<HTMLDivElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const current = started && !finished ? queue[cursor] : null;
  const change = current?.change;
  const proof = change?.kind === 'proof' ? change : null;
  const exchange = change?.kind === 'exchange' ? change : null;
  const pool = exchange ? [...players[exchange.actor].cards.filter(card => !card.isDead), ...exchange.drawn.map(character => ({ character, isDead: false }))] : [];
  const keep = exchange ? players[exchange.actor].cards.filter(card => !card.isDead).length : 0;

  useEffect(() => {
    if (started) {
      phase.current?.focus({ preventScroll: true });
      phase.current?.scrollIntoView({ block: 'nearest' });
    } else heading.current?.focus({ preventScroll: true });
  }, [cursor, started, finished]);
  useEffect(() => { if (started && !pending && !finished) nextButton.current?.focus({ preventScroll: true }); }, [pending]);

  function enter(index: number, steps: PracticeStep[], snapshot: PracticePlayer[], history: string[]) {
    setSelected([]);
    setCursor(index);
    if (index >= steps.length) {
      setFinished(true); setPending(false); setLog([...history, 'จบสถานการณ์จำลอง']); return;
    }
    const event = steps[index];
    const next = clone(snapshot);
    const operation = event.change;
    const messages = [...history, event.text];
    let needsInput = false;
    if (operation?.kind === 'coins') next[operation.actor].coins += operation.amount;
    if (operation?.kind === 'transfer') {
      const source = next[operation.from];
      const target = next[operation.to];
      if (!source.cards.some(card => !card.isDead)) messages.push('เป้าหมายตกรอบแล้ว จึงข้ามการขโมย');
      else {
        const amount = Math.min(operation.amount, source.coins);
        source.coins -= amount; target.coins += amount;
        messages.push(`${target.name} ขโมยได้ ${amount} เหรียญ ${source.name} เหลือ ${source.coins} เหรียญ`);
      }
    }
    if (operation?.kind === 'replace') {
      const card = next[operation.actor].cards.find(card => !card.isDead && card.character === operation.role);
      if (card) card.character = operation.replacement;
      messages.push(operation.actor === 0 ? `ไพ่ใหม่ของคุณคือ ${operation.replacement}` : 'เมย์รับไพ่ใหม่ไว้คว่ำหน้า');
    }
    if (operation?.kind === 'discard') {
      needsInput = next[operation.actor].cards.some(card => !card.isDead);
      if (!needsInput) messages.push('เป้าหมายตกรอบไปแล้ว จึงไม่ต้องเสียไพ่ซ้ำ');
    }
    if (operation?.kind === 'exchange' || operation?.kind === 'decision') needsInput = true;
    setPlayers(next); setLog(messages); setPending(needsInput); setEventText(messages[messages.length - 1]);
  }

  function choose(choice: PracticeChoice) {
    if (choice.disabledReason) return;
    if (!started) {
      setStarted(true); setQueue(choice.steps);
      enter(0, choice.steps, scenario.players, [choice.label, choice.explanation]);
    } else {
      const steps = [...queue.slice(0, cursor + 1), ...choice.steps, ...queue.slice(cursor + 1)];
      setQueue(steps);
      enter(cursor + 1, steps, players, [...log, choice.label, choice.explanation]);
    }
  }

  function reveal(actor: number, index: number) {
    const next = clone(players);
    const card = next[actor].cards[index];
    card.isDead = true;
    setPlayers(next); setPending(false);
    setEventText(`${next[actor].name} เปิดเผย ${card.character}${next[actor].cards.some(card => !card.isDead) ? ' และยังเล่นต่อได้' : ' และตกรอบแล้ว'}`);
    setLog([...log, `${next[actor].name} เปิดเผย ${card.character} ใบนี้ใช้ยืนยันบทบาทต่อไปไม่ได้`,
      ...(!next[actor].cards.some(card => !card.isDead) ? [`${next[actor].name} ตกรอบแล้ว`] : [])]);
  }
  function exchangeCards() {
    if (!exchange || selected.length !== keep) return;
    const next = clone(players);
    const dead = next[exchange.actor].cards.filter(card => card.isDead);
    const kept = selected.map(index => ({ ...pool[index] }));
    next[exchange.actor].cards = [...kept, ...dead];
    setPlayers(next); setPending(false);
    setEventText(`เลือกเก็บ ${kept.map(card => card.character).join(', ')} แล้ว ไพ่ที่เปิดเผยก่อนหน้านี้คงเดิม`);
    setLog([...log, `คุณเลือกเก็บ ${kept.map(card => card.character).join(', ')} คืนไพ่ที่ไม่เลือก ${pool.length - kept.length} ใบเข้ากอง ไพ่ที่เปิดเผยแล้วคงเดิม`]);
  }
  const choices = !started ? scenario.choices : change?.kind === 'decision' && pending ? change.choices : [];

  return <div className="role-simulation" data-scenario={scenario.id}>
    <h4 ref={heading} tabIndex={-1}>{scenario.title}</h4>
    <p>{scenario.situation}</p>
    <p className="muted-copy">ตัวอย่างมีผู้เล่น 2 คน ไพ่ของเมย์จะเห็นเฉพาะใบที่พิสูจน์หรือเปิดเผย การกดในบทเรียนไม่ส่งคำสั่งเข้าเกมจริง</p>
    <div className="simulation-board">
      {players.map((player, actor) => <article key={actor} className="simulation-player" data-player={actor}>
        <h5>{player.name}<span>🪙 <output className="simulation-coins">{player.coins}</output></span></h5>
        <p className="simulation-influence">เหลือ {player.cards.filter(card => !card.isDead).length} อิทธิพล</p>
        <div className="simulation-cards">{player.cards.map((card, index) => {
          const proving = proof?.actor === actor && card.character === proof.role && !card.isDead && player.cards.findIndex(candidate => !candidate.isDead && candidate.character === proof.role) === index;
          const visible = actor === 0 || card.isDead || proving;
          return <div key={index} className={`simulation-card ${card.isDead ? 'simulation-card-dead' : ''}`}>
            {visible ? <><img src={images[card.character]} alt="" /><span>{card.character}<small>{card.isDead ? 'เปิดเผยแล้ว' : proving ? 'พิสูจน์บทบาท' : 'ยังใช้ได้'}</small></span></> : <span className="simulation-card-back">♜<small>ไพ่คว่ำ</small></span>}
          </div>;
        })}</div>
        {finished && <p className="simulation-difference">เริ่มต้น {scenario.players[actor].coins} → ตอนนี้ {player.coins} เหรียญ</p>}
      </article>)}
    </div>

    {!started && <h5 className="simulation-prompt">คุณจะเลือกอะไร?</h5>}
    {started && !finished && <div ref={phase} tabIndex={-1} className="simulation-current" role="status">
      <span>ขั้นตอน {cursor + 1} / {queue.length}</span><p>{eventText}</p>
    </div>}
    {choices.length > 0 && <div className="simulation-choices">{choices.map(choice => <button key={choice.id}
      className="action-choice" data-choice={choice.id} aria-label={choice.label} disabled={!!choice.disabledReason} onClick={() => choose(choice)}>
      <b>{choice.role && <RoleBadge role={choice.role} owned={players[0].cards.some(card => !card.isDead && card.character === choice.role)} />}{choice.label}</b><span>{choice.disabledReason || choice.explanation}</span>
    </button>)}</div>}

    {pending && change?.kind === 'discard' && <div className="simulation-choices" aria-label="เลือกไพ่เปิดเผยในบทเรียน">
      {change.actor === 0 ? players[0].cards.map((card, index) => !card.isDead && <button className="action-choice danger-choice" key={index} data-discard={index} onClick={() => reveal(0, index)}>เปิดเผย {card.character}</button>)
        : <button className="action-choice" data-discard="opponent" onClick={() => reveal(change.actor, players[change.actor].cards.findIndex(card => !card.isDead))}>ให้เมย์เลือกเปิดเผยไพ่</button>}
    </div>}
    {pending && exchange && <div className="simulation-exchange">
      <p>เลือกเก็บ {keep} ใบ · เลือกแล้ว {selected.length} ใบ</p>
      <div className="exchange-cards">{pool.map((card, index) => <button key={index} className={`exchange-card ${selected.includes(index) ? 'card-selected' : ''}`}
        data-exchange-card={index} aria-label={`${card.character} ใบที่ ${index + 1}`} aria-pressed={selected.includes(index)}
        onClick={() => setSelected(previous => previous.includes(index) ? previous.filter(value => value !== index) : previous.length < keep ? [...previous, index] : previous)}>
        <img src={images[card.character]} alt="" /><span>{selected.includes(index) && '✓ '}{card.character}</span>
      </button>)}</div>
      <button className="action-choice" data-exchange-confirm disabled={selected.length !== keep} onClick={exchangeCards}>ยืนยันไพ่ที่เก็บ</button>
    </div>}

    {started && !finished && <button ref={nextButton} className="action-choice simulation-next" data-simulation-next disabled={pending}
      onClick={() => enter(cursor + 1, queue, players, log)}>{cursor === queue.length - 1 ? 'ดูผลลัพธ์' : 'ดำเนินเหตุการณ์ต่อ'}</button>}
    {finished && <div ref={phase} tabIndex={-1} className="simulation-result" role="status"><h5>ผลของตัวเลือกนี้</h5>
      <p>{players.some(player => !player.cards.some(card => !card.isDead)) ? 'มีผู้เล่นตกรอบแล้ว หากเหลือคนเดียวที่ยังมีอิทธิพล คนนั้นชนะเกม' : 'ทั้งสองคนยังมีอิทธิพล เกมจึงเล่นต่อได้'}</p>
      <p>เปรียบเทียบเงินและไพ่บนกระดาน แล้วดูเหตุการณ์ด้านล่างเพื่อทบทวนสาเหตุ</p>
    </div>}
    {started && <section className="simulation-history" aria-label="ประวัติสถานการณ์จำลอง"><h5>เกิดอะไรขึ้นบ้าง</h5><ol>{log.map((message, index) => <li key={index}>{message}</li>)}</ol></section>}
    {started && <button className="utility-button" data-replay onClick={() => { setPlayers(clone(scenario.players)); setStarted(false); setFinished(false); setPending(false); setCursor(-1); setLog([]); setSelected([]); }}>เริ่มใหม่เพื่อลองตัวเลือกอื่น</button>}
  </div>;
}

export default function RoleSimulation({ role }: { role: TutorialRole }) {
  const scenarios = tutorialScenarios.filter(scenario => scenario.role === role);
  const [index, setIndex] = useState(0);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const body = section.current?.closest('.dialog-body');
    if (body) body.scrollTop = 0;
  }, [index]);
  return <section ref={section} className="role-practice" aria-label={`ฝึกบทบาท ${role}`}>
    <aside className="role-overview"><h4>{role}</h4><p>{roleHelp[role].action}</p><p>{roleHelp[role].defence}</p>
      <p className="muted-copy">ทุกบทบาทเลือก Income, Foreign Aid หรือ Coup ตามจำนวนเงินได้ และสวมบทบาทอื่นได้โดยเสี่ยงถูกจับโกหก</p>
    </aside>
    <label htmlFor="practice-scenario">เลือกสถานการณ์ · {index + 1} จาก {scenarios.length}</label>
    <select id="practice-scenario" value={index} onChange={event => setIndex(Number(event.target.value))}>
      {scenarios.map((scenario, position) => <option key={scenario.id} value={position}>{position + 1}. {scenario.title}</option>)}
    </select>
    <Simulation key={scenarios[index].id} scenario={scenarios[index]} />
    <nav className="tutorial-navigation" aria-label="เปลี่ยนสถานการณ์">
      <button className="utility-button" disabled={index === 0} onClick={() => setIndex(index - 1)}>สถานการณ์ก่อนหน้า</button>
      <button className="utility-button" disabled={index === scenarios.length - 1} onClick={() => setIndex(index + 1)}>สถานการณ์ถัดไป</button>
    </nav>
  </section>;
}
