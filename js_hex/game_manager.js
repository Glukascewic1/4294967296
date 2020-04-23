function GameManager(size, InputManager, Actuator, ScoreManager) {
  this.size         = size; // Size of the grid
  this.inputManager = new InputManager;
  this.scoreManager = new ScoreManager;
  this.actuator     = new Actuator;

  this.startTiles   = 2;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.actuator.continue(true);
  this.setup();
};

// Keep playing after winning
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continue();
};

GameManager.prototype.isGameTerminated = function () {
  if (this.over || (this.won && !this.keepPlaying)) {
    return true;
  } else {
    return false;
  }
};

// Set up the game
GameManager.prototype.setup = function () {
  this.grid        = new Grid(this.size);

  this.score       = 0;
  this.over        = false;
  this.won         = false;
  this.keepPlaying = false;

  // Add the initial tiles
  this.addStartTiles();

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a well-tempered tile in a random position
GameManager.prototype.addEasyTile = function () {
  if (this.grid.cellsAvailable()) {
    var cell = this.grid.randomAvailableCell();

    // Find good value
    var values = this.grid.cellValues([
      { x: cell.x - 1, y: cell.y },
      { x: cell.x, y: cell.y - 1 },
      { x: cell.x + 1, y: cell.y },
      { x: cell.x, y: cell.y + 1 }]);
    if (values.length == 0) {
      values = this.grid.cellValues([
        { x: cell.x - 1, y: cell.y - 1 },
        { x: cell.x - 1, y: cell.y + 1 },
        { x: cell.x + 1, y: cell.y - 1 },
        { x: cell.x + 1, y: cell.y + 1 }]);
    }
    values.push(2);
    value = values[Math.floor(Math.random() * values.length)];

    var tile = new Tile(cell, value);
    this.grid.insertTile(tile);
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var self = this;
    var bvalue = 13407807929942597099574024998205846127479365820592393377723561443721764030073546976801874298166903427690031858186486050853753882811946569946433649006084096;
    var bcell = this.grid.randomAvailableCell();

    for (var i = 0; i < 8; i++) {
      var cell = this.grid.randomAvailableCell();

      function check(x, y, dx, dy) {
        if (x < 0 || y < 0 || x >= self.grid.size || y >= self.grid.size) return;

        if (
          !!self.grid.cells[cell.x + x]
          &&
          !!self.grid.cells[cell.x + x][cell.y + y]
        ) {
          var tocheck = self.grid.cells[cell.x + x][cell.y + y];
          if (Math.random() < 0.8 && tocheck.value < bvalue) {
            bcell = cell;
            bvalue = tocheck.value;
          }
        } else check(x + dx, y + dy, dx, dy);
      }

      check(-1, 0, -1, 0);
      check(1, 0, 1, 0);
      check(0, -1, 0, -1);
      check(0, 1, 0, 1);

      if (bvalue == 13407807929942597099574024998205846127479365820592393377723561443721764030073546976801874298166903427690031858186486050853753882811946569946433649006084096) {bvalue = 1;}
    }

    var tile = new Tile(bcell, bvalue);

    this.grid.insertTile(tile);
  }
};


// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.scoreManager.get() < this.score) {
    this.scoreManager.set(this.score);
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    over:       this.over,
    won:        this.won,
    bestScore:  this.scoreManager.get(),
    terminated: this.isGameTerminated()
  });

};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2:down, 3: left
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var traversals = this.buildTraversals(direction);
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();
  // Traverse the grid in the right direction and move tiles
  traversals.forEach(function (cells) {
    cells.forEach(function (cell) {
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, direction);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += Math.round(Math.random() * 2048) + merged.value * merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile();
    // if (Math.random() > 0.25) {
    //   this.addRandomTile();
    // }
    if (!this.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate();
    return true;
  }
  return false;
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction, cell) {
  // Vectors representing tile movement
  var map = {
    0: { x: -1, y: 0 },  // left
    1: { x: 1,  y: 0 }   // right
  };

  if (map[direction]) {
    return map[direction];
  }

  var vector = {x: 0, y: 0};
  switch (direction) {
    case 2:
      if (cell.y < 3) {
        vector.x = -1;
      }
      vector.y = -1;
      break;
    case 3:
      if (cell.y < 2) {
        vector.x = 1;
      }
      vector.y = 1;
      break;
    case 4:
      if (cell.y > 2) {
        vector.x = 1;
      }
      vector.y = -1;
      break;
    case 5:
      if (cell.y > 1) {
        vector.x = -1;
      }
      vector.y = 1;
      break;
  }

  return vector;
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (direction) {
  var map = {
    0: [
      [{ x: 0,  y: 0 }, { x: 1,  y: 0 }, { x: 2,  y: 0 }],
      [{ x: 0,  y: 1 }, { x: 1,  y: 1 }, { x: 2,  y: 1 }, { x: 3,  y: 1 }],
      [{ x: 0,  y: 2 }, { x: 1,  y: 2 }, { x: 2,  y: 2 }, { x: 3,  y: 2 }, { x: 4,  y: 2 }],
      [{ x: 0,  y: 3 }, { x: 1,  y: 3 }, { x: 2,  y: 3 }, { x: 3,  y: 3 }],
      [{ x: 0,  y: 4 }, { x: 1,  y: 4 }, { x: 2,  y: 4 }],
    ],
    2: [
      [{ x: 2,  y: 0 }, { x: 3,  y: 1 }, { x: 4,  y: 2 }],
      [{ x: 1,  y: 0 }, { x: 2,  y: 1 }, { x: 3,  y: 2 }, { x: 3,  y: 3 }],
      [{ x: 0,  y: 0 }, { x: 1,  y: 1 }, { x: 2,  y: 2 }, { x: 2,  y: 3 }, { x: 2,  y: 4 }],
      [{ x: 0,  y: 1 }, { x: 1,  y: 2 }, { x: 1,  y: 3 }, { x: 1,  y: 4 }],
      [{ x: 0,  y: 2 }, { x: 0,  y: 3 }, { x: 0,  y: 4 }],
    ],
    4: [
      [{ x: 0,  y: 0 }, { x: 0,  y: 1 }, { x: 0,  y: 2 }],
      [{ x: 1,  y: 0 }, { x: 1,  y: 1 }, { x: 1,  y: 2 }, { x: 0,  y: 3 }],
      [{ x: 2,  y: 0 }, { x: 2,  y: 1 }, { x: 2,  y: 2 }, { x: 1,  y: 3 }, { x: 0,  y: 4 }],
      [{ x: 3,  y: 1 }, { x: 3,  y: 2 }, { x: 2,  y: 3 }, { x: 1,  y: 4 }],
      [{ x: 4,  y: 2 }, { x: 3,  y: 3 }, { x: 2,  y: 4 }],
    ],
  };
  for (var i = 0; i < 6; i += 2) {
    map[i + 1] = [];
    for (var j = 0; j < map[i].length; j++) {
      map[i + 1].push(map[i][j].slice().reverse());
    }
  }
  return map[direction];
};

GameManager.prototype.findFarthestPosition = function (cell, direction) {
  var previous, vector;

  // Progress towards the vector direction until an obstacle is found
  do {
    vector = this.getVector(direction, cell);
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 6; direction++) {
          var vector = self.getVector(direction, { x: x, y: y });
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};
