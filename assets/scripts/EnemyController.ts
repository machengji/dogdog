/**
 * 敌人控制器
 * 狗王枪神
 */

import { _decorator, Component, Node, Vec3 } from 'cc';
import { GameManager } from './GameManager';
import { GameState } from './types/GameTypes';

const { ccclass } = _decorator;

@ccclass('EnemyController')
export class EnemyController extends Component {
    private config: any = null;
    private currentHp: number = 0;
    private targetPlayer: Node | null = null;
    private attackCooldown: number = 0;
    // 减速效果
    private slowFactor: number = 1.0;
    private slowDuration: number = 0;

    init(config: any) {
        this.config = config;
        this.currentHp = config.hp;
    }

    update(deltaTime: number) {
        if (GameManager.instance.gameState !== GameState.PLAYING) return;

        // 更新减速持续时间
        if (this.slowDuration > 0) {
            this.slowDuration -= deltaTime;
            if (this.slowDuration <= 0) {
                this.slowFactor = 1.0;
            }
        }

        this.updateAI(deltaTime);
    }

    // 应用减速效果
    public applySlow(factor: number, duration: number) {
        this.slowFactor = factor;
        this.slowDuration = duration;
        console.log(`🐕 敌人被减速！速度降至 ${factor * 100}%`);
    }

    private updateAI(deltaTime: number) {
        const player = GameManager.instance.getPlayer();
        if (!player) return;

        const playerPos = player.getPosition();
        const enemyPos = this.node.getPosition();
        const distance = Vec3.distance(playerPos, enemyPos);

        // 追踪玩家（受减速影响）
        if (distance > 50) {
            const direction = new Vec3().subtract(playerPos, enemyPos).normalize();
            const moveDistance = this.config.speed * this.slowFactor * deltaTime;
            const newPos = enemyPos.add(direction.clone().multiplyScalar(moveDistance));
            this.node.setPosition(newPos);
        }

        // 攻击玩家
        this.attackCooldown -= deltaTime;
        if (distance < 80 && this.attackCooldown <= 0) {
            this.attackPlayer();
            this.attackCooldown = 1;
        }
    }

    private attackPlayer() {
        const player = GameManager.instance.getPlayer();
        if (!player) return;

        GameManager.instance.damagePlayer(this.config.attack);
    }

    public takeDamage(damage: number) {
        this.currentHp -= damage;

        if (this.currentHp <= 0) {
            GameManager.instance.killEnemy(this.node, this.config.dropGold);
        }
    }
}
