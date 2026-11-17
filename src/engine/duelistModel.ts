import * as THREE from 'three';
import type { LevelConfig, StrikeZone } from '../game/types';
import { buildEnemyWeapon } from './swordModel';
import { createContactShadowTexture } from './textures';

export interface DuelistRig {
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  weaponPivot: THREE.Group;
  cape: THREE.Mesh;
  hitMeshes: THREE.Mesh[];
  zoneTargets: THREE.Mesh[];
  zoneRings: Record<StrikeZone, THREE.Mesh>;
  flashMaterials: THREE.MeshStandardMaterial[];
  baseColors: Map<THREE.MeshStandardMaterial, THREE.Color>;
  dispose: () => void;
}

const ZONE_POSITIONS: Record<
  StrikeZone,
  { pos: [number, number, number]; size: [number, number, number]; ringRadius: number }
> = {
  head: { pos: [0, 1.62, 0.06], size: [0.34, 0.34, 0.34], ringRadius: 0.16 },
  chest: { pos: [0, 1.24, 0.14], size: [0.34, 0.32, 0.3], ringRadius: 0.17 },
  left_shoulder: { pos: [-0.26, 1.34, 0.08], size: [0.28, 0.28, 0.3], ringRadius: 0.13 },
  right_shoulder: { pos: [0.26, 1.34, 0.08], size: [0.28, 0.28, 0.3], ringRadius: 0.13 },
  left_hip: { pos: [-0.22, 0.96, 0.1], size: [0.28, 0.3, 0.3], ringRadius: 0.13 },
  right_hip: { pos: [0.22, 0.96, 0.1], size: [0.28, 0.3, 0.3], ringRadius: 0.13 },
};

