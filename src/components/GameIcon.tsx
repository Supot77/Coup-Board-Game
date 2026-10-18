const paths: Record<string, string> = {
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  cards: 'M7 3h13v17H7zM4 6H2v16h13v-2M11 11l2-3 3 3-3 3Z',
  book: 'M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15',
  exit: 'M10 3H4v18h6M8 12h13m-5-5 5 5-5 5',
  reset: 'M4 9a8 8 0 1 1 1 9M4 3v6h6',
  Income: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM12 8v8m-3-4h6',
  ForeignAid: 'M15 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm-5 2V6m-2 2h4M4 19h8l5-5c2-2 5 0 3 2l-5 5H4M1 17h3v6H1',
  Coup: 'm5 3 15 15-2 2L3 5V3Zm10 0h6v2L6 20l-2-2Zm-4 15 5 5m-2-7 7 7M7 17l-5 5',
  Tax: 'm3 9 9-6 9 6H3Zm2 3v6m7-6v6m7-6v6M3 21h18',
  Assassinate: 'm15 2 5 5-9 9-5-5 9-9Zm-8 11-5 8 8-5m-5-7 10 10',
  Steal: 'M4 8h16l-1 13H5L4 8Zm4 0V6a4 4 0 0 1 8 0v2M9 14h6m-2-2 2 2-2 2',
  Exchange: 'M4 8h15l-4-4m4 4-4 4M20 16H5l4 4m-4-4 4-4',
};

export default function GameIcon({ kind }: { kind: string }) {
  return <svg className="game-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[kind] ?? paths.cards} /></svg>;
}
