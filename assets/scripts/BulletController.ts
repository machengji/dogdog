/**
 * 子弹控制器
 * 狗王枪神
 */

import { _decorator, Component, Node, Vec3 } from 'cc';
import { GameManager } from './GameManager';
import { GameState } from './types/GameTypes';
import { EnemyController } from './EnemyController';

const { ccclass } = _decorator;

@ccclass('BulletController')
export class BulletController extends Component {
    private direction: Vec3 = new Vec3(1, 0, 0);
    private damage: number = 0;
    private isCrit: boolean = false;
    private lifetime: number = 0;
    private speed: number = 800;

    init(direction: Vec3, damage: number, isCrit: boolean) {
        this.direction = direction;
        this.damage = damage;
        this.isCrit = isCrit;
    }

    update(deltaTime: number) {
        if (GameManager.instance.gameState !== GameState.PLAYING) return;

        this.lifetime += deltaTime;

        // 移动
        const moveDistance = this.speed * deltaTime;
        const newPos = this.node.getPosition().add(this.direction.clone().multiplyScalar(moveDistance));
        this.node.setPosition(newPos);

        // 检测碰撞
        this.checkCollision();

        // 超时销毁 或 超出屏幕销毁
        if (this.lifetime > 3 || this.isOutOfBounds()) {
            this.node.destroy();
        }
    }

    private isOutOfBounds(): boolean {
        const halfWidth = GameManager.instance.getHalfWidth();
        const halfHeight = GameManager.instance.getHalfHeight();
        const pos = this.node.getPosition();
        return Math.abs(pos.x) > halfWidth + 50 || Math.abs(pos.y) > halfHeight + 50;
    }

    private checkCollision() {
        const enemies = GameManager.instance.getEnemies();
        const bulletPos = this.node.getPosition();

        for (const enemy of enemies) {
            const enemyPos = enemy.getPosition();
            const dist = Vec3.distance(bulletPos, enemyPos);

            if (dist < 30) {
                const enemyCtrl = enemy.getComponent(EnemyController);
                if (enemyCtrl) {
                    enemyCtrl.takeDamage(this.damage);
                }

                this.node.destroy();
                return;
            }
        }
    }
}
