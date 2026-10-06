import React, { useState, useEffect, useCallback } from 'react';
import { Navigation } from './components/Navigation';
import { LandingPage } from './components/LandingPage';
import { DashboardView } from './components/DashboardView';
import { DetectionStudio } from './components/DetectionStudio';
import { VideoDetectionStudio } from './components/VideoDetectionStudio';
import { ReportsView } from './components/ReportsView';
import { RoadIssuesView } from './components/RoadIssuesView';
import { MapView } from './components/MapView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { ErrorBoundary } from './components/ErrorBoundary';

import { detectPotholes, checkServerHealth, fetchSampleImages } from './services/roboflow';
import { 
  DetectionState, 
  DetectionResult, 
  SampleImage, 
  ServerHealth, 
  NavigationTab, 
  AppSettings 
} from './types/detection';
import { getApiUrl } from './config/api';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('landing');
  const [detectionState, setDetectionState] = useState<DetectionState>({ status: 'idle' });
  const [latestResult, setLatestResult] = useState<DetectionResult | null>(null);
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [samples, setSamples] = useState<SampleImage[]>([]);
  const [confidenceSetting, setConfidenceSetting] = useState<number>(20);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const [settings, setSettings] = useState<AppSettings>({
    defaultConfidence: 20,
    showPolygonsByDefault: true,
    showBoundingBoxesByDefault: true,
    showLabelsByDefault: true,
    highContrastColors: false,
  });

  // Verify health and fetch samples on mount
  const checkHealth = useCallback(() => {
    checkServerHealth()
      .then((health) => setServerHealth(health))
      .catch(() => setServerHealth(null));
  }, []);

  useEffect(() => {
    checkHealth();
    fetchSampleImages().then((list) => setSamples(list));
    // Poll health periodically every 20 seconds
    const interval = setInterval(checkHealth, 20000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // Handlers for file selection & drag-and-drop
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid road image file (JPEG, PNG, or WebP).');
      return;
    }

    const preview = URL.createObjectURL(file);
    setDetectionState({ status: 'image-selected', file, preview, name: file.name });
    setCurrentTab('detect');
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please drop a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    const preview = URL.createObjectURL(file);
    setDetectionState({ status: 'image-selected', file, preview, name: file.name });
    setCurrentTab('detect');
  }, []);

  const handleSelectSample = useCallback((sample: SampleImage) => {
    const preview = getApiUrl(`/api/samples/${sample.filename}`);
    setDetectionState({
      status: 'image-selected',
      sampleFilename: sample.filename,
      preview,
      name: sample.name,
    });
    setCurrentTab('detect');
  }, []);

  // Main Detection Dispatcher: Calls real /api/detect
  const handleDetect = useCallback(async () => {
    if (detectionState.status !== 'image-selected' && detectionState.status !== 'error') return;

    const currentPreview = detectionState.preview || '';
    const currentFile = detectionState.file;
    const currentSampleFilename = detectionState.sampleFilename;
    const currentName = detectionState.name;

    setDetectionState({ status: 'detecting', preview: currentPreview, name: currentName });

    try {
      const result = await detectPotholes(
        { file: currentFile, sampleFilename: currentSampleFilename },
        { confidence: confidenceSetting }
      );

      setLatestResult(result);

      if (!result.predictions || result.predictions.length === 0) {
        setDetectionState({
          status: 'no-detections',
          result,
          imagePreview: currentPreview,
        });
      } else {
        setDetectionState({
          status: 'success',
          result,
          imagePreview: currentPreview,
        });
      }
    } catch (error) {
      console.error('Inference request failed:', error);
      const message = error instanceof Error ? error.message : 'Unable to complete detection';
      setDetectionState({
        status: 'error',
        error: message,
        file: currentFile,
        sampleFilename: currentSampleFilename,
        preview: currentPreview,
        name: currentName,
      });
    }
  }, [detectionState, confidenceSetting]);

  const handleResetDetection = useCallback(() => {
    setDetectionState({ status: 'idle' });
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-300">
        {/* Navigation Shell */}
        <Navigation
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          serverHealth={serverHealth}
          hasActiveDetection={detectionState.status === 'success'}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />

        {/* Main Content Router */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
          {currentTab === 'landing' && (
            <LandingPage
              onStartDetection={() => setCurrentTab('detect')}
              onSelectSample={handleSelectSample}
              samples={samples}
            />
          )}

          {currentTab === 'dashboard' && (
            <DashboardView
              latestResult={latestResult}
              serverHealth={serverHealth}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'detect' && (
            <DetectionStudio
              detectionState={detectionState}
              samples={samples}
              confidenceSetting={confidenceSetting}
              setConfidenceSetting={setConfidenceSetting}
              onFileSelect={handleFileSelect}
              onDrop={handleDrop}
              onSelectSample={handleSelectSample}
              onDetect={handleDetect}
              onReset={handleResetDetection}
              settings={settings}
            />
          )}

          {currentTab === 'video-detect' && (
            <VideoDetectionStudio
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              latestResult={latestResult}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'issues' && (
            <RoadIssuesView />
          )}

          {currentTab === 'map' && (
            <MapView onNavigate={setCurrentTab} />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsView
              latestResult={latestResult}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={setSettings}
              serverHealth={serverHealth}
              onPingHealth={checkHealth}
            />
          )}
        </main>

        {/* Clean Footer (Anti-Slop: quiet, no fake engines) */}
        <footer className="border-t border-slate-800/80 py-6 px-4 sm:px-8 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">ROADGUARD AI</span>
            <span>·</span>
            <span>Computer Vision Road Condition Intelligence</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>Model: Roboflow YOLOv11</span>
            <span>·</span>
            <span>Instance Polygon Masks</span>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
