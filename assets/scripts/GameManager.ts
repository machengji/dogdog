import {
    _decorator,
    Component,
    Node,
    Label,
    Sprite,
    SpriteFrame,
    Texture2D,
    resources,
    Graphics,
    UITransform,
    Color,
    Vec3,
    director,
    view,
    ResolutionPolicy,
    Camera,
    Layers,
    Canvas,
    RenderRoot2D,
    input,
    Input,
    EventTouch
} from 'cc';
import {
    PLAYER_CONFIG,
    ENEMY_CONFIG,
    SPAWN_CONFIG,
    GAME_TIME_CONFIG
} from './Constants';
import { GameState, PlayerStats } from './types/GameTypes';
import { PlayerController } from './PlayerController';
import { EnemyController } from './EnemyController';
import { DogController } from './DogController';
import { BulletController } from './BulletController';
import { VirtualJoystick } from './VirtualJoystick';
import { ComboManager } from './ComboManager';

const { ccclass } = _decorator;

type SpawnWeightItem = {
    config: any;
    weight: number;
};

type SpawnPhase = {
    interval: number;
    pool: SpawnWeightItem[];
};

type UpgradeChoice = {
    id: string;
    title: string;
    description: string;
};

@ccclass('GameManager')
export class GameManager extends Component {
    private static _instance: GameManager | null = null;

    public static get instance(): GameManager {
        return GameManager._instance!;
    }

    private _gameState: GameState = GameState.MENU;
    private _player: Node | null = null;
    private _dogPartner: Node | null = null;
    private _playerStats: PlayerStats = {} as PlayerStats;
    private _enemies: Node[] = [];
    private _bullets: Node[] = [];
    private _gold = 0;
    private _score = 0;
    private _gameTimer = 0;
    private _spawnTimer = 0;
    private _difficultyCheckTimer = 0;
    private _difficultyMultiplier = 1;
    private _screenWidth = 0;
    private _screenHeight = 0;

    private _cameraNode: Node | null = null;
    private _camera: Camera | null = null;
    private _uiCamera: Camera | null = null;
    private _uiCanvasNode: Node | null = null;
    private _hudNode: Node | null = null;
    private _worldRoot: Node | null = null;
    private _virtualJoystick: VirtualJoystick | null = null;
    private _pixelFrames: Record<string, SpriteFrame> = {};
    private _resultPanel: Node | null = null;
    private _levelUpPanel: Node | null = null;

    private _level = 1;
    private _exp = 0;
    private _nextLevelExp = 30;

    private _restartListenerRegistered = false;
    private _restartEnableTime = 0;

    private readonly _cameraZ = 600;
    private readonly _maxEnemies = Math.max(30, SPAWN_CONFIG?.maxEnemies ?? 40);
    private readonly _designWidth = 720;
    private readonly _designHeight = 1280;
    private readonly _portraitWorldZoom = 1.3;
    private readonly _landscapeWorldZoom = 1.16;
    private readonly _hudTopMargin = 42;
    private _isPortrait = true;
    private readonly _upgradePool: UpgradeChoice[] = [
        { id: 'atk_up', title: '火力过载', description: '攻击 +45%' },
        { id: 'fire_rate_up', title: '疾速连发', description: '射速 +1.4' },
        { id: 'speed_up', title: '疾风走位', description: '移速 +65' },
        { id: 'crit_up', title: '要害洞察', description: '暴击率 +12%' },
        { id: 'crit_dmg_up', title: '毁伤弹芯', description: '暴击伤害 +0.8' },
        { id: 'range_up', title: '超距索敌', description: '射程 +90' },
        { id: 'heal_up', title: '战地补给', description: '恢复 60% 生命' },
        { id: 'hp_up', title: '重装外骨骼', description: '最大生命 +40 并回复 40' }
    ];

    onLoad() {
        GameManager._instance = this;
        this.initScreen();
    }

    onDestroy() {
        this.unregisterRestartListener();
        this._levelUpPanel?.destroy();
        this._levelUpPanel = null;
        view.setResizeCallback(undefined as unknown as () => void);
    }

    private initScreen() {
        this.applyDesignResolution();
        view.setResizeCallback(() => this.onViewResize());
    }

    private applyDesignResolution() {
        const frameSize = view.getFrameSize();
        this._isPortrait = frameSize.height >= frameSize.width;
        const designWidth = this._isPortrait ? this._designWidth : this._designHeight;
        const designHeight = this._isPortrait ? this._designHeight : this._designWidth;

        view.setDesignResolutionSize(designWidth, designHeight, ResolutionPolicy.SHOW_ALL);
        const visible = view.getVisibleSize();
        this._screenWidth = visible.width;
        this._screenHeight = visible.height;
    }

    private onViewResize() {
        this.applyDesignResolution();
        this.refreshUILayout();
    }

    private refreshUILayout() {
        const halfH = this._screenHeight * 0.5;
        if (this._camera) {
            this._camera.orthoHeight = this.getWorldCameraHalfHeight();
        }
        if (this._uiCamera) {
            this._uiCamera.orthoHeight = halfH;
        }

        const canvasTransform = this._uiCanvasNode?.getComponent(UITransform);
        if (canvasTransform) {
            canvasTransform.setContentSize(this._screenWidth, this._screenHeight);
        }

        const hudTransform = this._hudNode?.getComponent(UITransform);
        if (hudTransform) {
            hudTransform.setContentSize(this._screenWidth, this._screenHeight);
        }

        this.layoutHUD();
        this.updateHUDLabelStyles();
        this.repositionVirtualJoystick();
        this.updateResultPanelLayout();
        this.updateLevelUpPanelLayout();

        const comboManager = this.getComboManager();
        comboManager?.setUIRoot(this._hudNode);
    }

