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

### Steps

- [x] copy main.ts → reference.ts
- [x] clear main.ts
- [x] create Leaflet map, center on classroom, lock zoom
- [x] draw grid (11×11) using rectangles
- [x] use `luck()` to spawn tokens (1 or 2) in cells — consistent across reloads
- [ ] show token values visibly on cells (no popup needed)
- [ ] track player’s held token (only one allowed)
- [ ] allow click to: pick up token or merge matching ones
- [ ] only allow interaction within 3 cells of player
- [ ] show held token on screen (HUD)
- [ ] win when player creates 16 (alert "You win!")
