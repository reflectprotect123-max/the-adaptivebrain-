import { proxyHybrid } from './_hybrid-proxy.mjs';

export async function handler(event) {
  return proxyHybrid(event, 'whoop-sync');
}
