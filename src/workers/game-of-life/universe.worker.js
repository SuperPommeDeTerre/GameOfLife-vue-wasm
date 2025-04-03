class GOLCell {
    #age = 0;
    #neighbours = [];

    /**
     * Get the age of the cell.
     */
    get age() {
        return this.#age;
    };

    /**
     * Gets the neighbours of the cell.
     */
    get neighbours() {
        return this.#neighbours;
    };

    /**
     * Increments the age of the cell.
     */
    getOlder() {
        this.#age++;
    };

    constructor(x, y) {
        this.#age = 0;
        this.#neighbours = GOLCell.getNeighbours(x, y);
    };

    /**
     * Gets the neighbours of a cell. If the cell is at the limit of the universe, it will wrap around.
     * It it as static method because we doesn't store coordinates as cell properties, but as keys in the universe map.
     * 
     * @param {Number} x X coordinate of the cell
     * @param {Number} y Y coordinate of the cell
     * @returns {Array} An array with the coordinates of the neighbours.
     */
    static getNeighbours(x, y) {
        let prevX = x - 1,
            nextX = x + 1,
            prevY = y - 1,
            nextY = y + 1;
        // Handle limits. If we are at the limit, we need to wrap around.
        if (x === Number.MIN_SAFE_INTEGER) {
            prevX = Number.MAX_SAFE_INTEGER;
        } else if (x === Number.MAX_SAFE_INTEGER) {
            nextX = Number.MIN_SAFE_INTEGER;
        }
        if (y === Number.MIN_SAFE_INTEGER) {
            prevY = Number.MAX_SAFE_INTEGER;
        } else if (y === Number.MAX_SAFE_INTEGER) {
            nextY = Number.MIN_SAFE_INTEGER;
        }
        return [
            toMapkey([prevX, prevY]), toMapkey([x, prevY]), toMapkey([nextX, prevY]),
            toMapkey([prevX, y]),                           toMapkey([nextX, y]),
            toMapkey([prevX, nextY]), toMapkey([x, nextY]), toMapkey([nextX, nextY])
        ];
    };
};

function fromMapkey(str) {
    return str.split(':').map(Number);
}

function toMapkey(arr) {
    return arr.join(':');
}

class GOLUniverse {
    // Map of alive cells with key as coordinates and value as GOLCell
    // We need to store only alive cells as they are the only ones that are involved for calculating next generation
    #aliveCells = new Map();
    // Age of the universe
    #age = 0;
    // Singleton instance
    static #instance = null;

    static get instance() {
        if (GOLUniverse.#instance === null) {
            GOLUniverse.#instance = new GOLUniverse();
        }
        return GOLUniverse.#instance;
    };

