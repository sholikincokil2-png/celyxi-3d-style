import * as THREE from 'three';
import type { EnvironmentTheme, RelicType } from '../types/storyboard';
import {
  attachOutlineMesh,
  getCheckeredFloorTexture,
  getClueSignTexture,
  getWoodPlankTexture,
  makeCelyxiRimMaterial,
  makeInvertedHullOutlineMaterial,
  type CelyxiShaderUniforms,
} from './celyxiMaterials';

export interface EnvironmentSceneBundle {
  exteriorGroup: THREE.Group;
  interiorGroup: THREE.Group;
  relicGroup: THREE.Group;
  relicCore: THREE.Mesh;
  relicHalo: THREE.Mesh;
  relicSparkles: THREE.Mesh[];
  lightShaft: THREE.Mesh;
  dustMotes: THREE.Mesh[];
  pennants: THREE.Mesh[];
  skyDomeMat: THREE.ShaderMaterial;
}

function makeSkyDome(topHex: string, horizonHex: string): {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
} {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTopColor: { value: new THREE.Color(topHex) },
      uHorizonColor: { value: new THREE.Color(horizonHex) },
      uDarkness: { value: 0.0 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform float uDarkness;
      varying vec3 vWorldPos;
      void main() {
        float h = clamp(normalize(vWorldPos).y * 1.4 + 0.15, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uTopColor, smoothstep(0.0, 0.85, h));
        col = mix(col, vec3(0.03, 0.02, 0.02), uDarkness);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 16), mat);
  return { mesh, mat };
}

function buildRelicMesh(
  relicType: RelicType,
  glowHex: string,
  uniforms: CelyxiShaderUniforms,
  outlineMat: THREE.Material,
): {
  group: THREE.Group;
  core: THREE.Mesh;
  halo: THREE.Mesh;
  sparkles: THREE.Mesh[];
} {
  const group = new THREE.Group();
  const goldMat = makeCelyxiRimMaterial(
    { color: '#E6B333', roughness: 0.24, metalness: 0.86 },
    uniforms,
  );
  const glowMat = new THREE.MeshStandardMaterial({
    color: glowHex,
    emissive: glowHex,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });

  let core: THREE.Mesh;

  if (relicType === 'golden_bell') {
    const bellGeo = new THREE.CylinderGeometry(0.11, 0.22, 0.3, 20);
    const bellMat = makeCelyxiRimMaterial(
      { color: '#1F8A4C', roughness: 0.35, metalness: 0.35 },
      uniforms,
    );
    const bell = new THREE.Mesh(bellGeo, bellMat);
    attachOutlineMesh(bell, outlineMat);
    group.add(bell);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.028, 10, 22), goldMat);
    rim.rotation.x = Math.PI * 0.5;
    rim.position.y = -0.14;
    attachOutlineMesh(rim, outlineMat);
    group.add(rim);

    core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), glowMat);
    core.position.y = -0.02;
    group.add(core);
  } else if (relicType === 'crystal_orb') {
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 0.1, 16), goldMat);
    pedestal.position.y = -0.14;
    attachOutlineMesh(pedestal, outlineMat);
    group.add(pedestal);

    core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), glowMat);
    core.position.y = 0.05;
    attachOutlineMesh(core, outlineMat);
    group.add(core);

    const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.02, 8, 22), goldMat);
    orbitRing.position.y = 0.05;
    orbitRing.rotation.x = 0.85;
    group.add(orbitRing);
  } else if (relicType === 'crown') {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.18, 0.14, 16), goldMat);
    band.position.y = -0.04;
    attachOutlineMesh(band, outlineMat);
    group.add(band);

    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 6), goldMat);
      spike.position.set(Math.cos(ang) * 0.16, 0.08, Math.sin(ang) * 0.16);
      attachOutlineMesh(spike, outlineMat);
      group.add(spike);
    }

    core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), glowMat);
    core.position.y = 0.04;
    group.add(core);
  } else {
    // briefcase
    const caseMat = makeCelyxiRimMaterial({ color: '#3D2114', roughness: 0.55 }, uniforms);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.16), caseMat);
    attachOutlineMesh(body, outlineMat);
    group.add(body);

    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 16, Math.PI), goldMat);
    handle.position.y = 0.14;
    group.add(handle);

    core = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.18), glowMat);
    core.position.y = 0.02;
    group.add(core);
  }

  // Additive halo ring
  const haloMat = new THREE.MeshBasicMaterial({
    color: glowHex,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.48, 32), haloMat);
  halo.visible = false;
  group.add(halo);

  // Orbiting sparkles
  const sparkles: THREE.Mesh[] = [];
  const spMat = new THREE.MeshBasicMaterial({ color: '#FFF6CC' });
  const spGeo = new THREE.OctahedronGeometry(0.035, 0);
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Mesh(spGeo, spMat);
    sp.visible = false;
    group.add(sp);
    sparkles.push(sp);
  }

  return { group, core, halo, sparkles };
}

