export default function RoleBadge({ role, owned }: { role: string; owned: boolean }) {
  return owned
    ? <span className="role-badge role-star" role="img" aria-label={role ? `มีบทบาท ${role}` : 'มีบทบาทนี้'}>★</span>
    : <svg className="role-badge role-mask" role="img" aria-label={role ? `สวมบทบาท ${role}` : 'สวมบทบาท'}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4c5 2 13 2 18 0v7c0 5-5 9-9 11-4-2-9-6-9-11V4Z" />
      <path d="M6.5 9.5q2-2 4 0m3 0q2-2 4 0M7.5 13q4.5 6 9 0" />
    </svg>;
}