    /**
     * Calculate the number of alive neighbours for each cell that can change.
     * This is done by iterating over the alive cells and incrementing the count for each neighbour.
     * As such, we don't need to iterate over all the cells in the universe and the live cells are counted only once.
     * 
     * @returns {Map} A Map where the key is the coordinates of the cell and the value is the number of alive neighbours.
     */
    #getAliveNeighboursCount() {
        const aliveNeighboursCount = new Map();
        this.#aliveCells.forEach((aliveCell, aliveCellCoords) => {
            let isCellAlone = true;
            aliveCell.neighbours.forEach(neighbourCoords => {
                aliveNeighboursCount.set(neighbourCoords, (aliveNeighboursCount.get(neighbourCoords) || 0) + 1);
                // If at least one neighbour is alive, the cell is not alone in its environment
                if (isCellAlone && this.#aliveCells.has(neighbourCoords)) {
                    isCellAlone = false;
                }
            });
            // If the cell is alive, but all the neighbours are dead, the cell will die but is not present in the resulting map. We must had it or it will never change its state.
            if (isCellAlone) {
                aliveNeighboursCount.set(aliveCellCoords, 0);
            }
        });
        return aliveNeighboursCount;
    };

    /**
     * Update the universe by removing dying cells, aging alive cells and adding borning cells.
     * 
     * @param {Set} dyingCells Set of coordinates of cells that will die
     * @param {Set} borningCells Set of coordinates of cells that will born
     */
    #updateUniverse(dyingCells, borningCells) {
        // First, remove the dying cells
        dyingCells.forEach(cellCoords => {
            this.#aliveCells.delete(cellCoords);
        });
        // Then, aging cells that are still alive
        this.#aliveCells.forEach(cell => {
            cell.getOlder();
        });
        // Finally, add the borning cells
        borningCells.forEach(cellCoords => {
            let cellCoordsArray = fromMapkey(cellCoords);
            this.#aliveCells.set(cellCoords, new GOLCell(cellCoordsArray[0], cellCoordsArray[1]));
        });
        // Don't forget to increment the age of the universe !
        this.#age++;
    };

    /**
     * Calculate the cells that will die and the cells that will born.
     * 
     * @returns {Array} An array with two Sets: the first one contains the coordinates of the cells that will die and the second one the coordinates of the cells that will born
     */
    #getBorningAndDyingCells() {
        const dyingCells = [],
              borningCells = [],
              // Compute the number of alive cells for each cell around each alive cell
              aliveNeighboursCount = this.#getAliveNeighboursCount();
        aliveNeighboursCount.forEach((aliveCellNeighboursCount, cellCoords) => {
            const isCellCurrentlyAlive = this.#aliveCells.has(cellCoords);
            if (isCellCurrentlyAlive && (aliveCellNeighboursCount < 2 || aliveCellNeighboursCount > 3)) {
                // A live cell will die if it hasn't 2 or 3 alive neighbours
                dyingCells.push(cellCoords);
            } else if (!isCellCurrentlyAlive && aliveCellNeighboursCount === 3) {
                // A dead cell will born if it has exactly 3 alive neighbours.
                borningCells.push(cellCoords);
            }
        });
        return {
            dyingCells: dyingCells,
            borningCells: borningCells
        };
    };

    /**
     * Performs a tick on the universe. (Calculate the next generation).
     * 
     * @returns {Object} An object with the dying cells and the borning cells (changes).
     */
    tick() {
        // Check which cells will die and which will be borning
        const result = this.#getBorningAndDyingCells();
        const dyingCells = result.dyingCells;
        const borningCells = result.borningCells;
        // Update the universe
        this.#updateUniverse(dyingCells, borningCells);
        // Send message to the main thread to update the grid
        // We need to send the changes
        return {
            dyingCells: dyingCells.map((cellCoordsString) => fromMapkey(cellCoordsString)),
            borningCells: borningCells.map((cellCoordsString) => fromMapkey(cellCoordsString))
        }
    };

    /**
     * Get the age of the universe.
     */
    get age() {
        return this.#age;
    };

    /**
     * Add a living cell to the universe.
     * 
     * @param {Array} cellCoords Coordinates of the cell to add
     */
    addCell(cellCoords) {
        const mapCoordsKey = toMapkey(cellCoords);
        if (!this.#aliveCells.has(mapCoordsKey)) {
            this.#aliveCells.set(mapCoordsKey, new GOLCell(cellCoords[0], cellCoords[1]));
        }
    };

    isCellAlive(cellCoords) {
        return this.#aliveCells.has(toMapkey(cellCoords));
    };

    /**
     * Kill a living cell from the universe.
     * 
     * @param {*} cellCoords Coordinates of the cell to kill
     * @returns {Boolean} True if the cell was killed, false otherwise
     */
    killCell(cellCoords) {
        return this.#aliveCells.delete(cellCoords);
    };

    /**
     * Get the alive cells of the universe.
     * 
     * @returns {Array} An array with the coordinates of the alive cells.
     */
    get aliveCells() {
        return this.#aliveCells.keys().map((cellCoordsString) => fromMapkey(cellCoordsString)).toArray();
    };

    static init(cells = []) {
        let universeInstance = GOLUniverse.instance;
        // Allow inital passing of cells
        for (let cellCoordinates of cells) {
            universeInstance.addCell(cellCoordinates);
        }
        return {
            dyingCells: [],
            borningCells: cells
        };
    };

    static clear(cells = []) {
        let result = {
            dyingCells: [ GOLUniverse.instance.aliveCells ],
            borningCells: cells
        };
        GOLUniverse.#instance = null;
        let universeInstance = GOLUniverse.instance;
        for (let cellCoordinates of cells) {
            universeInstance.addCell(cellCoordinates);
        }
        return result;
    };

    static tick() {
        return GOLUniverse.instance.tick();
    };

    static addCells(cellCoords) {
        let universeInstance = GOLUniverse.instance;
        for (let cellCoordinates of cellCoords) {
            universeInstance.addCell(cellCoordinates);
        }
        return {
            dyingCells: [],
            borningCells: cellCoords
        };
    };

    static killCells(cellCoords) {
        let universeInstance = GOLUniverse.instance;
        for (let cellCoordinates of cellCoords) {
            universeInstance.killCell(cellCoordinates);
        }
        return {
            dyingCells: cellCoords,
            borningCells: []
        };
    };

    static toggleCell(cellCoords) {
        let universeInstance = GOLUniverse.instance;
        let result = {
            dyingCells: [],
            borningCells: []
        };
        if (universeInstance.isCellAlive(cellCoords)) {
            universeInstance.killCell(cellCoords);
            result.dyingCells.push(cellCoords);
        } else {
            universeInstance.addCell(cellCoords);
            result.borningCells.push(cellCoords);
        }
        return result;
    };
};

