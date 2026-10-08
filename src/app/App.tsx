import { Global, ThemeProvider } from '@emotion/react';
import { darkTheme } from '../theme/tokens';
import { SmokePage } from './SmokePage';

/**
 * Temporary app shell used to validate the vendored Emotion + Vite + Vitest +
 * prerender pipeline. BatchA replaces this with the real layout and routes.
 */
export function App(): React.ReactNode {
  return (
    <ThemeProvider theme={darkTheme}>
      <Global
        styles={{
          '*, *::before, *::after': { boxSizing: 'border-box' },
          body: { margin: 0, background: darkTheme.color.bg, color: darkTheme.color.text },
        }}
      />
      <SmokePage />
    </ThemeProvider>
  );
}
