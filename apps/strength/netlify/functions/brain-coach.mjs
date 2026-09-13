import { proxyHybrid } from './_hybrid-proxy.mjs';

/** Athlete site is proxy-only — OpenRouter key lives on The Brain owner site. */
export async function handler(event) {
  return proxyHybrid(event, 'brain-coach');
}
