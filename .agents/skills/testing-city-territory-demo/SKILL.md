# Testing city-territory Demo

## Overview
The city-territory demo is a Three.js-based grid map that displays resource tiles with emoji icons and score labels. It is deployed as a static site via GitHub Pages.

## Preview URL Pattern
PR preview deployments are available at:
```
https://towersxu.github.io/auto-game/{pr_number}/city-territory-demo.html
```

## Known Issues

### Three.js Canvas May Appear Blank on Initial Load
The Three.js canvas sometimes renders as a dark/blank area when the page first loads in a headless or automated browser environment. Opening DevTools (F12) and then closing it triggers a resize event that forces a re-render. This is a known quirk with Three.js in some browser contexts — it is not a bug in the application code.

**Workaround**: Press F12 to open DevTools, then F12 again to close. The grid should render after this.

## Key Verification Steps

1. **Grid renders**: All tiles should display with green background, grid lines visible
2. **Score labels**: Each tile shows a gold number (top-right) representing total resource score
3. **Resource icons**: Emoji icons displayed in the center of each tile:
   - 🌾 = Grain (2 pts)
   - 🌲 = Forest (3 pts)
   - 🪙 = Gold (5 pts)
   - 🏛 = Wonder (10 pts)
4. **Score variety**: Tiles should show a range of scores (2-10), not clustered at max
5. **Click interaction**: Clicking a tile shows resource details in the status bar at the top
6. **Territory expansion**: Clicking a tile adjacent to a city expands the city's territory (tile turns city color) and shows expansion message with resource info

## Build & Test Commands
```bash
# Run all tests
pnpm test

# Build city-territory package
pnpm --filter @auto-game/city-territory build

# Build pages (includes demo)
pnpm --filter @auto-game/pages build

# Note: build dependencies in order — logic first, then ui-component, then pages
```

## No Secrets Needed
The demo is a static site with no authentication required.
