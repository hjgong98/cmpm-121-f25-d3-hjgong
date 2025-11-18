// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
const visitedCells = new Set<string>();

// Styles
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";

// Set up the map
const mapDiv = document.createElement("div");
mapDiv.id = "map";
mapDiv.style.width = "100vw";
mapDiv.style.height = "100vh";
document.body.appendChild(mapDiv);

// === Facade Pattern: Movement Controller Interface ===
interface MovementController {
  start(): void;
  stop(): void;
  getMode(): string;
}

// === Button Movement Controller (Facade Implementation) ===
class ButtonMovementController implements MovementController {
  private isActive: boolean = false;

  start(): void {
    if (this.isActive) return;
    this.isActive = true;
    console.log("Button movement controller started");

    // Attach button event listeners
    this.attachButtonListeners();
  }

  stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    console.log("Button movement controller stopped");

    // Remove button event listeners by cloning elements
    this.detachButtonListeners();
  }

  getMode(): string {
    return "🎮 Buttons";
  }

  private attachButtonListeners(): void {
    document.getElementById("btn-n")!.addEventListener("click", this.moveNorth);
    document.getElementById("btn-s")!.addEventListener("click", this.moveSouth);
    document.getElementById("btn-w")!.addEventListener("click", this.moveWest);
    document.getElementById("btn-e")!.addEventListener("click", this.moveEast);
  }

  private detachButtonListeners(): void {
    // Clone buttons to remove all event listeners
    const buttons = ["btn-n", "btn-s", "btn-w", "btn-e"];
    buttons.forEach((btnId) => {
      const btn = document.getElementById(btnId)!;
      btn.replaceWith(btn.cloneNode(true));
    });
  }

  private moveNorth = (): void => {
    playerPos.i++;
    this.updateGameAfterMove();
  };

  private moveSouth = (): void => {
    playerPos.i--;
    this.updateGameAfterMove();
  };

  private moveWest = (): void => {
    playerPos.j--;
    this.updateGameAfterMove();
  };

  private moveEast = (): void => {
    playerPos.j++;
    this.updateGameAfterMove();
  };

  private updateGameAfterMove(): void {
    const center = gridToLatLngBounds(playerPos.i, playerPos.j).getCenter();
    map.panTo(center);
    redrawGrid();
    updateHud();
    autoSave();
  }
}

// Geolocation Movement Controller (Facade Implementation)
class GeolocationMovementController implements MovementController {
  private isActive: boolean = false;
  private watchId: number | null = null;
  private lastGridPos: { i: number; j: number } | null = null;
  private readonly MOVEMENT_THRESHOLD = 0.00002;

  start(): void {
    if (this.isActive) return;

    if (!navigator.geolocation) {
      alert(
        "Geolocation is not supported by this browser. Falling back to button controls.",
      );
      switchToButtonMovement();
      return;
    }

    this.isActive = true;
    console.log("Geolocation movement controller started");

    // Request permission and start watching position
    this.watchId = navigator.geolocation.watchPosition(
      this.handlePositionUpdate.bind(this),
      this.handlePositionError.bind(this),
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 27000,
      },
    );
  }

  stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    console.log("Geolocation movement controller stopped");
    this.lastGridPos = null;
  }

  getMode(): string {
    return "📍 GPS";
  }

  private handlePositionUpdate(position: GeolocationPosition): void {
    const { latitude, longitude } = position.coords;
    console.log(`GPS Update: lat=${latitude}, lng=${longitude}`);

    // Convert real-world coordinates to grid coordinates
    const gridPos = this.latLngToGrid(latitude, longitude);

    // Check if movement exceeds threshold to prevent jitter
    if (this.shouldUpdatePosition(gridPos)) {
      this.lastGridPos = gridPos;
      this.updatePlayerPosition(gridPos);
    }
  }
  private handlePositionError(error: GeolocationPositionError): void {
    console.error("Geolocation error:", error);

    let errorMessage = "Geolocation error: ";
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage +=
          "Location access denied. Falling back to button controls.";
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage +=
          "Location information unavailable. Falling back to button controls.";
        break;
      case error.TIMEOUT:
        errorMessage +=
          "Location request timed out. Falling back to button controls.";
        break;
      default:
        errorMessage += "Unknown error. Falling back to button controls.";
        break;
    }
    alert(errorMessage);
    switchToButtonMovement();
  }
  private latLngToGrid(lat: number, lng: number): { i: number; j: number } {
    // Convert latitude/longitude to grid coordinates
    // Null Island (0,0) (origin point)
    // Each grid cell is TILE_DEGREES (1e-4) in size
    const i = Math.floor(lat / TILE_DEGREES);
    const j = Math.floor(lng / TILE_DEGREES);
    console.log(`Converted: lat=${lat}, lng=${lng} -> grid=(${i}, ${j})`);
    return { i, j };
  }
  private shouldUpdatePosition(newGridPos: { i: number; j: number }): boolean {
    // If no previous position, always update
    if (!this.lastGridPos) return true;
    // Calculate distance from last position
    const deltaI = Math.abs(newGridPos.i - this.lastGridPos.i);
    const deltaJ = Math.abs(newGridPos.j - this.lastGridPos.j);
    // Only update if movement exceeds threshold (prevents jitter)
    const shouldUpdate = deltaI >= 1 || deltaJ >= 1;
    if (shouldUpdate) {
      console.log(
        `Movement detected: (${this.lastGridPos.i},${this.lastGridPos.j}) -> (${newGridPos.i},${newGridPos.j})`,
      );
    }
    return shouldUpdate;
  }

  private updatePlayerPosition(gridPos: { i: number; j: number }): void {
    // Update player position
    playerPos.i = gridPos.i;
    playerPos.j = gridPos.j;

    // Update game state
    const center = gridToLatLngBounds(playerPos.i, playerPos.j).getCenter();
    map.panTo(center);
    redrawGrid();
    updateHud();
    autoSave();
    console.log(`Player moved to: (${playerPos.i}, ${playerPos.j})`);
  }
}

