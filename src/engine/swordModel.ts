import * as THREE from 'three';
import type { EnvironmentId } from '../game/types';

export interface WeaponMaterials {
  steel: THREE.MeshPhysicalMaterial;
  hilt: THREE.MeshStandardMaterial;
  leather: THREE.MeshStandardMaterial;
}

function createDiamondBladeGeometry(length: number, baseWidth: number, thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-baseWidth * 0.5, 0);
  shape.lineTo(baseWidth * 0.5, 0);
  shape.lineTo(baseWidth * 0.24, length * 0.78);
  shape.lineTo(0, length);
  shape.lineTo(-baseWidth * 0.24, length * 0.78);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.45,
    bevelSize: baseWidth * 0.09,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -thickness * 0.5);
  geo.computeVertexNormals();
  return geo;
}

function createCurvedCutlassGeometry(length: number, width: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.45, 0);
  shape.lineTo(width * 0.45, 0);
  shape.quadraticCurveTo(width * 0.7, length * 0.55, width * 0.2, length * 0.92);
  shape.lineTo(-width * 0.35, length);
  shape.quadraticCurveTo(width * 0.05, length * 0.52, -width * 0.45, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -0.006);
  geo.computeVertexNormals();
  return geo;
}

export function buildPlayerRapierRig(): THREE.Group {
  const rig = new THREE.Group();

  const steelMat = new THREE.MeshPhysicalMaterial({
    color: 0xe3e8ef,
    metalness: 0.95,
    roughness: 0.16,
    anisotropy: 0.8,
    clearcoat: 0.25,
    clearcoatRoughness: 0.15,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc99c46,
    metalness: 0.88,
    roughness: 0.28,
  });

  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x2b1d16,
    metalness: 0.05,
    roughness: 0.82,
  });

  const cuffMat = new THREE.MeshStandardMaterial({
    color: 0x3b2a22,
    metalness: 0.08,
    roughness: 0.74,
  });

  // 1. Forearm & flared duelist gauntlet cuff
  const forearm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.045, 0.21, 16),
    cuffMat,
  );
  forearm.rotation.x = Math.PI * 0.5;
  forearm.position.set(0, -0.01, 0.175);
  rig.add(forearm);

  const cuffRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.046, 0.007, 10, 20),
    brassMat,
  );
  cuffRim.position.set(0, -0.01, 0.27);
  rig.add(cuffRim);

  // 2. Gloved hand knuckles & thumb
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.068, 0.095), leatherMat);
  palm.position.set(0, 0, 0.04);
  rig.add(palm);

  // 3. Fluted Lathe pommel
  const pommelPoints = [
    new THREE.Vector2(0.001, -0.065),
    new THREE.Vector2(0.024, -0.045),
    new THREE.Vector2(0.028, -0.022),
    new THREE.Vector2(0.016, 0.0),
    new THREE.Vector2(0.001, 0.0),
  ];
  const pommel = new THREE.Mesh(new THREE.LatheGeometry(pommelPoints, 18), brassMat);
  pommel.rotation.x = Math.PI * 0.5;
  pommel.position.set(0, 0, 0.11);
  rig.add(pommel);

  // 4. Wire-wrapped grip
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.13, 14), leatherMat);
  grip.rotation.x = Math.PI * 0.5;
  grip.position.set(0, 0, 0.045);
  rig.add(grip);

  // 5. Crossguard quillons + swept knuckle bow (TubeGeometry)
  const quillonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.11, 0.01, -0.02),
    new THREE.Vector3(-0.04, 0.0, -0.025),
    new THREE.Vector3(0.04, 0.0, -0.025),
    new THREE.Vector3(0.11, -0.01, -0.02),
  ]);
  const quillons = new THREE.Mesh(new THREE.TubeGeometry(quillonCurve, 20, 0.009, 10, false), brassMat);
  rig.add(quillons);

  const knuckleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.015, -0.025),
    new THREE.Vector3(0.015, 0.068, 0.015),
    new THREE.Vector3(0.008, 0.06, 0.085),
    new THREE.Vector3(0, 0.015, 0.105),
  ]);
  const knuckleBow = new THREE.Mesh(new THREE.TubeGeometry(knuckleCurve, 22, 0.007, 10, false), brassMat);
  rig.add(knuckleBow);

  // 6. Protective cup shell
  const cup = new THREE.Mesh(
    new THREE.SphereGeometry(0.068, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.42),
    brassMat,
  );
  cup.rotation.x = -Math.PI * 0.5;
  cup.position.set(0, 0, -0.018);
  rig.add(cup);

  // 7. Tapered Rapier Blade extending forward along -Z
  const bladeGeo = createDiamondBladeGeometry(0.96, 0.036, 0.01);
  bladeGeo.rotateX(-Math.PI * 0.5);
  const blade = new THREE.Mesh(bladeGeo, steelMat);
  blade.position.set(0, 0, -0.03);
  blade.castShadow = true;
  rig.add(blade);

  // 8. Central fuller ridge accent
  const fuller = new THREE.Mesh(
    new THREE.BoxGeometry(0.006, 0.013, 0.62),
    new THREE.MeshStandardMaterial({ color: 0x8e99a8, metalness: 0.9, roughness: 0.35 }),
  );
  fuller.position.set(0, 0, -0.35);
  rig.add(fuller);

  return rig;
}

