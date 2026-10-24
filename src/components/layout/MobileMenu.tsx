/**
 * MobileMenu — the small-screen navigation, as a real modal dialog.
 *
 * No dialog/focus library is installable (CONTRACT §0), so focus handling is
 * written here. The parts that can be pure functions are pure and exported for
 * direct unit testing, because the offline test environment has no DOM
 * (`environment: 'node'`, no jsdom) and cannot simulate a Tab keypress:
 *
 *   FOCUSABLE_SELECTOR  · the selector the trap queries with
 *   nextFocusIndex      · Tab / Shift+Tab cycling, given a count
 *   isEscape            · which keydowns close the dialog
 *   shouldLockScroll    · body scroll policy while open
 *
 * The imperative parts (focus(), keydown listener, scroll lock) live in effects
 * that only run on the client, so prerendering never touches `document`.
 */

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { Nav } from './Nav';
import { ThemeToggle } from './ThemeToggle';

/** id of the element the menu button points at with aria-controls. */
export const MOBILE_MENU_ID = 'mobile-nav-dialog';
export const MOBILE_MENU_LABEL_ID = 'mobile-nav-title';

/* -------------------------------------------------------------------------- */
/* Pure, testable helpers                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Focusable elements inside a container, in DOM order. Deliberately excludes
 * `[tabindex="-1"]`, disabled controls, and elements hidden by `hidden`.
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
  'details',
  'iframe',
  '[contenteditable]',
].join(', ');

/** Where Tab lands from `index` given `count` focusables, wrapping at the ends. */
export function nextFocusIndex(index: number, count: number): number {
  if (count <= 0) return -1;
  if (index < 0) return 0;
  return (index + 1) % count;
}

/** Same walking backwards (Shift+Tab). */
export function prevFocusIndex(index: number, count: number): number {
  if (count <= 0) return -1;
  if (index < 0) return count - 1;
  return (index - 1 + count) % count;
}

/** Index of `target` within a list, or -1. Split out so the trap is testable. */
export function focusIndexOf(elements: ArrayLike<string>, target: string | null): number {
  if (target === null) return -1;
  for (let i = 0; i < elements.length; i += 1) {
    if (elements[i] === target) return i;
  }
  return -1;
}

/** Escape closes; nothing else does (not Alt+Escape, not a repeating key). */
export function isEscape(event: { key?: string; repeat?: boolean }): boolean {
  return event.key === 'Escape' && event.repeat !== true;
}

/** Body scroll policy while the dialog is open. */
export function shouldLockScroll(open: boolean): boolean {
  return open === true;
}

/**
 * What the trigger's aria-expanded should read. `true` only when open.
 * (Named rather than inlined so the header/menu agree and it can be asserted.)
 */
export function menuAriaState(open: boolean): {
  'aria-expanded': boolean;
  'aria-controls': string;
} {
  return { 'aria-expanded': open, 'aria-controls': MOBILE_MENU_ID };
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                      */
/* -------------------------------------------------------------------------- */

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${(p) => p.theme.z.overlay};
  background: ${(p) => p.theme.color.scrim};
  animation: fade-in ${(p) => p.theme.motion.fast} ${(p) => p.theme.motion.easeOut};

  /* R1A-06: these were referenced but never defined — the open animation was
   * dead CSS. Nested @keyframes (the Spinner.tsx pattern) flatten verbatim,
   * so the rule ships in the same sheet as the component that uses it. */
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Panel = styled.div`
  position: fixed;
  inset: 0 0 auto 0;
  z-index: ${(p) => p.theme.z.overlay + 1};
  /* R7B-5: 100vh fallback BEFORE 100dvh — dvh needs Safari 15.4+/Firefox 101+;
   * on older engines the dvh line is invalid and dropped, and without the
   * fallback a tall menu has NO viewport cap (same pattern as Layout.tsx). */
  max-height: 100vh;
  max-height: 100dvh;
  overflow-y: auto;
  /* R7B-4: overscroll behavior containment — prevents page scroll/rubber-band
   * behind the open menu on iOS Safari. */
  overscroll-behavior: contain;
  /* Extreme-mobile (M4): safe-area insets both ends — top for standalone/
   * fullscreen notches, bottom for home-indicator devices. */
  padding: calc(${(p) => p.theme.space[5]} + env(safe-area-inset-top))
    ${(p) => p.theme.layout.gutter}
    calc(${(p) => p.theme.space[6]} + env(safe-area-inset-bottom));
  background: ${(p) => p.theme.color.bgElevated};
  border-bottom: 1px solid ${(p) => p.theme.color.border};
  box-shadow: ${(p) => p.theme.shadow.lg};
  font-family: ${(p) => p.theme.font.sans};
  animation: slide-down ${(p) => p.theme.motion.base} ${(p) => p.theme.motion.easeOut};

  /* R1A-06: defined alongside the reference (see Backdrop note). */
  @keyframes slide-down {
    from {
      transform: translateY(-8px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${(p) => p.theme.space[3]};
  margin-bottom: ${(p) => p.theme.space[4]};
`;

const Title = styled.h2`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.semibold};
  letter-spacing: ${(p) => p.theme.font.tracking.wider};
  text-transform: uppercase;
  color: ${(p) => p.theme.color.textSubtle};
`;

const CloseButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${(p) => p.theme.space[2]};
  min-width: 44px;
  min-height: 44px;
  padding: ${(p) => p.theme.space[2]} ${(p) => p.theme.space[3]};
  border: 1px solid ${(p) => p.theme.color.border};
  border-radius: ${(p) => p.theme.radius.md};
  background: transparent;
  color: ${(p) => p.theme.color.text};
  font-family: ${(p) => p.theme.font.sans};
  font-size: ${(p) => p.theme.font.sizes.sm};
  font-weight: ${(p) => p.theme.font.weights.medium};
  cursor: pointer;

  &:hover {
    background: ${(p) => p.theme.color.surfaceHover};
    border-color: ${(p) => p.theme.color.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.color.focus};
    outline-offset: 2px;
  }
`;

const FooterRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${(p) => p.theme.space[3]};
  margin-top: ${(p) => p.theme.space[5]};
  padding-top: ${(p) => p.theme.space[4]};
  border-top: 1px solid ${(p) => p.theme.color.border};
`;

const Hint = styled.p`
  margin: 0;
  font-size: ${(p) => p.theme.font.sizes.xs};
  color: ${(p) => p.theme.color.textSubtle};

  /* R2-D V9: "Press Escape" is a keyboard-only affordance — hidden on
   * touch-primary devices, where the tap-outside backdrop closes it. */
  @media (hover: none) {
    display: none;
  }
`;

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  /** Route used for active link state; defaults to the router (see Nav.tsx). */
  currentPath?: string;
  /** Element to return focus to when the dialog closes. */
  returnFocusRef?: { current: HTMLElement | null };
  /** Static markup only (prerender / tests): skip the DOM-touching effects. */
  staticRender?: boolean;
}

