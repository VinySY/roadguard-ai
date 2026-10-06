import React, { useState } from 'react';
import { Municipality } from '../../types';
import { storage } from '../../services/storage';
import { X, Building2, Plus, Save, CheckCircle2, ShieldCheck, Mail } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMunicipalitiesUpdated?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onMunicipalitiesUpdated,
}) => {
  const [municipalities, setMunicipalities] = useState<Municipality[]>(storage.getMunicipalities());
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleUpdateMuni = (id: string, field: keyof Municipality, value: any) => {
    setMunicipalities((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleSaveAll = () => {
    municipalities.forEach((m) => storage.saveMunicipality(m));
    if (onMunicipalitiesUpdated) onMunicipalitiesUpdated();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Municipal Dispatch Configuration</h3>
              <p className="text-xs text-slate-400">Configure Demo Municipalities & Emergency Routing SLAs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
            <strong>Configurable Demo Mode:</strong> You can edit municipal names, official receiving emails, and response SLAs below. In live production deployment, these bind to real municipal API gateways.
          </div>

          {savedNotice && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Configuration successfully saved to local storage.</span>
            </div>
          )}

          <div className="space-y-4">
            {municipalities.map((muni) => (
              <div
                key={muni.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-400">{muni.id}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    Demo Simulated Authority
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Authority Name</label>
                    <input
                      type="text"
                      value={muni.name}
                      onChange={(e) => handleUpdateMuni(muni.id, 'name', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Dispatch Email</label>
                    <input
                      type="email"
                      value={muni.contactEmail}
                      onChange={(e) => handleUpdateMuni(muni.id, 'contactEmail', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Department Wing</label>
                    <input
                      type="text"
                      value={muni.department}
                      onChange={(e) => handleUpdateMuni(muni.id, 'department', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">SLA Target (Hours)</label>
                    <input
                      type="number"
                      value={muni.slaHours}
                      onChange={(e) => handleUpdateMuni(muni.id, 'slaHours', Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAll}
              className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Configuration</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
