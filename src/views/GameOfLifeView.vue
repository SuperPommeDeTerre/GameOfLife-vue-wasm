<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useLocale, useTheme } from 'vuetify'

const { t, n } = useLocale();
const theme = useTheme();

const renderingWorker = new Worker(new URL('../workers/game-of-life/rendering.worker.js', import.meta.url));
const gameWorker = new Worker(new URL('../workers/game-of-life/universe.worker.js', import.meta.url));

const gamespeed = ref(5);
const gamescale = ref(6);
const birthsCount = ref(0);
const deathsCount = ref(0);
const universeAge = ref(0);
const population = ref(0);
const isGameRunning = ref(false);
const canvasOffsetX = ref(0);
const canvasOffsetY = ref(0);
const gridSize = ref(1);
const isWorkerRunning = ref(false);
const inEditMode = ref(false);
const inSettingsMode = ref(false);
const isGridShown = ref(true);
const gridWidth = ref(1);

const GLIDER = [
    [ 0, 0, 1 ],
    [ 1, 0, 1 ],
    [ 0, 1, 1 ]
];

const BLINKER = [
    [ 1, 1, 1 ]
];

const CATERPILLAR = [
    [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1 ],
    [ 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1 ],
    [ 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0 ],
    [ 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1 ],
    [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1 ],
]
/**
 * Get a shape coordinates from its base definition and a base position
 */
const getShapeCoords = function(shape: number[][], basePosX: number, basePosY: number) {
    const coords = [];
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] === 1) {
                coords.push([ basePosX + j, basePosY + i ]);
            }
        }
    }
    return coords;
};

const MAX_BUFFER_SIZE = 10;

let gameCanvas: HTMLCanvasElement | null = document.getElementById('game-of-life-canvas') as HTMLCanvasElement | null;
let gameLoopTimeout: number | null = null;
let isUniverseInitialized = false;
let isCanvasInitialized = false;
let universeStatesBuffer: any[] = [];
let initialState: number[][] = [];

function startPauseGame(_clickEvent: MouseEvent) {
    isGameRunning.value = !isGameRunning.value;
};

function nextTick() {
    gameWorker.postMessage({
        event: 'tick',
    });
};

function speedToTimeout(speed: number) {
    let timeout = 0;
    switch (speed) {
        case 0:
            timeout = 5000;
            break;
        case 1:
            timeout = 2000;
            break;
        case 2:
            timeout = 1000;
            break;
        case 3:
            timeout = 500;
            break;
        case 4:
            timeout = 250;
            break;
        case 5:
            timeout = 125;
            break;
        case 6:
            timeout = 50;
            break;
        default:
            break;
    }
    return timeout;
};

function scaleToCellSize(size: number) {
    let cellSize;
    switch (size) {
        case 0:
            cellSize = 50;
            break;
        case 1:
            cellSize = 25;
            break;
        case 2:
            cellSize = 20;
            break;
        case 3:
            cellSize = 15;
            break;
        case 4:
            cellSize = 10;
            break;
        case 5:
            cellSize = 5;
            break;
        case 6:
            cellSize = 4;
            break;
        case 7:
            cellSize = 2;
            break;
        case 8:
            cellSize = 1;
            break;
        default:
            cellSize = 10;
            break;
    }
    return cellSize;
};

watch(gamescale, (value) => {
    // Calculate new offset to center the universe
    canvasOffsetX.value = - Math.floor((gameCanvas as HTMLCanvasElement).width / 2 / (scaleToCellSize(value) + gridSize.value));
    canvasOffsetY.value = - Math.floor((gameCanvas as HTMLCanvasElement).height / 2 / (scaleToCellSize(value) + gridSize.value));
    renderingWorker.postMessage({
        event: 'change_options',
        options: {
            xOffset: canvasOffsetX.value,
            yOffset: canvasOffsetY.value,
            cellSize: scaleToCellSize(value),
        }
    });
});

function getGridColorFromTheme() {
    const gridColorDark = "rgba(210, 210, 210, .2)";
    const gridColorLight = "rgba(210, 210, 210, .4)";

    return theme.global.name.value == 'dark'?gridColorDark:gridColorLight;
};

watch(isGridShown, (value) => {
    renderingWorker.postMessage({
        event: 'change_options',
        options: {
            gridColor: value?getGridColorFromTheme():"rgba(0, 0, 0, 0)",
        }
    });
});

