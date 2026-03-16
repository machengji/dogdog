/**
 * 玩家控制器
 * 狗王枪神
 * 
 * 控制方式：
 * - 虚拟摇杆：控制玩家移动
 * - 点击敌人：自动瞄准射击
 * - 双击屏幕/空格键：闪避
 */

import { _decorator, Component, Node, Vec3, Vec2, input, Input, EventTouch, EventKeyboard, KeyCode } from 'cc';
import { GameManager } from './GameManager';
import { GameState } from './types/GameTypes';
import { VirtualJoystick } from './VirtualJoystick';

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
    private dodgeStartPos: Vec3 = new Vec3(); // 记录闪避开始位置
    
    // 双击检测
    private lastTouchTime: number = 0;
    private lastTouchPos: Vec2 = new Vec2();
    
    // 虚拟摇杆
    private virtualJoystick: VirtualJoystick | null = null;

    onLoad() {
        // 注册键盘事件（空格键闪避）
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    start() {
        // 获取虚拟摇杆引用
        this.virtualJoystick = GameManager.instance.getVirtualJoystick();
        
        // 延迟注册触摸事件，确保 HUD 创建完成
        this.scheduleOnce(() => {
            this.registerTouchEvents();
        }, 0.1);
    }

    private registerTouchEvents() {
        // 直接在 GameManager 的节点上注册触摸事件（用于点击敌人）
        const gameNode = GameManager.instance.node;
        if (gameNode) {
            gameNode.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
            gameNode.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            gameNode.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
            console.log('✅ 触摸事件已注册');
        } else {
            console.log('❌ 找不到 GameManager 节点');
        }
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    private onKeyDown(event: EventKeyboard) {
        if (event.keyCode === KeyCode.SPACE) {
            if (this.isMoving && this.targetPosition) {
                const playerPos = this.node.getPosition();
                const direction = this.targetPosition.clone().subtract(playerPos);
                this.triggerDodge(direction);
            } else {
                this.triggerDodge(new Vec3(1, 0, 0));
            }
        }
    }

    update(deltaTime: number) {
        if (GameManager.instance.gameState !== GameState.PLAYING) return;

        this.updateJoystickMovement(deltaTime);
        this.updateDodge(deltaTime);
        this.updateAutoFire(deltaTime);
        this.updateDogFollow();
    }

    private onTouchStart(event: EventTouch) {
        const touchPos = event.getUILocation();
        const currentTime = Date.now();

        // 检测双击触发闪避（300ms 内两次点击）
        if (currentTime - this.lastTouchTime < 300) {
            // 使用虚拟摇杆的方向进行闪避，如果没有输入则默认向右
            if (this.virtualJoystick && this.virtualJoystick.hasInput()) {
                const dir = this.virtualJoystick.getInputDirection();
                this.triggerDodge(new Vec3(dir.x, dir.y, 0));
            } else {
                this.triggerDodge(new Vec3(1, 0, 0)); // 默认向右闪避
            }
            this.lastTouchTime = 0;
            return;
        }

        this.lastTouchTime = currentTime;
        this.lastTouchPos = touchPos;

        // 检测是否点击了敌人
        const enemies = GameManager.instance.getEnemies();
        let clickedEnemy: Node | null = null;

        // 将 UI 坐标转换为世界坐标
        const worldPos = this.convertToWorldPosition(touchPos);

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
        }
    }

    private onTouchEnd(event: EventTouch) {
        // 只重置射击状态，不影响移动
        this.isFiring = false;
        this.currentTarget = null;
    }

    private updateJoystickMovement(deltaTime: number) {
        // 如果正在闪避，不响应摇杆
        if (this.isDodging) return;

        // 从虚拟摇杆获取输入
        if (this.virtualJoystick && this.virtualJoystick.hasInput()) {
            const inputDir = this.virtualJoystick.getInputDirection();
            const magnitude = this.virtualJoystick.getInputMagnitude();

            if (magnitude > 0.1) { // 死区
                const currentPos = this.node.getPosition();
                const stats = GameManager.instance.getPlayerStats();
                const moveDistance = stats.speed * deltaTime * magnitude;

                // 计算新位置
                let newPos = currentPos.add(new Vec3(inputDir.x * moveDistance, inputDir.y * moveDistance, 0));

                // 无边界限制，可以自由移动到屏幕外
                this.node.setPosition(newPos);
                
                // 更新目标位置用于闪避方向
                this.targetPosition = newPos;
                this.isMoving = true;
            } else {
                this.isMoving = false;
            }
        } else {
            this.isMoving = false;
        }
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
            let newPos = currentPos.add(this.dodgeDirection.clone().multiplyScalar(moveDistance));

            // 无边界限制
            this.node.setPosition(newPos);

            // 计算从闪避开始位置到现在位置的距离
            const traveled = newPos.clone().subtract(this.dodgeStartPos).length();
            if (traveled >= this.dodgeDistance) {
                this.isDodging = false;
                this.dodgeCooldown = 1.5;
                console.log('✅ 闪避结束');
            }
        }
    }

    private triggerDodge(direction: Vec3) {
        if (this.isDodging || this.dodgeCooldown > 0) return;

        this.isDodging = true;
        this.dodgeDirection = direction.normalize();
        this.dodgeStartPos = this.node.getPosition().clone(); // 记录闪避开始位置
        this.isMoving = false;
        this.targetPosition = null;

        console.log('💨 闪避！');
    }

    private updateAutoFire(deltaTime: number) {
        // 自动寻找并攻击最近的敌人（射程内）
        const stats = GameManager.instance.getPlayerStats();
        const range = stats.range || 400; // 射程

        // 寻找最近的目标
        const enemies = GameManager.instance.getEnemies();
        const playerPos = this.node.getPosition();
        let nearestEnemy: Node | null = null;
        let nearestDist = range;

        for (const enemy of enemies) {
            const dist = Vec3.distance(playerPos, enemy.getPosition());
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
            }
        }

        // 更新目标
        if (nearestEnemy) {
            this.currentTarget = nearestEnemy;
            this.isFiring = true;
        } else {
            this.isFiring = false;
            this.currentTarget = null;
        }

        // 射击
        if (this.isFiring && this.currentTarget) {
            this.fireTimer += deltaTime;
            const fireRate = 1 / 3;

            if (this.fireTimer >= fireRate) {
                this.fireTimer = 0;
                this.fire();
            }
        }
    }

    private fire() {
        if (!this.currentTarget) return;

        const playerPos = this.node.getPosition();
        const targetPos = this.currentTarget.getPosition();
        const direction = targetPos.clone().subtract(playerPos).normalize();

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
        // Cocos Creator 3.x 中，UI 坐标已经是世界坐标
        // 屏幕中心是 (0,0)，范围是 -width/2 到 width/2
        return new Vec3(uiPos.x, uiPos.y, 0);
    }
}
