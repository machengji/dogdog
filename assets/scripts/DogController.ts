/**
 * 狗伙伴控制器
 * 狗王枪神 - 狗情绪系统 + 协同战斗
 */

import { _decorator, Component, Node, Vec3, Label } from 'cc';
import { GameManager } from './GameManager';
import { DOG_CONFIG, DOG_MOOD_CONFIG } from './Constants';
import { GameState, DogMood, DogMoodData } from './types/GameTypes';
import { EnemyController } from './EnemyController';

const { ccclass } = _decorator;

@ccclass('DogController')
export class DogController extends Component {
    private config: any = null;

    // 好感度系统
    private affection: number = 0;
    private maxAffection: number = 100;

    // 技能冷却
    private skillCooldown: number = 0;
    private skillInterval: number = 5;  // 技能间隔改为5秒

    // 追踪最近攻击的敌人
    private targetEnemy: Node | null = null;

    // 攻击计时
    private attackTimer: number = 0;

    // 情绪系统
    private _currentMood: DogMood = DogMood.NORMAL;
    private _moodEndTime: number = 0;
    private noKillTimer: number = 0;  // 无击杀计时器

    // 情绪效果缓存
    private attackSpeedBonus: number = 1.0;
    private damageBonus: number = 1.0;
    private followCloser: boolean = false;

    onLoad() {
        this.config = DOG_CONFIG.husky;
        this.affection = 50;
    }

    update(deltaTime: number) {
        if (GameManager.instance.gameState !== GameState.PLAYING) return;

        // 更新情绪
        this.updateMood(deltaTime);

        // 更新技能冷却
        if (this.skillCooldown > 0) {
            this.skillCooldown -= deltaTime;
        }

        // 更新攻击计时
        this.attackTimer += deltaTime;

        // 更新无击杀计时
        this.noKillTimer += deltaTime;

        // 狗伙伴会攻击附近的敌人
        this.attackNearbyEnemy();

        // 释放技能
        if (this.skillCooldown <= 0) {
            this.useSkill();
            this.skillCooldown = this.skillInterval;
        }

        // 跟随玩家
        this.followPlayer();
    }

    // 更新情绪状态
    private updateMood(deltaTime: number) {
        // 检查当前情绪是否过期
        if (this._moodEndTime > 0) {
            const gameTime = GameManager.instance.getGameTime();
            if (gameTime >= this._moodEndTime) {
                // 情绪过期，恢复正常
                this.setMood(DogMood.NORMAL);
            }
        }

        const playerStats = GameManager.instance.getPlayerStats();
        const comboManager = GameManager.instance.getComboManager();
        const comboCount = comboManager?.getComboCount() || 0;
        const hpPercent = playerStats.currentHp / playerStats.maxHp;

        // 开心：连击 >= 10
        if (comboCount >= 10 && this._currentMood !== DogMood.HAPPY) {
            this.setMood(DogMood.HAPPY);
        }
        // 愤怒：玩家血量 < 50%
        else if (hpPercent < 0.5 && this._currentMood !== DogMood.ANGRY && this._currentMood !== DogMood.HAPPY) {
            this.setMood(DogMood.ANGRY);
        }
        // 害怕：玩家血量 < 20%
        else if (hpPercent < 0.2 && this._currentMood !== DogMood.SCARED && this._currentMood !== DogMood.HAPPY) {
            this.setMood(DogMood.SCARED);
        }
        // 无聊：10秒无击杀
        else if (this.noKillTimer > 10 && this._currentMood !== DogMood.BORED && this._currentMood !== DogMood.HAPPY) {
            this.setMood(DogMood.BORED);
        }
        // 恢复正常
        else if (this._currentMood !== DogMood.NORMAL &&
                 comboCount < 10 && hpPercent >= 0.5 && this.noKillTimer <= 10) {
            this.setMood(DogMood.NORMAL);
        }
    }

    // 设置情绪
    private setMood(mood: DogMood) {
        this._currentMood = mood;

        const moodConfig = DOG_MOOD_CONFIG[mood];
        if (!moodConfig) return;

        // 应用情绪效果
        this.attackSpeedBonus = moodConfig.effect.attackSpeed;
        this.damageBonus = moodConfig.effect.damage;
        this.followCloser = 'followCloser' in moodConfig.effect ? !!moodConfig.effect.followCloser : false;

        // 设置情绪持续时间
        if (moodConfig.duration > 0) {
            const gameTime = GameManager.instance.getGameTime();
            this._moodEndTime = gameTime + moodConfig.duration;
        } else {
            this._moodEndTime = 0;
        }

        console.log(`🐕 狗情绪变化: ${mood} - ${moodConfig.expression}`);

        // 更新狗情绪UI
        this.updateMoodUI();
    }

