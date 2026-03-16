/**
 * 连击管理器
 * 狗王枪神 - 连击Combo系统
 *
 * 功能：
 * - 记录连击数
 * - 计算连击倍数
 * - 管理连击超时
 */

import { _decorator, Component, Node, Label, Graphics, UITransform, Color, Vec3 } from 'cc';
import { COMBO_CONFIG } from './Constants';
import { ComboData } from './types/GameTypes';

const { ccclass, property } = _decorator;

@ccclass('ComboManager')
export class ComboManager extends Component {

    // ==================== 连击数据 ====================
    private _comboData: ComboData = {
        count: 0,
        multiplier: 1,
        timeLeft: 0,
        isActive: false,
        lastKillTime: 0
    };

    // ==================== UI 节点 ====================
    private _comboLabel: Node | null = null;
    private _comboContainer: Node | null = null;
    private _floatingTexts: Node[] = [];

    // ==================== 回调 ====================
    private _onComboChange: ((combo: ComboData) => void) | null = null;

    // ==================== 生命周期 ====================
    onLoad() {
        this.resetCombo();
    }

    update(deltaTime: number) {
        if (!this._comboData.isActive) return;

        // 更新连击倒计时
        this._comboData.timeLeft -= deltaTime;

        // 更新UI显示
        this.updateComboUI();

        // 连击超时
        if (this._comboData.timeLeft <= 0) {
            this.resetCombo();
        }
    }

    // ==================== 公开接口 ====================

    /**
     * 增加连击数
     * @returns 是否有连击增长
     */
    public addKill(): ComboData {
        const now = Date.now() / 1000;

        // 如果连击有效，重置倒计时
        if (this._comboData.isActive) {
            this._comboData.timeLeft = COMBO_CONFIG.comboTime;
            this._comboData.count++;
        } else {
            // 开始新的连击
            this._comboData.isActive = true;
            this._comboData.timeLeft = COMBO_CONFIG.comboTime;
            this._comboData.count = 1;
        }

        this._comboData.lastKillTime = now;

        // 计算连击倍数
        this._comboData.multiplier = this.calculateMultiplier(this._comboData.count);

        // 显示连击UI
        this.showComboUI();

        // 触发飘字特效
        this.showFloatingText(this._comboData.count, this._comboData.multiplier);

        // 回调通知
        if (this._onComboChange) {
            this._onComboChange(this._comboData);
        }

        return this._comboData;
    }

    /**
     * 获取当前连击数据
     */
    public getComboData(): ComboData {
        return { ...this._comboData };
    }

    /**
     * 获取当前连击倍数
     */
    public getMultiplier(): number {
        return this._comboData.multiplier;
    }

    /**
     * 获取当前连击数
     */
    public getComboCount(): number {
        return this._comboData.count;
    }

    /**
     * 获取连击加成的暴击率
     */
    public getComboCritBonus(): number {
        return this._comboData.multiplier * COMBO_CONFIG.critBonus;
    }

    /**
     * 获取连击加成的伤害
     */
    public getComboDamageBonus(): number {
        return this._comboData.multiplier;
    }

    /**
     * 设置连击变化回调
     */
    public setOnComboChange(callback: (combo: ComboData) => void) {
        this._onComboChange = callback;
    }

    /**
     * 重置连击
     */
    public resetCombo() {
        this._comboData = {
            count: 0,
            multiplier: 1,
            timeLeft: 0,
            isActive: false,
            lastKillTime: 0
        };
        this.hideComboUI();

        if (this._onComboChange) {
            this._onComboChange(this._comboData);
        }
    }

    // ==================== 私有方法 ====================

    /**
     * 计算连击倍数
     */
    private calculateMultiplier(comboCount: number): number {
        const thresholds = COMBO_CONFIG.thresholds;
        const multipliers = COMBO_CONFIG.multipliers;

        for (let i = thresholds.length - 1; i >= 0; i--) {
            if (comboCount >= thresholds[i]) {
                return multipliers[i];
            }
        }

        return multipliers[0];
    }

