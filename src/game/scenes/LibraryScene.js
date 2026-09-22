// src/game/scenes/LibraryScene.js
import Phaser from "phaser";
import { loadWorld, saveWorld, hydrateBooks } from "../../data/storage.js";
import {
  isNodeFilled,
  countFilled,
  countFilledBooksDeep,
  totalSlots,
  getCurrentHall,
  getHallRootNodes,
  shouldBuildDesk,
  buildDesk,
  shouldBuildCart,
  buildCart,
  attachCart,
  detachCart,
  getCartSpriteKey,
  countCartBooks,
  putBookToCart,
  CELL,
  HALL_SIZE,
  HALL_CELLS,
} from "../../data/model.js";
import { openSidePanel } from "../../ui/sidePanel.js";
import { renderInventoryBar } from "../../ui/inventoryBar.js";
import { openDeskMenu } from "../../ui/deskMenu.js";
import { createMiniMap, renderObjects, updatePlayerPosition } from "../../ui/miniMap.js";
import {
  toggleCartPanel,
  closeCartPanel,
  isCartPanelOpen,
  rerenderCartPanel,
} from "../../ui/cartPanel.js";
import Cat from "../entities/Cat.js";

const INTERACT_DISTANCE = 160;
const DESK_SIZE = 128;
const CART_SIZE = 64;
const SECTION_SLOTS = 5;
const SECTION_SLOT_SIZE = 80;
const FAST_RADIUS = 500;

const CART_OFFSET_X = 0;
const CART_OFFSET_Y = 50;
const CART_SPRING_FORCE = 0.012;
const CART_DRAG = 0.12;
const CART_MAX_VELOCITY = 800;

const COLORS = {
  bg: 0x0e0e12,
  floor: 0x1a1a22,
  gridLine: 0x2a2a33,
  player: 0x7ec8ff,
  desk: 0x8b5a2b,
  depth: [0x8b5a2b, 0x6b4a1f, 0x5a3d1a, 0x4a3015, 0x3a2510],
  depthFilled: [0xc9a05a, 0xc9a05a, 0xc9a05a, 0xc9a05a, 0xc9a05a],
};

const SIZES = {
  depth: [
    { w: 120, h: 90 },
    { w: 160, h: 160 },
    { w: 200, h: 400 },
    { w: 1000, h: 400 },
    { w: 2000, h: 2000 },
  ],
};

const SPRITE_INFO = [
  { prefix: "shelf",    maxBooks: 5 },
  { prefix: "wardrobe", maxBooks: 25 },
  null,
  null,
  null,
];

export default class LibraryScene extends Phaser.Scene {
  constructor() {
    super("LibraryScene");
  }

  preload() {
    this.load.image("player", "assets/player.png");
    this.load.image("desk", "assets/desk.png");
    this.load.image("cart_0", "assets/cart_0.png");
    this.load.image("cart_1", "assets/cart_1.png");
    this.load.image("cart_2", "assets/cart_2.png");

    this.load.image("cat_lie", "assets/cat_lie.png");
    this.load.image("cat_sit", "assets/cat_sit.png");
    this.load.image("cat_walk", "assets/cat_walk.png");

    for (let i = 0; i <= 5; i++) {
      this.load.image(`shelf_${i}`, `assets/shelf_${i}.png`);
    }
    for (let i = 0; i <= 25; i++) {
      this.load.image(`wardrobe_${i}`, `assets/wardrobe_${i}.png`);
    }

    // звуки
    this.load.audio("bg-music", "assets/Fon.mp3");
    this.load.audio("step", "assets/step.wav");
  }