watch(theme.global.name, (value) => {
    // If the user change the theme, we must redraw the canvas with the new colors
    renderingWorker.postMessage({
        event: 'change_options',
        options: {
            aliveCellColor: value == 'dark'?'rgba(255, 255, 255, 1)':'rgba(0, 0, 0, 1)',
        }
    });
});

watch(isGameRunning, (_willRun, wasRunning) => {
    if (wasRunning) {
        if (gameLoopTimeout !== null) {
            window.clearTimeout(gameLoopTimeout);
        }
    } else {
        isWorkerRunning.value = true;
        gameWorker.postMessage({
            event: 'tick',
        });
        gameLoop();
    }
});

function resetUniverse() {
    // Clear the statistics
    birthsCount.value = 0;
    deathsCount.value = 0;
    universeAge.value = 0;
    population.value = initialState.length;
    universeStatesBuffer = [];
    gameWorker.postMessage({
        event: 'clear',
        cells: initialState
    });
    renderingWorker.postMessage({
        event: 'clear',
        cells: initialState
    });
};

function clearUniverse(clickEvent: MouseEvent) {
    // Stop the game if it's running
    if (isGameRunning.value) {
        startPauseGame(clickEvent);
    }
    // Clear the statistics
    birthsCount.value = 0;
    deathsCount.value = 0;
    universeAge.value = 0;
    population.value = 0;
    // Clear the universe 
    gameWorker.postMessage({
        event: 'clear',
    });
    // then redraw empty grid
    universeStatesBuffer = [];
    renderingWorker.postMessage({
        event: 'clear',
    });
};

function randomizeUniverse(clickEvent: MouseEvent) {
    // Pause the game if it's running
    const wasGameRunning = isGameRunning.value;
    if (isGameRunning.value) {
        startPauseGame(clickEvent);
    }
    // Clear the universe
    gameWorker.postMessage({
        event: 'clear',
    });
    renderingWorker.postMessage({
        event: 'clear',
    });
    // Clear the statistics
    birthsCount.value = 0;
    deathsCount.value = 0;
    universeAge.value = 0;
    population.value = 0;
    // Then redraw random cells
    const randomCells = [];
    // Gets the visible universe size (in cells)
    let width = Math.floor((gameCanvas as HTMLCanvasElement).width / (scaleToCellSize(gamescale.value) + gridSize.value));
    let height = Math.floor((gameCanvas as HTMLCanvasElement).height / (scaleToCellSize(gamescale.value) + gridSize.value));
    let offsetX = canvasOffsetX.value;
    let offsetY = canvasOffsetY.value;
    for (let i = 0; i <= width; i++) {
        for (let j = 0; j <= height; j++) {
            if (Math.random() > 0.5) {
                randomCells.push([i + offsetX, j + offsetY]);
            }
        }
    }
    universeStatesBuffer = [];
    gameWorker.postMessage({
        event: 'add_cells',
        coords: randomCells
    });

    // Restart the game if it was previously running
    if (wasGameRunning) {
        startPauseGame(clickEvent);
    }
};

function toggleCell(clickEvent: MouseEvent) {
    // Compute the cell universe coordinates from the click event
    const cellSize = scaleToCellSize(gamescale.value);
    const x = Math.floor(clickEvent.offsetX / (cellSize + gridSize.value)) + canvasOffsetX.value;
    const y = Math.floor(clickEvent.offsetY / (cellSize + gridSize.value)) + canvasOffsetY.value;
    gameWorker.postMessage({
        event: 'toggle_cell',
        coords: [x, y]
    });
}

function gameLoop() {
    if (!isGameRunning.value && gameLoopTimeout !== null) {
        window.clearTimeout(gameLoopTimeout);
        return;
    }
    console.debug(`Buffer size: ${universeStatesBuffer.length}`);
    if (universeStatesBuffer.length > 0) {
        let changesToRender = universeStatesBuffer.shift();
        population.value += changesToRender.borningCells.length - changesToRender.dyingCells.length;
        renderingWorker.postMessage({
            event: 'render',
            changes: changesToRender
        });
    } else {
        // The buffer is empty, we have nothing to render. Waiting for the next tick...
        gameLoopTimeout = window.setTimeout(gameLoop, speedToTimeout(gamespeed.value));
    }
};

function toggleSettingsMode() {
    if (inEditMode.value) {
        inEditMode.value = false;
    }
    inSettingsMode.value = !inSettingsMode.value;
};

function toggleEditMode() {
    if (inSettingsMode.value) {
        inSettingsMode.value = false;
    }
    inEditMode.value = !inEditMode.value;
};

gameWorker.onerror = e => {
    console.error(e);
};

