import { useEffect, useState } from 'react';
import { localDayKey } from '@/engine/time';
import { t } from '@/i18n';
import { useGame, type ScreenId } from '@/state/store';
import { EmptyState } from '../components/EmptyState';
import { Panel } from '../components/Panel';
import { RewardReveal } from '../components/RewardReveal';
import { useGameClock } from '../hooks/useGameClock';
import { findNavEntry } from '../nav';
import { ArenaPlayback } from '../components/ArenaPlayback';
import { DungeonPlayback, ExpedPlayback } from '../components/PvePlayback';
import { MetaRewardModal } from '../components/MetaRewardModal';
import { AchievementsScreen } from '../screens/AchievementsScreen';
import { ArenaScreen } from '../screens/ArenaScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { CharacterScreen } from '../screens/CharacterScreen';
import { CodexScreen } from '../screens/CodexScreen';
import { DungeonsScreen } from '../screens/DungeonsScreen';
import { ExpeditionScreen } from '../screens/ExpeditionScreen';
import { ForgeScreen } from '../screens/ForgeScreen';
import { HallOfFameScreen } from '../screens/HallOfFameScreen';
import { MenagerieScreen } from '../screens/MenagerieScreen';
import { PatrolScreen } from '../screens/PatrolScreen';
import { QuestBoardScreen } from '../screens/QuestBoardScreen';
import { ShopsScreen } from '../screens/ShopsScreen';
import { StableScreen } from '../screens/StableScreen';
import { TavernScreen } from '../screens/TavernScreen';
import { WellScreen } from '../screens/WellScreen';
import { WheelScreen } from '../screens/WheelScreen';
import { InstallPrompt } from '../components/InstallPrompt';
import { OnboardingLayer } from '../components/OnboardingLayer';
import { TourPopover } from '../components/TourPopover';
import { UpdateToast } from '../components/UpdateToast';
import { useKeyboardMap } from '../hooks/useKeyboardMap';
import { useSfx } from '../hooks/useSfx';
import { HudBar } from './HudBar';
import { MobileTabBar, NavRail, NavSheet } from './NavRail';
import { SettingsModal } from './SettingsModal';

/** Every screen in the nav registry now has a real implementation (M7). */
const SCREENS: Partial<Record<ScreenId, () => React.JSX.Element | null>> = {
  tavern: TavernScreen,
  character: CharacterScreen,
  patrol: PatrolScreen,
  shops: ShopsScreen,
  forge: ForgeScreen,
  arena: ArenaScreen,
  hallOfFame: HallOfFameScreen,
  dungeons: DungeonsScreen,
  expeditions: ExpeditionScreen,
  wheel: WheelScreen,
  quests: QuestBoardScreen,
  achievements: AchievementsScreen,
  codex: CodexScreen,
  calendar: CalendarScreen,
  menagerie: MenagerieScreen,
  stable: StableScreen,
  well: WellScreen,
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
  // M8: sound follows outcomes, and the keyboard map is global.
  useSfx();
  useKeyboardMap();

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
      <ArenaPlayback />
      <DungeonPlayback />
      <ExpedPlayback />
      <MetaRewardModal />
      <SettingsModal />
      {/* Guidance layers last, so they paint over the screen they point at.
          Order matters: the scripted sequence outranks a contextual tour, and
          `tourDue` already refuses to fire while onboarding is unfinished. */}
      <OnboardingLayer />
      <TourPopover />
      <InstallPrompt />
      <UpdateToast />
    </div>
  );
}
