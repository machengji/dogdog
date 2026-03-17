import { _decorator, Component, Node, Vec3, Label } from 'cc';
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

    onLoad() {
        this.config = DOG_CONFIG.husky;
        this.affection = 50;
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

        let nearestEnemy: Node | null = null;
        let nearestDist = 320;

        for (const enemy of enemies) {
            const dist = Vec3.distance(dogPos, enemy.getPosition());
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = enemy;
            }
        }

        this.targetEnemy = nearestEnemy;
        if (!nearestEnemy) {
            return;
        }

        const stats = GameManager.instance.getPlayerStats();
        const dogDamage = stats.attack * 0.3 * this.damageBonus;
        const attackInterval = 1 / Math.max(0.6, this.attackSpeedBonus);
        const attackRange = 95;

        if (nearestDist > attackRange || this.attackTimer < attackInterval) {
            return;
        }

        this.attackTimer = 0;
        const enemyCtrl = nearestEnemy.getComponent(EnemyController);
        enemyCtrl?.takeDamage(dogDamage);
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
        const dogPos = this.node.getPosition();

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

        const dist = Vec3.distance(dogPos, targetPos);
        if (dist <= 8) {
            return;
        }

        const direction = targetPos.clone().subtract(dogPos).normalize();
        const step = direction.multiplyScalar(moveSpeed * deltaTime);
        this.node.setPosition(dogPos.add(step));
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
