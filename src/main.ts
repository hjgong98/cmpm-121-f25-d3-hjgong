// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Styles
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";

// Set up the map
const mapDiv = document.createElement("div");
mapDiv.id = "map";
mapDiv.style.width = "100vw";
mapDiv.style.height = "100vh";
document.body.appendChild(mapDiv);

// Fixed classroom location
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Create the map
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
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
  const north = CLASSROOM_LATLNG.lat + i * TILE_DEGREES;
  const south = north + TILE_DEGREES;
  const west = CLASSROOM_LATLNG.lng + j * TILE_DEGREES;
  const east = west + TILE_DEGREES;
  return leaflet.latLngBounds([
    [north, west],
    [south, east],
  ]);
}

// draw a grid
for (let i = -GRID_SIZE; i <= GRID_SIZE; i++) {
  for (let j = -GRID_SIZE; j <= GRID_SIZE; j++) {
    const bounds = gridToLatLngBounds(i, j);

    // Create a rectangle for each cell
    leaflet.rectangle(bounds, {
      color: "#555",
      weight: 1,
      fillColor: "#ffeb3b",
      fillOpacity: 0.1,
    }).addTo(map);

    leaflet.marker(bounds.getCenter(), {
      icon: leaflet.divIcon({
        html:
          `<span style="font: 10px monospace; color: #666;">${i},${j}</span>`,
        className: "grid-label",
        iconSize: [30, 20],
      }),
    }).addTo(map);
  }
}
