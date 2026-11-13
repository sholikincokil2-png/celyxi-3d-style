import React from 'react';
import { Sparkles, Sliders, Users, MapPin, Gem, Wand2, Moon } from 'lucide-react';
import {
  IDEA_PRESETS,
  RELIC_OPTIONS,
  ROLE_OPTIONS,
  THEME_OPTIONS,
} from '../lib/fallbackStoryboard';
import type {
  CharacterRole,
  CelyxiShaderSettings,
  EnvironmentTheme,
  RelicType,
  StoryboardRequest,
} from '../types/storyboard';

interface StudioSidebarProps {
  request: StoryboardRequest;
  isGenerating: boolean;
  onChangeRequest: (updater: (prev: StoryboardRequest) => StoryboardRequest) => void;
  onChangeShaders: (shaders: CelyxiShaderSettings) => void;
  onApplyPreset: (req: StoryboardRequest) => void;
  onGenerate: () => void;
}

export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  request,
  isGenerating,
  onChangeRequest,
  onChangeShaders,
  onApplyPreset,
  onGenerate,
}) => {
  const updateShader = <K extends keyof CelyxiShaderSettings>(
    key: K,
    val: CelyxiShaderSettings[K],
  ) => {
    const nextShaders: CelyxiShaderSettings = {
      outlineThickness: request.outlineThickness,
      rimIntensity: request.rimIntensity,
      bloomStrength: request.bloomStrength,
      chiaroscuroBeat3: request.chiaroscuroBeat3,
      [key]: val,
    };
    onChangeRequest((prev) => ({ ...prev, [key]: val }));
    onChangeShaders(nextShaders);
  };

  return (
    <aside className="panel-card flex flex-col gap-5 p-5" style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '18px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="#e6b333" />
          <span className="font-display" style={{ fontSize: '15px', fontWeight: 700 }}>
            Idea &amp; Style Studio
          </span>
        </div>
        <span
          className="font-mono"
          style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '999px',
            background: 'rgba(230, 179, 51, 0.12)',
            color: '#ffd466',
            border: '1px solid rgba(230, 179, 51, 0.25)',
          }}
        >
          10s · 300f · 9:16
        </span>
      </div>

      {/* 1-Click Idea Presets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span className="section-label">1-Click Idea Presets</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {IDEA_PRESETS.map((preset) => {
            const isSelected = request.idea === preset.request.idea && request.theme === preset.request.theme;
            return (
              <button
                key={preset.id}
                type="button"
                className={`pill-btn ${isSelected ? 'active' : ''}`}
                style={{ fontSize: '11.5px', padding: '6px 10px' }}
                onClick={() => onApplyPreset(preset.request)}
              >
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Prompt Textarea */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label htmlFor="idea-prompt" className="section-label">
          Video Idea (Silent Visual Story)
        </label>
        <textarea
          id="idea-prompt"
          rows={3}
          value={request.idea}
          onChange={(e) => onChangeRequest((prev) => ({ ...prev, idea: e.target.value }))}
          placeholder="Describe a funny 4-beat confrontation, secret object, and comedic reveal..."
          style={{
            width: '100%',
            resize: 'vertical',
            borderRadius: '12px',
            border: '1px solid rgba(246, 241, 233, 0.14)',
            background: '#0f0d0b',
            color: '#f6f1e9',
            padding: '10px 12px',
            fontSize: '13px',
            lineHeight: 1.45,
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Environment Theme */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={13} color="#b0a79b" />
          <span className="section-label">Environment Set</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px' }}>
          {THEME_OPTIONS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`pill-btn ${request.theme === t.value ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '8px 10px' }}
              onClick={() =>
                onChangeRequest((prev) => ({ ...prev, theme: t.value as EnvironmentTheme }))
              }
              title={t.tagline}
            >
              <span style={{ fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Hero & Sidekick Roles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Users size={12} color="#b0a79b" />
            <span className="section-label">Hero Role</span>
          </div>
          <select
            value={request.heroRole}
            onChange={(e) =>
              onChangeRequest((prev) => ({
                ...prev,
                heroRole: e.target.value as CharacterRole,
              }))
            }
            style={{
              background: '#0f0d0b',
              color: '#f6f1e9',
              border: '1px solid rgba(246, 241, 233, 0.16)',
              borderRadius: '10px',
              padding: '8px 10px',
              fontSize: '12.5px',
              fontWeight: 600,
              outline: 'none',
            }}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Users size={12} color="#b0a79b" />
            <span className="section-label">Sidekick Role</span>
          </div>
          <select
            value={request.sidekickRole}
            onChange={(e) =>
              onChangeRequest((prev) => ({
                ...prev,
                sidekickRole: e.target.value as CharacterRole,
              }))
            }
            style={{
              background: '#0f0d0b',
              color: '#f6f1e9',
              border: '1px solid rgba(246, 241, 233, 0.16)',
              borderRadius: '10px',
              padding: '8px 10px',
              fontSize: '12.5px',
              fontWeight: 600,
              outline: 'none',
            }}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Relic Type */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Gem size={13} color="#b0a79b" />
          <span className="section-label">Beat 4 Glowing Relic</span>
        </div>
        <select
          value={request.relicType}
          onChange={(e) =>
            onChangeRequest((prev) => ({ ...prev, relicType: e.target.value as RelicType }))
          }
          style={{
            background: '#0f0d0b',
            color: '#f6f1e9',
            border: '1px solid rgba(246, 241, 233, 0.16)',
            borderRadius: '10px',
            padding: '8px 10px',
            fontSize: '12.5px',
            fontWeight: 600,
            outline: 'none',
          }}
        >
          {RELIC_OPTIONS.map((rel) => (
            <option key={rel.value} value={rel.value}>
              {rel.label}
            </option>
          ))}
        </select>
      </div>

      {/* @Celyxi Shader Sliders */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '12px',
          borderRadius: '12px',
          background: 'rgba(246, 241, 233, 0.03)',
          border: '1px solid rgba(246, 241, 233, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sliders size={13} color="#e6b333" />
          <span className="section-label">@Celyxi Shader Controls</span>
        </div>

        {/* Outline Thickness */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#b0a79b' }}>Inverted-Hull Outline</span>
            <span className="font-mono" style={{ color: '#ffd466' }}>
              {request.outlineThickness.toFixed(3)}m
            </span>
          </div>
          <input
            type="range"
            className="studio-slider"
            min={0.008}
            max={0.038}
            step={0.001}
            value={request.outlineThickness}
            onChange={(e) => updateShader('outlineThickness', parseFloat(e.target.value))}
          />
        </div>

        {/* Fresnel Rim Glow */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#b0a79b' }}>Fresnel Rim Glow</span>
            <span className="font-mono" style={{ color: '#ffd466' }}>
              {request.rimIntensity.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            className="studio-slider"
            min={0}
            max={2.0}
            step={0.05}
            value={request.rimIntensity}
            onChange={(e) => updateShader('rimIntensity', parseFloat(e.target.value))}
          />
        </div>

        {/* Bloom Glow */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#b0a79b' }}>Compositor Bloom Glow</span>
            <span className="font-mono" style={{ color: '#ffd466' }}>
              {request.bloomStrength.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            className="studio-slider"
            min={0}
            max={1.5}
            step={0.05}
            value={request.bloomStrength}
            onChange={(e) => updateShader('bloomStrength', parseFloat(e.target.value))}
          />
        </div>

        {/* Chiaroscuro Beat 3 Toggle */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            paddingTop: '4px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#f6f1e9' }}>
            <Moon size={13} color="#8be0ff" />
            Beat 3 Chiaroscuro Spotlight
          </span>
          <input
            type="checkbox"
            checked={request.chiaroscuroBeat3}
            onChange={(e) => updateShader('chiaroscuroBeat3', e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: '#e6b333', cursor: 'pointer' }}
          />
        </label>
      </div>

      {/* Generate Button */}
      <button
        type="button"
        className="primary-btn"
        disabled={isGenerating}
        onClick={onGenerate}
      >
        <Wand2 size={16} />
        <span>{isGenerating ? 'Generating 4-Beat Storyboard...' : 'Generate 3D Storyboard'}</span>
      </button>
    </aside>
  );
};
