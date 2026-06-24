import R from "./ramda.js";

/**
 * Labyrinth.js is a module to model and play the Labyrinth board game.
 * @namespace Labyrinth
 * @author Leia
 * @version 2024/25
 */
const Labyrinth = Object.create(null);

/**
 * A path shape determines which sides of a tile are open as a maze path.
 * @memberof Labyrinth
 * @typedef {("straight" | "corner" | "t_junction")} Shape
 */

/**
 * A clockwise rotation in 90° increments.
 * @memberof Labyrinth
 * @typedef {(0 | 1 | 2 | 3)} Rotation
 */

/**
 * A single tile in the maze.
 * @memberof Labyrinth
 * @typedef {Object} Tile
 * @property {Labyrinth.Shape} shape The tile path shape.
 * @property {Labyrinth.Rotation} rotation The tile rotation.
 * @property {(Labyrinth.Heart | undefined)} heart The heart on the tile, if there is one.
 * @property {boolean} fixed Whether the tile is fixed in place or shiftable.
 */

/**
 * A position on the board as [column, row], both 0 indexed.
 * @memberof Labyrinth
 * @typedef {number[]} Position
 */

/**
 * A player number.
 * @memberof Labyrinth
 * @typedef {(1 | 2 | 3 | 4)} Player
 */

/**
 * The phase of the current player's turn.
 * @memberof Labyrinth
 * @typedef {("shift" | "move")} Phase
 */

/**
 * A heart colour.
 * @memberof Labyrinth
 * @typedef {("green" | "red" | "purple" | "grey")} Heart
 */

/**
 * A sliding action. Direction is which way the row or column moves.
 * @memberof Labyrinth
 * @typedef {Object} Shift
 * @property {("row_right" | "row_left" | "column_down" | "column_up")} direction
 * The direction the row or column is shifted.
 * @property {(1 | 3 | 5)} index The row or column index.
 */

/**
 * The complete game state.
 * @memberof Labyrinth
 * @typedef {Object} GameState
 * @property {Labyrinth.Tile[][]} board The 7×7 board, indexed board[column][row].
 * @property {Labyrinth.Tile} spare_tile The spare tile waiting off the board.
 * @property {Labyrinth.Position[]} player_positions The position of each player.
 * @property {number[]} player_hearts The number of hearts each player has collected.
 * @property {number} player_count The number of players in the game.
 * @property {Labyrinth.Player} current_player The player whose turn it is.
 * @property {Labyrinth.Phase} phase The current phase of the turn.
 * @property {(Labyrinth.Position | undefined)} spawned_heart_pos
 * The position where a new heart was spawned.
 * @property {(Labyrinth.Shift | undefined)} last_shift The previous shift.
 * @property {(Labyrinth.Player | undefined)} winner The winning player.
 */

/**
 * The board side length.
 * @memberof Labyrinth
 */
Labyrinth.board_size = 7;

/**
 * The heart colours assigned to players.
 * @memberof Labyrinth
 */
Labyrinth.heart = Object.freeze([
    "green",
    "red",
    "purple",
    "grey"
]);

/**
 * Base openings for each shape at rotation 0, as [north, east, south, west].
 * @memberof Labyrinth
 */
Labyrinth.shape_openings = Object.freeze({
    "straight": [true, false, true, false],
    "corner": [false, true, true, false],
    "t_junction": [false, true, true, true]
});

/**
 * The starting corner for each player.
 * @memberof Labyrinth
 */
Labyrinth.home_positions = Object.freeze({
    1: [0, 0],
    2: [6, 0],
    3: [6, 6],
    4: [0, 6]
});

/**
 * Returns the open sides of a tile after rotation.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Tile} tile The tile to check.
 * @returns {boolean[]} The open sides as [north, east, south, west].
 */
Labyrinth.tile_openings = function (tile) {
    const base = Labyrinth.shape_openings[tile.shape];

    const rotate_once = function ([north, east, south, west]) {
        return [west, north, east, south];
    };

    return R.range(0, tile.rotation).reduce(rotate_once, base);
};

/**
 * Returns a tile rotated once clockwise.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Tile} tile The tile to rotate.
 * @returns {Labyrinth.Tile} The rotated tile.
 */
