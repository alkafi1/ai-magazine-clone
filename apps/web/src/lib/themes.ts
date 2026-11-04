import { THEMES, type Theme } from '@aimag/shared';

/** Colours used only to draw the little previews in the admin. The real theme CSS is in globals.css. */
export const THEME_PREVIEW: Record<
  Theme,
  {
    bg: string;
    card: string;
    ink: string;
    accent: string;
    highlight: string;
    mute: string;
    font: string;
    radius: string;
    dark?: boolean;
  }
> = {
  synthwire: {
    bg: '#faf8f3',
    card: '#ffffff',
    ink: '#0c1222',
    accent: '#5b3df5',
    highlight: '#ffb703',
    mute: '#e6e1d6',
    font: 'Georgia, serif',
    radius: '10px',
  },
  broadsheet: {
    bg: '#f3eee1',
    card: '#fbf8ef',
    ink: '#151515',
    accent: '#b3121b',
    highlight: '#151515',
    mute: '#d6cdb8',
    font: '"Times New Roman", serif',
    radius: '0px',
  },
  midnight: {
    bg: '#070c1b',
    card: '#0f1830',
    ink: '#e8f1ff',
    accent: '#22d3ee',
    highlight: '#a3e635',
    mute: '#1f2c4d',
    font: 'system-ui, sans-serif',
    radius: '12px',
    dark: true,
  },
};
export { THEMES };
