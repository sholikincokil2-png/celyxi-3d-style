import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, VolumeX, Sparkles } from 'lucide-react';
import { CelyxiStageEngine } from '../three/CelyxiStageEngine';
import type { BeatSpec, CelyxiShaderSettings, Storyboard } from '../types/storyboard';

export interface ViewportHandle {
  recordWebm: (onProgress: (frame: number) => void) => Promise<Blob>;
}

interface Viewport916Props {
  storyboard: Storyboard;
  shaders: CelyxiShaderSettings;
  isExportingWebm: boolean;
}

export const Viewport916 = React.forwardRef<ViewportHandle, Viewport916Props>(
  ({ storyboard, shaders, isExportingWebm }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const engineRef = useRef<CelyxiStageEngine | null>(null);

    const [frame, setFrame] = useState<number>(1);
    const [isPlaying, setIsPlaying] = useState<boolean>(true);
    const frameRef = useRef<number>(1);
    const isPlayingRef = useRef<boolean>(true);
    const isExportingRef = useRef<boolean>(false);

    useEffect(() => {
      isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => {
      isExportingRef.current = isExportingWebm;
    }, [isExportingWebm]);

    // Initialize Three.js engine once
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const engine = new CelyxiStageEngine(canvas, storyboard);
      engine.setSize(540, 960);
      engine.renderFrame(1);
      engineRef.current = engine;

      let rafId = 0;
      let lastTime = performance.now();
      let accumulator = 0;
      const frameStepMs = 1000 / 30;

      const tick = (now: number) => {
        const dt = Math.min(100, now - lastTime);
        lastTime = now;

        if (isPlayingRef.current && !isExportingRef.current) {
          accumulator += dt;
          if (accumulator >= frameStepMs) {
            const steps = Math.floor(accumulator / frameStepMs);
            accumulator -= steps * frameStepMs;
            const next = ((frameRef.current - 1 + steps) % 300) + 1;
            frameRef.current = next;
            setFrame(next);
            engine.renderFrame(next);
          }
        }
        rafId = requestAnimationFrame(tick);
      };

      rafId = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(rafId);
        engine.dispose();
        engineRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Rebuild 3D world when storyboard identity/roles/theme/relic changes
    useEffect(() => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.rebuildWorld(storyboard);
      engine.renderFrame(frameRef.current);
    }, [storyboard]);

    // Live shader uniform updates
    useEffect(() => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.updateShaders(shaders);
      engine.renderFrame(frameRef.current);
    }, [shaders]);

    // Deterministic 30fps WebM exporter via canvas.captureStream(30) + MediaRecorder
    useImperativeHandle(ref, () => ({
      recordWebm: async (onProgress) => {
        const canvas = canvasRef.current;
        const engine = engineRef.current;
        if (!canvas || !engine) {
          throw new Error('3D Viewport is not ready yet.');
        }

        const mimeCandidates = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
        ];
        const mimeType =
          mimeCandidates.find((m) =>
            typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m),
          ) ?? '';

        const stream = canvas.captureStream(30);
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 })
          : new MediaRecorder(stream, { videoBitsPerSecond: 6_000_000 });

        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        const stopped = new Promise<Blob>((resolve, reject) => {
          recorder.onstop = () => {
            resolve(new Blob(chunks, { type: mimeType || 'video/webm' }));
          };
          recorder.onerror = () => reject(new Error('MediaRecorder failed during capture.'));
        });

        setIsPlaying(false);
        isPlayingRef.current = false;
        recorder.start(250);

        for (let f = 1; f <= 300; f++) {
          frameRef.current = f;
          setFrame(f);
          engine.renderFrame(f);
          onProgress(f);
          await new Promise((r) => setTimeout(r, 33));
        }

        recorder.stop();
        return stopped;
      },
    }));

    const jumpToFrame = (f: number) => {
      const clamped = Math.min(300, Math.max(1, Math.round(f)));
      frameRef.current = clamped;
      setFrame(clamped);
      engineRef.current?.renderFrame(clamped);
    };

    const currentBeat: BeatSpec =
      storyboard.beats.find((b) => frame >= b.startFrame && frame <= b.endFrame) ??
      storyboard.beats[0];

    const sec = ((frame - 1) / 30).toFixed(1);

    return (
      <section
        className="panel-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '18px',
          gap: '14px',
        }}
      >
        {/* Viewport Header */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span className="font-display" style={{ fontSize: '15px', fontWeight: 700 }}>
              {storyboard.title}
            </span>
            <span style={{ fontSize: '12px', color: '#b0a79b' }}>
              Live Real-Time Three.js 9:16 Viewport ·{' '}
              <span style={{ color: '#ffd466' }}>{currentBeat.name}</span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              className="font-mono"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                padding: '4px 9px',
                borderRadius: '999px',
                background: 'rgba(246, 241, 233, 0.06)',
                color: '#b0a79b',
                border: '1px solid rgba(246, 241, 233, 0.12)',
              }}
            >
              <VolumeX size={12} />
              SILENT 30FPS
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: '11px',
                padding: '4px 9px',
                borderRadius: '999px',
                background:
                  storyboard.source === 'backend'
                    ? 'rgba(38, 166, 91, 0.16)'
                    : 'rgba(230, 179, 51, 0.14)',
                color: storyboard.source === 'backend' ? '#6ee7b7' : '#ffd466',
                border: '1px solid rgba(246, 241, 233, 0.12)',
              }}
            >
              {storyboard.source === 'backend' ? 'API Storyboard' : 'Instant Local Engine'}
            </span>
          </div>
        </div>

        {/* 9:16 Stage Frame */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '348px',
            aspectRatio: '9 / 16',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '2px solid rgba(230, 179, 51, 0.3)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.72), 0 0 36px rgba(230, 179, 51, 0.08)',
            background: '#0d0a08',
          }}
        >
          <canvas
            ref={canvasRef}
            width={540}
            height={960}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />

          {/* Top-left Beat Pill HUD */}
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              right: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              className="font-mono"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                borderRadius: '999px',
                background: 'rgba(11, 9, 8, 0.74)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(230, 179, 51, 0.35)',
                fontSize: '11px',
                fontWeight: 700,
                color: '#ffd466',
              }}
            >
              <Sparkles size={11} />
              <span>
                BEAT {currentBeat.id} · {currentBeat.chiaroscuro ? 'CHIAROSCURO' : currentBeat.setting.toUpperCase()}
              </span>
            </div>

            <div
              className="font-mono"
              style={{
                padding: '5px 9px',
                borderRadius: '999px',
                background: 'rgba(11, 9, 8, 0.74)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(246, 241, 233, 0.14)',
                fontSize: '11px',
                color: '#f6f1e9',
              }}
            >
              {String(frame).padStart(3, '0')}/300 · {sec}s
            </div>
          </div>

          {/* Bottom Expression HUD */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '12px',
              right: '12px',
              padding: '8px 10px',
              borderRadius: '12px',
              background: 'rgba(11, 9, 8, 0.72)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(246, 241, 233, 0.12)',
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: '#ffd466', fontWeight: 700 }}>
                {storyboard.heroRole.toUpperCase()}: {currentBeat.hero.expression}
              </span>
              <span style={{ color: '#8be0ff', fontWeight: 700 }}>
                {storyboard.sidekickRole.toUpperCase()}: {currentBeat.sidekick.expression}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#d7cfc4', lineHeight: 1.35 }}>
              {currentBeat.visualSummary}
            </div>
          </div>
        </div>

        {/* Transport & Scrubber */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            padding: '12px',
            borderRadius: '14px',
            background: 'rgba(246, 241, 233, 0.03)',
            border: '1px solid rgba(246, 241, 233, 0.08)',
          }}
        >
          {/* Play/Pause + Scrubber */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="pill-btn active"
              disabled={isExportingWebm}
              onClick={() => setIsPlaying((p) => !p)}
              style={{ padding: '7px 12px' }}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              type="button"
              className="pill-btn"
              disabled={isExportingWebm}
              onClick={() => jumpToFrame(1)}
              title="Restart at frame 1"
            >
              <RotateCcw size={14} />
            </button>

            <input
              type="range"
              className="studio-slider"
              min={1}
              max={300}
              step={1}
              disabled={isExportingWebm}
              value={frame}
              onChange={(e) => {
                setIsPlaying(false);
                jumpToFrame(parseInt(e.target.value, 10));
              }}
              aria-label="Frame Scrubber"
            />

            <span className="font-mono" style={{ fontSize: '11.5px', color: '#b0a79b', minWidth: '58px', textAlign: 'right' }}>
              f{frame}
            </span>
          </div>

          {/* Beat 1-4 Pills */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px' }}>
            {storyboard.beats.map((b) => {
              const active = currentBeat.id === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={isExportingWebm}
                  className={`pill-btn ${active ? 'active' : ''}`}
                  style={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '2px',
                    padding: '7px 9px',
                  }}
                  onClick={() => jumpToFrame(b.startFrame)}
                >
                  <span style={{ fontSize: '11.5px', fontWeight: 700 }}>Beat {b.id}</span>
                  <span className="font-mono" style={{ fontSize: '10px', opacity: 0.78 }}>
                    f{b.startFrame}–{b.endFrame}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  },
);

Viewport916.displayName = 'Viewport916';
