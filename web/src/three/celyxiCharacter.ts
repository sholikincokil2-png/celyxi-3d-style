import * as THREE from 'three';
import type { CharacterRole, FaceExpression } from '../types/storyboard';
import {
  attachOutlineMesh,
  makeCelyxiRimMaterial,
  makeInvertedHullOutlineMaterial,
  type CelyxiShaderUniforms,
} from './celyxiMaterials';
import { getFaceTexture } from './faceTextures';

export interface CelyxiCharacterRig {
  role: CharacterRole;
  root: THREE.Group;
  hips: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  hatGroup: THREE.Group;
  faceMat: THREE.MeshBasicMaterial;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  handProp: THREE.Group;
  sweatGroup: THREE.Group;
  sweatDrops: THREE.Mesh[];
  currentExpression: FaceExpression;
}

function makeStickLimb(
  length: number,
  radius: number,
  mat: THREE.Material,
): { pivot: THREE.Group; endY: number } {
  const pivot = new THREE.Group();
  const geo = new THREE.CylinderGeometry(radius, radius, length, 12);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -length * 0.5;
  mesh.castShadow = true;
  pivot.add(mesh);

  const jointGeo = new THREE.SphereGeometry(radius * 1.05, 10, 8);
  const joint = new THREE.Mesh(jointGeo, mat);
  joint.position.y = -length;
  pivot.add(joint);

  return { pivot, endY: -length };
}

