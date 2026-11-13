import * as THREE from "three";

/**
 * 1. Procedural Oak Wood Parquet GLSL Shader
 * Generates warm alternating parquet planks with subtle grain & specular varnish gloss.
 */
export function createOakParquetMaterial(brightness = 1.0): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBrightness: { value: brightness },
      uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.4).normalize() },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uBrightness;
      uniform vec3 uLightDir;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPos;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec2 grid = vUv * vec2(10.0, 22.0);
        vec2 cell = floor(grid);
        vec2 local = fract(grid);

        float offset = mod(cell.y, 2.0) * 0.5;
        vec2 plankCoord = vUv * vec2(10.0, 22.0) + vec2(offset, 0.0);
        vec2 plankId = floor(plankCoord);
        vec2 plankUv = fract(plankCoord);

        // Wood grain wave
        float grain = sin(plankUv.y * 40.0 + sin(plankUv.x * 12.0 + hash(plankId) * 6.28) * 1.5) * 0.5 + 0.5;
        float plankTone = hash(plankId) * 0.16;

        vec3 baseWood = vec3(0.42, 0.25, 0.12) + plankTone + grain * vec3(0.08, 0.05, 0.02);

        // Plank seam lines
        float borderX = smoothstep(0.0, 0.03, plankUv.x) * smoothstep(1.0, 0.97, plankUv.x);
        float borderY = smoothstep(0.0, 0.04, plankUv.y) * smoothstep(1.0, 0.96, plankUv.y);
        float seam = borderX * borderY;
        baseWood *= mix(0.45, 1.0, seam);

        // Glossy varnish specular
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 halfVec = normalize(uLightDir + viewDir);
        float spec = pow(max(dot(vec3(0.0, 1.0, 0.0), halfVec), 0.0), 32.0);

        vec3 finalColor = (baseWood + vec3(0.28, 0.22, 0.14) * spec) * uBrightness;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
}

/**
 * 2. Holographic Sleep-Wave (Hypnogram) Shader
 * Animated glowing cyan/purple wave severed by a pulsing red fracture lightning split.
 */
export function createHoloWaveMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSplitPos: { value: 0.52 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uSplitPos;
      varying vec2 vUv;

      void main() {
        // Subtle hologram grid
        vec2 grid = abs(fract(vUv * vec2(16.0, 9.0) - 0.5) - 0.5) / fwidth(vUv * vec2(16.0, 9.0));
        float gridLine = 1.0 - min(min(grid.x, grid.y), 1.0);
        vec3 bg = vec3(0.02, 0.05, 0.14) + vec3(0.0, 0.15, 0.25) * gridLine * 0.35;

        // Animated sleep wave curve (Light -> Deep -> REM)
        float waveY = 0.5
          + 0.22 * sin(vUv.x * 16.0 - uTime * 2.5)
          + 0.10 * cos(vUv.x * 32.0 + uTime * 1.5);

        float distWave = abs(vUv.y - waveY);
        float waveGlow = exp(-distWave * 34.0);
        float waveCore = smoothstep(0.018, 0.005, distWave);

        // Color gradient cyan to purple
        vec3 waveCol = mix(vec3(0.0, 0.92, 1.0), vec3(0.55, 0.20, 1.0), vUv.x);

        // Jagged red fracture split at uSplitPos
        float jagged = sin(vUv.y * 42.0 + uTime * 12.0) * 0.022;
        float distSplit = abs(vUv.x - (uSplitPos + jagged));
        float splitGlow = exp(-distSplit * 40.0) * (0.7 + 0.3 * sin(uTime * 15.0));
        float splitCore = smoothstep(0.015, 0.003, distSplit);

        // Hide wave right inside the crack
        float crackMask = smoothstep(0.012, 0.035, distSplit);

        vec3 col = bg;
        col += waveCol * (waveGlow * 0.8 + waveCore * 1.4) * crackMask;
        col += vec3(1.0, 0.12, 0.18) * (splitGlow * 1.2 + splitCore * 2.0);

        // Border glow
        float border = max(
          smoothstep(0.97, 1.0, max(vUv.x, 1.0 - vUv.x)),
          smoothstep(0.95, 1.0, max(vUv.y, 1.0 - vUv.y))
        );
        col += vec3(0.0, 0.85, 1.0) * border * 0.8;

        gl_FragColor = vec4(col, 0.94);
      }
    `,
  });
}

/**
 * 3. Fresnel Glowing Translucent Brain Shader (Scene 6 Cutaway)
 */
export function createFresnelBrainMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uShock: { value: 1.0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vPos;
      void main() {
        vPos = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uShock;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vPos;

      void main() {
        float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.2);
        float pulse = 0.5 + 0.5 * sin(uTime * 16.0 + vPos.y * 8.0);
        vec3 baseCol = vec3(0.15, 0.55, 0.95);
        vec3 shockCol = vec3(1.0, 0.15, 0.25);

        vec3 col = mix(baseCol, shockCol, pulse * uShock * 0.75);
        col += vec3(0.9, 0.95, 1.0) * fresnel * 1.4;

        gl_FragColor = vec4(col, 0.78 + fresnel * 0.22);
      }
    `,
  });
}

