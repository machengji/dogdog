/**
 * 虚拟摇杆控制器
 * 默认使用动态摇杆：在触摸区域内按下时于触点生成摇杆中心。
 */

import {
    _decorator,
    Component,
    Node,
    Graphics,
    Color,
    UITransform,
    Vec3,
    Vec2,
    input,
    Input,
    EventTouch,
    EventKeyboard,
    KeyCode
} from 'cc';
import { view } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('VirtualJoystick')
export class VirtualJoystick extends Component {
    @property
    joystickRadius = 60;

    @property
    stickRadius = 25;

    @property
    joystickColor: Color = new Color(100, 100, 100, 150);

    @property
    stickColor: Color = new Color(200, 200, 200, 200);

    @property
    activeColor: Color = new Color(0, 150, 255, 200);

    @property
    dynamicSpawn = true;

    private baseNode: Node | null = null;
    private stickNode: Node | null = null;
    private baseGraphics: Graphics | null = null;
    private stickGraphics: Graphics | null = null;
    private touchAreaTransform: UITransform | null = null;

    private isTouching = false;
    private touchId: number | null = null;
    private stickPos: Vec2 = new Vec2(0, 0);
    private inputDirection: Vec2 = new Vec2(0, 0);
    private joystickCenterPos: Vec3 = new Vec3();

    private keysPressed: Set<KeyCode> = new Set();
    private joystickEnabled = true;

    onLoad() {
        this.touchAreaTransform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        if (this.touchAreaTransform.contentSize.width < 1 || this.touchAreaTransform.contentSize.height < 1) {
            this.touchAreaTransform.setContentSize(this.joystickRadius * 2.5, this.joystickRadius * 2.5);
        }

        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);

