let canvasState = null;

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
    let eventOptions = null;
    switch (e.data.event) {
        case 'render':
            renderUniverseChanges(e.data.changes.borningCells, e.data.changes.dyingCells);
            break;
        case 'init':
            // Initialize the canvas state
            if (canvasState !== null) {
                canvasState.terminate();
            }
            eventOptions = e.data.options;
            canvasState = {
                canvas: eventOptions.canvas,
                ctx: null,
                aliveCells: new Set(),
                cellSize: eventOptions.cellSize || 5, // Default to 5px
                width: eventOptions.width,
                height: eventOptions.height,
                xOffset: eventOptions.xOffset || 0, // Default to 0 (in number of cells)
                yOffset: eventOptions.yOffset || 0, // Default to 0 (in number of cells)
                gridWidth: eventOptions.gridWidth || 1, // Default to 1px
                gridColor: eventOptions.gridColor || "rgba(210, 210, 210, .4)",
                bgColor: eventOptions.bgColor || "rgba(255, 255, 255, 0)", // Bakground/dead cell color. It is transparent.
                aliveCellColor: eventOptions.aliveCellColor || "rgba(0, 0, 0, 1)",
            };
            // Calculate bounds
            canvasState.bounds = [
                Math.ceil(canvasState.xOffset + canvasState.width / (canvasState.cellSize + canvasState.gridWidth)),
                Math.ceil(canvasState.yOffset + canvasState.height / (canvasState.cellSize + canvasState.gridWidth))
            ];
            canvasState.ctx = canvasState.canvas.getContext('2d');
            renderGrid();
            renderUniverseChanges(e.data.cells, []);
            break;
        // Add a cell to the universe
        case 'add_cell':
            if (canvasState !== null) {
                renderUniverseChanges([ e.data.coords ], []);
            }
            break;
        case 'add_cells':
            if (canvasState !== null) {
                renderUniverseChanges(e.data.coords, []);
            }
            break;
            // Kill a cell from the universe
        case 'kill_cell':
            if (canvasState !== null) {
                renderUniverseChanges([], [ e.data.coords ]);
            }
            break;
        case 'clear':
            if (canvasState !== null) {
                if (e.data.cells !== undefined) {
                    postBackResult.changs = {
                        borningCells: e.data.cells,
                        dyingCells: [...canvasState.aliveCells.values()].map((cellKeyCoords) => fromKey(cellKeyCoords))
                    };
                    canvasState.aliveCells = new Set(e.data.cells.map(toKey));
                } else {
                    canvasState.aliveCells = new Set();
                }
                renderGrid();
                if (e.data.cells !== undefined) {
                    renderUniverseChanges(e.data.cells, []);
                }
            }
            break;
        case 'change_options':
            eventOptions = e.data.options;
            canvasState = {
                canvas: eventOptions.canvas || canvasState.canvas,
                ctx: canvasState.ctx,
                aliveCells: canvasState.aliveCells,
                cellSize: eventOptions.cellSize || canvasState.cellSize,
                width: eventOptions.width || canvasState.width,
                height: eventOptions.height || canvasState.height,
                xOffset: eventOptions.xOffset || canvasState.xOffset,
                yOffset: eventOptions.yOffset || canvasState.yOffset,
                gridWidth: eventOptions.gridWidth || canvasState.gridWidth,
                gridColor: eventOptions.gridColor || canvasState.gridColor,
                bgColor: eventOptions.bgColor || canvasState.bgColor,
                aliveCellColor: eventOptions.aliveCellColor || canvasState.aliveCellColor,
            };
            // Calculate bounds
            canvasState.bounds = [
                Math.ceil(canvasState.xOffset + canvasState.width / (canvasState.cellSize + canvasState.gridWidth)),
                Math.ceil(canvasState.yOffset + canvasState.height / (canvasState.cellSize + canvasState.gridWidth))
            ];
            // Perform a full render as we can have changed size or colors.
            renderGrid();
            renderUniverseChanges(canvasState.aliveCells.values().map((cellKeyCoords) => fromKey(cellKeyCoords)), []);
            break;
        default:
            break;
    };
    postMessage(postBackResult);
};