// Game state
const cellContents = new Map<string, number>();
let heldToken: number | null = null;
const playerPos = { i: 0, j: 0 };
let currentMovementController: MovementController | null = null;

// Start map at Null Island (0, 0)
const NULL_ISLAND = leaflet.latLng(0, 0);
const map = leaflet.map(mapDiv, {
  center: NULL_ISLAND,
  zoom: 19,
  minZoom: 19,
  maxZoom: 19,
  zoomControl: false,
  scrollWheelZoom: false,
  doubleClickZoom: false,
  boxZoom: false,
  keyboard: false,
});

// Add tile layer (street map background)
leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap",
}).addTo(map);

// Grid config
const TILE_DEGREES = 1e-4;
const GRID_SIZE = 5;

// Layer group to manage grid cells
const gridLayerGroup = leaflet.layerGroup().addTo(map);

function gridToLatLngBounds(i: number, j: number) {
  const originLat = 0;
  const originLng = 0;
  const north = originLat + i * TILE_DEGREES;
  const south = north + TILE_DEGREES;
  const west = originLng + j * TILE_DEGREES;
  const east = west + TILE_DEGREES;

  return leaflet.latLngBounds([
    [north, west],
    [south, east],
  ]);
}

// Initialize movement control
function initializeMovementController() {
  // Check URL parameters first
  const urlParams = new URLSearchParams(globalThis.location.search);
  const movementParam = urlParams.get("movement");

  if (movementParam === "geolocation") {
    switchToGeolocationMovement();
  } else {
    switchToButtonMovement();
  }
}

function switchToGeolocationMovement() {
  console.log("Switching to geolocation movement");
  // Stop current controller if exists
  if (currentMovementController) {
    currentMovementController.stop();
  }

  // Create and start geolocation controller
  currentMovementController = new GeolocationMovementController();
  currentMovementController.start();
  updateHud();
}

function switchToButtonMovement() {
  console.log("Switching to button movement");

  // Stop current controller if exists
  if (currentMovementController) {
    currentMovementController.stop();
  }

  // Create and start button controller
  currentMovementController = new ButtonMovementController();
  currentMovementController.start();
  updateHud();
}

// Players held token (HUD)
const hud = document.createElement("div");
hud.id = "hud";
hud.style.position = "fixed";
hud.style.bottom = "20px";
hud.style.left = "20px";
hud.style.background = "black";
hud.style.color = "white";
hud.style.padding = "12px 16px";
hud.style.borderRadius = "8px";
hud.style.font = "bold 14px sans-serif";
hud.style.zIndex = "1000";
hud.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
document.body.appendChild(hud);