export function createCelyxiCharacter(
  role: CharacterRole,
  uniforms: CelyxiShaderUniforms,
): CelyxiCharacterRig {
  const root = new THREE.Group();
  root.name = `celyxi_${role}`;

  const outlineMat = makeInvertedHullOutlineMaterial(uniforms, 1.0);
  const propOutlineMat = makeInvertedHullOutlineMaterial(uniforms, 0.72);
  const inkMat = new THREE.MeshStandardMaterial({
    color: '#14100E',
    roughness: 0.75,
    metalness: 0.05,
  });

  const skinMat = makeCelyxiRimMaterial(
    { color: '#F6F1E9', roughness: 0.52, rimFactor: 1.15 },
    uniforms,
  );
  const goldMat = makeCelyxiRimMaterial(
    { color: '#E6B333', roughness: 0.28, metalness: 0.85, rimFactor: 0.9 },
    uniforms,
  );
  const crimsonMat = makeCelyxiRimMaterial(
    { color: '#B32622', roughness: 0.65, rimFactor: 0.9 },
    uniforms,
  );

  // Role torso colors
  const torsoColorMap: Record<CharacterRole, string> = {
    sheriff: '#5A3928',
    clerk: '#DDD6C8',
    astronaut: '#E8ECF2',
    judge: '#2A2326',
    explorer: '#9A784C',
  };
  const torsoMat = makeCelyxiRimMaterial(
    { color: torsoColorMap[role], roughness: 0.68, rimFactor: 1.0 },
    uniforms,
  );

  // Hips / Torso pivot
  const hips = new THREE.Group();
  hips.position.y = 0.52;
  root.add(hips);

  const torsoGroup = new THREE.Group();
  hips.add(torsoGroup);

  // Capsule torso (~0.56w x 0.78h x 0.44d)
  const torsoGeo = new THREE.CapsuleGeometry(0.24, 0.34, 12, 20);
  const torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
  torsoMesh.name = `${role}_torso`;
  torsoMesh.scale.set(1.16, 1.0, 0.92);
  torsoMesh.position.y = 0.38;
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  attachOutlineMesh(torsoMesh, outlineMat);
  torsoGroup.add(torsoMesh);

  // Belt & Gold Buckle
  const beltGeo = new THREE.CylinderGeometry(0.275, 0.285, 0.085, 22);
  const beltMat = makeCelyxiRimMaterial({ color: '#2B1B14', roughness: 0.65 }, uniforms);
  const belt = new THREE.Mesh(beltGeo, beltMat);
  belt.scale.set(1.06, 1.0, 0.86);
  belt.position.y = 0.16;
  attachOutlineMesh(belt, propOutlineMat);
  torsoGroup.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.085, 0.05), goldMat);
  buckle.position.set(0, 0.16, 0.245);
  attachOutlineMesh(buckle, propOutlineMat);
  torsoGroup.add(buckle);

  // Role-specific torso layers
  if (role === 'sheriff') {
    // Crimson kerchief + 6-point gold star badge
    const kerchief = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.24, 4), crimsonMat);
    kerchief.rotation.set(Math.PI, Math.PI * 0.25, 0);
    kerchief.position.set(0, 0.64, 0.15);
    kerchief.scale.set(1.15, 1.0, 0.45);
    attachOutlineMesh(kerchief, propOutlineMat);
    torsoGroup.add(kerchief);

    const star = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.025, 6), goldMat);
    star.rotation.x = Math.PI * 0.5;
    star.position.set(0.12, 0.51, 0.235);
    attachOutlineMesh(star, propOutlineMat);
    torsoGroup.add(star);
  } else if (role === 'clerk') {
    // Dark vest & tie
    const vestMat = makeCelyxiRimMaterial({ color: '#2E2C30', roughness: 0.72 }, uniforms);
    const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.265, 0.42, 20), vestMat);
    vest.scale.set(1.14, 1.0, 0.9);
    vest.position.y = 0.36;
    attachOutlineMesh(vest, propOutlineMat);
    torsoGroup.add(vest);

    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.28, 0.04), crimsonMat);
    tie.position.set(0, 0.47, 0.235);
    attachOutlineMesh(tie, propOutlineMat);
    torsoGroup.add(tie);
  } else if (role === 'astronaut') {
    // Oxygen pack + cyan chest patch
    const packMat = makeCelyxiRimMaterial({ color: '#C4CDD9', roughness: 0.5 }, uniforms);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.18), packMat);
    pack.position.set(0, 0.42, -0.25);
    attachOutlineMesh(pack, propOutlineMat);
    torsoGroup.add(pack);

    const patchMat = makeCelyxiRimMaterial(
      { color: '#3FA7D6', emissive: '#1D5E82', emissiveIntensity: 0.45 },
      uniforms,
    );
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.04), patchMat);
    patch.position.set(0, 0.48, 0.24);
    attachOutlineMesh(patch, propOutlineMat);
    torsoGroup.add(patch);
  } else if (role === 'judge') {
    // Crimson/gold collar + front sash
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.052, 10, 22), crimsonMat);
    collar.rotation.x = Math.PI * 0.5;
    collar.position.set(0, 0.67, 0.02);
    attachOutlineMesh(collar, propOutlineMat);
    torsoGroup.add(collar);

    const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 16), goldMat);
    medallion.rotation.x = Math.PI * 0.5;
    medallion.position.set(0, 0.52, 0.24);
    attachOutlineMesh(medallion, propOutlineMat);
    torsoGroup.add(medallion);
  } else if (role === 'explorer') {
    // Diagonal leather satchel strap + brass compass badge
    const strapMat = makeCelyxiRimMaterial({ color: '#4E2E1D', roughness: 0.7 }, uniforms);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.48), strapMat);
    strap.rotation.z = 0.52;
    strap.position.set(0, 0.42, 0.01);
    attachOutlineMesh(strap, propOutlineMat);
    torsoGroup.add(strap);

    const compass = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.03, 16), goldMat);
    compass.rotation.x = Math.PI * 0.5;
    compass.position.set(-0.11, 0.46, 0.245);
    attachOutlineMesh(compass, propOutlineMat);
    torsoGroup.add(compass);
  }

  // Head group sitting directly on torso collar
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.76, 0);
  torsoGroup.add(headGroup);

  const headGeo = new THREE.SphereGeometry(0.37, 32, 24);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.name = `${role}_head`;
  headMesh.scale.set(1.03, 0.94, 0.96);
  headMesh.position.y = 0.34;
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  attachOutlineMesh(headMesh, outlineMat);
  headGroup.add(headMesh);

  // Curved Face Decal sitting cleanly 0.005m outside front hemisphere
  const faceTex = getFaceTexture(role, 'neutral');
  const faceMat = new THREE.MeshBasicMaterial({
    map: faceTex,
    transparent: true,
    depthWrite: false,
  });
  const faceGeo = new THREE.SphereGeometry(
    0.376,
    24,
    18,
    Math.PI * 0.2,
    Math.PI * 0.6,
    Math.PI * 0.18,
    Math.PI * 0.64,
  );
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.scale.set(1.03, 0.94, 0.96);
  faceMesh.position.y = 0.34;
  // SphereGeometry phi=0 starts at +X; rotate Y by 0 -> phi center PI*0.5 faces +Z
  headGroup.add(faceMesh);

  // Hat / Hair group
  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, 0.34, 0);
  headGroup.add(hatGroup);

  const darkHairMat = makeCelyxiRimMaterial({ color: '#241B17', roughness: 0.78 }, uniforms);

  if (role === 'sheriff') {
    const hatMat = makeCelyxiRimMaterial({ color: '#5A3928', roughness: 0.72 }, uniforms);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.58, 0.04, 28), hatMat);
    brim.scale.set(1.0, 1.0, 1.12);
    brim.position.set(0, 0.27, 0.01);
    brim.rotation.z = 0.07;
    attachOutlineMesh(brim, propOutlineMat);
    hatGroup.add(brim);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.31, 0.28, 22), hatMat);
    crown.position.set(0, 0.42, 0.01);
    crown.rotation.z = 0.07;
    attachOutlineMesh(crown, propOutlineMat);
    hatGroup.add(crown);

    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.318, 0.055, 22), goldMat);
    band.position.set(0, 0.31, 0.01);
    band.rotation.z = 0.07;
    hatGroup.add(band);
  } else if (role === 'clerk') {
    // Hair cap + translucent emerald clerk visor
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.388, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.44),
      darkHairMat,
    );
    hair.scale.set(1.03, 0.95, 0.98);
    hair.rotation.x = -0.18;
    attachOutlineMesh(hair, propOutlineMat);
    hatGroup.add(hair);

    const visorBand = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.025, 10, 26), inkMat);
    visorBand.rotation.x = Math.PI * 0.5 - 0.14;
    visorBand.position.set(0, 0.22, 0.01);
    hatGroup.add(visorBand);

    const visorMat = new THREE.MeshPhysicalMaterial({
      color: '#1F8A4C',
      emissive: '#0B3A1E',
      emissiveIntensity: 0.25,
      roughness: 0.15,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    const visorBrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.52, 0.018, 24, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
      visorMat,
    );
    visorBrim.position.set(0, 0.21, 0.16);
    visorBrim.rotation.x = 0.22;
    hatGroup.add(visorBrim);
  } else if (role === 'astronaut') {
    const ringMat = makeCelyxiRimMaterial({ color: '#D8E0EB', roughness: 0.4 }, uniforms);
    const domeRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 12, 28), ringMat);
    domeRing.position.set(0, 0.02, 0.16);
    attachOutlineMesh(domeRing, propOutlineMat);
    hatGroup.add(domeRing);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#8BE0FF',
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.22,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 18), glassMat);
    hatGroup.add(dome);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.24, 10), goldMat);
    antenna.position.set(0.38, 0.36, -0.05);
    hatGroup.add(antenna);
  } else if (role === 'judge') {
    const wigMat = makeCelyxiRimMaterial({ color: '#EAE4DA', roughness: 0.72 }, uniforms);
    for (const side of [-1, 1]) {
      const curl = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.28, 8, 14), wigMat);
      curl.position.set(side * 0.36, 0.02, -0.02);
      curl.rotation.z = side * -0.12;
      attachOutlineMesh(curl, propOutlineMat);
      hatGroup.add(curl);
    }
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.39, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.46), wigMat);
    crown.scale.set(1.04, 0.96, 1.0);
    attachOutlineMesh(crown, propOutlineMat);
    hatGroup.add(crown);

    const capMat = makeCelyxiRimMaterial({ color: '#1F1B1D', roughness: 0.65 }, uniforms);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46), capMat);
    cap.position.set(0, 0.41, 0);
    cap.rotation.z = -0.06;
    attachOutlineMesh(cap, propOutlineMat);
    hatGroup.add(cap);
  } else if (role === 'explorer') {
    const pithMat = makeCelyxiRimMaterial({ color: '#C9B182', roughness: 0.72 }, uniforms);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.53, 0.05, 26), pithMat);
    brim.position.set(0, 0.26, 0.02);
    brim.rotation.z = -0.07;
    attachOutlineMesh(brim, propOutlineMat);
    hatGroup.add(brim);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.31, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
      pithMat,
    );
    dome.position.set(0, 0.28, 0);
    dome.rotation.z = -0.07;
    attachOutlineMesh(dome, propOutlineMat);
    hatGroup.add(dome);
  }

  // Stick Arms (upper 0.28 + forearm 0.28 + ball hand 0.046)
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-0.29, 0.58, 0);
  torsoGroup.add(leftShoulder);
  const lUpper = makeStickLimb(0.27, 0.024, inkMat);
  leftShoulder.add(lUpper.pivot);

  const leftElbow = new THREE.Group();
  leftElbow.position.y = lUpper.endY;
  lUpper.pivot.add(leftElbow);
  const lFore = makeStickLimb(0.27, 0.023, inkMat);
  leftElbow.add(lFore.pivot);
  const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), inkMat);
  lHand.position.y = lFore.endY;
  leftElbow.add(lHand);

  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.29, 0.58, 0);
  torsoGroup.add(rightShoulder);
  const rUpper = makeStickLimb(0.27, 0.024, inkMat);
  rightShoulder.add(rUpper.pivot);

  const rightElbow = new THREE.Group();
  rightElbow.position.y = rUpper.endY;
  rUpper.pivot.add(rightElbow);
  const rFore = makeStickLimb(0.27, 0.023, inkMat);
  rightElbow.add(rFore.pivot);
  const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), inkMat);
  rHand.position.y = rFore.endY;
  rightElbow.add(rHand);

  // Hand Prop (shown in Beat 3 badge/item flash)
  const handProp = new THREE.Group();
  handProp.position.set(0, rFore.endY - 0.03, 0.05);
  handProp.visible = false;
  const propDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.024, 6), goldMat);
  propDisc.rotation.x = Math.PI * 0.5;
  attachOutlineMesh(propDisc, propOutlineMat);
  handProp.add(propDisc);
  rightElbow.add(handProp);

  // Stick Legs (upper 0.26 + lower 0.26 + wedge foot)
  const leftHip = new THREE.Group();
  leftHip.position.set(-0.13, 0, 0);
  hips.add(leftHip);
  const lThigh = makeStickLimb(0.26, 0.025, inkMat);
  leftHip.add(lThigh.pivot);
  const leftKnee = new THREE.Group();
  leftKnee.position.y = lThigh.endY;
  lThigh.pivot.add(leftKnee);
  const lShin = makeStickLimb(0.26, 0.024, inkMat);
  leftKnee.add(lShin.pivot);
  const lFoot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.13), inkMat);
  lFoot.position.set(0, lShin.endY + 0.01, 0.04);
  leftKnee.add(lFoot);

  const rightHip = new THREE.Group();
  rightHip.position.set(0.13, 0, 0);
  hips.add(rightHip);
  const rThigh = makeStickLimb(0.26, 0.025, inkMat);
  rightHip.add(rThigh.pivot);
  const rightKnee = new THREE.Group();
  rightKnee.position.y = rThigh.endY;
  rThigh.pivot.add(rightKnee);
  const rShin = makeStickLimb(0.26, 0.024, inkMat);
  rightKnee.add(rShin.pivot);
  const rFoot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.13), inkMat);
  rFoot.position.set(0, rShin.endY + 0.01, 0.04);
  rightKnee.add(rFoot);

  // Cyan Sweat Drops around temples
  const sweatGroup = new THREE.Group();
  sweatGroup.position.set(0, 0.44, 0.18);
  headGroup.add(sweatGroup);

  const sweatMat = new THREE.MeshBasicMaterial({ color: '#8BE0FF' });
  const sweatGeo = new THREE.ConeGeometry(0.038, 0.1, 10);
  const sweatDrops: THREE.Mesh[] = [];
  const dropPositions: Array<[number, number, number]> = [
    [-0.41, 0.12, 0.08],
    [0.41, 0.16, 0.06],
    [-0.38, -0.06, 0.14],
    [0.44, -0.02, 0.1],
  ];
  for (let i = 0; i < dropPositions.length; i++) {
    const drop = new THREE.Mesh(sweatGeo, sweatMat);
    drop.position.set(...dropPositions[i]);
    drop.rotation.z = i % 2 === 0 ? 0.35 : -0.35;
    attachOutlineMesh(drop, propOutlineMat);
    drop.visible = false;
    sweatGroup.add(drop);
    sweatDrops.push(drop);
  }

  return {
    role,
    root,
    hips,
    torsoGroup,
    headGroup,
    hatGroup,
    faceMat,
    leftShoulder,
    leftElbow,
    rightShoulder,
    rightElbow,
    leftHip,
    leftKnee,
    rightHip,
    rightKnee,
    handProp,
    sweatGroup,
    sweatDrops,
    currentExpression: 'neutral',
  };
}

