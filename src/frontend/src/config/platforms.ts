export interface PlatformConfig {
  id: string;
  name: string;
  color: string;
  darkColor: string;   // for sidebar/dark surfaces (TikTok uses near-black)
  initials: string;
}

// Adding a new platform = adding one entry here. No UI redesign needed.
export const PLATFORMS: PlatformConfig[] = [
  {
    id: 'all',
    name: 'All Platforms',
    color: '#3B82F6',
    darkColor: '#3B82F6',
    initials: 'All',
  },
  {
    id: 'shopee',
    name: 'Shopee',
    color: '#EE4D2D',
    darkColor: '#EE4D2D',
    initials: 'S',
  },
  {
    id: 'lazada',
    name: 'Lazada',
    color: '#F57224',
    darkColor: '#F57224',
    initials: 'L',
  },
  {
    id: 'tiktokshop',
    name: 'TikTok Shop',
    color: '#FE2C55',
    darkColor: '#010101',
    initials: 'TT',
  },
];

export function getPlatform(id: string): PlatformConfig {
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0];
}
