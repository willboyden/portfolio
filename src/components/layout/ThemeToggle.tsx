/**
 * ThemeToggle — the theme control in the header: a button that shows the
 * theme in effect as a small swatch and opens a panel listing every theme.
 * ThemeOptions is that list on its own; the mobile menu renders it inline.
 *
 * WHAT A THEME IS: a paper, an ink and one highlighter (src/theme/tokens.ts).
 * Each option shows exactly those three as its swatch, so the list reads as a
 * shelf of paper stocks rather than a row of colour dots.
 *
 * SEMANTICS
 * - The options are native radio buttons in one group: arrow keys move
 *   between them and pick as they go (the page re-themes live, the panel
 *   stays open), Tab leaves, and a screen reader announces "radio button,
 *   3 of 13". "Match device" is the first option and forgets a stored choice.
 * - The button states the theme in effect in its label and exposes
 *   `aria-expanded` / `aria-controls`; Escape closes the panel and returns
 *   focus to the button; clicking or tabbing outside closes it.
 * - A polite live region states the RESULT after a change ("Theme:
 *   Blueprint"), because a changing label alone is announced too late.
 *
 * SSR: renders identically on server and client — the panel is closed until a
 * click, and the swatch on the button is drawn from CSS variables, so it shows
 * the right theme from the first paint with no script.
 */

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import styled from '@emotion/styled';
import { THEME_INFO, themeInfo, themes, type ThemeInfo, type ThemeMode, type ThemeName } from 'app/theme/tokens';
import { VisuallyHidden } from '../ui';
import { useThemePreference } from './ThemePreference';

/* -------------------------------------------------------------------------- */
/* Pure helpers (unit tested)                                                  */
/* -------------------------------------------------------------------------- */

/** What the button says: the theme in effect, and what pressing it does. */
export function themeButtonLabel(name: ThemeName, followingDevice: boolean): string {
  const { label } = themeInfo(name);
  return followingDevice ? `Theme: ${label}, matching your device. Choose a theme` : `Theme: ${label}. Choose a theme`;
}

/** The live-region text after a change. */
export function themeAnnouncement(name: ThemeName, followingDevice: boolean): string {
  const { label } = themeInfo(name);
  return followingDevice ? `Theme: ${label}, matching your device` : `Theme: ${label}`;
}

/** The themes of one mode, in picker order. */
export function themesOfMode(mode: ThemeMode): ThemeInfo[] {
  return THEME_INFO.filter((theme) => theme.mode === mode);
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                      */
/* -------------------------------------------------------------------------- */

const Wrap = styled.div`
  position: relative;
  display: inline-flex;
`;

const Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${(p) => p.theme.space[2]};
  min-width: 44px;
  min-height: 44px;
  padding: ${(p) => p.theme.space[2]};
  border: 1px solid ${(p) => p.theme.color.borderStrong};
  border-radius: ${(p) => p.theme.radius.md};
  background: transparent;
  color: ${(p) => p.theme.color.text};
  cursor: pointer;

  &:hover,
  &[aria-expanded='true'] {
    border-color: ${(p) => p.theme.color.rule};
    background: ${(p) => p.theme.color.accentSoft};
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }
`;

/* A page with a stroke of highlighter across its foot. Drawn from the CSS
 * variables of the theme in effect, so it is right before any script runs. */
const CurrentSwatch = styled.span`
  display: block;
  width: 18px;
  height: 18px;
  flex: none;
  background: ${(p) => p.theme.color.bgElevated};
  border: 1.5px solid ${(p) => p.theme.color.text};
  box-shadow: inset 0 -6px 0 ${(p) => p.theme.color.mark};
`;

const Panel = styled.div`
  position: absolute;
  top: calc(100% + ${(p) => p.theme.space[2]});
  right: 0;
  z-index: ${(p) => p.theme.z.dropdown};
  width: 23rem;
  max-height: calc(100vh - ${(p) => p.theme.layout.navHeight} - ${(p) => p.theme.space[5]});
  max-height: calc(100dvh - ${(p) => p.theme.layout.navHeight} - ${(p) => p.theme.space[5]});
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: ${(p) => p.theme.space[3]};
  background: ${(p) => p.theme.color.bgElevated};
  border: 1px solid ${(p) => p.theme.color.rule};
  box-shadow: ${(p) => p.theme.shadow.lg};
  font-family: ${(p) => p.theme.font.sans};

  /* On a phone the button is not at the edge of the screen, so a panel hung
   * from it would run off the side: pin it to the viewport under the header. */
  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    position: fixed;
    top: calc(${(p) => p.theme.layout.navHeight} + env(safe-area-inset-top));
    left: ${(p) => p.theme.space[3]};
    right: ${(p) => p.theme.space[3]};
    width: auto;
  }
`;

const Fieldset = styled.fieldset`
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
`;

const Legend = styled.legend`
  padding: 0;
  margin: 0 0 ${(p) => p.theme.space[2]};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  color: ${(p) => p.theme.color.text};
`;

const Columns = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[2]};
  padding-top: ${(p) => p.theme.space[2]};
  border-top: 1px solid ${(p) => p.theme.color.border};
`;

const GroupLabel = styled.p`
  margin: 0 0 ${(p) => p.theme.space[1]};
  padding-inline: ${(p) => p.theme.space[2]};
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};
`;

/* One option. The radio covers the whole tile (invisible, still focusable and
 * clickable); the tile next to it shows the state. Every rule that depends on
 * the radio's state is written from the label down, never with a trailing &. */