export function setRigExpression(
  rig: CelyxiCharacterRig,
  expr: FaceExpression,
  frame: number,
) {
  // Natural 3-frame blink every 62 frames unless shocked/panic/smug
  const allowBlink = expr === 'neutral' || expr === 'suspicious';
  const isBlinking = allowBlink && frame % 62 >= 58 && frame % 62 <= 60;
  const resolved: FaceExpression = isBlinking ? 'blink' : expr;

  if (rig.currentExpression !== resolved) {
    rig.currentExpression = resolved;
    rig.faceMat.map = getFaceTexture(rig.role, resolved);
    rig.faceMat.needsUpdate = true;
  }
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = Math.min(1, Math.max(0, t));
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/**
 * Evaluates a continuous, living @Celyxi character animation pose for a given frame.
 */
export function evaluateCharacterAction(
  rig: CelyxiCharacterRig,
  action: string,
  beatProgress: number,
  frame: number,
  sweatCount: number,
  basePos: THREE.Vector3,
  baseRotY: number,
) {
  const tSec = frame / 30;
  const breath = Math.sin(tSec * Math.PI * 2 * 1.45);
  const headLag = Math.sin((tSec - 0.08) * Math.PI * 2 * 1.45);

  // Reset defaults
  rig.hips.position.set(0, 0.52, 0);
  rig.torsoGroup.scale.set(1 - breath * 0.014, 1 + breath * 0.026, 1 - breath * 0.014);
  rig.torsoGroup.rotation.set(breath * 0.03, 0, 0);
  rig.headGroup.rotation.set(headLag * 0.04, 0, 0);
  rig.hatGroup.rotation.set(0, 0, 0);

  rig.leftShoulder.rotation.set(0, 0, 0.22);
  rig.leftElbow.rotation.set(-0.35, 0, 0);
  rig.rightShoulder.rotation.set(0, 0, -0.22);
  rig.rightElbow.rotation.set(-0.35, 0, 0);
  rig.leftHip.rotation.set(0, 0, 0);
  rig.leftKnee.rotation.set(0, 0, 0);
  rig.rightHip.rotation.set(0, 0, 0);
  rig.rightKnee.rotation.set(0, 0, 0);
  rig.handProp.visible = false;

  const pos = basePos.clone();
  let rotY = baseRotY;

  if (action === 'strut_walk') {
    if (beatProgress < 0.58) {
      const walkT = beatProgress / 0.58;
      const stride = Math.sin(walkT * Math.PI * 4);
      const stepLift = Math.abs(Math.cos(walkT * Math.PI * 4));
      pos.z += (walkT - 0.5) * 1.45;
      rig.hips.position.y = 0.52 + stepLift * 0.045;
      rig.torsoGroup.rotation.z = stride * 0.065;
      rig.headGroup.rotation.z = -stride * 0.04;
      rig.hatGroup.rotation.z = stride * 0.055;

      rig.leftHip.rotation.x = stride * 0.52;
      rig.rightHip.rotation.x = -stride * 0.52;
      rig.leftKnee.rotation.x = Math.max(0, -stride * 0.45);
      rig.rightKnee.rotation.x = Math.max(0, stride * 0.45);

      rig.leftShoulder.rotation.x = -stride * 0.55;
      rig.rightShoulder.rotation.x = stride * 0.55;
    } else {
      // Snappy stop + lean toward WANTED clue & point right arm
      const snap = easeOutBack((beatProgress - 0.58) / 0.16);
      pos.z += 0.725;
      rotY += snap * 0.28;
      rig.torsoGroup.rotation.x = snap * 0.18;
      rig.headGroup.rotation.y = snap * 0.24;
      rig.rightShoulder.rotation.set(-1.35 * snap, 0, -0.32);
      rig.rightElbow.rotation.set(-0.1, 0, 0);
      rig.leftShoulder.rotation.set(0.15, 0, 0.42);
      rig.leftElbow.rotation.set(-0.8, 0, 0);
    }
  } else if (action === 'scrub_relic') {
    const scrub = Math.sin(tSec * Math.PI * 2 * 3.8);
    const scrubCos = Math.cos(tSec * Math.PI * 2 * 3.8);
    rig.torsoGroup.rotation.x = 0.16 + breath * 0.04;
    rig.headGroup.rotation.y = Math.sin(tSec * 2.2) * 0.35;
    rig.leftShoulder.rotation.set(-0.95 + scrub * 0.25, scrubCos * 0.22, 0.25);
    rig.rightShoulder.rotation.set(-0.95 - scrub * 0.25, -scrubCos * 0.22, -0.25);
    rig.leftElbow.rotation.x = -0.65;
    rig.rightElbow.rotation.x = -0.65;
  } else if (action === 'lean_confront') {
    const snap = easeOutBack(Math.min(1, beatProgress / 0.28));
    pos.x += snap * 0.18;
    rig.torsoGroup.rotation.x = 0.28 * snap + breath * 0.03;
    rig.rightShoulder.rotation.set(-1.25 * snap, 0, -0.18);
    rig.rightElbow.rotation.x = -0.15;
    // Impatient finger/arm tap
    rig.leftShoulder.rotation.set(-0.65 + Math.sin(tSec * 12) * 0.12, 0, 0.24);
    rig.leftElbow.rotation.x = -0.6;
  } else if (action === 'duck_tremble') {
    const duckSnap = easeOutBack(Math.min(1, Math.max(0, (beatProgress - 0.22) / 0.18)));
    rig.hips.position.y = 0.52 - duckSnap * 0.24;
    if (beatProgress > 0.25) {
      // 11 Hz panic tremble
      pos.x += Math.sin(tSec * Math.PI * 2 * 11) * 0.016;
      pos.y += Math.cos(tSec * Math.PI * 2 * 13) * 0.012;
      rig.headGroup.rotation.z = Math.sin(tSec * 28) * 0.05;
      rig.leftShoulder.rotation.set(-1.15, 0, 0.45);
      rig.rightShoulder.rotation.set(-1.15, 0, -0.45);
      rig.leftElbow.rotation.x = -1.1;
      rig.rightElbow.rotation.x = -1.1;
    } else {
      const scrub = Math.sin(tSec * Math.PI * 2 * 4.2);
      rig.leftShoulder.rotation.set(-0.95 + scrub * 0.2, 0, 0.24);
      rig.rightShoulder.rotation.set(-0.95 - scrub * 0.2, 0, -0.24);
    }
  } else if (action === 'badge_raise') {
    const raise = easeOutBack(Math.min(1, beatProgress / 0.35));
    rig.torsoGroup.rotation.x = 0.12 + breath * 0.03;
    rig.headGroup.rotation.z = 0.09 * raise;
    rig.rightShoulder.rotation.set(-1.55 * raise, -0.15, -0.15);
    rig.rightElbow.rotation.set(-0.45 * raise, 0, 0);
    rig.handProp.visible = true;
    rig.leftShoulder.rotation.set(0.15, 0, 0.38);
    rig.leftElbow.rotation.x = -0.85;
  } else if (action === 'frantic_wave') {
    const wave = Math.sin(tSec * Math.PI * 2 * 3.0);
    pos.x += Math.sin(tSec * 42) * 0.014;
    rig.hips.position.y = 0.46 + Math.abs(wave) * 0.06;
    rig.headGroup.rotation.y = Math.sin(tSec * 18) * 0.26;
    rig.leftShoulder.rotation.set(-2.3 + wave * 0.45, 0, 0.48);
    rig.rightShoulder.rotation.set(-2.3 - wave * 0.45, 0, -0.48);
    rig.leftElbow.rotation.x = -0.35;
    rig.rightElbow.rotation.x = -0.35;
  } else if (action === 'recoil_fall') {
    const recoil = easeOutBack(Math.min(1, beatProgress / 0.3));
    pos.x += recoil * 0.22;
    rig.hips.position.y = 0.48 - recoil * 0.08;
    rig.torsoGroup.rotation.x = -0.36 * recoil + breath * 0.04;
    rig.headGroup.rotation.x = -0.15 * recoil;
    rig.leftShoulder.rotation.set(-1.8 * recoil, 0, 0.65);
    rig.rightShoulder.rotation.set(-1.8 * recoil, 0, -0.65);
  } else if (action === 'smug_laugh') {
    const laugh = Math.sin(tSec * Math.PI * 2 * 3.5);
    rig.hips.position.y = 0.52 + Math.abs(laugh) * 0.055;
    rig.torsoGroup.rotation.x = -0.18 + laugh * 0.08;
    rig.headGroup.rotation.x = -0.14 - laugh * 0.1;
    rig.hatGroup.rotation.x = -0.06 + laugh * 0.05;
    // Hands on hips
    rig.leftShoulder.rotation.set(0.1, 0, 0.58);
    rig.leftElbow.rotation.set(-0.4, 0, -1.05);
    rig.rightShoulder.rotation.set(0.1, 0, -0.58);
    rig.rightElbow.rotation.set(-0.4, 0, 1.05);
  } else if (action === 'peek_blink') {
    rig.hips.position.y = 0.44 + breath * 0.025;
    rig.headGroup.rotation.y = Math.sin(tSec * 2.5) * 0.18;
  }

  // Sweat drops visibility & bounce
  for (let i = 0; i < rig.sweatDrops.length; i++) {
    const drop = rig.sweatDrops[i];
    const show = i < sweatCount;
    drop.visible = show;
    if (show) {
      const pulse = 1 + Math.sin(tSec * 14 + i * 1.7) * 0.18;
      drop.scale.setScalar(pulse);
      drop.position.y += Math.sin(tSec * 10 + i) * 0.008;
    }
  }

  rig.root.position.copy(pos);
  rig.root.rotation.y = rotY;
}