gameWorker.onmessage = (e) => {
    switch (e.data.event) {
        case 'init':
            isUniverseInitialized = true;
            population.value += e.data.changes.borningCells.length - e.data.changes.dyingCells.length;
            break;
        case 'tick':
            universeStatesBuffer.push(e.data.changes);
            birthsCount.value += e.data.changes.borningCells.length;
            deathsCount.value += e.data.changes.dyingCells.length;
            if (e.data.changes.dyingCells.length === 0 && e.data.changes.borningCells.length === 0) {
                console.log('Game over !')
                if (gameLoopTimeout !== null) {
                    window.clearTimeout(gameLoopTimeout);
                }
            } else if (universeStatesBuffer.length <= MAX_BUFFER_SIZE) {
                gameWorker.postMessage({
                    event: 'tick',
                });
            } else {
                isWorkerRunning.value = false;
            }
            break;
        case 'add_cells':
        case 'kill_cells':
        case 'toggle_cell':
            population.value += e.data.changes.borningCells.length - e.data.changes.dyingCells.length;
            renderingWorker.postMessage({
                event: 'render',
                changes: e.data.changes
            });
            break;
        default:
            break;
    }
}

renderingWorker.onerror = e => {
    console.error(e);
};

renderingWorker.onmessage = (e) => {
    switch (e.data.event) {
        case 'init':
            isCanvasInitialized = true;
            break;
        case 'render':
            // If the game worker has fullfilled the buffer, we have consumed it, so ask for the next tick
            if (!isWorkerRunning.value && isGameRunning.value) {
                isWorkerRunning.value = true;
                gameWorker.postMessage({
                    event: 'tick',
                });
            }
            universeAge.value += 1;
            gameLoopTimeout = window.setTimeout(gameLoop, speedToTimeout(gamespeed.value));
            break;
        default:
            break;
    }
}

onMounted(() => {
    if (!gameCanvas) {
        gameCanvas = document.getElementById('game-of-life-canvas') as HTMLCanvasElement;
    }
    gameCanvas.style.width = '100%';
    gameCanvas.style.height = '100%';
    (gameCanvas as HTMLCanvasElement).width = gameCanvas.offsetWidth;
    (gameCanvas as HTMLCanvasElement).height = gameCanvas.offsetHeight;
    const offscreen = gameCanvas.transferControlToOffscreen();
    canvasOffsetX.value = - Math.floor((gameCanvas as HTMLCanvasElement).width / 2 / (scaleToCellSize(gamescale.value) + gridSize.value));
    canvasOffsetY.value = - Math.floor((gameCanvas as HTMLCanvasElement).height / 2 / (scaleToCellSize(gamescale.value) + gridSize.value));
    initialState = getShapeCoords(GLIDER, canvasOffsetX.value + 50, canvasOffsetY.value + 50);
    gameWorker.postMessage({
        event: 'init',
        cells: initialState
    });
    renderingWorker.postMessage({
        event: 'init',
        options: {
            canvas: offscreen,
            width: (gameCanvas as HTMLCanvasElement).width,
            height: (gameCanvas as HTMLCanvasElement).height,
            cellSize: scaleToCellSize(gamescale.value),
            // Center the universe on the [0, 0] cell
            xOffset: canvasOffsetX.value,
            yOffset: canvasOffsetY.value,
            gridWidth: gridSize.value,
            gridColor: getGridColorFromTheme(),
            aliveCellColor: theme.global.name.value == 'dark'?'rgba(255, 255, 255, 1)':'rgba(0, 0, 0, 1)',
        },
        cells: initialState
    }, [ offscreen ]);
    // Handle dragging of canvas.
    // Used to navigate the universe.
    let drag = false;
    let dragStart: { x: any; y: any; };
    let dragEnd;
    gameCanvas.addEventListener('mousedown', function(event) {
        if (gameCanvas != null) {
            dragStart = {
                x: event.pageX - gameCanvas.offsetLeft,
                y: event.pageY - gameCanvas.offsetTop
            }
            drag = true;
        }
    });
    gameCanvas.addEventListener('mousemove', function(event) {
        if (drag && gameCanvas != null) {
            dragEnd = {
                x: event.pageX - gameCanvas.offsetLeft,
                y: event.pageY - gameCanvas.offsetTop
            }
            renderingWorker.postMessage({
                event: 'translate',
                coords: {
                    x: dragEnd.x - dragStart.x,
                    y: dragEnd.y - dragStart.y
                }
            });
        }
    });
    gameCanvas.addEventListener('mouseup', function(event) {
        drag = false;
    });
})

