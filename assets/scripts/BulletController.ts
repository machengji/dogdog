import { _decorator, Component, Vec3 } from 'cc';
import { GameManager } from './GameManager';
import { GameState } from './types/GameTypes';
import { EnemyController } from './EnemyController';

const { ccclass } = _decorator;

@ccclass('BulletController')
export class BulletController extends Component {
    private direction: Vec3 = new Vec3(1, 0, 0);
    private damage = 0;
    private isCrit = false;
    private lifetime = 0;
    private speed = 800;

    init(direction: Vec3, damage: number, isCrit: boolean) {
        this.direction = direction;
        this.damage = damage;
        this.isCrit = isCrit;
    }

    update(deltaTime: number) {
        if (GameManager.instance.gameState !== GameState.PLAYING) {
            return;
        }

        this.lifetime += deltaTime;

        const moveDistance = this.speed * deltaTime;
        const newPos = this.node.getPosition().add(this.direction.clone().multiplyScalar(moveDistance));
        this.node.setPosition(newPos);

        this.checkCollision();

        if (this.lifetime > 3 || this.isOutOfBounds()) {
            this.node.destroy();
        }
    }

    private isOutOfBounds(): boolean {
        const halfWidth = GameManager.instance.getHalfWidth();
        const halfHeight = GameManager.instance.getHalfHeight();
        const player = GameManager.instance.getPlayer();
        const centerPos = player ? player.getPosition() : Vec3.ZERO;
        const bulletPos = this.node.getPosition();

        return (
            Math.abs(bulletPos.x - centerPos.x) > halfWidth + 100 ||
            Math.abs(bulletPos.y - centerPos.y) > halfHeight + 100
        );
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
