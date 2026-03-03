/**
 * 游戏管理器 - 纯代码驱动核心
 * 狗王枪神
 *
 * 使用方法：
 * 1. 在Cocos Creator中创建一个空节点命名为"GameManager"
 * 2. 挂载此脚本
 * 3. 运行游戏 - 所有内容将由代码自动生成
 */

import { _decorator, Component, Node, Sprite, Label, Graphics, Camera, UITransform, SpriteFrame, Color, Vec3, Vec2, director, Scene, resources, Prefab, instantiate, input, Input, EventTouch, systemEvent, SystemEvent, TiledLayer, TiledMap, TiledMapAsset, PhysicsSystem, BoxCollider2D } from 'cc';
import { WEAPON_CONFIG, ENEMY_CONFIG, DOG_CONFIG, PLAYER_CONFIG, LEVEL_CONFIG } from './Constants';
import { GameState, PlayerStats, EnemyInstance, DogInstance, WeaponInstance, CollisionTag } from './types/GameTypes';

const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {

    // ==================== 单例 ====================
    private static _instance: GameManager | null = null;
    public static get instance(): GameManager {
        if (!GameManager._instance) {
            console.error('GameManager 未初始化！');
        }
        return GameManager._instance!;
    }

    // ==================== 游戏状态 ====================
    private _gameState: GameState = GameState.MENU;
    public get gameState(): GameState { return this._gameState; }

    // ==================== 游戏对象 ====================
    private _player: Node | null = null;
    private _playerStats: PlayerStats = {} as PlayerStats;
    private _dogPartner: Node | null = null;
    private _enemies: Node[] = [];
    private _bullets: Node[] = [];
    private _camera: Node | null = null;
    private _hud: Node | null = null;

    // ==================== 游戏数据 ====================
    private _gold: number = 0;
    private _score: number = 0;
    private _level: number = 1;
    private _killCount: number = 0;

    // ==================== 定时器 ====================
    private _updateInterval: number = 0;
    private _deltaTime: number = 0;

    // ==================== 生命周期 ====================
    onLoad() {
        GameManager._instance = this;
        console.log('🐕 狗王枪神 - 游戏初始化');
    }

    start() {
        this.initPhysics();
        this.createGameScene();
        this.startGame();
    }

    update(deltaTime: number) {
        this._deltaTime = deltaTime;

        if (this._gameState === GameState.PLAYING) {
            this.updateGame(deltaTime);
        }
    }

    // ==================== 物理系统 ====================
    private initPhysics() {
        // 启用物理系统
        if (PhysicsSystem.instance) {
            PhysicsSystem.instance.enable = true;
            PhysicsSystem.instance.gravity = new Vec3(0, 0, 0);
        }
    }

    // ==================== 场景创建（纯代码驱动核心） ====================
    private createGameScene() {
        console.log('🎮 创建游戏场景...');

        // 1. 创建背景
        this.createBackground();

        // 2. 创建相机
        this.createCamera();

        // 3. 创建地板/碰撞区域
        this.createGround();

        // 4. 创建玩家
        this.createPlayer();

        // 5. 创建狗伙伴
        this.createDogPartner();

        // 6. 创建UI层
        this.createHUD();

        // 7. 创建敌人生成器
        this.scheduleOnce(() => {
            this.spawnEnemies(10);
        }, 1);

        console.log('✅ 游戏场景创建完成');
    }

    private createBackground() {
        const bg = new Node('Background');
        bg.setParent(this.node);

        // 添加图形组件绘制背景
        const graphics = bg.addComponent(Graphics);
        graphics.fillColor = new Color(30, 30, 40, 255);
        graphics.fillRect(-1000, -1000, 2000, 2000);

        // 添加变换组件
        const transform = bg.addComponent(UITransform);
        transform.setContentSize(2000, 2000);

        // 设置层级在最底层
        bg.setSiblingIndex(0);
    }

    private createCamera() {
        this._camera = new Node('MainCamera');
        this._camera.setParent(this.node);

        const camera = this._camera.addComponent(Camera);
        camera.projection = Camera.ProjectionType.ORTHO;
        camera.orthoHeight = 540;
        camera.orthoWidth = 960;
        camera.far = 1000;
        camera.priority = -1;

        // 设置相机位置
        this._camera.setPosition(new Vec3(0, 0, 500));

        // 让相机跟随玩家
        this.schedule(this.updateCameraFollow, 0);
    }

    private createGround() {
        // 创建地面碰撞区域
        const ground = new Node('Ground');
        ground.setParent(this.node);

        const transform = ground.addComponent(UITransform);
        transform.setContentSize(2000, 1500);

        const collider = ground.addComponent(BoxCollider2D);
        collider.size = new Vec2(2000, 1500);
        collider.offset = new Vec2(0, 0);
        collider.group = 0; // 默认层

        ground.setPosition(new Vec3(0, 0, 0));
    }

    // ==================== 玩家创建 ====================
    private createPlayer() {
        console.log('👤 创建玩家...');

        this._player = new Node('Player');
        this._player.setParent(this.node);

        // 玩家变换
        const transform = this._player.addComponent(UITransform);
        transform.setContentSize(50, 50);
        this._player.setPosition(new Vec3(0, 0, 0));

        // 玩家图形（红色方块代表）
        const graphics = this._player.addComponent(Graphics);
        graphics.fillColor = new Color(0, 191, 255, 255); // 深天蓝
        graphics.fillRect(-25, -25, 50, 50);

        // 碰撞体
        const collider = this._player.addComponent(BoxCollider2D);
        collider.size = new Vec2(50, 50);
        collider.group = 1 << 0; // 玩家层

        // 初始化玩家属性
        this._playerStats = {
            maxHp: PLAYER_CONFIG.maxHp,
            currentHp: PLAYER_CONFIG.maxHp,
            attack: PLAYER_CONFIG.baseAttack,
            speed: PLAYER_CONFIG.baseSpeed,
            critRate: PLAYER_CONFIG.baseCritRate,
            critDamage: PLAYER_CONFIG.baseCritDamage,
            dodgeRate: PLAYER_CONFIG.dodgeRate,
            pickupRange: PLAYER_CONFIG.pickupRange
        };

        // 添加玩家控制器脚本
        this._player.addComponent(PlayerController);

        console.log('✅ 玩家创建完成');
    }

    // ==================== 狗伙伴创建 ====================
    private createDogPartner() {
        console.log('🐕 创建狗伙伴...');

        this._dogPartner = new Node('DogPartner');
        this._dogPartner.setParent(this.node);

        const transform = this._dogPartner.addComponent(UITransform);
        transform.setContentSize(40, 40);

        // 狗伙伴图形（黄色方块代表）
        const graphics = this._dogPartner.addComponent(Graphics);
        graphics.fillColor = new Color(255, 200, 0, 255); // 金色
        graphics.fillRect(-20, -20, 40, 40);

        // 设置位置 - 在玩家旁边
        this._dogPartner.setPosition(new Vec3(60, 30, 0));

        // 添加狗伙伴控制器
        this._dogPartner.addComponent(DogController);

        console.log('✅ 狗伙伴创建完成 - 哈士奇');
    }

    // ==================== HUD创建 ====================
    private createHUD() {
        console.log('📊 创建HUD...');

        this._hud = new Node('HUD');
        this._hud.setParent(this.node);

        // 确保HUD在相机下（UI层级）
        const transform = this._hud.addComponent(UITransform);
        transform.setContentSize(960, 540);
        this._hud.setPosition(new Vec3(0, 0, 100));
        this._hud.setSiblingIndex(100);

        // 1. 血条背景
        const hpBg = this.createHUDChild('HP_BG', -400, 220, 200, 20, new Color(50, 50, 50, 200));

        // 2. 血条
        const hpBar = this.createHUDChild('HP_BAR', -400, 220, 196, 16, new Color(255, 50, 50, 255));
        hpBar.name = 'HPBar';

        // 3. 金币显示
        const goldLabel = this.createHUDLabel('GoldLabel', 380, 220, '💰 0');
        goldLabel.name = 'GoldLabel';

        // 4. 分数显示
        const scoreLabel = this.createHUDLabel('ScoreLabel', 0, 220, '分数: 0');
        scoreLabel.name = 'ScoreLabel';

        // 5. 等级显示
        const levelLabel = this.createHUDLabel('LevelLabel', -380, 180, '等级: 1');
        levelLabel.name = 'LevelLabel';

        // 6. 狗伙伴信息
        const dogLabel = this.createHUDLabel('DogLabel', 380, 180, '🐕 哈士奇 Lv.1');
        dogLabel.name = 'DogLabel';

        console.log('✅ HUD创建完成');
    }

    private createHUDChild(name: string, x: number, y: number, width: number, height: number, color: Color): Node {
        const node = new Node(name);
        node.setParent(this._hud!);

        const transform = node.addComponent(UITransform);
        transform.setContentSize(width, height);
        node.setPosition(new Vec3(x, y, 0));

        const graphics = node.addComponent(Graphics);
        graphics.fillColor = color;
        graphics.fillRect(-width/2, -height/2, width, height);

        return node;
    }

    private createHUDLabel(name: string, x: number, y: number, text: string): Node {
        const node = new Node(name);
        node.setParent(this._hud!);

        const transform = node.addComponent(UITransform);
        transform.setContentSize(200, 30);
        node.setPosition(new Vec3(x, y, 0));

        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = 24;
        label.color = new Color(255, 255, 255, 255);

        return node;
    }

    // ==================== 敌人生成 ====================
    private spawnEnemies(count: number) {
        console.log(`👹 生成 ${count} 个敌人...`);

        const enemyKeys = Object.keys(ENEMY_CONFIG);

        for (let i = 0; i < count; i++) {
            const randomKey = enemyKeys[Math.floor(Math.random() * enemyKeys.length)];
            const enemyConfig = ENEMY_CONFIG[randomKey as keyof typeof ENEMY_CONFIG];

            this.spawnEnemy(enemyConfig);
        }
    }

    public spawnEnemy(config: any) {
        const enemy = new Node(config.name);
        enemy.setParent(this.node);

        // 随机位置（玩家周围）
        const angle = Math.random() * Math.PI * 2;
        const distance = 300 + Math.random() * 300;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        enemy.setPosition(new Vec3(x, y, 0));

        // 变换
        const transform = enemy.addComponent(UITransform);
        transform.setContentSize(config.size, config.size);

        // 图形
        const graphics = enemy.addComponent(Graphics);
        graphics.fillColor = new Color().fromHEX(config.color);
        graphics.fillRect(-config.size/2, -config.size/2, config.size, config.size);

        // 碰撞体
        const collider = enemy.addComponent(BoxCollider2D);
        collider.size = new Vec2(config.size, config.size);
        collider.group = 1 << 1; // 敌人层

        // 添加敌人控制器
        const enemyCtrl = enemy.addComponent(EnemyController);
        enemyCtrl.init(config);

        this._enemies.push(enemy);
    }

    // ==================== 子弹创建 ====================
    public createBullet(startPos: Vec3, direction: Vec3, damage: number, isCrit: boolean): Node {
        const bullet = new Node('Bullet');
        bullet.setParent(this.node);

        bullet.setPosition(startPos);

        const transform = bullet.addComponent(UITransform);
        transform.setContentSize(10, 10);

        const graphics = bullet.addComponent(Graphics);
        graphics.fillColor = isCrit ? new Color(255, 255, 0, 255) : new Color(255, 255, 255, 255);
        graphics.fillCircle(0, 0, 5);

        // 碰撞体
        const collider = bullet.addComponent(BoxCollider2D);
        collider.size = new Vec2(10, 10);
        collider.group = 1 << 2; // 子弹层

        // 添加子弹控制器
        const bulletCtrl = bullet.addComponent(BulletController);
        bulletCtrl.init(direction, damage, isCrit);

        this._bullets.push(bullet);

        return bullet;
    }

    // ==================== 游戏流程 ====================
    public startGame() {
        console.log('🎮 游戏开始！');
        this._gameState = GameState.PLAYING;
        this._gold = 0;
        this._score = 0;
        this._killCount = 0;
    }

    private updateGame(deltaTime: number) {
        // 检查游戏结束条件
        if (this._playerStats.currentHp <= 0) {
            this.gameOver();
        }
    }

    private updateCameraFollow() {
        if (this._camera && this._player) {
            const playerPos = this._player.getPosition();
            this._camera.setPosition(new Vec3(playerPos.x, playerPos.y, 500));
        }
    }

    // ==================== 伤害与死亡 ====================
    public damagePlayer(damage: number) {
        this._playerStats.currentHp -= damage;
        this.updateHPBar();

        if (this._playerStats.currentHp <= 0) {
            this.gameOver();
        }
    }

    public killEnemy(enemy: Node, gold: number) {
        // 移除敌人
        const index = this._enemies.indexOf(enemy);
        if (index > -1) {
            this._enemies.splice(index, 1);
        }

        enemy.destroy();

        // 奖励
        this._gold += gold;
        this._score += gold * 10;
        this._killCount++;

        this.updateHUD();

        // 检查是否胜利
        if (this._enemies.length === 0) {
            this.victory();
        }
    }

    // ==================== UI更新 ====================
    private updateHPBar() {
        const hpBar = this._hud?.getChildByName('HPBar');
        if (hpBar) {
            const percent = this._playerStats.currentHp / this._playerStats.maxHp;
            const graphics = hpBar.getComponent(Graphics);
            if (graphics) {
                const width = 196 * Math.max(0, percent);
                graphics.clear();
                graphics.fillColor = new Color(255, 50, 50, 255);
                graphics.fillRect(-width/2, -8, width, 16);
            }
        }
    }

    private updateHUD() {
        const goldLabel = this._hud?.getChildByName('GoldLabel')?.getComponent(Label);
        if (goldLabel) {
            goldLabel.string = `💰 ${this._gold}`;
        }

        const scoreLabel = this._hud?.getChildByName('ScoreLabel')?.getComponent(Label);
        if (scoreLabel) {
            scoreLabel.string = `分数: ${this._score}`;
        }
    }

    // ==================== 游戏结束 ====================
    private gameOver() {
        console.log('💀 游戏结束');
        this._gameState = GameState.DEFEAT;

        this.showGameOverUI('游戏结束', '再接再厉！');
    }

    private victory() {
        console.log('🎉 胜利！');
        this._gameState = GameState.VICTORY;

        this.showGameOverUI('胜利！', `获得金币: ${this._gold + 100}`);
    }

    private showGameOverUI(title: string, message: string) {
        // 创建结束界面
        const overlay = new Node('GameOverOverlay');
        overlay.setParent(this.node);

        const transform = overlay.addComponent(UITransform);
        transform.setContentSize(960, 540);
        overlay.setPosition(new Vec3(0, 0, 200));

        // 半透明背景
        const graphics = overlay.addComponent(Graphics);
        graphics.fillColor = new Color(0, 0, 0, 150);
        graphics.fillRect(-480, -270, 960, 540);

        // 标题
        const titleNode = new Node('Title');
        titleNode.setParent(overlay);
        titleNode.setPosition(new Vec3(0, 50, 0));
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = title;
        titleLabel.fontSize = 48;

        // 消息
        const msgNode = new Node('Message');
        msgNode.setParent(overlay);
        msgNode.setPosition(new Vec3(0, -20, 0));
        const msgLabel = msgNode.addComponent(Label);
        msgLabel.string = message;
        msgLabel.fontSize = 28;

        // 重新开始按钮
        const btn = new Node('RestartBtn');
        btn.setParent(overlay);
        btn.setPosition(new Vec3(0, -100, 0));

        const btnTransform = btn.addComponent(UITransform);
        btnTransform.setContentSize(200, 60);

        const btnGraphics = btn.addComponent(Graphics);
        btnGraphics.fillColor = new Color(0, 150, 255, 255);
        btnGraphics.fillRect(-100, -30, 200, 60);

        const btnLabel = btn.addComponent(Label);
        btnLabel.string = '重新开始';
        btnLabel.fontSize = 24;

        // 点击事件
        btn.on(Node.EventType.TOUCH_START, () => {
            director.loadScene(director.getScene()!.name);
        });
    }

    // ==================== 公开接口 ====================
    public getPlayer(): Node | null { return this._player; }
    public getPlayerStats(): PlayerStats { return this._playerStats; }
    public getDogPartner(): Node | null { return this._dogPartner; }
    public getEnemies(): Node[] { return this._enemies; }
    public addGold(amount: number) {
        this._gold += amount;
        this.updateHUD();
    }
}

