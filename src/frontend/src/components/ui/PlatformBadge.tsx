import { getPlatform } from '../../config/platforms';

interface Props {
  platform: string;
  size?: 'sm' | 'md';
}

export default function PlatformBadge({ platform, size = 'md' }: Props) {
  const p = getPlatform(platform);
  const dim = size === 'sm' ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[10px]';

  return (
    <span
      title={p.name}
      className={`${dim} rounded font-bold text-white flex items-center justify-center shrink-0`}
      style={{ backgroundColor: p.color }}
    >
      {p.initials === 'All' ? '★' : p.initials}
    </span>
  );
}
