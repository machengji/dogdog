import { _decorator, Component, Node, Vec3, Label, Color, Graphics, UITransform, tween } from 'cc';
import { GameManager } from './GameManager';
import { DOG_CONFIG, DOG_MOOD_CONFIG } from './Constants';
import { GameState, DogMood } from './types/GameTypes';
import { EnemyController } from './EnemyController';

const { ccclass } = _decorator;

@ccclass('DogController')
export class DogController extends Component {
    private config: any = null;
    private affection = 0;
    private maxAffection = 100;

    private skillCooldown = 0;
    private skillInterval = 5;
    private targetEnemy: Node | null = null;
    private attackTimer = 0;

    private _currentMood: DogMood = DogMood.NORMAL;
    private _moodEndTime = 0;
    private noKillTimer = 0;

    private attackSpeedBonus = 1.0;
    private damageBonus = 1.0;
    private followCloser = false;
    private followTargetSmoothed = new Vec3();
    private hasFollowTarget = false;

    onLoad() {
        this.config = DOG_CONFIG.husky;
        this.affection = 50;
        this.followTargetSmoothed = this.node.getPosition().clone();
        this.hasFollowTarget = true;
    }

    update(deltaTime: number) {
        if (GameManager.instance.gameState !== GameState.PLAYING) {
            return;
        }

        this.updateMood(deltaTime);

        if (this.skillCooldown > 0) {
            this.skillCooldown -= deltaTime;
        }

        this.attackTimer += deltaTime;
        this.noKillTimer += deltaTime;

        this.attackNearbyEnemy();

        if (this.skillCooldown <= 0) {
            this.useSkill();
            this.skillCooldown = this.skillInterval;
        }

        this.followPlayer(deltaTime);
    }

    private updateMood(_deltaTime: number) {
        if (this._moodEndTime > 0) {
            const gameTime = GameManager.instance.getGameTime();
            if (gameTime >= this._moodEndTime) {
                this.setMood(DogMood.NORMAL);
            }
        }

        const playerStats = GameManager.instance.getPlayerStats();
        const comboCount = GameManager.instance.getComboManager()?.getComboCount() || 0;
        const hpPercent = playerStats.currentHp / Math.max(1, playerStats.maxHp);

        if (comboCount >= 10 && this._currentMood !== DogMood.HAPPY) {
            this.setMood(DogMood.HAPPY);
        } else if (hpPercent < 0.2 && this._currentMood !== DogMood.SCARED && this._currentMood !== DogMood.HAPPY) {
            this.setMood(DogMood.SCARED);
        } else if (hpPercent < 0.5 && this._currentMood !== DogMood.ANGRY && this._currentMood !== DogMood.HAPPY) {
            this.setMood(DogMood.ANGRY);
        } else if (this.noKillTimer > 10 && this._currentMood !== DogMood.BORED && this._currentMood !== DogMood.HAPPY) {
            this.setMood(DogMood.BORED);
        } else if (this._currentMood !== DogMood.NORMAL && comboCount < 10 && hpPercent >= 0.5 && this.noKillTimer <= 10) {
            this.setMood(DogMood.NORMAL);
        }
    }

    private setMood(mood: DogMood) {
        this._currentMood = mood;

        const moodConfig = DOG_MOOD_CONFIG[mood];
        if (!moodConfig) {
            return;
        }

        this.attackSpeedBonus = moodConfig.effect.attackSpeed;
        this.damageBonus = moodConfig.effect.damage;
        this.followCloser = 'followCloser' in moodConfig.effect ? !!moodConfig.effect.followCloser : false;

        if (moodConfig.duration > 0) {
            this._moodEndTime = GameManager.instance.getGameTime() + moodConfig.duration;
        } else {
            this._moodEndTime = 0;
        }

        this.updateMoodUI();
    }

    public getCurrentMood(): DogMood {
        return this._currentMood;
    }

    public getMoodExpression(): string {
        const moodConfig = DOG_MOOD_CONFIG[this._currentMood];
        return moodConfig ? moodConfig.expression : '🐕';
    }

    public getAttackSpeedBonus(): number {
        return this.attackSpeedBonus;
    }

    public getDamageBonus(): number {
        return this.damageBonus;
    }

    public shouldFollowCloser(): boolean {
        return this.followCloser;
    }

    private updateMoodUI() {
        const dogMoodLabel = GameManager.instance.getHUD()?.getChildByName('DogMoodLabel')?.getComponent(Label);
        if (dogMoodLabel) {
            dogMoodLabel.string = this.getMoodExpression();
        }
    }

