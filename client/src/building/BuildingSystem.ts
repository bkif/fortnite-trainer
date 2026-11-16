import * as THREE from 'three';
import {
  GRID_SIZE_X,
  GRID_SIZE_Y,
  GRID_SIZE_Z,
  type ResourceType,
  type StructurePiece,
  type StructureType,
} from '../../../shared/protocol';
import { createBlueprintMaterial } from '../shaders/customShaders';
import type { WorldMap } from '../engine/WorldMap';

const MATERIAL_COLORS: Record<ResourceType, number> = {
  wood: 0xb45309,
  brick: 0x991b1b,
  metal: 0x475569,
};

export class BuildingSystem {
  public structures = new Map<string, { piece: StructurePiece; mesh: THREE.Mesh }>();
  public structureMeshes: THREE.Mesh[] = [];
  public previewMesh: THREE.Mesh;
  public blueprintMat: THREE.ShaderMaterial;

  public activeType: StructureType = 'wall';
  public activeMaterial: ResourceType = 'wood';
  public buildMode = false;
  public rotationStep = 0; // 0..3
  public currentGridPos = { gx: 0, gy: 0, gz: 0 };
  public isValidPlacement = false;

  private geometries: Record<StructureType, THREE.BufferGeometry>;

  constructor(private scene: THREE.Scene, private worldMap: WorldMap) {
    this.geometries = {
      wall: new THREE.BoxGeometry(GRID_SIZE_X, GRID_SIZE_Y, 0.25),
      floor: new THREE.BoxGeometry(GRID_SIZE_X, 0.22, GRID_SIZE_Z),
      ramp: this.createRampGeometry(),
      pyramid: this.createPyramidGeometry(),
    };

    this.blueprintMat = createBlueprintMaterial();
    this.previewMesh = new THREE.Mesh(this.geometries.wall, this.blueprintMat);
    this.previewMesh.visible = false;
    this.scene.add(this.previewMesh);
  }

  private createRampGeometry(): THREE.BufferGeometry {
    // Sloped ramp rising from -Z (y=0) to +Z (y=GRID_SIZE_Y)
    const geo = new THREE.BoxGeometry(GRID_SIZE_X, 0.22, Math.hypot(GRID_SIZE_Z, GRID_SIZE_Y));
    const angle = Math.atan2(GRID_SIZE_Y, GRID_SIZE_Z);
    geo.rotateX(-angle);
    return geo;
  }

  private createPyramidGeometry(): THREE.BufferGeometry {
    const geo = new THREE.ConeGeometry(GRID_SIZE_X * 0.707, GRID_SIZE_Y * 0.85, 4);
    geo.rotateY(Math.PI / 4);
    return geo;
  }

  public setBlueprint(type: StructureType): void {
    this.activeType = type;
    this.buildMode = true;
    this.previewMesh.geometry = this.geometries[type];
  }

  public rotateBlueprint(): void {
    this.rotationStep = (this.rotationStep + 1) % 4;
  }