Labyrinth.rotate_tile = function (tile) {
    return Object.freeze({
        "shape": tile.shape,
        "rotation": (tile.rotation + 1) % 4,
        "heart": tile.heart,
        "fixed": tile.fixed
    });
};

const direction_index = {
    "north": 0,
    "east": 1,
    "south": 2,
    "west": 3
};

const opposite_direction = {
    "north": "south",
    "east": "west",
    "south": "north",
    "west": "east"
};

const direction_delta = {
    "north": [0, -1],
    "east": [1, 0],
    "south": [0, 1],
    "west": [-1, 0]
};

/**
 * Returns whether two adjacent tiles are connected.
 * @memberof Labyrinth
 * @function
 * @param {("north" | "east" | "south" | "west")} direction The travel direction.
 * @param {Labyrinth.Tile} tile_a The first tile.
 * @param {Labyrinth.Tile} tile_b The second tile.
 * @returns {boolean} Whether the tiles connect.
 */
Labyrinth.tiles_connected = function (direction, tile_a, tile_b) {
    const a = Labyrinth.tile_openings(tile_a);
    const b = Labyrinth.tile_openings(tile_b);

    return (
        a[direction_index[direction]] &&
        b[direction_index[opposite_direction[direction]]]
    );
};

const in_bounds = function ([column, row]) {
    return (
        column >= 0 &&
        column < Labyrinth.board_size &&
        row >= 0 &&
        row < Labyrinth.board_size
    );
};

const positions_equal = function ([a_column, a_row], [b_column, b_row]) {
    return (
        a_column === b_column &&
        a_row === b_row
    );
};

/**
 * Returns every position reachable from a starting position.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Position} start The starting position.
 * @param {Labyrinth.Tile[][]} board The game board.
 * @returns {Labyrinth.Position[]} The reachable positions.
 */
Labyrinth.reachable_positions = function (start, board) {
    const key_of = function ([column, row]) {
        return column + "," + row;
    };

    const visited = new Set([key_of(start)]);
    let tiles = [start];

    while (tiles.length > 0) {
        const next_tiles = [];

        tiles.forEach(function ([column, row]) {
            const tile_a = board[column][row];

            Object.entries(direction_delta).forEach(function (entry) {
                const direction = entry[0];
                const delta = entry[1];
                const neighbour = [
                    column + delta[0],
                    row + delta[1]
                ];

                if (
                    !in_bounds(neighbour) ||
                    visited.has(key_of(neighbour))
                ) {
                    return;
                }

                const tile_b = board[neighbour[0]][neighbour[1]];

                if (Labyrinth.tiles_connected(direction, tile_a, tile_b)) {
                    visited.add(key_of(neighbour));
                    next_tiles.push(neighbour);
                }
            });
        });

        tiles = next_tiles;
    }

    return Array.from(visited).map(function (key) {
        return key.split(",").map(Number);
    });
};

/**
 * Returns the path the player will move across to reach the destination.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Position} start The starting position.
 * @param {Labyrinth.Position} destination The target position.
 * @param {Labyrinth.Tile[][]} board The game board.
 * @returns {Labyrinth.Position[]} The path, or [start] if blocked.
 */
Labyrinth.find_path = function (start, destination, board) {
    const key_of = function (pos) {
        return pos[0] + "," + pos[1];
    };

    const dest_key = key_of(destination);
    const previous = {};
    previous[key_of(start)] = null;

    let frontier = [start];

    while (frontier.length > 0) {
        const next_frontier = [];

        frontier.forEach(function (pos) {
            const tile_a = board[pos[0]][pos[1]];

            Object.entries(direction_delta).forEach(function (entry) {
                const direction = entry[0];
                const delta = entry[1];
                const neighbour = [
                    pos[0] + delta[0],
                    pos[1] + delta[1]
                ];
                const neighbour_key = key_of(neighbour);

                if (
                    !in_bounds(neighbour) ||
                    Object.prototype.hasOwnProperty.call(
                        previous,
                        neighbour_key
                    )
                ) {
                    return;
                }

                if (
                    Labyrinth.tiles_connected(
                        direction,
                        tile_a,
                        board[neighbour[0]][neighbour[1]]
                    )
                ) {
                    previous[neighbour_key] = pos;
                    next_frontier.push(neighbour);
                }
            });
        });

        if (Object.prototype.hasOwnProperty.call(previous, dest_key)) {
            break;
        }

        frontier = next_frontier;
    }

    if (!Object.prototype.hasOwnProperty.call(previous, dest_key)) {
        return [start];
    }

    const path = [];
    let current = destination;

    while (current !== null) {
        path.unshift(current);
        current = previous[key_of(current)];
    }

    return path;
};