  create() {
    this.world = loadWorld();
    hydrateBooks(this.world);

    this.hall = getCurrentHall(this.world);

    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.physics.world.setBounds(0, 0, HALL_SIZE, HALL_SIZE);

    const floor = this.add.rectangle(0, 0, HALL_SIZE, HALL_SIZE, COLORS.floor).setOrigin(0);
    this.physics.add.existing(floor, true);

    this.gridGraphics = this.add.graphics();
    this.drawGrid();
    this.gridGraphics.setVisible(false);

    const center = HALL_SIZE / 2;
    this.player = this.physics.add.sprite(center, center, "player");
    this.player.setCollideWorldBounds(true);
    this.player.setScale(3);
    this.player.body.setSize(16, 16);
    this.player.body.pushable = false;

    this.cameras.main.startFollow(this.player);
    this.cameras.main.setZoom(1);
    this.cameras.main.setRoundPixels(true);

    this.keys = this.input.keyboard.addKeys("W,A,S,D,E,T");

    this.promptText = this.add.text(0, 0, "[E] открыть", {
      fontSize: "16px", color: "#ffffff",
      backgroundColor: "#000000aa", padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setVisible(false);

    this.nodeSprites = {};
    this.deskSprite = null;
    this.cartSprite = null;
    this.attachedCartSprite = null;
    this.nearNodeId = null;
    this.currentPanel = null;
    this.currentNodeId = null;
    this.inventoryBar = null;
    this.cat = null;

    this._lastPromptText = null;

    // звуки
    this.bgMusic = this.sound.add("bg-music", { loop: true, volume: 0.2 });
    this.bgMusic.play();

    this.stepSound = this.sound.add("step", { volume: 0.4 });
    this.stepTimer = 0;

    this.input.once("pointerdown", () => {
      if (this.sound.context && this.sound.context.state === "suspended") {
        this.sound.context.resume();
      }
      if (!this.bgMusic.isPlaying) {
        this.bgMusic.play();
      }
    });

    this.ensureStartingShelf();
    this.checkDeskSpawn();
    this.checkCartSpawn();
    this.checkCatSpawn();

    this.renderAllNodes();
    this.renderDesk();
    this.renderCart();
    this.renderInventory();
    createMiniMap(this.world, this.world.currentHallId);

    this.events.on("world-changed", () => {
      this.checkDeskSpawn();
      this.checkCartSpawn();
      this.checkCatSpawn();
      saveWorld(this.world);
      this.renderAllNodes();
      this.renderDesk();
      this.renderCart();
      this.renderInventory();
      renderObjects(this.world, this.world.currentHallId);
    });

    this.scale.on("resize", this.onResize, this);

    this.input.on("pointerdown", () => {
      if (this.input.keyboard.enabled) this.game.canvas.focus();
    });
  }

  ensureStartingShelf() {
    const hall = getCurrentHall(this.world);
    if (!hall) return;
    const roots = getHallRootNodes(this.world, hall.id);
    if (roots.length > 0) return;

    const id = `node_${Date.now().toString(36)}_start`;
    const node = {
      id, depth: 0, type: "world", category: "", parentId: null,
      hallId: hall.id, gx: 4, gy: 4, unlocked: true,
      bookIds: [null, null, null, null, null], childIds: [], createdAt: Date.now(),
    };
    this.world.nodes[id] = node;
    hall.rootIds.push(id);
    saveWorld(this.world);
  }

  checkDeskSpawn() {
    const hall = getCurrentHall(this.world);
    if (!hall) return;
    if (shouldBuildDesk(this.world, hall.id)) {
      buildDesk(this.world, hall.id);
      saveWorld(this.world);
    }
  }

  checkCartSpawn() {
    const hall = getCurrentHall(this.world);
    if (!hall) return;
    if (shouldBuildCart(this.world, hall.id)) {
      buildCart(this.world, hall.id);
      saveWorld(this.world);
    }
  }

  checkCatSpawn() {
    const hall = getCurrentHall(this.world);
    if (!hall) return;

    if (hall.desk && !this.cat) {
      const cx = (hall.desk.gx + 2) * CELL + CELL / 2;
      const cy = hall.desk.gy * CELL + CELL / 2;
      this.cat = new Cat(this, cx, cy);
    }
  }

  drawGrid() {
    const g = this.gridGraphics;
    g.clear();
    g.lineStyle(1, COLORS.gridLine, 0.5);
    for (let i = 0; i <= HALL_CELLS; i++) {
      const x = i * CELL;
      g.lineBetween(x, 0, x, HALL_SIZE);
      g.lineBetween(0, x, HALL_SIZE, x);
    }
  }

  onResize() {
    this.cameras.main.setSize(this.scale.width, this.scale.height);
  }

  renderAllNodes() {
    for (const id of Object.keys(this.nodeSprites)) {
      const s = this.nodeSprites[id];
      if (s.visuals) s.visuals.forEach((v) => v.destroy());
      else s.visual.destroy();
      s.label.destroy();
      delete this.nodeSprites[id];
    }

    const hall = getCurrentHall(this.world);
    if (!hall) return;

    const roots = getHallRootNodes(this.world, hall.id);
    for (const node of roots) this.renderNode(node);
  }

  renderNode(node) {
    const size = SIZES.depth[node.depth] || SIZES.depth[0];
    const total = totalSlots(node);
    const isFilled = isNodeFilled(this.world, node);

    const px = (node.gx + size.w / 2 / CELL) * CELL;
    const py = (node.gy + size.h / 2 / CELL) * CELL;

    if (node.depth === 2) {
      const visuals = [];
      const slotH = SECTION_SLOT_SIZE;
      const totalH = slotH * SECTION_SLOTS;
      const startY = py - totalH / 2 + slotH / 2;

      for (let i = 0; i < SECTION_SLOTS; i++) {
        const childId = node.childIds[i];
        const child = childId ? this.world.nodes[childId] : null;
        const deepCount = child ? countFilledBooksDeep(this.world, child) : 0;
        const idx = Math.min(deepCount, 25);
        const textureKey = `wardrobe_${idx}`;
        const sprite = this.add.sprite(px, startY + i * slotH, textureKey);
        sprite.setDisplaySize(SECTION_SLOT_SIZE, SECTION_SLOT_SIZE);
        visuals.push(sprite);
      }

      const name = node.category || "(без названия)";
      const label = this.add.text(
        px, py - size.h / 2 - 24,
        `${name} ${countFilled(this.world, node)}/${total}`,
        {
          fontSize: "20px",
          color: isFilled ? "#ffd966" : "#e8d8a8",
          stroke: "#000000", strokeThickness: 4,
        }
      ).setOrigin(0.5);

      this.nodeSprites[node.id] = { visuals, label, node };
      return;
    }

    if (node.depth === 3) {
      const visuals = [];
      const shkafSize = SECTION_SLOT_SIZE;
      const blockW = size.w;
      const blockH = size.h;
      const sectionW = blockW / 5;
      const startX = px - blockW / 2 + sectionW / 2;

      for (let o = 0; o < 5; o++) {
        const sectionX = startX + o * sectionW;
        const sectionId = node.childIds[o];
        const section = sectionId ? this.world.nodes[sectionId] : null;

        for (let sh = 0; sh < 5; sh++) {
          const shkafId = section ? section.childIds[sh] : null;
          const shkaf = shkafId ? this.world.nodes[shkafId] : null;
          const deepCount = shkaf ? countFilledBooksDeep(this.world, shkaf) : 0;
          const idx = Math.min(deepCount, 25);
          const textureKey = `wardrobe_${idx}`;

          const y = py - blockH / 2 + shkafSize / 2 + sh * shkafSize;
          const sprite = this.add.sprite(sectionX, y, textureKey);
          sprite.setDisplaySize(shkafSize, shkafSize);
          visuals.push(sprite);
        }
      }

      const name = node.category || "(без названия)";
      const label = this.add.text(
        px, py - size.h / 2 - 24,
        `${name} ${countFilled(this.world, node)}/${total}`,
        {
          fontSize: "22px",
          color: isFilled ? "#ffd966" : "#e8d8a8",
          stroke: "#000000", strokeThickness: 4,
        }
      ).setOrigin(0.5);

      this.nodeSprites[node.id] = { visuals, label, node };
      return;
    }

    const spriteInfo = SPRITE_INFO[node.depth];
    let visual;
    if (spriteInfo) {
      const deepCount = countFilledBooksDeep(this.world, node);
      const idx = Math.min(deepCount, spriteInfo.maxBooks);
      const textureKey = `${spriteInfo.prefix}_${idx}`;
      visual = this.add.sprite(px, py, textureKey);
      visual.setDisplaySize(size.w, size.h);
    } else {
      const color = isFilled ? COLORS.depthFilled[node.depth] : COLORS.depth[node.depth];
      visual = this.add.rectangle(px, py, size.w, size.h, color);
      visual.setStrokeStyle(2, 0x000000, 0.4);
    }

    const name = node.category || "(без названия)";
    const label = this.add.text(
      px, py - size.h / 2 - 24,
      `${name} ${countFilled(this.world, node)}/${total}`,
      {
        fontSize: "20px",
        color: isFilled ? "#ffd966" : "#e8d8a8",
        stroke: "#000000", strokeThickness: 4,
      }
    ).setOrigin(0.5);

    this.nodeSprites[node.id] = { visual, label, node };
  }

  renderDesk() {
    if (this.deskSprite) {
      this.deskSprite.visual.destroy();
      this.deskSprite.label.destroy();
      this.deskSprite.walls.forEach((w) => {
        if (w.collider) this.physics.world.removeCollider(w.collider);
        w.destroy();
      });
      this.deskSprite = null;
    }

    const hall = getCurrentHall(this.world);
    if (!hall || !hall.desk) return;

    const px = hall.desk.gx * CELL + CELL / 2;
    const py = hall.desk.gy * CELL + CELL / 2;

    const visual = this.add.sprite(px, py, "desk");
    visual.setDisplaySize(DESK_SIZE, DESK_SIZE);

    const half = DESK_SIZE / 2;
    const legWidth = DESK_SIZE * 0.19;
    const legHeight = DESK_SIZE * 0.56;
    const backHeight = DESK_SIZE * 0.25;

    const walls = [];

    const back = this.add.rectangle(px, py + half - backHeight / 2, DESK_SIZE, backHeight, 0xff0000, 0);
    this.physics.add.existing(back, true);
    back.collider = this.physics.add.collider(this.player, back);
    walls.push(back);

    const left = this.add.rectangle(
      px - half + legWidth / 2,
      py + half - backHeight - legHeight / 2,
      legWidth, legHeight, 0xff0000, 0
    );
    this.physics.add.existing(left, true);
    left.collider = this.physics.add.collider(this.player, left);
    walls.push(left);

    const right = this.add.rectangle(
      px + half - legWidth / 2,
      py + half - backHeight - legHeight / 2,
      legWidth, legHeight, 0xff0000, 0
    );
    this.physics.add.existing(right, true);
    right.collider = this.physics.add.collider(this.player, right);
    walls.push(right);

    const label = this.add.text(
      px, py - half - 18, "Стол библиотекаря",
      { fontSize: "18px", color: "#ffd966", stroke: "#000000", strokeThickness: 4 }
    ).setOrigin(0.5);

    this.deskSprite = { visual, label, rect: visual, walls };
  }

  renderCart() {
    if (this.cartSprite) {
      if (this.cartSprite.collider) {
        this.physics.world.removeCollider(this.cartSprite.collider);
      }
      this.cartSprite.visual.destroy();
      this.cartSprite = null;
    }
    if (this.attachedCartSprite) {
      this.attachedCartSprite.visual.destroy();
      this.attachedCartSprite = null;
    }

    const hall = getCurrentHall(this.world);
    if (!hall || !hall.cart) return;

    const textureKey = getCartSpriteKey(this.world);

    if (hall.cart.attached) {
      const visual = this.physics.add.sprite(
        this.player.x + CART_OFFSET_X,
        this.player.y + CART_OFFSET_Y,
        textureKey
      );
      visual.setDisplaySize(CART_SIZE, CART_SIZE);
      visual.body.setAllowGravity(false);
      visual.body.setDamping(true);
      visual.body.setDrag(CART_DRAG, CART_DRAG);
      visual.body.setMaxVelocity(CART_MAX_VELOCITY, CART_MAX_VELOCITY);
      visual.body.pushable = false;

      this.attachedCartSprite = {
        visual,
        _lastKey: textureKey,
        _frame: 0,
      };
    } else {
      const px = hall.cart.x;
      const py = hall.cart.y;

      const visual = this.add.sprite(px, py, textureKey);
      visual.setDisplaySize(CART_SIZE, CART_SIZE);

      this.physics.add.existing(visual, true);
      const bodyW = 48;
      const bodyH = 48;
      visual.body.setSize(bodyW, bodyH);
      visual.body.setOffset((CART_SIZE - bodyW) / 2, (CART_SIZE - bodyH) / 2);
      const collider = this.physics.add.collider(this.player, visual);

      this.cartSprite = { visual, rect: visual, collider };
    }
  }

  renderInventory() {
    if (this.inventoryBar) this.inventoryBar.destroy();
    this.inventoryBar = renderInventoryBar(this.world, {
      onPlaceFromInventory: (invIdx) => {
        if (!this.currentPanel || !this.currentNodeId) {
          alert("Сначала открой полку (E рядом с полкой).");
          return;
        }
        const node = this.world.nodes[this.currentNodeId];
        if (!node || node.depth !== 0) {
          alert("Открой полку, чтобы положить книгу.");
          return;
        }
        const slotIndex = node.bookIds.indexOf(null);
        if (slotIndex === -1) {
          alert("На этой полке нет свободных слотов.");
          return;
        }
        const bookId = this.world.inventory[invIdx];
        if (!bookId) return;

        node.bookIds[slotIndex] = bookId;
        this.world.inventory[invIdx] = null;

        saveWorld(this.world);
        this.renderInventory();
        this.renderAllNodes();

        if (this.currentPanel && this.currentPanel.rerender) {
          this.currentPanel.rerender();
        }
      },
      onPutToCart: (invIdx) => {
        const hall = getCurrentHall(this.world);
        if (!hall || !hall.cart || !hall.cart.attached) {
          alert("Телега не прицеплена.");
          return;
        }
        if (putBookToCart(this.world, invIdx)) {
          saveWorld(this.world);
          this.renderInventory();
          this.renderCart();
          rerenderCartPanel();
        }
      },
    });
  }

  update() {
    if (!this.input.keyboard.enabled) return;

    const speed = 200;
    const body = this.player.body;

    let vx = 0, vy = 0;
    if (this.keys.A.isDown) vx = -speed;
    if (this.keys.D.isDown) vx = speed;
    if (this.keys.W.isDown) vy = -speed;
    if (this.keys.S.isDown) vy = speed;

    body.setVelocity(vx, vy);
    this.player.x = Math.round(this.player.x);
    this.player.y = Math.round(this.player.y);

    if (vx < 0) this.player.setFlipX(true);
    if (vx > 0) this.player.setFlipX(false);

    // звук шагов
    const isMoving = vx !== 0 || vy !== 0;
    if (isMoving && this.input.keyboard.enabled) {
      this.stepTimer -= this.game.loop.delta;
      if (this.stepTimer <= 0) {
        if (this.stepSound) {
          this.stepSound.stop();
          this.stepSound.play();
        }
        this.stepTimer = 350;
      }
    } else {
      this.stepTimer = 0;
      if (this.stepSound && this.stepSound.isPlaying) {
        this.stepSound.stop();
      }
    }

    // телега
    if (this.attachedCartSprite) {
      const v = this.attachedCartSprite.visual;
      const cartBody = v.body;

      if (cartBody) {
        const targetX = this.player.x + CART_OFFSET_X;
        const targetY = this.player.y + CART_OFFSET_Y;
        const dx = targetX - v.x;
        const dy = targetY - v.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > 100) {
          const dist = Math.sqrt(distSq);
          const forceMult = Math.min(1 + dist / 200, 3);
          cartBody.velocity.x += dx * CART_SPRING_FORCE * forceMult;
          cartBody.velocity.y += dy * CART_SPRING_FORCE * forceMult;
        } else {
          cartBody.velocity.x *= 0.7;
          cartBody.velocity.y *= 0.7;
        }
      }

      this.attachedCartSprite._frame++;
      if (this.attachedCartSprite._frame % 5 === 0) {
        const textureKey = getCartSpriteKey(this.world);
        if (this.attachedCartSprite._lastKey !== textureKey) {
          this.attachedCartSprite._lastKey = textureKey;
          v.setTexture(textureKey);
          v.setDisplaySize(CART_SIZE, CART_SIZE);
        }
      }
    }

    // кошка
    if (this.cat) {
      this.cat.update(this.game.loop.delta, this.player);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.T)) {
      const hall = getCurrentHall(this.world);
      if (hall && hall.cart && hall.cart.attached) {
        toggleCartPanel(this.world, {
          onChange: () => {
            saveWorld(this.world);
            this.renderCart();
            this.renderInventory();
          },
        });
      }
    }

    // поиск ближайшего
    let closest = null;
    let closestDistSq = Infinity;
    const FAST_RADIUS_SQ = FAST_RADIUS * FAST_RADIUS;

    for (const id of Object.keys(this.nodeSprites)) {
      const s = this.nodeSprites[id];

      let centerX, centerY;
      if (s.visuals) {
        centerX = s.visuals[0].x;
        const first = s.visuals[0].y;
        const last = s.visuals[Math.max(0, s.visuals.length - 2)].y;
        centerY = (first + last) / 2;
      } else if (s.visual) {
        centerX = s.visual.x;
        centerY = s.visual.y;
      } else {
        continue;
      }

      const dx = this.player.x - centerX;
      const dy = this.player.y - centerY;
      if (dx * dx + dy * dy > FAST_RADIUS_SQ) continue;

      let minDistSq = Infinity;
      if (s.visuals) {
        for (const v of s.visuals) {
          const vdx = this.player.x - v.x;
          const vdy = this.player.y - v.y;
          const vd = vdx * vdx + vdy * vdy;
          if (vd < minDistSq) minDistSq = vd;
        }
      } else if (s.visual) {
        minDistSq = dx * dx + dy * dy;
      }

      if (minDistSq < closestDistSq) {
        closestDistSq = minDistSq;
        closest = id;
      }
    }

    const closestDist = Math.sqrt(closestDistSq);

    let deskDist = Infinity;
    if (this.deskSprite) {
      deskDist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        this.deskSprite.visual.x, this.deskSprite.visual.y
      );
    }

