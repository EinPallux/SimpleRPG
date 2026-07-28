import { useState } from 'react';
import { monstersOfZone } from '@/content/bestiary';
import { ZONES } from '@/content/zones';
import { CODEX_UNLOCK_LEVEL } from '@/engine/constants';
import { armorySeen, codexBonuses, monsterEntry, zonePage } from '@/engine/codex';
import { metricValue } from '@/engine/metrics';
import { LORE_KILL_THRESHOLD } from '@/content/meta';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { ProgressBar } from '../components/ProgressBar';

function MonsterRow({ monsterId }: { monsterId: string }) {
  const save = useGame((s) => s.save)!;
  const readLore = useGame((s) => s.codexReadLore);
  const entry = monsterEntry(save, monsterId);

  if (!entry.discovered) {
    return (
      <li className="flex items-center gap-2 rounded-sm bg-panel-inset px-2.5 py-2 text-xs text-ink-faint italic">
        <Icon id="help" size={14} className="shrink-0" />
        {t('codex.undiscovered')}
      </li>
    );
  }

  return (
    <li
      className="rounded-sm bg-panel-inset px-2.5 py-2"
      onMouseEnter={() => entry.loreUnlocked && readLore(monsterId)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-bold text-ink">
          {t(`monster.${monsterId}` as I18nKey)}
        </span>
        <span className="shrink-0 text-[10px] font-bold text-ink-faint">
          {t('codex.kills', { n: entry.kills })}
        </span>
      </div>
      {entry.loreUnlocked ? (
        <p className="mt-1 text-[11px] leading-relaxed text-ink-muted italic">
          {t(`monster.${monsterId}.lore` as I18nKey)}
        </p>
      ) : (
        <p className="mt-1 text-[10px] text-ink-faint">
          {t('codex.loreLocked', { n: LORE_KILL_THRESHOLD - entry.kills })}
        </p>
      )}
    </li>
  );
}

function Bestiary() {
  const save = useGame((s) => s.save)!;
  const [zone, setZone] = useState(1);
  const page = zonePage(save, zone);

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {ZONES.map((z, i) => {
          const p = zonePage(save, i + 1);
          return (
            <button
              key={z.nameKey}
              onClick={() => setZone(i + 1)}
              aria-pressed={zone === i + 1}
              className={`rounded-sm px-2.5 py-1.5 text-[11px] font-extrabold transition-colors ${
                zone === i + 1 ? 'bg-panel-inset text-gold' : 'text-ink-faint hover:text-ink'
              }`}
            >
              {t(z.nameKey as I18nKey)}
              {p.complete && <Icon id="crown" size={10} className="ml-1 inline text-gold" />}
            </button>
          );
        })}
      </div>

      <Panel variant="secondary" title={t(ZONES[zone - 1]!.nameKey as I18nKey)}>
        <ProgressBar
          variant="xp"
          value={page.discovered}
          max={page.total}
          className="mb-3 h-3"
          label={t('codex.zonePage', { discovered: page.discovered, total: page.total })}
        />
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {monstersOfZone(zone).map((m) => (
            <MonsterRow key={m.id} monsterId={m.id} />
          ))}
        </ul>
      </Panel>
    </>
  );
}

export function CodexScreen() {
  const save = useGame((s) => s.save);
  const [tab, setTab] = useState<'bestiary' | 'armory'>('bestiary');
  if (!save) return null;

  if (save.hero.level < CODEX_UNLOCK_LEVEL) {
    return (
      <Panel variant="secondary">
        <EmptyState
          icon="codex"
          title={t('codex.title')}
          body={t('codex.lockedHint', { level: CODEX_UNLOCK_LEVEL })}
        />
      </Panel>
    );
  }

  const bonuses = codexBonuses(save);

  return (
    <div className="flex flex-col gap-4">
      <Panel variant="primary">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-gold-bright">{t('codex.title')}</h1>
            <p className="text-sm text-ink-muted">{t('codex.subtitle')}</p>
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-bold text-gold">
              {t('codex.completion', { pct: metricValue(save, 'codexPct') })}
            </div>
            <div className="mt-1 space-y-0.5 text-[11px] font-bold text-teal">
              <div>{t('codex.bonusGold', { pct: Math.round(bonuses.goldFind * 100) })}</div>
              <div>{t('codex.bonusXp', { pct: Math.round(bonuses.xp * 100) })}</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="flex gap-1.5">
        {(['bestiary', 'armory'] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`rounded-sm px-3 py-1.5 text-xs font-extrabold transition-colors ${
              tab === id ? 'bg-panel-inset text-gold' : 'text-ink-faint hover:text-ink'
            }`}
          >
            {t(`codex.tab.${id}` as I18nKey)}
          </button>
        ))}
      </div>

      {tab === 'bestiary' ? (
        <Bestiary />
      ) : (
        <Panel variant="secondary" title={t('codex.tab.armory')}>
          <ProgressBar
            variant="xp"
            value={metricValue(save, 'armoryPct')}
            max={100}
            className="mb-2 h-3"
            label={t('codex.completion', { pct: metricValue(save, 'armoryPct') })}
          />
          <p className="text-sm text-ink-muted">
            {t('codex.armoryBlurb', { seen: armorySeen(save) })}
          </p>
        </Panel>
      )}
    </div>
  );
}
