import { type Profile, type ProfileName } from '#helpers/compare-docs/types.ts';

export const profiles: Record<ProfileName, Profile> = {
  desktop: { viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false, hover: true },
  'mobile-touch': { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, hover: false },
  'mobile-hover': { viewport: { width: 390, height: 844 }, isMobile: false, hasTouch: false, hover: true },
};
