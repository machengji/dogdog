import {
    _decorator,
    Component,
    Node,
    Label,
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
    RenderRoot2D
} from 'cc';
import { PLAYER_CONFIG, ENEMY_CONFIG } from './Constants';
import { GameState, PlayerStats } from './types/GameTypes';
import { PlayerController } from './PlayerController';
import { EnemyController } from './EnemyController';
import { DogController } from './DogController';
import { BulletController } from './BulletController';
import { VirtualJoystick } from './VirtualJoystick';
import { ComboManager } from './ComboManager';

const { ccclass } = _decorator;

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
    private _screenWidth = 0;
    private _screenHeight = 0;

    private _cameraNode: Node | null = null;
    private _camera: Camera | null = null;
    private _uiCanvasNode: Node | null = null;
    private _hudNode: Node | null = null;
    private _worldRoot: Node | null = null;
    private _virtualJoystick: VirtualJoystick | null = null;

    private readonly _cameraZ = 600;
    private readonly _maxEnemies = 40;

    onLoad() {
        GameManager._instance = this;
        this.initScreen();
    }

    private initScreen() {
        const size = view.getVisibleSize();
        this._screenWidth = size.width;
        this._screenHeight = size.height;
        view.setDesignResolutionSize(this._screenWidth, this._screenHeight, ResolutionPolicy.SHOW_ALL);
    }

    start() {
        this.scheduleOnce(() => {
            this.createGameScene();
            this.startGame();
        }, 0);
    }

    private createGameScene() {
        const scene = director.getScene();
        if (!scene) {
            return;
        }

        // If GameManager is nested under Canvas in editor, move it to scene root first.
        // Otherwise destroying legacy Canvas would also destroy this component.
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
        this._camera.orthoHeight = this._screenHeight * 0.5;
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
        g.fillColor = new Color(34, 36, 44, 255);
        g.fillRect(-size * 0.5, -size * 0.5, size, size);

        g.strokeColor = new Color(78, 82, 98, 255);
        g.lineWidth = 1.5;
        for (let i = -size * 0.5; i <= size * 0.5; i += 100) {
            g.moveTo(i, -size * 0.5);
            g.lineTo(i, size * 0.5);
            g.moveTo(-size * 0.5, i);
            g.lineTo(size * 0.5, i);
        }
        g.stroke();
    }

    private createPlayer() {
        if (!this._worldRoot) {
            return;
        }

        this._player = new Node('Player');
        this._player.layer = Layers.Enum.DEFAULT;
        this._player.setParent(this._worldRoot);
        this._player.addComponent(UITransform).setContentSize(52, 52);
        const g = this._player.addComponent(Graphics);
        g.fillColor = new Color(0, 220, 255, 255);
        g.fillRect(-26, -26, 52, 52);

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
    }

    private createDogPartner() {
        if (!this._worldRoot) {
            return;
        }

        this._dogPartner = new Node('DogPartner');
        this._dogPartner.layer = Layers.Enum.DEFAULT;
        this._dogPartner.setParent(this._worldRoot);
        this._dogPartner.addComponent(UITransform).setContentSize(40, 40);
        const g = this._dogPartner.addComponent(Graphics);
        g.fillColor = new Color(255, 165, 0, 255);
        g.fillRect(-20, -20, 40, 40);
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
        this.createLabel(this._hudNode, 'GoldLabel', halfW - 100, halfH - 40, 'Gold: 0');
        this.createLabel(this._hudNode, 'ScoreLabel', 0, halfH - 40, 'Score: 0');
        this.createLabel(this._hudNode, 'DogMoodLabel', -halfW + 320, halfH - 40, 'DOG');
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
        label.fontSize = 26;
        return node;
    }

    private createVirtualJoystick() {
        if (!this._uiCanvasNode) {
            return;
        }

        const joystick = new Node('VirtualJoystick');
        joystick.layer = Layers.Enum.UI_2D;
        joystick.setParent(this._uiCanvasNode);
        joystick.setPosition(-this._screenWidth * 0.5 + 150, -this._screenHeight * 0.5 + 150, 0);
        joystick.addComponent(UITransform).setContentSize(300, 300);
        this._virtualJoystick = joystick.addComponent(VirtualJoystick);
    }

    update(dt: number) {
        if (this._gameState !== GameState.PLAYING) {
            return;
        }

        if (this._player && this._cameraNode) {
            const playerPos = this._player.getPosition();
            this._cameraNode.setPosition(playerPos.x, playerPos.y, this._cameraZ);
        }

        this.updateGame(dt);
    }

    private updateGame(dt: number) {
        this._gameTimer += dt;
        this._spawnTimer += dt;

        if (this._spawnTimer >= 1.0 && this._enemies.length < this._maxEnemies) {
            this._spawnTimer = 0;
            this.spawnEnemy();
        }

        const goldLabel = this._hudNode?.getChildByName('GoldLabel')?.getComponent(Label);
        if (goldLabel) {
            goldLabel.string = `Gold: ${this._gold}`;
        }

        const scoreLabel = this._hudNode?.getChildByName('ScoreLabel')?.getComponent(Label);
        if (scoreLabel) {
            scoreLabel.string = `Score: ${this._score}`;
        }
    }

    public spawnEnemy() {
        if (!this._worldRoot) {
            return;
        }

        const config = ENEMY_CONFIG.lazyDog;
        const enemy = new Node('Enemy');
        enemy.layer = Layers.Enum.DEFAULT;
        enemy.setParent(this._worldRoot);

        const playerPos = this._player?.getPosition() || new Vec3();
        const angle = Math.random() * Math.PI * 2;
        const spawnRadius = Math.max(220, Math.min(this.getHalfHeight() * 0.75, 420));
        enemy.setPosition(
            playerPos.x + Math.cos(angle) * spawnRadius,
            playerPos.y + Math.sin(angle) * spawnRadius,
            0
        );

        enemy.addComponent(UITransform).setContentSize(config.size, config.size);
        const g = enemy.addComponent(Graphics);
        g.fillColor = Color.RED;
        g.fillRect(-config.size * 0.5, -config.size * 0.5, config.size, config.size);
        enemy.addComponent(EnemyController).init(config);

        this._enemies.push(enemy);
    }

    public createBullet(start: Vec3, direction: Vec3, damage: number, isCrit: boolean): Node {
        const parent = this._worldRoot ?? this.node;
        const bullet = new Node('Bullet');
        bullet.layer = Layers.Enum.DEFAULT;
        bullet.setParent(parent);
        bullet.setPosition(start);
        bullet.addComponent(UITransform).setContentSize(10, 10);
        const g = bullet.addComponent(Graphics);
        g.fillColor = isCrit ? Color.YELLOW : Color.WHITE;
        g.fillRect(-5, -5, 10, 10);
        bullet.addComponent(BulletController).init(direction, damage, isCrit);
        this._bullets.push(bullet);
        return bullet;
    }

    public startGame() {
        this._gameState = GameState.PLAYING;
    }

    public killEnemy(enemy: Node, gold: number) {
        this._enemies = this._enemies.filter((e) => e !== enemy && e.isValid);
        if (enemy.isValid) {
            enemy.destroy();
        }

        this._gold += gold;
        this._score += gold * 10;

        const comboManager = this.getComboManager();
        comboManager?.addKill();

        const dogCtrl = this._dogPartner?.getComponent(DogController);
        dogCtrl?.resetNoKillTimer();
    }

    public damagePlayer(damage: number) {
        this._playerStats.currentHp = Math.max(0, this._playerStats.currentHp - damage);

        const hpBar = this._hudNode?.getChildByName('HPBar');
        if (hpBar) {
            const ratio = this._playerStats.currentHp / Math.max(1, this._playerStats.maxHp);
            hpBar.setScale(ratio, 1, 1);
        }

        if (this._playerStats.currentHp <= 0) {
            const scene = director.getScene();
            if (scene) {
                director.loadScene(scene.name);
            }
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
