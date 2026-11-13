import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { BeatSpec, CelyxiShaderSettings, Storyboard } from '../types/storyboard';
import {
  createCelyxiCharacter,
  evaluateCharacterAction,
  setRigExpression,
  type CelyxiCharacterRig,
} from './celyxiCharacter';
import { buildCelyxiEnvironment, type EnvironmentSceneBundle } from './celyxiEnvironments';
import type { CelyxiShaderUniforms } from './celyxiMaterials';

function mmToVerticalFovDeg(lensMm: number): number {
  // Vertical 9:16 sensor (~24mm vertical height equivalent for dramatic Celyxi framing)
  const sensorHeightMm = 28;
  const fovRad = 2 * Math.atan(sensorHeightMm / (2 * lensMm));
  return THREE.MathUtils.radToDeg(fovRad);
}

function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 3);
}

export class CelyxiStageEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;

  private ambientLight: THREE.HemisphereLight;
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private chiaroscuroSpot: THREE.SpotLight;
  private chiaroscuroTarget: THREE.Object3D;
  private relicPointLight: THREE.PointLight;

  private sharedUniforms: CelyxiShaderUniforms;
  private storyboard: Storyboard;

  private heroRig!: CelyxiCharacterRig;
  private sidekickRig!: CelyxiCharacterRig;
  private env!: EnvironmentSceneBundle;

  private width = 540;
  private height = 960;

  constructor(canvas: HTMLCanvasElement, initialStoryboard: Storyboard) {
    this.storyboard = initialStoryboard;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2('#1C1714', 0.032);

    this.camera = new THREE.PerspectiveCamera(42, 9 / 16, 0.1, 80);
    this.camera.position.set(0, 1.5, 4.2);

    this.sharedUniforms = {
      uOutlineThickness: { value: initialStoryboard.shaders.outlineThickness },
      uRimIntensity: { value: initialStoryboard.shaders.rimIntensity },
      uRimColor: { value: new THREE.Color(initialStoryboard.palette.rimLight) },
    };

    // Lighting rig
    this.ambientLight = new THREE.HemisphereLight(
      initialStoryboard.palette.keyLight,
      initialStoryboard.palette.fillLight,
      0.85,
    );
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(initialStoryboard.palette.keyLight, 2.2);
    this.keyLight.position.set(3.2, 5.4, 3.8);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 18;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(initialStoryboard.palette.rimLight, 1.45);
    this.rimLight.position.set(-2.5, 3.2, -3.5);
    this.scene.add(this.rimLight);

    this.chiaroscuroTarget = new THREE.Object3D();
    this.scene.add(this.chiaroscuroTarget);

    this.chiaroscuroSpot = new THREE.SpotLight('#FFD88E', 0, 14, Math.PI / 6.5, 0.48, 1.2);
    this.chiaroscuroSpot.position.set(1.6, 3.4, 2.2);
    this.chiaroscuroSpot.target = this.chiaroscuroTarget;
    this.scene.add(this.chiaroscuroSpot);

    this.relicPointLight = new THREE.PointLight(initialStoryboard.palette.relicGlow, 0, 6);
    this.relicPointLight.position.set(0.15, 1.45, 0.15);
    this.scene.add(this.relicPointLight);

    // Postprocessing Composer (Render -> UnrealBloom -> Output)
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      initialStoryboard.shaders.bloomStrength * 0.55,
      0.5,
      0.82,
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.rebuildWorld(initialStoryboard);
  }

  public setSize(width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  public updateShaders(shaders: CelyxiShaderSettings) {
    this.sharedUniforms.uOutlineThickness.value = shaders.outlineThickness;
    this.sharedUniforms.uRimIntensity.value = shaders.rimIntensity;
    this.bloomPass.strength = shaders.bloomStrength * 0.58;
    this.storyboard = {
      ...this.storyboard,
      shaders: { ...shaders },
      beats: this.storyboard.beats.map((b) =>
        b.id === 3 ? { ...b, chiaroscuro: shaders.chiaroscuroBeat3 } : b,
      ) as Storyboard['beats'],
    };
  }

  public rebuildWorld(sb: Storyboard) {
    this.storyboard = sb;

    // Remove previous world objects
    const toRemove: THREE.Object3D[] = [];
    for (const child of this.scene.children) {
      if (
        child !== this.ambientLight &&
        child !== this.keyLight &&
        child !== this.rimLight &&
        child !== this.chiaroscuroSpot &&
        child !== this.chiaroscuroTarget &&
        child !== this.relicPointLight
      ) {
        toRemove.push(child);
      }
    }
    for (const obj of toRemove) {
      this.scene.remove(obj);
    }

    this.sharedUniforms.uOutlineThickness.value = sb.shaders.outlineThickness;
    this.sharedUniforms.uRimIntensity.value = sb.shaders.rimIntensity;
    this.sharedUniforms.uRimColor.value.set(sb.palette.rimLight);
    this.bloomPass.strength = sb.shaders.bloomStrength * 0.58;

    this.ambientLight.color.set(sb.palette.keyLight);
    this.ambientLight.groundColor.set(sb.palette.fillLight);
    this.keyLight.color.set(sb.palette.keyLight);
    this.relicPointLight.color.set(sb.palette.relicGlow);

    const clueText = sb.beats[0]?.clueText ?? 'WANTED';
    this.env = buildCelyxiEnvironment(
      this.scene,
      sb.theme,
      sb.relicType,
      clueText,
      sb.palette,
      this.sharedUniforms,
    );

    this.heroRig = createCelyxiCharacter(sb.heroRole, this.sharedUniforms);
    this.sidekickRig = createCelyxiCharacter(sb.sidekickRole, this.sharedUniforms);
    this.scene.add(this.heroRig.root);
    this.scene.add(this.sidekickRig.root);
  }

  private getBeatForFrame(frame: number): { beat: BeatSpec; progress: number } {
    for (const b of this.storyboard.beats) {
      if (frame >= b.startFrame && frame <= b.endFrame) {
        const span = Math.max(1, b.endFrame - b.startFrame);
        return { beat: b, progress: (frame - b.startFrame) / span };
      }
    }
    const last = this.storyboard.beats[3];
    return { beat: last, progress: 1 };
  }

  public renderFrame(frameInput: number) {
    const frame = Math.min(300, Math.max(1, Math.round(frameInput)));
    const tSec = frame / 30;
    const { beat, progress } = this.getBeatForFrame(frame);

    const isExterior = beat.id === 1;
    this.env.exteriorGroup.visible = isExterior;
    this.env.interiorGroup.visible = !isExterior;

    // Sway exterior pennants
    for (let i = 0; i < this.env.pennants.length; i++) {
      this.env.pennants[i].rotation.z = Math.sin(tSec * 3.5 + i * 0.6) * 0.16;
    }

    // Float dust motes continuously
    for (const mote of this.env.dustMotes) {
      const { baseX, baseY, baseZ, phase } = mote.userData as {
        baseX: number;
        baseY: number;
        baseZ: number;
        phase: number;
      };
      mote.position.x = baseX + Math.sin(tSec * 0.8 + phase) * 0.12;
      mote.position.y = baseY + Math.cos(tSec * 0.65 + phase) * 0.14;
      mote.position.z = baseZ + Math.sin(tSec * 0.55 + phase * 1.3) * 0.1;
    }

    // Lighting & Chiaroscuro Mode
    const isChiaroscuro = beat.id === 3 && this.storyboard.shaders.chiaroscuroBeat3;
    if (isChiaroscuro) {
      this.ambientLight.intensity = 0.08;
      this.keyLight.intensity = 0.12;
      this.rimLight.color.set('#7DA0FF');
      this.rimLight.intensity = 2.6;
      this.sharedUniforms.uRimColor.value.set('#7DA0FF');
      this.chiaroscuroSpot.intensity = 28.0;
      this.env.skyDomeMat.uniforms.uDarkness.value = 0.96;
      (this.env.lightShaft.material as THREE.MeshBasicMaterial).opacity = 0.02;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.set('#080607');
        this.scene.fog.density = 0.065;
      }
    } else {
      this.ambientLight.intensity = beat.id === 4 ? 1.05 : 0.85;
      this.keyLight.intensity = beat.id === 4 ? 2.6 : 2.15;
      this.rimLight.color.set(this.storyboard.palette.rimLight);
      this.rimLight.intensity = 1.45;
      this.sharedUniforms.uRimColor.value.set(this.storyboard.palette.rimLight);
      this.chiaroscuroSpot.intensity = 0;
      this.env.skyDomeMat.uniforms.uDarkness.value = 0.0;
      (this.env.lightShaft.material as THREE.MeshBasicMaterial).opacity =
        beat.id === 4 ? 0.15 : 0.09;
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.set(this.storyboard.palette.skyHorizon);
        this.scene.fog.density = 0.024;
      }
    }

    // Character Placement, Expressions & Actions per Beat
    const camPos = new THREE.Vector3();
    const camLook = new THREE.Vector3();
    let lensMm = THREE.MathUtils.lerp(beat.lensStartMm, beat.lensEndMm, easeOutCubic(progress));

    if (beat.id === 1) {
      // Beat 1: Street swagger & WANTED clue
      this.sidekickRig.root.visible = false;
      this.heroRig.root.visible = true;
      this.env.relicGroup.visible = false;
      this.relicPointLight.intensity = 0;

      const heroExpr =
        progress < 0.56
          ? beat.hero.expression
          : (beat.hero.expressionLate ?? beat.hero.expression);
      setRigExpression(this.heroRig, heroExpr, frame);
      evaluateCharacterAction(
        this.heroRig,
        'strut_walk',
        progress,
        frame,
        0,
        new THREE.Vector3(-0.18, 0.11, -0.35),
        0.15,
      );

      // Tracking dolly push-in + subtle lateral arc
      const arc = easeOutCubic(progress);
      camPos.set(
        THREE.MathUtils.lerp(-0.95, 0.42, arc),
        THREE.MathUtils.lerp(1.38, 1.44, arc),
        THREE.MathUtils.lerp(3.55, 2.75, arc),
      );
      camLook.set(
        THREE.MathUtils.lerp(-0.1, 0.2, arc),
        1.26,
        this.heroRig.root.position.z * 0.55,
      );
    } else if (beat.id === 2) {
      // Beat 2: Counter confrontation & nervous sidekick
      this.heroRig.root.visible = true;
      this.sidekickRig.root.visible = true;

      const heroBase = new THREE.Vector3(-0.76, 0, 0.72);
      const sideBase = new THREE.Vector3(0.42, 0, -0.62);

      const heroExpr =
        progress < 0.5
          ? beat.hero.expression
          : (beat.hero.expressionLate ?? beat.hero.expression);
      setRigExpression(this.heroRig, heroExpr, frame);
      const sideExpr =
        progress < 0.28
          ? beat.sidekick.expression
          : (beat.sidekick.expressionLate ?? beat.sidekick.expression);
      setRigExpression(this.sidekickRig, sideExpr, frame);

      evaluateCharacterAction(
        this.heroRig,
        progress < 0.25 ? 'strut_walk' : 'lean_confront',
        progress,
        frame,
        0,
        heroBase,
        2.35,
      );
      evaluateCharacterAction(
        this.sidekickRig,
        'duck_tremble',
        progress,
        frame,
        progress > 0.25 ? (beat.sidekick.sweatDrops ?? 3) : 0,
        sideBase,
        -0.25,
      );

      // Relic sits on counter, then yanked down behind counter
      this.env.relicGroup.visible = true;
      const yank = easeOutCubic(Math.min(1, Math.max(0, (progress - 0.24) / 0.16)));
      this.env.relicGroup.position.set(
        0.22,
        THREE.MathUtils.lerp(1.24, 0.68, yank),
        THREE.MathUtils.lerp(0.06, -0.42, yank),
      );
      this.env.relicGroup.rotation.set(0, tSec * 1.4, Math.sin(tSec * 8) * 0.08 * (1 - yank));
      this.env.relicHalo.visible = false;
      this.env.relicSparkles.forEach((s) => (s.visible = false));
      this.relicPointLight.intensity = THREE.MathUtils.lerp(1.4, 0.2, yank);

      camPos.set(
        THREE.MathUtils.lerp(-0.15, 0.15, progress),
        1.42,
        THREE.MathUtils.lerp(2.95, 2.38, progress),
      );
      camLook.set(0.05, 1.24, -0.15);
    } else if (beat.id === 3) {
      // Beat 3: Chiaroscuro spotlight interrogation (two crisp sub-shots!)
      this.heroRig.root.visible = true;
      this.sidekickRig.root.visible = true;
      this.env.relicGroup.visible = false;
      this.relicPointLight.intensity = 0;

      const heroBase = new THREE.Vector3(-0.72, 0, 0.65);
      const sideBase = new THREE.Vector3(0.45, 0, -0.62);

      setRigExpression(this.heroRig, beat.hero.expression, frame);
      const sideExpr =
        progress < 0.65
          ? beat.sidekick.expression
          : (beat.sidekick.expressionLate ?? beat.sidekick.expression);
      setRigExpression(this.sidekickRig, sideExpr, frame);

      if (progress < 0.48) {
        // Sub-shot A: Low-angle Hero raising gleaming badge
        const subP = progress / 0.48;
        evaluateCharacterAction(this.heroRig, 'badge_raise', subP, frame, 0, heroBase, 0.35);
        evaluateCharacterAction(this.sidekickRig, 'duck_tremble', 0.8, frame, 3, sideBase, -0.2);

        this.chiaroscuroTarget.position.set(heroBase.x, 1.42, heroBase.z);
        this.chiaroscuroSpot.position.set(heroBase.x + 1.1, 3.1, heroBase.z + 1.8);

        lensMm = THREE.MathUtils.lerp(45, 58, easeOutCubic(subP));
        camPos.set(
          heroBase.x + 0.45,
          THREE.MathUtils.lerp(1.08, 1.22, subP),
          THREE.MathUtils.lerp(2.45, 2.02, subP),
        );
        camLook.set(heroBase.x, 1.38, heroBase.z);
      } else {
        // Sub-shot B: Whip-cut to frantic Sidekick waving both stick arms
        const subP = (progress - 0.48) / 0.52;
        evaluateCharacterAction(this.heroRig, 'badge_raise', 0.9, frame, 0, heroBase, 2.2);
        evaluateCharacterAction(
          this.sidekickRig,
          'frantic_wave',
          subP,
          frame,
          beat.sidekick.sweatDrops ?? 4,
          sideBase,
          -0.12,
        );

        this.chiaroscuroTarget.position.set(sideBase.x, 1.35, sideBase.z);
        this.chiaroscuroSpot.position.set(sideBase.x - 0.9, 3.1, sideBase.z + 1.9);

        lensMm = 50;
        camPos.set(
          sideBase.x + Math.sin(tSec * 24) * 0.015,
          1.34 + Math.cos(tSec * 20) * 0.012,
          THREE.MathUtils.lerp(1.85, 1.55, subP),
        );
        camLook.set(sideBase.x, 1.34, sideBase.z);
      }
    } else {
      // Beat 4: Golden Bloom Reveal & Smug Laugh Payoff
      this.heroRig.root.visible = true;
      this.sidekickRig.root.visible = true;

      const heroBase = new THREE.Vector3(-0.78, 0, 0.35);
      const sideBase = new THREE.Vector3(0.68, 0, -0.45);

      setRigExpression(this.heroRig, beat.hero.expression, frame);
      setRigExpression(
        this.sidekickRig,
        progress < 0.45
          ? beat.sidekick.expression
          : (beat.sidekick.expressionLate ?? 'blink'),
        frame,
      );

      evaluateCharacterAction(
        this.heroRig,
        progress < 0.2 ? 'badge_raise' : 'smug_laugh',
        progress,
        frame,
        0,
        heroBase,
        0.38,
      );
      evaluateCharacterAction(
        this.sidekickRig,
        progress < 0.5 ? 'recoil_fall' : 'peek_blink',
        progress,
        frame,
        beat.sidekick.sweatDrops ?? 2,
        sideBase,
        -0.38,
      );

      // Relic pops upward spinning in bright bloom + sparkles
      const rise = easeOutCubic(Math.min(1, progress / 0.32));
      this.env.relicGroup.visible = true;
      this.env.relicGroup.position.set(
        0.02,
        THREE.MathUtils.lerp(1.18, 1.72, rise) + Math.sin(tSec * 4.0) * 0.06,
        0.08,
      );
      this.env.relicGroup.rotation.set(Math.sin(tSec * 2.5) * 0.14, tSec * 5.2, 0);

      this.env.relicHalo.visible = true;
      this.env.relicHalo.lookAt(this.camera.position);
      const haloScale = 1.0 + Math.sin(tSec * 6.5) * 0.16;
      this.env.relicHalo.scale.setScalar(haloScale * rise);

      for (let i = 0; i < this.env.relicSparkles.length; i++) {
        const sp = this.env.relicSparkles[i];
        sp.visible = true;
        const ang = tSec * 3.0 + (i / this.env.relicSparkles.length) * Math.PI * 2;
        const rad = 0.42 + Math.sin(tSec * 4 + i) * 0.08;
        sp.position.set(
          Math.cos(ang) * rad,
          Math.sin(tSec * 3.5 + i * 1.1) * 0.24,
          Math.sin(ang) * rad,
        );
        sp.rotation.y = tSec * 6;
      }

      this.relicPointLight.position.copy(this.env.relicGroup.position);
      this.relicPointLight.intensity = 4.5 * rise;

      // Dynamic snap pull-back (55mm -> 32mm) + celebratory pedestal settle
      const pull = easeOutCubic(Math.min(1, progress / 0.45));
      camPos.set(
        THREE.MathUtils.lerp(-0.1, 0.0, pull),
        THREE.MathUtils.lerp(1.25, 1.48, pull) + Math.sin(tSec * 1.4) * 0.02,
        THREE.MathUtils.lerp(2.2, 3.35, pull),
      );
      camLook.set(0.0, 1.28, -0.05);
    }

    // Continuous subtle @Celyxi handheld micro-float
    camPos.x += Math.sin(tSec * 1.9) * 0.014;
    camPos.y += Math.cos(tSec * 2.4) * 0.012;

    this.camera.fov = mmToVerticalFovDeg(lensMm);
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(camPos);
    this.camera.lookAt(camLook);

    this.composer.render();
  }

  public dispose() {
    this.composer.dispose();
    this.renderer.dispose();
  }
}
