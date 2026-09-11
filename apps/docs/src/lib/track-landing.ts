import { track } from '@vercel/analytics';

export function trackLanding(event: 'landing_cta' | 'landing_demo' | 'landing_copy', data: Record<string, string>) {
  track(event, data);
}
