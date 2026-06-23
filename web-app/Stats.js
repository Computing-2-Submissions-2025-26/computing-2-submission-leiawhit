/**
 * Module to load and save player statistics.
 * @namespace Stats
 * @author Leia
 * @version 2024/25
 */
const Stats = Object.create(null);

/**
 * @memberof Stats
 * @typedef {Object} Statistics
 * @property {number} hearts_collected How many hearts the player
 *     has collected.
 */

const player_statistics = {};

const new_player = function () {
    return {
        "hearts_collected": 0
    };
};

/**
 * @memberof Stats
 * @function
 * @param {string[]} players A list of player names to return stats for.
 * @returns {Object.<Stats.Statistics>} The statistics of the requested
 *     players as an object with keys given in players.
 */
Stats.get_statistics = function (players) {
    return Object.fromEntries(
        players.map(
            (player) => [player, player_statistics[player] || new_player()]
        )
    );
};

/**
 * Record a heart being collected by a player.
 * @memberof Stats
 * @function
 * @param {string} player The name of the player.
 * @returns {Object.<Stats.Statistics>} Returns statistics for the player.
 */
Stats.record_heart = function (player) {
    if (!player_statistics[player]) {
        player_statistics[player] = new_player();
    }

    player_statistics[player].hearts_collected += 1;

    return Stats.get_statistics([player]);
};

export default Object.freeze(Stats);