    private setUIPosition(nodeName: string, x: number, y: number) {
        const node = this._hudNode?.getChildByName(nodeName);
        if (!node) {
            return;
        }
        node.setPosition(x, y, 0);
    }

    private layoutHUD() {
        if (!this._hudNode) {
            return;
        }

        const halfW = this._screenWidth * 0.5;
        const halfH = this._screenHeight * 0.5;
        const topY = halfH - this._hudTopMargin;
        const isNarrow = this.isNarrowHud();

        this.setUIPosition('HP_BG', -halfW + 120, topY);
        this.setUIPosition('HPBar', -halfW + 120, topY);
        this.setUIPosition('GoldLabel', halfW - (isNarrow ? 80 : 100), topY);
        this.setUIPosition('ScoreLabel', 0, topY);
        this.setUIPosition('TimerLabel', 0, topY - (isNarrow ? 34 : 38));
        this.setUIPosition('LevelLabel', -halfW + (isNarrow ? 130 : 160), topY - (isNarrow ? 34 : 38));
        this.setUIPosition('ExpLabel', -halfW + (isNarrow ? 150 : 190), topY - (isNarrow ? 66 : 72));
        this.setUIPosition('DogMoodLabel', -halfW + (isNarrow ? 46 : 56), topY - (isNarrow ? 34 : 38));

        const moodNode = this._hudNode.getChildByName('DogMoodLabel');
        if (moodNode) {
            moodNode.active = true;
        }
    }

    private getWorldCameraHalfHeight(): number {
        const zoom = this._isPortrait ? this._portraitWorldZoom : this._landscapeWorldZoom;
        return this._screenHeight * 0.5 * zoom;
    }

    private isNarrowHud(): boolean {
        return this._screenWidth <= 680;
    }

    private updateHUDLabelStyles() {
        if (!this._hudNode) {
            return;
        }

        const isNarrow = this.isNarrowHud();
        const mainSize = isNarrow ? 22 : 26;
        const dogSize = isNarrow ? 22 : 26;

        const gold = this._hudNode.getChildByName('GoldLabel')?.getComponent(Label);
        if (gold) {
            gold.fontSize = mainSize;
            gold.lineHeight = mainSize + 4;
        }

        const score = this._hudNode.getChildByName('ScoreLabel')?.getComponent(Label);
        if (score) {
            score.fontSize = mainSize;
            score.lineHeight = mainSize + 4;
        }

        const timer = this._hudNode.getChildByName('TimerLabel')?.getComponent(Label);
        if (timer) {
            timer.fontSize = mainSize;
            timer.lineHeight = mainSize + 4;
        }

        const level = this._hudNode.getChildByName('LevelLabel')?.getComponent(Label);
        if (level) {
            level.fontSize = isNarrow ? 20 : 24;
            level.lineHeight = level.fontSize + 4;
        }

        const exp = this._hudNode.getChildByName('ExpLabel')?.getComponent(Label);
        if (exp) {
            exp.fontSize = isNarrow ? 18 : 22;
            exp.lineHeight = exp.fontSize + 4;
        }

        const mood = this._hudNode.getChildByName('DogMoodLabel')?.getComponent(Label);
        if (mood) {
            mood.fontSize = dogSize;
            mood.lineHeight = dogSize + 4;
        }
    }

    private repositionVirtualJoystick() {
        if (!this._virtualJoystick?.node) {
            return;
        }
        const joystickNode = this._virtualJoystick.node;
        const touchAreaWidth = Math.max(280, this._screenWidth * 0.5);
        const touchAreaHeight = this._screenHeight;
        const transform = joystickNode.getComponent(UITransform) ?? joystickNode.addComponent(UITransform);
        transform.setContentSize(touchAreaWidth, touchAreaHeight);
        joystickNode.setPosition(-this._screenWidth * 0.5 + touchAreaWidth * 0.5, 0, 0);
    }

    private updateResultPanelLayout() {
        if (!this._resultPanel?.isValid) {
            return;
        }

        const panelTransform = this._resultPanel.getComponent(UITransform);
        if (panelTransform) {
            panelTransform.setContentSize(this._screenWidth, this._screenHeight);
        }

        const bg = this._resultPanel.getComponent(Graphics);
        if (bg) {
            bg.clear();
            bg.fillColor = new Color(0, 0, 0, 180);
            bg.fillRect(-this._screenWidth * 0.5, -this._screenHeight * 0.5, this._screenWidth, this._screenHeight);
        }
    }

    private updateLevelUpPanelLayout() {
        if (!this._levelUpPanel?.isValid) {
            return;
        }

        const panelTransform = this._levelUpPanel.getComponent(UITransform);
        if (panelTransform) {
            panelTransform.setContentSize(this._screenWidth, this._screenHeight);
        }

        const bg = this._levelUpPanel.getComponent(Graphics);
        if (bg) {
            bg.clear();
            bg.fillColor = new Color(0, 0, 0, 192);
            bg.fillRect(-this._screenWidth * 0.5, -this._screenHeight * 0.5, this._screenWidth, this._screenHeight);
        }
    }

    start() {
        this.scheduleOnce(async () => {
            await this.preloadPixelAssets();
            this.createGameScene();
            this.startGame();
        }, 0);
    }

