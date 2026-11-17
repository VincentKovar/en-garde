import * as THREE from 'three';

export interface ProceduralTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

function makeCanvas(size = 512): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createStoneFlagTexture(
  baseHex: string,
  mortarHex: string,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
): ProceduralTextureSet {
  const size = 512;
  const [colorCanvas, cCtx] = makeCanvas(size);
  const [bumpCanvas, bCtx] = makeCanvas(size);

  cCtx.fillStyle = mortarHex;
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#222222';
  bCtx.fillRect(0, 0, size, size);

  const rows = 6;
  const rowH = size / rows;
  const baseColor = new THREE.Color(baseHex);

  for (let r = 0; r < rows; r++) {
    const cols = r % 2 === 0 ? 4 : 5;
    const offset = r % 2 === 0 ? 0 : size / (cols * 2);
    const colW = size / cols;
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const y = r * rowH;
      const shade = 0.86 + Math.random() * 0.24;
      const stoneCol = baseColor.clone().multiplyScalar(shade);

      cCtx.fillStyle = `#${stoneCol.getHexString()}`;
      cCtx.fillRect(x + 4, y + 4, colW - 8, rowH - 8);

      // Subtle mineral speckles
      for (let s = 0; s < 14; s++) {
        const sx = x + 6 + Math.random() * Math.max(4, colW - 14);
        const sy = y + 6 + Math.random() * Math.max(4, rowH - 14);
        cCtx.fillStyle =
          Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.09)';
        cCtx.fillRect(sx, sy, 4 + Math.random() * 6, 3 + Math.random() * 5);
      }

      const bumpVal = Math.floor(175 + Math.random() * 65);
      bCtx.fillStyle = `rgb(${bumpVal},${bumpVal},${bumpVal})`;
      bCtx.fillRect(x + 5, y + 5, colW - 10, rowH - 10);
    }
  }

  return {
    map: configureTexture(colorCanvas, true, repeatX, repeatY, maxAnisotropy),
    bumpMap: configureTexture(bumpCanvas, false, repeatX, repeatY, maxAnisotropy),
  };
}

export function createWoodPlankTexture(
  baseHex: string,
  seamHex: string,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
): ProceduralTextureSet {
  const size = 512;
  const [colorCanvas, cCtx] = makeCanvas(size);
  const [bumpCanvas, bCtx] = makeCanvas(size);

  cCtx.fillStyle = seamHex;
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#1d1d1d';
  bCtx.fillRect(0, 0, size, size);

  const planks = 8;
  const plankW = size / planks;
  const baseColor = new THREE.Color(baseHex);

  for (let p = 0; p < planks; p++) {
    const x = p * plankW;
    const tone = 0.84 + Math.random() * 0.28;
    const col = baseColor.clone().multiplyScalar(tone);
    cCtx.fillStyle = `#${col.getHexString()}`;
    cCtx.fillRect(x + 2, 0, plankW - 4, size);

    const bumpBase = Math.floor(165 + Math.random() * 45);
    bCtx.fillStyle = `rgb(${bumpBase},${bumpBase},${bumpBase})`;
    bCtx.fillRect(x + 3, 0, plankW - 6, size);

    // Wood grain streaks
    for (let g = 0; g < 18; g++) {
      const gx = x + 4 + Math.random() * (plankW - 10);
      cCtx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,235,200,0.06)';
      cCtx.fillRect(gx, 0, 1.5, size);
      bCtx.fillStyle = 'rgba(0,0,0,0.15)';
      bCtx.fillRect(gx, 0, 1.5, size);
    }

    // Plank joints & iron nail heads
    const jointY = ((p * 173) % (size - 80)) + 40;
    cCtx.fillStyle = seamHex;
    cCtx.fillRect(x, jointY, plankW, 3);
    bCtx.fillStyle = '#181818';
    bCtx.fillRect(x, jointY, plankW, 3);

    cCtx.fillStyle = '#201c1a';
    cCtx.beginPath();
    cCtx.arc(x + 10, jointY + 12, 2.5, 0, Math.PI * 2);
    cCtx.arc(x + plankW - 10, jointY + 12, 2.5, 0, Math.PI * 2);
    cCtx.fill();
  }

  return {
    map: configureTexture(colorCanvas, true, repeatX, repeatY, maxAnisotropy),
    bumpMap: configureTexture(bumpCanvas, false, repeatX, repeatY, maxAnisotropy),
  };
}

export function createIceFloorTexture(
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
): ProceduralTextureSet {
  const size = 512;
  const [colorCanvas, cCtx] = makeCanvas(size);
  const [bumpCanvas, bCtx] = makeCanvas(size);

  const grad = cCtx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#78b9d6');
  grad.addColorStop(0.5, '#9cd7ee');
  grad.addColorStop(1, '#5d9ec0');
  cCtx.fillStyle = grad;
  cCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#b4b4b4';
  bCtx.fillRect(0, 0, size, size);

  // Crystalline fracture veins
  for (let i = 0; i < 42; i++) {
    const x1 = Math.random() * size;
    const y1 = Math.random() * size;
    const angle = Math.random() * Math.PI * 2;
    const len = 45 + Math.random() * 140;
    const x2 = x1 + Math.cos(angle) * len;
    const y2 = y1 + Math.sin(angle) * len;

    cCtx.strokeStyle = Math.random() > 0.4 ? 'rgba(235, 250, 255, 0.38)' : 'rgba(26, 68, 99, 0.35)';
    cCtx.lineWidth = 1 + Math.random() * 2;
    cCtx.beginPath();
    cCtx.moveTo(x1, y1);
    cCtx.lineTo(x2, y2);
    cCtx.stroke();

    bCtx.strokeStyle = '#484848';
    bCtx.lineWidth = 1.5;
    bCtx.beginPath();
    bCtx.moveTo(x1, y1);
    bCtx.lineTo(x2, y2);
    bCtx.stroke();
  }

  return {
    map: configureTexture(colorCanvas, true, repeatX, repeatY, maxAnisotropy),
    bumpMap: configureTexture(bumpCanvas, false, repeatX, repeatY, maxAnisotropy),
  };
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const [canvas, ctx] = makeCanvas(size);
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    6,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
