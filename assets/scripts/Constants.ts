/**
 * 游戏常量配置
 * 狗王枪神 - 纯代码驱动
 */

// ==================== 武器配置 ====================
export const WEAPON_CONFIG = {
    pistol: {
        id: 'pistol',
        name: '手枪',
        damage: 15,
        fireRate: 3,        // 射速：3发/秒
        range: 400,          // 射程：400像素
        critRate: 0.05,     // 暴击率：5%
        critDamage: 2.0      // 暴击伤害：200%
    },
    bow: {
        id: 'bow',
        name: '弓箭',
        damage: 25,
        fireRate: 1.5,
        range: 600,
        critRate: 0.10,
        critDamage: 2.5,
        penetrate: true     // 穿透敌群
    },
    grenade: {
        id: 'grenade',
        name: '手雷',
        damage: 80,
        fireRate: 0.5,
        range: 300,
        critRate: 0.15,
        critDamage: 2.0,
        splash: true        // 范围伤害
    }
};

// ==================== 敌人配置 ====================
export const ENEMY_CONFIG = {
    lazyDog: {
        id: 'lazyDog',
        name: '懒狗',
        hp: 50,
        attack: 5,
        speed: 60,          // 像素/秒
        size: 40,
        color: '#8B4513',
        skill: null,
        dropGold: 10
    },
    crazyDog: {
        id: 'crazyDog',
        name: '疯狗',
        hp: 80,
        attack: 10,
        speed: 120,
        size: 35,
        color: '#FF4500',
        skill: 'dash',     // 冲刺技能
        dropGold: 20
    },
    fatDog: {
        id: 'fatDog',
        name: '胖狗',
        hp: 200,
        attack: 15,
        speed: 30,
        size: 60,
        color: '#DAA520',
        skill: 'attract',  // 吸引技能
        dropGold: 50
    }
};

// ==================== 狗伙伴配置 ====================
export const DOG_CONFIG = {
    husky: {
        id: 'husky',
        name: '哈士奇',
        breed: '战斗犬',
        role: 'assassin',      // 刺客
        skill1: '冰霜冲刺',
        skill2: '拆迁大法',
        stats: {
            attackBonus: 0.1,   // 伤害+10%
            critRate: 0.05,     // 暴击率+5%
            moveSpeed: 0.05    // 移速+5%
        }
    },
    corgi: {
        id: 'corgi',
        name: '柯基',
        breed: '辅助犬',
        role: 'support',
        passive: '全队血量+10%',
        stats: {
            hpBonus: 0.1
        }
    },
    shepherd: {
        id: 'shepherd',
        name: '德牧',
        breed: '战斗犬',
        role: 'warrior',
        skill1: '护盾冲锋',
        skill2: '追踪标记',
        stats: {
            attackBonus: 0.15,
            defense: 0.1
        }
    }
};

// ==================== 玩家配置 ====================
export const PLAYER_CONFIG = {
    maxHp: 100,
    baseAttack: 15,
    baseSpeed: 150,
    baseCritRate: 0.05,
    baseCritDamage: 2.0,
    dodgeRate: 0.0,
    pickupRange: 100,
    invincibleTime: 1.0    // 受伤后无敌时间(秒)
};

// ==================== 关卡配置 ====================
export const LEVEL_CONFIG = {
    level1_1: {
        id: 'level1_1',
        name: '城市街道',
        enemyCount: 20,
        enemies: ['lazyDog'],
        boss: null,
        duration: 180    // 3分钟
    },
    level1_2: {
        id: 'level1_2',
        name: '便利店',
        enemyCount: 25,
        enemies: ['lazyDog', 'crazyDog'],
        boss: 'fatDog',
        duration: 240    // 4分钟
    }
};

// ==================== 数值成长 ====================
export const GROWTH_CONFIG = {
    hpPerLevel: 10,
    attackPerLevel: 3,
    speedPerLevel: 10,
    critRatePerLevel: 0.01,
    critDamagePerLevel: 0.1
};

// ==================== 货币配置 ====================
export const CURRENCY_CONFIG = {
    goldPerKill: 10,
    goldPerLevel: 50,
    diamondDropRate: 0.05
};