    private async preloadPixelAssets() {
        const assets = [
            ['player', 'pixel/player'],
            ['dog', 'pixel/dog'],
            ['enemy', 'pixel/enemy'],
            ['bullet', 'pixel/bullet'],
            ['bullet_crit', 'pixel/bullet_crit']
        ] as const;

        await Promise.all(assets.map(([key, path]) => this.loadPixelFrame(path, key)));
    }

    private loadPixelFrame(path: string, key: string): Promise<void> {
        return new Promise((resolve) => {
            resources.load(path, Texture2D, (err, texture) => {
                if (!err && texture) {
                    const frame = new SpriteFrame();
                    frame.texture = texture;
                    this._pixelFrames[key] = frame;
                }
                resolve();
            });
        });
    }

    private createGameScene() {
        const scene = director.getScene();
        if (!scene) {
            return;
        }

        if (this.node.parent !== scene) {
            this.node.setParent(scene);
        }

        ['UICanvas', 'UICamera', 'GameCamera', 'WorldRoot', 'Main Camera', 'Canvas'].forEach((name) => {
            const oldNode = scene.getChildByName(name);
            if (oldNode && oldNode !== this.node && !oldNode.isChildOf(this.node) && !this.node.isChildOf(oldNode)) {
                oldNode.destroy();
            }
        });

        this._worldRoot = new Node('WorldRoot');
        this._worldRoot.layer = Layers.Enum.DEFAULT;
        this._worldRoot.setParent(scene);
        this._worldRoot.addComponent(RenderRoot2D);

        const camNode = new Node('GameCamera');
        camNode.layer = Layers.Enum.DEFAULT;
        camNode.setParent(scene);
        camNode.setPosition(0, 0, this._cameraZ);
        this._cameraNode = camNode;
        this._camera = camNode.addComponent(Camera);
        this._camera.projection = Camera.ProjectionType.ORTHO;
        this._camera.orthoHeight = this.getWorldCameraHalfHeight();
        this._camera.priority = 0;
        this._camera.clearFlags = 7;
        this._camera.near = 0.1;
        this._camera.far = 3000;
        this._camera.visibility = Layers.BitMask.DEFAULT;
        this._camera.clearColor = new Color(20, 20, 24, 255);

        const uiCamNode = new Node('UICamera');
        uiCamNode.layer = Layers.Enum.UI_2D;
        uiCamNode.setParent(scene);
        uiCamNode.setPosition(0, 0, this._cameraZ);
        const uiCam = uiCamNode.addComponent(Camera);
        uiCam.projection = Camera.ProjectionType.ORTHO;
        uiCam.orthoHeight = this._screenHeight * 0.5;
        uiCam.priority = 10;
        uiCam.clearFlags = 2;
        uiCam.visibility = Layers.BitMask.UI_2D;
        this._uiCamera = uiCam;

        const canvasNode = new Node('UICanvas');
        canvasNode.layer = Layers.Enum.UI_2D;
        canvasNode.setParent(scene);
        canvasNode.addComponent(UITransform).setContentSize(this._screenWidth, this._screenHeight);
        const canvas = canvasNode.addComponent(Canvas);
        canvas.cameraComponent = uiCam;
        canvas.alignCanvasWithScreen = true;
        this._uiCanvasNode = canvasNode;

        if (!this.node.getComponent(ComboManager)) {
            this.node.addComponent(ComboManager);
        }

        this.createBackground();
        this.createPlayer();
        this.createDogPartner();
        this.createHUD();
        this.createVirtualJoystick();

        const comboManager = this.getComboManager();
        comboManager?.setUIRoot(this._hudNode);
        comboManager?.resetCombo();
    }

    private createPixelNode(
        parent: Node,
        name: string,
        assetKey: string,
        pattern: string[],
        palette: Record<string, Color>,
        pixelSize: number,
        preferTexture = false
    ): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.DEFAULT;
        node.setParent(parent);

        const rows = pattern.length;
        const cols = pattern[0]?.length ?? 1;
        const width = cols * pixelSize;
        const height = rows * pixelSize;
        node.addComponent(UITransform).setContentSize(width, height);

