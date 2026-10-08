import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';

const Shell = styled.main`
  max-width: ${(p) => p.theme.layout.maxWidth};
  margin: 0 auto;
  padding: ${(p) => p.theme.space[6]} ${(p) => p.theme.layout.gutter};

  & h1 {
    font-size: ${(p) => p.theme.font.sizes['4xl']};
    font-weight: ${(p) => p.theme.font.weights.bold};
    letter-spacing: ${(p) => p.theme.font.tracking.tight};
    margin: 0 0 ${(p) => p.theme.space[3]};
  }

  & .lede {
    color: ${(p) => p.theme.color.textMuted};
    font-size: ${(p) => p.theme.font.sizes.lg};
  }

  @media (max-width: ${(p) => p.theme.breakpoint.md}) {
    padding-top: ${(p) => p.theme.space[4]};
  }
`;

export function SmokePage(): React.ReactNode {
  const theme = useTheme();
  return (
    <Shell>
      <h1>Alex Rivera</h1>
      <p className="lede">Scaffold smoke test — theme accent {theme.color.accent}</p>
    </Shell>
  );
}