export function buildDuelistModel(level: LevelConfig): DuelistRig {
  const root = new THREE.Group();

  const primaryMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(level.palette.armorPrimary),
    metalness: level.environment === 'castle' || level.environment === 'icy_caverns' ? 0.72 : 0.18,
    roughness: level.environment === 'castle' || level.environment === 'icy_caverns' ? 0.32 : 0.68,
  });

  const secondaryMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(level.palette.armorSecondary),
    metalness: 0.68,
    roughness: 0.34,
  });

  const clothMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(level.palette.clothAccent),
    metalness: 0.04,
    roughness: 0.84,
    side: THREE.DoubleSide,
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xc99c7c,
    metalness: 0.02,
    roughness: 0.72,
  });

  const darkBootMat = new THREE.MeshStandardMaterial({
    color: 0x1c1714,
    metalness: 0.1,
    roughness: 0.78,
  });

  const flashMaterials = [primaryMat, secondaryMat, clothMat, skinMat];
  const baseColors = new Map<THREE.MeshStandardMaterial, THREE.Color>();
  flashMaterials.forEach((m) => baseColors.set(m, m.color.clone()));

  // Grounded contact shadow disc
  const shadowTex = createContactShadowTexture();
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.65, 24),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  shadowDisc.rotation.x = -Math.PI * 0.5;
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  // Pelvis / Hips grounded via legs
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.92, 0);
  root.add(pelvis);

  // Fencing stance legs (grounded to y=0)
  const buildLeg = (xOffset: number, zOffset: number, rotX: number) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(xOffset, 0, zOffset);
    legGroup.rotation.x = rotX;

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.32, 6, 12), darkBootMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    legGroup.add(thigh);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.056, 0.42, 12), secondaryMat);
    shin.position.y = -0.62;
    shin.castShadow = true;
    legGroup.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.24), darkBootMat);
    boot.position.set(0, -0.86, 0.04);
    boot.castShadow = true;
    legGroup.add(boot);

    return legGroup;
  };

  pelvis.add(buildLeg(-0.15, 0.12, -0.06));
  pelvis.add(buildLeg(0.15, -0.14, 0.08));

  // Belt & waist sash
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.12, 16), darkBootMat);
  belt.position.y = 0.02;
  belt.castShadow = true;
  pelvis.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.04), secondaryMat);
  buckle.position.set(0, 0.02, 0.19);
  pelvis.add(buckle);

  // Hip tassets bridging legs and waist cleanly
  [-0.14, 0.14].forEach((tx) => {
    const tasset = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.22), secondaryMat);
    tasset.position.set(tx, -0.06, 0.01);
    tasset.castShadow = true;
    pelvis.add(tasset);
  });

  // Articulated Torso
  const torso = new THREE.Group();
  torso.position.set(0, 0.06, 0);
  pelvis.add(torso);

  const chestMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.18, 0.5, 16), primaryMat);
  chestMesh.scale.set(1.14, 1, 0.84);
  chestMesh.position.y = 0.25;
  chestMesh.castShadow = true;
  torso.add(chestMesh);

  // Clean front heraldic breastplate sash (offset clear of chest surface, zero Z-fighting)
  const chestPlaque = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.04), clothMat);
  chestPlaque.position.set(0, 0.25, 0.185);
  chestPlaque.castShadow = true;
  torso.add(chestPlaque);

  // Lower surcoat apron below belt
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.04), clothMat);
  apron.position.set(0, -0.14, 0.17);
  apron.rotation.x = -0.08;
  pelvis.add(apron);

  // Armored gorget collar bridging chest and head
  const gorget = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.185, 0.11, 14), secondaryMat);
  gorget.position.set(0, 0.5, 0.01);
  torso.add(gorget);

  // Cape / Coat tails
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.92, 4, 4), clothMat);
  cape.position.set(0, 0.02, -0.22);
  cape.rotation.x = 0.14;
  cape.castShadow = true;
  torso.add(cape);

  // Head & Character-Specific Helm / Hat
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.54, 0.02);
  torso.add(headGroup);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.082, 0.14, 12), skinMat);
  neck.position.y = 0.05;
  headGroup.add(neck);

  if (level.environment === 'castle') {
    // Knight Sallet Visored Helm + Plume
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 14), primaryMat);
    helm.scale.set(0.95, 1.12, 1.05);
    helm.position.y = 0.16;
    helm.castShadow = true;
    headGroup.add(helm);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.09, 0.16), secondaryMat);
    visor.position.set(0, 0.15, 0.07);
    headGroup.add(visor);

    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.022, 0.03),
      new THREE.MeshBasicMaterial({ color: 0x0a0908 }),
    );
    slit.position.set(0, 0.16, 0.148);
    headGroup.add(slit);

    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 10), clothMat);
    plume.rotation.x = -Math.PI * 0.35;
    plume.position.set(0, 0.31, -0.06);
    headGroup.add(plume);
  } else if (level.environment === 'pirate_ship') {
    // Face + Bandana + Tricorne Hat
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 14), skinMat);
    head.position.y = 0.15;
    head.castShadow = true;
    headGroup.add(head);

    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 10), darkBootMat);
    beard.rotation.x = Math.PI;
    beard.position.set(0, 0.07, 0.07);
    headGroup.add(beard);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.11, 14), darkBootMat);
    crown.position.y = 0.25;
    headGroup.add(crown);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.018, 3), darkBootMat);
    brim.rotation.y = Math.PI;
    brim.position.set(0, 0.22, 0.01);
    headGroup.add(brim);

    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.02, 8, 16), clothMat);
    sash.rotation.x = Math.PI * 0.5;
    sash.position.y = 0.21;
    headGroup.add(sash);
  } else if (level.environment === 'medieval_street') {
    // Masked Duelist + Feathered Cavalier Hat
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 14), skinMat);
    head.position.y = 0.15;
    head.castShadow = true;
    headGroup.add(head);

    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.065, 0.11), darkBootMat);
    mask.position.set(0, 0.16, 0.08);
    headGroup.add(mask);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.016, 18), primaryMat);
    brim.position.set(0, 0.24, 0);
    brim.rotation.z = 0.12;
    headGroup.add(brim);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 14), primaryMat);
    crown.position.set(0, 0.29, 0);
    crown.rotation.z = 0.12;
    headGroup.add(crown);

    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.28, 8), secondaryMat);
    feather.rotation.z = -0.65;
    feather.rotation.x = -0.3;
    feather.position.set(0.15, 0.34, -0.04);
    headGroup.add(feather);
  } else {
    // Horned Frost Warden Helm
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.145, 0.26, 8), primaryMat);
    helm.position.y = 0.17;
    helm.castShadow = true;
    headGroup.add(helm);

    const visorGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.03, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x72e6ff }),
    );
    visorGlow.position.set(0, 0.18, 0.12);
    headGroup.add(visorGlow);

    [-1, 1].forEach((side) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.24, 8), secondaryMat);
      horn.position.set(side * 0.14, 0.3, 0);
      horn.rotation.z = -side * 0.52;
      headGroup.add(horn);
    });
  }

  // Left (off-hand balance) Arm
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-0.26, 0.44, 0);
  torso.add(leftShoulder);

  const lPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), secondaryMat);
  lPauldron.castShadow = true;
  leftShoulder.add(lPauldron);

  const lUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.26, 10), primaryMat);
  lUpper.position.set(-0.02, -0.14, 0);
  leftShoulder.add(lUpper);

  const leftElbow = new THREE.Group();
  leftElbow.position.set(-0.02, -0.27, 0);
  leftShoulder.add(leftElbow);

  const lFore = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.25, 10), darkBootMat);
  lFore.position.set(0, -0.12, 0.04);
  lFore.rotation.x = -0.35;
  leftElbow.add(lFore);

  // Right (Sword) Arm
  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.26, 0.44, 0);
  torso.add(rightShoulder);

  const rPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), secondaryMat);
  rPauldron.castShadow = true;
  rightShoulder.add(rPauldron);

  const rUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.27, 10), primaryMat);
  rUpper.position.set(0.02, -0.14, 0.02);
  rightShoulder.add(rUpper);

  const rightElbow = new THREE.Group();
  rightElbow.position.set(0.02, -0.27, 0.04);
  rightShoulder.add(rightElbow);

  const rFore = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.044, 0.25, 10), darkBootMat);
  rFore.position.set(0, -0.02, 0.12);
  rFore.rotation.x = Math.PI * 0.42;
  rightElbow.add(rFore);

  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0, 0.02, 0.24);
  weaponPivot.rotation.x = Math.PI * 0.36;
  rightElbow.add(weaponPivot);

  const weaponMesh = buildEnemyWeapon(
    level.environment,
    level.palette.bladeMetal,
    level.palette.armorSecondary,
  );
  weaponPivot.add(weaponMesh);

  // 6 Strike Zone Hitboxes (Layer 1) + Subtle Diegetic Target Rings
  const zoneTargets: THREE.Mesh[] = [];
  const zoneRings = {} as Record<StrikeZone, THREE.Mesh>;
  const invisibleMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMeshes: THREE.Mesh[] = [];

  (Object.keys(ZONE_POSITIONS) as StrikeZone[]).forEach((zoneKey) => {
    const cfg = ZONE_POSITIONS[zoneKey];
    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.size[0], cfg.size[1], cfg.size[2]),
      invisibleMat,
    );
    hitBox.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
    hitBox.userData.strikeZone = zoneKey;
    hitBox.layers.set(1);
    root.add(hitBox);
    zoneTargets.push(hitBox);

    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(level.palette.accentHex),
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(cfg.ringRadius * 0.72, cfg.ringRadius, 24),
      ringMat,
    );
    ring.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2] + 0.16);
    root.add(ring);
    zoneRings[zoneKey] = ring;
  });

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).material !== invisibleMat) {
      hitMeshes.push(obj as THREE.Mesh);
    }
  });

  return {
    root,
    pelvis,
    torso,
    headGroup,
    rightShoulder,
    rightElbow,
    leftShoulder,
    leftElbow,
    weaponPivot,
    cape,
    hitMeshes,
    zoneTargets,
    zoneRings,
    flashMaterials,
    baseColors,
    dispose: () => {
      shadowTex.dispose();
      root.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
    },
  };
}
