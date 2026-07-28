import { useMemo, useRef, useState } from 'react';
import { CLASSES } from '@/content/classes';
import { EMBLEM_ICONS, EMBLEM_PALETTES } from '@/content/emblems';
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH } from '@/engine/constants';
import { systemClock } from '@/engine/clock';
import { deriveEmblem } from '@/engine/newSave';
import type { ClassId, SlotSummary } from '@/engine/types';
import { t, type I18nKey } from '@/i18n';
import { encodeSave } from '@/persist/codec';
import { loadSlot } from '@/persist/saves';
import { useGame } from '@/state/store';
import { EmblemAvatar } from '../components/EmblemAvatar';
import { FButton } from '../components/FButton';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { relativeTime } from '../format';
import type { IconId } from '../icons.gen';

declare const __APP_VERSION__: string;

type Dialog =
  | { kind: 'none' }
  | { kind: 'create'; slot: number }
  | { kind: 'import'; slot: number }
  | { kind: 'delete'; slot: number; summary: SlotSummary }
  | { kind: 'exportCode'; code: string };

// ---------------------------------------------------------------------------

function SlotCard({
  slot,
  summary,
  onNew,
  onImport,
  onDelete,
  onExport,
}: {
  slot: number;
  summary: SlotSummary | null;
  onNew: () => void;
  onImport: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const continueSlot = useGame((s) => s.continueSlot);

  if (!summary) {
    return (
      <div className="frame-secondary--muted panel-fill flex min-h-56 flex-col items-center justify-center gap-3 p-5 text-center">
        <Icon id="quests" size={30} className="text-ink-faint" />
        <p className="text-sm text-ink-faint">{t('title.emptySlot')}</p>
        <FButton onClick={onNew}>
          <Icon id="plus" size={14} />
          {t('title.newHero')}
        </FButton>
        <FButton variant="quiet" size="sm" onClick={onImport}>
          <Icon id="import" size={13} />
          {t('title.import')}
        </FButton>
      </div>
    );
  }

  const cls = CLASSES.find((c) => c.id === summary.classId)!;
  return (
    <div className="frame-primary panel-fill flex min-h-56 flex-col items-center gap-2 p-5 text-center">
      <EmblemAvatar emblem={summary.portrait} classId={summary.classId} size={64} />
      <div>
        <div className="font-display text-lg font-bold text-ink">{summary.name}</div>
        <div className="text-xs font-bold" style={{ color: `var(${cls.colorVar})` }}>
          {t(`class.${summary.classId}.name` as I18nKey)} ·{' '}
          {t('common.levelShort', { level: summary.level })}
        </div>
        <div className="mt-0.5 text-[11px] text-ink-faint">
          {t('title.lastPlayed', {
            when: relativeTime(summary.updatedAt, systemClock.now()),
          })}
        </div>
      </div>
      <FButton size="lg" className="mt-auto w-full" onClick={() => void continueSlot(slot)}>
        {t('title.continue')}
      </FButton>
      <div className="flex gap-2">
        <FButton variant="quiet" size="sm" onClick={onExport}>
          <Icon id="export" size={13} />
          {t('title.export')}
        </FButton>
        <FButton variant="danger" size="sm" onClick={onDelete}>
          <Icon id="trash" size={13} />
          {t('title.delete')}
        </FButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CreateDialog({ slot, onClose }: { slot: number; onClose: () => void }) {
  const createHero = useGame((s) => s.createHero);
  const [name, setName] = useState('');
  const [classId, setClassId] = useState<ClassId>('warrior');
  const [cycle, setCycle] = useState(0);

  const trimmed = name.trim();
  const valid = trimmed.length >= NAME_MIN_LENGTH && trimmed.length <= NAME_MAX_LENGTH;

  const emblem = useMemo(() => {
    const base = deriveEmblem(trimmed || 'Adventurer', classId);
    if (cycle === 0) return base;
    return {
      icon: EMBLEM_ICONS[(EMBLEM_ICONS.indexOf(base.icon) + cycle) % EMBLEM_ICONS.length]!,
      palette: (base.palette + cycle * 5) % EMBLEM_PALETTES.length,
    };
  }, [trimmed, classId, cycle]);

  const hpTierKey = (factor: number): I18nKey => `create.hpTier.${factor}` as I18nKey;

  return (
    <Modal title={t('create.title')} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-xs font-extrabold tracking-[0.18em] text-ink-faint uppercase">
            {t('create.nameLabel')}
          </span>
          <input
            autoFocus
            value={name}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('create.namePlaceholder')}
            className="w-full rounded-sm border border-ink-faint/40 bg-panel-inset px-3 py-2 font-display text-lg text-ink placeholder:text-ink-faint"
          />
          <span className="mt-1 block text-[11px] text-ink-faint">{t('create.nameHelp')}</span>
        </label>

        <fieldset>
          <legend className="mb-2 text-xs font-extrabold tracking-[0.18em] text-ink-faint uppercase">
            {t('create.classLabel')}
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CLASSES.map((cls) => {
              const active = classId === cls.id;
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setClassId(cls.id)}
                  aria-pressed={active}
                  className={`${active ? 'frame-secondary--gold' : 'frame-secondary--muted'} panel-fill relative p-3 text-left transition-[filter] hover:brightness-110`}
                  style={{ ['--frame-w' as string]: '10px' }}
                >
                  {cls.id === 'warrior' && (
                    <span className="absolute -top-1 right-2 rounded-sm bg-gold px-1.5 py-0.5 text-[9px] font-extrabold text-canvas">
                      {t('create.recommended')}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <Icon
                      id={cls.icon as IconId}
                      size={22}
                      className={active ? 'text-gold' : 'text-ink-muted'}
                    />
                    <span
                      className="font-display text-base font-bold"
                      style={{ color: `var(${cls.colorVar})` }}
                    >
                      {t(`class.${cls.id}.name` as I18nKey)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted italic">
                    {t(`class.${cls.id}.blurb` as I18nKey)}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-ink-faint">
                    {t(`class.${cls.id}.signature` as I18nKey)}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {t('create.mainAttr', { attr: t(`attr.${cls.mainAttr}.name` as I18nKey) })} ·{' '}
                    {t('create.hp')}: {t(hpTierKey(cls.hpFactor))}
                  </p>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-center gap-4">
          <div>
            <span className="mb-1 block text-xs font-extrabold tracking-[0.18em] text-ink-faint uppercase">
              {t('create.emblemLabel')}
            </span>
            <EmblemAvatar emblem={emblem} classId={classId} size={72} />
          </div>
          <FButton variant="quiet" size="sm" onClick={() => setCycle((c) => c + 1)}>
            {t('create.emblemCycle')}
          </FButton>
          <FButton
            size="lg"
            className="ml-auto"
            disabled={!valid}
            title={valid ? undefined : t('create.nameTooShort')}
            onClick={() => {
              void createHero(slot, { name: trimmed, classId, emblem });
            }}
          >
            {t('create.confirm')}
          </FButton>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function ImportDialog({ slot, onClose }: { slot: number; onClose: () => void }) {
  const importCode = useGame((s) => s.importCode);
  const toast = useGame((s) => s.toast);
  const slots = useGame((s) => s.slots);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const occupied = slots[slot - 1];

  const submit = async () => {
    const result = await importCode(slot, code);
    if (result.ok) {
      const imported = useGame.getState().slots[slot - 1];
      toast(t('toast.importOk', { name: imported?.name ?? '?', slot }));
      onClose();
    } else {
      setError(result.message);
    }
  };

  return (
    <Modal title={t('title.importTitle')} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t('title.importHint')}</p>
        {occupied && (
          <p className="text-sm font-bold text-[#e08a7a]">
            {t('title.slotOccupiedWarning', { name: occupied.name })}
          </p>
        )}
        <textarea
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          spellCheck={false}
          className="h-28 w-full rounded-sm border border-ink-faint/40 bg-panel-inset p-2 font-mono text-[10px] text-ink-muted"
          placeholder="SRPG1.…"
        />
        <input
          ref={fileRef}
          type="file"
          accept=".simplerpg,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => {
              setCode(text.trim());
              setError(null);
            });
          }}
        />
        {error && <p className="text-sm font-bold text-[#e08a7a]">{error}</p>}
        <div className="flex justify-between gap-2">
          <FButton variant="quiet" onClick={() => fileRef.current?.click()}>
            {t('title.importFile')}
          </FButton>
          <FButton disabled={code.trim().length === 0} onClick={() => void submit()}>
            <Icon id="import" size={14} />
            {t('title.importAction')}
          </FButton>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function DeleteDialog({
  slot,
  summary,
  onClose,
}: {
  slot: number;
  summary: SlotSummary;
  onClose: () => void;
}) {
  const deleteSlot = useGame((s) => s.deleteSlot);
  const toast = useGame((s) => s.toast);
  const [typed, setTyped] = useState('');
  const match = typed.trim() === summary.name;

  return (
    <Modal
      title={t('title.deleteConfirmTitle', { name: summary.name })}
      onClose={onClose}
      variant="danger"
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed text-ink-muted">{t('title.deleteConfirmBody')}</p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={summary.name}
          className="w-full rounded-sm border border-ink-faint/40 bg-panel-inset px-3 py-2 text-ink"
        />
        {!match && typed.length > 0 && (
          <p className="text-xs text-ink-faint">{t('title.deleteNameMismatch')}</p>
        )}
        <div className="flex justify-end gap-2">
          <FButton variant="quiet" onClick={onClose}>
            {t('common.cancel')}
          </FButton>
          <FButton
            variant="danger"
            disabled={!match}
            onClick={() => {
              void deleteSlot(slot).then(() => {
                toast(t('toast.deleted', { name: summary.name }));
                onClose();
              });
            }}
          >
            <Icon id="trash" size={14} />
            {t('title.deleteConfirmAction')}
          </FButton>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export function TitleScreen() {
  const slots = useGame((s) => s.slots);
  const toast = useGame((s) => s.toast);
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });

  const exportSlot = async (slot: number) => {
    const save = await loadSlot(slot);
    if (!save) return;
    const code = encodeSave(save);
    try {
      await navigator.clipboard.writeText(code);
      toast(t('toast.exportCopied'));
    } catch {
      setDialog({ kind: 'exportCode', code });
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <header className="text-center">
        <h1 className="font-display text-5xl font-bold tracking-[0.12em] text-gold [text-shadow:0_0_28px_rgba(217,169,75,0.35)] md:text-6xl">
          {t('app.title')}
        </h1>
        <div className="mx-auto mt-3 h-px w-56 bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
        <p className="mt-3 text-sm tracking-wide text-ink-muted">{t('title.subtitle')}</p>
      </header>

      <main className="grid w-full max-w-4xl gap-4 md:grid-cols-3">
        {[1, 2, 3].map((slot) => (
          <SlotCard
            key={slot}
            slot={slot}
            summary={slots[slot - 1] ?? null}
            onNew={() => setDialog({ kind: 'create', slot })}
            onImport={() => setDialog({ kind: 'import', slot })}
            onDelete={() => {
              const summary = slots[slot - 1];
              if (summary) setDialog({ kind: 'delete', slot, summary });
            }}
            onExport={() => void exportSlot(slot)}
          />
        ))}
      </main>

      <footer className="text-center text-xs text-ink-faint">
        <p>{t('app.tagline')}</p>
        <p className="mt-1">{t('title.version', { version: __APP_VERSION__ })}</p>
      </footer>

      {dialog.kind === 'create' && (
        <CreateDialog slot={dialog.slot} onClose={() => setDialog({ kind: 'none' })} />
      )}
      {dialog.kind === 'import' && (
        <ImportDialog slot={dialog.slot} onClose={() => setDialog({ kind: 'none' })} />
      )}
      {dialog.kind === 'delete' && (
        <DeleteDialog
          slot={dialog.slot}
          summary={dialog.summary}
          onClose={() => setDialog({ kind: 'none' })}
        />
      )}
      {dialog.kind === 'exportCode' && (
        <Modal title={t('title.export')} onClose={() => setDialog({ kind: 'none' })}>
          <textarea
            readOnly
            value={dialog.code}
            onFocus={(e) => e.currentTarget.select()}
            className="h-32 w-full rounded-sm border border-ink-faint/40 bg-panel-inset p-2 font-mono text-[10px] text-ink-muted"
          />
        </Modal>
      )}
    </div>
  );
}
