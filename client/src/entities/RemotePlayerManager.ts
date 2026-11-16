import * as THREE from 'three';
import type { PlayerState } from '../../../shared/protocol';

interface RemoteEntity {
  group: THREE.Group;
  targetPos: THREE.Vector3;
  targetYaw: number;
  state: PlayerState;
}

export class RemotePlayerManager {
  private entities = new Map<string, RemoteEntity>();

  constructor(private scene: THREE.Scene) {}

  private createPlayerMesh(): THREE.Group {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6, flatShading: true });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfca5a5, roughness: 0.5, flatShading: true });
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 4, 8), bodyMat);
    body.position.y = 0.95;
    body.castShadow = true;

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), headMat);
    head.position.y = 1.85;
    head.castShadow = true;

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.1), visorMat);
    visor.position.set(0, 1.88, -0.22);

    group.add(body, head, visor);
    return group;
  }

  public syncPlayers(players: PlayerState[], localId: string | null): void {
    const activeIds = new Set<string>();

    for (const p of players) {
      if (p.id === localId) continue;
      activeIds.add(p.id);

      let entity = this.entities.get(p.id);
      if (!entity) {
        const group = this.createPlayerMesh();
        group.position.set(p.pos.x, p.pos.y, p.pos.z);
        this.scene.add(group);
        entity = {
          group,
          targetPos: new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z),
          targetYaw: p.yaw,
          state: p,
        };
        this.entities.set(p.id, entity);
      } else {
        entity.targetPos.set(p.pos.x, p.pos.y, p.pos.z);
        entity.targetYaw = p.yaw;
        entity.state = p;
      }

      entity.group.visible = p.alive;
      entity.group.scale.y = p.crouching ? 0.72 : 1.0;
    }

    for (const [id, entity] of this.entities) {
      if (!activeIds.has(id)) {
        this.scene.remove(entity.group);
        this.entities.delete(id);
      }
    }
  }

  public removePlayer(id: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      this.scene.remove(entity.group);
      this.entities.delete(id);
    }
  }

  public update(dt: number): void {
    const alpha = Math.min(1, dt * 15);
    for (const [, entity] of this.entities) {
      entity.group.position.lerp(entity.targetPos, alpha);
      entity.group.rotation.y = THREE.MathUtils.lerp(entity.group.rotation.y, entity.targetYaw, alpha);
    }
  }
}
