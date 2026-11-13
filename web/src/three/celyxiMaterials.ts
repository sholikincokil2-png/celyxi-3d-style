import * as THREE from 'three';

export interface CelyxiShaderUniforms {
  uOutlineThickness: { value: number };
  uRimIntensity: { value: number };
  uRimColor: { value: THREE.Color };
}

/**
 * Creates a MeshStandardMaterial augmented with @Celyxi's crisp Fresnel rim lighting
 * right inside the dark ink outline.
 */
export function makeCelyxiRimMaterial(
  options: {
    color: string | number;
    roughness?: number;
    metalness?: number;
    emissive?: string | number;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
    map?: THREE.Texture;
    rimFactor?: number;
  },
  sharedUniforms: CelyxiShaderUniforms,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: options.color,
    roughness: options.roughness ?? 0.62,
    metalness: options.metalness ?? 0.04,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    map: options.map ?? null,
  });

  const rimFactor = options.rimFactor ?? 1.0;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRimIntensity = sharedUniforms.uRimIntensity;
    shader.uniforms.uRimColor = sharedUniforms.uRimColor;
    shader.uniforms.uLocalRimFactor = { value: rimFactor };

    shader.fragmentShader =
      `
      uniform float uRimIntensity;
      uniform vec3 uRimColor;
      uniform float uLocalRimFactor;
      ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      vec3 celyxiViewDir = normalize(vViewPosition);
      float celyxiFresnel = pow(1.0 - clamp(abs(dot(normalize(normal), celyxiViewDir)), 0.0, 1.0), 2.6);
      float celyxiRimBand = smoothstep(0.32, 0.78, celyxiFresnel);
      gl_FragColor.rgb += uRimColor * (celyxiRimBand * uRimIntensity * uLocalRimFactor * 0.42);
      #include <dithering_fragment>
      `,
    );
  };
  mat.customProgramCacheKey = () => `celyxi-rim-${rimFactor.toFixed(2)}`;
  return mat;
}

/**
 * Inverted-hull BackSide outline ShaderMaterial extruded uniformly along vertex normals.
 * Supports live slider updates via uOutlineThickness.
 */
export function makeInvertedHullOutlineMaterial(
  sharedUniforms: CelyxiShaderUniforms,
  scaleMultiplier = 1.0,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uOutlineThickness: sharedUniforms.uOutlineThickness,
      uScaleMultiplier: { value: scaleMultiplier },
      uInkColor: { value: new THREE.Color('#14100E') },
    },
    vertexShader: `
      uniform float uOutlineThickness;
      uniform float uScaleMultiplier;
      void main() {
        vec3 extruded = position + normalize(normal) * (uOutlineThickness * uScaleMultiplier);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(extruded, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uInkColor;
      void main() {
        gl_FragColor = vec4(uInkColor, 1.0);
      }
    `,
  });
}

export function attachOutlineMesh(
  mesh: THREE.Mesh,
  outlineMat: THREE.Material,
  nameSuffix = '_outline',
): THREE.Mesh {
  const outline = new THREE.Mesh(mesh.geometry, outlineMat);
  outline.name = `${mesh.name}${nameSuffix}`;
  outline.castShadow = false;
  outline.receiveShadow = false;
  mesh.add(outline);
  return outline;
}

// Procedural CanvasTextures for wood planks, dirt road, and checkered/tile floor
const procTexCache = new Map<string, THREE.CanvasTexture>();

export function getWoodPlankTexture(baseHex = '#8C5830', darkHex = '#5C3419'): THREE.CanvasTexture {
  const key = `wood:${baseHex}:${darkHex}`;
  const cached = procTexCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  // Planks + wood grain
  for (let i = 0; i < 4; i++) {
    const y = i * 64;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, y, 256, 64);

    ctx.strokeStyle = darkHex;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(20, 16, 14, 0.16)';
    ctx.lineWidth = 1.5;
    for (let g = 0; g < 6; g++) {
      const gy = y + 10 + g * 9;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(85, gy + (g % 2 === 0 ? 4 : -4), 170, gy - 3, 256, gy);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  procTexCache.set(key, tex);
  return tex;
}

export function getCheckeredFloorTexture(c1 = '#D6C7B2', c2 = '#4E433B'): THREE.CanvasTexture {
  const key = `check:${c1}:${c2}`;
  const cached = procTexCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const size = 64;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? c1 : c2;
      ctx.fillRect(x * size, y * size, size, size);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.colorSpace = THREE.SRGBColorSpace;
  procTexCache.set(key, tex);
  return tex;
}

export function getClueSignTexture(label: string, themeAccent = '#B32622'): THREE.CanvasTexture {
  const key = `sign:${label}:${themeAccent}`;
  const cached = procTexCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext('2d')!;

  // Parchment paper
  ctx.fillStyle = '#EBD9B7';
  ctx.fillRect(0, 0, 512, 640);

  // Border
  ctx.strokeStyle = '#3D2114';
  ctx.lineWidth = 18;
  ctx.strokeRect(18, 18, 476, 604);

  // Header banner
  ctx.fillStyle = themeAccent;
  ctx.fillRect(42, 48, 428, 92);

  ctx.fillStyle = '#F6F1E9';
  ctx.font = '800 58px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.slice(0, 12).toUpperCase(), 256, 95);

  // Silhouette sketch of mystery relic
  ctx.strokeStyle = '#14100E';
  ctx.fillStyle = '#C99D62';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(256, 330, 94, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#14100E';
  ctx.font = '800 94px Space Grotesk, sans-serif';
  ctx.fillText('?', 256, 338);

  // Footer lines
  ctx.fillStyle = '#3D2114';
  ctx.fillRect(92, 480, 328, 16);
  ctx.fillRect(132, 520, 248, 14);
  ctx.font = '700 30px JetBrains Mono, monospace';
  ctx.fillText('REWARD: 10,000G', 256, 575);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  procTexCache.set(key, tex);
  return tex;
}