const make_tile = function (shape, rotation, heart, fixed) {
    return Object.freeze({
        "shape": shape,
        "rotation": rotation,
        "heart": heart,
        "fixed": fixed
    });
};

/**
 * Returns the fixed tiles on the board.
 * @memberof Labyrinth
 * @function
 * @returns {Object} The fixed tiles keyed by "column,row".
 */
Labyrinth.fixed_tiles = function () {
    const corner = function (rotation) {
        return make_tile("corner", rotation, undefined, true);
    };

    const t_junction = function (rotation) {
        return make_tile("t_junction", rotation, undefined, true);
    };

    return Object.freeze({
        "0,0": corner(0),
        "6,0": corner(1),
        "0,6": corner(3),
        "6,6": corner(2),
        "2,0": t_junction(2),
        "4,0": t_junction(2),
        "2,6": t_junction(0),
        "4,6": t_junction(0),
        "0,2": t_junction(1),
        "0,4": t_junction(1),
        "6,2": t_junction(3),
        "6,4": t_junction(3),
        "2,2": t_junction(1),
        "4,2": t_junction(2),
        "2,4": t_junction(0),
        "4,4": t_junction(3)
    });
};

// Fisher-Yates shuffle.
const shuffle = function (array) {
    const arr = array.slice();
    let index = arr.length;

    while (index > 0) {
        const random_index = Math.floor(Math.random() * index);
        index -= 1;

        [arr[index], arr[random_index]] = [
            arr[random_index],
            arr[index]
        ];
    }

    return arr;
};

const build_movable_area = function (player_count, active_hearts) {
    const shapes = [
        ...R.repeat("corner", 12),
        ...R.repeat("straight", 10),
        ...R.repeat("t_junction", 12)
    ];

    const shuffled_shapes = shuffle(shapes);
    const heart_indices = shuffle(R.range(0, shapes.length)).slice(
        0,
        player_count
    );
    const heart_by_index = R.fromPairs(R.zip(heart_indices, active_hearts));

    return shuffled_shapes.map(function (shape, index) {
        return make_tile(
            shape,
            Math.floor(Math.random() * 4),
            heart_by_index[index],
            false
        );
    });
};

/**
 * Creates a new random game state.
 * @memberof Labyrinth
 * @function
 * @param {number} player_count The number of players.
 * @returns {Labyrinth.GameState} The starting game state.
 */
Labyrinth.new_game = function (player_count) {
    const fixed = Labyrinth.fixed_tiles();
    const active_hearts = Labyrinth.heart.slice(0, player_count);
    const movable_area = build_movable_area(player_count, active_hearts);
    let area_index = 0;

    const board = R.range(0, Labyrinth.board_size).map(function (column) {
        return R.range(0, Labyrinth.board_size).map(function (row) {
            const key = column + "," + row;

            if (fixed[key]) {
                return fixed[key];
            }

            const tile = movable_area[area_index];
            area_index += 1;
            return tile;
        });
    });

    const spare_tile = movable_area[area_index];

    const player_hearts = R.repeat(0, player_count);

    const player_positions = R.range(1, player_count + 1).map(function (
        player
    ) {
        return Labyrinth.home_positions[player];
    });

    return Object.freeze({
        "board": board,
        "spare_tile": spare_tile,
        "player_positions": player_positions,
        "player_hearts": player_hearts,
        "player_count": player_count,
        "current_player": 1,
        "phase": "shift",
        "spawned_heart_pos": undefined,
        "last_shift": undefined,
        "winner": undefined
    });
};

/**
 * Returns the row and column shifts allowed by the board layout.
 * @memberof Labyrinth
 * @function
 * @returns {Labyrinth.Shift[]} The legal shifts.
 */
