# LogicSim

LogicSim is a browser-based logic simulator. It runs as a single HTML file and is designed for building circuits from gates, pins, and custom chips.

## Run Locally
- Open `index.html` in a browser.
- An internet connection is required to load React, Tailwind, Lucide, and Firebase from CDNs.

## Run on GitHub Pages
- Commit `index.html` to the repository.
- Enable GitHub Pages for the repo and open the Pages URL.

## Editing Source vs. Standalone HTML
- `src/` contains the editable source.
- `index.html` contains a generated, standalone build.
- After editing anything in `src/`, regenerate `index.html`:

```bash
python3 scripts/regenerate_index.py
```

## Controls
### Mouse
- Left-click a node: select it.
- Shift + left-click nodes: toggle multi-selection.
- Drag nodes: move selection.
- Left-drag empty canvas: box select.
- Shift + drag (or middle mouse, or hold Space + drag): pan the canvas.
- Mouse wheel over canvas: pan.
- Shift + mouse wheel: zoom toward cursor.

### Wiring
- Drag from a port to another port: create a wire.
- Click a wire: split it and insert a joint.
- Drag from a joint: move it.
- Shift + drag from a joint: start a wire from the joint.
- Alt/Option while finishing a wire (drop on empty space): create a joint and keep wiring.

### Keyboard
- Delete / Backspace: delete selected nodes and connected wires.
- Esc: clear selection, cancel placement, close modals.
- Cmd/Ctrl + C: copy selection.
- Cmd/Ctrl + V: paste.
- Cmd/Ctrl + Z: undo.
- Cmd/Ctrl + Shift + Z (or Cmd/Ctrl + Y): redo.

## Import / Export
- Use the Export and Import buttons in the left sidebar to save and restore projects (`.json`).

## Notes
- Large designs can be heavy; performance depends on browser and hardware.
