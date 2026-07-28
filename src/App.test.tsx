/** UI smoke: title renders, hero creation flows into the shell (jsdom + fake-indexeddb). */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/persist/db';
import { useGame } from '@/state/store';
import App from './App';

beforeEach(async () => {
  await db.saves.clear();
  await db.backups.clear();
  await db.meta.clear();
  useGame.setState({
    phase: 'boot',
    slots: [],
    lastActiveSlot: null,
    activeSlot: null,
    save: null,
    screen: 'tavern',
    settingsOpen: false,
    toasts: [],
  });
});

afterEach(cleanup);

describe('App', () => {
  it('boots to the title screen with three empty slots', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'SimpleRPG' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /New adventurer/ })).toHaveLength(3);
  });

  it('creates a hero and lands in the themed shell', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click((await screen.findAllByRole('button', { name: /New adventurer/ }))[0]!);
    await user.type(screen.getByPlaceholderText(/Grimble/), 'Testhero');
    await user.click(screen.getByRole('button', { name: /Mage/ }));
    await user.click(screen.getByRole('button', { name: /Sign the ledger/ }));

    // Shell: HUD shows the hero, tavern screen shows the placeholder panel
    expect(await screen.findByText('Testhero')).toBeInTheDocument();
    expect(screen.getByText('The Gilded Tankard')).toBeInTheDocument();
    expect(useGame.getState().phase).toBe('ingame');
    expect(useGame.getState().save?.hero.classId).toBe('mage');
  });
});
