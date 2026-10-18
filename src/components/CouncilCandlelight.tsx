/** Decorative lighting stays independent of roster state and tabletop artwork. */
export default function CouncilCandlelight() {
  return <div className="council-row-lighting" aria-hidden="true">
    <div className="council-candle-spill" />
    {['left', 'right'].map(side => <div className={`council-candle council-candle-${side}`} key={side}>
      <div className="council-candle-halo" />
      <svg viewBox="0 0 32 90" focusable="false">
        <ellipse cx="16" cy="85" rx="15" ry="4" fill="#05080a" opacity=".8" />
        <path d="M5 81h22l-4-5h-4V64h-6v12H9z" fill="#80603a" stroke="#c09455" strokeWidth=".8" />
        <path d="M11 32h10v32H11z" fill="#bca77e" />
        <path d="M11 32h10v9c-3 3-2-4-4-2s-1 8-3 6l-1-9h-2z" fill="#e2cea1" />
        <ellipse cx="16" cy="32" rx="5" ry="2" fill="#ebd8ae" />
        <path d="M16 32v-6" stroke="#302017" strokeWidth="1.5" />
        <g className="council-candle-flame">
          <path d="M16 9c-1 7-6 11-5 16 1 7 10 7 10 0 0-5-4-10-5-16Z" fill="#e9a346" />
          <path d="M16 17c-1 4-3 6-3 9 0 4 6 4 6 0 0-3-2-6-3-9Z" fill="#ffedbd" />
        </g>
      </svg>
    </div>)}
  </div>;
}
