import { useEffect, useState } from 'react';
import { Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { usePlatform } from '../App';
import type { Shop, SubmitTaskResult } from '../types';

const EXAMPLES = [
  'Check my low stock items and list them',
  'Reply to all unanswered buyer messages',
  'Update the stock for SKU-123 to 50 units',
  'Create a 10% off voucher valid this weekend',
];

export default function TaskSubmission() {
  const { platform } = usePlatform();

  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState('');
  const [intent, setIntent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SubmitTaskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.shops(platform).then(setShops).catch(console.error);
  }, [platform]);

  useEffect(() => {
    if (shops.length > 0 && !selectedShop) setSelectedShop(shops[0].id);
  }, [shops, selectedShop]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedShop || !intent.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await api.submitTask(selectedShop, intent.trim());
      setResult(res);
      setIntent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit task');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">Submit Task</h1>
        <p className="text-sm text-slate-500 mt-0.5">Tell the AI what you need done in plain language.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        {/* Shop selector */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Target Shop</label>
          {shops.length === 0 ? (
            <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700 flex items-center gap-2">
              <AlertCircle size={16} />
              No shops connected. Go to <a href="/shops" className="underline font-medium">Shops</a> to connect one.
            </div>
          ) : (
            <select
              value={selectedShop}
              onChange={(e) => setSelectedShop(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  [{shop.platform.toUpperCase()}] {shop.name} ({shop.region})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Intent input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            What do you want the AI to do?
          </label>
          <textarea
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="e.g. Check my low stock items and alert me"
            rows={4}
            className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {/* Examples */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setIntent(ex)}
                className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !selectedShop || !intent.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#3B82F6' }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {loading ? 'Submitting…' : 'Submit Task'}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} className="text-green-600" />
            <span className="text-sm font-semibold text-green-800">Task queued successfully</span>
          </div>
          <p className="text-xs text-green-700 font-mono">Task ID: {result.taskId}</p>
          <p className="text-xs text-green-600 mt-1">{result.message}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