// Create directional buttons: N, W, E, S
const buttonDiv = document.createElement("div");
buttonDiv.innerHTML = `
  <button id="btn-n" style="font-size:20px;width:40px;height:40px;">N</button><br>
  <button id="btn-w" style="font-size:20px;width:40px;height:40px;">W</button>
  <button id="btn-e" style="font-size:20px;width:40px;height:40px;">E</button><br>
  <button id="btn-s" style="font-size:20px;width:40px;height:40px;">S</button>
`;
buttonDiv.style.position = "fixed";
buttonDiv.style.top = "20px";
buttonDiv.style.left = "20px";
buttonDiv.style.zIndex = "1000";
buttonDiv.style.textAlign = "center";
document.body.appendChild(buttonDiv);

// Create movement mode toggle button - MOVED TO TOP RIGHT
const modeToggleDiv = document.createElement("div");
modeToggleDiv.innerHTML = `
  <button id="btn-mode-toggle" style="font-size:14px;margin:4px;background:#4CAF50;color:white;border:none;padding:8px 12px;border-radius:4px;">
    Switch to GPS
  </button>
`;

modeToggleDiv.style.position = "fixed";
modeToggleDiv.style.top = "20px";
modeToggleDiv.style.right = "20px";
modeToggleDiv.style.zIndex = "1000";
document.body.appendChild(modeToggleDiv);

// Movement mode toggle handler
document.getElementById("btn-mode-toggle")!.addEventListener("click", () => {
  const currentMode = currentMovementController?.getMode();
  if (currentMode === "🎮 Buttons") {
    switchToGeolocationMovement();
    (document.getElementById("btn-mode-toggle") as HTMLButtonElement)
      .textContent = "Switch to Buttons";
  } else {
    switchToButtonMovement();
    (document.getElementById("btn-mode-toggle") as HTMLButtonElement)
      .textContent = "Switch to GPS";
  }
});

// Update HUD to show position too
function updateHud() {
  const pos = `(${playerPos.i}, ${playerPos.j})`;
  const mode = currentMovementController
    ? currentMovementController.getMode()
    : "Buttons";
  let status = "";
  if (mode === "📍 GPS") {
    status = " | GPS: Active";
  }
  hud.textContent = heldToken
    ? `Holding: ${heldToken} | Pos: ${pos} | Mode: ${mode}${status}`
    : `Holding: — | Pos: ${pos} | Mode: ${mode}${status}`;
}

// Store markers to refresh
const cellMarkers = new Map<string, leaflet.Marker>();

// flyweight pattern: cell rendering optimization
// intrinsic: rendering logic/style is shared across all cells
// intrinsic: cell position (i,j) and value are pssed in during rendering
function refreshCell(i: number, j: number) {
  const key = `${i},${j}`;
  const bounds = gridToLatLngBounds(i, j);
  const value = cellContents.get(key);

  const existingMarker = cellMarkers.get(key);
  if (existingMarker) map.removeLayer(existingMarker);

  // flyweight: shared rendering logic
  const icon = leaflet.divIcon({
    html: `<span style="
      font: 12px monospace;
      color: ${value !== undefined ? "white" : "#666"};
      font-weight: ${value !== undefined ? "bold" : "normal"};
      background: ${value !== undefined ? "#f44336" : "transparent"};
      padding: ${value !== undefined ? "2px 4px" : "0"};
      border-radius: 4px;
    ">${value ?? `${i},${j}`}</span>`,
    className: "cell-label",
    iconSize: [30, 20],
  });

  const marker = leaflet.marker(bounds.getCenter(), { icon }).addTo(map);
  cellMarkers.set(key, marker);
}

