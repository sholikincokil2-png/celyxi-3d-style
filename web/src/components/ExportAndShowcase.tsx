import React, { useEffect, useState } from 'react';
import {
  Film,
  Download,
  Cpu,
  PlayCircle,
  FileJson,
  Copy,
  Check,
  AlertCircle,
  Terminal,
  Loader2,
} from 'lucide-react';
import { fetchRenderJob, startBlenderRender } from '../lib/api';
import type { HealthStatus, RenderJobStatus, Storyboard } from '../types/storyboard';

interface ExportAndShowcaseProps {
  storyboard: Storyboard;
  health: HealthStatus;
  isExportingWebm: boolean;
  webmProgressFrame: number;
  webmUrl: string | null;
  webmError: string | null;
  onExportWebm: () => void;
}

type TabId = 'export' | 'showcase' | 'json';

export const ExportAndShowcase: React.FC<ExportAndShowcaseProps> = ({
  storyboard,
  health,
  isExportingWebm,
  webmProgressFrame,
  webmUrl,
  webmError,
  onExportWebm,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('export');
  const [renderJob, setRenderJob] = useState<RenderJobStatus | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isStartingRender, setIsStartingRender] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<'cli' | 'json' | null>(null);
  const [showcaseError, setShowcaseError] = useState<boolean>(false);

  const exportPayload = storyboard.rawBackendPayload ?? storyboard;
  const jsonString = JSON.stringify(exportPayload, null, 2);
  const blenderCli = `blender.exe -b -P blender_pipeline/generate_from_idea.py -- --storyboard storyboard.json --out-frames out/custom_frames --res 360x640 --samples 4 --bounces 1`;

  // Poll active Blender render job
  useEffect(() => {
    if (!renderJob || !renderJob.jobId) return;
    if (renderJob.status === 'completed' || renderJob.status === 'failed') return;

    const timer = window.setInterval(async () => {
      try {
        const updated = await fetchRenderJob(renderJob.jobId);
        setRenderJob(updated);
        if (updated.status === 'failed' && updated.error) {
          setRenderError(updated.error);
        }
      } catch (err) {
        setRenderError(err instanceof Error ? err.message : 'Lost connection while polling render.');
      }
    }, 1200);

    return () => window.clearInterval(timer);
  }, [renderJob]);

  const handleStartBlenderRender = async () => {
    setRenderError(null);
    setIsStartingRender(true);
    try {
      const job = await startBlenderRender(storyboard);
      setRenderJob(job);
    } catch (err) {
      setRenderError(
        err instanceof Error
          ? err.message
          : 'Could not reach /api/render. Start web/server.mjs on port 3080.',
      );
    } finally {
      setIsStartingRender(false);
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `celyxi_storyboard_${storyboard.theme}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async (key: 'cli' | 'json', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const webmPct = Math.round((webmProgressFrame / 300) * 100);

  return (
    <aside
      className="panel-card studio-right-col"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '18px',
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '6px',
          padding: '4px',
          borderRadius: '12px',
          background: '#0f0d0b',
          border: '1px solid rgba(246, 241, 233, 0.08)',
        }}
      >
        <button
          type="button"
          className={`pill-btn ${activeTab === 'export' ? 'active' : ''}`}
          style={{ justifyContent: 'center', fontSize: '12px', padding: '7px 8px' }}
          onClick={() => setActiveTab('export')}
        >
          <Film size={13} />
          <span>Export</span>
        </button>
        <button
          type="button"
          className={`pill-btn ${activeTab === 'showcase' ? 'active' : ''}`}
          style={{ justifyContent: 'center', fontSize: '12px', padding: '7px 8px' }}
          onClick={() => setActiveTab('showcase')}
        >
          <PlayCircle size={13} />
          <span>Showcase</span>
        </button>
        <button
          type="button"
          className={`pill-btn ${activeTab === 'json' ? 'active' : ''}`}
          style={{ justifyContent: 'center', fontSize: '12px', padding: '7px 8px' }}
          onClick={() => setActiveTab('json')}
        >
          <FileJson size={13} />
          <span>JSON</span>
        </button>
      </div>

      {/* TAB 1: EXPORT & BLENDER RENDER */}
      {activeTab === 'export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Instant WebM Capture */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '14px',
              borderRadius: '14px',
              background: 'rgba(230, 179, 51, 0.06)',
              border: '1px solid rgba(230, 179, 51, 0.24)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="font-display" style={{ fontSize: '14px', fontWeight: 700 }}>
                1. Instant Browser .webm
              </span>
              <span className="font-mono" style={{ fontSize: '11px', color: '#ffd466' }}>
                30fps · 10.0s
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#b0a79b', lineHeight: 1.45 }}>
              Captures all 300 frames directly from the live Three.js WebGL canvas via{' '}
              <code className="font-mono">captureStream(30)</code> — works 100% offline.
            </p>

            <button
              type="button"
              className="primary-btn"
              disabled={isExportingWebm}
              onClick={onExportWebm}
            >
              {isExportingWebm ? (
                <>
                  <Loader2 size={15} className="spin" />
                  <span>
                    Recording Frame {webmProgressFrame}/300 ({webmPct}%)
                  </span>
                </>
              ) : (
                <>
                  <Film size={15} />
                  <span>Record &amp; Export 10s .webm</span>
                </>
              )}
            </button>

            {isExportingWebm && (
              <div
                style={{
                  height: '6px',
                  width: '100%',
                  borderRadius: '999px',
                  background: 'rgba(246, 241, 233, 0.12)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${webmPct}%`,
                    background: 'linear-gradient(90deg, #e6b333, #ffd466)',
                    transition: 'width 0.1s linear',
                  }}
                />
              </div>
            )}

            {webmError && (
              <div style={{ display: 'flex', gap: '6px', fontSize: '12px', color: '#fca5a5' }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{webmError}</span>
              </div>
            )}

            {webmUrl && !isExportingWebm && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <video
                  src={webmUrl}
                  controls
                  loop
                  muted
                  playsInline
                  style={{
                    width: '100%',
                    maxHeight: '230px',
                    borderRadius: '10px',
                    background: '#000',
                    border: '1px solid rgba(246, 241, 233, 0.14)',
                  }}
                />
                <a
                  href={webmUrl}
                  download={`celyxi_${storyboard.theme}_10s.webm`}
                  className="secondary-btn"
                  style={{ textDecoration: 'none' }}
                >
                  <Download size={14} />
                  <span>Download .webm Video</span>
                </a>
              </div>
            )}
          </div>

          {/* Local Blender 5.1 Cycles MP4 Render */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '14px',
              borderRadius: '14px',
              background: 'rgba(246, 241, 233, 0.03)',
              border: '1px solid rgba(246, 241, 233, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="font-display" style={{ fontSize: '14px', fontWeight: 700 }}>
                2. Blender 5.1 Cycles MP4
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: '10.5px',
                  padding: '2px 7px',
                  borderRadius: '999px',
                  background: health.ok ? 'rgba(38, 166, 91, 0.15)' : 'rgba(246, 241, 233, 0.08)',
                  color: health.ok ? '#6ee7b7' : '#b0a79b',
                }}
              >
                {health.ok ? 'API Ready' : 'Offline'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#b0a79b', lineHeight: 1.45 }}>
              Renders full raytraced Cycles 3D + Compositor Bloom + FFmpeg silent H.264 MP4 via{' '}
              <code className="font-mono">POST /api/render</code>.
            </p>

            <button
              type="button"
              className="secondary-btn"
              disabled={
                isStartingRender ||
                (renderJob !== null &&
                  renderJob.status !== 'completed' &&
                  renderJob.status !== 'failed')
              }
              onClick={handleStartBlenderRender}
            >
              <Cpu size={15} />
              <span>
                {isStartingRender
                  ? 'Queueing Blender Job...'
                  : renderJob &&
                      renderJob.status !== 'completed' &&
                      renderJob.status !== 'failed'
                    ? `Rendering ${renderJob.framesRendered}/${renderJob.totalFrames} (${renderJob.progress}%)`
                    : 'Render Cycles 10s MP4'}
              </span>
            </button>

            {renderJob && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                  <span style={{ color: '#b0a79b' }}>
                    {renderJob.phase ?? renderJob.status}
                  </span>
                  <span className="font-mono" style={{ color: '#ffd466' }}>
                    {renderJob.framesRendered}/{renderJob.totalFrames} frames
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    width: '100%',
                    borderRadius: '999px',
                    background: 'rgba(246, 241, 233, 0.12)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${renderJob.progress}%`,
                      background: 'linear-gradient(90deg, #26a65b, #6ee7b7)',
                    }}
                  />
                </div>
              </div>
            )}

            {renderError && (
              <div style={{ display: 'flex', gap: '6px', fontSize: '12px', color: '#fca5a5' }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{renderError}</span>
              </div>
            )}

            {renderJob?.status === 'completed' && renderJob.videoUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <video
                  src={renderJob.videoUrl}
                  controls
                  loop
                  muted
                  playsInline
                  style={{
                    width: '100%',
                    maxHeight: '230px',
                    borderRadius: '10px',
                    background: '#000',
                    border: '1px solid rgba(246, 241, 233, 0.14)',
                  }}
                />
                <a
                  href={renderJob.videoUrl}
                  download={`celyxi_blender_${renderJob.jobId}.mp4`}
                  className="secondary-btn"
                  style={{ textDecoration: 'none' }}
                >
                  <Download size={14} />
                  <span>Download Cycles MP4</span>
                </a>
              </div>
            )}
          </div>

          {/* Storyboard JSON + Blender CLI */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px',
              borderRadius: '12px',
              background: '#0f0d0b',
              border: '1px solid rgba(246, 241, 233, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700 }}>
                <Terminal size={13} color="#e6b333" />
                Blender Headless CLI
              </span>
              <button
                type="button"
                className="pill-btn"
                style={{ padding: '4px 8px', fontSize: '11px' }}
                onClick={() => handleCopy('cli', blenderCli)}
              >
                {copiedKey === 'cli' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedKey === 'cli' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <code
              className="font-mono"
              style={{
                fontSize: '11px',
                color: '#d7cfc4',
                wordBreak: 'break-all',
                lineHeight: 1.4,
              }}
            >
              {blenderCli}
            </code>
            <button type="button" className="secondary-btn" onClick={handleDownloadJson}>
              <Download size={14} />
              <span>Download storyboard.json</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: SHOWCASE MP4 */}
      {activeTab === 'showcase' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span className="font-display" style={{ fontSize: '14px', fontWeight: 700 }}>
              Master Cycles + Remotion Showcase
            </span>
            <span style={{ fontSize: '12px', color: '#b0a79b' }}>
              1080×1920 · 30fps · 10.0s Silent MP4 (`celyxi_10s_silent.mp4`)
            </span>
          </div>

          <div
            style={{
              width: '100%',
              maxWidth: '280px',
              margin: '0 auto',
              aspectRatio: '9 / 16',
              borderRadius: '16px',
              overflow: 'hidden',
              background: '#000',
              border: '1px solid rgba(230, 179, 51, 0.3)',
            }}
          >
            {showcaseError ? (
              <div
                style={{
                  height: '100%',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  gap: '10px',
                  color: '#b0a79b',
                  fontSize: '12px',
                }}
              >
                <AlertCircle size={24} color="#e6b333" />
                <span>
                  Showcase stream unavailable in static-only preview. Start{' '}
                  <code className="font-mono">node web/server.mjs</code> on port 3080 to stream{' '}
                  <code className="font-mono">/api/showcase/celyxi_10s_silent.mp4</code>.
                </span>
              </div>
            ) : (
              <video
                src="/api/showcase/celyxi_10s_silent.mp4"
                controls
                loop
                muted
                playsInline
                onError={() => setShowcaseError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
          </div>

          <a
            href="/api/showcase/celyxi_10s_silent.mp4"
            download="celyxi_10s_silent.mp4"
            className="secondary-btn"
            style={{ textDecoration: 'none' }}
          >
            <Download size={14} />
            <span>Download Showcase MP4</span>
          </a>
        </div>
      )}

      {/* TAB 3: STORYBOARD JSON */}
      {activeTab === 'json' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="secondary-btn"
              style={{ flex: 1 }}
              onClick={() => handleCopy('json', jsonString)}
            >
              {copiedKey === 'json' ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedKey === 'json' ? 'Copied' : 'Copy JSON'}</span>
            </button>
            <button
              type="button"
              className="secondary-btn"
              style={{ flex: 1 }}
              onClick={handleDownloadJson}
            >
              <Download size={14} />
              <span>Save JSON</span>
            </button>
          </div>
          <pre
            className="font-mono"
            style={{
              margin: 0,
              padding: '12px',
              borderRadius: '12px',
              background: '#0f0d0b',
              border: '1px solid rgba(246, 241, 233, 0.1)',
              color: '#d7cfc4',
              fontSize: '11px',
              lineHeight: 1.45,
              maxHeight: '500px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {jsonString}
          </pre>
        </div>
      )}
    </aside>
  );
};
