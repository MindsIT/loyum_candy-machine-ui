import { FC, useState } from 'react';
import { notify } from '../utils/notifications';

export const TokenCreator: FC = () => {
  const [initialSupply, setInitialSupply] = useState<number>(1000);
  const [decimals, setDecimals] = useState<number>(6);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{
    open: boolean;
    title: string;
    description?: string;
    status: 'success' | 'error';
  }>({ open: false, title: '', description: '', status: 'success' });

  const onSubmit = async () => {
    setLoading(true);
    try {
      console.log('[TokenCreator] submit', { initialSupply, decimals });
      const res = await fetch('/api/create-spl-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialSupply, decimals }),
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch (_) {
        data = {};
      }
      console.log('[TokenCreator] response', res.status, data);
      if (!res.ok) {
        throw new Error(data?.error || 'Erreur lors de la publication');
      }
      notify({
        type: 'success',
        message: 'Création demandée',
        description: `Message Pub/Sub ${data.messageId || ''}`,
      });
      setPopup({
        open: true,
        title: 'Création demandée',
        description: `Message Pub/Sub ${data.messageId || 'en file'}`,
        status: 'success',
      });
    } catch (err: any) {
      notify({
        type: 'error',
        message: 'Échec création SPL',
        description: err?.message,
      });
      console.error('[TokenCreator] error', err);
      setPopup({
        open: true,
        title: 'Échec création SPL',
        description: err?.message || 'Erreur inconnue',
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="w-full max-w-6xl mx-auto bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl px-6 py-6 shadow-xl min-h-[340px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">Frapper des SPL Tokens</h3>
          <span className="text-[11px] px-2 py-1 rounded-full bg-indigo-500/15 text-indigo-200 border border-indigo-500/30">
            Beta
          </span>
        </div>
        <div className="space-y-5">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Quantité initiale</label>
            <input
              type="number"
              min={1}
              value={initialSupply}
              onChange={(e) => setInitialSupply(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-white/90 text-black border border-white/20 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Décimales (0-9)</label>
            <input
              type="number"
              min={0}
              max={9}
              value={decimals}
              onChange={(e) => setDecimals(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-white/90 text-black border border-white/20 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
          </div>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="w-full py-3 text-white font-semibold bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 rounded-xl shadow-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? 'Publication…' : 'Publier la création'}
          </button>
          <p className="text-xs text-slate-400">
            Cette action publie un message Pub/Sub sur le topic <code>create-spl-token</code>.
            Assure-toi que les identifiants Google et le projet sont configurés côté serveur.
          </p>
        </div>
      </div>
      {popup.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl shadow-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-white">{popup.title}</h4>
              <span
                className={`text-xs px-2 py-1 rounded-full border ${
                  popup.status === 'success'
                    ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'
                    : 'bg-rose-500/15 text-rose-200 border-rose-500/40'
                }`}
              >
                {popup.status === 'success' ? 'Succès' : 'Erreur'}
              </span>
            </div>
            {popup.description && (
              <p className="text-sm text-slate-200">{popup.description}</p>
            )}
            <button
              onClick={() => setPopup({ ...popup, open: false })}
              className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 text-white font-semibold shadow-lg hover:opacity-90 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
};