        this.createJoystickUI();
        this.resetVisual();
    }

    private createJoystickUI() {
        this.baseNode = new Node('JoystickBase');
        this.baseNode.setParent(this.node);
        this.baseNode.layer = this.node.layer;
        this.baseNode.setPosition(this.getDefaultBaseLocalPosition());
        this.baseNode.addComponent(UITransform).setContentSize(this.joystickRadius * 2, this.joystickRadius * 2);

        this.baseGraphics = this.baseNode.addComponent(Graphics);
        this.drawBase();

        this.stickNode = new Node('JoystickStick');
        this.stickNode.setParent(this.baseNode);
        this.stickNode.layer = this.node.layer;
        this.stickNode.setPosition(new Vec3(0, 0, 0));
        this.stickNode.addComponent(UITransform).setContentSize(this.stickRadius * 2, this.stickRadius * 2);

        this.stickGraphics = this.stickNode.addComponent(Graphics);
        this.drawStick();
    }

    private drawBase() {
        if (!this.baseGraphics) {
            return;
        }
        this.baseGraphics.clear();
        this.baseGraphics.fillColor = this.joystickColor;
        this.baseGraphics.circle(0, 0, this.joystickRadius);
        this.baseGraphics.fill();

        this.baseGraphics.strokeColor = new Color(150, 150, 150, 200);
        this.baseGraphics.lineWidth = 2;
        this.baseGraphics.circle(0, 0, this.joystickRadius * 0.3);
        this.baseGraphics.stroke();
    }

    private drawStick() {
        if (!this.stickGraphics) {
            return;
        }
        this.stickGraphics.clear();
        this.stickGraphics.fillColor = this.isTouching ? this.activeColor : this.stickColor;
        this.stickGraphics.circle(0, 0, this.stickRadius);
        this.stickGraphics.fill();
    }

    private onTouchStart(event: EventTouch): void {
        if (this.isTouching || !this.joystickEnabled) {
            return;
        }

        const touchPos = event.getUILocation();
        if (!this.isTouchInControlArea(touchPos)) {
            return;
        }

        this.isTouching = true;
        this.touchId = event.getID();

        if (this.dynamicSpawn) {
            this.placeJoystickAtTouch(touchPos);
            this.stickPos.set(0, 0);
            this.inputDirection.set(0, 0);
        } else {
            const worldPos = this.getBaseWorldPos();
            const uiPos = this.worldARToUI(worldPos);
            this.joystickCenterPos.set(uiPos.x, uiPos.y, 0);

            this.stickPos = new Vec2(
                touchPos.x - this.joystickCenterPos.x,
                touchPos.y - this.joystickCenterPos.y
            );
            this.limitStickPosition();
            this.calculateInputDirection();
        }

        this.setJoystickVisible(true);
        this.updateStickPosition();
        this.drawStick();
    }

    private onTouchMove(event: EventTouch): void {
        if (!this.isTouching || this.touchId !== event.getID()) {
            return;
        }

        const touchPos = event.getUILocation();
        this.stickPos = new Vec2(
            touchPos.x - this.joystickCenterPos.x,
            touchPos.y - this.joystickCenterPos.y
        );
        this.limitStickPosition();
        this.updateStickPosition();
        this.calculateInputDirection();
        this.drawStick();
    }

    private onTouchEnd(event: EventTouch): void {
        if (!this.isTouching || this.touchId !== event.getID()) {
            return;
        }
        this.resetJoystick();
    }

    private onKeyDown(event: EventKeyboard): void {
        this.keysPressed.add(event.keyCode);
        this.updateKeyboardInput();
    }

    private onKeyUp(event: EventKeyboard): void {
        this.keysPressed.delete(event.keyCode);
        this.updateKeyboardInput();
    }

    private updateKeyboardInput(): void {
        let dx = 0;
        let dy = 0;

        if (this.keysPressed.has(KeyCode.KEY_W) || this.keysPressed.has(KeyCode.ARROW_UP)) dy += 1;
        if (this.keysPressed.has(KeyCode.KEY_S) || this.keysPressed.has(KeyCode.ARROW_DOWN)) dy -= 1;
        if (this.keysPressed.has(KeyCode.KEY_A) || this.keysPressed.has(KeyCode.ARROW_LEFT)) dx -= 1;
        if (this.keysPressed.has(KeyCode.KEY_D) || this.keysPressed.has(KeyCode.ARROW_RIGHT)) dx += 1;

        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
            dx /= length;
            dy /= length;
        }

        this.inputDirection = new Vec2(dx, dy);

        if (length > 0) {
            const visualDistance = (this.joystickRadius - this.stickRadius) * 0.8;
            this.stickPos = new Vec2(dx * visualDistance, dy * visualDistance);

            if (this.dynamicSpawn) {
                this.ensureDefaultJoystickVisible();
            }
            this.isTouching = true;
        } else if (!this.isTouching) {
            this.stickPos = new Vec2(0, 0);
            this.inputDirection = new Vec2(0, 0);
            if (this.dynamicSpawn) {
                this.setJoystickVisible(false);
            }
        }

        this.updateStickPosition();
        this.drawStick();
    }

    private limitStickPosition() {
        const maxDistance = this.joystickRadius - this.stickRadius;
        const distance = Math.sqrt(this.stickPos.x * this.stickPos.x + this.stickPos.y * this.stickPos.y);
        if (distance > maxDistance) {
            const ratio = maxDistance / distance;
            this.stickPos.x *= ratio;
            this.stickPos.y *= ratio;
        }
    }

    private calculateInputDirection(): void {
        const maxDistance = this.joystickRadius - this.stickRadius;
        if (maxDistance <= 0) {
            this.inputDirection = new Vec2(0, 0);
            return;
        }

        const distance = Math.sqrt(this.stickPos.x * this.stickPos.x + this.stickPos.y * this.stickPos.y);
        if (distance <= 0) {
            this.inputDirection = new Vec2(0, 0);
            return;
        }

        this.inputDirection = new Vec2(
            this.stickPos.x / maxDistance,
            this.stickPos.y / maxDistance
        );

        const mag = Math.sqrt(this.inputDirection.x * this.inputDirection.x + this.inputDirection.y * this.inputDirection.y);
        if (mag > 1) {
            this.inputDirection.x /= mag;
            this.inputDirection.y /= mag;
        }
    }

    private updateStickPosition(): void {
        if (!this.stickNode) {
            return;
        }
        this.stickNode.setPosition(new Vec3(this.stickPos.x, this.stickPos.y, 0));
    }

    private resetJoystick(): void {
        this.isTouching = false;
        this.touchId = null;
        this.stickPos = new Vec2(0, 0);
        this.inputDirection = new Vec2(0, 0);
        this.updateStickPosition();
        this.drawStick();

        if (this.dynamicSpawn) {
            this.setJoystickVisible(false);
        }
    }

    private resetVisual() {
        this.stickPos = new Vec2(0, 0);
        this.inputDirection = new Vec2(0, 0);
        this.updateStickPosition();
        this.setJoystickVisible(!this.dynamicSpawn);
        this.drawStick();
    }

    private setJoystickVisible(visible: boolean) {
        if (this.baseNode) {
            this.baseNode.active = visible;
        }
    }

    private ensureDefaultJoystickVisible() {
        if (!this.baseNode) {
            return;
        }
        if (!this.baseNode.active) {
            this.baseNode.setPosition(this.getDefaultBaseLocalPosition());
            const worldPos = this.getBaseWorldPos();
            this.joystickCenterPos.set(worldPos.x, worldPos.y, 0);
        }
        this.baseNode.active = true;
    }

    private placeJoystickAtTouch(touchPos: Vec2) {
        if (!this.baseNode) {
            return;
        }

        const localPos = this.convertUILocationToLocal(touchPos);
        this.baseNode.setPosition(localPos.x, localPos.y, 0);
        this.joystickCenterPos.set(touchPos.x, touchPos.y, 0);
    }

    private getBaseWorldPos(): Vec3 {
        if (!this.baseNode) {
            return this.node.getWorldPosition();
        }
        const worldPos = new Vec3();
        this.baseNode.getWorldPosition(worldPos);
        return worldPos;
    }

    private getDefaultBaseLocalPosition(): Vec3 {
        const area = this.touchAreaTransform?.contentSize;
        const width = area?.width ?? 300;
        const height = area?.height ?? 300;
        return new Vec3(-width * 0.28, -height * 0.28, 0);
    }

    private convertUILocationToLocal(uiPos: Vec2): Vec2 {
        if (!this.touchAreaTransform) {
            return new Vec2(0, 0);
        }
        const worldARPos = this.uiToWorldAR(uiPos);
        const local = this.touchAreaTransform.convertToNodeSpaceAR(worldARPos);
        return new Vec2(local.x, local.y);
    }

    private uiToWorldAR(uiPos: Vec2): Vec3 {
        const visibleSize = view.getVisibleSize();
        return new Vec3(
            uiPos.x - visibleSize.width * 0.5,
            uiPos.y - visibleSize.height * 0.5,
            0
        );
    }

    private worldARToUI(worldPos: Vec3): Vec2 {
        const visibleSize = view.getVisibleSize();
        return new Vec2(
            worldPos.x + visibleSize.width * 0.5,
            worldPos.y + visibleSize.height * 0.5
        );
    }

    public isTouchInControlArea(uiPos: Vec2): boolean {
        const localPos = this.convertUILocationToLocal(uiPos);
        const size = this.touchAreaTransform?.contentSize;
        if (!size) {
            return true;
        }

        const halfW = size.width * 0.5;
        const halfH = size.height * 0.5;
        return localPos.x >= -halfW && localPos.x <= halfW && localPos.y >= -halfH && localPos.y <= halfH;
    }

    public getInputDirection(): Vec2 {
        return new Vec2(this.inputDirection.x, this.inputDirection.y);
    }

    public getInputMagnitude(): number {
        return Math.min(1, Math.sqrt(this.inputDirection.x ** 2 + this.inputDirection.y ** 2));
    }

    public hasInput(): boolean {
        return this.inputDirection.x !== 0 || this.inputDirection.y !== 0;
    }

    public setEnabled(enabled: boolean): void {
        this.joystickEnabled = enabled;
        if (!enabled) {
            this.resetJoystick();
        }
    }

    onDestroy() {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    }
}
