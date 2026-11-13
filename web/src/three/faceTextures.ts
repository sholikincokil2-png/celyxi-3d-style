import * as THREE from 'three';
import type { CharacterRole, FaceExpression } from '../types/storyboard';

const INK = '#14100E';

const textureCache = new Map<string, THREE.CanvasTexture>();

export function getFaceTexture(
  role: CharacterRole,
  expression: FaceExpression,
): THREE.CanvasTexture {
  const key = `${role}:${expression}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 512);

  // Subtle rosy cheek blush ovals (#F0A89E)
  ctx.save();
  ctx.fillStyle = 'rgba(240, 168, 158, 0.42)';
  ctx.beginPath();
  ctx.ellipse(152, 304, 34, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(360, 304, 34, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Role-specific cheek/jaw details under ink lines
  if (role === 'sheriff') {
    // Stitched red-brown X-scar (#6E1B16)
    ctx.save();
    ctx.strokeStyle = '#6E1B16';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(324, 286);
    ctx.lineTo(366, 326);
    ctx.moveTo(366, 286);
    ctx.lineTo(324, 326);
    ctx.stroke();
    ctx.restore();
  } else if (role === 'clerk') {
    // Chin/jaw stubble dots
    ctx.save();
    ctx.fillStyle = 'rgba(90, 82, 76, 0.55)';
    const dots = [
      [212, 396],
      [234, 404],
      [256, 408],
      [278, 404],
      [300, 396],
      [224, 416],
      [256, 422],
      [288, 416],
    ];
    for (const [x, y] of dots) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (role === 'explorer') {
    // Freckles + small cheek bandage
    ctx.save();
    ctx.fillStyle = 'rgba(154, 98, 62, 0.65)';
    for (const [x, y] of [
      [148, 294],
      [164, 300],
      [156, 310],
      [348, 294],
      [364, 300],
      [356, 310],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Eyes & Brows
  const leftX = 186;
  const rightX = 326;
  const eyeY = 236;

  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (expression === 'neutral') {
    // Crisp dark pill eyes
    ctx.beginPath();
    ctx.ellipse(leftX, eyeY, 17, 22, 0, 0, Math.PI * 2);
    ctx.ellipse(rightX, eyeY, 17, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(leftX - 5, eyeY - 7, 5, 0, Math.PI * 2);
    ctx.arc(rightX - 5, eyeY - 7, 5, 0, Math.PI * 2);
    ctx.fill();

    // Relaxed brows
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(leftX - 28, eyeY - 40);
    ctx.quadraticCurveTo(leftX, eyeY - 48, leftX + 26, eyeY - 38);
    ctx.moveTo(rightX - 26, eyeY - 38);
    ctx.quadraticCurveTo(rightX, eyeY - 48, rightX + 28, eyeY - 40);
    ctx.stroke();

    // Calm smirk mouth
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(222, 336);
    ctx.quadraticCurveTo(260, 352, 294, 332);
    ctx.stroke();
  } else if (expression === 'suspicious') {
    // Half-lidded D-shaped suspicious eyes (-_-")
    for (const x of [leftX, rightX]) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, eyeY + 4, 24, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 9;
      ctx.stroke();

      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x + 4, eyeY + 12, 8, 0, Math.PI * 2);
      ctx.fill();

      // Heavy top eyelid
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(x - 30, eyeY + 2);
      ctx.lineTo(x + 30, eyeY + 2);
      ctx.stroke();
    }

    // Angled stern eyebrows
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(leftX - 32, eyeY - 30);
    ctx.lineTo(leftX + 30, eyeY - 14);
    ctx.moveTo(rightX + 32, eyeY - 30);
    ctx.lineTo(rightX - 30, eyeY - 14);
    ctx.stroke();

    // Tight flat suspicious mouth
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(218, 344);
    ctx.quadraticCurveTo(256, 336, 294, 344);
    ctx.stroke();
  } else if (expression === 'shocked' || expression === 'panic') {
    // Huge white sclera circles + pinprick pupils (O_O)
    for (const x of [leftX, rightX]) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, eyeY, 37, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.stroke();

      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x + (expression === 'panic' ? 4 : 0), eyeY + 2, 8.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // High-arched brows
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(leftX - 30, eyeY - 52);
    ctx.quadraticCurveTo(leftX, eyeY - 72, leftX + 28, eyeY - 52);
    ctx.moveTo(rightX - 28, eyeY - 52);
    ctx.quadraticCurveTo(rightX, eyeY - 72, rightX + 30, eyeY - 52);
    ctx.stroke();

    if (expression === 'panic') {
      // Clenched white grid-teeth oval
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(256, 346, 52, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.stroke();

      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(206, 346);
      ctx.lineTo(306, 346);
      for (const tx of [228, 256, 284]) {
        ctx.moveTo(tx, 322);
        ctx.lineTo(tx, 370);
      }
      ctx.stroke();
    } else {
      // Wide open maroon-black O mouth
      ctx.fillStyle = '#3A0C0C';
      ctx.beginPath();
      ctx.ellipse(256, 348, 32, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.stroke();
    }
  } else if (expression === 'smug') {
    // Upward happy arcs (^_^)
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.arc(leftX, eyeY + 12, 26, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rightX, eyeY + 12, 26, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();

    // Raised playful brows
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(leftX - 26, eyeY - 34);
    ctx.quadraticCurveTo(leftX, eyeY - 52, leftX + 24, eyeY - 34);
    ctx.moveTo(rightX - 24, eyeY - 34);
    ctx.quadraticCurveTo(rightX, eyeY - 52, rightX + 26, eyeY - 34);
    ctx.stroke();

    // Wide D-shaped open laugh mouth (#3A0C0C)
    ctx.fillStyle = '#3A0C0C';
    ctx.beginPath();
    ctx.moveTo(204, 324);
    ctx.lineTo(308, 324);
    ctx.quadraticCurveTo(308, 390, 256, 390);
    ctx.quadraticCurveTo(204, 390, 204, 324);
    ctx.closePath();
    ctx.fill();

    // Tongue
    ctx.fillStyle = '#D95B5B';
    ctx.beginPath();
    ctx.ellipse(256, 374, 24, 12, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(204, 324);
    ctx.lineTo(308, 324);
    ctx.quadraticCurveTo(308, 390, 256, 390);
    ctx.quadraticCurveTo(204, 390, 204, 324);
    ctx.stroke();
  } else if (expression === 'blink') {
    // Tight closed chevron blink (>_< / -_-)
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(leftX - 26, eyeY - 6);
    ctx.lineTo(leftX + 20, eyeY + 4);
    ctx.lineTo(leftX - 26, eyeY + 14);
    ctx.moveTo(rightX + 26, eyeY - 6);
    ctx.lineTo(rightX - 20, eyeY + 4);
    ctx.lineTo(rightX + 26, eyeY + 14);
    ctx.stroke();

    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(228, 344);
    ctx.quadraticCurveTo(256, 336, 284, 346);
    ctx.stroke();
  }

  // Glasses / Monocle overlays
  if (role === 'clerk') {
    ctx.save();
    ctx.strokeStyle = '#2B2420';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(leftX, eyeY, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rightX, eyeY, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(leftX + 44, eyeY - 2);
    ctx.lineTo(rightX - 44, eyeY - 2);
    ctx.stroke();
    ctx.restore();
  } else if (role === 'judge') {
    ctx.save();
    ctx.strokeStyle = '#E6B333';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(rightX, eyeY, 43, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(rightX + 38, eyeY + 20);
    ctx.quadraticCurveTo(rightX + 54, eyeY + 78, rightX + 44, eyeY + 128);
    ctx.stroke();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  textureCache.set(key, tex);
  return tex;
}
