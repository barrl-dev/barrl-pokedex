# barrl-pokedex

Family Pokémon TCG collection tracker. Static single-page app — no build step, no backend.

Loads each kid's collection from `kids/<name>.json`, fetches sprites / types / evolution chains live from [PokéAPI](https://pokeapi.co/), and renders three views:

- **Per-kid collection** — cards grouped by Pokémon, with playable evolutions highlighted in green
- **Compare** — what both kids have, what each has uniquely, and cross-evolution trade ideas
- **Full Pokédex** — all 1025 species with per-kid ownership badges

## Running locally

Any static file server works. From the project root:

```bash
python -m http.server 8000
```

Then open http://localhost:8000. Other devices on the same Wi-Fi can use `http://<your-ip>:8000`.

## Adding a new kid

1. Drop their card photos into a new subfolder: `SourceImages/<name>/`.
2. Create `kids/<name>.json` (copy `kids/jameson.json` as a template).
3. Open `index.html` and update the kid registry near the top of the script:

   ```js
   const KIDS = ["jameson", "harper", "<name>"];
   const KID_LABEL = { jameson: "Jameson", harper: "Harper", <name>: "<Display Name>" };
   ```

4. Add a tab button in the `.kid-picker` markup and a CSS color variable if you want a unique theme color.

## Card data format

`kids/<name>.json` is a flat list — one entry per physical card. Duplicates are separate entries.

```json
{
  "owner": "Jameson",
  "title": "Jameson's Pokémon Collection",
  "color": "#3d7dca",
  "cards": [
    { "name": "bulbasaur", "display": "Bulbasaur", "src": "jameson/PXL_20260430_205536313.jpg" }
  ]
}
```

### Pokémon card fields

| Field | Required | Notes |
|---|---|---|
| `name` | yes | lowercase PokéAPI name (e.g. `tapu-koko`, `mr-mime`, `weezing`) |
| `display` | yes | how it shows in the UI |
| `src` | recommended | photo path under `SourceImages/`, used by the 📷 source link |
| `duplicate` | optional | `true` flags a 2nd-or-later copy |
| `rarity` | optional | shown under the name (e.g. `"V"`, `"ex"`) |
| `variant` | optional | short note like `"Galarian"` or `"Team Rocket's"` |
| `note` | optional | freeform note shown in the modal |
| `uncertain` | optional | `true` puts a red "verify?" corner badge on the card |

### Non-Pokémon cards (energy, items, trainers)

```json
{ "kind": "energy",  "display": "Fighting Energy", "category": "fighting", "src": "..." }
{ "kind": "item",    "display": "Quick Ball",      "src": "..." }
{ "kind": "trainer", "display": "Iono",            "src": "..." }
```

These render with a generic icon (⚡ / 🎒 / 👤) instead of a sprite, skip the PokéAPI fetch, and live behind the **Trainers/Energy** filter.

## Project layout

```
index.html            — single-file app
kids/<name>.json      — one file per kid
SourceImages/<name>/  — original card photos
```

PokéAPI responses and the species list are cached in `localStorage` so reloads are instant. Bump the cache key constants in `index.html` if you ever need to invalidate.