export function MobileMenu({
  open,
  onClose,
  currentPath,
  returnFocusRef,
  staticRender = false,
}: MobileMenuProps): ReactNode {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreTarget = useRef<HTMLElement | null>(null);
  const titleId = useId();

  /* Remember who opened us so closing can put focus back where it came from.
   * Captured on open, before focus moves. */
  useEffect(() => {
    if (!open) return;
    if (!returnFocusRef?.current && typeof document !== 'undefined') {
      restoreTarget.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    } else {
      restoreTarget.current = returnFocusRef?.current ?? null;
    }
  }, [open, returnFocusRef]);

  /* Move focus in on open; restore it on close/unmount. */
  useEffect(() => {
    if (staticRender) return;
    if (!open) {
      const target = restoreTarget.current;
      restoreTarget.current = null; /* R1-B F4: one-shot; a later open recaptures */
      /* offsetParent null = hidden (e.g. MenuSlot is display:none ≥769px and
       * the device rotated while open) — .focus() on hidden nodes lands
       * focus on <body>; skip instead. */
      if (target && typeof target.focus === 'function' && target.isConnected && target.offsetParent !== null) {
        target.focus();
      }
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? panel).focus({ preventScroll: true });
  }, [open, staticRender]);

  /* R1-B F4: aria-modal alone does not stop NVDA browse mode from reading and
   * activating the page *behind* the dialog — background landmarks must be
   * inert while open. We inert every top-level app landmark (everything
   * outside the dialog's own ancestor chain) for the duration of `open`. */
  useEffect(() => {
    if (staticRender || !open || typeof document === 'undefined') return;
    const dialog = panelRef.current;
    if (!dialog) return;
    const inerted: Element[] = [];
    for (const el of Array.from(document.body.children)) {
      if (el.contains(dialog) || el === dialog) continue;
      if (!(el instanceof HTMLElement)) continue;
      if (el.tagName === 'SCRIPT' || el.tagName === 'TEMPLATE') continue;
      if (el.hasAttribute('inert')) continue; /* already inert: don't steal it */
      el.setAttribute('inert', '');
      inerted.push(el);
    }
    return () => {
      for (const el of inerted) el.removeAttribute('inert');
    };
  }, [open, staticRender]);

  /* Escape + focus trap, scoped to the dialog while it is open. */
  useEffect(() => {
    if (staticRender || !open || typeof document === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEscape(event)) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const index = active ? focusables.indexOf(active) : -1;
      const next = event.shiftKey ? prevFocusIndex(index, focusables.length) : nextFocusIndex(index, focusables.length);
      const target = focusables[next];
      if (target) {
        event.preventDefault();
        target.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, staticRender]);

  /* Lock body scroll while open, restoring the previous value afterwards. */
  useEffect(() => {
    if (staticRender || !shouldLockScroll(open) || typeof document === 'undefined') return;
    const body = document.body;
    const previous = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previous;
    };
  }, [open, staticRender]);

  if (!open) return null;

  const labelId = `${titleId}-${MOBILE_MENU_LABEL_ID}`;

  return (
    <>
      {/* Presentational scrim. The click handler is a pointer-user convenience;
          Escape and the close button provide the equivalent by keyboard. */}
      <Backdrop data-testid="menu-backdrop" onClick={onClose} aria-hidden="true" />
      <Panel
        ref={panelRef}
        id={MOBILE_MENU_ID}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        data-testid="mobile-menu"
        className={css`
          outline: none;
        `}
      >
        <HeaderRow>
          <Title id={labelId}>Navigation</Title>
          <CloseButton
            type="button"
            onClick={onClose}
            data-testid="menu-close"
            aria-label="Close menu"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            Close
          </CloseButton>
        </HeaderRow>

        <Nav currentPath={currentPath} onNavigate={onClose} label="Mobile" id="mobile-nav-list" />

        <FooterRow>
          <ThemeToggle showLabel />
          <Hint>Press Escape to close</Hint>
        </FooterRow>
      </Panel>
    </>
  );
}