/**
 * 4. Volumetric Window Sunbeam Shader
 */
export function createSunbeamMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color("#FFE8A3") },
      uIntensity: { value: 0.22 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        float fadeY = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.1, vUv.y);
        float fadeX = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        gl_FragColor = vec4(uColor, fadeY * fadeX * uIntensity);
      }
    `,
  });
}

/**
 * 5. Stylized 3D Cel-PBR + Rim-Light GLSL Shader for Stickman3D
 * Replaces flat meshBasicMaterial with real 3D key-light shading, soft shadow wrap,
 * specular highlight, and Fresnel rim-light so characters pop with 3D volume.
 */
export function createStylizedToonRimMaterial(
  baseColorHex: string,
  rimColorHex = "#38BDF8",
  rimStrength = 0.55
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Color(baseColorHex) },
      uRimColor: { value: new THREE.Color(rimColorHex) },
      uRimStrength: { value: rimStrength },
      uLightDir: { value: new THREE.Vector3(-0.45, 0.75, 0.65).normalize() },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uRimColor;
      uniform float uRimStrength;
      uniform vec3 uLightDir;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewDir);
        vec3 L = normalize(uLightDir);

        // Soft 3D wrap diffuse + stylized 2-tone cel band
        float NdotL = dot(N, L);
        float wrap = NdotL * 0.5 + 0.5;
        float celBand = smoothstep(0.32, 0.58, wrap);
        vec3 shadowTint = uBaseColor * vec3(0.68, 0.70, 0.78);
        vec3 litColor = mix(shadowTint, uBaseColor * 1.08, celBand);

        // Subtle specular highlight for 3D plastic/vinyl feel
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.0), 28.0);
        litColor += vec3(0.22) * spec;

        // Fresnel Rim-Light
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        litColor += uRimColor * fresnel * uRimStrength;

        gl_FragColor = vec4(litColor, 1.0);
      }
    `,
  });
}

/**
 * 6. Procedural Plaster Wall + Ambient Occlusion + Warm Window Bounce GLSL Shader
 */
export function createBedroomWallMaterial(isNight: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTopColor: { value: new THREE.Color(isNight ? "#0B1120" : "#E6D5B8") },
      uBottomColor: { value: new THREE.Color(isNight ? "#1E293B" : "#B59E7A") },
      uGlowColor: { value: new THREE.Color(isNight ? "#3B82F6" : "#FEF08A") },
      uIsNight: { value: isNight ? 1.0 : 0.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform vec3 uGlowColor;
      uniform float uIsNight;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        // Vertical gradient + corner AO
        vec3 col = mix(uBottomColor, uTopColor, smoothstep(0.0, 0.85, vUv.y));
        float cornerAO = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
        col *= mix(0.75, 1.0, cornerAO);

        // Subtle plaster micro-texture
        float grain = (hash(floor(vUv * 260.0)) - 0.5) * 0.035;
        col += grain;

        // Window bounce light from left side
        float windowGlow = exp(-length(vUv - vec2(0.18, 0.68)) * 2.8);
        col += uGlowColor * windowGlow * (uIsNight > 0.5 ? 0.22 : 0.38);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/**
 * 7. Woven Fabric + Velvet Fresnel Rim GLSL Shader (Bed Blanket & Pillow)
 */
export function createFabricClothMaterial(
  baseHex: string,
  sheenHex = "#93C5FD"
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color(baseHex) },
      uSheen: { value: new THREE.Color(sheenHex) },
      uLightDir: { value: new THREE.Vector3(-0.4, 0.85, 0.45).normalize() },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uBase;
      uniform vec3 uSheen;
      uniform vec3 uLightDir;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewDir);
        float diff = max(dot(N, uLightDir), 0.0) * 0.65 + 0.35;

        // Micro-weave fabric pattern
        float weave = sin(vUv.x * 160.0) * sin(vUv.y * 160.0) * 0.035;
        // Soft cloth fold shading
        float fold = sin(vUv.x * 14.0 + vUv.y * 6.0) * 0.04;

        // Velvet Fresnel sheen on edges
        float velvet = pow(1.0 - max(dot(N, V), 0.0), 2.5);
        vec3 col = (uBase + weave + fold) * diff + uSheen * velvet * 0.42;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/**
 * 8. Studio Gradient + Radial Spotlight Backdrop GLSL Shader
 */
export function createStudioBackdropMaterial(
  centerHex = "#1E293B",
  edgeHex = "#070B19",
  accentHex = "#38BDF8"
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCenter: { value: new THREE.Color(centerHex) },
      uEdge: { value: new THREE.Color(edgeHex) },
      uAccent: { value: new THREE.Color(accentHex) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uCenter;
      uniform vec3 uEdge;
      uniform vec3 uAccent;
      varying vec2 vUv;

      void main() {
        float d = length(vUv - vec2(0.5, 0.52));
        vec3 col = mix(uCenter, uEdge, smoothstep(0.08, 0.72, d));
        float halo = exp(-d * 4.5) * 0.25;
        col += uAccent * halo;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}
