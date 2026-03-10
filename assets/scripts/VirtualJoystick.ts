/**
 * 虚拟摇杆控制器
 * 用于移动端或桌面端的虚拟方向控制
 */

import { _decorator, Component, Node, Graphics, Color, UITransform, Vec3, Vec2, input, Input, EventTouch, EventKeyboard, KeyCode } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('VirtualJoystick')
export class VirtualJoystick extends Component {
    @property
    joystickRadius: number = 60; // 摇杆外圆半径

    @property
    stickRadius: number = 25; // 摇杆内圆半径

    @property
    joystickColor: Color = new Color(100, 100, 100, 150); // 外圆颜色

    @property
    stickColor: Color = new Color(200, 200, 200, 200); // 内圆颜色

    @property
    activeColor: Color = new Color(0, 150, 255, 200); // 激活时颜色

    // 摇杆节点
    private baseNode: Node | null = null;
    private stickNode: Node | null = null;
    private baseGraphics: Graphics | null = null;
    private stickGraphics: Graphics | null = null;

    // 状态
    private isTouching: boolean = false;
    private touchId: number | null = null;
    private stickPos: Vec2 = new Vec2(0, 0); // 摇杆当前位置（相对于中心）
    private inputDirection: Vec2 = new Vec2(0, 0); // 归一化的输入方向

    // 摇杆中心的世界坐标
    private joystickCenterPos: Vec3 = new Vec3();

    // 键盘控制
    private keysPressed: Set<KeyCode> = new Set();

    // 是否启用（手机模式下可以在左半屏点击激活摇杆）
    private joystickEnabled: boolean = true;

    onLoad() {
        // 为根节点添加 UITransform 并设置足够大的触摸区域
        const transform = this.node.addComponent(UITransform);
        // 设置触摸区域为摇杆半径的2.5倍，确保容易触摸到
        const touchSize = this.joystickRadius * 2.5;
        transform.setContentSize(touchSize, touchSize);

        // 触摸事件直接在节点上注册
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

        // 键盘事件
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);

