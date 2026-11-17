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
  public editMode = false;
  public editingId: string | null = null;
  public editVariant = 0;
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
    this.previewMesh.visible = this.buildMode && !this.editMode;
    if (!this.buildMode || this.editMode) return;

    const eyePos = new THREE.Vector3(playerPos.x, playerPos.y + 1.6, playerPos.z);
    const target = eyePos.addScaledVector(forwardDir, 4.5);
    const gx = Math.round(target.x / GRID_SIZE_X);
    const gz = Math.round(target.z / GRID_SIZE_Z);
    const terrainY = this.worldMap.getTerrainHeight(gx * GRID_SIZE_X, gz * GRID_SIZE_Z);
    const gy = Math.max(Math.floor(target.y / GRID_SIZE_Y), Math.floor(terrainY / GRID_SIZE_Y));

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

  public startEdit(id: string): boolean {
    const entry = this.structures.get(id);
    if (!entry) return false;
    this.editMode = true;
    this.editingId = id;
    this.editVariant = entry.piece.editVariant ?? 0;
    const mat = entry.mesh.material as THREE.MeshStandardMaterial;
    mat.emissive.setHex(0x06b6d4);
    mat.emissiveIntensity = 0.55;
    return true;
  }

  public cycleEditVariant(): void {
    if (!this.editMode || !this.editingId) return;
    const entry = this.structures.get(this.editingId);
    if (!entry) return;
    const maxVariants = entry.piece.type === 'wall' ? 4 : 2;
    this.editVariant = (this.editVariant + 1) % maxVariants;
    this.applyEdit(this.editingId, this.editVariant);
  }

  public resetEdit(): void {
    if (!this.editMode || !this.editingId) return;
    this.editVariant = 0;
    this.applyEdit(this.editingId, 0);
  }

  public confirmEdit(): { id: string; editVariant: number } | null {
    if (!this.editMode || !this.editingId) return null;
    const entry = this.structures.get(this.editingId);
    if (entry) {
      const mat = entry.mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    }
    const result = { id: this.editingId, editVariant: this.editVariant };
    this.editMode = false;
    this.editingId = null;
    return result;
  }

  public applyEdit(id: string, variant: number): void {
    const entry = this.structures.get(id);
    if (!entry) return;
    entry.piece.editVariant = variant;

    const basePos = this.gridToWorld(
      entry.piece.gx,
      entry.piece.gy,
      entry.piece.gz,
      entry.piece.type,
      entry.piece.rotY
    );
    entry.mesh.position.copy(basePos);
    entry.mesh.scale.set(1, 1, 1);

    if (entry.piece.type === 'wall') {
      if (variant === 1) {
        // Half wall (low cover)
        entry.mesh.scale.set(1, 0.45, 1);
        entry.mesh.position.y -= GRID_SIZE_Y * 0.275;
      } else if (variant === 2 || variant === 3) {
        // Open doorway / side-trimmed wall
        entry.mesh.scale.set(0.55, 1, 1);
        const side = variant === 2 ? -1 : 1;
        const offset = new THREE.Vector3(side * GRID_SIZE_X * 0.225, 0, 0);
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), entry.piece.rotY * (Math.PI / 2));
        entry.mesh.position.add(offset);
      }
    } else if (entry.piece.type === 'floor' || entry.piece.type === 'ramp') {
      if (variant === 1) {
        entry.mesh.scale.set(0.5, 1, 1);
      }
    } else if (entry.piece.type === 'pyramid') {
      if (variant === 1) {
        entry.mesh.scale.set(0.65, 0.5, 0.65);
        entry.mesh.position.y -= GRID_SIZE_Y * 0.2;
      }
    }
  }
}
