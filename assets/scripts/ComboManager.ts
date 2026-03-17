/**
 * 连击系统管理
 * 负责连击计数、倍率计算以及连击UI表现。
 */

import {
    _decorator,
    Component,
    Node,
    Label,
    UITransform,
    Color,
    Vec3,
    Layers,
    UIOpacity,
    tween
} from 'cc';
import { COMBO_CONFIG } from './Constants';
import { ComboData } from './types/GameTypes';

const { ccclass } = _decorator;

@ccclass('ComboManager')
export class ComboManager extends Component {
    private _comboData: ComboData = {
        count: 0,
        multiplier: 1,
        timeLeft: 0,
        isActive: false,
        lastKillTime: 0
    };

    private _comboLabel: Node | null = null;
    private _comboContainer: Node | null = null;
    private _uiRoot: Node | null = null;
    private _floatingTexts: Node[] = [];
    private _onComboChange: ((combo: ComboData) => void) | null = null;

    onLoad() {
        this.resetCombo();
    }

    onDestroy() {
        this.clearFloatingTexts();
    }

    update(deltaTime: number) {
        if (!this._comboData.isActive) {
            return;
        }

        this._comboData.timeLeft -= deltaTime;
        this.updateComboUI();

        if (this._comboData.timeLeft <= 0) {
            this.resetCombo();
        }
    }

    public setUIRoot(root: Node | null) {
        this._uiRoot = root;
        if (this._comboContainer && this._uiRoot) {
            this._comboContainer.setParent(this._uiRoot);
            this._comboContainer.layer = Layers.Enum.UI_2D;
            this.refreshComboPosition();
        }
    }

    public addKill(): ComboData {
        const now = Date.now() / 1000;

        if (this._comboData.isActive) {
            this._comboData.timeLeft = COMBO_CONFIG.comboTime;
            this._comboData.count += 1;
        } else {
            this._comboData.isActive = true;
            this._comboData.timeLeft = COMBO_CONFIG.comboTime;
            this._comboData.count = 1;
        }

        this._comboData.lastKillTime = now;
        this._comboData.multiplier = this.calculateMultiplier(this._comboData.count);

        this.showComboUI();
        this.showFloatingText(this._comboData.count, this._comboData.multiplier);
        this.emitComboChange();
        return this.getComboData();
    }

    public getComboData(): ComboData {
        return { ...this._comboData };
    }

    public getMultiplier(): number {
        return this._comboData.multiplier;
    }

    public getComboCount(): number {
        return this._comboData.count;
    }

    public getComboCritBonus(): number {
        return this._comboData.multiplier * COMBO_CONFIG.critBonus;
    }

    public getComboDamageBonus(): number {
        return this._comboData.multiplier;
    }

    public setOnComboChange(callback: (combo: ComboData) => void) {
        this._onComboChange = callback;
    }

    public resetCombo() {
        this._comboData = {
            count: 0,
            multiplier: 1,
            timeLeft: 0,
            isActive: false,
            lastKillTime: 0
        };

        this.hideComboUI();
        this.emitComboChange();
    }

    private emitComboChange() {
        if (this._onComboChange) {
            this._onComboChange(this.getComboData());
        }
    }

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

    private showComboUI() {
        if (!this._comboContainer) {
            this.createComboUI();
        }

        this.updateComboUI();
        if (this._comboContainer) {
            this._comboContainer.active = true;
        }
    }

    private hideComboUI() {
        if (this._comboContainer) {
            this._comboContainer.active = false;
        }
    }

    private createComboUI() {
        const parent = this._uiRoot ?? this.node;

        this._comboContainer = new Node('ComboContainer');
        this._comboContainer.layer = this._uiRoot ? Layers.Enum.UI_2D : parent.layer;
        this._comboContainer.setParent(parent);
        this._comboContainer.addComponent(UITransform).setContentSize(360, 56);
        this.refreshComboPosition();

        this._comboLabel = new Node('ComboLabel');
        this._comboLabel.layer = this._comboContainer.layer;
        this._comboLabel.setParent(this._comboContainer);
        this._comboLabel.addComponent(UITransform).setContentSize(360, 56);

        const label = this._comboLabel.addComponent(Label);
        label.string = '连击 0 x1';
        label.fontSize = 30;
        label.color = new Color(255, 255, 255, 255);
        label.isBold = true;

        this._comboContainer.active = false;
    }

    private refreshComboPosition() {
        if (!this._comboContainer) {
            return;
        }

        const parent = this._comboContainer.parent;
        if (!parent) {
            return;
        }

        const parentTransform = parent.getComponent(UITransform);
        const halfH = parentTransform ? parentTransform.contentSize.height * 0.5 : 300;
        const isNarrow = !!parentTransform && parentTransform.contentSize.width <= 680;
        this._comboContainer.setPosition(new Vec3(0, halfH - (isNarrow ? 148 : 124), 0));
    }

    private updateComboUI() {
        if (!this._comboLabel) {
            return;
        }

        const label = this._comboLabel.getComponent(Label);
        if (!label) {
            return;
        }

        const combo = this._comboData;
        const color = this.getColorByMultiplier(combo.multiplier);
        label.string = `连击 ${combo.count} x${combo.multiplier}`;
        label.color = color;
    }

    private getColorByMultiplier(multiplier: number): Color {
        if (multiplier >= 10) {
            return new Color(255, 215, 64, 255);
        }
        if (multiplier >= 5) {
            return new Color(255, 162, 65, 255);
        }
        if (multiplier >= 3) {
            return new Color(255, 110, 110, 255);
        }
        if (multiplier >= 2) {
            return new Color(255, 128, 196, 255);
        }
        return new Color(255, 255, 255, 255);
    }

    private showFloatingText(comboCount: number, multiplier: number) {
        const parent = this._uiRoot ?? this.node;
        const floatingText = new Node('ComboFloatingText');
        floatingText.layer = this._uiRoot ? Layers.Enum.UI_2D : parent.layer;
        floatingText.setParent(parent);

        const parentTransform = parent.getComponent(UITransform);
        const halfH = parentTransform ? parentTransform.contentSize.height * 0.5 : 300;
        const isNarrow = !!parentTransform && parentTransform.contentSize.width <= 680;
        const x = (Math.random() - 0.5) * 180;
        const y = halfH - (isNarrow ? 205 : 175) + (Math.random() - 0.5) * 30;
        floatingText.setPosition(new Vec3(x, y, 0));
        floatingText.addComponent(UITransform).setContentSize(260, 40);

        const label = floatingText.addComponent(Label);
        label.string = `连杀 +${comboCount}  x${multiplier}`;
        label.fontSize = 24;
        label.color = new Color(255, 215, 80, 255);
        label.isBold = true;

        const opacity = floatingText.addComponent(UIOpacity);
        opacity.opacity = 255;
        this._floatingTexts.push(floatingText);

        tween(floatingText)
            .to(0.45, { position: new Vec3(x, y + 56, 0) })
            .call(() => this.removeFloatingText(floatingText))
            .start();

        tween(opacity)
            .to(0.45, { opacity: 0 })
            .start();
    }

    private removeFloatingText(node: Node) {
        this._floatingTexts = this._floatingTexts.filter((n) => n !== node && n.isValid);
        if (node.isValid) {
            node.destroy();
        }
    }

    private clearFloatingTexts() {
        for (const node of this._floatingTexts) {
            if (node && node.isValid) {
                node.destroy();
            }
        }
        this._floatingTexts = [];
    }

    static create(node: Node): ComboManager {
        return node.addComponent(ComboManager);
    }
}
