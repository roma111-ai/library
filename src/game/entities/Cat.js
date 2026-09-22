// src/game/entities/Cat.js
import Phaser from "phaser";
import { getRandomCatFact } from "../../data/catFacts.js";
import { CELL, HALL_SIZE } from "../../data/model.js";

const CAT_SIZE = 64;
const CAT_SPEED = 60;              // пиксели в секунду
const ARRIVE_DISTANCE = 20;        // считается «дошла» если ближе
const FACT_INTERVAL_MIN = 3 * 60 * 1000;   // 3 минуты
const FACT_INTERVAL_MAX = 5 * 60 * 1000;   // 5 минут
const FACT_SHOW_DURATION = 8000;   // 8 сек показывается факт
const FACT_VISIBLE_DISTANCE = 250; // видно только если игрок ближе

export default class Cat extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "cat_sit");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDisplaySize(CAT_SIZE, CAT_SIZE);
    this.body.setAllowGravity(false);
    this.body.setCollideWorldBounds(true);
    this.body.pushable = false;
    this.setDepth(5);

    // состояния: 'walking', 'sitting', 'lying', 'going_to_player', 'talking'
    this.state = "sitting";
    this.stateTimer = Phaser.Math.Between(2000, 5000);
    this.targetX = x;
    this.targetY = y;

    // факты
    this.nextFactTime = Phaser.Math.Between(FACT_INTERVAL_MIN, FACT_INTERVAL_MAX);
    this.factTimer = 0;
    this.usedFacts = [];
    this.currentFact = null;
    this.factVisibleUntil = 0;

    // текст над кошкой
    this.factText = scene.add.text(x, y - 40, "", {
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "#000000dd",
      padding: { x: 8, y: 6 },
      wordWrap: { width: 280 },
      align: "center",
    }).setOrigin(0.5).setVisible(false);
    this.factText.setDepth(10);

    this.pickNewState();
  }

  pickNewState() {
    const r = Math.random();
    if (r < 0.5) {
      // идёт гулять
      this.state = "walking";
      this.stateTimer = Phaser.Math.Between(3000, 8000);
      this.pickRandomTarget();
    } else if (r < 0.8) {
      this.state = "sitting";
      this.stateTimer = Phaser.Math.Between(3000, 8000);
      this.setTexture("cat_sit");
    } else {
      this.state = "lying";
      this.stateTimer = Phaser.Math.Between(5000, 12000);
      this.setTexture("cat_lie");
    }
  }

  pickRandomTarget() {
    const margin = 100;
    this.targetX = Phaser.Math.Between(margin, HALL_SIZE - margin);
    this.targetY = Phaser.Math.Between(margin, HALL_SIZE - margin);
  }

  update(delta, player) {
    // таймер следующего факта
    this.factTimer += delta;
    if (this.factTimer >= this.nextFactTime && this.state !== "talking") {
      this.factTimer = 0;
      this.nextFactTime = Phaser.Math.Between(FACT_INTERVAL_MIN, FACT_INTERVAL_MAX);
      this.startGoingToPlayer(player);
    }

    // обновляем текст — видно только если игрок близко
    if (this.currentFact && this.factText.visible) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      if (dist > FACT_VISIBLE_DISTANCE) {
        this.factText.setVisible(false);
      } else {
        this.factText.setVisible(true);
      }

      // обновляем позицию текста над кошкой
      this.factText.setPosition(this.x, this.y - 50);

      // таймер показа факта
      if (this.scene.time.now > this.factVisibleUntil) {
        this.factText.setVisible(false);
        this.currentFact = null;
        // после разговора — снова гуляет
        this.pickNewState();
      }
    }

    // логика состояний
    switch (this.state) {
      case "walking": {
        this.setTexture("cat_walk");
        this.moveToTarget(delta);
        this.stateTimer -= delta;
        if (this.stateTimer <= 0 || this.arrivedAtTarget()) {
          this.pickNewState();
        }
        break;
      }
      case "sitting":
      case "lying": {
        this.setVelocity(0, 0);
        this.stateTimer -= delta;
        if (this.stateTimer <= 0) this.pickNewState();
        break;
      }
      case "going_to_player": {
        this.setTexture("cat_walk");
        this.targetX = player.x + 40;
        this.targetY = player.y + 10;

        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ARRIVE_DISTANCE) {
          // пришла к игроку — сидит и говорит
          this.state = "talking";
          this.setVelocity(0, 0);
          this.setTexture("cat_sit");
          this.showFact();
        } else {
          const vx = (dx / dist) * CAT_SPEED;
          const vy = (dy / dist) * CAT_SPEED;
          this.setVelocity(vx, vy);
        }
        break;
      }
      case "talking": {
        this.setVelocity(0, 0);
        // ждём — таймер факта сам выключит
        break;
      }
    }
  }

  moveToTarget(delta) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < ARRIVE_DISTANCE) {
      this.setVelocity(0, 0);
      return;
    }

    const vx = (dx / dist) * CAT_SPEED;
    const vy = (dy / dist) * CAT_SPEED;
    this.setVelocity(vx, vy);

    // флип по горизонтали
    if (vx < 0) this.setFlipX(true);
    else if (vx > 0) this.setFlipX(false);
  }

  arrivedAtTarget() {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    return Math.sqrt(dx * dx + dy * dy) < ARRIVE_DISTANCE;
  }

  startGoingToPlayer(player) {
    this.state = "going_to_player";
    this.targetX = player.x;
    this.targetY = player.y;
  }

  showFact() {
    const fact = getRandomCatFact(this.usedFacts);
    if (!fact) {
      // все факты использованы — сбрасываем
      this.usedFacts = [];
      const retry = getRandomCatFact(this.usedFacts);
      if (!retry) return;
      this.usedFacts.push(retry.index);
      this.currentFact = retry.text;
    } else {
      this.usedFacts.push(fact.index);
      this.currentFact = fact.text;
    }

    this.factText.setText(this.currentFact);
    this.factText.setPosition(this.x, this.y - 50);
    this.factText.setVisible(true);
    this.factVisibleUntil = this.scene.time.now + FACT_SHOW_DURATION;
  }

  destroy(fromScene) {
    if (this.factText) this.factText.destroy();
    super.destroy(fromScene);
  }
}