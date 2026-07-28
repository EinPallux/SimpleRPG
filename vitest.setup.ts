// Shared test setup: DOM matchers (no-ops outside jsdom) and an IndexedDB
// implementation so Dexie-based persistence tests run in any environment.
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