/**
 * Listen to messages from the main thread.
 * 
 * The structure of the request is in the form of an object with the following properties:
 * - event: The event that we need to handle
 * - correlationId (optional): A unique identifier for the request (useful when parallelizing requests)
 * 
 * The following events are handled:
 * - init: Initialize the universe
 * - tick: Calculate the next generation
 * - add_cell: Add a cell to the universe
 * - kill_cell: Kill a cell from the universe
 * 
 * We'll send back objects resulting of the requested operation by posting a message containing:
 * - event: The event that was handled
 * - correlationId: The correlationId of the request
 * - data (optional): The data resulting of the operation (depends on the event)
 *   Depending on the event, the data can contain:
 *   - dyingCells: The coordinates of the cells that will die
 *   - borningCells: The coordinates of the cells that will born
 */
onmessage = function(e) {
    // If no data nor event is given, we don't do anything
    if (e.data === null || e.data.event === undefined) {
        return;
    }
    // If the correlationId is not given, we generate one
    if (e.data.correlationId === undefined) {
        e.data.correlationId = Math.random().toString(36).substring(2);
    }
    // Initialize the post back result
    const postBackResult = {
        event: e.data.event,
        correlationId: e.data.correlationId
    };
    let startTime = 0,
        endTime = 0;
    switch (e.data.event) {
        // Create an empty universe (Only dead cells)
        case 'init':
            startTime = performance.now();
            postBackResult['changes'] = GOLUniverse.init(e.data.cells);
            endTime = performance.now();
            console.log(`Universe initialized in ${endTime - startTime}ms`);
            break;
        // Calculate the next generation
        case 'tick':
            startTime = performance.now();
            postBackResult['changes'] = GOLUniverse.tick();
            endTime = performance.now();
            console.log(`Universe ticked in ${endTime - startTime}ms`);
            break;
        // Add cells to the universe
        case 'add_cells':
            startTime = performance.now();
            postBackResult['changes'] = GOLUniverse.addCells(e.data.coords);
            endTime = performance.now();
            console.log(`Cells added in ${endTime - startTime}ms`);
            break;
            // Kill a cell from the universe
        case 'kill_cells':
            startTime = performance.now();
            postBackResult['changes'] = GOLUniverse.killCells(e.data.coords);
            endTime = performance.now();
            console.log(`Cells killed in ${endTime - startTime}ms`);
            break;
        // Get the statistics of the universe (longest living cell, current age, etc.)
        case 'get_statistics':
            break;
        case 'clear':
            startTime = performance.now();
            postBackResult['changes'] = GOLUniverse.clear(e.data.cells);
            endTime = performance.now();
            console.log(`Universe cleared in ${endTime - startTime}ms`);
            break;
        case 'toggle_cell':
            startTime = performance.now();
            postBackResult['changes'] = GOLUniverse.toggleCell(e.data.coords);
            endTime = performance.now();
            console.log(`Cell toggled in ${endTime - startTime}ms`);
            break;
        default:
            break;
    }
    postMessage(postBackResult);
};