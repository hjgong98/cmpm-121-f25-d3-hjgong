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

// Game state
const cellContents = new Map<string, number>();
let heldToken: number | null = null;
const playerPos = { i: 0, j: 0 };

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

// Update HUD to show position too
function updateHud() {
  const pos = `(${playerPos.i}, ${playerPos.j})`;
  hud.textContent = heldToken
    ? `Holding: ${heldToken} | Pos: ${pos}`
    : `Holding: — | Pos: ${pos}`;
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
          }
        } else if (cellValue !== undefined) {
          if (heldToken === cellValue) {
            const newValue = heldToken * 2;
            heldToken = newValue;
            cellContents.delete(key);
            updateHud();
            refreshCell(i, j);
            if (newValue === 256) {
              alert("Congrats on getting 256 points! 🎉 You win! 🎉");
            }
          } else {
            cellContents.set(key, heldToken);
            heldToken = cellValue;
            updateHud();
            refreshCell(i, j);
          }
        }
      });

      refreshCell(i, j);
    }
  }
}

// move north
document.getElementById("btn-n")!.addEventListener("click", () => {
  playerPos.i++;
  const center = gridToLatLngBounds(playerPos.i, playerPos.j).getCenter();
  map.panTo(center);
  redrawGrid();
  updateHud();
});

// move south
document.getElementById("btn-s")!.addEventListener("click", () => {
  playerPos.i--;
  const center = gridToLatLngBounds(playerPos.i, playerPos.j).getCenter();
  map.panTo(center);
  redrawGrid();
  updateHud();
});

// move west
document.getElementById("btn-w")!.addEventListener("click", () => {
  playerPos.j--;
  const center = gridToLatLngBounds(playerPos.i, playerPos.j).getCenter();
  map.panTo(center);
  redrawGrid();
  updateHud();
});

// move east
document.getElementById("btn-e")!.addEventListener("click", () => {
  playerPos.j++;
  const center = gridToLatLngBounds(playerPos.i, playerPos.j).getCenter();
  map.panTo(center);
  redrawGrid();
  updateHud();
});

// === Save & Load Game State ===

// Memento: object that stores saved game state
interface SavedGameState {
  playerPos: { i: number; j: number };
  heldToken: number | null;
  cellContents: Record<string, number>;
}

// Originator: creates and restores mementos
function saveState(): SavedGameState {
  return {
    playerPos: { i: playerPos.i, j: playerPos.j },
    heldToken,
    cellContents: Object.fromEntries(cellContents) as Record<string, number>,
  };
}

// Originator: restores state from memento
function loadState(saved: SavedGameState) {
  if (!saved) return;

  // Restore player position
  if (
    typeof saved.playerPos.i === "number" &&
    typeof saved.playerPos.j === "number"
  ) {
    playerPos.i = saved.playerPos.i;
    playerPos.j = saved.playerPos.j;
  }

  // Restore held token
  if (saved.heldToken === null || typeof saved.heldToken === "number") {
    heldToken = saved.heldToken;
  }

  // Restore cell contents
  if (saved.cellContents && typeof saved.cellContents === "object") {
    cellContents.clear();
    Object.entries(saved.cellContents).forEach(([key, value]) => {
      if (typeof value === "number") {
        cellContents.set(key, value);
      }
    });
  }

  redrawGrid();
  updateHud();
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

// Caretaker: manages saved memento
// not going to do local storage - too much hassle
let savedGame: SavedGameState | null = null;

document.getElementById("btn-save")!.addEventListener("click", () => {
  savedGame = saveState();
  alert("Game saved! 🎮 Got your back, traveler.");
});

document.getElementById("btn-load")!.addEventListener("click", () => {
  // Caretaker: load memento
  if (savedGame) {
    loadState(savedGame);
    alert("Game loaded! 🔁 Back in action!");
  } else {
    alert("No save data found. 😢 Try saving first!");
  }
});

// Initial setup
redrawGrid();
updateHud();