    /**
     * 显示连击UI
     */
    private showComboUI() {
        if (!this._comboContainer) {
            this.createComboUI();
        }

        if (this._comboContainer) {
            this._comboContainer.active = true;
        }
    }

    /**
     * 更新连击UI
     */
    private updateComboUI() {
        if (!this._comboLabel) return;

        const combo = this._comboData;
        const label = this._comboLabel.getComponent(Label);
        if (label) {
            // 根据连击数显示不同颜色
            let color = '#FFFFFF';
            if (combo.multiplier >= 10) {
                color = '#FFD700';  // 金色
            } else if (combo.multiplier >= 5) {
                color = '#FFA500';  // 橙色
            } else if (combo.multiplier >= 3) {
                color = '#FF6B6B';  // 红色
            } else if (combo.multiplier >= 2) {
                color = '#FF69B4';  // 粉色
            }

            label.string = `${combo.count} COMBO x${combo.multiplier} 🔥`;
            label.color = new Color().fromHEX(color);
        }
    }

    /**
     * 隐藏连击UI
     */
    private hideComboUI() {
        if (this._comboContainer) {
            this._comboContainer.active = false;
        }
    }

    /**
     * 创建连击UI
     */
    private createComboUI() {
        const halfW = 400; // 假设屏幕宽度
        const halfH = 300; // 假设屏幕高度

        // 创建连击显示容器
        this._comboContainer = new Node('ComboContainer');
        this._comboContainer.setParent(this.node);
        this._comboContainer.setPosition(new Vec3(0, halfH - 80, 0));

        const transform = this._comboContainer.addComponent(UITransform);
        transform.setContentSize(300, 50);

        // 创建连击标签
        this._comboLabel = new Node('ComboLabel');
        this._comboLabel.setParent(this._comboContainer);
        this._comboLabel.setPosition(new Vec3(0, 0, 0));

        const labelTransform = this._comboLabel.addComponent(UITransform);
        labelTransform.setContentSize(300, 50);

        const label = this._comboLabel.addComponent(Label);
        label.string = '1 COMBO x1 🔥';
        label.fontSize = 28;
        label.color = new Color(255, 255, 255, 255);
    }

    /**
     * 显示飘字特效
     */
    private showFloatingText(comboCount: number, multiplier: number) {
        // 创建一个简单的飘字节点
        const floatingText = new Node('FloatingText');
        floatingText.setParent(this.node);

        const halfW = 400;
        const halfH = 300;

        // 随机位置
        const x = (Math.random() - 0.5) * 200;
        const y = halfH - 120 + (Math.random() - 0.5) * 50;
        floatingText.setPosition(new Vec3(x, y, 0));

        const transform = floatingText.addComponent(UITransform);
        transform.setContentSize(150, 40);

        const label = floatingText.addComponent(Label);
        label.string = `+${comboCount}`;
        label.fontSize = 24;
        label.color = new Color().fromHEX('#FFD700');

        // 简单的淡出动画
        let lifeTime = 0.5;
        let opacity = 1.0;

        const updateFloating = (delta: number) => {
            lifeTime -= delta;
            if (lifeTime <= 0) {
                floatingText.destroy();
                this.node.off('update', updateFloating);
                return;
            }

            // 向上移动
            const pos = floatingText.getPosition();
            floatingText.setPosition(pos.x, pos.y + 50 * delta, 0);

            // 淡出
            opacity -= delta * 2;
            if (opacity < 0) opacity = 0;
            label.color = new Color(255, 215, 0, Math.floor(opacity * 255));
        };

        this.node.on('update', updateFloating);
    }

    // ==================== 静态方法 ====================

    /**
     * 创建ComboManager组件
     */
    static create(node: Node): ComboManager {
        return node.addComponent(ComboManager);
    }
}