Labyrinth.valid_shifts = function () {
    const directions = [
        "row_right",
        "row_left",
        "column_down",
        "column_up"
    ];

    const indices = [1, 3, 5];

    return R.xprod(directions, indices).map(function (pair) {
        return {
            "direction": pair[0],
            "index": pair[1]
        };
    });
};

const shift_row_right = function (index, spare, board) {
    const new_spare = board[6][index];

    const new_board = board.map(function (column, column_index) {
        return column.map(function (tile, row_index) {
            if (row_index !== index) {
                return tile;
            }

            if (column_index === 0) {
                return spare;
            }

            return board[column_index - 1][index];
        });
    });

    return {
        "board": new_board,
        "spare_tile": new_spare
    };
};

const shift_row_left = function (index, spare, board) {
    const last = Labyrinth.board_size - 1;
    const new_spare = board[0][index];

    const new_board = board.map(function (column, column_index) {
        return column.map(function (tile, row_index) {
            if (row_index !== index) {
                return tile;
            }

            if (column_index === last) {
                return spare;
            }

            return board[column_index + 1][index];
        });
    });

    return {
        "board": new_board,
        "spare_tile": new_spare
    };
};

const shift_column_down = function (index, spare, board) {
    const new_spare = board[index][6];
    const new_column = [spare, ...board[index].slice(0, 6)];

    const new_board = board.map(function (column, column_index) {
        if (column_index === index) {
            return new_column;
        }

        return column;
    });

    return {
        "board": new_board,
        "spare_tile": new_spare
    };
};

const shift_column_up = function (index, spare, board) {
    const new_spare = board[index][0];
    const new_column = [...board[index].slice(1), spare];

    const new_board = board.map(function (column, column_index) {
        if (column_index === index) {
            return new_column;
        }

        return column;
    });

    return {
        "board": new_board,
        "spare_tile": new_spare
    };
};

const shift_implementations = {
    "row_right": shift_row_right,
    "row_left": shift_row_left,
    "column_down": shift_column_down,
    "column_up": shift_column_up
};

/**
 * Returns a piece position after a shift.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Shift} shift The shift being made.
 * @param {Labyrinth.Position} position The old position.
 * @returns {Labyrinth.Position} The new position.
 */
Labyrinth.position_after_shift = function (shift, position) {
    const column = position[0];
    const row = position[1];
    const last = Labyrinth.board_size - 1;

    if (shift.direction === "row_right" && row === shift.index) {
        return [column === last ? 0 : column + 1, row];
    }

    if (shift.direction === "row_left" && row === shift.index) {
        return [column === 0 ? last : column - 1, row];
    }

    if (shift.direction === "column_down" && column === shift.index) {
        return [column, row === last ? 0 : row + 1];
    }

    if (shift.direction === "column_up" && column === shift.index) {
        return [column, row === 0 ? last : row - 1];
    }

    return position;
};

/**
 * Applies a shift to the game state.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Shift} shift The shift to apply.
 * @param {Labyrinth.GameState} state The current game state.
 * @returns {(Labyrinth.GameState | undefined)} The updated state, if legal.
 */
Labyrinth.apply_shift = function (shift, state) {
    if (state.phase !== "shift") {
        return undefined;
    }

    const legal = Labyrinth.valid_shifts().some(function (valid_shift) {
        return (
            valid_shift.direction === shift.direction &&
            valid_shift.index === shift.index
        );
    });

    if (!legal) {
        return undefined;
    }

    const apply_shift = shift_implementations[shift.direction];

    const result = apply_shift(
        shift.index,
        state.spare_tile,
        state.board
    );

    const new_positions = state.player_positions.map(function (position) {
        return Labyrinth.position_after_shift(shift, position);
    });

    return Object.freeze({
        "board": result.board,
        "spare_tile": result.spare_tile,
        "player_positions": new_positions,
        "player_hearts": state.player_hearts,
        "player_count": state.player_count,
        "current_player": state.current_player,
        "phase": "move",
        "spawned_heart_pos": undefined,
        "last_shift": Object.freeze(shift),
        "winner": state.winner
    });
};

/**
 * Returns the heart colour collected by a player.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Player} player The player number.
 * @returns {Labyrinth.Heart} The player's heart colour.
 */
