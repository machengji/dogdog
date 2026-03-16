/**
 * 游戏管理器 - 纯代码驱动核心
 * 狗王枪神
 *
 * 使用方法：
 * 1. 在Cocos Creator中创建一个空节点命名为"GameManager"
 * 2. 挂载此脚本
 * 3. 运行游戏 - 所有内容将由代码自动生成
 */

import { _decorator, Component, Node, Label, Graphics, UITransform, Color, Vec3, Vec2, director, view, ResolutionPolicy, Camera } from 'cc';
import { WEAPON_CONFIG, ENEMY_CONFIG, DOG_CONFIG, PLAYER_CONFIG, LEVEL_CONFIG, COMBO_CONFIG, SPAWN_CONFIG, GAME_TIME_CONFIG } from './Constants';
import { GameState, PlayerStats, ComboData } from './types/GameTypes';
import { PlayerController } from './PlayerController';
import { EnemyController } from './EnemyController';
import { DogController } from './DogController';
import { BulletController } from './BulletController';
import { VirtualJoystick } from './VirtualJoystick';
import { ComboManager } from './ComboManager';

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
    private _canvasNode: Node | null = null;
    private _uiOffset: Vec3 = new Vec3(0, 0, 0);
    private _virtualJoystick: VirtualJoystick | null = null;
    private _comboManager: ComboManager | null = null;

    // ==================== 游戏数据 ====================
    private _gold: number = 0;
    private _score: number = 0;
    private _level: number = 1;
    private _killCount: number = 0;

    // ==================== 计时器 ====================
    private _gameTimer: number = 0;           // 游戏总时间（秒）
    private _spawnTimer: number = 0;         // 敌人生成计时
    private _spawnInterval: number = 1.0;    // 敌人生成间隔
    private _dynamicDiffTimer: number = 0;   // 动态难度计时

    // ==================== 难度调整 ====================
    private _difficultyMultiplier: number = 1.0;  // 难度倍率
    private _lastKillTime: number = 0;            // 最后击杀时间（无战斗检测）

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

        // 先查找编辑器中的 Canvas（用于UI固定）
        this.findCanvasNode();

        // 创建摄像机（跟随玩家）
        this.createCamera();

        // 创建Canvas节点用于UI和触摸
        this.createCanvas();
        this.createBackground();
        this.createPlayer();
        this.createDogPartner();
        this.createHUD();
        this.createComboManager();

        // 敌人生成延迟执行 - 改为无限刷新
        this._spawnTimer = 0;
        this.updateSpawnInterval();

        console.log('✅ 游戏场景创建完成');
    }

    // 查找 Canvas 节点
    private findCanvasNode() {
        const scene = director.getScene();
        if (!scene) return;

        this._canvasNode = scene.getChildByName('Canvas');
        if (this._canvasNode) {
            console.log('✅ 找到 Canvas 节点');
        } else {
            console.log('⚠️ 未找到 Canvas 节点');
        }
    }

    private createCamera() {
        console.log('📷 查找编辑器中的摄像机...');

        // 从场景中获取现有的摄像机节点
        const scene = director.getScene();
        if (!scene) {
            console.error('❌ 无法获取场景');
            return;
        }

        // 尝试通过名称查找摄像机
        let cameraNode = scene.getChildByName('Camera');

        // 如果找不到，尝试查找任何带有 Camera 组件的节点
        if (!cameraNode) {
            const findCamera = (node: Node): Node | null => {
                if (node.getComponent(Camera)) {
                    return node;
                }
                for (const child of node.children) {
                    const found = findCamera(child);
                    if (found) return found;
                }
                return null;
            };
            cameraNode = findCamera(scene);
        }

        if (cameraNode) {
            this._camera = cameraNode.getComponent(Camera);
            this._cameraNode = cameraNode;
            console.log('✅ 找到编辑器摄像机:', cameraNode.name);
        } else {
            console.log('⚠️ 未找到编辑器摄像机，将创建新摄像机');
            this.createNewCamera(scene);
        }
    }

    private createNewCamera(scene: Node) {
        // 创建新的摄像机节点
        const cameraNode = new Node('GameCamera');
        cameraNode.setParent(scene);
        cameraNode.setPosition(0, 0, 1000);

        const camera = cameraNode.addComponent(Camera);
        camera.projection = Camera.ProjectionType.ORTHO;
        camera.orthoHeight = 350;
        camera.near = 1;
        camera.far = 2000;

        this._camera = camera;
        this._cameraNode = cameraNode;
        console.log('✅ 创建新摄像机成功');
    }

    private _camera: Camera | null = null;
    private _cameraNode: Node | null = null;

    public getCamera(): Camera | null {
        return this._camera;
    }

    private updateCamera() {
        // 简单方案：摄像机跟随玩家
        // 不移动世界物体，只移动摄像机

        if (!this._player || !this._cameraNode) return;

        // 获取玩家位置
        const playerPos = this._player.getPosition();

        // 摄像机跟随玩家（保持相同的z轴距离）
        this._cameraNode.setPosition(new Vec3(playerPos.x, playerPos.y, 1000));
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
        // 创建背景节点 - 足够大以覆盖玩家可能移动到的范围
        const bg = new Node('Background');
        bg.setParent(this.node);

        // 使用屏幕的10倍大小，足够3分钟游戏
        const bgWidth = this._screenWidth * 10;
        const bgHeight = this._screenHeight * 10;
        bg.setPosition(new Vec3(0, 0, -100)); // 放在最底层

        const transform = bg.addComponent(UITransform);
        transform.setContentSize(bgWidth, bgHeight);

        // 绘制背景
        const graphics = bg.addComponent(Graphics);
        graphics.fillColor = new Color(30, 30, 40, 255);
        graphics.fillRect(-bgWidth/2, -bgHeight/2, bgWidth, bgHeight);

        // 绘制网格线模拟街道
        graphics.strokeColor = new Color(60, 60, 70, 255);
        graphics.lineWidth = 2;

        const gridSize = Math.min(this._screenWidth, this._screenHeight) / 9;
        for (let y = -bgHeight/2; y <= bgHeight/2; y += gridSize) {
            graphics.moveTo(-bgWidth/2, y);
            graphics.lineTo(bgWidth/2, y);
        }
        for (let x = -bgWidth/2; x <= bgWidth/2; x += gridSize) {
            graphics.moveTo(x, -bgHeight/2);
            graphics.lineTo(x, bgHeight/2);
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
            pickupRange: PLAYER_CONFIG.pickupRange,
            range: PLAYER_CONFIG.range
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

        // 使用 Canvas 节点作为父节点
        const parentNode = this._canvasNode || this.node;
        if (!parentNode) return;

        this._hud = parentNode;

        const halfW = this.getHalfWidth();
        const halfH = this.getHalfHeight();

        // 创建血条背景 - 左上角
        const hpBg = this.createHUDChild('HP_BG', -halfW + 120, halfH - 40, 200, 20, new Color(50, 50, 50, 200), parentNode);
        // 创建血条
        const hpBar = this.createHUDChild('HP_BAR', -halfW + 120, halfH - 40, 196, 16, new Color(255, 50, 50, 255), parentNode);
        hpBar.name = 'HPBar';

        // 金币显示 - 右上角
        const goldLabel = this.createHUDLabel('GoldLabel', halfW - 100, halfH - 40, '💰 0', parentNode);
        goldLabel.name = 'GoldLabel';

        // 分数显示 - 顶部居中
        const scoreLabel = this.createHUDLabel('ScoreLabel', 0, halfH - 40, '分数: 0', parentNode);
        scoreLabel.name = 'ScoreLabel';

        // 计时器显示 - 分数下方居中
        const timerLabel = this.createHUDLabel('TimerLabel', 0, halfH - 80, '⏱️ 3:00', parentNode);
        timerLabel.name = 'TimerLabel';

        // 等级显示 - 左上角血条下方
        const levelLabel = this.createHUDLabel('LevelLabel', -halfW + 120, halfH - 80, '等级: 1', parentNode);
        levelLabel.name = 'LevelLabel';

        // 狗伙伴信息 - 右上角金币下方
        const dogLabel = this.createHUDLabel('DogLabel', halfW - 100, halfH - 80, '🐕 哈士奇 Lv.1', parentNode);
        dogLabel.name = 'DogLabel';

        // 连击显示 - 顶部偏下居中
        const comboLabel = this.createHUDLabel('ComboLabel', 0, halfH - 120, '', parentNode);
        comboLabel.name = 'ComboLabel';

        // 狗情绪显示 - 狗信息下方
        const dogMoodLabel = this.createHUDLabel('DogMoodLabel', halfW - 100, halfH - 120, '🐕', parentNode);
        dogMoodLabel.name = 'DogMoodLabel';

        console.log('✅ HUD创建完成');
    }

    private createVirtualJoystick() {
        console.log('🕹️ 创建虚拟摇杆...');

        // 直接使用 Canvas 节点作为父节点（编辑器中的 Canvas 专门用于 UI，会固定在屏幕上）
        const parentNode = this._canvasNode || this.node;
        console.log('🕹️ 摇杆父节点:', parentNode?.name || 'this.node');

        // 创建虚拟摇杆节点
        const joystickNode = new Node('VirtualJoystick');
        joystickNode.setParent(parentNode);

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
        transform.setContentSize(150, 150);

        this._virtualJoystick = joystickNode.addComponent(VirtualJoystick);

        // 确保摇杆显示在最上层
        joystickNode.setSiblingIndex(100);

        console.log('✅ 虚拟摇杆创建完成');
    }

    public getVirtualJoystick(): VirtualJoystick | null {
        return this._virtualJoystick;
    }

    private createComboManager() {
        console.log('⚡ 创建连击管理器...');

        // 在根节点上添加ComboManager
        this._comboManager = this.node.addComponent(ComboManager);

        console.log('✅ 连击管理器创建完成');
    }

    public getComboManager(): ComboManager | null {
        return this._comboManager;
    }

    // ==================== 敌人生成系统 ====================
    private updateSpawnInterval() {
        // 根据游戏时间和难度调整刷新间隔
        const phases = SPAWN_CONFIG.phases;
        let lazyDogRate = 1.0;
        let crazyDogRate = 0;

        for (let i = phases.length - 1; i >= 0; i--) {
            if (this._gameTimer >= phases[i].time) {
                lazyDogRate = phases[i].lazyDogRate;
                crazyDogRate = phases[i].crazyDogRate;
                break;
            }
        }

        // 应用难度倍率
        lazyDogRate *= this._difficultyMultiplier;
        crazyDogRate *= this._difficultyMultiplier;

        // 计算综合刷新间隔（懒狗和疯狗的总频率）
        const totalRate = lazyDogRate + crazyDogRate;
        this._spawnInterval = totalRate > 0 ? 1.0 / totalRate : 999;

        console.log(`📊 刷新间隔: ${this._spawnInterval.toFixed(2)}秒 (懒狗:${lazyDogRate}/s, 疯狗:${crazyDogRate}/s)`);
    }

    // 根据当前刷新率随机选择敌人类型
    private getRandomEnemyConfig() {
        const phases = SPAWN_CONFIG.phases;
        let lazyDogRate = 1.0;
        let crazyDogRate = 0;

        for (let i = phases.length - 1; i >= 0; i--) {
            if (this._gameTimer >= phases[i].time) {
                lazyDogRate = phases[i].lazyDogRate;
                crazyDogRate = phases[i].crazyDogRate;
                break;
            }
        }

        // 根据比率随机选择敌人类型
        const total = lazyDogRate + crazyDogRate;
        const rand = Math.random() * total;

        if (rand < lazyDogRate) {
            return ENEMY_CONFIG.lazyDog;
        } else {
            return ENEMY_CONFIG.crazyDog;
        }
    }

    // 动态难度调整
    private updateDynamicDifficulty(deltaTime: number) {
        if (!SPAWN_CONFIG.dynamicDifficulty.enabled) return;

        this._dynamicDiffTimer += deltaTime;

        if (this._dynamicDiffTimer >= SPAWN_CONFIG.dynamicDifficulty.checkInterval) {
            this._dynamicDiffTimer = 0;

            // 检查玩家表现
            const timeSinceLastKill = this._gameTimer - this._lastKillTime;
            const playerStats = this._playerStats;
            const hpPercent = playerStats.currentHp / playerStats.maxHp;

            // 表现好（高连击/高血量）：降低难度
            // 表现差（低连击/低血量）：增加难度
            const combo = this._comboManager?.getComboCount() || 0;

            if (combo >= 10 && hpPercent > 0.5) {
                // 表现好，降低难度
                this._difficultyMultiplier = Math.max(0.5, this._difficultyMultiplier - SPAWN_CONFIG.dynamicDifficulty.adjustmentRate);
                console.log('📉 难度降低');
            } else if (combo < 3 && hpPercent < 0.3) {
                // 表现差，增加难度
                this._difficultyMultiplier = Math.min(2.0, this._difficultyMultiplier + SPAWN_CONFIG.dynamicDifficulty.adjustmentRate);
                console.log('📈 难度增加');
            }

            // 更新刷新间隔
            this.updateSpawnInterval();
        }
    }

    private createHUDChild(name: string, x: number, y: number, width: number, height: number, color: Color, parentNode: Node): Node {
        const node = new Node(name);
        node.setParent(parentNode);

        const transform = node.addComponent(UITransform);
        transform.setContentSize(width, height);
        node.setPosition(new Vec3(x, y, 0));

        const graphics = node.addComponent(Graphics);
        graphics.fillColor = color;
        graphics.fillRect(-width/2, -height/2, width, height);

        return node;
    }

    private createHUDLabel(name: string, x: number, y: number, text: string, parentNode: Node): Node {
        const node = new Node(name);
        node.setParent(parentNode);

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

        // 在玩家周围随机位置生成敌人
        // 使用屏幕尺寸计算生成范围
        const spawnRadius = Math.min(this._screenWidth, this._screenHeight) * 0.5;

        // 随机角度 - 确保全方向分布
        const angle = Math.random() * Math.PI * 2;
        // 随机距离（在一定范围内）
        const distance = spawnRadius * (0.5 + Math.random() * 0.5);

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

        // 调试日志
        console.log(`👹 生成敌人: ${config.name} 位置: (${x.toFixed(1)}, ${y.toFixed(1)}) 角度: ${(angle * 180 / Math.PI).toFixed(0)}°`);
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
        // 更新摄像机跟随玩家
        this.updateCamera();

        // 更新游戏计时器
        this._gameTimer += deltaTime;

        // 更新游戏时间显示
        this.updateGameTimerUI();

        // 检查胜利条件
        if (this._gameTimer >= GAME_TIME_CONFIG.victoryTime) {
            this.victory();
            return;
        }

        // 敌人无限刷新
        this._spawnTimer += deltaTime;
        if (this._spawnTimer >= this._spawnInterval) {
            this._spawnTimer = 0;

            // 检查是否达到最大敌人数量
            if (this._enemies.length < SPAWN_CONFIG.maxEnemies) {
                const config = this.getRandomEnemyConfig();
                this.spawnEnemy(config);
            }
        }

        // 动态难度调整
        this.updateDynamicDifficulty(deltaTime);

        // 检查玩家死亡
        if (this._playerStats.currentHp <= 0) {
            this.gameOver();
        }
    }

    // 更新游戏计时器UI
    private updateGameTimerUI() {
        const timerLabel = this._hud?.getChildByName('TimerLabel')?.getComponent(Label);
        if (timerLabel) {
            const remaining = Math.max(0, GAME_TIME_CONFIG.victoryTime - this._gameTimer);
            const minutes = Math.floor(remaining / 60);
            const seconds = Math.floor(remaining % 60);

            // 最后30秒变红警告
            if (remaining <= GAME_TIME_CONFIG.warningTime) {
                timerLabel.color = new Color(255, 50, 50, 255);
            }

            const secondsStr = seconds < 10 ? '0' + seconds : seconds.toString();
            timerLabel.string = `⏱️ ${minutes}:${secondsStr}`;
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

        // 记录击杀时间（用于动态难度和无战斗检测）
        this._lastKillTime = this._gameTimer;

        // 添加连击
        const comboData = this._comboManager?.addKill();
        const comboMultiplier = comboData?.multiplier || 1;

        // 应用连击倍数到金币
        const finalGold = Math.floor(gold * comboMultiplier);
        this._gold += finalGold;
        this._score += finalGold * 10;
        this._killCount++;

        // 更新连击UI
        this.updateComboUI();

        // 更新狗情绪
        this.updateDogMood();

        // 不再检查敌人数量，因为我们有无限刷新
        this.updateHUD();
    }

    // 更新连击UI显示
    private updateComboUI() {
        const comboLabel = this._hud?.getChildByName('ComboLabel')?.getComponent(Label);
        if (comboLabel && this._comboManager) {
            const combo = this._comboManager.getComboData();
            if (combo.isActive && combo.count > 0) {
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

                comboLabel.string = `${combo.count} COMBO x${combo.multiplier} 🔥`;
                comboLabel.color = new Color().fromHEX(color);
                comboLabel.node.active = true;
            } else {
                comboLabel.node.active = false;
            }
        }
    }

    // 更新狗情绪显示
    private updateDogMood() {
        const dogMoodLabel = this._hud?.getChildByName('DogMoodLabel')?.getComponent(Label);
        const dogCtrl = this._dogPartner?.getComponent(DogController);

        if (dogMoodLabel && dogCtrl) {
            const mood = dogCtrl.getCurrentMood();
            const expression = dogCtrl.getMoodExpression();
            dogMoodLabel.string = expression;
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
        // 摇杆现在使用 Widget 固定位置，不需要手动更新

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
    public getHUD(): Node | null { return this._hud; }
    public getGameTime(): number { return this._gameTimer; }
    public getDifficultyMultiplier(): number { return this._difficultyMultiplier; }
    public addGold(amount: number) {
        this._gold += amount;
        this.updateHUD();
    }
}