// ==================== 玩家控制器 ====================
@ccclass('PlayerController')
export class PlayerController extends Component {
    private targetPosition: Vec3 | null = null;
    private isMoving: boolean = false;
    private fireTimer: number = 0;
    private isFiring: boolean = false;
    private currentTarget: Node | null = null;

    onLoad() {
        // 注册触摸事件
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    update(deltaTime: number) {
        if (GameManager.instance.gameState !== GameState.PLAYING) return;

        this.updateMovement(deltaTime);
        this.updateAutoFire(deltaTime);
        this.updateDogFollow();
    }

    private onTouchStart(event: EventTouch) {
        const touchPos = event.getUILocation();
        const worldPos = this.convertToWorldPosition(touchPos);

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

    private updateAutoFire(deltaTime: number) {
        if (!this.isFiring || !this.currentTarget) return;

        this.fireTimer += deltaTime;
        const fireRate = 1 / 3; // 3发/秒

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
        const offset = new Vec3(60, 30, 0); // 跟随偏移

        const targetPos = playerPos.clone().add(offset);

        // 平滑跟随
        const newPos = dogPos.lerp(targetPos, 0.05);
        dog.setPosition(newPos);
    }

    private convertToWorldPosition(uiPos: Vec2): Vec3 {
        const camera = GameManager.instance.node.getChildByName('MainCamera');
        if (!camera) return new Vec3(uiPos.x, uiPos.y, 0);

        const cameraComp = camera.getComponent(Camera);
        if (!cameraComp) return new Vec3(uiPos.x, uiPos.y, 0);

        const worldPos = new Vec3();
        cameraComp.screenToWorld(new Vec3(uiPos.x, uiPos.y, 0), worldPos);

        return worldPos;
    }
}

// ==================== 敌人控制器 ====================
@ccclass('EnemyController')
export class EnemyController extends Component {
    private config: any = null;
    private currentHp: number = 0;
    private targetPlayer: Node | null = null;
    private attackCooldown: number = 0;

    init(config: any) {
        this.config = config;
        this.currentHp = config.hp;
    }

    update(deltaTime: number) {
        if (GameManager.instance.gameState !== GameState.PLAYING) return;

        this.updateAI(deltaTime);
    }

    private updateAI(deltaTime: number) {
        const player = GameManager.instance.getPlayer();
        if (!player) return;

        const playerPos = player.getPosition();
        const enemyPos = this.node.getPosition();
        const distance = Vec3.distance(playerPos, enemyPos);

        // 追踪玩家
        if (distance > 50) {
            const direction = new Vec3().subtract(playerPos, enemyPos).normalize();
            const moveDistance = this.config.speed * deltaTime;
            const newPos = enemyPos.add(direction.clone().multiplyScalar(moveDistance));
            this.node.setPosition(newPos);
        }

        // 攻击玩家
        this.attackCooldown -= deltaTime;
        if (distance < 80 && this.attackCooldown <= 0) {
            this.attackPlayer();
            this.attackCooldown = 1; // 1秒攻击一次
        }
    }

    private attackPlayer() {
        const player = GameManager.instance.getPlayer();
        if (!player) return;

        const stats = GameManager.instance.getPlayerStats();
        GameManager.instance.damagePlayer(this.config.attack);
    }

    public takeDamage(damage: number) {
        this.currentHp -= damage;

        if (this.currentHp <= 0) {
            GameManager.instance.killEnemy(this.node, this.config.dropGold);
        }
    }
}

// ==================== 狗伙伴控制器 ====================
@ccclass('DogController')
export class DogController extends Component {
    private config: any = null;

    onLoad() {
        this.config = DOG_CONFIG.husky; // 默认哈士奇
    }

    update(deltaTime: number) {
        if (GameManager.instance.gameState !== GameState.PLAYING) return;

        // 狗伙伴会攻击附近的敌人
        this.attackNearbyEnemy();
    }

    private attackNearbyEnemy() {
        const enemies = GameManager.instance.getEnemies();
        const dogPos = this.node.getPosition();

        for (const enemy of enemies) {
            const dist = Vec3.distance(dogPos, enemy.getPosition());
            if (dist < 100) {
                // 狗伙伴发起攻击（造成50%玩家攻击力）
                // 这里可以扩展为实际伤害逻辑
                break;
            }
        }
    }
}

// ==================== 子弹控制器 ====================
@ccclass('BulletController')
export class BulletController extends Component {
    private direction: Vec3 = new Vec3(1, 0, 0);
    private damage: number = 0;
    private isCrit: boolean = false;
    private lifetime: number = 0;
    private speed: number = 800;

    init(direction: Vec3, damage: number, isCrit: boolean) {
        this.direction = direction;
        this.damage = damage;
        this.isCrit = isCrit;
    }

    update(deltaTime: number) {
        this.lifetime += deltaTime;

        // 移动
        const moveDistance = this.speed * deltaTime;
        const newPos = this.node.getPosition().add(this.direction.clone().multiplyScalar(moveDistance));
        this.node.setPosition(newPos);

        // 检测碰撞
        this.checkCollision();

        // 超时销毁
        if (this.lifetime > 3) {
            this.node.destroy();
        }
    }

    private checkCollision() {
        const enemies = GameManager.instance.getEnemies();
        const bulletPos = this.node.getPosition();

        for (const enemy of enemies) {
            const enemyPos = enemy.getPosition();
            const dist = Vec3.distance(bulletPos, enemyPos);

            if (dist < 30) {
                // 命中敌人
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
