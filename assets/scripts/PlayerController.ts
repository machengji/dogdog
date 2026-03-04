/**
 * 玩家控制器
 * 狗王枪神
 */

import { _decorator, Component, Node, Vec3, Vec2, input, Input, EventTouch, EventKeyboard, KeyCode, Canvas, game } from 'cc';
import { GameManager } from './GameManager';
import { GameState } from './types/GameTypes';

const { ccclass } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends Component {
    private targetPosition: Vec3 | null = null;
    private isMoving: boolean = false;
    private fireTimer: number = 0;
    private isFiring: boolean = false;
    private currentTarget: Node | null = null;
    // 闪避相关
    private isDodging: boolean = false;
    private dodgeCooldown: number = 0;
    private dodgeSpeed: number = 800;
    private dodgeDistance: number = 150;
    private dodgeDirection: Vec3 = new Vec3();
    // 双击检测
    private lastTouchTime: number = 0;
    private lastTouchPos: Vec2 = new Vec2();

    onLoad() {
        // 注册键盘事件（空格键闪避）
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    start() {
        // 延迟注册触摸事件，确保HUD创建完成
        this.scheduleOnce(() => {
            this.registerTouchEvents();
        }, 0.1);
    }

    private registerTouchEvents() {
        // 直接在GameManager的节点上注册触摸事件
        const gameNode = GameManager.instance.node;
        if (gameNode) {
            gameNode.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
            gameNode.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            gameNode.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            gameNode.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
            console.log('✅ 触摸事件已注册');
        } else {
            console.log('❌ 找不到GameManager节点');
        }
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    private onKeyDown(event: EventKeyboard) {
        if (event.keyCode === KeyCode.SPACE) {
            if (this.isMoving && this.targetPosition) {
                const playerPos = this.node.getPosition();
                const direction = new Vec3().subtract(this.targetPosition, playerPos);
                this.triggerDodge(direction);
            } else {
                this.triggerDodge(new Vec3(1, 0, 0));
            }
        }
    }

    update(deltaTime: number) {
        if (GameManager.instance.gameState !== GameState.PLAYING) return;

        this.updateMovement(deltaTime);
        this.updateDodge(deltaTime);
        this.updateAutoFire(deltaTime);
        this.updateDogFollow();
    }

    private onTouchStart(event: EventTouch) {
        const touchPos = event.getUILocation();
        const worldPos = this.convertToWorldPosition(touchPos);
        const currentTime = Date.now();

        // 检测双击触发闪避（300ms内两次点击）
        if (currentTime - this.lastTouchTime < 300) {
            const playerPos = this.node.getPosition();
            const direction = new Vec3().subtract(worldPos, playerPos);
            if (direction.length() > 10) {
                this.triggerDodge(direction);
            }
            this.lastTouchTime = 0;
            return;
        }

        this.lastTouchTime = currentTime;
        this.lastTouchPos = touchPos;

        // 检测是否点击了敌人
        const enemies = GameManager.instance.getEnemies();
        let clickedEnemy: Node | null = null;

        for (const enemy of enemies) {
            const enemyPos = enemy.getPosition();
            const dist = Vec3.distance(worldPos, enemyPos);
            if (dist < 40) {
                clickedEnemy = enemy;
                break;
            }
        }

        if (clickedEnemy) {
            this.currentTarget = clickedEnemy;
            this.isFiring = true;
        } else {
            this.targetPosition = worldPos;
            this.isMoving = true;
            this.isFiring = false;
        }
    }

    private onTouchMove(event: EventTouch) {
        const touchPos = event.getUILocation();
        const worldPos = this.convertToWorldPosition(touchPos);

        if (!this.isFiring) {
            this.targetPosition = worldPos;
        }
    }

    private onTouchEnd(event: EventTouch) {
        this.isFiring = false;
        this.currentTarget = null;
    }

    private updateMovement(deltaTime: number) {
        if (!this.isMoving || !this.targetPosition) return;

        const currentPos = this.node.getPosition();
        const direction = new Vec3().subtract(this.targetPosition, currentPos);
        const distance = direction.length();

        if (distance < 10) {
            this.isMoving = false;
            this.targetPosition = null;
            return;
        }

        direction.normalize();
        const stats = GameManager.instance.getPlayerStats();
        const moveDistance = stats.speed * deltaTime;

        const newPos = currentPos.add(direction.clone().multiplyScalar(moveDistance));
        this.node.setPosition(newPos);
    }

    private updateDodge(deltaTime: number) {
        // 更新闪避冷却
        if (this.dodgeCooldown > 0) {
            this.dodgeCooldown -= deltaTime;
        }

        // 执行闪避
        if (this.isDodging) {
            const currentPos = this.node.getPosition();
            const moveDistance = this.dodgeSpeed * deltaTime;
            const newPos = currentPos.add(this.dodgeDirection.clone().multiplyScalar(moveDistance));
            this.node.setPosition(newPos);

            // 闪避结束
            const traveled = new Vec3().subtract(newPos, currentPos).length();
            if (traveled >= this.dodgeDistance) {
                this.isDodging = false;
                this.dodgeCooldown = 1.5;
            }
        }
    }

    private triggerDodge(direction: Vec3) {
        if (this.isDodging || this.dodgeCooldown > 0) return;

        this.isDodging = true;
        this.dodgeDirection = direction.normalize();
        this.isMoving = false;
        this.targetPosition = null;

        console.log('💨 闪避！');
    }

    private updateAutoFire(deltaTime: number) {
        if (!this.isFiring || !this.currentTarget) return;

        this.fireTimer += deltaTime;
        const fireRate = 1 / 3;

        if (this.fireTimer >= fireRate) {
            this.fireTimer = 0;
            this.fire();
        }
    }

    private fire() {
        if (!this.currentTarget) return;

        const playerPos = this.node.getPosition();
        const targetPos = this.currentTarget.getPosition();
        const direction = new Vec3().subtract(targetPos, playerPos).normalize();

        const stats = GameManager.instance.getPlayerStats();
        const isCrit = Math.random() < stats.critRate;
        const damage = isCrit ? stats.attack * stats.critDamage : stats.attack;

        GameManager.instance.createBullet(
            playerPos.clone(),
            direction,
            damage,
            isCrit
        );
    }

    private updateDogFollow() {
        const dog = GameManager.instance.getDogPartner();
        if (!dog) return;

        const playerPos = this.node.getPosition();
        const dogPos = dog.getPosition();
        const offset = new Vec3(60, 30, 0);

        const targetPos = playerPos.clone().add(offset);
        const newPos = dogPos.lerp(targetPos, 0.05);
        dog.setPosition(newPos);
    }

    private convertToWorldPosition(uiPos: Vec2): Vec3 {
        // Cocos Creator 3.x中，UI坐标已经是世界坐标
        // 屏幕中心是(0,0)，范围是 -width/2 到 width/2
        return new Vec3(uiPos.x, uiPos.y, 0);
    }
}
