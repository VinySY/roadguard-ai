import React from 'react';
import heroRoadImage from '../assets/images/hero_road_inspection_1790353557267.jpg';
import potholeSampleImage from '../assets/images/pothole_asphalt_sample_1790353573527.jpg';
import { 
  ArrowRight, 
  Scan, 
  Layers, 
  ShieldAlert, 
  FileCheck, 
  Users, 
  Building2, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  Camera,
  Cpu,
  Target,
  FileSpreadsheet,
  Wrench
} from 'lucide-react';
import { SampleImage } from '../types/detection';

interface LandingPageProps {
  onStartDetection: () => void;
  onSelectSample: (sample: SampleImage) => void;
  samples: SampleImage[];
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartDetection,
  onSelectSample,
  samples,
}) => {
  return (
    <div className="space-y-24 py-4 max-w-7xl mx-auto">
      {/* Cinematic Hero Section */}
      <section className="relative rounded-3xl overflow-hidden border border-slate-800/80 bg-gradient-to-b from-slate-900/90 via-[#0F172A] to-[#090D16] p-8 md:p-14 lg:p-16">
        {/* Subtle background image overlay with high-contrast scrim */}
        <div className="absolute inset-0 z-0">
          <img
            src={heroRoadImage}
            alt="Asphalt roadway pavement inspection"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-30 mix-blend-luminosity filter contrast-125"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#090D16] via-[#090D16]/90 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090D16] via-transparent to-transparent" />
        </div>

        {/* Ambient Amber Rim Light */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>NEXT-GENERATION PAVEMENT DEFECT INTELLIGENCE</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">YOLOv11 INSTANCE SEGMENTATION</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-white">
            SEE THE ROAD.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500">
              UNDERSTAND THE DAMAGE.
            </span><br />
            ACT FASTER.
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
            RoadGuard AI uses computer vision to detect, isolate, and quantify potholes and road damage directly from road imagery. Transform static asphalt captures into sub-millimeter segmentation polygons, confidence metrics, and structural hazard reports.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <button
              onClick={onStartDetection}
              className="flex items-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl transition-all shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 hover:-translate-y-0.5"
            >
              <span>Start Detection</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>

            <a
              href="#pipeline"
              className="px-5 py-3.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 font-semibold text-sm rounded-xl transition-colors"
            >
              Explore RoadGuard
            </a>
          </div>

          {/* Quick Real Samples Drawer */}
          {samples.length > 0 && (
            <div className="pt-6 border-t border-slate-800/60 space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Test instantly with real pavement dataset samples:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {samples.slice(0, 4).map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => onSelectSample(sample)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-xs text-slate-300 hover:text-white transition-all text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>{sample.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* AI-Powered Detection Pipeline */}
      <section id="pipeline" className="space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <p className="text-xs font-mono tracking-widest text-amber-400 uppercase font-semibold">
            Real Computer Vision Pipeline
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            How RoadGuard Analyzes Road Imagery
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Every pixel is evaluated through hosted YOLOv11 segmentation, producing deterministic polygon boundaries rather than arbitrary bounding boxes.
          </p>
        </div>

        {/* Pipeline visual diagram */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { step: '01', title: 'Road Image', desc: 'Raw camera or vehicle capture', icon: <Camera className="w-5 h-5 text-slate-300" /> },
            { step: '02', title: 'Computer Vision', desc: 'Pre-processed inference stream', icon: <Cpu className="w-5 h-5 text-amber-400" /> },
            { step: '03', title: 'Segmentation', desc: 'YOLOv11 polygon mask extraction', icon: <Layers className="w-5 h-5 text-amber-400" />, highlight: true },
            { step: '04', title: 'Confidence', desc: 'Statistical model certainty', icon: <Target className="w-5 h-5 text-slate-300" /> },
            { step: '05', title: 'Severity', desc: 'Surface footprint & depth assessment', icon: <ShieldAlert className="w-5 h-5 text-amber-400" /> },
            { step: '06', title: 'Risk Index', desc: 'Prioritized municipal danger tier', icon: <FileCheck className="w-5 h-5 text-emerald-400" /> },
          ].map((item) => (
            <div
              key={item.step}
              className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                item.highlight
                  ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-mono font-bold text-amber-400">{item.step}</span>
                {item.icon}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">{item.title}</h4>
                <p className="text-xs text-slate-400 leading-snug">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Visual Showcase Card with Generated Asset */}
        <div className="grid lg:grid-cols-2 gap-8 items-center bg-slate-900/50 border border-slate-800 p-6 md:p-8 rounded-2xl">
          <div className="space-y-4">
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider font-semibold">
              Deep Polygon Isolation
            </span>
            <h3 className="text-2xl font-bold text-white">
              Instance Segmentation Over Mere Bounding Boxes
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Standard object detection draws simple rectangles that include undamaged asphalt, distorting true repair estimates. RoadGuard isolates the exact contour of every cavity with sub-pixel vertex precision, allowing municipalities to measure square footage, volume risk, and asphalt degradation severity.
            </p>
            <ul className="space-y-2.5 text-xs text-slate-300 pt-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Micro-polygon boundaries matching organic asphalt fracture edges</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Real-time confidence sensitivity filtering (10% to 90%)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Lossless canvas export to PNG and structured JSON data for work orders</span>
              </li>
            </ul>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-slate-700/80 aspect-[4/3] bg-slate-950 flex items-center justify-center">
            <img
              src={potholeSampleImage}
              alt="Close-up asphalt pothole inspection"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            {/* Overlay simulation badge */}
            <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-md border border-amber-500/50 px-3 py-1.5 rounded-lg text-xs font-mono text-amber-400 flex items-center gap-2">
              <Scan className="w-3.5 h-3.5" />
              <span>YOLOv11 Polygon Active</span>
            </div>
            <div className="absolute bottom-4 right-4 bg-slate-950/80 backdrop-blur-md border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300">
              Resolution: 4K Survey Capture
            </div>
          </div>
        </div>
      </section>

      {/* How it Works: 5 Steps */}
      <section className="space-y-10">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <p className="text-xs font-mono tracking-widest text-amber-400 uppercase font-semibold">
            Inspection Workflow
          </p>
          <h2 className="text-3xl font-extrabold text-white">How It Works</h2>
          <p className="text-sm text-slate-400">
            From asphalt capture to scheduled municipal patch repair in 5 structured phases.
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-4">
          {[
            {
              num: '01',
              title: 'Capture',
              desc: 'Inspectors or citizens capture road photos via smartphone, dashcam, or fleet vehicle.',
              status: 'Available Now'
            },
            {
              num: '02',
              title: 'Analyze',
              desc: 'Image is securely processed by the backend Roboflow inference engine.',
              status: 'Available Now'
            },
            {
              num: '03',
              title: 'Identify',
              desc: 'Cavities are segmented with polygon coordinates, confidence ratings, and area severity.',
              status: 'Available Now'
            },
            {
              num: '04',
              title: 'Report',
              desc: 'Automated generation of structural audit reports and exportable work orders.',
              status: 'Phase 3 Backend'
            },
            {
              num: '05',
              title: 'Resolve',
              desc: 'Public works crews are dispatched with precise GPS data and materials estimates.',
              status: 'Phase 6 Workflow'
            },
          ].map((step) => (
            <div
              key={step.num}
              className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between"
            >
              <div>
                <span className="text-2xl font-black font-mono text-amber-500/80 mb-3 block">
                  {step.num}
                </span>
                <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{step.desc}</p>
              </div>
              <div className="pt-3 border-t border-slate-800 text-[11px] font-mono flex items-center gap-1.5">
                {step.status === 'Available Now' ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Live
                  </span>
                ) : (
                  <span className="text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {step.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stakeholder Architecture: Citizens vs Authorities */}
      <section className="grid md:grid-cols-2 gap-8">
        <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-2xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">For Citizens</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Empowering road users to report craters before they damage suspension, burst tires, or cause dangerous motorcycle accidents. Capture photo evidence with one tap, receive AI confirmation of defect severity, and track community repair status.
            </p>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Instant AI verification of potholes from phone camera</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Zero-friction road issue draft creation</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Future automated GPS geo-tagging</span>
              </li>
            </ul>
          </div>
          <button
            onClick={onStartDetection}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors self-start"
          >
            <span>Try AI Detection Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-8 rounded-2xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">For Road Inspection Authorities</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Transform public works maintenance from reactive complaints into a data-driven repair strategy. Automate survey audits, prioritize high-risk craters, export standardized inspection JSON reports for contractor dispatch, and optimize asphalt budgeting.
            </p>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Deterministic polygon area measurement and severity indexing</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Downloadable annotated evidence PNGs for contractor sign-off</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Architected for future fleet dashcam continuous video feeds</span>
              </li>
            </ul>
          </div>
          <button
            onClick={onStartDetection}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors self-start"
          >
            <span>Open Inspection Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Honest Feature Availability Transparency Matrix */}
      <section className="bg-slate-900/30 border border-slate-800 p-6 md:p-8 rounded-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
            RoadGuard AI Platform Capability Matrix
          </h3>
        </div>

        <div className="grid md:grid-cols-2 gap-8 text-xs">
          <div className="space-y-3">
            <h4 className="font-bold text-emerald-400 flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Available Now (Live Backend)
            </h4>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Real Roboflow YOLOv11 instance segmentation via <code>/api/detect</code></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Interactive HTML5 Canvas with sub-pixel polygon overlays & tech bounding boxes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Dynamic confidence sensitivity slider (10% to 90%) with live viewport redraw</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Annotated PNG download & machine-readable JSON inspection report export</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Pre-loaded pavement sample selection from <code>/api/samples</code></span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-amber-400 flex items-center gap-1.5 text-sm">
              <Clock className="w-4 h-4" /> Architected for Future Phases
            </h4>
            <ul className="space-y-2 text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">⏳</span>
                <span><strong>Phase 3:</strong> Persistent PostgreSQL / Firestore database for historical reports</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">⏳</span>
                <span><strong>Phase 4:</strong> Automatic EXIF GPS extraction & Mapbox GIS road heatmap</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">⏳</span>
                <span><strong>Phase 5:</strong> Continuous real-time dashcam MP4 video stream segmentation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">⏳</span>
                <span><strong>Phase 6:</strong> Municipal work order ticket tracking & repair status transitions</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Final Cinematic Call to Action */}
      <section className="text-center py-16 px-6 bg-gradient-to-b from-slate-900/60 to-slate-950 border border-slate-800 rounded-3xl space-y-6">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Ready to Inspect Road Surfaces?
        </h2>
        <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
          Upload any asphalt photograph or test with pre-loaded samples to see YOLOv11 segmentation in action.
        </p>
        <div>
          <button
            onClick={onStartDetection}
            className="px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base rounded-xl transition-all shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 hover:-translate-y-0.5"
          >
            START DETECTING
          </button>
        </div>
      </section>
    </div>
  );
};
