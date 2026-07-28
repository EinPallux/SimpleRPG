import { CALENDAR_SLOTS, getSlot } from '@/content/calendar';
import { CALENDAR_UNLOCK_LEVEL } from '@/engine/constants';
import { canClaimCalendar, claimedToday, nextSlot, slotsClaimed } from '@/engine/calendar';
import { t, type I18nKey } from '@/i18n';
import { useGame } from '@/state/store';
import { EmptyState } from '../components/EmptyState';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { ProgressBar } from '../components/ProgressBar';
import { useGameClock } from '../hooks/useGameClock';

function DayTile({ day, claimed, isNext }: { day: number; claimed: boolean; isNext: boolean }) {
  const slot = getSlot(day);
  const gemDay = (slot.reward.gems ?? 0) > 0;
  return (
    <div
      className={`relative flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-sm border px-1 py-1.5 text-center ${
        claimed
          ? 'border-success/40 bg-success/10'
          : isNext
            ? 'border-gold bg-gold/15'
            : 'border-black/40 bg-panel-inset'
      }`}
    >
      <span
        className={`text-[10px] font-extrabold ${claimed ? 'text-success' : isNext ? 'text-gold' : 'text-ink-faint'}`}
      >
        {day}
      </span>
      <span className="text-[9px] leading-tight text-ink-muted">
        {t(`calendar.day.${day}` as I18nKey)}
      </span>
      {gemDay && <Icon id="gem" size={11} className="text-gem" />}
      {claimed && (
        <span className="absolute top-0.5 right-0.5 text-[9px] text-success" aria-hidden="true">
          ✓
        </span>
      )}
    </div>
  );
}

export function CalendarScreen() {
  const save = useGame((s) => s.save);
  const claim = useGame((s) => s.calendarClaim);
  const now = useGameClock(30_000);
  if (!save) return null;

  if (save.hero.level < CALENDAR_UNLOCK_LEVEL) {
    return (
      <Panel variant="secondary">
        <EmptyState
          icon="calendar"
          title={t('calendar.title')}
          body={t('calendar.lockedHint', { level: CALENDAR_UNLOCK_LEVEL })}
        />
      </Panel>
    );
  }

  const claimed = slotsClaimed(save);
  const next = nextSlot(save);
  const canClaim = canClaimCalendar(save, now);
  const monthTheme = t(`calendar.month.${new Date(now).getMonth() + 1}` as I18nKey);

  return (
    <div className="flex flex-col gap-4">
      <Panel variant="primary">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-gold-bright">
              {t('calendar.title')}
            </h1>
            <p className="text-sm text-ink-muted">{t('calendar.subtitle')}</p>
            <p className="mt-1 text-[11px] font-bold text-teal">
              {t('calendar.monthTheme', { theme: monthTheme })}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-[11px] font-bold text-ink-faint">
              {t('calendar.progress', { claimed })}
            </span>
            {next === null ? (
              <span className="text-sm font-bold text-gold">{t('calendar.complete')}</span>
            ) : (
              <FButton disabled={!canClaim} onClick={claim}>
                <Icon id="calendar" size={16} /> {t('calendar.claim')}
              </FButton>
            )}
            {claimedToday(save, now) && next !== null && (
              <span className="text-[11px] text-ink-faint">{t('calendar.claimedToday')}</span>
            )}
          </div>
        </div>
        <ProgressBar
          variant="xp"
          value={claimed}
          max={CALENDAR_SLOTS.length}
          className="mt-3 h-2.5"
        />
      </Panel>

      <Panel variant="secondary">
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {CALENDAR_SLOTS.map((slot) => (
            <DayTile
              key={slot.day}
              day={slot.day}
              claimed={save.calendar.claimedDays.includes(slot.day)}
              isNext={slot.day === next}
            />
          ))}
        </div>
      </Panel>
    </div>
  );
}