export function buildEnemyWeapon(
  env: EnvironmentId,
  bladeHex: string,
  hiltHex: string,
): THREE.Group {
  const weapon = new THREE.Group();

  const bladeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(bladeHex),
    metalness: 0.94,
    roughness: 0.18,
    anisotropy: 0.75,
  });

  const hiltMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(hiltHex),
    metalness: 0.82,
    roughness: 0.32,
  });

  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x241812,
    metalness: 0.05,
    roughness: 0.85,
  });

  // Pommel
  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.028, 1), hiltMat);
  pommel.position.set(0, -0.14, 0);
  weapon.add(pommel);

  // Grip
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.14, 12), gripMat);
  grip.position.set(0, -0.06, 0);
  weapon.add(grip);

  // Guard & Blade tailored by environment/enemy style
  if (env === 'pirate_ship') {
    // Curved cutlass + brass hand guard
    const guardCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.01, -0.05),
      new THREE.Vector3(0.045, -0.03, -0.06),
      new THREE.Vector3(0.04, -0.1, -0.03),
      new THREE.Vector3(0, -0.13, 0),
    ]);
    weapon.add(new THREE.Mesh(new THREE.TubeGeometry(guardCurve, 16, 0.008, 8, false), hiltMat));
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.016, 0.12), hiltMat);
    cross.position.set(0, 0.01, 0);
    weapon.add(cross);

    const blade = new THREE.Mesh(createCurvedCutlassGeometry(0.84, 0.075), bladeMat);
    blade.rotation.y = Math.PI * 0.5;
    blade.position.set(0, 0.015, 0);
    blade.castShadow = true;
    weapon.add(blade);
  } else if (env === 'medieval_street') {
    // Gilded swept-hilt rapier
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.007, 10, 20), hiltMat);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.set(0, 0.015, 0);
    weapon.add(ring);

    const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 10), hiltMat);
    cross.rotation.z = Math.PI * 0.5;
    cross.position.set(0, 0.01, 0);
    weapon.add(cross);

    const blade = new THREE.Mesh(createDiamondBladeGeometry(1.02, 0.034, 0.01), bladeMat);
    blade.position.set(0, 0.02, 0);
    blade.castShadow = true;
    weapon.add(blade);
  } else if (env === 'icy_caverns') {
    // Runed Frost Estoc
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.024, 0.032), hiltMat);
    cross.position.set(0, 0.01, 0);
    weapon.add(cross);

    const runeCore = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.72, 0.016),
      new THREE.MeshStandardMaterial({
        color: 0x7de4ff,
        emissive: 0x35b8e8,
        emissiveIntensity: 0.7,
        roughness: 0.25,
      }),
    );
    runeCore.position.set(0, 0.39, 0);
    weapon.add(runeCore);

    const blade = new THREE.Mesh(createDiamondBladeGeometry(1.06, 0.054, 0.014), bladeMat);
    blade.position.set(0, 0.02, 0);
    blade.castShadow = true;
    weapon.add(blade);
  } else {
    // Castle Knight Arming Sword
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.022, 0.03), hiltMat);
    cross.position.set(0, 0.01, 0);
    weapon.add(cross);

    const blade = new THREE.Mesh(createDiamondBladeGeometry(0.95, 0.056, 0.013), bladeMat);
    blade.position.set(0, 0.02, 0);
    blade.castShadow = true;
    weapon.add(blade);
  }

  return weapon;
}
