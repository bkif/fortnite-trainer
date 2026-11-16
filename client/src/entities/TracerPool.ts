import * as THREE from 'three';

interface TracerItem {
  line: THREE.Line;
  life: number;
  maxLife: number;
  active: boolean;
}

export class TracerPool {
  private pool: TracerItem[] = [];

  constructor(private scene: THREE.Scene, size = 32) {
    for (let i = 0; i < size; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]);
      const mat = new THREE.LineBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.9,
      });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      this.scene.add(line);
      this.pool.push({ line, life: 0, maxLife: 0.08, active: false });
    }
  }

  public spawn(start: THREE.Vector3, end: THREE.Vector3, color = 0xfef08a): void {
    const item = this.pool.find((p) => !p.active) ?? this.pool[0];
    const pos = item.line.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, start.x, start.y, start.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    (item.line.material as THREE.LineBasicMaterial).color.setHex(color);
    (item.line.material as THREE.LineBasicMaterial).opacity = 0.95;
    item.line.visible = true;
    item.active = true;
    item.life = 0;
  }

  public update(dt: number): void {
    for (const item of this.pool) {
      if (!item.active) continue;
      item.life += dt;
      if (item.life >= item.maxLife) {
        item.active = false;
        item.line.visible = false;
      } else {
        (item.line.material as THREE.LineBasicMaterial).opacity =
          1 - item.life / item.maxLife;
      }
    }
  }
}
