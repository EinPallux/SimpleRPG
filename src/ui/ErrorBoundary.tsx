import { Component, type ReactNode } from 'react';

declare const __APP_VERSION__: string;

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * The "tavern fire" screen (TECHNICAL_ARCHITECTURE.md §11): never a white page.
 * Deliberately styled without game components — it must render even if they broke.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private buildReport(): string {
    return JSON.stringify(
      {
        version: __APP_VERSION__,
        when: new Date().toISOString(),
        error: String(this.state.error?.stack ?? this.state.error),
        userAgent: navigator.userAgent,
      },
      null,
      2,
    );
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          color: '#e8e3d5',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ color: '#d9a94b', fontSize: 28 }}>The tavern caught fire.</h1>
        <p style={{ maxWidth: 480, color: '#9aa5b5' }}>
          Something broke that shouldn't have. Your save is on your device and untouched — reload to
          carry on. If it happens again, copy the report below into a GitHub issue.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => location.reload()}
            style={{
              background: '#d9a94b',
              color: '#0e1420',
              border: 0,
              padding: '10px 20px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          <button
            onClick={() => void navigator.clipboard.writeText(this.buildReport()).catch(() => {})}
            style={{
              background: 'transparent',
              color: '#9aa5b5',
              border: '1px solid #5e6a7a',
              padding: '10px 20px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Copy debug report
          </button>
        </div>
        <textarea
          readOnly
          value={this.buildReport()}
          style={{
            width: 'min(600px, 90vw)',
            height: 120,
            background: '#0b111b',
            color: '#5e6a7a',
            border: '1px solid #2a3547',
            fontSize: 10,
            fontFamily: 'monospace',
            padding: 8,
          }}
        />
      </div>
    );
  }
}
