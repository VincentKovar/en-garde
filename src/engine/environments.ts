import * as THREE from 'three';
import type { EnvironmentId } from '../game/types';
import {
  createIceFloorTexture,
  createStoneFlagTexture,
  createWoodPlankTexture,
} from './textures';

export interface BuiltEnvironment {
  group: THREE.Group;
  update: (elapsed: number, dt: number) => void;
  dispose: () => void;
}

export function buildEnvironment(
  envId: EnvironmentId,
  scene: THREE.Scene,
  isSoftwareGl: boolean,
  maxAnisotropy: number,
): BuiltEnvironment {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Clear existing lights on scene? Caller passes fresh environment group + manages scene.fog/background.
  let updateFn: (elapsed: number, dt: number) => void = () => {};

  if (envId === 'castle') {
    scene.background = new THREE.Color(0x9fb8cf);
    scene.fog = new THREE.FogExp2(0xc4b7a3, 0.022);

    const hemi = new THREE.HemisphereLight(0xcbe2ff, 0x6b5a47, 0.95);
    group.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe4b8, 2.2);
    sun.position.set(10, 16, 8);
    if (!isSoftwareGl) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 42;
      sun.shadow.camera.left = -12;
      sun.shadow.camera.right = 12;
      sun.shadow.camera.top = 12;
      sun.shadow.camera.bottom = -12;
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.02;
    }
    group.add(sun);

    const rim = new THREE.DirectionalLight(0x88b3e0, 0.65);
    rim.position.set(-8, 7, -10);
    group.add(rim);

    // Courtyard stone floor extending outward
    const floorTex = createStoneFlagTexture('#8e8578', '#4c463f', 12, 12, maxAnisotropy);
    track(floorTex.map);
    track(floorTex.bumpMap);

    const stoneMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: floorTex.map,
        bumpMap: floorTex.bumpMap,
        bumpScale: 0.04,
        roughness: 0.86,
        metalness: 0.04,
      }),
    );

    const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(75, 75)), stoneMat);
    ground.rotation.x = -Math.PI * 0.5;
    ground.receiveShadow = true;
    group.add(ground);

    // Raised dueling ring dais with stone texture & dark brass ring border
    const daisTex = createStoneFlagTexture('#9c9180', '#544d44', 3, 3, maxAnisotropy);
    track(daisTex.map);
    track(daisTex.bumpMap);
    const daisMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: daisTex.map,
        bumpMap: daisTex.bumpMap,
        bumpScale: 0.03,
        roughness: 0.8,
        metalness: 0.06,
      }),
    );
    const dais = new THREE.Mesh(track(new THREE.CylinderGeometry(3.8, 4.1, 0.14, 32)), daisMat);
    dais.position.set(0, -0.05, -0.8);
    dais.receiveShadow = true;
    group.add(dais);

    const daisRim = new THREE.Mesh(
      track(new THREE.TorusGeometry(3.82, 0.055, 8, 48)),
      track(new THREE.MeshStandardMaterial({ color: 0x73634a, metalness: 0.55, roughness: 0.45 })),
    );
    daisRim.rotation.x = Math.PI * 0.5;
    daisRim.position.set(0, 0.02, -0.8);
    group.add(daisRim);

    // Stone colonnade pillars & battlements via InstancedMesh
    const wallTex = createStoneFlagTexture('#7c7366', '#453e37', 3, 2, maxAnisotropy);
    track(wallTex.map);
    track(wallTex.bumpMap);
    const wallMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: wallTex.map,
        bumpMap: wallTex.bumpMap,
        bumpScale: 0.05,
        roughness: 0.88,
        metalness: 0.02,
      }),
    );

    // Background keep & flanking courtyard walls
    const backWall = new THREE.Mesh(track(new THREE.BoxGeometry(28, 7.5, 1.8)), wallMat);
    backWall.position.set(0, 3.75, -13);
    backWall.receiveShadow = true;
    group.add(backWall);

    const tower = new THREE.Mesh(track(new THREE.CylinderGeometry(2.6, 2.9, 14, 16)), wallMat);
    tower.position.set(-7.5, 7, -14.5);
    tower.castShadow = true;
    group.add(tower);

    const spireRoof = new THREE.Mesh(
      track(new THREE.ConeGeometry(3.0, 4.2, 16)),
      track(new THREE.MeshStandardMaterial({ color: 0x3b4859, roughness: 0.65, metalness: 0.15 })),
    );
    spireRoof.position.set(-7.5, 16.1, -14.5);
    group.add(spireRoof);

    // Crenellations along back wall (InstancedMesh)
    const merlonGeo = track(new THREE.BoxGeometry(1.1, 1.1, 1.9));
    const merlonCount = 12;
    const merlons = new THREE.InstancedMesh(merlonGeo, wallMat, merlonCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < merlonCount; i++) {
      dummy.position.set(-12 + i * 2.2, 8.0, -13);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      merlons.setMatrixAt(i, dummy.matrix);
    }
    merlons.instanceMatrix.needsUpdate = true;
    merlons.computeBoundingSphere();
    group.add(merlons);

    // Flanking stone pillars & crimson heraldic banners
    const bannerMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x8e2424,
        roughness: 0.88,
        side: THREE.DoubleSide,
      }),
    );
    const goldMat = track(
      new THREE.MeshStandardMaterial({ color: 0xd4a34a, metalness: 0.8, roughness: 0.28 }),
    );
    const pillarGeo = track(new THREE.CylinderGeometry(0.42, 0.5, 5.2, 12));
    const bannerGeo = track(new THREE.PlaneGeometry(0.95, 2.8, 1, 6));

    const banners: THREE.Mesh[] = [];
    [-5.6, 5.6].forEach((x) => {
      [-3.5, -8.5].forEach((z) => {
        const pillar = new THREE.Mesh(pillarGeo, wallMat);
        pillar.position.set(x, 2.6, z);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        group.add(pillar);

        const banner = new THREE.Mesh(bannerGeo, bannerMat);
        banner.position.set(x > 0 ? x - 0.52 : x + 0.52, 3.0, z);
        banner.rotation.y = x > 0 ? -Math.PI * 0.5 : Math.PI * 0.5;
        group.add(banner);
        banners.push(banner);

        const finial = new THREE.Mesh(track(new THREE.SphereGeometry(0.22, 10, 10)), goldMat);
        finial.position.set(x, 5.4, z);
        group.add(finial);
      });
    });

    // Weapon rack vignette on left with leaning steel blades
    const woodMat = track(
      new THREE.MeshStandardMaterial({ color: 0x523926, roughness: 0.85, metalness: 0.05 }),
    );
    const rackSteelMat = track(
      new THREE.MeshStandardMaterial({ color: 0xbac4cf, metalness: 0.88, roughness: 0.25 }),
    );
    const rackGroup = new THREE.Group();
    rackGroup.position.set(-4.2, 0, -5.2);
    rackGroup.rotation.y = 0.45;
    [-0.6, 0.6].forEach((px) => {
      const post = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 1.5, 0.12)), woodMat);
      post.position.set(px, 0.75, 0);
      rackGroup.add(post);
    });
    const crossbar = new THREE.Mesh(track(new THREE.BoxGeometry(1.4, 0.1, 0.1)), woodMat);
    crossbar.position.set(0, 1.15, 0);
    rackGroup.add(crossbar);
    [-0.28, 0.22].forEach((sx) => {
      const blade = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 1.28, 0.02)), rackSteelMat);
      blade.position.set(sx, 0.64, 0.12);
      blade.rotation.x = -0.18;
      rackGroup.add(blade);
      const guard = new THREE.Mesh(track(new THREE.BoxGeometry(0.22, 0.03, 0.03)), goldMat);
      guard.position.set(sx, 1.05, 0.05);
      guard.rotation.x = -0.18;
      rackGroup.add(guard);
    });
    group.add(rackGroup);

    updateFn = (elapsed) => {
      banners.forEach((b, idx) => {
        b.rotation.z = Math.sin(elapsed * 2.1 + idx) * 0.06;
      });
    };
  } else if (envId === 'pirate_ship') {
    scene.background = new THREE.Color(0x2b3e52);
    scene.fog = new THREE.FogExp2(0x3a4e63, 0.025);

    const hemi = new THREE.HemisphereLight(0x7aa0c4, 0x261d17, 0.85);
    group.add(hemi);

    const moonSun = new THREE.DirectionalLight(0xffcb8c, 1.85);
    moonSun.position.set(-10, 14, 9);
    if (!isSoftwareGl) {
      moonSun.castShadow = true;
      moonSun.shadow.mapSize.set(1024, 1024);
      moonSun.shadow.camera.near = 1;
      moonSun.shadow.camera.far = 40;
      moonSun.shadow.camera.left = -12;
      moonSun.shadow.camera.right = 12;
      moonSun.shadow.camera.top = 12;
      moonSun.shadow.camera.bottom = -12;
      moonSun.shadow.bias = -0.0005;
    }
    group.add(moonSun);

    const lanternLight = new THREE.PointLight(0xff9933, 4.5, 16, 1.6);
    lanternLight.position.set(2.5, 3.2, -3.2);
    group.add(lanternLight);

    // Surrounding ocean plane (stays level while ship rocks!)
    const oceanMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x163246,
        roughness: 0.25,
        metalness: 0.35,
      }),
    );
    const ocean = new THREE.Mesh(track(new THREE.PlaneGeometry(140, 140)), oceanMat);
    ocean.rotation.x = -Math.PI * 0.5;
    ocean.position.y = -1.6;
    group.add(ocean);

    // Ship hull group (gently sways with waves)
    const shipGroup = new THREE.Group();
    group.add(shipGroup);

    const plankTex = createWoodPlankTexture('#6d4b32', '#2b1c12', 6, 10, maxAnisotropy);
    track(plankTex.map);
    track(plankTex.bumpMap);
    const deckMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: plankTex.map,
        bumpMap: plankTex.bumpMap,
        bumpScale: 0.04,
        roughness: 0.82,
        metalness: 0.04,
      }),
    );

    const darkTimberMat = track(
      new THREE.MeshStandardMaterial({ color: 0x3b2719, roughness: 0.86, metalness: 0.05 }),
    );
    const brassMat = track(
      new THREE.MeshStandardMaterial({ color: 0xc9963b, metalness: 0.88, roughness: 0.28 }),
    );
    const sailMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xd9ceb8,
        roughness: 0.92,
        side: THREE.DoubleSide,
      }),
    );

    const deck = new THREE.Mesh(track(new THREE.BoxGeometry(9.6, 0.4, 22)), deckMat);
    deck.position.set(0, -0.2, -2);
    deck.receiveShadow = true;
    shipGroup.add(deck);

    // Raised quarterdeck behind enemy
    const quarterDeck = new THREE.Mesh(track(new THREE.BoxGeometry(9.4, 1.8, 5.5)), darkTimberMat);
    quarterDeck.position.set(0, 0.9, -9.8);
    quarterDeck.receiveShadow = true;
    shipGroup.add(quarterDeck);

    // Gunwales (side railings)
    [-4.6, 4.6].forEach((x) => {
      const rail = new THREE.Mesh(track(new THREE.BoxGeometry(0.45, 1.15, 22)), darkTimberMat);
      rail.position.set(x, 0.55, -2);
      rail.castShadow = true;
      shipGroup.add(rail);
    });

    // Main Mast + Yardarm + Furled Sail
    const mast = new THREE.Mesh(track(new THREE.CylinderGeometry(0.32, 0.44, 13, 14)), darkTimberMat);
    mast.position.set(0, 6.2, -6.2);
    mast.castShadow = true;
    shipGroup.add(mast);

    const yardarm = new THREE.Mesh(track(new THREE.CylinderGeometry(0.14, 0.14, 10.5, 10)), darkTimberMat);
    yardarm.rotation.z = Math.PI * 0.5;
    yardarm.position.set(0, 7.6, -5.8);
    shipGroup.add(yardarm);

    const sail = new THREE.Mesh(track(new THREE.PlaneGeometry(9.2, 4.4, 8, 4)), sailMat);
    sail.position.set(0, 5.3, -5.4);
    sail.rotation.x = 0.08;
    shipGroup.add(sail);

    // Brass cannons along gunwales
    const barrelGeo = track(new THREE.CylinderGeometry(0.16, 0.22, 1.5, 12));
    [-3.7, 3.7].forEach((x) => {
      [-1.5, -4.5].forEach((z) => {
        const cannon = new THREE.Mesh(barrelGeo, brassMat);
        cannon.rotation.z = x < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        cannon.position.set(x, 0.65, z);
        cannon.castShadow = true;
        shipGroup.add(cannon);
      });
    });

    // Barrels & rope vignette
    const barrelMesh = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.36, 0.34, 0.9, 12)),
      darkTimberMat,
    );
    barrelMesh.position.set(-3.3, 0.45, -5.5);
    shipGroup.add(barrelMesh);

    updateFn = (elapsed) => {
      shipGroup.rotation.z = Math.sin(elapsed * 1.1) * 0.028;
      shipGroup.rotation.x = Math.cos(elapsed * 0.85) * 0.015;
      sail.scale.z = 1 + Math.sin(elapsed * 2.2) * 0.1;
    };
  } else if (envId === 'medieval_street') {
    scene.background = new THREE.Color(0x1b2133);
    scene.fog = new THREE.FogExp2(0x282d42, 0.032);

    const hemi = new THREE.HemisphereLight(0x52658f, 0x261f1a, 0.85);
    group.add(hemi);

    const moonLight = new THREE.DirectionalLight(0x9fb8ff, 1.1);
    moonLight.position.set(6, 15, 7);
    if (!isSoftwareGl) {
      moonLight.castShadow = true;
      moonLight.shadow.mapSize.set(1024, 1024);
      moonLight.shadow.camera.near = 1;
      moonLight.shadow.camera.far = 40;
      moonLight.shadow.camera.left = -10;
      moonLight.shadow.camera.right = 10;
      moonLight.shadow.camera.top = 10;
      moonLight.shadow.camera.bottom = -10;
      moonLight.shadow.bias = -0.0005;
    }
    group.add(moonLight);

    // Warm street lantern lights
    const lanternL = new THREE.PointLight(0xffa94d, 5.5, 14, 1.5);
    lanternL.position.set(-3.2, 3.4, -2.5);
    group.add(lanternL);

    const lanternR = new THREE.PointLight(0xffa94d, 5.0, 14, 1.5);
    lanternR.position.set(3.2, 3.4, -5.5);
    group.add(lanternR);

    const cobbleTex = createStoneFlagTexture('#5c5854', '#262321', 10, 14, maxAnisotropy);
    track(cobbleTex.map);
    track(cobbleTex.bumpMap);
    const streetMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: cobbleTex.map,
        bumpMap: cobbleTex.bumpMap,
        bumpScale: 0.05,
        roughness: 0.8,
        metalness: 0.08,
      }),
    );

    const street = new THREE.Mesh(track(new THREE.PlaneGeometry(50, 60)), streetMat);
    street.rotation.x = -Math.PI * 0.5;
    street.receiveShadow = true;
    group.add(street);

    // Timber-framed medieval townhouses flanking the alley
    const plasterMat = track(
      new THREE.MeshStandardMaterial({ color: 0x9b8d79, roughness: 0.88, metalness: 0.02 }),
    );
    const timberMat = track(
      new THREE.MeshStandardMaterial({ color: 0x332218, roughness: 0.84, metalness: 0.06 }),
    );
    const windowGlowMat = track(
      new THREE.MeshBasicMaterial({ color: 0xffc66d }),
    );
    const roofMat = track(
      new THREE.MeshStandardMaterial({ color: 0x363b47, roughness: 0.78 }),
    );

    const housePositions = [
      { x: -6.2, z: -2.0, rotY: Math.PI * 0.5 },
      { x: -6.2, z: -8.5, rotY: Math.PI * 0.5 },
      { x: 6.2, z: -2.0, rotY: -Math.PI * 0.5 },
      { x: 6.2, z: -8.5, rotY: -Math.PI * 0.5 },
    ];

    housePositions.forEach((hp) => {
      const house = new THREE.Group();
      house.position.set(hp.x, 0, hp.z);
      house.rotation.y = hp.rotY;

      const lower = new THREE.Mesh(track(new THREE.BoxGeometry(5.6, 3.4, 3.8)), plasterMat);
      lower.position.y = 1.7;
      lower.receiveShadow = true;
      house.add(lower);

      // Overhanging Tudor upper story
      const upper = new THREE.Mesh(track(new THREE.BoxGeometry(5.8, 3.2, 4.3)), plasterMat);
      upper.position.set(0, 4.9, 0.25);
      house.add(upper);

      const beam = new THREE.Mesh(track(new THREE.BoxGeometry(5.9, 0.25, 4.4)), timberMat);
      beam.position.set(0, 3.35, 0.25);
      house.add(beam);

      const roof = new THREE.Mesh(track(new THREE.ConeGeometry(4.6, 2.8, 4)), roofMat);
      roof.position.set(0, 7.8, 0.25);
      roof.rotation.y = Math.PI * 0.25;
      house.add(roof);

      // Glowing mullioned window
      const win = new THREE.Mesh(track(new THREE.BoxGeometry(1.1, 1.3, 0.1)), windowGlowMat);
      win.position.set(0, 4.8, 2.41);
      house.add(win);

      group.add(house);
    });

    // Distant stone archway landmark framing the alley end
    const archMat = track(
      new THREE.MeshStandardMaterial({ color: 0x57524c, roughness: 0.85 }),
    );
    [-2.4, 2.4].forEach((px) => {
      const col = new THREE.Mesh(track(new THREE.BoxGeometry(1.4, 6.2, 1.4)), archMat);
      col.position.set(px, 3.1, -15);
      group.add(col);
    });
    const lintel = new THREE.Mesh(track(new THREE.BoxGeometry(6.8, 1.6, 1.5)), archMat);
    lintel.position.set(0, 6.8, -15);
    group.add(lintel);

    // Street lantern globes
    const lanternGlassMat = track(new THREE.MeshBasicMaterial({ color: 0xffc164 }));
    [
      [-3.5, 3.4, -2.5],
      [3.5, 3.4, -5.5],
    ].forEach(([lx, ly, lz]) => {
      const globe = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.22, 0)), lanternGlassMat);
      globe.position.set(lx, ly, lz);
      group.add(globe);
    });

    updateFn = (elapsed) => {
      lanternL.intensity = 5.2 + Math.sin(elapsed * 7.3) * 0.45;
      lanternR.intensity = 4.8 + Math.cos(elapsed * 6.1) * 0.45;
    };
  } else {
    // icy_caverns
    scene.background = new THREE.Color(0x102336);
    scene.fog = new THREE.FogExp2(0x1b3852, 0.026);

    const hemi = new THREE.HemisphereLight(0x7be0ff, 0x182636, 0.95);
    group.add(hemi);

    const frostSun = new THREE.DirectionalLight(0xc2f0ff, 1.9);
    frostSun.position.set(8, 16, 8);
    if (!isSoftwareGl) {
      frostSun.castShadow = true;
      frostSun.shadow.mapSize.set(1024, 1024);
      frostSun.shadow.camera.near = 1;
      frostSun.shadow.camera.far = 40;
      frostSun.shadow.camera.left = -12;
      frostSun.shadow.camera.right = 12;
      frostSun.shadow.camera.top = 12;
      frostSun.shadow.camera.bottom = -12;
      frostSun.shadow.bias = -0.0005;
    }
    group.add(frostSun);

    // Warm brazier contrast light
    const brazierLight = new THREE.PointLight(0xff7733, 4.0, 15, 1.6);
    brazierLight.position.set(-3.4, 1.8, -3.8);
    group.add(brazierLight);

    const iceTex = createIceFloorTexture(8, 8, maxAnisotropy);
    track(iceTex.map);
    track(iceTex.bumpMap);

    const iceFloorMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: iceTex.map,
        bumpMap: iceTex.bumpMap,
        bumpScale: 0.03,
        roughness: 0.18,
        metalness: 0.12,
        clearcoat: 0.75,
        clearcoatRoughness: 0.12,
      }),
    );

    const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(75, 75)), iceFloorMat);
    floor.rotation.x = -Math.PI * 0.5;
    floor.receiveShadow = true;
    group.add(floor);

    // Crystalline ice pillars & stalagmites via InstancedMesh
    const crystalMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0x76d6f5,
        emissive: 0x124766,
        emissiveIntensity: 0.45,
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: 0.88,
      }),
    );

    const spireGeo = track(new THREE.ConeGeometry(0.7, 5.2, 6));
    const spireCount = 26;
    const spires = new THREE.InstancedMesh(spireGeo, crystalMat, spireCount);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();

    for (let i = 0; i < spireCount; i++) {
      const angle = (i / spireCount) * Math.PI * 2;
      const radius = 6.5 + (i % 3) * 2.8;
      const scaleH = 0.7 + (i % 5) * 0.35;
      dummy.position.set(Math.cos(angle) * radius, 2.2 * scaleH - 0.3, Math.sin(angle) * radius - 3.5);
      dummy.rotation.set((i % 3 - 1) * 0.14, angle, (i % 2 - 0.5) * 0.15);
      dummy.scale.set(0.8 + (i % 3) * 0.25, scaleH, 0.8 + (i % 3) * 0.25);
      dummy.updateMatrix();
      spires.setMatrixAt(i, dummy.matrix);

      tint.setHSL(0.54 + (i % 4) * 0.02, 0.75, 0.65);
      spires.setColorAt(i, tint);
    }
    spires.instanceMatrix.needsUpdate = true;
    if (spires.instanceColor) spires.instanceColor.needsUpdate = true;
    spires.computeBoundingSphere();
    group.add(spires);

    // Overhead icicles
    const icicleGeo = track(new THREE.ConeGeometry(0.32, 2.6, 5));
    const icicles = new THREE.InstancedMesh(icicleGeo, crystalMat, 22);
    for (let i = 0; i < 22; i++) {
      const x = -9 + (i % 11) * 1.8;
      const z = -11 + Math.floor(i / 11) * 6.5;
      dummy.position.set(x, 6.8, z);
      dummy.rotation.set(Math.PI, i * 0.4, 0);
      dummy.scale.setScalar(0.85 + (i % 3) * 0.3);
      dummy.updateMatrix();
      icicles.setMatrixAt(i, dummy.matrix);
    }
    icicles.instanceMatrix.needsUpdate = true;
    icicles.computeBoundingSphere();
    group.add(icicles);

    // Glowing iron brazier on left
    const ironMat = track(
      new THREE.MeshStandardMaterial({ color: 0x222933, metalness: 0.8, roughness: 0.4 }),
    );
    const brazierBowl = new THREE.Mesh(track(new THREE.CylinderGeometry(0.45, 0.22, 1.1, 8)), ironMat);
    brazierBowl.position.set(-3.4, 0.55, -3.8);
    group.add(brazierBowl);

    const ember = new THREE.Mesh(
      track(new THREE.DodecahedronGeometry(0.28, 0)),
      track(new THREE.MeshBasicMaterial({ color: 0xff8b38 })),
    );
    ember.position.set(-3.4, 1.15, -3.8);
    group.add(ember);

    updateFn = (elapsed) => {
      brazierLight.intensity = 3.8 + Math.sin(elapsed * 8.4) * 0.55;
      ember.scale.setScalar(0.92 + Math.sin(elapsed * 9.5) * 0.1);
    };
  }

  scene.add(group);

  return {
    group,
    update: updateFn,
    dispose: () => {
      scene.remove(group);
      disposables.forEach((d) => d.dispose());
    },
  };
}
