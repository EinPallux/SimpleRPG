import { getClass } from '@/content/classes';
import { ATTRIBUTE_IDS, type AttributeId, type EquipSlot } from '@/engine/types';
import { baseAttribute } from '@/engine/newSave';
import { heroMaxHp } from '@/engine/stats';
import { xpToNext } from '@/engine/xp';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { EmblemAvatar } from '../components/EmblemAvatar';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { ProgressBar } from '../components/ProgressBar';
import { fmt } from '../format';

const LEFT_SLOTS: EquipSlot[] = ['helmet', 'chest', 'gloves', 'boots'];
const RIGHT_SLOTS: EquipSlot[] = ['amulet', 'belt', 'ring', 'talisman'];
const BOTTOM_SLOTS: EquipSlot[] = ['weapon', 'offhand'];

function GearSlot({ slot }: { slot: EquipSlot }) {
  return (
    <div
      className="frame-slot panel-fill-inset flex h-14 w-14 items-center justify-center md:h-16 md:w-16"
      style={{ ['--frame-w' as string]: '8px' }}
      title={`${slot} — ${t('screen.character.emptySlot')}`}
    >
      <Icon id="plus" size={16} className="text-ink-faint/50" />
    </div>
  );
}

function AttrRow({ attr, value }: { attr: AttributeId; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-faint/20 py-2 last:border-0">
      <span className="text-sm font-bold text-ink">{t(`attr.${attr}.name` as I18nKey)}</span>
      <span className="ml-auto font-display text-lg font-semibold text-gold">{value}</span>
      <button
        disabled
        title={t('common.comingSoon', { milestone: 'M3' })}
        className="frame-button--muted panel-fill px-2 py-0.5 text-xs font-extrabold text-ink-faint opacity-60"
        style={{ ['--frame-w' as string]: '8px' }}
      >
        +
      </button>
    </div>
  );
}

export function CharacterScreen() {
  const save = useGame((s) => s.save);
  if (!save) return null;
  const cls = getClass(save.hero.classId);
  const next = xpToNext(save.hero.level);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <Panel variant="primary" title={t('screen.character.equipment')}>
        <div className="flex items-start justify-center gap-3 md:gap-5">
          <div className="flex flex-col gap-2">
            {LEFT_SLOTS.map((s) => (
              <GearSlot key={s} slot={s} />
            ))}
          </div>
          <div className="flex flex-col items-center gap-2 pt-2">
            <EmblemAvatar emblem={save.hero.portrait} classId={save.hero.classId} size={110} />
            <div className="text-center">
              <div className="font-display text-xl font-bold text-ink">{save.hero.name}</div>
              <div className="text-sm font-bold" style={{ color: `var(${cls.colorVar})` }}>
                <Icon id={cls.icon as never} size={14} className="mr-1 inline-block align-[-2px]" />
                {t(`class.${cls.id}.name` as I18nKey)} ·{' '}
                {t('common.levelShort', { level: save.hero.level })}
              </div>
            </div>
            <ProgressBar
              variant="xp"
              value={save.hero.xp}
              max={next}
              className="h-3 w-40"
              title={t('hud.xpTooltip', { xp: fmt(save.hero.xp), next: fmt(next) })}
            />
            <div className="mt-1 flex gap-2">
              {BOTTOM_SLOTS.map((s) => (
                <GearSlot key={s} slot={s} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {RIGHT_SLOTS.map((s) => (
              <GearSlot key={s} slot={s} />
            ))}
          </div>
        </div>
      </Panel>

      <Panel variant="primary" title={t('screen.character.attributes')}>
        <div>
          {ATTRIBUTE_IDS.map((attr) => (
            <AttrRow key={attr} attr={attr} value={baseAttribute(save, attr)} />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-sm bg-panel-inset px-3 py-2">
          <span className="text-sm font-bold text-ink-muted">{t('create.hp')}</span>
          <span className="font-display text-lg font-semibold text-[#e08a7a]">
            {fmt(heroMaxHp(save))}
          </span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          {t('screen.character.placeholderBody')}
        </p>
      </Panel>
    </div>
  );
}