export function buildCelyxiEnvironment(
  scene: THREE.Scene,
  theme: EnvironmentTheme,
  relicType: RelicType,
  clueText: string,
  palette: {
    skyTop: string;
    skyHorizon: string;
    relicGlow: string;
    accent: string;
  },
  uniforms: CelyxiShaderUniforms,
): EnvironmentSceneBundle {
  const outlineMat = makeInvertedHullOutlineMaterial(uniforms, 0.55);

  // Sky dome
  const { mesh: skyMesh, mat: skyDomeMat } = makeSkyDome(palette.skyTop, palette.skyHorizon);
  scene.add(skyMesh);

  // =========================================================================
  // EXTERIOR GROUP (Beat 1)
  // =========================================================================
  const exteriorGroup = new THREE.Group();
  scene.add(exteriorGroup);

  const groundColors: Record<EnvironmentTheme, string> = {
    frontier_town: '#C99D62',
    courthouse: '#B89F82',
    space_station: '#232F44',
    neon_alley: '#1B1A26',
    cozy_studio: '#7E5436',
  };
  const groundMat = makeCelyxiRimMaterial(
    {
      color: groundColors[theme],
      roughness: 0.85,
      map:
        theme === 'frontier_town' || theme === 'cozy_studio'
          ? getWoodPlankTexture(groundColors[theme], '#4B321F')
          : getCheckeredFloorTexture(groundColors[theme], '#161A24'),
      rimFactor: 0.35,
    },
    uniforms,
  );
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(24, 30), groundMat);
  ground.rotation.x = -Math.PI * 0.5;
  ground.receiveShadow = true;
  exteriorGroup.add(ground);

  // Raised walkway / boardwalk
  const walkwayMat = makeCelyxiRimMaterial(
    {
      color: theme === 'space_station' ? '#394B68' : '#8C5830',
      roughness: 0.72,
      map: getWoodPlankTexture('#8C5830', '#4A2C16'),
    },
    uniforms,
  );
  const walkway = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 16), walkwayMat);
  walkway.position.set(0, 0.05, 0);
  walkway.receiveShadow = true;
  attachOutlineMesh(walkway, outlineMat);
  exteriorGroup.add(walkway);

  // False-front buildings / corridors flanking both sides
  const facadePalette: Record<EnvironmentTheme, string[]> = {
    frontier_town: ['#9B653E', '#75492B', '#B07B4E'],
    courthouse: ['#C7B79E', '#A8967B', '#8E7A62'],
    space_station: ['#2E3F5C', '#22314A', '#41597D'],
    neon_alley: ['#232033', '#2E2542', '#1C1B29'],
    cozy_studio: ['#8C5A38', '#6B4227', '#A46D46'],
  };
  const fColors = facadePalette[theme];

  for (let i = 0; i < 6; i++) {
    const zPos = -6 + i * 2.5;
    for (const side of [-1, 1]) {
      const h = 3.2 + ((i + (side > 0 ? 1 : 0)) % 3) * 0.7;
      const bMat = makeCelyxiRimMaterial(
        { color: fColors[i % fColors.length], roughness: 0.78, rimFactor: 0.5 },
        uniforms,
      );
      const bldg = new THREE.Mesh(new THREE.BoxGeometry(2.4, h, 2.1), bMat);
      bldg.position.set(side * 2.85, h * 0.5, zPos);
      bldg.castShadow = true;
      bldg.receiveShadow = true;
      attachOutlineMesh(bldg, outlineMat);
      exteriorGroup.add(bldg);

      // Lit window or neon strip
      const winColor =
        theme === 'neon_alley'
          ? i % 2 === 0
            ? '#58F2C6'
            : '#FF5B8C'
          : theme === 'space_station'
            ? '#8BE0FF'
            : '#FFE099';
      const winMat = new THREE.MeshStandardMaterial({
        color: winColor,
        emissive: winColor,
        emissiveIntensity: theme === 'neon_alley' || theme === 'space_station' ? 1.5 : 0.7,
      });
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.85), winMat);
      win.position.set(side * 1.64, 1.85, zPos);
      exteriorGroup.add(win);
    }
  }

  // Overhead swaying pennants / banners
  const pennants: THREE.Mesh[] = [];
  const pColors = [palette.accent, '#E6B333', '#1F8A4C', '#6E8FBD'];
  for (let i = 0; i < 7; i++) {
    const pMat = makeCelyxiRimMaterial(
      { color: pColors[i % pColors.length], roughness: 0.6 },
      uniforms,
    );
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 3), pMat);
    tri.rotation.x = Math.PI;
    tri.position.set(-1.35 + i * 0.45, 2.95 - Math.sin((i / 6) * Math.PI) * 0.28, -0.4);
    exteriorGroup.add(tri);
    pennants.push(tri);
  }

  // Clue Post (WANTED / RESTRICTED / EVIDENCE)
  const postGroup = new THREE.Group();
  postGroup.position.set(0.92, 0, 0.75);
  postGroup.rotation.y = -0.35;
  exteriorGroup.add(postGroup);

  const postMat = makeCelyxiRimMaterial({ color: '#4B2B17', roughness: 0.75 }, uniforms);
  const postPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.75, 12), postMat);
  postPole.position.y = 0.875;
  attachOutlineMesh(postPole, outlineMat);
  postGroup.add(postPole);

  const board = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.82, 0.06), postMat);
  board.position.set(0, 1.48, 0.04);
  attachOutlineMesh(board, outlineMat);
  postGroup.add(board);

  const signFaceMat = new THREE.MeshStandardMaterial({
    map: getClueSignTexture(clueText, palette.accent),
    roughness: 0.7,
  });
  const signFace = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.72), signFaceMat);
  signFace.position.set(0, 1.48, 0.075);
  postGroup.add(signFace);

  // Foreground barrel / crate
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.25, 0.68, 16),
    makeCelyxiRimMaterial({ color: '#784624', roughness: 0.72 }, uniforms),
  );
  barrel.position.set(-1.05, 0.34, 1.25);
  attachOutlineMesh(barrel, outlineMat);
  exteriorGroup.add(barrel);

  // =========================================================================
  // INTERIOR GROUP (Beats 2, 3, 4)
  // =========================================================================
  const interiorGroup = new THREE.Group();
  interiorGroup.visible = false;
  scene.add(interiorGroup);

  const floorTex =
    theme === 'space_station' || theme === 'courthouse'
      ? getCheckeredFloorTexture('#CFC3B0', '#4A413B')
      : getWoodPlankTexture('#7B4E2D', '#472813');
  const intFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    makeCelyxiRimMaterial({ color: '#D6C7B2', map: floorTex, roughness: 0.7 }, uniforms),
  );
  intFloor.rotation.x = -Math.PI * 0.5;
  intFloor.receiveShadow = true;
  interiorGroup.add(intFloor);

  // Accent Carpet Runner
  const carpet = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.025, 6.5),
    makeCelyxiRimMaterial({ color: palette.accent, roughness: 0.85 }, uniforms),
  );
  carpet.position.set(0, 0.015, 0.3);
  interiorGroup.add(carpet);

  // Back Wall + Side Walls
  const wallColor =
    theme === 'space_station'
      ? '#253349'
      : theme === 'neon_alley'
        ? '#1C1829'
        : '#4B3427';
  const wallMat = makeCelyxiRimMaterial({ color: wallColor, roughness: 0.85, rimFactor: 0.25 }, uniforms);
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(10, 5.5, 0.3), wallMat);
  backWall.position.set(0, 2.75, -2.5);
  backWall.receiveShadow = true;
  interiorGroup.add(backWall);

  // Arched Window / Portal on Back Wall pouring warm/cyan shaft
  const windowColor = theme === 'space_station' ? '#8BE0FF' : '#FFE4A6';
  const winGlowMat = new THREE.MeshStandardMaterial({
    color: windowColor,
    emissive: windowColor,
    emissiveIntensity: 1.85,
  });
  const archWin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.1, 0.1), winGlowMat);
  archWin.position.set(0, 2.45, -2.32);
  interiorGroup.add(archWin);

  const archTop = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.1, 20), winGlowMat);
  archTop.rotation.x = Math.PI * 0.5;
  archTop.position.set(0, 3.5, -2.32);
  interiorGroup.add(archTop);

  // Wall Clue Frame
  const wallSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.75, 0.95),
    new THREE.MeshStandardMaterial({
      map: getClueSignTexture(clueText, palette.accent),
      roughness: 0.7,
    }),
  );
  wallSign.position.set(-1.55, 2.1, -2.32);
  interiorGroup.add(wallSign);

  // Heavy Mahogany / Steel Counter
  const counterColor = theme === 'space_station' ? '#364A66' : '#3D2114';
  const counterTopColor = theme === 'space_station' ? '#587196' : '#8C5830';
  const counterBase = new THREE.Mesh(
    new THREE.BoxGeometry(2.65, 0.96, 0.74),
    makeCelyxiRimMaterial({ color: counterColor, roughness: 0.65 }, uniforms),
  );
  counterBase.position.set(0, 0.48, 0.0);
  counterBase.castShadow = true;
  counterBase.receiveShadow = true;
  attachOutlineMesh(counterBase, outlineMat);
  interiorGroup.add(counterBase);

  const counterTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.82, 0.1, 0.86),
    makeCelyxiRimMaterial(
      {
        color: counterTopColor,
        roughness: 0.45,
        map: theme === 'space_station' ? undefined : getWoodPlankTexture(counterTopColor, '#3D2114'),
      },
      uniforms,
    ),
  );
  counterTop.position.set(0, 1.0, 0.0);
  counterTop.castShadow = true;
  counterTop.receiveShadow = true;
  attachOutlineMesh(counterTop, outlineMat);
  interiorGroup.add(counterTop);

  // Desk props (scrolled paper + brass inkwell)
  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.02, 0.24),
    makeCelyxiRimMaterial({ color: '#EDE0C8', roughness: 0.8 }, uniforms),
  );
  paper.position.set(-0.62, 1.06, 0.08);
  paper.rotation.y = 0.25;
  interiorGroup.add(paper);

  // Volumetric Light Shaft Cone
  const shaftMat = new THREE.MeshBasicMaterial({
    color: windowColor,
    transparent: true,
    opacity: 0.09,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const lightShaft = new THREE.Mesh(new THREE.ConeGeometry(1.9, 5.2, 20, 1, true), shaftMat);
  lightShaft.position.set(0, 2.2, -0.45);
  lightShaft.rotation.x = 0.55;
  interiorGroup.add(lightShaft);

  // =========================================================================
  // RELIC
  // =========================================================================
  const relic = buildRelicMesh(relicType, palette.relicGlow, uniforms, outlineMat);
  relic.group.position.set(0.15, 1.24, 0.05);
  relic.group.visible = false;
  scene.add(relic.group);

  // =========================================================================
  // FLOATING DUST MOTES
  // =========================================================================
  const dustMotes: THREE.Mesh[] = [];
  const dustGeo = new THREE.SphereGeometry(0.016, 6, 6);
  const dustMat = new THREE.MeshBasicMaterial({
    color: '#FFF2D0',
    transparent: true,
    opacity: 0.72,
  });
  for (let i = 0; i < 40; i++) {
    const mote = new THREE.Mesh(dustGeo, dustMat);
    mote.position.set(
      ((i * 73) % 100) / 25 - 2.0,
      0.4 + (((i * 41) % 100) / 100) * 2.5,
      ((i * 59) % 100) / 25 - 1.8,
    );
    mote.userData = {
      baseX: mote.position.x,
      baseY: mote.position.y,
      baseZ: mote.position.z,
      phase: i * 0.7,
    };
    scene.add(mote);
    dustMotes.push(mote);
  }

  return {
    exteriorGroup,
    interiorGroup,
    relicGroup: relic.group,
    relicCore: relic.core,
    relicHalo: relic.halo,
    relicSparkles: relic.sparkles,
    lightShaft,
    dustMotes,
    pennants,
    skyDomeMat,
  };
}