const Option = styled.label`
  position: relative;
  display: block;
  cursor: pointer;

  & input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  & input:checked + span {
    border-color: ${(p) => p.theme.color.rule};
    box-shadow: inset 0 -3px 0 ${(p) => p.theme.color.mark};
    font-weight: ${(p) => p.theme.font.weights.semibold};
  }

  & input:focus-visible + span {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }

  &:hover span[data-tile] {
    background: ${(p) => p.theme.color.accentSoft};
  }
`;

const Tile = styled.span`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[2]};
  min-height: 44px;
  padding: ${(p) => p.theme.space[1]} ${(p) => p.theme.space[2]};
  border: 1px solid transparent;
  border-radius: ${(p) => p.theme.radius.sm};
  font-size: ${(p) => p.theme.font.sizes.sm};
  line-height: ${(p) => p.theme.font.leading.snug};
  color: ${(p) => p.theme.color.text};
`;

/* The option's own paper, ink and highlighter (inline colours: a swatch shows
 * ITS theme, not the one in effect). */
const Swatch = styled.span`
  display: block;
  width: 20px;
  height: 20px;
  flex: none;
  border: 1.5px solid;
`;

/* -------------------------------------------------------------------------- */
/* The list of themes                                                          */
/* -------------------------------------------------------------------------- */

function swatchStyle(name: ThemeName): React.CSSProperties {
  const c = themes[name].color;
  return { background: c.bg, borderColor: c.text, boxShadow: `inset 0 -7px 0 ${c.mark}` };
}

/** "Match device" is the two defaults side by side. */
function deviceSwatchStyle(): React.CSSProperties {
  const light = themes.light.color;
  const dark = themes.dark.color;
  return {
    background: `linear-gradient(90deg, ${light.bg} 50%, ${dark.bg} 50%)`,
    borderColor: light.borderStrong,
    boxShadow: `inset 0 -7px 0 ${light.mark}`,
  };
}

export interface ThemeOptionsProps {
  /** Shown as the group's legend. */
  legend?: string;
  /** Extra class for the outer fieldset. */
  className?: string;
}

/**
 * Every theme as one radio group: "Match device", then the papers, then the
 * boards. Picking one applies it at once and remembers it; "Match device"
 * forgets the choice.
 */
export function ThemeOptions({ legend = 'Theme', className }: ThemeOptionsProps): ReactNode {
  const { preference, setPreference } = useThemePreference();
  const group = useId();

  const option = (value: 'system' | ThemeName, label: string, note: string, style: React.CSSProperties): ReactNode => (
    <Option key={value} title={note} data-testid={`theme-option-${value}`}>
      <input
        type="radio"
        name={group}
        value={value}
        checked={preference === value}
        onChange={() => setPreference(value)}
      />
      <Tile data-tile="">
        <Swatch aria-hidden="true" style={style} />
        {label}
      </Tile>
    </Option>
  );

  return (
    <Fieldset className={className} data-testid="theme-options">
      <Legend>{legend}</Legend>
      {option('system', 'Match device', 'Paper or Night, whichever your device is set to', deviceSwatchStyle())}
      <Columns>
        {(['light', 'dark'] as const).map((mode) => (
          <div key={mode}>
            <GroupLabel>{mode === 'light' ? 'Light' : 'Dark'}</GroupLabel>
            {themesOfMode(mode).map((theme) => option(theme.id, theme.label, theme.note, swatchStyle(theme.id)))}
          </div>
        ))}
      </Columns>
    </Fieldset>
  );
}

/* -------------------------------------------------------------------------- */
/* The header control                                                          */
/* -------------------------------------------------------------------------- */

export interface ThemeToggleProps {
  className?: string;
  /** Render with the panel open (tests). */
  defaultOpen?: boolean;
}

export function ThemeToggle({ className, defaultOpen = false }: ThemeToggleProps): ReactNode {
  const { themeName, preference } = useThemePreference();
  const [open, setOpen] = useState(defaultOpen);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const followingDevice = preference === 'system';
  const label = themeButtonLabel(themeName, followingDevice);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  /* Opening moves focus to the option in effect, so arrow keys work at once. */
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus({ preventScroll: true });
  }, [open]);

  /* A press anywhere outside closes the panel (focus stays where the press put it). */
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const onPress = (event: PointerEvent): void => {
      const wrap = wrapRef.current;
      if (wrap && event.target instanceof Node && !wrap.contains(event.target)) close(false);
    };
    document.addEventListener('pointerdown', onPress);
    return () => document.removeEventListener('pointerdown', onPress);
  }, [open, close]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      close(true);
    }
  };

  /* Tabbing out of the control closes it; focus moving within it does not. */
  const onBlur = (event: React.FocusEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget;
    if (open && next instanceof Node && !event.currentTarget.contains(next)) close(false);
  };

  return (
    <Wrap ref={wrapRef} onKeyDown={onKeyDown} onBlur={onBlur}>
      <Button
        type="button"
        ref={buttonRef}
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        title="Choose a theme"
        data-testid="theme-toggle"
        data-theme={themeName}
        className={className}
      >
        <CurrentSwatch aria-hidden="true" />
      </Button>
      {open ? (
        <Panel id={panelId} ref={panelRef} data-testid="theme-panel">
          <ThemeOptions />
        </Panel>
      ) : null}
      {/* polite, not assertive — the palette flips instantly; the words are
       * confirmation, never an interrupt. SIBLING of the button (live text
       * inside a button would be flattened into its accessible name),
       * visually hidden via clip like VisuallyHidden. */}
      <VisuallyHidden data-testid="theme-announcement" role="status" aria-live="polite">
        {themeAnnouncement(themeName, followingDevice)}
      </VisuallyHidden>
    </Wrap>
  );
}
