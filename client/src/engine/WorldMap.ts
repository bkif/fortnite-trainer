import * as THREE from 'three';
import type { ResourceType } from '../../../shared/protocol';
import { createSkyboxMaterial, createStormWallMaterial } from '../shaders/customShaders';
import { createArenaGridTexture } from '../entities/ProceduralAssets';

export interface HarvestNode {
  id: number;
  type: ResourceType;
  pos: THREE.Vector3;
  radius: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  instanceIndex: number;
}

export class WorldMap {
  public harvestNodes: HarvestNode[] = [];
  public collidableMeshes: THREE.Object3D[] = [];
  public stormMesh: THREE.Mesh;
  public stormMat: THREE.ShaderMaterial;

  private treeTrunkInst!: THREE.InstancedMesh;
  private treeLeavesInst!: THREE.InstancedMesh;
  private rockInst!: THREE.InstancedMesh;
  private crateInst!: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();

  constructor(private scene: THREE.Scene) {
    this.buildSkybox();
    this.buildLighting();
    this.buildTerrain();
    this.buildArenaCover();
    this.buildHarvestables();

    this.stormMat = createStormWallMaterial();
    const stormGeo = new THREE.CylinderGeometry(1, 1, 80, 64, 1, true);
    this.stormMesh = new THREE.Mesh(stormGeo, this.stormMat);
    this.stormMesh.position.y = 35;
    this.scene.add(this.stormMesh);
  }

  public getTerrainHeight(x: number, z: number): number {
    // Smooth rolling hills around a flat central arena
    const dist = Math.hypot(x, z);
    if (dist < 22) return 0;
    const hill = Math.sin(x * 0.045) * Math.cos(z * 0.045) * 3.2;
    const rim = Math.max(0, (dist - 75) * 0.12);
    return Math.max(0, hill + rim);
  }

  private buildSkybox(): void {
    const skyGeo = new THREE.SphereGeometry(400, 24, 16);
    const skyMesh = new THREE.Mesh(skyGeo, createSkyboxMaterial());
    this.scene.add(skyMesh);
  }

