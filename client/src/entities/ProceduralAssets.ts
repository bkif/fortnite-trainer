import * as THREE from 'three';
import type { WeaponType } from '../../../shared/protocol';

function makeCanvas(w = 128, h = 128): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createMetalPBRTextures(baseHex: string, scratchAlpha = 0.18): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  metalnessMap: THREE.CanvasTexture;
} {
  const [cMap, ctxMap] = makeCanvas();
  ctxMap.fillStyle = baseHex;
  ctxMap.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 180; i++) {
    ctxMap.fillStyle = `rgba(255,255,255,${Math.random() * scratchAlpha})`;
    ctxMap.fillRect(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 18, 1);
  }

  const [cRough, ctxRough] = makeCanvas();
  ctxRough.fillStyle = '#555555';
  ctxRough.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 120; i++) {
    const v = 60 + Math.floor(Math.random() * 90);
    ctxRough.fillStyle = `rgb(${v},${v},${v})`;
    ctxRough.fillRect(Math.random() * 128, Math.random() * 128, 6, 2);
  }

  const [cMetal, ctxMetal] = makeCanvas();
  ctxMetal.fillStyle = '#dcdcdc';
  ctxMetal.fillRect(0, 0, 128, 128);

  const map = new THREE.CanvasTexture(cMap);
  const roughnessMap = new THREE.CanvasTexture(cRough);
  const metalnessMap = new THREE.CanvasTexture(cMetal);
  return { map, roughnessMap, metalnessMap };
}

export function createPolymerWoodTexture(baseHex: string, grainHex: string): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas();
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = grainHex;
  for (let y = 0; y < 128; y += 6) {
    ctx.fillRect(0, y, 128, 2);
  }
  return new THREE.CanvasTexture(canvas);
}

export function createArenaGridTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
  ctx.lineWidth = 1;
  for (let i = 64; i < 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(32, 32);
  return tex;
}

export function createPumpShotgunMesh(): THREE.Group {
  const group = new THREE.Group();
  const metal = createMetalPBRTextures('#334155', 0.22);
  const gunmetalMat = new THREE.MeshStandardMaterial({
    map: metal.map,
    roughnessMap: metal.roughnessMap,
    metalnessMap: metal.metalnessMap,
    roughness: 0.45,
    metalness: 0.8,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: createPolymerWoodTexture('#78350f', '#451a03'),
    roughness: 0.72,
    metalness: 0.08,
  });

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.36), gunmetalMat);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.62, 10), gunmetalMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.04, -0.45);

  const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), gunmetalMat);
  magTube.rotation.x = Math.PI / 2;
  magTube.position.set(0, -0.01, -0.39);

  const pumpGrip = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.075, 0.22), woodMat);
  pumpGrip.position.set(0, -0.015, -0.38);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.28), woodMat);
  stock.position.set(0, -0.03, 0.28);
  stock.rotation.x = 0.12;

  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, 0.02), gunmetalMat);
  frontSight.position.set(0, 0.075, -0.72);

  group.add(receiver, barrel, magTube, pumpGrip, stock, frontSight);
  return group;
}

export function createAssaultRifleMesh(): THREE.Group {
  const group = new THREE.Group();
  const metal = createMetalPBRTextures('#1e293b', 0.18);
  const gunmetalMat = new THREE.MeshStandardMaterial({
    map: metal.map,
    roughnessMap: metal.roughnessMap,
    metalnessMap: metal.metalnessMap,
    roughness: 0.4,
    metalness: 0.85,
  });
  const polymerMat = new THREE.MeshStandardMaterial({
    map: createPolymerWoodTexture('#0f172a', '#334155'),
    roughness: 0.65,
    metalness: 0.15,
  });

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.42), gunmetalMat);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.48, 8), gunmetalMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.025, -0.42);

  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.085, 0.28), polymerMat);
  handguard.position.set(0, 0.02, -0.31);

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.2, 0.09), polymerMat);
  mag.position.set(0, -0.14, -0.06);
  mag.rotation.x = -0.18;

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.26), polymerMat);
  stock.position.set(0, -0.01, 0.31);

  const optic = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.12), gunmetalMat);
  optic.position.set(0, 0.09, 0.02);

  group.add(receiver, barrel, handguard, mag, stock, optic);
  return group;
}