        const frame = this._pixelFrames[assetKey];
        if (preferTexture && frame) {
            const sprite = node.addComponent(Sprite);
            sprite.spriteFrame = frame;
        } else {
            const g = node.addComponent(Graphics);
            this.drawPixelSprite(g, pattern, palette, pixelSize);
        }
        return node;
    }

    private drawPixelSprite(
        graphics: Graphics,
        pattern: string[],
        palette: Record<string, Color>,
        pixelSize: number
    ) {
        const rows = pattern.length;
        const cols = pattern[0]?.length ?? 0;
        const width = cols * pixelSize;
        const height = rows * pixelSize;
        const startX = -width * 0.5;
        const startY = height * 0.5 - pixelSize;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const key = pattern[row][col];
                if (key === '.' || !palette[key]) {
                    continue;
                }
                graphics.fillColor = palette[key];
                graphics.fillRect(
                    startX + col * pixelSize,
                    startY - row * pixelSize,
                    pixelSize,
                    pixelSize
                );
            }
        }
    }

    private createBackground() {
        if (!this._worldRoot) {
            return;
        }

        const bg = new Node('Background');
        bg.layer = Layers.Enum.DEFAULT;
        bg.setParent(this._worldRoot);

        const size = 6000;
        bg.addComponent(UITransform).setContentSize(size, size);
        const g = bg.addComponent(Graphics);
        g.fillColor = new Color(20, 22, 30, 255);
        g.fillRect(-size * 0.5, -size * 0.5, size, size);

        const tileSize = 80;
        for (let x = -size * 0.5; x < size * 0.5; x += tileSize) {
            for (let y = -size * 0.5; y < size * 0.5; y += tileSize) {
                const tx = Math.floor((x + size * 0.5) / tileSize);
                const ty = Math.floor((y + size * 0.5) / tileSize);
                const odd = (tx + ty) % 2 === 0;

                g.fillColor = odd ? new Color(36, 40, 56, 255) : new Color(30, 34, 48, 255);
                g.fillRect(x, y, tileSize, tileSize);

                if ((tx * 7 + ty * 11) % 17 === 0) {
                    g.fillColor = new Color(48, 54, 76, 255);
                    g.fillRect(x + 8, y + 8, 8, 8);
                }
            }
        }
    }

    private createPlayer() {
        if (!this._worldRoot) {
            return;
        }

        this._player = this.createPixelNode(
            this._worldRoot,
            'Player',
            'player',
            [
                '..0110..',
                '.012221.',
                '01243210',
                '12344321',
                '12344321',
                '12333321',
                '12222221',
                '..1..1..'
            ],
            {
                '0': new Color(6, 56, 92, 255),
                '1': new Color(16, 130, 208, 255),
                '2': new Color(24, 198, 255, 255),
                '3': new Color(104, 236, 255, 255),
                '4': new Color(206, 255, 255, 255),
                '5': new Color(255, 255, 255, 255)
            },
            6
        );

        this._playerStats = {
            maxHp: PLAYER_CONFIG.maxHp,
            currentHp: PLAYER_CONFIG.maxHp,
            attack: PLAYER_CONFIG.baseAttack,
            speed: PLAYER_CONFIG.baseSpeed,
            fireRate: PLAYER_CONFIG.fireRate ?? 3,
            critRate: PLAYER_CONFIG.baseCritRate,
            critDamage: PLAYER_CONFIG.baseCritDamage,
            dodgeRate: PLAYER_CONFIG.dodgeRate,
            pickupRange: PLAYER_CONFIG.pickupRange,
            range: PLAYER_CONFIG.range
        };

        this._player.addComponent(PlayerController);
    }

    private createDogPartner() {
        if (!this._worldRoot) {
            return;
        }

        this._dogPartner = this.createPixelNode(
            this._worldRoot,
            'DogPartner',
            'dog',
            [
                '..11.11..',
                '122222221',
                '123333321',
                '123434321',
                '123333321',
                '.12222221',
                '..14541..',
                '..1...1..'
            ],
            {
                '1': new Color(96, 58, 26, 255),
                '2': new Color(168, 98, 44, 255),
                '3': new Color(232, 160, 84, 255),
                '4': new Color(255, 234, 196, 255),
                '5': new Color(40, 32, 24, 255)
            },
            6
        );

        this._dogPartner.addComponent(DogController);
    }

    private createHUD() {
        if (!this._uiCanvasNode) {
            return;
        }

        this._hudNode = new Node('HUD');
        this._hudNode.layer = Layers.Enum.UI_2D;
        this._hudNode.setParent(this._uiCanvasNode);
        this._hudNode.addComponent(UITransform).setContentSize(this._screenWidth, this._screenHeight);

        const halfW = this._screenWidth * 0.5;
        const halfH = this._screenHeight * 0.5;

        this.createUIRect(this._hudNode, 'HP_BG', -halfW + 120, halfH - 40, 200, 20, new Color(50, 50, 50, 220));
        this.createUIRect(this._hudNode, 'HPBar', -halfW + 120, halfH - 40, 196, 16, Color.RED);
        this.createLabel(this._hudNode, 'GoldLabel', halfW - 100, halfH - 40, '金币: 0');
        this.createLabel(this._hudNode, 'ScoreLabel', 0, halfH - 40, '分数: 0');
        this.createLabel(this._hudNode, 'TimerLabel', 0, halfH - 78, '时间: 03:00');
        this.createLabel(this._hudNode, 'LevelLabel', -halfW + 160, halfH - 78, '等级: 1');
        this.createLabel(this._hudNode, 'ExpLabel', -halfW + 190, halfH - 112, '经验: 0/30');
        this.createLabel(this._hudNode, 'DogMoodLabel', -halfW + 320, halfH - 40, '🐕');
        this.updateHUDLabelStyles();
        this.layoutHUD();
    }

    private createUIRect(parent: Node, name: string, x: number, y: number, w: number, h: number, color: Color): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.setParent(parent);
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(w, h);
        const g = node.addComponent(Graphics);
        g.fillColor = color;
        g.fillRect(-w * 0.5, -h * 0.5, w, h);
        return node;
    }

    private createLabel(parent: Node, name: string, x: number, y: number, text: string): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.setParent(parent);
        node.setPosition(x, y, 0);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = 24;
        label.lineHeight = 28;
        return node;
    }

    private createVirtualJoystick() {
        if (!this._uiCanvasNode) {
            return;
        }

        const joystick = new Node('VirtualJoystick');
        joystick.layer = Layers.Enum.UI_2D;
        joystick.setParent(this._uiCanvasNode);
        joystick.addComponent(UITransform).setContentSize(Math.max(280, this._screenWidth * 0.5), this._screenHeight);
        this._virtualJoystick = joystick.addComponent(VirtualJoystick);
        this.repositionVirtualJoystick();
    }

    update(dt: number) {
        if (this._player && this._cameraNode) {
            const playerPos = this._player.getPosition();
            this._cameraNode.setPosition(playerPos.x, playerPos.y, this._cameraZ);
        }

        if (this._gameState === GameState.PLAYING) {
            this.updateGame(dt);
        }
    }

    private updateGame(dt: number) {
        this._gameTimer += dt;
        this._spawnTimer += dt;
        this._difficultyCheckTimer += dt;

        this.updateTimerUI();

        const victoryTime = this.getVictoryTime();
        if (this._gameTimer >= victoryTime) {
            this.enterResult(GameState.VICTORY, '胜利！');
            return;
        }

        if (this._difficultyCheckTimer >= this.getDifficultyCheckInterval()) {
            this._difficultyCheckTimer = 0;
            this.updateDynamicDifficulty();
        }

        const spawnInterval = this.getSpawnInterval();
        while (this._spawnTimer >= spawnInterval && this._enemies.length < this._maxEnemies) {
            this._spawnTimer -= spawnInterval;
            this.spawnEnemy();
        }

        this.updateHUDStats();
    }

    private updateHUDStats() {
        const goldLabel = this._hudNode?.getChildByName('GoldLabel')?.getComponent(Label);
        if (goldLabel) {
            goldLabel.string = `金币: ${this._gold}`;
        }

        const scoreLabel = this._hudNode?.getChildByName('ScoreLabel')?.getComponent(Label);
        if (scoreLabel) {
            scoreLabel.string = `分数: ${this._score}`;
        }

        const levelLabel = this._hudNode?.getChildByName('LevelLabel')?.getComponent(Label);
        if (levelLabel) {
            levelLabel.string = `等级: ${this._level}`;
        }

        const expLabel = this._hudNode?.getChildByName('ExpLabel')?.getComponent(Label);
        if (expLabel) {
            expLabel.string = `经验: ${Math.floor(this._exp)}/${this._nextLevelExp}`;
        }
    }

    private updateTimerUI() {
        const timerLabel = this._hudNode?.getChildByName('TimerLabel')?.getComponent(Label);
        if (!timerLabel) {
            return;
        }

        const remain = Math.max(0, this.getVictoryTime() - this._gameTimer);
        const minutes = Math.floor(remain / 60);
        const seconds = Math.floor(remain % 60);
        const minuteText = minutes < 10 ? `0${minutes}` : `${minutes}`;
        const secondText = seconds < 10 ? `0${seconds}` : `${seconds}`;
        timerLabel.string = `时间: ${minuteText}:${secondText}`;

        const warningTime = GAME_TIME_CONFIG?.warningTime ?? 30;
        timerLabel.color = remain <= warningTime ? new Color(255, 92, 92, 255) : new Color(255, 255, 255, 255);
    }

    private getVictoryTime(): number {
        return GAME_TIME_CONFIG?.victoryTime ?? 180;
    }

    private getDifficultyCheckInterval(): number {
        return SPAWN_CONFIG?.dynamicDifficulty?.checkInterval ?? 10;
    }

    private updateDynamicDifficulty() {
        const combo = this.getComboManager()?.getComboCount() ?? 0;
        const hpPercent = this._playerStats.currentHp / Math.max(1, this._playerStats.maxHp);

        let target = this._difficultyMultiplier;

        if (combo >= 15 && hpPercent > 0.7) {
            target += SPAWN_CONFIG?.dynamicDifficulty?.adjustmentRate ?? 0.08;
        } else if (hpPercent < 0.25 || this._enemies.length > this._maxEnemies * 0.8) {
            target -= SPAWN_CONFIG?.dynamicDifficulty?.adjustmentRate ?? 0.08;
        }

        this._difficultyMultiplier = Math.max(0.7, Math.min(1.8, target));
    }

    private getBruteEnemyConfig() {
        return {
            id: 'bruteDog',
            name: '重甲犬',
            hp: 135,
            attack: 16,
            speed: 78,
            size: 46,
            color: '#7A2E21',
            skill: 'armor',
            dropGold: 28
        };
    }

    private getSpawnPhase(): SpawnPhase {
        const lazy = ENEMY_CONFIG.lazyDog;
        const crazy = ENEMY_CONFIG.crazyDog ?? ENEMY_CONFIG.lazyDog;
        const fat = ENEMY_CONFIG.fatDog ?? {
            id: 'fatDog',
            name: '胖犬',
            hp: 120,
            attack: 12,
            speed: 42,
            size: 52,
            color: '#DAA520',
            skill: 'attract',
            dropGold: 22
        };
        const brute = this.getBruteEnemyConfig();

        if (this._gameTimer < 15) {
            return {
                interval: 0.88,
                pool: [{ config: lazy, weight: 1 }]
            };
        }

        if (this._gameTimer < 30) {
            return {
                interval: 0.72,
                pool: [
                    { config: lazy, weight: 0.72 },
                    { config: crazy, weight: 0.28 }
                ]
            };
        }

        if (this._gameTimer < 60) {
            return {
                interval: 0.6,
                pool: [
                    { config: lazy, weight: 0.52 },
                    { config: crazy, weight: 0.33 },
                    { config: fat, weight: 0.15 }
                ]
            };
        }

        return {
            interval: 0.48,
            pool: [
                { config: lazy, weight: 0.42 },
                { config: crazy, weight: 0.3 },
                { config: fat, weight: 0.18 },
                { config: brute, weight: 0.1 }
            ]
        };
    }

    private getSpawnInterval(): number {
        const phase = this.getSpawnPhase();
        const interval = phase.interval / Math.max(0.7, this._difficultyMultiplier);
        return Math.max(0.18, Math.min(1.2, interval));
    }

    private pickEnemyConfig(): any {
        const phase = this.getSpawnPhase();
        const totalWeight = phase.pool.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
        if (totalWeight <= 0) {
            return ENEMY_CONFIG.lazyDog;
        }

        let roll = Math.random() * totalWeight;
        for (const item of phase.pool) {
            const weight = Math.max(0, item.weight);
            if (roll <= weight) {
                return item.config;
            }
            roll -= weight;
        }

        return phase.pool[phase.pool.length - 1]?.config ?? ENEMY_CONFIG.lazyDog;
    }

    private getEnemyVisual(enemyId?: string): {
        pattern: string[];
        palette: Record<string, Color>;
        pixelSize: number;
    } {
        if (enemyId === 'crazyDog') {
            return {
                pattern: [
                    '..1111..',
                    '.125552.',
                    '12566652',
                    '12377332',
                    '12333332',
                    '.1222221',
                    '..14444.'
                ],
                palette: {
                    '1': new Color(92, 22, 18, 255),
                    '2': new Color(180, 38, 34, 255),
                    '3': new Color(228, 76, 68, 255),
                    '4': new Color(255, 210, 92, 255),
                    '5': new Color(255, 128, 118, 255),
                    '6': new Color(255, 178, 164, 255),
                    '7': new Color(38, 16, 12, 255)
                },
                pixelSize: 6
            };
        }

        if (enemyId === 'fatDog') {
            return {
                pattern: [
                    '.1111111.',
                    '122222222',
                    '123333321',
                    '123444321',
                    '123444321',
                    '123333321',
                    '122222222',
                    '.1555551.'
                ],
                palette: {
                    '1': new Color(102, 78, 30, 255),
                    '2': new Color(168, 126, 52, 255),
                    '3': new Color(222, 176, 88, 255),
                    '4': new Color(255, 224, 150, 255),
                    '5': new Color(64, 38, 20, 255)
                },
                pixelSize: 7
            };
        }

        if (enemyId === 'bruteDog') {
            return {
                pattern: [
                    '..11111..',
                    '.12222221',
                    '123333321',
                    '123454321',
                    '123454321',
                    '123333321',
                    '.12222221',
                    '..16661..'
                ],
                palette: {
                    '1': new Color(82, 20, 16, 255),
                    '2': new Color(136, 46, 34, 255),
                    '3': new Color(188, 82, 68, 255),
                    '4': new Color(246, 150, 128, 255),
                    '5': new Color(255, 224, 178, 255),
                    '6': new Color(56, 22, 18, 255)
                },
                pixelSize: 7
            };
        }

        return {
            pattern: [
                '..1111..',
                '.1222221.',
                '12333321',
                '12343421',
                '12333321',
                '.1222221.',
                '..14541..'
            ],
            palette: {
                '1': new Color(84, 22, 22, 255),
                '2': new Color(136, 38, 38, 255),
                '3': new Color(204, 68, 68, 255),
                '4': new Color(252, 224, 136, 255),
                '5': new Color(34, 20, 20, 255)
            },
            pixelSize: 6
        };
    }

    public spawnEnemy(config?: any) {
        if (!this._worldRoot) {
            return;
        }

        const enemyConfig = config ?? this.pickEnemyConfig();
        const visual = this.getEnemyVisual(enemyConfig?.id);

        const enemy = this.createPixelNode(
            this._worldRoot,
            'Enemy',
            'enemy',
            visual.pattern,
            visual.palette,
            visual.pixelSize
        );

        const playerPos = this._player?.getPosition() || new Vec3();
        const angle = Math.random() * Math.PI * 2;
        const spawnRadius = Math.max(220, Math.min(this.getHalfHeight() * 0.75, 460));
        enemy.setPosition(
            playerPos.x + Math.cos(angle) * spawnRadius,
            playerPos.y + Math.sin(angle) * spawnRadius,
            0
        );

        const baseSize = 40;
        const targetSize = enemyConfig?.size ?? 40;
        const scale = targetSize / baseSize;
        enemy.setScale(scale, scale, 1);

        const sprite = enemy.getComponent(Sprite);
        if (sprite) {
            if (enemyConfig?.id === 'crazyDog') {
                sprite.color = new Color(255, 132, 110, 255);
            } else if (enemyConfig?.id === 'fatDog') {
                sprite.color = new Color(229, 184, 90, 255);
            } else if (enemyConfig?.id === 'bruteDog') {
                sprite.color = new Color(190, 90, 80, 255);
            }
        }

        enemy.addComponent(EnemyController).init(enemyConfig);
        this._enemies.push(enemy);
    }

    public createBullet(start: Vec3, direction: Vec3, damage: number, isCrit: boolean): Node {
        const parent = this._worldRoot ?? this.node;
        const bullet = this.createPixelNode(
            parent,
            'Bullet',
            isCrit ? 'bullet_crit' : 'bullet',
            [
                '.1.',
                '111',
                '.1.'
            ],
            isCrit
                ? { '1': new Color(255, 205, 64, 255) }
                : { '1': new Color(186, 226, 255, 255) },
            4
        );
        bullet.setPosition(start);
        bullet.addComponent(BulletController).init(direction, damage, isCrit);
        this._bullets.push(bullet);
        return bullet;
    }

    public startGame() {
        this._gameState = GameState.PLAYING;
        this._gold = 0;
        this._score = 0;
        this._level = 1;
        this._exp = 0;
        this._nextLevelExp = this.calculateNextLevelExp(this._level);
        this._gameTimer = 0;
        this._spawnTimer = 0;
        this._difficultyCheckTimer = 0;
        this._difficultyMultiplier = 1;
        this._resultPanel?.destroy();
        this._resultPanel = null;
        this._levelUpPanel?.destroy();
        this._levelUpPanel = null;
        this.unregisterRestartListener();

        if (this._virtualJoystick) {
            this._virtualJoystick.setEnabled(true);
            this._virtualJoystick.node.active = true;
        }

        this.updateTimerUI();
        this.updateHUDStats();
    }

    private enterResult(state: GameState, title: string) {
        if (this._gameState === GameState.VICTORY || this._gameState === GameState.DEFEAT) {
            return;
        }

        this._gameState = state;

        if (this._virtualJoystick) {
            this._virtualJoystick.setEnabled(false);
            this._virtualJoystick.node.active = false;
        }

        this._levelUpPanel?.destroy();
        this._levelUpPanel = null;

        this.showResultPanel(title);
        this.registerRestartListener();
    }

    private showResultPanel(title: string) {
        if (!this._uiCanvasNode) {
            return;
        }

        if (this._resultPanel?.isValid) {
            this._resultPanel.destroy();
        }

        const panel = new Node('ResultPanel');
        panel.layer = Layers.Enum.UI_2D;
        panel.setParent(this._uiCanvasNode);
        panel.addComponent(UITransform).setContentSize(this._screenWidth, this._screenHeight);

        const bg = panel.addComponent(Graphics);
        bg.fillColor = new Color(0, 0, 0, 180);
        bg.fillRect(-this._screenWidth * 0.5, -this._screenHeight * 0.5, this._screenWidth, this._screenHeight);

        const titleNode = this.createLabel(panel, 'ResultTitle', 0, 80, title);
        const titleLabel = titleNode.getComponent(Label);
        if (titleLabel) {
            titleLabel.fontSize = 52;
            titleLabel.color = title === '胜利！' ? new Color(255, 228, 92, 255) : new Color(255, 120, 120, 255);
        }

        const infoNode = this.createLabel(
            panel,
            'ResultInfo',
            0,
            10,
            `分数: ${this._score}  金币: ${this._gold}  等级: ${this._level}  存活: ${Math.floor(this._gameTimer)}秒`
        );
        const infoLabel = infoNode.getComponent(Label);
        if (infoLabel) {
            infoLabel.fontSize = 30;
        }

        const tipNode = this.createLabel(panel, 'ResultTip', 0, -70, '点击屏幕重新开始');
        const tipLabel = tipNode.getComponent(Label);
        if (tipLabel) {
            tipLabel.fontSize = 26;
            tipLabel.color = new Color(220, 220, 220, 255);
        }

        this._resultPanel = panel;
    }

    private registerRestartListener() {
        if (this._restartListenerRegistered) {
            return;
        }
        this._restartEnableTime = Date.now() + 300;
        input.on(Input.EventType.TOUCH_START, this.onRestartTouch, this);
        this._restartListenerRegistered = true;
    }

    private unregisterRestartListener() {
        if (!this._restartListenerRegistered) {
            return;
        }
        input.off(Input.EventType.TOUCH_START, this.onRestartTouch, this);
        this._restartListenerRegistered = false;
    }

    private onRestartTouch(_event: EventTouch) {
        if (Date.now() < this._restartEnableTime) {
            return;
        }

        this.unregisterRestartListener();
        const scene = director.getScene();
        if (scene) {
            director.loadScene(scene.name);
        }
    }

    public killEnemy(enemy: Node, gold: number) {
        this._enemies = this._enemies.filter((e) => e !== enemy && e.isValid);
        if (enemy.isValid) {
            enemy.destroy();
        }

        this._gold += gold;
        this._score += gold * 10;
        this.addExperience(Math.max(8, Math.round(gold * 1.5)));

        const comboManager = this.getComboManager();
        comboManager?.addKill();

        const dogCtrl = this._dogPartner?.getComponent(DogController);
        dogCtrl?.resetNoKillTimer();
    }

    private calculateNextLevelExp(level: number): number {
        const levelIndex = Math.max(1, level);
        return Math.floor(20 + levelIndex * 7 + Math.pow(levelIndex, 1.12) * 3);
    }

    private addExperience(exp: number) {
        if (exp <= 0 || this._gameState !== GameState.PLAYING) {
            return;
        }

        this._exp += exp;

        while (this._exp >= this._nextLevelExp) {
            this._exp -= this._nextLevelExp;
            this._level += 1;
            this._nextLevelExp = this.calculateNextLevelExp(this._level);
            this.showLevelUpPanel();

            // 升级选择期间暂停，避免连续弹出覆盖。
            if (this._gameState !== GameState.PLAYING) {
                break;
            }
        }

        this.updateHUDStats();
    }

    private pickUpgradeChoices(count: number): UpgradeChoice[] {
        const pool = [...this._upgradePool];
        const picks: UpgradeChoice[] = [];
        while (pool.length > 0 && picks.length < count) {
            const idx = Math.floor(Math.random() * pool.length);
            const [choice] = pool.splice(idx, 1);
            picks.push(choice);
        }
        return picks;
    }

    private showLevelUpPanel() {
        if (!this._uiCanvasNode || this._gameState !== GameState.PLAYING) {
            return;
        }

        this._gameState = GameState.PAUSED;
        if (this._virtualJoystick) {
            this._virtualJoystick.setEnabled(false);
            this._virtualJoystick.node.active = false;
        }

        this._levelUpPanel?.destroy();
        const panel = new Node('LevelUpPanel');
        panel.layer = Layers.Enum.UI_2D;
        panel.setParent(this._uiCanvasNode);
        panel.addComponent(UITransform).setContentSize(this._screenWidth, this._screenHeight);
        const bg = panel.addComponent(Graphics);
        bg.fillColor = new Color(0, 0, 0, 192);
        bg.fillRect(-this._screenWidth * 0.5, -this._screenHeight * 0.5, this._screenWidth, this._screenHeight);
        this._levelUpPanel = panel;

        const titleNode = this.createLabel(panel, 'LevelUpTitle', 0, this._screenHeight * 0.5 - 120, `升级！Lv.${this._level}`);
        const titleLabel = titleNode.getComponent(Label);
        if (titleLabel) {
            titleLabel.fontSize = 46;
            titleLabel.color = new Color(255, 227, 126, 255);
        }

        const hintNode = this.createLabel(panel, 'LevelUpHint', 0, this._screenHeight * 0.5 - 176, '选择 1 项强化');
        const hintLabel = hintNode.getComponent(Label);
        if (hintLabel) {
            hintLabel.fontSize = 26;
            hintLabel.color = new Color(220, 220, 220, 255);
        }

        const choices = this.pickUpgradeChoices(3);
        const cardHeight = 118;
        const startY = 78;

        choices.forEach((choice, index) => {
            const card = new Node(`UpgradeCard_${choice.id}`);
            card.layer = Layers.Enum.UI_2D;
            card.setParent(panel);
            card.setPosition(0, startY - index * (cardHeight + 20), 0);
            card.addComponent(UITransform).setContentSize(Math.min(620, this._screenWidth - 72), cardHeight);

            const cardG = card.addComponent(Graphics);
            cardG.fillColor = new Color(36, 48, 68, 255);
            const cardW = Math.min(620, this._screenWidth - 72);
            cardG.roundRect(-cardW * 0.5, -cardHeight * 0.5, cardW, cardHeight, 14);
            cardG.fill();
            cardG.strokeColor = new Color(130, 178, 255, 255);
            cardG.lineWidth = 2;
            cardG.roundRect(-cardW * 0.5, -cardHeight * 0.5, cardW, cardHeight, 14);
            cardG.stroke();

            const title = this.createLabel(card, `UpgradeTitle_${index}`, 0, 18, choice.title);
            const titleText = title.getComponent(Label);
            if (titleText) {
                titleText.fontSize = 30;
                titleText.color = new Color(255, 255, 255, 255);
            }

            const desc = this.createLabel(card, `UpgradeDesc_${index}`, 0, -22, choice.description);
            const descText = desc.getComponent(Label);
            if (descText) {
                descText.fontSize = 24;
                descText.color = new Color(176, 214, 255, 255);
            }

            card.on(Node.EventType.TOUCH_END, () => {
                this.applyUpgrade(choice.id);
            }, this);
        });
    }

    private applyUpgrade(upgradeId: string) {
        switch (upgradeId) {
            case 'atk_up':
                this._playerStats.attack = Math.round(this._playerStats.attack * 1.45);
                break;
            case 'fire_rate_up':
                this._playerStats.fireRate = Math.min(12, this._playerStats.fireRate + 1.4);
                break;
            case 'speed_up':
                this._playerStats.speed += 65;
                break;
            case 'crit_up':
                this._playerStats.critRate = Math.min(0.85, this._playerStats.critRate + 0.12);
                break;
            case 'crit_dmg_up':
                this._playerStats.critDamage += 0.8;
                break;
            case 'range_up':
                this._playerStats.range += 90;
                break;
            case 'heal_up': {
                const heal = this._playerStats.maxHp * 0.6;
                this._playerStats.currentHp = Math.min(this._playerStats.maxHp, this._playerStats.currentHp + heal);
                break;
            }
            case 'hp_up':
                this._playerStats.maxHp += 40;
                this._playerStats.currentHp = Math.min(this._playerStats.maxHp, this._playerStats.currentHp + 40);
                break;
            default:
                break;
        }

        this.refreshHpBar();
        this._levelUpPanel?.destroy();
        this._levelUpPanel = null;

        this._gameState = GameState.PLAYING;
        if (this._virtualJoystick) {
            this._virtualJoystick.setEnabled(true);
            this._virtualJoystick.node.active = true;
        }

        if (this._exp >= this._nextLevelExp) {
            this.showLevelUpPanel();
        }
        this.updateHUDStats();
    }

    private refreshHpBar() {
        const hpBar = this._hudNode?.getChildByName('HPBar');
        if (!hpBar) {
            return;
        }
        const ratio = this._playerStats.currentHp / Math.max(1, this._playerStats.maxHp);
        hpBar.setScale(Math.max(0, ratio), 1, 1);
    }

    public damagePlayer(damage: number) {
        this._playerStats.currentHp = Math.max(0, this._playerStats.currentHp - damage);
        this.refreshHpBar();

        if (this._playerStats.currentHp <= 0) {
            this.enterResult(GameState.DEFEAT, '失败');
        }
    }

    public get gameState(): GameState {
        return this._gameState;
    }

    public getPlayer(): Node | null {
        return this._player;
    }

    public getDogPartner(): Node | null {
        return this._dogPartner;
    }

    public getPlayerStats(): PlayerStats {
        return this._playerStats;
    }

    public getEnemies(): Node[] {
        this._enemies = this._enemies.filter((enemy) => enemy && enemy.isValid);
        return this._enemies;
    }

    public getVirtualJoystick(): VirtualJoystick | null {
        return this._virtualJoystick;
    }

    public getGameTime(): number {
        return this._gameTimer;
    }

    public getHalfWidth(): number {
        return this._screenWidth * 0.5;
    }

    public getHalfHeight(): number {
        return this._screenHeight * 0.5;
    }

    public getHUD(): Node | null {
        return this._hudNode;
    }

    public getComboManager(): ComboManager | null {
        return this.node.getComponent(ComboManager);
    }
}