// Redraw the grid centered on player position
function redrawGrid() {
  gridLayerGroup.clearLayers();
  cellMarkers.forEach((marker) => map.removeLayer(marker));
  cellMarkers.clear();

  const centerI = playerPos.i;
  const centerJ = playerPos.j;

  for (let i = centerI - GRID_SIZE; i <= centerI + GRID_SIZE; i++) {
    for (let j = centerJ - GRID_SIZE; j <= centerJ + GRID_SIZE; j++) {
      const bounds = gridToLatLngBounds(i, j);
      const key = `${i},${j}`;

      if (!visitedCells.has(key)) {
        visitedCells.add(key);
        const spawnRoll = luck(key);
        if (spawnRoll < 0.5) {
          const valueRoll = luck(key + "value");
          const value = valueRoll < 0.7 ? 1 : 2;
          cellContents.set(key, value);
        }
      }

      const rect = leaflet.rectangle(bounds, {
        color: "#555",
        weight: 1,
        fillColor: "#ffeb3b",
        fillOpacity: 0.1,
        interactive: true,
      }).addTo(gridLayerGroup);

      // try to interact with tokens
      rect.on("click", () => {
        const distI = Math.abs(i - playerPos.i);
        const distJ = Math.abs(j - playerPos.j);
        if (distI > 3 || distJ > 3) {
          alert("Too far! Must be within 3 cells. 🚶‍♂️❌");
          return;
        }

        const cellValue = cellContents.get(key);
        if (heldToken === null) {
          if (cellValue !== undefined) {
            heldToken = cellValue;
            cellContents.delete(key);
            updateHud();
            refreshCell(i, j);
            autoSave();
          }
        } else if (cellValue !== undefined) {
          if (heldToken === cellValue) {
            const newValue = heldToken * 2;
            heldToken = newValue;
            cellContents.delete(key);
            updateHud();
            refreshCell(i, j);
            autoSave();
            if (newValue === 256) {
              alert("Congrats on getting 256 points! 🎉 You win! 🎉");
            }
          } else {
            cellContents.set(key, heldToken);
            heldToken = cellValue;
            updateHud();
            refreshCell(i, j);
            autoSave();
          }
        }
      });

      refreshCell(i, j);
    }
  }
}

// === Save & Load Game State ===

// Memento: object that stores saved game state
interface SavedGameState {
  playerPos: { i: number; j: number };
  heldToken: number | null;
  cellContents: Record<string, number>;
}
// === localStorage Persistence ===
const STORAGE_KEY = "coinCollectorGameState";

// saveState uses localStorage
function saveState(): void {
  const gameState: SavedGameState = {
    playerPos: { i: playerPos.i, j: playerPos.j },
    heldToken,
    cellContents: Object.fromEntries(cellContents),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    console.log("Game state saved to localStorage");
  } catch (error) {
    console.error("Failed to save game state:", error);
    alert("Failed to save game. Storage might be full.");
  }
}

// loadState uses localStorage
function loadState(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      console.log("No saved game found");
      return;
    }

    const gameState: SavedGameState = JSON.parse(saved);

    // Restore player position
    if (
      gameState.playerPos && typeof gameState.playerPos.i === "number" &&
      typeof gameState.playerPos.j === "number"
    ) {
      playerPos.i = gameState.playerPos.i;
      playerPos.j = gameState.playerPos.j;
    }

    // Restore held token
    heldToken = gameState.heldToken;

    // Restore cell contents
    cellContents.clear();
    if (gameState.cellContents) {
      Object.entries(gameState.cellContents).forEach(([key, value]) => {
        if (typeof value === "number") {
          cellContents.set(key, value);
        }
      });
    }

    // Also restore visited cells for consistency
    visitedCells.clear();
    Array.from(cellContents.keys()).forEach((key) => visitedCells.add(key));

    redrawGrid();
    updateHud();

    const center = gridToLatLngBounds(playerPos.i, playerPos.j).getCenter();
    map.panTo(center);

    console.log("Game state loaded from localStorage");
  } catch (error) {
    console.error("Failed to load game state:", error);
    alert("Failed to load saved game. Data might be corrupted.");
  }
}

// Auto-save function to call after any game state change
function autoSave(): void {
  saveState();
}

// Create Save and Load buttons
const saveLoadDiv = document.createElement("div");
saveLoadDiv.innerHTML = `
  <button id="btn-save" style="font-size:14px;margin:4px;">💾 Save</button>
  <button id="btn-load" style="font-size:14px;margin:4px;">📂 Load</button>
`;
saveLoadDiv.style.position = "fixed";
saveLoadDiv.style.bottom = "20px";
saveLoadDiv.style.right = "20px";
saveLoadDiv.style.zIndex = "1000";
document.body.appendChild(saveLoadDiv);

document.getElementById("btn-save")!.addEventListener("click", () => {
  saveState();
});

document.getElementById("btn-load")!.addEventListener("click", () => {
  loadState();
});

initializeMovementController();

// Initial setup
loadState();
redrawGrid();
updateHud();
