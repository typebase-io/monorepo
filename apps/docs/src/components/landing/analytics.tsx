'use client';

import { useEffect } from 'react';

import { trackLanding } from '#lib/track-landing.ts';

export function LandingAnalytics() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;

      const link = event.target.closest('a');

      if (!link) return;

      const url = new URL(link.href, window.location.origin);

      if (url.origin === window.location.origin && !url.pathname.startsWith('/docs')) return;

      trackLanding('landing_cta', {
        destination: url.origin === window.location.origin ? url.pathname : `${url.origin}${url.pathname}`,
        placement: link.closest('[data-landing-section]')?.getAttribute('data-landing-section') ?? 'page',
      });
    }

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  return null;
}
