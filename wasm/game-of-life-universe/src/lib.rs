use wasm_bindgen::prelude::*;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

mod utils;

type CellCoordinates = (isize, isize);

struct Cell {
    age: usize,
    neighbors: [CellCoordinates; 8],
}

fn get_cell_neighbors(cell: &CellCoordinates) -> [CellCoordinates; 8] {
    let x = cell.0;
    let y = cell.1;
    let prev_x = x.wrapping_sub(1);
    let next_x = x.wrapping_add(1);
    let prev_y = y.wrapping_sub(1);
    let next_y = y.wrapping_add(1);
    [
        (prev_x, prev_y), (x, prev_y), (next_x, prev_y),
        (prev_x, y),                   (next_x, y),
        (prev_x, next_y), (x, next_y), (next_x, next_y)
    ]
}

impl Cell {
    fn new(x: isize, y: isize) -> Self {
        Cell {
            age: 0,
            neighbors: get_cell_neighbors(&(x, y)),
        }
    }

    fn increment_age(&mut self) {
        self.age += 1;
    }
}

struct Universe {
    alive_cells: HashMap<CellCoordinates, Cell>,
    age: usize,
}

impl Universe {
    pub fn new() -> Self {
        Universe {
            age: 0,
            alive_cells: HashMap::new(),
        }
    }

    pub fn reset(&mut self) {
        self.age = 0;
        self.alive_cells.clear();
    }

    pub fn add_cell(&mut self, x: isize, y: isize) {
        self.alive_cells.insert((x, y), Cell::new(x, y));
    }

    pub fn kill_cell(&mut self, x: isize, y: isize) {
        self.alive_cells.remove(&(x, y));
    }
}

static UNIVERSE: LazyLock<Mutex<Universe>> = LazyLock::new(|| Mutex::new(Universe::new()));

#[wasm_bindgen]
pub fn init() {
    utils::set_panic_hook();
    UNIVERSE.lock().unwrap().reset();
}

#[wasm_bindgen]
pub fn tick() {
    // This function will be called to advance the universe by one tick.
    // For now, it does nothing.
    // In the future, it will update the state of the universe.
}

#[wasm_bindgen]
pub fn kill_cells(cells: &JsValue) -> Result<js_sys::Array, JsValue> {
    // This function will be called to kill a cell at the given coordinates.
    // For now, it does nothing.
    // In the future, it will remove the cell from the universe.
    let nums = js_sys::Array::new();
    let iterator = js_sys::try_iter(cells)?.ok_or_else(|| {
        "need to pass iterable JS values!"
    })?;

    let mut universe = UNIVERSE.lock().unwrap();
    for x in iterator {
        // If the iterator's `next` method throws an error, propagate it
        // up to the caller.
        let x = x?;

        // If `x` is a number, add it to our array of numbers!
        if x.as_f64().is_some() {
            nums.push(&x);
            universe.kill_cell(0, 0);
        }
    }
    Ok(nums)
}

#[wasm_bindgen]
pub fn make_alive(cells: &JsValue) {
    // This function will be called to make a cell alive at the given coordinates.
    // For now, it does nothing.
    // In the future, it will add the cell to the universe.
}

#[wasm_bindgen]
pub fn toogle(cell: &JsValue) {
}

#[wasm_bindgen]
pub fn clear() {
    // This function will be called to clear the universe.
    // For now, it does nothing.
    // In the future, it will remove all cells from the universe.
}