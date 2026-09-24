export type Tab = 'statues' | 'panels' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'statues', label: '立像', icon: '🗿' },
  { id: 'panels', label: 'パネル', icon: '🖼️' },
  { id: 'settings', label: '設定', icon: '⚙️' },
];

export function TabBar({ current, onChange }: { current: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={t.id === current ? 'active' : ''}
          aria-current={t.id === current ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          <span aria-hidden="true">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
