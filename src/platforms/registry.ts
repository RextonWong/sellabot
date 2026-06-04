import type { PlatformAdapter } from './types';

const adapters = new Map<string, PlatformAdapter>();

export function registerAdapter(adapter: PlatformAdapter): void {
  adapters.set(adapter.platform, adapter);
}

export function getAdapter(platform: string): PlatformAdapter {
  const adapter = adapters.get(platform);
  if (!adapter) {
    throw new Error(
      `No adapter registered for platform "${platform}". ` +
        `Available: ${[...adapters.keys()].join(', ') || 'none'}`,
    );
  }
  return adapter;
}