Labyrinth.current_target = function (player) {
    return Labyrinth.heart[player - 1];
};

/**
 * Returns how many hearts a player has collected.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Player} player The player number.
 * @param {Labyrinth.GameState} state The current game state.
 * @returns {number} The number collected.
 */
Labyrinth.hearts_collected = function (player, state) {
    return state.player_hearts[player - 1];
};

const next_player = function (state) {
    return (state.current_player % state.player_count) + 1;
};

/**
 * Applies a move to the game state.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.Player} player The player making the move.
 * @param {Labyrinth.Position} destination The chosen destination.
 * @param {Labyrinth.GameState} state The current game state.
 * @returns {(Labyrinth.GameState | undefined)} The updated state, if legal.
 */
Labyrinth.apply_move = function (player, destination, state) {
    if (state.phase !== "move" || state.current_player !== player) {
        return undefined;
    }

    const player_index = player - 1;
    const current_position = state.player_positions[player_index];

    const reachable = Labyrinth.reachable_positions(
        current_position,
        state.board
    );

    if (!reachable.some(function (position) {
        return positions_equal(position, destination);
    })) {
        return undefined;
    }

    const destination_tile = state.board[destination[0]][destination[1]];
    const target = Labyrinth.current_target(player);

    const collected = (
        destination_tile.heart !== undefined &&
        destination_tile.heart === target
    );

    let new_board = state.board;
    let spawned_heart_pos = undefined;

    if (collected) {
        const eligible = [];

        R.range(0, Labyrinth.board_size).forEach(function (column) {
            R.range(0, Labyrinth.board_size).forEach(function (row) {
                if (
                    !state.board[column][row].heart &&
                    !(
                        column === destination[0] &&
                        row === destination[1]
                    )
                ) {
                    eligible.push([column, row]);
                }
            });
        });

        const spawn = (
            eligible.length > 0
            ? eligible[Math.floor(Math.random() * eligible.length)]
            : null
        );

        spawned_heart_pos = spawn;

        new_board = state.board.map(function (column_tiles, column) {
            return column_tiles.map(function (tile, row) {
                if (
                    column === destination[0] &&
                    row === destination[1]
                ) {
                    return make_tile(
                        tile.shape,
                        tile.rotation,
                        undefined,
                        tile.fixed
                    );
                }

                if (
                    spawn &&
                    column === spawn[0] &&
                    row === spawn[1]
                ) {
                    return make_tile(
                        tile.shape,
                        tile.rotation,
                        target,
                        tile.fixed
                    );
                }

                return tile;
            });
        });
    }

    const new_hearts = state.player_hearts.map(function (hearts, index) {
        if (index === player_index && collected) {
            return hearts + 1;
        }

        return hearts;
    });

    const new_positions = state.player_positions.map(function (
        position,
        index
    ) {
        if (index === player_index) {
            return destination;
        }

        return position;
    });

    const has_won = new_hearts[player_index] >= 3;

    return Object.freeze({
        "board": new_board,
        "spare_tile": state.spare_tile,
        "player_positions": new_positions,
        "player_hearts": new_hearts,
        "player_count": state.player_count,
        "current_player": (
            has_won
            ? state.current_player
            : next_player(state)
        ),
        "phase": "shift",
        "last_shift": state.last_shift,
        "winner": (
            has_won
            ? player
            : undefined
        ),
        "spawned_heart_pos": spawned_heart_pos
    });
};

/**
 * Ends the current player's move without moving.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.GameState} state The current game state.
 * @returns {(Labyrinth.GameState | undefined)} The updated state, if legal.
 */
Labyrinth.pass_move = function (state) {
    if (state.phase !== "move") {
        return undefined;
    }

    return Object.freeze({
        ...state,
        "current_player": next_player(state),
        "phase": "shift",
        "spawned_heart_pos": undefined
    });
};

/**
 * Returns whether the game has ended.
 * @memberof Labyrinth
 * @function
 * @param {Labyrinth.GameState} state The current game state.
 * @returns {boolean} Whether the game is ended.
 */
Labyrinth.is_ended = function (state) {
    return state.winner !== undefined;
};

export default Object.freeze(Labyrinth);