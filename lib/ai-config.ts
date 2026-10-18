import 'server-only';

/** Build-time public flag + runtime server flag: an accidentally configured key cannot spend in the free demo. */
export function isFreeDemo() {
  return process.env.DEGREEGPS_FREE_DEMO === 'true' || process.env.NEXT_PUBLIC_FREE_DEMO === 'true';
}
export function externalAiEnabled() {
  return !isFreeDemo() && Boolean(process.env.OPENAI_API_KEY);
}
export function aiUnavailableWarning() {
  return isFreeDemo()
    ? 'AI_DISABLED: external AI is disabled for the $0 demo; local retrieval and planning remain available.'
    : 'AI_UNAVAILABLE: no API key configured; using local retrieval and planning.';
}
