#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

COMPONENT_ORDER = [
    'src/components/TailwindInjector.jsx',
    'src/components/GateRenderer.jsx',
    'src/components/WrapText.jsx',
    'src/components/Mini7Seg.jsx',
    'src/components/MiniGridDisplay.jsx',
    'src/components/ChipFace.jsx',
]

SHIM_CODE = r'''
const React = window.React;
const { useState, useEffect, useRef, useCallback, useMemo } = React || {};

const lucide = window.lucideReact || window.LucideReact || {};
const { 
  Trash2, Plus, Save, Cpu, X, MousePointer2, Disc, Folder, 
  FolderOpen, ChevronDown, ChevronRight, GripVertical, CheckCircle, 
  AlertCircle, FolderPlus, ArrowDownAZ, List, Cloud, Download, 
  Upload, CloudOff, Pencil, Edit3, Undo2, Copy, Clipboard, Play, Square, Eye, EyeOff,
  Redo2, PanelLeftClose, PanelLeftOpen, Menu, Maximize
} = lucide;

const initializeApp = (config) => window.firebase?.initializeApp(config);
const getAuth = (app) => window.firebase?.auth(app);
const signInWithCustomToken = (auth, token) => auth.signInWithCustomToken(token);
const signInAnonymously = (auth) => auth.signInAnonymously();
const onAuthStateChanged = (auth, cb) => auth.onAuthStateChanged(cb);
const getFirestore = (app) => window.firebase?.firestore(app);
const doc = (db, ...path) => db.doc(path.join('/'));
const setDoc = (ref, data) => ref.set(data);
const onSnapshot = (ref, cb) => ref.onSnapshot(cb);
'''

MAIN_CODE = '''
const root = document.getElementById('root');
if (root) {
  if (window.ReactDOM && typeof window.ReactDOM.createRoot === 'function') {
    window.ReactDOM.createRoot(root).render(<App />);
  } else if (window.ReactDOM && typeof window.ReactDOM.render === 'function') {
    window.ReactDOM.render(<App />, root);
  } else {
    root.textContent = 'ReactDOM not available.';
  }
}
'''


def strip_imports_exports(text: str) -> str:
    lines = text.splitlines()
    filtered = []
    skip_import = False
    for line in lines:
        if skip_import:
            if ';' in line:
                skip_import = False
            continue
        if line.startswith('import '):
            if ';' in line:
                continue
            skip_import = True
            continue
        if line.startswith('export default '):
            line = line.replace('export default ', '')
        if line.startswith('export '):
            line = line.replace('export ', '')
        filtered.append(line)
    return '\n'.join(filtered)


def read_text(rel_path: str) -> str:
    return (ROOT / rel_path).read_text()


def build_index_html() -> str:
    component_blocks = [strip_imports_exports(read_text(p)) for p in COMPONENT_ORDER]
    app_code = strip_imports_exports(read_text('src/App.jsx'))
    components_joined = '\n\n'.join(component_blocks)

    return f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LogicSim</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script>window.react = window.React;</script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/lucide-react@latest/dist/umd/lucide-react.min.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.2/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.2/firebase-auth-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore-compat.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script type="text/babel" data-presets="react">
{SHIM_CODE}

{components_joined}

{app_code}

{MAIN_CODE}
    </script>
  </body>
</html>
'''


def main() -> None:
    output = build_index_html()
    (ROOT / 'index.html').write_text(output)
    print('Regenerated index.html')


if __name__ == '__main__':
    main()
