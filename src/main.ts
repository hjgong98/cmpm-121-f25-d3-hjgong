// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

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

// grid config
const TILE_DEGREES = 1e-4;
const GRID_SIZE = 5;

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

// game state
const cellContents = new Map<string, number>();
let heldToken: number | null = null;
const playerPos = { i: 0, j: 0 };

// players held token (HUD)
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

// update HUD display
function updateHud() {
  hud.textContent = heldToken ? `Holding: ${heldToken}` : "Holding: —";
}
updateHud();

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

// store markers allow to refresh
const cellMarkers = new Map<string, leaflet.Marker>();

function refreshCell(i: number, j: number) {
  const key = `${i},${j}`;
  const bounds = gridToLatLngBounds(i, j);
  const value = cellContents.get(key);

  // remove old marker if exists
  const existingMarker = cellMarkers.get(key);
  if (existingMarker) map.removeLayer(existingMarker);

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

// draw a grid
for (let i = -GRID_SIZE; i <= GRID_SIZE; i++) {
  for (let j = -GRID_SIZE; j <= GRID_SIZE; j++) {
    const bounds = gridToLatLngBounds(i, j);
    const key = `${i},${j}`;

    // use luck() to decide if this cell has a token
    const spawnRoll = luck(key);
    if (spawnRoll < 0.5) {
      const valueRoll = luck(key + "value");
      const value = valueRoll < 0.7 ? 1 : 2;
      cellContents.set(key, value);
    }

    // draw rectangle
    const rect = leaflet.rectangle(bounds, {
      color: "#555",
      weight: 1,
      fillColor: "#ffeb3b",
      fillOpacity: 0.1,
      interactive: true,
    }).addTo(map);

    // initialize label
    refreshCell(i, j);

    // click handler
    rect.on("click", () => {
      // debug
      console.log("Clicked cell:", i, j);

      const distI = Math.abs(i - playerPos.i);
      const distJ = Math.abs(j - playerPos.j);
      if (distI > 3 || distJ > 3) {
        alert("Too far! Must be within 3 cells. 🚶‍♂️❌");
        return;
      }

      playerPos.i = i;
      playerPos.j = j;

      const cellValue = cellContents.get(key);

      if (heldToken === null) {
        // Pick up if empty-handed
        if (cellValue !== undefined) {
          heldToken = cellValue;
          cellContents.delete(key);
          updateHud();
          refreshCell(i, j);
        }
      } else if (cellValue !== undefined) {
        // Either merge or swap
        if (heldToken === cellValue) {
          // MERGE: 2+2 → 4 (you hold the 4)
          const newValue = heldToken * 2;
          heldToken = newValue;
          cellContents.delete(key);
          updateHud();
          refreshCell(i, j);
          if (newValue === 16) {
            alert("You win!");
          }
        } else {
          // SWAP: trade tokens
          cellContents.set(key, heldToken); // put your token in cell
          heldToken = cellValue; // take theirs
          updateHud();
          refreshCell(i, j); // update label
        }
      }
    });
  }
}