export function createPickaxeMesh(): THREE.Group {
  const group = new THREE.Group();
  const metal = createMetalPBRTextures('#94a3b8', 0.25);
  const bladeMat = new THREE.MeshStandardMaterial({
    map: metal.map,
    roughnessMap: metal.roughnessMap,
    metalnessMap: metal.metalnessMap,
    roughness: 0.28,
    metalness: 0.9,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    map: createPolymerWoodTexture('#b45309', '#78350f'),
    roughness: 0.8,
    metalness: 0.05,
  });

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.92, 8), gripMat);
  shaft.position.y = 0.25;

  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.26, 8), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }));
  wrap.position.y = -0.04;

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.11), bladeMat);
  collar.position.y = 0.68;

  const leftBlade = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.28, 4), bladeMat);
  leftBlade.rotation.z = Math.PI / 2 + 0.2;
  leftBlade.position.set(-0.16, 0.65, 0);

  const rightBlade = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.28, 4), bladeMat);
  rightBlade.rotation.z = -Math.PI / 2 - 0.2;
  rightBlade.position.set(0.16, 0.65, 0);

  group.add(shaft, wrap, collar, leftBlade, rightBlade);
  return group;
}

export interface CharacterRig {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Group;
  weaponSocket: THREE.Group;
  weaponMeshes: Record<WeaponType, THREE.Group>;
}

export function createCharacterRig(primaryColor: number): CharacterRig {
  const group = new THREE.Group();

  const suitMat = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.6, flatShading: true });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, flatShading: true });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.55, flatShading: true });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.9 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.5 });

  // Torso + Tactical Vest
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.68, 0.32), suitMat);
  torso.position.y = 1.12;
  torso.castShadow = true;

  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.44, 0.36), vestMat);
  vest.position.y = 1.16;
  vest.castShadow = true;

  // Head + Visor + Headband
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.08), visorMat);
  visor.position.set(0, 1.74, -0.18);

  const headband = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.4), bandMat);
  headband.position.set(0, 1.84, 0);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.22, 0.72, 0.24);
  const leftLeg = new THREE.Mesh(legGeo, vestMat);
  leftLeg.position.set(-0.15, 0.38, 0);
  leftLeg.castShadow = true;

  const rightLeg = new THREE.Mesh(legGeo, vestMat);
  rightLeg.position.set(0.15, 0.38, 0);
  rightLeg.castShadow = true;

  // Arms
  const armGeo = new THREE.BoxGeometry(0.18, 0.58, 0.18);
  const leftArm = new THREE.Mesh(armGeo, suitMat);
  leftArm.position.set(-0.39, 1.12, -0.08);
  leftArm.rotation.x = -0.35;
  leftArm.castShadow = true;

  const rightArm = new THREE.Group();
  rightArm.position.set(0.39, 1.32, 0);
  const rightArmMesh = new THREE.Mesh(armGeo, suitMat);
  rightArmMesh.position.set(0, -0.2, -0.12);
  rightArmMesh.rotation.x = -Math.PI / 2.4;
  rightArmMesh.castShadow = true;
  rightArm.add(rightArmMesh);

  const weaponSocket = new THREE.Group();
  weaponSocket.position.set(0, -0.25, -0.42);
  rightArm.add(weaponSocket);

  const weaponMeshes: Record<WeaponType, THREE.Group> = {
    pickaxe: createPickaxeMesh(),
    ar: createAssaultRifleMesh(),
    shotgun: createPumpShotgunMesh(),
  };

  for (const key of Object.keys(weaponMeshes) as WeaponType[]) {
    weaponMeshes[key].visible = key === 'ar';
    weaponSocket.add(weaponMeshes[key]);
  }

  group.add(torso, vest, head, visor, headband, leftLeg, rightLeg, leftArm, rightArm);

  return { group, leftLeg, rightLeg, leftArm, rightArm, weaponSocket, weaponMeshes };
}
