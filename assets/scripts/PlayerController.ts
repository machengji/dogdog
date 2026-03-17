import {
    _decorator,
    Component,
    Node,
    Vec2,
    Vec3,
    input,
    Input,
    EventKeyboard,
    EventTouch,
    KeyCode
} from 'cc';
import { GameManager } from './GameManager';
import { GameState } from './types/GameTypes';
import { VirtualJoystick } from './VirtualJoystick';

const { ccclass } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends Component {
    private targetPosition: Vec3 | null = null;
    private isMoving = false;

    private fireTimer = 0;
    private isFiring = false;
    private currentTarget: Node | null = null;

    private isDodging = false;
    private dodgeCooldown = 0;
    private readonly dodgeSpeed = 800;
    private readonly dodgeDistance = 150;
    private dodgeDirection: Vec3 = new Vec3(1, 0, 0);
    private dodgeStartPos: Vec3 = new Vec3();

    private lastTouchTime = 0;
    private lastTouchPos: Vec2 = new Vec2();

    private virtualJoystick: VirtualJoystick | null = null;

    onLoad() {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    start() {
        this.virtualJoystick = GameManager.instance.getVirtualJoystick();
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    update(deltaTime: number) {
        if (GameManager.instance.gameState !== GameState.PLAYING) {
            return;
        }

        if (!this.virtualJoystick) {
            this.virtualJoystick = GameManager.instance.getVirtualJoystick();
        }

        this.updateJoystickMovement(deltaTime);
        this.updateDodge(deltaTime);
        this.updateAutoFire(deltaTime);
        this.updateDogFollow();
    }

    private onKeyDown(event: EventKeyboard) {
        if (event.keyCode !== KeyCode.SPACE) {
            return;
        }

        if (this.isMoving && this.targetPosition) {
            const playerPos = this.node.getPosition();
            const direction = this.targetPosition.clone().subtract(playerPos);
            this.triggerDodge(direction);
        } else {
            this.triggerDodge(new Vec3(1, 0, 0));
        }
    }

    private onTouchStart(event: EventTouch) {
        const touchPos = event.getUILocation();
        if (this.virtualJoystick?.isTouchInControlArea(touchPos)) {
            return;
        }
        const now = Date.now();

        // Double tap to dodge.
        if (now - this.lastTouchTime < 300) {
            if (this.virtualJoystick && this.virtualJoystick.hasInput()) {
                const dir = this.virtualJoystick.getInputDirection();
                this.triggerDodge(new Vec3(dir.x, dir.y, 0));
            } else {
                this.triggerDodge(new Vec3(1, 0, 0));
            }
            this.lastTouchTime = 0;
            return;
        }

        this.lastTouchTime = now;
        this.lastTouchPos = touchPos;

        const worldPos = this.convertToWorldPosition(touchPos);
        const enemies = GameManager.instance.getEnemies();

        let clickedEnemy: Node | null = null;
        for (const enemy of enemies) {
            const dist = Vec3.distance(worldPos, enemy.getPosition());
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

    private onTouchEnd(_event: EventTouch) {
        const touchPos = _event.getUILocation();
        if (this.virtualJoystick?.isTouchInControlArea(touchPos)) {
            return;
        }
        this.isFiring = false;
        this.currentTarget = null;
    }

    private updateJoystickMovement(deltaTime: number) {
        if (this.isDodging) {
            return;
        }

        if (!this.virtualJoystick || !this.virtualJoystick.hasInput()) {
            this.isMoving = false;
            return;
        }

        const inputDir = this.virtualJoystick.getInputDirection();
        const magnitude = this.virtualJoystick.getInputMagnitude();

        if (magnitude <= 0.1) {
            this.isMoving = false;
            return;
        }

        const currentPos = this.node.getPosition();
        const stats = GameManager.instance.getPlayerStats();
        const moveDistance = stats.speed * deltaTime * magnitude;

        const newPos = currentPos.add(new Vec3(inputDir.x * moveDistance, inputDir.y * moveDistance, 0));
        this.node.setPosition(newPos);

        this.targetPosition = newPos;
        this.isMoving = true;
    }

    private updateDodge(deltaTime: number) {
        if (this.dodgeCooldown > 0) {
            this.dodgeCooldown -= deltaTime;
        }

        if (!this.isDodging) {
            return;
        }

        const currentPos = this.node.getPosition();
        const moveDistance = this.dodgeSpeed * deltaTime;
        const newPos = currentPos.add(this.dodgeDirection.clone().multiplyScalar(moveDistance));
        this.node.setPosition(newPos);

        const traveled = newPos.clone().subtract(this.dodgeStartPos).length();
        if (traveled >= this.dodgeDistance) {
            this.isDodging = false;
            this.dodgeCooldown = 1.5;
        }
    }

    private triggerDodge(direction: Vec3) {
        if (this.isDodging || this.dodgeCooldown > 0) {
            return;
        }

        this.isDodging = true;
        this.dodgeDirection = direction.lengthSqr() > 0 ? direction.normalize() : new Vec3(1, 0, 0);
        this.dodgeStartPos = this.node.getPosition().clone();

        this.isMoving = false;
        this.targetPosition = null;
    }

    private updateAutoFire(deltaTime: number) {
        const stats = GameManager.instance.getPlayerStats();
        const range = stats.range || 400;

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

        if (nearestEnemy) {
            this.currentTarget = nearestEnemy;
            this.isFiring = true;
        } else {
            this.isFiring = false;
            this.currentTarget = null;
        }

        if (!this.isFiring || !this.currentTarget) {
            return;
        }

        this.fireTimer += deltaTime;
        const fireRate = 1 / 3;

        if (this.fireTimer >= fireRate) {
            this.fireTimer = 0;
            this.fire();
        }
    }

    private fire() {
        if (!this.currentTarget) {
            return;
        }

        const playerPos = this.node.getPosition();
        const targetPos = this.currentTarget.getPosition();
        const direction = targetPos.clone().subtract(playerPos).normalize();

        const stats = GameManager.instance.getPlayerStats();
        const isCrit = Math.random() < stats.critRate;
        const damage = isCrit ? stats.attack * stats.critDamage : stats.attack;

        GameManager.instance.createBullet(playerPos.clone(), direction, damage, isCrit);
    }

    private updateDogFollow() {
        const dog = GameManager.instance.getDogPartner();
        if (!dog) {
            return;
        }

        const playerPos = this.node.getPosition();
        const dogPos = dog.getPosition();
        const targetPos = playerPos.clone().add(new Vec3(60, 30, 0));
        const newPos = dogPos.lerp(targetPos, 0.05);
        dog.setPosition(newPos);
    }

    private convertToWorldPosition(uiPos: Vec2): Vec3 {
        const halfWidth = GameManager.instance.getHalfWidth();
        const halfHeight = GameManager.instance.getHalfHeight();
        const playerPos = GameManager.instance.getPlayer()?.getPosition() ?? new Vec3();

        return new Vec3(
            playerPos.x + uiPos.x - halfWidth,
            playerPos.y + uiPos.y - halfHeight,
            0
        );
    }
}
