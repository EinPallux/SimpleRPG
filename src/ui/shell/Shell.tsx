import { useState } from 'react';
import { t } from '@/i18n';
import { useGame, type ScreenId } from '@/state/store';
import { EmptyState } from '../components/EmptyState';
import { Panel } from '../components/Panel';
import { findNavEntry } from '../nav';
import { CharacterScreen } from '../screens/CharacterScreen';
import { TavernScreen } from '../screens/TavernScreen';
import { HudBar } from './HudBar';
import { MobileTabBar, NavRail, NavSheet } from './NavRail';
import { SettingsModal } from './SettingsModal';

/** Screens with real M0 content; everything else renders a designed placeholder. */
const SCREENS: Partial<Record<ScreenId, () => React.JSX.Element | null>> = {
  tavern: TavernScreen,
  character: CharacterScreen,
};

function ComingSoon({ screen }: { screen: ScreenId }) {
  const entry = findNavEntry(screen);
  return (
    <Panel variant="secondary">
      <EmptyState
        icon={entry?.icon ?? 'map-pin'}
        title={entry ? t(entry.labelKey) : screen}
        body={t('common.comingSoon', { milestone: 'M2+' })}
      />
    </Panel>
  );
}

export function Shell() {
  const screen = useGame((s) => s.screen);
  const [sheet, setSheet] = useState<number | null>(null);
  const Screen = SCREENS[screen];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl items-start">
      <NavRail />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <HudBar />
        <main className="min-w-0 flex-1 px-2 py-3 pb-24 md:px-3 lg:pb-3">
          <div key={screen} className="screen-enter">
            {Screen ? <Screen /> : <ComingSoon screen={screen} />}
          </div>
        </main>
      </div>
      <MobileTabBar onOpenSheet={setSheet} />
      {sheet !== null && <NavSheet groupIndex={sheet} onClose={() => setSheet(null)} />}
      <SettingsModal />
    </div>
  );
}