  private buildLighting(): void {
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x334155, 0.85);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xfffbeb, 1.35);
    dir.position.set(60, 95, 45);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 10;
    dir.shadow.camera.far = 250;
    const d = 85;
    dir.shadow.camera.left = -d;
    dir.shadow.camera.right = d;
    dir.shadow.camera.top = d;
    dir.shadow.camera.bottom = -d;
    this.scene.add(dir);
  }

  private buildTerrain(): void {
    const size = 260;
    const segments = 96;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cGrass = new THREE.Color(0x3b7a57);
    const cHill = new THREE.Color(0x4d8b55);
    const cCenter = new THREE.Color(0x475569);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.getTerrainHeight(x, z);
      pos.setY(i, y);

      const dist = Math.hypot(x, z);
      const col = dist < 20 ? cCenter : y > 1.5 ? cHill : cGrass;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: createArenaGridTexture(),
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.05,
      flatShading: true,
    });

    const terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);
    this.collidableMeshes.push(terrain);
  }

  private buildArenaCover(): void {
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.75,
      flatShading: true,
    });

    const coverPositions: Array<[number, number, number, number, number, number]> = [
      [10, 1.5, 0, 3, 3, 6],
      [-10, 1.5, 0, 3, 3, 6],
      [0, 1.5, 12, 6, 3, 2.5],
      [0, 1.5, -12, 6, 3, 2.5],
      [18, 2, 18, 4, 4, 4],
      [-18, 2, -18, 4, 4, 4],
    ];

    for (const [x, y, z, w, h, d] of coverPositions) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.collidableMeshes.push(mesh);
    }
  }

  private buildHarvestables(): void {
    const treeCount = 36;
    const rockCount = 24;
    const crateCount = 18;

    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9, flatShading: true });
    this.treeTrunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    this.treeTrunkInst.castShadow = true;
    this.treeTrunkInst.receiveShadow = true;

    const leavesGeo = new THREE.ConeGeometry(2.1, 4.2, 6);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85, flatShading: true });
    this.treeLeavesInst = new THREE.InstancedMesh(leavesGeo, leavesMat, treeCount);
    this.treeLeavesInst.castShadow = true;

    const rockGeo = new THREE.DodecahedronGeometry(1.45, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85, flatShading: true });
    this.rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    this.rockInst.castShadow = true;
    this.rockInst.receiveShadow = true;

    const crateGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.65, flatShading: true });
    this.crateInst = new THREE.InstancedMesh(crateGeo, crateMat, crateCount);
    this.crateInst.castShadow = true;
    this.crateInst.receiveShadow = true;

    let idCounter = 1;

    // Trees (Wood)
    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2 + (i % 3) * 0.2;
      const dist = 26 + (i % 5) * 14;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = this.getTerrainHeight(x, z);

      this.dummy.position.set(x, y + 1.6, z);
      this.dummy.rotation.set(0, angle, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.treeTrunkInst.setMatrixAt(i, this.dummy.matrix);

      this.dummy.position.set(x, y + 4.4, z);
      this.dummy.updateMatrix();
      this.treeLeavesInst.setMatrixAt(i, this.dummy.matrix);

      this.harvestNodes.push({
        id: idCounter++,
        type: 'wood',
        pos: new THREE.Vector3(x, y + 1.8, z),
        radius: 1.5,
        hp: 100,
        maxHp: 100,
        alive: true,
        instanceIndex: i,
      });
    }

    // Rocks (Brick)
    for (let i = 0; i < rockCount; i++) {
      const angle = (i / rockCount) * Math.PI * 2 + 0.4;
      const dist = 22 + (i % 4) * 15;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = this.getTerrainHeight(x, z);

      this.dummy.position.set(x, y + 0.9, z);
      this.dummy.rotation.set(i * 0.5, i * 1.1, 0);
      this.dummy.scale.set(1.1, 0.85, 1.1);
      this.dummy.updateMatrix();
      this.rockInst.setMatrixAt(i, this.dummy.matrix);

      this.harvestNodes.push({
        id: idCounter++,
        type: 'brick',
        pos: new THREE.Vector3(x, y + 1.0, z),
        radius: 1.6,
        hp: 120,
        maxHp: 120,
        alive: true,
        instanceIndex: i,
      });
    }

    // Metal Crates (Metal)
    for (let i = 0; i < crateCount; i++) {
      const angle = (i / crateCount) * Math.PI * 2 + 0.8;
      const dist = 16 + (i % 3) * 12;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = this.getTerrainHeight(x, z);

      this.dummy.position.set(x, y + 0.9, z);
      this.dummy.rotation.set(0, angle, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.crateInst.setMatrixAt(i, this.dummy.matrix);

      this.harvestNodes.push({
        id: idCounter++,
        type: 'metal',
        pos: new THREE.Vector3(x, y + 0.9, z),
        radius: 1.4,
        hp: 120,
        maxHp: 120,
        alive: true,
        instanceIndex: i,
      });
    }

    this.scene.add(this.treeTrunkInst, this.treeLeavesInst, this.rockInst, this.crateInst);
  }

  public damageHarvestNode(node: HarvestNode, dmg: number): boolean {
    if (!node.alive) return false;
    node.hp -= dmg;
    if (node.hp <= 0) {
      node.alive = false;
      this.dummy.position.set(0, -500, 0);
      this.dummy.scale.set(0.001, 0.001, 0.001);
      this.dummy.updateMatrix();

      if (node.type === 'wood') {
        this.treeTrunkInst.setMatrixAt(node.instanceIndex, this.dummy.matrix);
        this.treeLeavesInst.setMatrixAt(node.instanceIndex, this.dummy.matrix);
        this.treeTrunkInst.instanceMatrix.needsUpdate = true;
        this.treeLeavesInst.instanceMatrix.needsUpdate = true;
      } else if (node.type === 'brick') {
        this.rockInst.setMatrixAt(node.instanceIndex, this.dummy.matrix);
        this.rockInst.instanceMatrix.needsUpdate = true;
      } else {
        this.crateInst.setMatrixAt(node.instanceIndex, this.dummy.matrix);
        this.crateInst.instanceMatrix.needsUpdate = true;
      }
      return true;
    }
    return false;
  }

  public updateStorm(centerX: number, centerZ: number, radius: number, time: number): void {
    this.stormMesh.position.x = centerX;
    this.stormMesh.position.z = centerZ;
    this.stormMesh.scale.set(radius, 1, radius);
    this.stormMat.uniforms.uTime.value = time;
  }
}