  public gridToWorld(gx: number, gy: number, gz: number, type: StructureType, rotY: number): THREE.Vector3 {
    const wx = gx * GRID_SIZE_X;
    const wy = gy * GRID_SIZE_Y;
    const wz = gz * GRID_SIZE_Z;

    if (type === 'wall') {
      const halfZ = GRID_SIZE_Z / 2;
      const offset = new THREE.Vector3(0, GRID_SIZE_Y / 2, -halfZ);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY * (Math.PI / 2));
      return new THREE.Vector3(wx + offset.x, wy + offset.y, wz + offset.z);
    }
    if (type === 'floor') {
      return new THREE.Vector3(wx, wy, wz);
    }
    if (type === 'ramp') {
      return new THREE.Vector3(wx, wy + GRID_SIZE_Y / 2, wz);
    }
    // pyramid
    return new THREE.Vector3(wx, wy + GRID_SIZE_Y * 0.425, wz);
  }

  public updatePreview(playerPos: THREE.Vector3, forwardDir: THREE.Vector3, time: number): void {
    this.previewMesh.visible = this.buildMode;
    if (!this.buildMode) return;

    const target = playerPos.clone().addScaledVector(forwardDir, 4.5);
    const gx = Math.round(target.x / GRID_SIZE_X);
    const gz = Math.round(target.z / GRID_SIZE_Z);
    const terrainY = this.worldMap.getTerrainHeight(gx * GRID_SIZE_X, gz * GRID_SIZE_Z);
    const gy = Math.max(Math.floor((target.y - 0.5) / GRID_SIZE_Y), Math.floor(terrainY / GRID_SIZE_Y));

    // Snap rotation to player facing
    const facingAngle = Math.atan2(forwardDir.x, forwardDir.z);
    const snappedRot = (Math.round(facingAngle / (Math.PI / 2)) + this.rotationStep + 4) % 4;

    this.currentGridPos = { gx, gy, gz };
    const worldPos = this.gridToWorld(gx, gy, gz, this.activeType, snappedRot);
    this.previewMesh.position.copy(worldPos);
    this.previewMesh.rotation.set(0, snappedRot * (Math.PI / 2), 0);

    const key = `${this.activeType}:${gx}:${gy}:${gz}`;
    const alreadyExists = this.structures.has(key);
    const anchoredToGround = gy <= Math.floor(terrainY / GRID_SIZE_Y) + 1;
    const hasNeighbor = this.hasAdjacentStructure(gx, gy, gz);

    this.isValidPlacement = !alreadyExists && (anchoredToGround || hasNeighbor);
    this.blueprintMat.uniforms.uTime.value = time;
    this.blueprintMat.uniforms.uValid.value = this.isValidPlacement ? 1.0 : 0.0;
  }

  public getCurrentRotation(): number {
    return Math.round(this.previewMesh.rotation.y / (Math.PI / 2)) & 3;
  }

  private hasAdjacentStructure(gx: number, gy: number, gz: number): boolean {
    for (const [, entry] of this.structures) {
      const p = entry.piece;
      const dx = Math.abs(p.gx - gx);
      const dy = Math.abs(p.gy - gy);
      const dz = Math.abs(p.gz - gz);
      if (dx <= 1 && dy <= 1 && dz <= 1) return true;
    }
    return false;
  }

  public addStructure(piece: StructurePiece): void {
    if (this.structures.has(piece.id)) return;
    const mat = new THREE.MeshStandardMaterial({
      color: MATERIAL_COLORS[piece.material],
      roughness: 0.78,
      metalness: piece.material === 'metal' ? 0.5 : 0.05,
      flatShading: true,
    });

    const mesh = new THREE.Mesh(this.geometries[piece.type], mat);
    const worldPos = this.gridToWorld(piece.gx, piece.gy, piece.gz, piece.type, piece.rotY);
    mesh.position.copy(worldPos);
    mesh.rotation.set(0, piece.rotY * (Math.PI / 2), 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.structureId = piece.id;

    this.scene.add(mesh);
    this.structures.set(piece.id, { piece, mesh });
    this.structureMeshes.push(mesh);
  }

  public updateStructureHp(id: string, hp: number): void {
    const entry = this.structures.get(id);
    if (!entry) return;
    entry.piece.hp = hp;
    const ratio = Math.max(0.25, hp / entry.piece.maxHp);
    (entry.mesh.material as THREE.MeshStandardMaterial).opacity = 0.4 + ratio * 0.6;
    (entry.mesh.material as THREE.MeshStandardMaterial).transparent = hp < entry.piece.maxHp;
  }

  public removeStructure(id: string): void {
    const entry = this.structures.get(id);
    if (!entry) return;
    this.scene.remove(entry.mesh);
    entry.mesh.material instanceof THREE.Material && entry.mesh.material.dispose();
    this.structures.delete(id);
    this.structureMeshes = this.structureMeshes.filter((m) => m !== entry.mesh);
  }
}
