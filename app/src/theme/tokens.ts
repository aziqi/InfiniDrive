// InfiniDrive — Centralized design tokens (mirrors index.css CSS variables).
// Use these in TS/JS contexts (charts, canvas, inline styles) so the
// design language stays in one place alongside the CSS variable source.
export const tokens = {
  color: {
    bgMain: 'var(--bg-main)',
    bgSidebar: 'var(--bg-sidebar)',
    bgCard: 'var(--bg-card)',
    bgCardHover: 'var(--bg-card-hover)',
    bgInput: 'var(--bg-input)',
    border: 'var(--border-color)',
    borderHover: 'var(--border-hover)',
    accentBlue: 'var(--accent-blue)',
    accentIndigo: 'var(--accent-indigo)',
    accentCyan: 'var(--accent-cyan)',
    accentEmerald: 'var(--accent-emerald)',
    accentRose: 'var(--accent-rose)',
    accentAmber: 'var(--accent-amber)',
    textPrimary: 'var(--text-primary)',
    textSecondary: 'var(--text-secondary)',
    textMuted: 'var(--text-muted)',
  },
  // Raw hex values for contexts where CSS vars don't resolve (e.g. canvas).
  hex: {
    accentBlue: '#3b7bff',
    accentIndigo: '#6366f1',
    accentCyan: '#06b6d4',
    accentEmerald: '#10b981',
    accentRose: '#f43f5e',
    accentAmber: '#f59e0b',
    surface: '#0d101c',
  },
  radius: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.25rem',
  },
} as const;

export type Tokens = typeof tokens;
