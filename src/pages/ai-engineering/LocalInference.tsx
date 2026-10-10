/**
 * /ai-engineering/local-inference — thin route shim over the shared detail
 * template (AiEngineering.tsx). The route registration lives with the
 * integrator; this file only pins the slug.
 */
import { AiCapabilityDetail } from '../AiEngineering';

export function LocalInference(): React.ReactNode {
  return <AiCapabilityDetail slug="local-inference" />;
}
