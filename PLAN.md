# D3: {game title goes here}

## Game Design Vision

A location-based game that is a fusion of 2048 and Pokémon Go. Players collect and merge numeric tokens in real-world grid cells. Movement unlocks interactions. Victory by crafting a high-tier token (e.g., 16).

## Technologies

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

## Assignments

## D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Can you assemble a map-based user interface using the Leaflet mapping framework?
Key gameplay challenge: Can players collect and craft tokens from nearby locations to finally make one of sufficiently high value?

### D3.a Steps

- [x] copy main.ts → reference.ts
- [x] clear main.ts
- [x] create Leaflet map, center on classroom, lock zoom
- [x] draw grid (11×11) using rectangles
- [x] use `luck()` to spawn tokens (1 or 2) in cells — consistent across reloads
- [x] show token values visibly on cells (no popup needed)
- [x] track player’s held token (only one allowed)
- [x] allow click to: pick up token or merge matching ones
- [x] only allow interaction within 3 cells of player
- [x] show held token on screen (HUD)
- [x] (added step) if held tokens = null and cell = 1, pick up tokens in cell (held = 1)
      if held tokens = tokens in cell, pick up token and merge into held (1 + 1 = 2)
      if held tokens > tokens in cell, exchange tokens with cell (hels = 1, cell = 2)
- [x] fix the clicking hitbox
- [x] switched github pages to github actions this better actually push through successfully
- [x] win when player creates 16 (alert "You win!")

## D3.b: Globe-spanning gameplay

Key technical challenge: Can you set up your implementation to support gameplay anywhere in the real world, not just locations near our classroom?
Key gameplay challenge: Can players craft an even higher value token by moving to other locations to get access to additional crafting materials?

### D3.b Steps

- [x] Change grid origin from classroom to Null Island (0, 0)
- [x] Add 4 buttons (N/S/E/W) on screen to move the player by one grid cell
- [x] Player position is tracked as (i, j) — clicking a button updates it
- [x] When map stops moving, re-draw all visible cells (did not need moveend)
- [x] Each time a cell is re-drawn, re-roll its token using `luck()`
- [x] fixed the the bug where clicking the N button would make player go down and clicking S would make player go up
- [x] Increase win goal from `16` → `256` (update message too)