        this.createJoystickUI();
    }

    private createJoystickUI() {
        // 创建摇杆底座（外圆）- 相对于父节点中心
        this.baseNode = new Node('JoystickBase');
        this.baseNode.setParent(this.node);
        this.baseNode.setPosition(new Vec3(0, 0, 0));

        const baseTransform = this.baseNode.addComponent(UITransform);
        baseTransform.setContentSize(this.joystickRadius * 2, this.joystickRadius * 2);

        this.baseGraphics = this.baseNode.addComponent(Graphics);
        this.drawBase();

        // 创建摇杆柄（内圆）
        this.stickNode = new Node('JoystickStick');
        this.stickNode.setParent(this.baseNode);
        this.stickNode.setPosition(new Vec3(0, 0, 0));

        const stickTransform = this.stickNode.addComponent(UITransform);
        stickTransform.setContentSize(this.stickRadius * 2, this.stickRadius * 2);

        this.stickGraphics = this.stickNode.addComponent(Graphics);
        this.drawStick();
    }

    private drawBase() {
        if (!this.baseGraphics) return;
        this.baseGraphics.clear();
        this.baseGraphics.fillColor = this.joystickColor;
        this.baseGraphics.circle(0, 0, this.joystickRadius);
        this.baseGraphics.fill();

        // 绘制中心点标记
        this.baseGraphics.strokeColor = new Color(150, 150, 150, 200);
        this.baseGraphics.lineWidth = 2;
        this.baseGraphics.circle(0, 0, this.joystickRadius * 0.3);
        this.baseGraphics.stroke();
    }

    private drawStick() {
        if (!this.stickGraphics) return;
        this.stickGraphics.clear();
        this.stickGraphics.fillColor = this.isTouching ? this.activeColor : this.stickColor;
        this.stickGraphics.circle(0, 0, this.stickRadius);
        this.stickGraphics.fill();
    }

    private onTouchStart(event: EventTouch): void {
        if (this.isTouching || !this.joystickEnabled) return;

        // 获取触摸位置（世界坐标）
        const touchPos = event.getUILocation();

        // 将摇杆中心转换为世界坐标
        const worldPos = this.getWorldPos();
        this.joystickCenterPos.set(worldPos.x, worldPos.y, 0);

        // 检测是否点击在摇杆区域内
        const dx = touchPos.x - this.joystickCenterPos.x;
        const dy = touchPos.y - this.joystickCenterPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 扩大检测范围，方便触摸
        if (distance <= this.joystickRadius * 2) {
            this.isTouching = true;
            this.touchId = event.getID();
            // 立即更新位置到触摸点
            this.stickPos = new Vec2(dx, dy);
            // 限制在最大距离内
            this.limitStickPosition();
            this.updateStickPosition();
            this.calculateInputDirection();
            this.drawStick();
        }
    }

    private onTouchMove(event: EventTouch): void {
        if (!this.isTouching || this.touchId !== event.getID()) return;

        const touchPos = event.getUILocation();

        // 计算摇杆偏移
        let dx = touchPos.x - this.joystickCenterPos.x;
        let dy = touchPos.y - this.joystickCenterPos.y;

        this.stickPos = new Vec2(dx, dy);
        this.limitStickPosition();
        this.updateStickPosition();
        this.calculateInputDirection();
        this.drawStick();
    }

    private onTouchEnd(event: EventTouch): void {
        if (!this.isTouching || this.touchId !== event.getID()) return;

        this.resetJoystick();
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

    private getWorldPos(): Vec3 {
        // 获取节点的世界坐标
        const worldPos = new Vec3();
        this.node.getWorldPosition(worldPos);
        return worldPos;
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

        // WASD 或方向键
        if (this.keysPressed.has(KeyCode.KEY_W) || this.keysPressed.has(KeyCode.ARROW_UP)) dy += 1;
        if (this.keysPressed.has(KeyCode.KEY_S) || this.keysPressed.has(KeyCode.ARROW_DOWN)) dy -= 1;
        if (this.keysPressed.has(KeyCode.KEY_A) || this.keysPressed.has(KeyCode.ARROW_LEFT)) dx -= 1;
        if (this.keysPressed.has(KeyCode.KEY_D) || this.keysPressed.has(KeyCode.ARROW_RIGHT)) dx += 1;

        // 归一化
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length > 0) {
            dx /= length;
            dy /= length;
        }

        this.inputDirection = new Vec2(dx, dy);

        // 更新摇杆视觉
        if (length > 0) {
            const visualDistance = (this.joystickRadius - this.stickRadius) * 0.8;
            this.stickPos = new Vec2(dx * visualDistance, dy * visualDistance);
            this.isTouching = true;
        } else {
            this.stickPos = new Vec2(0, 0);
            this.isTouching = false;
        }
        this.updateStickPosition();
        this.drawStick();
    }

    private updateStickPosition(): void {
        if (!this.stickNode) return;
        this.stickNode.setPosition(new Vec3(this.stickPos.x, this.stickPos.y, 0));
    }

    private calculateInputDirection(): void {
        const maxDistance = this.joystickRadius - this.stickRadius;
        if (maxDistance > 0) {
            const distance = Math.sqrt(this.stickPos.x * this.stickPos.x + this.stickPos.y * this.stickPos.y);
            if (distance > 0) {
                this.inputDirection = new Vec2(
                    this.stickPos.x / maxDistance,
                    this.stickPos.y / maxDistance
                );
                // 限制最大为1
                const mag = Math.sqrt(this.inputDirection.x * this.inputDirection.x + this.inputDirection.y * this.inputDirection.y);
                if (mag > 1) {
                    this.inputDirection.x /= mag;
                    this.inputDirection.y /= mag;
                }
            } else {
                this.inputDirection = new Vec2(0, 0);
            }
        }
    }

    private resetJoystick(): void {
        this.isTouching = false;
        this.touchId = null;
        this.stickPos = new Vec2(0, 0);
        this.inputDirection = new Vec2(0, 0);
        this.updateStickPosition();
        this.drawStick();
    }

    /**
     * 获取当前输入方向（归一化）
     * @returns Vec2 归一化的方向向量，范围 [-1, 1]
     */
    public getInputDirection(): Vec2 {
        return new Vec2(this.inputDirection.x, this.inputDirection.y);
    }

    /**
     * 获取输入强度（0-1）
     */
    public getInputMagnitude(): number {
        return Math.min(1, Math.sqrt(this.inputDirection.x ** 2 + this.inputDirection.y ** 2));
    }

    /**
     * 是否有输入
     */
    public hasInput(): boolean {
        return this.inputDirection.x !== 0 || this.inputDirection.y !== 0;
    }

    /**
     * 设置启用状态
     */
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
