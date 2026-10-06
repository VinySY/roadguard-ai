import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { storage, DEMO_USERS } from '../../services/storage';
import { X, User as UserIcon, Shield, Wrench, CheckCircle2, Lock, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserChanged: (user: User | null, role: UserRole) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'citizen' | 'staff'>('citizen');
  const [citizenEmail, setCitizenEmail] = useState('');
  const [citizenName, setCitizenName] = useState('');
  const [staffRole, setStaffRole] = useState<'worker' | 'inspector'>('worker');
  const [staffCode, setStaffCode] = useState('');

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs">
              RG
            </div>
            <h3 className="text-sm font-semibold text-slate-100">RoadGuard AI Access</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection: Citizen vs Staff (Requirement 7) */}
        <div className="flex border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('citizen')}
            className={`flex-1 py-3 text-center font-medium transition-colors border-b-2 ${
              activeTab === 'citizen'
                ? 'border-amber-500 text-amber-400 font-semibold bg-slate-950/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Citizen Sign In
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex-1 py-3 text-center font-medium transition-colors border-b-2 ${
              activeTab === 'staff'
                ? 'border-amber-500 text-amber-400 font-semibold bg-slate-950/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Municipal Staff Portal
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {activeTab === 'citizen' ? (
            <form onSubmit={handleCitizenLogin} className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Sign in to track your road defect submissions, receive municipal inspection updates, and verify repaired road sites.
              </p>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Your Full Name</label>
                <input
                  type="text"
                  value={citizenName}
                  onChange={(e) => setCitizenName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Email Address</label>
                <input
                  type="email"
                  value={citizenEmail}
                  onChange={(e) => setCitizenEmail(e.target.value)}
                  placeholder="aarav.sharma@example.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm transition-colors"
              >
                Sign In & Remember Session
              </button>

              <div className="pt-2 border-t border-slate-800 text-center">
                <button
                  type="button"
                  onClick={handleContinueAsGuest}
                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  Continue as Anonymous Citizen (Guest Mode)
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleStaffLogin} className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Official Municipal Credentials: Select your operational capacity to enter the staff workstation.
                </span>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Staff Role</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStaffRole('worker')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      staffRole === 'worker'
                        ? 'bg-slate-950 border-amber-500 text-amber-400 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Wrench className="w-4 h-4 mb-1" />
                    <div className="text-xs">Field Technician</div>
                    <div className="text-[10px] text-slate-500">Quick Response Crew</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStaffRole('inspector')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      staffRole === 'inspector'
                        ? 'bg-slate-950 border-amber-500 text-amber-400 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Shield className="w-4 h-4 mb-1" />
                    <div className="text-xs">Chief Inspector</div>
                    <div className="text-[10px] text-slate-500">Municipal Operations</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Municipal Department Badge</label>
                <input
                  type="text"
                  value={staffCode}
                  onChange={(e) => setStaffCode(e.target.value)}
                  placeholder="MCC-ENG-2026 (Optional for Demo)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm transition-colors"
              >
                Authenticate & Enter Workstation
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