    // 获取当前情绪
    public getCurrentMood(): DogMood {
        return this._currentMood;
    }

    // 获取情绪表情
    public getMoodExpression(): string {
        const moodConfig = DOG_MOOD_CONFIG[this._currentMood];
        return moodConfig ? moodConfig.expression : '🐕';
    }

    // 获取攻击速度加成
    public getAttackSpeedBonus(): number {
        return this.attackSpeedBonus;
    }

    // 获取伤害加成
    public getDamageBonus(): number {
        return this.damageBonus;
    }

    // 获取是否贴紧跟随
    public shouldFollowCloser(): boolean {
        return this.followCloser;
    }

    // 更新狗情绪UI
    private updateMoodUI() {
        const gameManager = GameManager.instance;
        const dogMoodLabel = gameManager.getHUD()?.getChildByName('DogMoodLabel')?.getComponent(Label);

        if (dogMoodLabel) {
            dogMoodLabel.string = this.getMoodExpression();
        }
    }

    private attackNearbyEnemy() {
        const enemies = GameManager.instance.getEnemies();
        const dogPos = this.node.getPosition();
        let nearestEnemy: Node | null = null;
        let nearestDist = 200;  // 狗的攻击范围

        for (const enemy of enemies) {
            const dist = Vec3.distance(dogPos, enemy.getPosition());
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
            }
        }

        if (nearestEnemy) {
            this.targetEnemy = nearestEnemy;
            // 狗伙伴发起攻击（造成30%玩家攻击力 * 情绪伤害加成）
            const stats = GameManager.instance.getPlayerStats();
            const comboDamageBonus = this.damageBonus;
            const dogDamage = stats.attack * 0.3 * comboDamageBonus;

            // 根据攻击速度加成调整攻击间隔
            const attackInterval = 1.0 / this.attackSpeedBonus;

            if (this.attackTimer >= attackInterval) {
                this.attackTimer = 0;
                const enemyCtrl = nearestEnemy.getComponent(EnemyController);
                if (enemyCtrl) {
                    enemyCtrl.takeDamage(dogDamage);
                    console.log(`🐕 狗攻击敌人，伤害: ${dogDamage.toFixed(1)}`);
                }
            }
        } else {
            this.targetEnemy = null;
        }
    }

    private useSkill() {
        // 哈士奇技能：冰霜冲刺 - 减速附近敌人
        const enemies = GameManager.instance.getEnemies();
        const dogPos = this.node.getPosition();

        let hitCount = 0;
        for (const enemy of enemies) {
            const dist = Vec3.distance(dogPos, enemy.getPosition());
            if (dist < 150) {
                const enemyCtrl = enemy.getComponent(EnemyController);
                if (enemyCtrl) {
                    enemyCtrl.applySlow(0.5, 2);  // 减速50%，持续2秒
                    hitCount++;
                }
            }
        }

        if (hitCount > 0) {
            console.log(`❄️ 哈士奇释放冰霜冲刺！命中 ${hitCount} 个敌人`);
        }
    }

    private followPlayer() {
        const player = GameManager.instance.getPlayer();
        if (!player) return;

        const playerPos = player.getPosition();
        const dogPos = this.node.getPosition();

        // 根据情绪调整跟随距离
        let offsetDistance = this.followCloser ? 30 : 50;
        const offset = new Vec3(offsetDistance, 0, 0);
        let targetPos = playerPos.clone().add(offset);

        const dist = Vec3.distance(dogPos, targetPos);
        if (dist > 10) {
            const direction = targetPos.clone().subtract(dogPos).normalize();
            const moveSpeed = 120;
            let newPos = dogPos.add(direction.clone().multiplyScalar(moveSpeed * 0.016));

            // 无边界限制
            this.node.setPosition(newPos);
        }
    }

    // 增加好感度
    public addAffection(amount: number) {
        this.affection = Math.min(this.maxAffection, this.affection + amount);
        console.log(`❤️ 好感度 +${amount} (${this.affection}/${this.maxAffection})`);
    }

    // 获取当前好感度
    public getAffection(): number {
        return this.affection;
    }

    // 重置无击杀计时器（当击杀敌人时调用）
    public resetNoKillTimer() {
        this.noKillTimer = 0;
    }
}
