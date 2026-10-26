import React, { useEffect, useState } from 'react';
import { Municipality } from '../../types';
import { storage } from '../../services/storage';
import { X, Building2, Save, CheckCircle2 } from 'lucide-react';

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

  // Escape closes the settings dialog.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleUpdateMuni = (id: string, field: keyof Municipality, value: string | number) => {
    setMunicipalities((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const handleSaveAll = () => {
    municipalities.forEach((m) => storage.saveMunicipality(m));
    if (onMunicipalitiesUpdated) onMunicipalitiesUpdated();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="rg-animate-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        aria-describedby="settings-modal-description"
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <Building2 className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 id="settings-modal-title" className="text-sm font-semibold text-slate-100">
                Municipal dispatch configuration
              </h3>
              <p id="settings-modal-description" className="text-xs text-slate-400">
                Demo authorities, receiving emails, and response targets
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rg-icon-btn" aria-label="Close settings">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 overflow-y-auto p-5 sm:p-6">
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
            <strong className="font-semibold text-amber-300">Demo configuration.</strong> Names, receiving
            emails, and response targets below are editable local demo values. A live deployment would bind
            these to real municipal API gateways.
          </p>

          {savedNotice && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Configuration saved to local storage.</span>
            </div>
          )}

          <div className="space-y-4">
            {municipalities.map((muni) => {
              const fieldId = (field: string) => `muni-${muni.id}-${field}`;
              return (
                <fieldset
                  key={muni.id}
                  className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <legend className="sr-only">{muni.name || muni.id}</legend>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400">{muni.id}</span>
                    <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                      Demo simulated authority
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={fieldId('name')}
                        className="mb-1 block text-[11px] text-slate-400"
                      >
                        Authority name
                      </label>
                      <input
                        id={fieldId('name')}
                        type="text"
                        value={muni.name}
                        onChange={(e) => handleUpdateMuni(muni.id, 'name', e.target.value)}
                        className="rg-input !py-1.5"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={fieldId('email')}
                        className="mb-1 block text-[11px] text-slate-400"
                      >
                        Dispatch email
                      </label>
                      <input
                        id={fieldId('email')}
                        type="email"
                        value={muni.contactEmail}
                        onChange={(e) => handleUpdateMuni(muni.id, 'contactEmail', e.target.value)}
                        className="rg-input !py-1.5 font-mono"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={fieldId('department')}
                        className="mb-1 block text-[11px] text-slate-400"
                      >
                        Department wing
                      </label>
                      <input
                        id={fieldId('department')}
                        type="text"
                        value={muni.department}
                        onChange={(e) => handleUpdateMuni(muni.id, 'department', e.target.value)}
                        className="rg-input !py-1.5"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={fieldId('sla')}
                        className="mb-1 block text-[11px] text-slate-400"
                      >
                        Response target (hours)
                      </label>
                      <input
                        id={fieldId('sla')}
                        type="number"
                        min={1}
                        value={muni.slaHours}
                        onChange={(e) =>
                          handleUpdateMuni(muni.id, 'slaHours', Number(e.target.value))
                        }
                        className="rg-input !py-1.5 font-mono"
                      />
                    </div>
                  </div>
                </fieldset>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-3">
            <button type="button" onClick={onClose} className="rg-btn rg-btn-ghost">
              Cancel
            </button>
            <button type="button" onClick={handleSaveAll} className="rg-btn rg-btn-primary">
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Save configuration</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