function isCellOutOfBounds(cell) {
    return (cell[0] < canvasState.xOffset || cell[0] > canvasState.bounds[0]
        || cell[1] < canvasState.yOffset || cell[1] > canvasState.bounds[1]);
};

/**
 * Render the grid of the shown universe
 */
function renderGrid() {
    function doRender(_timestamp) {
        // Clear the canvas
        canvasState.ctx.clearRect(0, 0, canvasState.width, canvasState.height);
        // Draw the background
        canvasState.ctx.fillStyle = canvasState.bgColor;
        canvasState.ctx.fillRect(0, 0, canvasState.width, canvasState.height);
        if (canvasState.gridWidth >= 1) {
            // Draw the grid
            canvasState.ctx.fillStyle = canvasState.gridColor;
            // Draw vertical lines
            for (let x = 0; x < canvasState.bounds[0] - canvasState.xOffset; x++) {
                canvasState.ctx.fillRect(x * (canvasState.cellSize + canvasState.gridWidth), 0,
                    canvasState.gridWidth, canvasState.height);
            }
            // Draw horizontal lines
            for (let y = 0; y < canvasState.bounds[1] - canvasState.yOffset; y++) {
                canvasState.ctx.fillRect(0, y * (canvasState.cellSize + canvasState.gridWidth),
                    canvasState.width, canvasState.gridWidth);
            }
        }
    };
    requestAnimationFrame(doRender);
};

function fromKey(str) {
    return str.split(':').map(Number);
};

function toKey(arr) {
    return arr.join(':');
};

/**
 * Render the changes in the universe (only the cells)
 * 
 * @param {*} _timestamp 
 */
function renderUniverseChanges(borningCells, dyingCells) {
    let changesToRender = {
        borningCells: borningCells || [],
        dyingCells: dyingCells || []
    };
    function doRender(_timestamp) {
        const cellWidthWithGrid = canvasState.cellSize + canvasState.gridWidth;
        canvasState.ctx.fillStyle = canvasState.bgColor;
        for (const cellCoords of changesToRender.dyingCells) {
            canvasState.aliveCells.delete(toKey(cellCoords));
            if (!isCellOutOfBounds(cellCoords)) {
                let cellDisplayCoordX = (cellCoords[0] - canvasState.xOffset) * cellWidthWithGrid + canvasState.gridWidth,
                    cellDisplayCoordY = (cellCoords[1] - canvasState.yOffset) * cellWidthWithGrid + canvasState.gridWidth;
                canvasState.ctx.clearRect(cellDisplayCoordX, cellDisplayCoordY, canvasState.cellSize, canvasState.cellSize);
                canvasState.ctx.fillRect(cellDisplayCoordX, cellDisplayCoordY, canvasState.cellSize, canvasState.cellSize);
            }
        }
        canvasState.ctx.fillStyle = canvasState.aliveCellColor;
        for (const cellCoords of changesToRender.borningCells) {
            canvasState.aliveCells.add(toKey(cellCoords));
            if (!isCellOutOfBounds(cellCoords)) {
                let cellDisplayCoordX = (cellCoords[0] - canvasState.xOffset) * cellWidthWithGrid + canvasState.gridWidth,
                    cellDisplayCoordY = (cellCoords[1] - canvasState.yOffset) * cellWidthWithGrid + canvasState.gridWidth;
                canvasState.ctx.clearRect(cellDisplayCoordX, cellDisplayCoordY, canvasState.cellSize, canvasState.cellSize);
                canvasState.ctx.fillRect(cellDisplayCoordX, cellDisplayCoordY, canvasState.cellSize, canvasState.cellSize);
            }
        }
    }
    requestAnimationFrame(doRender);
};