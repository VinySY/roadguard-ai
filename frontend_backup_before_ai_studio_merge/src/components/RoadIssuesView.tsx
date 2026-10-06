import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Upload, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Tag, 
  Camera, 
  FileText,
  Info,
  RefreshCw,
  Edit3
} from 'lucide-react';
import { PotholeSeverity } from '../types/detection';
import { 
  fetchRoadIssues, 
  createRoadIssue, 
  updateRoadIssueStatus, 
  RoadIssueRecord 
} from '../services/api';

const STATUS_OPTIONS = ['Reported', 'In Inspection', 'Scheduled for Repair', 'Resolved'] as const;

export const RoadIssuesView: React.FC = () => {
  const [issues, setIssues] = useState<RoadIssueRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Form states
  const [category, setCategory] = useState<RoadIssueRecord['category']>('Pothole');
  const [severity, setSeverity] = useState<PotholeSeverity>('high');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locating, setLocating] = useState(false);
  const [description, setDescription] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadIssues = async () => {
    try {
      setLoading(true);
      const data = await fetchRoadIssues(statusFilter);
      setIssues(data.issues || []);
    } catch (err: any) {
      console.warn('Failed to load road issues:', err.message);
      setFeedbackMessage({ type: 'error', text: `Failed to load issues: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [statusFilter]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      (err) => {
        alert(`Unable to retrieve GPS coordinates: ${err.message}`);
        setLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert('Please provide a description.');
      return;
    }

    try {
      setSubmitting(true);
      setFeedbackMessage(null);

      // Combine location into description or note if needed
      const fullDescription = location.trim() 
        ? `[Location: ${location.trim()}] ${description.trim()}`
        : description.trim();

      const parsedLat = latitude.trim() ? parseFloat(latitude.trim()) : null;
      const parsedLng = longitude.trim() ? parseFloat(longitude.trim()) : null;

      const created = await createRoadIssue({
        category,
        severity,
        description: fullDescription,
        status: 'Reported',
        latitude: parsedLat !== null && !isNaN(parsedLat) ? parsedLat : null,
        longitude: parsedLng !== null && !isNaN(parsedLng) ? parsedLng : null,
        evidence_path: photoPreview || null,
      });

      setFeedbackMessage({ 
        type: 'success', 
        text: `✓ Issue #${created.id} successfully saved to MySQL database.` 
      });

      // Reset form
      setLocation('');
      setLatitude('');
      setLongitude('');
      setDescription('');
      setPhotoPreview(null);
      
      // Refresh list
      await loadIssues();

      setTimeout(() => {
        setFeedbackMessage(null);
      }, 6000);
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: `Failed to submit issue: ${err.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      setUpdatingId(id);
      await updateRoadIssueStatus(id, newStatus);
      setIssues(prev => prev.map(issue => issue.id === id ? { ...issue, status: newStatus as any } : issue));
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
            MUNICIPAL CITIZEN DISPATCH
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Road Defect Reports & Complaints
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Persisted MySQL citizen complaints, road damage work orders, and repair status transitions
          </p>
        </div>

        <button
          onClick={loadIssues}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Form Column (3 cols) */}
        <div className="lg:col-span-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white">File Road Issue</h3>
              <p className="text-xs text-slate-400">Citizen and inspector complaint submission</p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              MYSQL CONNECTED
            </span>
          </div>

          {feedbackMessage && (
            <div className={`p-3.5 rounded-xl border text-xs font-mono flex items-center gap-2 ${
              feedbackMessage.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Issue Classification
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as RoadIssueRecord['category'])}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500/60"
              >
                <option value="Pothole">Pothole / Road Cavity</option>
                <option value="Road Damage">Severe Asphalt Crumbling</option>
                <option value="Cracked Road">Alligator / Longitudinal Cracks</option>
                <option value="Waterlogging">Waterlogging / Drainage Depression</option>
                <option value="Uneven Surface">Uneven Surface / Rutting</option>
                <option value="Missing Road Marking">Missing Road Marking / Hazard Sign</option>
                <option value="Other">Other Roadway Hazard</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Hazard Severity Level
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['minor', 'moderate', 'high', 'critical'] as PotholeSeverity[]).map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverity(sev)}
                    className={`py-2 rounded-lg text-[11px] font-mono font-bold uppercase transition-all border cursor-pointer ${
                      severity === sev
                        ? sev === 'critical'
                          ? 'bg-red-500/20 text-red-400 border-red-500/60'
                          : sev === 'high'
                          ? 'bg-orange-500/20 text-orange-400 border-orange-500/60'
                          : sev === 'moderate'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/60'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/60'
                        : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Street Address or Milestone
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="e.g. 1420 Oak Avenue near Main St Intersection"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/60"
                />
              </div>
            </div>

            {/* Optional GPS Coordinates */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  GPS Coordinates (Optional for GIS Map)
                </label>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locating}
                  className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <MapPin className="w-3 h-3" />
                  <span>{locating ? 'Acquiring GPS...' : 'Auto-Detect Current GPS'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude (e.g. 37.7749)"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/60 font-mono"
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude (e.g. -122.4194)"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/60 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Damage Description *
              </label>
              <textarea
                placeholder="Describe cavity dimensions, risk to vehicles, water pooling, or road impact..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/60 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Photo Evidence (Optional)
              </label>
              <label className="flex items-center justify-center gap-2 p-4 border border-dashed border-slate-800 hover:border-amber-500/40 rounded-xl bg-slate-950/60 cursor-pointer text-xs text-slate-400 transition-colors">
                <Camera className="w-4 h-4 text-amber-500" />
                <span>{photoPreview ? 'Change Selected Photo' : 'Attach Photo Evidence'}</span>
                <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
              </label>
              {photoPreview && (
                <div className="mt-2 h-28 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                  <img src={photoPreview} alt="Evidence preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <span>Submit to RoadGuard Database</span>
              )}
            </button>

            <div className="pt-2 flex items-start gap-2 text-[11px] text-slate-500 leading-snug">
              <Info className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
              <span>
                RoadGuard records submissions directly into the MySQL database under the <code>road_issues</code> registry.
              </span>
            </div>
          </form>
        </div>

        {/* Complaints Inventory Column (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <h3 className="text-sm font-bold text-white">
                Reported Issues ({issues.length})
              </h3>
              
              {/* Filter tabs */}
              <div className="flex gap-1 text-[10px] font-mono">
                {['ALL', 'Reported', 'Resolved'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      statusFilter === tab
                        ? 'bg-slate-800 text-amber-400 font-bold'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {loading && issues.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500 font-mono">
                  Loading complaints from database...
                </div>
              ) : issues.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    No road issues found in database. Submit the form to file a report.
                  </p>
                </div>
              ) : (
                issues.map((item) => (
                  <div key={item.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-400">
                        ISSUE #{item.id}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        item.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        item.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        item.severity === 'moderate' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {item.severity}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{item.category}</span>
                      
                      {/* Status Transition Selector */}
                      <select
                        value={item.status}
                        disabled={updatingId === item.id}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        className={`text-[10px] font-mono font-bold rounded px-2 py-0.5 border cursor-pointer focus:outline-none ${
                          item.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          item.status === 'Scheduled for Repair' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                          item.status === 'In Inspection' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                          'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt} value={opt} className="bg-slate-900 text-white">
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-850">
                      <span>Status: <strong className="text-slate-300">{item.status}</strong></span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[10px] font-mono text-slate-500">
            Lifecycle: Reported &rarr; In Inspection &rarr; Scheduled for Repair &rarr; Resolved
          </div>
        </div>
      </div>
    </div>
  );
};
