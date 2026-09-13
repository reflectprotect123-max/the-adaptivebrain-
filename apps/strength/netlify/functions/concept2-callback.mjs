import { proxyHybrid } from './_hybrid-proxy.mjs';

/** Browser OAuth callback is owned by hybrid; proxy kept for same-origin completeness. */
export async function handler(event) {
  return proxyHybrid(event, 'concept2-callback');
}
