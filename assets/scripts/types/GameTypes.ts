import { Node } from 'cc';

/**
 * 游戏类型定义
 * 狗王枪神 - 纯代码驱动
 */

// ==================== 武器类型 ====================
export interface WeaponData {
    id: string;
    name: string;
    damage: number;
    fireRate: number;
    range: number;
    critRate: number;
    critDamage: number;
    penetrate?: boolean;
    splash?: boolean;
}

export interface WeaponInstance {
    config: WeaponData;
    level: number;
}

// ==================== 敌人类型 ====================
export interface EnemyData {
    id: string;
    name: string;
    hp: number;
    attack: number;
    speed: number;
    size: number;
    color: string;
    skill: string | null;
    dropGold: number;
}

export interface EnemyInstance {
    config: EnemyData;
    currentHp: number;
    node: Node;
}

// ==================== 狗伙伴类型 ====================
export interface DogData {
    id: string;
    name: string;
    breed: string;
    role: string;
    skill1?: string;
    skill2?: string;
    passive?: string;
    stats: {
        attackBonus?: number;
        critRate?: number;
        moveSpeed?: number;
        hpBonus?: number;
        defense?: number;
    };
}

export interface DogInstance {
    config: DogData;
    affection: number;       // 好感度
    level: number;
}

// ==================== 玩家类型 ====================
export interface PlayerStats {
    maxHp: number;
    currentHp: number;
    attack: number;
    speed: number;
    critRate: number;
    critDamage: number;
    dodgeRate: number;
    pickupRange: number;
    range: number;
}

// ==================== 游戏状态 ====================
export enum GameState {
    MENU = 'menu',
    PLAYING = 'playing',
    PAUSED = 'paused',
    VICTORY = 'victory',
    DEFEAT = 'defeat'
}

// ==================== 碰撞标签 ====================
export enum CollisionTag {
    PLAYER = 'player',
    ENEMY = 'enemy',
    BULLET = 'bullet',
    COIN = 'coin',
    PICKUP = 'pickup'
}

// ==================== 技能类型 ====================
export enum SkillType {
    ACTIVE = 'active',
    PASSIVE = 'passive',
    ULTIMATE = 'ultimate'
}

// ==================== 事件类型 ====================
export interface GameEvent {
    type: string;
    data?: any;
}

export interface DamageEvent {
    target: Node;
    damage: number;
    isCrit: boolean;
    source: Node;
}

export interface KillEvent {
    enemy: Node;
    gold: number;
}

// ==================== UI数据 ====================
export interface HUDData {
    hp: number;
    maxHp: number;
    gold: number;
    level: number;
    score: number;
    combo: number;
    comboMultiplier: number;
    gameTime: number;
}

// ==================== 狗情绪类型 ====================
export enum DogMood {
    NORMAL = 'normal',
    HAPPY = 'happy',
    ANGRY = 'angry',
    SCARED = 'scared',
    BORED = 'bored'
}

export interface DogMoodEffect {
    attackSpeed: number;
    damage: number;
    followCloser?: boolean;
}

export interface DogMoodData {
    mood: DogMood;
    expression: string;
    effect: DogMoodEffect;
    duration: number;
    endTime?: number;
}

// ==================== 连击数据 ====================
export interface ComboData {
    count: number;
    multiplier: number;
    timeLeft: number;
    isActive: boolean;
    lastKillTime: number;
}