    const hall = getCurrentHall(this.world);
    let cartDist = Infinity;
    if (hall && hall.cart) {
      if (hall.cart.attached && this.attachedCartSprite) {
        cartDist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          this.attachedCartSprite.visual.x,
          this.attachedCartSprite.visual.y
        );
      } else if (this.cartSprite) {
        cartDist = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          this.cartSprite.visual.x, this.cartSprite.visual.y
        );
      }
    }

    const nearNode = closest && closestDist < INTERACT_DISTANCE;
    const nearDesk = this.deskSprite && deskDist < INTERACT_DISTANCE;

    let nearCart = false;
    if (hall && hall.cart) {
      if (hall.cart.attached) {
        nearCart = !nearDesk && !nearNode;
      } else {
        nearCart = cartDist < INTERACT_DISTANCE &&
                   !(nearDesk && deskDist < cartDist) &&
                   !(nearNode && closestDist < cartDist);
      }
    }

    let promptText = null;

    if (nearDesk) {
      this.promptText.setVisible(true);
      this.promptText.setPosition(
        this.deskSprite.visual.x,
        this.deskSprite.visual.y - DESK_SIZE / 2 - 40
      );
      promptText = "[E] Стол";

      if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.openDesk();
    } else if (nearNode) {
      const s = this.nodeSprites[closest];
      this.promptText.setVisible(true);
      let topY, centerX;
      if (s.visuals) {
        topY = s.visuals[0].y - SECTION_SLOT_SIZE / 2;
        centerX = s.visuals[0].x;
      } else {
        topY = s.visual.y - s.visual.displayHeight / 2;
        centerX = s.visual.x;
      }
      this.promptText.setPosition(centerX, topY - 40);
      promptText = "[E] открыть";

      if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.openNode(closest);
    } else if (nearCart) {
      let visual;
      if (hall.cart.attached) {
        visual = this.attachedCartSprite.visual;
      } else if (this.cartSprite) {
        visual = this.cartSprite.visual;
      }

      if (visual) {
        this.promptText.setVisible(true);
        this.promptText.setPosition(visual.x, visual.y - CART_SIZE / 2 - 40);
        promptText = hall.cart.attached ? "[E] Отцепить телегу" : "[E] Прицепить телегу";

        if (Phaser.Input.Keyboard.JustDown(this.keys.E)) this.toggleCartAttach();
      }
    } else {
      this.promptText.setVisible(false);
      promptText = null;
    }

    if (this._lastPromptText !== promptText) {
      this._lastPromptText = promptText;
      if (promptText !== null) {
        this.promptText.setText(promptText);
      }
    }

    updatePlayerPosition(this.player.x, this.player.y);
  }

  toggleCartAttach() {
    const hallId = this.world.currentHallId;
    const hall = getCurrentHall(this.world);
    if (!hall || !hall.cart) return;

    if (hall.cart.attached) {
      const cartVisual = this.attachedCartSprite && this.attachedCartSprite.visual;
      if (cartVisual) {
        detachCart(this.world, hallId, cartVisual.x, cartVisual.y);
      } else {
        detachCart(this.world, hallId, this.player.x, this.player.y + 50);
      }
      if (isCartPanelOpen()) closeCartPanel();
    } else {
      attachCart(this.world, hallId);
    }
    saveWorld(this.world);
    this.renderCart();
    this.renderInventory();

    this._lastPromptText = null;
  }

  openDesk() {
    this.input.keyboard.enabled = false;
    this.input.keyboard.resetKeys();
    this.game.canvas.blur();

    const hallId = this.world.currentHallId;

    openDeskMenu(this.world, hallId, {
      getPlayerPos: () => ({ x: this.player.x, y: this.player.y }),
      onClose: () => {
        this.input.keyboard.enabled = true;
        this.player.body.setVelocity(0, 0);
        this.events.emit("world-changed");
      },
      onChange: () => {
        saveWorld(this.world);
        this.renderAllNodes();
        this.checkDeskSpawn();
        this.checkCartSpawn();
        this.checkCatSpawn();
        this.renderDesk();
        this.renderCart();
      },
    });
  }

  openNode(nodeId) {
    const node = this.world.nodes[nodeId];
    if (!node) return;

    if (this.currentPanel) {
      this.currentPanel.closePanel();
      this.currentPanel = null;
    }

    this.input.keyboard.enabled = false;
    this.input.keyboard.resetKeys();
    this.game.canvas.blur();

    this.currentNodeId = nodeId;

    const panelApi = openSidePanel(this.world, node, {
      onClose: () => {
        this.input.keyboard.enabled = true;
        this.player.body.setVelocity(0, 0);
        this.currentPanel = null;
        this.currentNodeId = null;
        this.events.emit("world-changed");
      },
      onOpenChild: (childId) => this.openNode(childId),
      onChange: () => {
        saveWorld(this.world);
        this.renderInventory();
        this.renderAllNodes();
        this.checkDeskSpawn();
        this.checkCartSpawn();
        this.renderDesk();
        this.renderCart();
        rerenderCartPanel();
      },
    });

    this.currentPanel = panelApi;
  }
}