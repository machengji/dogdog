/**
 * 狗伙伴控制器
 * 狗王枪神
 */

import { _decorator, Component, Node, Vec3 } from 'cc';
import { GameManager } from './GameManager';
import { DOG_CONFIG } from './Constants';
import { GameState } from './types/GameTypes';
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
    private skillInterval: number = 3;
    // 追踪最近攻击的敌人
    private targetEnemy: Node | null = null;
    // 攻击计时
    private attackTimer: number = 0;

    onLoad() {
        this.config = DOG_CONFIG.husky;
        this.affection = 50;
    }

    update(deltaTime: number) {
        if (GameManager.instance.gameState !== GameState.PLAYING) return;

        // 更新技能冷却
        if (this.skillCooldown > 0) {
            this.skillCooldown -= deltaTime;
        }

        // 更新攻击计时
        this.attackTimer += deltaTime;

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

    private attackNearbyEnemy() {
        const enemies = GameManager.instance.getEnemies();
        const dogPos = this.node.getPosition();
        let nearestEnemy: Node | null = null;
        let nearestDist = 200;

        for (const enemy of enemies) {
            const dist = Vec3.distance(dogPos, enemy.getPosition());
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
            }
        }

        if (nearestEnemy) {
            this.targetEnemy = nearestEnemy;
            // 狗伙伴发起攻击（造成30%玩家攻击力）
            const stats = GameManager.instance.getPlayerStats();
            const dogDamage = stats.attack * 0.3;

            // 每秒攻击一次
            if (this.attackTimer >= 1) {
                this.attackTimer = 0;
                const enemyCtrl = nearestEnemy.getComponent(EnemyController);
                if (enemyCtrl) {
                    enemyCtrl.takeDamage(dogDamage);
                }
            }
        }
    }

    private useSkill() {
        // 哈士奇技能：冰霜冲刺 - 减速附近敌人
        const enemies = GameManager.instance.getEnemies();
        const dogPos = this.node.getPosition();

        for (const enemy of enemies) {
            const dist = Vec3.distance(dogPos, enemy.getPosition());
            if (dist < 150) {
                const enemyCtrl = enemy.getComponent(EnemyController);
                if (enemyCtrl) {
                    enemyCtrl.applySlow(0.5, 2);
                }
            }
        }

        console.log('❄️ 哈士奇释放冰霜冲刺！');
    }

    private followPlayer() {
        const player = GameManager.instance.getPlayer();
        if (!player) return;

        const playerPos = player.getPosition();
        const dogPos = this.node.getPosition();

        const offset = new Vec3(50, 30, 0);
        let targetPos = playerPos.clone().add(offset);

        const dist = Vec3.distance(dogPos, targetPos);
        if (dist > 20) {
            const direction = new Vec3().subtract(targetPos, dogPos).normalize();
            const moveSpeed = 120;
            let newPos = dogPos.add(direction.clone().multiplyScalar(moveSpeed * 0.016));

            // 边界限制
            const halfWidth = GameManager.instance.getHalfWidth();
            const halfHeight = GameManager.instance.getHalfHeight();
            const dogSize = 20;

            newPos.x = Math.max(-halfWidth + dogSize, Math.min(halfWidth - dogSize, newPos.x));
            newPos.y = Math.max(-halfHeight + dogSize, Math.min(halfHeight - dogSize, newPos.y));

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
}