onUnmounted(() => {
    // Terminate workers on unmount
    renderingWorker.terminate();
    gameWorker.terminate();
})
</script>
<template>
    <v-toolbar density="compact">
        <v-toolbar-items>
            <v-tooltip location="top" :text="t('pages.game-of-life.actions.start.tooltip')">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" @click="startPauseGame" icon>
                        <v-icon>{{ isGameRunning ? 'mdi-pause': 'mdi-play' }}</v-icon>
                    </v-btn>
                </template>
            </v-tooltip>
            <v-tooltip location="top" :text="t('pages.game-of-life.actions.next_tick.tooltip')">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" @click="nextTick" icon="mdi-skip-next" :disabled="isGameRunning"></v-btn>
                </template>
            </v-tooltip>
            <v-tooltip location="top" :text="t('pages.game-of-life.actions.edit_board.tooltip')">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" @click="toggleEditMode" icon="mdi-pencil" :disabled="isGameRunning" :active="inEditMode"></v-btn>
                </template>
            </v-tooltip>
            <v-tooltip location="top" :text="t('pages.game-of-life.actions.settings.tooltip')">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" @click="toggleSettingsMode" icon="mdi-tune-vertical" :disabled="isGameRunning" :active="inSettingsMode"></v-btn>
                </template>
            </v-tooltip>
        </v-toolbar-items>
        <v-tooltip location="top" :text="t('pages.game-of-life.actions.adjustspeed.tooltip')">
            <template v-slot:activator="{ props }">
                <v-slider v-bind="props" v-model="gamespeed" min="0" max="7" step="1" prepend-icon="mdi-speedometer" class="mt-5"></v-slider>
            </template>
        </v-tooltip>
        <v-tooltip location="top" :text="t('pages.game-of-life.actions.adjustscale.tooltip')">
            <template v-slot:activator="{ props }">
                <v-slider v-bind="props" v-model="gamescale" min="0" max="8" step="1" prepend-icon="mdi-relative-scale" class="mt-5"></v-slider>
            </template>
        </v-tooltip>
        <v-spacer></v-spacer>
        <span class="me-2">
            <v-icon icon="mdi-baby-bottle"></v-icon> {{ n(birthsCount) }}
            <v-icon icon="mdi-coffin"></v-icon> {{ n(deathsCount) }}
            <v-icon icon="mdi-crowd"></v-icon> {{ n(population) }}
            <v-icon icon="mdi-counter"></v-icon> {{ n(universeAge) }}</span>
    </v-toolbar>
    <v-toolbar density="compact" :class="inEditMode || !inSettingsMode || isGameRunning?'d-none':''">
        <v-toolbar-items>
            <v-tooltip location="top" :text="t('pages.game-of-life.actions.clear.tooltip')">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" :icon="isGridShown?'mdi-grid-off':'mdi-grid'" @click="isGridShown = !isGridShown" :disabled="isGameRunning"></v-btn>
                </template>
            </v-tooltip>
        </v-toolbar-items>
    </v-toolbar>
    <v-toolbar density="compact" :class="!inEditMode || inSettingsMode || isGameRunning?'d-none':''">
        <v-toolbar-items>
            <v-tooltip location="top" :text="t('pages.game-of-life.actions.clear.tooltip')">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" icon="mdi-delete-empty-outline" @click="clearUniverse" :disabled="isGameRunning"></v-btn>
                </template>
            </v-tooltip>
            <v-tooltip location="top" :text="t('pages.game-of-life.actions.reset.tooltip')">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" icon="mdi-reload" @click="resetUniverse" :disabled="isGameRunning"></v-btn>
                </template>
            </v-tooltip>
            <v-tooltip location="top" :text="t('pages.game-of-life.actions.randomize.tooltip')">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" icon="mdi-dice-multiple" @click="randomizeUniverse" :disabled="isGameRunning"></v-btn>
                </template>
            </v-tooltip>
            <v-tooltip location="top" :text="t('pages.game-of-life.actions.download.tooltip')">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" icon="mdi-download" @click="randomizeUniverse" :disabled="isGameRunning"></v-btn>
                </template>
            </v-tooltip>
            <v-tooltip location="top" :text="t('pages.game-of-life.actions.upload.tooltip')">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" icon="mdi-upload" @click="randomizeUniverse" :disabled="isGameRunning"></v-btn>
                </template>
            </v-tooltip>
        </v-toolbar-items>
    </v-toolbar>
    <v-container class="fill-height">
        <canvas id="game-of-life-canvas" @click="toggleCell"></canvas>
    </v-container>
</template>