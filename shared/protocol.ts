export type WeaponType = 'pickaxe' | 'ar' | 'shotgun';
export type StructureType = 'wall' | 'floor' | 'ramp' | 'pyramid';
export type ResourceType = 'wood' | 'brick' | 'metal';

export const GRID_SIZE_X = 4;
export const GRID_SIZE_Y = 3;
export const GRID_SIZE_Z = 4;

export const BUILD_COST = 10;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  id: string;
  name: string;
  pos: Vec3;
  yaw: number;
  pitch: number;
  hp: number;
  shield: number;
  weapon: WeaponType;
  crouching: boolean;
  alive: boolean;
  kills: number;
}

export interface StructurePiece {
  id: string;
  type: StructureType;
  material: ResourceType;
  gx: number;
  gy: number;
  gz: number;
  rotY: number; // 0, 1, 2, 3 (multiples of 90 deg)
  hp: number;
  maxHp: number;
  ownerId: string;
}

export interface StormState {
  centerX: number;
  centerZ: number;
  radius: number;
  targetRadius: number;
  phase: number;
  damagePerSecond: number;
}

export interface KillFeedEntry {
  id: string;
  killer: string;
  victim: string;
  weapon: WeaponType | 'storm';
  timestamp: number;
}

// Client -> Server messages
export type ClientMessage =
  | { type: 'join'; name: string }
  | { type: 'state'; pos: Vec3; yaw: number; pitch: number; weapon: WeaponType; crouching: boolean }
  | { type: 'fire'; origin: Vec3; dir: Vec3; weapon: WeaponType }
  | { type: 'build'; pieceType: StructureType; material: ResourceType; gx: number; gy: number; gz: number; rotY: number }
  | { type: 'damage_structure'; id: string; damage: number }
  | { type: 'respawn' };

// Server -> Client messages
export type ServerMessage =
  | {
      type: 'welcome';
      id: string;
      players: PlayerState[];
      structures: StructurePiece[];
      storm: StormState;
    }
  | {
      type: 'snapshot';
      time: number;
      players: PlayerState[];
      storm: StormState;
    }
  | { type: 'player_joined'; player: PlayerState }
  | { type: 'player_left'; id: string }
  | { type: 'fire_fx'; shooterId: string; origin: Vec3; hitPoint: Vec3; weapon: WeaponType }
  | { type: 'hit_confirm'; targetType: 'player' | 'structure'; damage: number; eliminated?: boolean }
  | { type: 'structure_placed'; piece: StructurePiece }
  | { type: 'structure_updated'; id: string; hp: number }
  | { type: 'structure_destroyed'; id: string }
  | { type: 'kill_feed'; entry: KillFeedEntry }
  | { type: 'player_damaged'; hp: number; shield: number };
