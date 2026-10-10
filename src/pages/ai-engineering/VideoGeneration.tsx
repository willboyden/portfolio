/**
 * /ai-engineering/video-generation — thin route shim over the shared detail
 * template (AiEngineering.tsx). The route registration lives with the
 * integrator; this file only pins the slug.
 */
import { AiCapabilityDetail } from '../AiEngineering';

export function VideoGeneration(): React.ReactNode {
  return <AiCapabilityDetail slug="video-generation" />;
}
