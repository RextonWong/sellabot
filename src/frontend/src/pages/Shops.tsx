import { useEffect, useState } from 'react';
import { Plus, RefreshCw, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import { api } from '../api/client';
import { usePlatform } from '../App';
import { PLATFORMS, getPlatform } from '../config/platforms';
import PlatformBadge from '../components/ui/PlatformBadge';
import type { Shop } from '../types';

function ShopCard({ shop }: { shop: Shop }) {
  const connected = shop.tokenStatus === 'active';
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 bg-white hover:shadow-sm transition-shadow">
      <PlatformBadge platform={shop.platform} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{shop.name}</p>
        <p className="text-xs text-slate-500 mt-0.5">Region: {shop.region}</p>
      </div>
      <div className="flex items-center gap-2">
        {connected ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-200">
            <CheckCircle size={11} className="text-green-500" />
            <span className="text-xs font-medium text-green-700">Connected</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200">
            <XCircle size={11} className="text-red-500" />
            <span className="text-xs font-medium text-red-700">Token Expired</span>
          </div>
        )}
        {!connected && (
          <button className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Reconnect">
            <RefreshCw size={14} className="text-slate-500" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function Shops() {
  const { platform } = usePlatform();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  const displayPlatforms = PLATFORMS.filter((p) =>
    platform === 'all' || p.id === platform,
  ).filter((p) => p.id !== 'all');

  useEffect(() => {
    setLoading(true);
    api.shops(platform).then(setShops).catch(console.error).finally(() => setLoading(false));
  }, [platform]);

  function handleConnect(platformId: string) {
    if (platformId === 'shopee') {
      window.location.href = '/auth/shopee';
    } else {
      alert(`${getPlatform(platformId).name} OAuth integration coming soon.`);
    }
  }

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">Shops</h1>
        <p className="text-sm text-slate-500 mt-0.5">Connected marketplace stores.</p>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading…</p>
      ) : (
        <div className="space-y-8">
          {displayPlatforms.map((p) => {
            const platformShops = shops.filter((s) => s.platform === p.id);
            return (
              <div key={p.id}>
                {/* Section header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded text-white text-[10px] font-bold flex items-center justify-center"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.initials}
                    </span>
                    <h2 className="text-sm font-semibold text-slate-800">{p.name}</h2>
                    <span className="text-xs text-slate-400">({platformShops.length})</span>
                  </div>
                  <button
                    onClick={() => handleConnect(p.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: p.color }}
                  >
                    <Plus size={12} />
                    Connect Shop
                    <ExternalLink size={11} className="opacity-70" />
                  </button>
                </div>

                {platformShops.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                    <p className="text-slate-400 text-sm">No {p.name} shops connected yet.</p>
                    <button
                      onClick={() => handleConnect(p.id)}
                      className="mt-2 text-xs font-medium underline"
                      style={{ color: p.color }}
                    >
                      Connect your first shop
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {platformShops.map((shop) => (
                      <ShopCard key={shop.id} shop={shop} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
