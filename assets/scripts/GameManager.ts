/**
 * 游戏管理器 - 纯代码驱动核心
 * 狗王枪神
 *
 * 使用方法：
 * 1. 在Cocos Creator中创建一个空节点命名为"GameManager"
 * 2. 挂载此脚本
 * 3. 运行游戏 - 所有内容将由代码自动生成
 */

import { _decorator, Component, Node, Label, Graphics, UITransform, Color, Vec3, Vec2, director, Canvas, Widget, Camera, UIRenderer, view, Size, ResolutionPolicy } from 'cc';
import { WEAPON_CONFIG, ENEMY_CONFIG, DOG_CONFIG, PLAYER_CONFIG, LEVEL_CONFIG } from './Constants';
import { GameState, PlayerStats } from './types/GameTypes';
import { PlayerController } from './PlayerController';
import { EnemyController } from './EnemyController';
import { DogController } from './DogController';
import { BulletController } from './BulletController';
import { VirtualJoystick } from './VirtualJoystick';

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
    private _hud: Node | null = null;
    private _virtualJoystick: VirtualJoystick | null = null;

    // ==================== 游戏数据 ====================
    private _gold: number = 0;
    private _score: number = 0;
    private _level: number = 1;
    private _killCount: number = 0;

    // ==================== 定时器 ====================
    private _updateInterval: number = 0;
    private _deltaTime: number = 0;

    // ==================== 游戏尺寸（动态适配） ====================
    private _screenWidth: number = 0;
    private _screenHeight: number = 0;

    // ==================== 生命周期 ====================
    onLoad() {
        GameManager._instance = this;

        // 获取实际屏幕尺寸并适配
        this.adaptToScreen();

        console.log('🐕 狗王枪神 - 游戏初始化');
    }

    private adaptToScreen() {
        // 获取屏幕可见尺寸
        const visibleSize = view.getVisibleSize();
        this._screenWidth = visibleSize.width;
        this._screenHeight = visibleSize.height;

        console.log(`📱 屏幕尺寸: ${this._screenWidth} x ${this._screenHeight}`);

        // 设置设计分辨率，保持宽高比适配
        view.setDesignResolutionSize(this._screenWidth, this._screenHeight, ResolutionPolicy.SHOW_ALL);

        // 确保挂载脚本的节点有正确的UITransform
        if (!this.node.getComponent(UITransform)) {
            const transform = this.node.addComponent(UITransform);
            transform.setContentSize(this._screenWidth, this._screenHeight);
        } else {
            this.node.getComponent(UITransform)!.setContentSize(this._screenWidth, this._screenHeight);
        }
    }

    // ==================== 屏幕尺寸获取 ====================
    public getScreenWidth(): number { return this._screenWidth; }
    public getScreenHeight(): number { return this._screenHeight; }
    public getHalfWidth(): number { return this._screenWidth / 2; }
    public getHalfHeight(): number { return this._screenHeight / 2; }

    start() {
        this.initPhysics();
        this.createGameScene();
        this.createVirtualJoystick();
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
        // 暂时不使用物理引擎，我们用简单的距离检测进行碰撞
        console.log('ℹ️ 使用简单的距离检测碰撞');
    }

    // ==================== 场景创建 ====================
    private createGameScene() {
        console.log('🎮 创建游戏场景...');

        // 创建Canvas节点用于UI和触摸
        this.createCanvas();
        this.createBackground();
        this.createPlayer();
        this.createDogPartner();
        this.createHUD();

        // 敌人生成延迟执行
        this.scheduleOnce(() => {
            this.spawnEnemies(10);
        }, 1);

        console.log('✅ 游戏场景创建完成');
    }

    private createCanvas() {
        // 确保有屏幕尺寸
        if (this._screenWidth === 0 || this._screenHeight === 0) {
            this.adaptToScreen();
        }

        // 直接使用GameManager挂载的节点作为根节点
        // 确保它有UITransform
        if (!this.node.getComponent(UITransform)) {
            const transform = this.node.addComponent(UITransform);
            transform.setContentSize(this._screenWidth, this._screenHeight);
        } else {
            this.node.getComponent(UITransform)!.setContentSize(this._screenWidth, this._screenHeight);
        }

        // 存储引用用于触摸事件
        this._hud = this.node;
    }

    private createBackground() {
        // 创建背景节点
        const bg = new Node('Background');
        bg.setParent(this.node);
        bg.setPosition(new Vec3(0, 0, -100)); // 放在最底层

        const transform = bg.addComponent(UITransform);
        transform.setContentSize(this._screenWidth, this._screenHeight);

        // 绘制背景
        const graphics = bg.addComponent(Graphics);
        graphics.fillColor = new Color(30, 30, 40, 255);
        graphics.fillRect(-this._screenWidth/2, -this._screenHeight/2, this._screenWidth, this._screenHeight);

        // 绘制网格线模拟街道
        graphics.strokeColor = new Color(60, 60, 70, 255);
        graphics.lineWidth = 2;

        const gridSize = Math.min(this._screenWidth, this._screenHeight) / 9;
        for (let y = -this._screenHeight/2; y <= this._screenHeight/2; y += gridSize) {
            graphics.moveTo(-this._screenWidth/2, y);
            graphics.lineTo(this._screenWidth/2, y);
        }
        for (let x = -this._screenWidth/2; x <= this._screenWidth/2; x += gridSize) {
            graphics.moveTo(x, -this._screenHeight/2);
            graphics.lineTo(x, this._screenHeight/2);
        }
        graphics.stroke();

        // 绘制玩家区域标记
        graphics.fillColor = new Color(0, 150, 255, 100);
        const playerAreaSize = Math.min(this._screenWidth, this._screenHeight) * 0.08;
        graphics.fillRect(-playerAreaSize/2, -playerAreaSize/2, playerAreaSize, playerAreaSize);

        console.log('✅ 背景创建完成');
    }

    private createPlayer() {
        console.log('👤 创建玩家...');

        this._player = new Node('Player');
        this._player.setParent(this.node);

        const transform = this._player.addComponent(UITransform);
        transform.setContentSize(50, 50);
        this._player.setPosition(new Vec3(0, 0, 0));

        const graphics = this._player.addComponent(Graphics);
        graphics.fillColor = new Color(0, 191, 255, 255);
        graphics.fillRect(-25, -25, 50, 50);

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

        this._player.addComponent(PlayerController);

        console.log('✅ 玩家创建完成');
    }

    private createDogPartner() {
        console.log('🐕 创建狗伙伴...');

        this._dogPartner = new Node('DogPartner');
        this._dogPartner.setParent(this.node);

        const transform = this._dogPartner.addComponent(UITransform);
        transform.setContentSize(40, 40);

        const graphics = this._dogPartner.addComponent(Graphics);
        graphics.fillColor = new Color(255, 200, 0, 255);
        graphics.fillRect(-20, -20, 40, 40);

        this._dogPartner.setPosition(new Vec3(60, 30, 0));
        this._dogPartner.addComponent(DogController);

        console.log('✅ 狗伙伴创建完成 - 哈士奇');
    }

    private createHUD() {
        console.log('📊 创建HUD...');

        // HUD已经通过createCanvas创建，这里添加UI元素
        // 确保使用_hud（Canvas节点）
        if (!this._hud) return;

        const halfW = this.getHalfWidth();
        const halfH = this.getHalfHeight();

        // 创建血条背景 - 左上角
        const hpBg = this.createHUDChild('HP_BG', -halfW + 120, halfH - 40, 200, 20, new Color(50, 50, 50, 200));
        // 创建血条
        const hpBar = this.createHUDChild('HP_BAR', -halfW + 120, halfH - 40, 196, 16, new Color(255, 50, 50, 255));
        hpBar.name = 'HPBar';

        // 金币显示 - 右上角
        const goldLabel = this.createHUDLabel('GoldLabel', halfW - 100, halfH - 40, '💰 0');
        goldLabel.name = 'GoldLabel';

        // 分数显示 - 顶部居中
        const scoreLabel = this.createHUDLabel('ScoreLabel', 0, halfH - 40, '分数: 0');
        scoreLabel.name = 'ScoreLabel';

        // 等级显示 - 左上角血条下方
        const levelLabel = this.createHUDLabel('LevelLabel', -halfW + 120, halfH - 80, '等级: 1');
        levelLabel.name = 'LevelLabel';

        // 狗伙伴信息 - 右上角金币下方
        const dogLabel = this.createHUDLabel('DogLabel', halfW - 100, halfH - 80, '🐕 哈士奇 Lv.1');
        dogLabel.name = 'DogLabel';

        console.log('✅ HUD创建完成');
    }

    private createVirtualJoystick() {
        console.log('🕹️ 创建虚拟摇杆...');

        // 创建虚拟摇杆节点
        const joystickNode = new Node('VirtualJoystick');
        joystickNode.setParent(this.node);

        // 确保节点是激活的
        joystickNode.active = true;

        // 设置摇杆位置在屏幕左下角
        const halfW = this.getHalfWidth();
        const halfH = this.getHalfHeight();
        const joystickX = -halfW + 100;
        const joystickY = -halfH + 100;
        joystickNode.setPosition(new Vec3(joystickX, joystickY, 0));

        // 先设置 UITransform 确保节点有大小
        const transform = joystickNode.addComponent(UITransform);
        transform.setContentSize(150, 150); // 足够大的触摸区域

        this._virtualJoystick = joystickNode.addComponent(VirtualJoystick);

        // 确保摇杆显示在最上层
        joystickNode.setSiblingIndex(100);

        console.log('✅ 虚拟摇杆创建完成');
    }

    public getVirtualJoystick(): VirtualJoystick | null {
        return this._virtualJoystick;
    }

    private createHUDChild(name: string, x: number, y: number, width: number, height: number, color: Color): Node {
        const node = new Node(name);

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

        // 使用屏幕尺寸动态计算生成距离
        const minDist = Math.min(this._screenWidth, this._screenHeight) * 0.4;
        const maxDist = Math.min(this._screenWidth, this._screenHeight) * 0.8;
        const angle = Math.random() * Math.PI * 2;
        const distance = minDist + Math.random() * (maxDist - minDist);
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        enemy.setPosition(new Vec3(x, y, 0));

        const transform = enemy.addComponent(UITransform);
        transform.setContentSize(config.size, config.size);

        const graphics = enemy.addComponent(Graphics);
        graphics.fillColor = new Color().fromHEX(config.color);
        graphics.fillRect(-config.size/2, -config.size/2, config.size, config.size);

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
        graphics.fillRect(-5, -5, 10, 10);

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
        if (this._playerStats.currentHp <= 0) {
            this.gameOver();
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
        const index = this._enemies.indexOf(enemy);
        if (index > -1) {
            this._enemies.splice(index, 1);
        }

        enemy.destroy();

        this._gold += gold;
        this._score += gold * 10;
        this._killCount++;

        this.updateHUD();

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
        const halfW = this.getHalfWidth();
        const halfH = this.getHalfHeight();

        const overlay = new Node('GameOverOverlay');
        overlay.setParent(this.node);

        const transform = overlay.addComponent(UITransform);
        transform.setContentSize(this._screenWidth, this._screenHeight);
        overlay.setPosition(new Vec3(0, 0, 200));

        const graphics = overlay.addComponent(Graphics);
        graphics.fillColor = new Color(0, 0, 0, 180);
        graphics.fillRect(-halfW, -halfH, this._screenWidth, this._screenHeight);

        const titleNode = new Node('Title');
        titleNode.setParent(overlay);
        titleNode.setPosition(new Vec3(0, 50, 0));
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.string = title;
        titleLabel.fontSize = 48;

        const msgNode = new Node('Message');
        msgNode.setParent(overlay);
        msgNode.setPosition(new Vec3(0, -20, 0));
        const msgLabel = msgNode.addComponent(Label);
        msgLabel.string = message;
        msgLabel.fontSize = 28;

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

        btn.on(Node.EventType.TOUCH_START, () => {
            director.loadScene(director.getScene()!.name);
        });
    }

    // ==================== 公开接口 ====================
    public getPlayer(): Node | null { return this._player; }
    public getPlayerStats(): PlayerStats { return this._playerStats; }
    public getDogPartner(): Node | null { return this._dogPartner; }
    public getEnemies(): Node[] { return this._enemies; }
    public getBullets(): Node[] { return this._bullets; }
    public addGold(amount: number) {
        this._gold += amount;
        this.updateHUD();
    }
}
