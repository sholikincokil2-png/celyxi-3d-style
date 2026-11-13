import React, { useEffect, useRef, useState } from 'react';
import { Clapperboard, Activity } from 'lucide-react';
import { ExportAndShowcase } from './components/ExportAndShowcase';
import { StudioSidebar } from './components/StudioSidebar';
import { Viewport916, type ViewportHandle } from './components/Viewport916';
import { fetchHealth, generateStoryboard } from './lib/api';
import { buildLocalStoryboard, IDEA_PRESETS } from './lib/fallbackStoryboard';
import type {
  CelyxiShaderSettings,
  HealthStatus,
  Storyboard,
  StoryboardRequest,
} from './types/storyboard';

export const App: React.FC = () => {
  const [request, setRequest] = useState<StoryboardRequest>(IDEA_PRESETS[0].request);
  const [storyboard, setStoryboard] = useState<Storyboard>(() =>
    buildLocalStoryboard(IDEA_PRESETS[0].request),
  );
  const [shaders, setShaders] = useState<CelyxiShaderSettings>({
    outlineThickness: IDEA_PRESETS[0].request.outlineThickness,
    rimIntensity: IDEA_PRESETS[0].request.rimIntensity,
    bloomStrength: IDEA_PRESETS[0].request.bloomStrength,
    chiaroscuroBeat3: IDEA_PRESETS[0].request.chiaroscuroBeat3,
  });

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [health, setHealth] = useState<HealthStatus>({ ok: false });

  const [isExportingWebm, setIsExportingWebm] = useState<boolean>(false);
  const [webmProgressFrame, setWebmProgressFrame] = useState<number>(0);
  const [webmUrl, setWebmUrl] = useState<string | null>(null);
  const [webmError, setWebmError] = useState<string | null>(null);

  const viewportRef = useRef<ViewportHandle | null>(null);

  useEffect(() => {
    let active = true;
    fetchHealth().then((h) => {
      if (active) setHealth(h);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (webmUrl) URL.revokeObjectURL(webmUrl);
    };
  }, [webmUrl]);

  const handleGenerate = async (overrideReq?: StoryboardRequest) => {
    const targetReq = overrideReq ?? request;
    setIsGenerating(true);
    try {
      const next = await generateStoryboard(targetReq);
      setStoryboard(next);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyPreset = (presetReq: StoryboardRequest) => {
    setRequest(presetReq);
    setShaders({
      outlineThickness: presetReq.outlineThickness,
      rimIntensity: presetReq.rimIntensity,
      bloomStrength: presetReq.bloomStrength,
      chiaroscuroBeat3: presetReq.chiaroscuroBeat3,
    });
    void handleGenerate(presetReq);
  };

  const handleExportWebm = async () => {
    if (!viewportRef.current) return;
    setWebmError(null);
    setWebmProgressFrame(0);
    setIsExportingWebm(true);
    try {
      const blob = await viewportRef.current.recordWebm((f) => setWebmProgressFrame(f));
      setWebmUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (err) {
      setWebmError(err instanceof Error ? err.message : 'WebM capture failed in this browser.');
    } finally {
      setIsExportingWebm(false);
    }
  };

  return (
    <div className="studio-shell">
      {/* Top Studio Header */}
      <header className="studio-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '11px',
              background: 'linear-gradient(135deg, #e6b333, #b32622)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #14100e',
              boxShadow: '0 6px 18px rgba(230, 179, 51, 0.25)',
            }}
          >
            <Clapperboard size={18} color="#14100e" />
          </div>
          <div>
            <div className="font-display" style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em' }}>
              Celyxi 3D Video Studio
            </div>
            <div style={{ fontSize: '11.5px', color: '#b0a79b' }}>
              9:16 Silent 3D Shorts · Inverted-Hull Outlines · Real-Time Three.js + Blender 5.1 Cycles
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            className="font-mono"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 11px',
              borderRadius: '999px',
              fontSize: '11px',
              background: health.ok ? 'rgba(38, 166, 91, 0.14)' : 'rgba(230, 179, 51, 0.12)',
              border: `1px solid ${health.ok ? 'rgba(38, 166, 91, 0.35)' : 'rgba(230, 179, 51, 0.28)'}`,
              color: health.ok ? '#6ee7b7' : '#ffd466',
            }}
          >
            <Activity size={13} />
            <span>
              {health.ok
                ? `Backend Online${health.blender?.available ? ' · Blender 5.1 Ready' : ''}`
                : 'Static Offline Preview Mode'}
            </span>
          </div>
        </div>
      </header>

      {/* Main 3-Column Creator Workspace */}
      <main className="studio-grid">
        <StudioSidebar
          request={request}
          isGenerating={isGenerating}
          onChangeRequest={setRequest}
          onChangeShaders={setShaders}
          onApplyPreset={handleApplyPreset}
          onGenerate={() => void handleGenerate()}
        />

        <Viewport916
          ref={viewportRef}
          storyboard={storyboard}
          shaders={shaders}
          isExportingWebm={isExportingWebm}
        />

        <ExportAndShowcase
          storyboard={storyboard}
          health={health}
          isExportingWebm={isExportingWebm}
          webmProgressFrame={webmProgressFrame}
          webmUrl={webmUrl}
          webmError={webmError}
          onExportWebm={() => void handleExportWebm()}
        />
      </main>
    </div>
  );
};

export default App;
