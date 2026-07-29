import { useState } from 'react';
import type { MissionRewards } from '@/engine/missions';
import { getZone } from '@/content/zones';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { fmt } from '../format';
import { FOE_ICON } from '../foeIcon';
import { CombatPlayback } from './CombatPlayback';
import { FButton } from './FButton';
import { Icon } from './Icon';
import { ItemCard } from './ItemCard';
import { Modal } from './Modal';

/**
 * The chest-open moment (UI_DESIGN §7), in two beats.
 *
 * Every mission now ends in a scrap with something local (GAME_DESIGN §5), so
 * the reveal opens on that fight and only then pays out — you see what happened
 * on the way home before you see what you came back with. The mission's own
 * gold and XP are never at risk; the fight is upside, and the summary says so
 * either way rather than hiding a loss.
 */
export function RewardReveal({
  rewards,
  onClose,
}: {
  rewards: MissionRewards;
  onClose: () => void;
}) {
  const save = useGame((s) => s.save);
  const [watched, setWatched] = useState(false);
  const zone = getZone(rewards.zoneIndex);
  const { fight } = rewards;

  if (!watched && save) {
    return (
      <CombatPlayback
        a={{ combatant: fight.hero, emblem: save.hero.portrait, classId: save.hero.classId }}
        b={{ combatant: { ...fight.foe, name: t(`monster.${fight.monsterId}` as I18nKey) }, icon: FOE_ICON[fight.archetype] }}
        result={fight.result}
        onDone={() => setWatched(true)}
      >
        <p
          className={`text-center text-sm font-bold ${fight.won ? 'text-success' : 'text-ink-muted'}`}
        >
          {fight.won
            ? t('reveal.fightWon', { gold: fmt(fight.bonusGold), xp: fmt(fight.bonusXp) })
            : t('reveal.fightLost')}
        </p>
      </CombatPlayback>
    );
  }

  return (
    <Modal title={t('reveal.title')} onClose={onClose}>
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-xs text-ink-faint">{t(zone.nameKey as I18nKey)}</p>
        {rewards.lucky && (
          <p className="pulse-soft font-display text-sm font-bold text-gold-bright">
            {t('reveal.lucky')}
          </p>
        )}
        <p className="pop-in font-display text-2xl font-bold text-xp">
          {t('reveal.xp', { xp: fmt(rewards.xp.gained) })}
        </p>
        {rewards.xp.levelsGained > 0 && (
          <p className="frame-legendary panel-fill pop-in sheen px-4 py-2 font-display text-lg font-bold text-gold-bright [text-shadow:0_0_12px_rgba(240,199,94,.6)]">
            {t('reveal.levelUp', { level: rewards.xp.newLevel })}
          </p>
        )}
        <p className="pop-in font-display text-xl font-semibold text-gold">
          {t('reveal.gold', { gold: fmt(rewards.gold) })}
        </p>
        {/* The scrap's take, kept visually separate from the job's pay so the
            two are never confused for one number. */}
        {fight.won && (
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-success">
            <Icon id="arena" size={13} />
            {t('reveal.fightBonus', { gold: fmt(fight.bonusGold), xp: fmt(fight.bonusXp) })}
          </p>
        )}
        {(rewards.item || rewards.chest) && (
          <div className="stagger mt-1 flex flex-wrap items-start justify-center gap-3">
            {rewards.item && (
              <div className="pop-in">
                <p className="mb-1 text-xs font-bold text-ink-muted">{t('reveal.item')}</p>
                <ItemCard item={rewards.item} />
              </div>
            )}
            {rewards.chest && (
              <div className="pop-in">
                <p className="mb-1 text-xs font-bold text-gold-bright">{t('reveal.chest')}</p>
                <ItemCard item={rewards.chest} />
              </div>
            )}
          </div>
        )}
        {rewards.autoSoldGold > 0 && (
          <p className="text-xs text-ink-faint">
            {t('reveal.autoSold', { gold: fmt(rewards.autoSoldGold) })}
          </p>
        )}
        <FButton size="lg" onClick={onClose} autoFocus>
          {t('reveal.collect')}
        </FButton>
      </div>
    </Modal>
  );
}
