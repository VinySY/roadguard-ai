import React, { useEffect, useState } from 'react';
import { User, UserRole } from '../../types';
import { storage, DEMO_USERS } from '../../services/storage';
import { X, Shield, Wrench, UserCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserChanged: (user: User | null, role: UserRole) => void;
}

type AuthTab = 'citizen' | 'staff';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onUserChanged }) => {
  const [activeTab, setActiveTab] = useState<AuthTab>('citizen');
  const [citizenEmail, setCitizenEmail] = useState('');
  const [citizenName, setCitizenName] = useState('');
  const [staffRole, setStaffRole] = useState<'worker' | 'inspector'>('worker');
  const [staffCode, setStaffCode] = useState('');

  // Escape closes the access dialog.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCitizenLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user: User = {
      id: 'cit-' + Date.now(),
      name: citizenName || 'Aarav Sharma',
      email: citizenEmail || 'aarav.sharma@example.com',
      role: 'citizen',
      assignedZone: 'Central Sector',
    };
    storage.setCurrentUser(user);
    storage.setActiveRole('citizen');
    onUserChanged(user, 'citizen');
    onClose();
  };

  const handleStaffLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const demoUser = DEMO_USERS[staffRole];
    storage.setCurrentUser(demoUser);
    storage.setActiveRole(staffRole);
    onUserChanged(demoUser, staffRole);
    onClose();
  };

  const handleContinueAsGuest = () => {
    storage.setCurrentUser(null);
    storage.setActiveRole('citizen');
    onUserChanged(null, 'citizen');
    onClose();
  };

  return (
    <div className="rg-animate-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-xs font-extrabold text-slate-950">
              RG
            </span>
            <h3 id="auth-modal-title" className="text-sm font-semibold text-slate-100">
              RoadGuard AI access
            </h3>
          </div>
          <button type="button" onClick={onClose} className="rg-icon-btn" aria-label="Close sign-in dialog">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Tab selection: citizen vs municipal staff */}
        <div role="tablist" aria-label="Sign-in type" className="flex border-b border-slate-800 text-xs">
          <button
            type="button"
            role="tab"
            id="auth-tab-citizen"
            aria-selected={activeTab === 'citizen'}
            aria-controls="auth-panel-citizen"
            onClick={() => setActiveTab('citizen')}
            className={`flex-1 border-b-2 py-3 text-center font-medium transition-colors ${
              activeTab === 'citizen'
                ? 'border-amber-500 bg-slate-950/40 font-semibold text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Citizen sign in
          </button>
          <button
            type="button"
            role="tab"
            id="auth-tab-staff"
            aria-selected={activeTab === 'staff'}
            aria-controls="auth-panel-staff"
            onClick={() => setActiveTab('staff')}
            className={`flex-1 border-b-2 py-3 text-center font-medium transition-colors ${
              activeTab === 'staff'
                ? 'border-amber-500 bg-slate-950/40 font-semibold text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Municipal staff portal
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 overflow-y-auto p-5 sm:p-6">
          {activeTab === 'citizen' ? (
            <form
              onSubmit={handleCitizenLogin}
              className="space-y-4"
              role="tabpanel"
              id="auth-panel-citizen"
              aria-labelledby="auth-tab-citizen"
            >
              <p className="text-xs leading-relaxed text-slate-400">
                Sign in to track your road defect submissions, receive municipal inspection updates, and
                verify repaired road sites.
              </p>

              <div>
                <label htmlFor="auth-name" className="mb-1 block text-[11px] text-slate-400">
                  Your full name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  value={citizenName}
                  onChange={(e) => setCitizenName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  autoComplete="name"
                  className="rg-input"
                />
              </div>

              <div>
                <label htmlFor="auth-email" className="mb-1 block text-[11px] text-slate-400">
                  Email address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={citizenEmail}
                  onChange={(e) => setCitizenEmail(e.target.value)}
                  placeholder="aarav.sharma@example.com"
                  autoComplete="email"
                  className="rg-input"
                />
              </div>

              <button type="submit" className="rg-btn rg-btn-primary w-full">
                Sign in &amp; remember session
              </button>

              <div className="border-t border-slate-800 pt-3 text-center">
                <button
                  type="button"
                  onClick={handleContinueAsGuest}
                  className="text-xs text-slate-400 underline transition-colors hover:text-slate-200"
                >
                  Continue as anonymous citizen (guest mode)
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={handleStaffLogin}
              className="space-y-4"
              role="tabpanel"
              id="auth-panel-staff"
              aria-labelledby="auth-tab-staff"
            >
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Demo staff access. Choose your operational capacity to enter the municipal workstation.
                </span>
              </div>

              <fieldset>
                <legend className="mb-1 block text-[11px] text-slate-400">Staff role</legend>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStaffRole('worker')}
                    aria-pressed={staffRole === 'worker'}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      staffRole === 'worker'
                        ? 'border-amber-500 bg-slate-950 font-semibold text-amber-400'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Wrench className="mb-1 h-4 w-4" aria-hidden="true" />
                    <span className="block text-xs">Field technician</span>
                    <span className="block text-[10px] text-slate-500">Quick response crew</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStaffRole('inspector')}
                    aria-pressed={staffRole === 'inspector'}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      staffRole === 'inspector'
                        ? 'border-amber-500 bg-slate-950 font-semibold text-amber-400'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Shield className="mb-1 h-4 w-4" aria-hidden="true" />
                    <span className="block text-xs">Chief inspector</span>
                    <span className="block text-[10px] text-slate-500">Municipal operations</span>
                  </button>
                </div>
              </fieldset>

              <div>
                <label htmlFor="auth-badge" className="mb-1 block text-[11px] text-slate-400">
                  Municipal department badge <span className="text-slate-500">(optional for demo)</span>
                </label>
                <input
                  id="auth-badge"
                  type="text"
                  value={staffCode}
                  onChange={(e) => setStaffCode(e.target.value)}
                  placeholder="MCC-ENG-2026"
                  className="rg-input font-mono"
                />
              </div>

              <button type="submit" className="rg-btn rg-btn-primary w-full">
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Authenticate &amp; enter workstation
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
