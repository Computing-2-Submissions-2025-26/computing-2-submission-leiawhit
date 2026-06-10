/**
 * Stats.js is a module to track player statistics across Labyrinth games.
 * @namespace Stats
 * @author Leia
 * @version 2024/25
 */
const Stats = Object.create(null);

/**
 * @memberof Stats
 * @typedef {Object} Statistics
 * @property {number} treasures_collected Total treasures collected
 *     by the player across all games.
 * @property {number} home_returns The number of times the player has
 *     returned to their home corner after collecting all treasures.
 */

const player_statistics = {};

const new_player = function () {
    return {
        "treasures_collected": 0,
        "home_returns": 0
    };
};

/**
 * @memberof Stats
 * @function
 * @param {string[]} players A list of player names to return stats for.
 * @returns {Object.<Stats.Statistics>} The statistics of the requested
 *     players as object with keys given in players.
 */
Stats.get_statistics = function (players) {
    return Object.fromEntries(
        players.map(
            (player) => [player, player_statistics[player] || new_player()]
        )
    );
};

/**
 * Record a treasure being collected by a player.
 * @memberof Stats
 * @function
 * @param {string} player The name of the player.
 */
Stats.record_treasure = function (player) {
    if (!player_statistics[player]) {
        player_statistics[player] = new_player();
    }
    player_statistics[player].treasures_collected += 1;
};

/**
 * Record a player returning home to win the game.
 * @memberof Stats
 * @function
 * @param {string} player The name of the player.
 */
Stats.record_home_return = function (player) {
    if (!player_statistics[player]) {
        player_statistics[player] = new_player();
    }
    player_statistics[player].home_returns += 1;
};

export default Object.freeze(Stats);