    private attackNearbyEnemy() {
        const enemies = GameManager.instance.getEnemies();
        const dogPos = this.node.getPosition();

        const maxAcquireDistance = 320;
        let candidateEnemy: Node | null = this.targetEnemy && this.targetEnemy.isValid ? this.targetEnemy : null;
        let candidateDist = candidateEnemy ? Vec3.distance(dogPos, candidateEnemy.getPosition()) : Number.POSITIVE_INFINITY;

        for (const enemy of enemies) {
            const dist = Vec3.distance(dogPos, enemy.getPosition());
            if (dist > maxAcquireDistance) {
                continue;
            }

            const shouldSwitch =
                !candidateEnemy ||
                candidateDist > maxAcquireDistance ||
                dist < candidateDist - 28;

            if (shouldSwitch) {
                candidateEnemy = enemy;
                candidateDist = dist;
            }
        }

        if (!candidateEnemy || candidateDist > maxAcquireDistance) {
            this.targetEnemy = null;
            return;
        }
        this.targetEnemy = candidateEnemy;

        const stats = GameManager.instance.getPlayerStats();
        const dogDamage = stats.attack * 0.3 * this.damageBonus;
        const attackInterval = 1 / Math.max(0.6, this.attackSpeedBonus);
        const attackRange = 95;

        if (candidateDist > attackRange || this.attackTimer < attackInterval) {
            return;
        }

        this.attackTimer = 0;
        const enemyCtrl = candidateEnemy.getComponent(EnemyController);
        enemyCtrl?.takeDamage(dogDamage);
        this.playAttackEffect(candidateEnemy);
    }

    private useSkill() {
        const enemies = GameManager.instance.getEnemies();
        const dogPos = this.node.getPosition();

        for (const enemy of enemies) {
            if (Vec3.distance(dogPos, enemy.getPosition()) > 150) {
                continue;
            }

            const enemyCtrl = enemy.getComponent(EnemyController);
            enemyCtrl?.applySlow(0.5, 2);
        }
    }

    private followPlayer(deltaTime: number) {
        const player = GameManager.instance.getPlayer();
        if (!player) {
            return;
        }

        const playerPos = player.getPosition();
        const offsetDistance = this.followCloser ? 30 : 58;
        let targetPos = playerPos.clone().add(new Vec3(offsetDistance, 0, 0));
        let moveSpeed = 165;

        if (this.targetEnemy && this.targetEnemy.isValid) {
            const enemyPos = this.targetEnemy.getPosition();
            const enemyToPlayer = Vec3.distance(enemyPos, playerPos);
            if (enemyToPlayer <= 420) {
                targetPos = enemyPos.clone().add(new Vec3(-26, 0, 0));
                moveSpeed = 230;
            }
        }

        this.moveTowardTarget(targetPos, moveSpeed, deltaTime);
    }

    private moveTowardTarget(targetPos: Vec3, moveSpeed: number, deltaTime: number) {
        if (!this.hasFollowTarget) {
            this.followTargetSmoothed.set(targetPos.x, targetPos.y, 0);
            this.hasFollowTarget = true;
        } else {
            const followLerp = Math.min(1, deltaTime * 8);
            this.followTargetSmoothed.set(
                this.followTargetSmoothed.x + (targetPos.x - this.followTargetSmoothed.x) * followLerp,
                this.followTargetSmoothed.y + (targetPos.y - this.followTargetSmoothed.y) * followLerp,
                0
            );
        }

        const dogPos = this.node.getPosition();
        const toTarget = this.followTargetSmoothed.clone().subtract(dogPos);
        const dist = toTarget.length();

        if (dist <= 2) {
            this.node.setPosition(this.followTargetSmoothed);
            return;
        }

        const maxStep = moveSpeed * deltaTime;
        if (maxStep >= dist) {
            this.node.setPosition(this.followTargetSmoothed);
            return;
        }

        const direction = toTarget.multiplyScalar(1 / dist);
        const step = direction.multiplyScalar(maxStep);
        this.node.setPosition(dogPos.add(step));
    }

    private playAttackEffect(enemy: Node) {
        const parent = this.node.parent;
        if (!parent || !enemy.isValid) {
            return;
        }

        const enemyPos = enemy.getPosition();
        const fx = new Node('DogAttackFx');
        fx.layer = this.node.layer;
        fx.setParent(parent);
        fx.setPosition(enemyPos);
        fx.addComponent(UITransform).setContentSize(36, 36);

        const g = fx.addComponent(Graphics);
        g.fillColor = new Color(255, 190, 88, 220);
        g.fillRect(-2, -14, 4, 28);
        g.fillRect(-14, -2, 28, 4);
        g.fillColor = new Color(255, 240, 170, 255);
        g.fillRect(-2, -2, 4, 4);
        g.fillRect(-10, -10, 4, 4);
        g.fillRect(6, -10, 4, 4);
        g.fillRect(-10, 6, 4, 4);
        g.fillRect(6, 6, 4, 4);

        fx.setScale(0.6, 0.6, 1);
        tween(fx)
            .to(0.06, { scale: new Vec3(1.15, 1.15, 1) })
            .to(0.08, { scale: new Vec3(0.08, 0.08, 1) })
            .call(() => {
                if (fx.isValid) {
                    fx.destroy();
                }
            })
            .start();

        this.playPunchScale(this.node, 1.12);
        this.playPunchScale(enemy, 1.1);
    }

    private playPunchScale(target: Node, ratio: number) {
        if (!target?.isValid) {
            return;
        }

        const baseScale = target.getScale().clone();
        const punchScale = new Vec3(baseScale.x * ratio, baseScale.y * ratio, baseScale.z);
        tween(target)
            .to(0.04, { scale: punchScale })
            .to(0.1, { scale: baseScale })
            .start();
    }

    public addAffection(amount: number) {
        this.affection = Math.min(this.maxAffection, this.affection + amount);
    }

    public getAffection(): number {
        return this.affection;
    }

    public resetNoKillTimer() {
        this.noKillTimer = 0;
    }
}
