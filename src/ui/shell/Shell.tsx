import { useEffect, useState } from 'react';
import { localDayKey } from '@/engine/time';
import { t } from '@/i18n';
import { useGame, type ScreenId } from '@/state/store';
import { EmptyState } from '../components/EmptyState';
import { Panel } from '../components/Panel';
import { RewardReveal } from '../components/RewardReveal';
import { useGameClock } from '../hooks/useGameClock';
import { findNavEntry } from '../nav';
import { CharacterScreen } from '../screens/CharacterScreen';
import { ForgeScreen } from '../screens/ForgeScreen';
import { PatrolScreen } from '../screens/PatrolScreen';
import { ShopsScreen } from '../screens/ShopsScreen';
import { TavernScreen } from '../screens/TavernScreen';
import { HudBar } from './HudBar';
import { MobileTabBar, NavRail, NavSheet } from './NavRail';
import { SettingsModal } from './SettingsModal';

/** Screens with real content so far; everything else renders a designed placeholder. */
const SCREENS: Partial<Record<ScreenId, () => React.JSX.Element | null>> = {
  tavern: TavernScreen,
  character: CharacterScreen,
  patrol: PatrolScreen,
  shops: ShopsScreen,
  forge: ForgeScreen,
};

/** Catch the local-midnight rollover while the tab stays open (GAME_DESIGN §14). */
function useMidnightRollover() {
  const now = useGameClock(30_000);
  const dayKey = useGame((s) => s.save?.daily.dayKey);
  const catchUp = useGame((s) => s.catchUp);
  useEffect(() => {
    if (dayKey && localDayKey(now) !== dayKey) catchUp();
  }, [now, dayKey, catchUp]);
}

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
  const reveal = useGame((s) => s.reveal);
  const closeReveal = useGame((s) => s.closeReveal);
  const [sheet, setSheet] = useState<number | null>(null);
  const Screen = SCREENS[screen];
  useMidnightRollover();

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
      {reveal && <RewardReveal rewards={reveal} onClose={closeReveal} />}
      <SettingsModal />
    </div>
  );
}
