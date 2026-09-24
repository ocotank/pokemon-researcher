import { useEffect, useState } from 'react';
import { PanelTab } from './components/PanelTab';
import { SettingsTab } from './components/SettingsTab';
import { StatueTab } from './components/StatueTab';
import { type Tab, TabBar } from './components/TabBar';
import { useCollection } from './hooks/useCollection';
import { useGeolocation } from './hooks/useGeolocation';

export default function App() {
  const [tab, setTab] = useState<Tab>('statues');
  const collection = useCollection();
  const geo = useGeolocation(tab === 'statues');

  useEffect(() => {
    void navigator.storage?.persist?.();
  }, []);

  return (
    <div className="app">
      <main>
        {tab === 'statues' && <StatueTab collection={collection} geo={geo} />}
        {tab === 'panels' && <PanelTab collection={collection} />}
        {tab === 'settings' && <SettingsTab collection={collection} />}
      </main>
      <TabBar current={tab} onChange={setTab} />
    </div>
  );
}
