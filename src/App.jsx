import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Trash2, Plus, Save, Cpu, X, MousePointer2, Disc, Folder, 
  FolderOpen, ChevronDown, ChevronRight, GripVertical, CheckCircle, 
  AlertCircle, FolderPlus, ArrowDownAZ, List, Cloud, Download, 
  Upload, CloudOff, Pencil, Edit3, Undo2, Copy, Clipboard, Play, Square, Eye, EyeOff,
  Redo2, PanelLeftClose, PanelLeftOpen, Menu, Maximize
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";
import TailwindInjector from './components/TailwindInjector.jsx';
import GateRenderer from './components/GateRenderer.jsx';
import WrapText from './components/WrapText.jsx';
import Mini7Seg from './components/Mini7Seg.jsx';
import MiniGridDisplay from './components/MiniGridDisplay.jsx';
import ChipFace from './components/ChipFace.jsx';

// --- Constants & Styles ---
const GRID_SIZE = 10;
const HISTORY_LIMIT = 50; 
const COLORS = {
  background: '#111111',
  panel: '#1a1a1a',
  wireOff: '#333333',
  wireOn: '#ef4444', 
  wireBus: '#a855f7', 
  nodeBg: '#222222',
  nodeBorder: '#444444',
  nodeSelected: '#3b82f6', 
  nodeJoint: '#fbbf24', 
  text: '#e0e0e0',
};

// --- Helper Functions ---
const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36).substr(-4);
const snapToGrid = (val) => Math.round(val / GRID_SIZE) * GRID_SIZE;
const boolsToVal = (arr) => {
  if (!Array.isArray(arr)) return arr ? 1 : 0;
  return arr.reduce((acc, b, i) => acc + (b ? (1 << i) : 0), 0);
};
const valToBools = (val, bits) => Array.from({length: bits}, (_, i) => !!((val >> i) & 1));

// Optimized equality check for primitives and arrays
const valsEqual = (a, b) => {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for(let i=0; i<a.length; i++) if(a[i] !== b[i]) return false;
        return true;
    }
    return false;
};

const getBool = (v) => {
  if (Array.isArray(v)) return !!v[v.length - 1];
  return !!v;
};

const createBaseLibrary = () => [
  { libId: 'base_pin_in', type: 'PIN_IN', category: 'I/O', label: 'Input Pin', inputs: [], outputs: [{ id: 'out', label: 'Val' }], color: '#ffffff', isIo: true, width: 80, height: 40, isEssential: true },
  { libId: 'base_pin_out', type: 'PIN_OUT', category: 'I/O', label: 'Output Pin', inputs: [{ id: 'in', label: 'Val' }], outputs: [], color: '#ffffff', isIo: true, width: 80, height: 40, isEssential: true },
  // Bus IO Pins
  { libId: 'pin_in_4', type: 'PIN_IN_4', category: 'I/O', label: 'Input 4b', inputs: [], outputs: [{ id: 'out', label: '4b', isBus: true }], color: '#ffffff', isIo: true, width: 80, height: 40, isEssential: true },
  { libId: 'pin_in_8', type: 'PIN_IN_8', category: 'I/O', label: 'Input 8b', inputs: [], outputs: [{ id: 'out', label: '8b', isBus: true }], color: '#ffffff', isIo: true, width: 80, height: 50, isEssential: true },
  { libId: 'pin_out_4', type: 'PIN_OUT_4', category: 'I/O', label: 'Output 4b', inputs: [{ id: 'in', label: '4b', isBus: true }], outputs: [], color: '#ffffff', isIo: true, width: 80, height: 40, isEssential: true },
  { libId: 'pin_out_8', type: 'PIN_OUT_8', category: 'I/O', label: 'Output 8b', inputs: [{ id: 'in', label: '8b', isBus: true }], outputs: [], color: '#ffffff', isIo: true, width: 90, height: 56, isEssential: true },
  
  // Clock
  { libId: 'clock', type: 'CLOCK', category: 'I/O', label: 'Clock', inputs: [], outputs: [{ id: 'out', label: 'Clk' }], color: '#10b981', width: 80, height: 60, isEssential: true },

  { libId: 'base_switch', type: 'SWITCH', category: 'Basic', label: 'Switch', inputs: [], outputs: [{ id: 'out', label: 'Out' }], color: '#4ade80', width: 80, height: 60, isEssential: true },
  { libId: 'base_light', type: 'LIGHT', category: 'Basic', label: 'Light', inputs: [{ id: 'in', label: 'In' }], outputs: [], color: '#facc15', width: 80, height: 60, isEssential: true },
  { libId: 'comment', type: 'COMMENT', category: 'Basic', label: 'Comment', inputs: [], outputs: [], color: '#fbbf24', width: 160, height: 100, isEssential: true },
  
  // Logic Gates
  { libId: 'base_and', type: 'AND', category: 'Gates', label: 'AND', inputs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], outputs: [{ id: 'out', label: 'Q' }], color: '#3b82f6', width: 80, height: 60, isEssential: true },
  { libId: 'base_or', type: 'OR', category: 'Gates', label: 'OR', inputs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], outputs: [{ id: 'out', label: 'Q' }], color: '#a855f7', width: 80, height: 60, isEssential: true },
  { libId: 'base_xor', type: 'XOR', category: 'Gates', label: 'XOR', inputs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], outputs: [{ id: 'out', label: 'Q' }], color: '#d946ef', width: 80, height: 60 },
  { libId: 'base_not', type: 'NOT', category: 'Gates', label: 'NOT', inputs: [{ id: 'in', label: 'In' }], outputs: [{ id: 'out', label: 'Q' }], color: '#ef4444', width: 80, height: 40, isEssential: true },
  { libId: 'base_nand', type: 'NAND', category: 'Gates', label: 'NAND', inputs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], outputs: [{ id: 'out', label: 'Q' }], color: '#f97316', width: 80, height: 60 },
  { libId: 'base_nor', type: 'NOR', category: 'Gates', label: 'NOR', inputs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], outputs: [{ id: 'out', label: 'Q' }], color: '#ec4899', width: 80, height: 60 },

  // UNIFIED JOINT NODE
  { libId: 'base_joint', type: 'JOINT', category: 'hidden', label: 'Joint', inputs: [{ id: 'joint', label: '' }], outputs: [{ id: 'joint', label: '' }], color: '#fbbf24', width: 12, height: 12, isEssential: true }, 
  
  // Updated Labels for MSB on Top
  { libId: 'merge_4', type: 'MERGE_4', category: 'Bus', label: '1→4BIT', inputs: Array(4).fill(0).map((_,i)=>({id:`i${i}`, label:`${3-i}`})), outputs: [{id:'out', label:'4b', isBus: true}], color: '#8b5cf6', width: 80, height: 100, isEssential: true },
  { libId: 'split_4', type: 'SPLIT_4', category: 'Bus', label: '4→1BIT', inputs: [{id:'in', label:'4b', isBus: true}], outputs: Array(4).fill(0).map((_,i)=>({id:`o${i}`, label:`${3-i}`})), color: '#8b5cf6', width: 80, height: 100, isEssential: true },
  { libId: 'merge_8', type: 'MERGE_8', category: 'Bus', label: '1→8BIT', inputs: Array(8).fill(0).map((_,i)=>({id:`i${i}`, label:`${7-i}`})), outputs: [{id:'out', label:'8b', isBus: true}], color: '#8b5cf6', width: 80, height: 180, isEssential: true },
  { libId: 'split_8', type: 'SPLIT_8', category: 'Bus', label: '8→1BIT', inputs: [{id:'in', label:'8b', isBus: true}], outputs: Array(8).fill(0).map((_,i)=>({id:`o${i}`, label:`${7-i}`})), color: '#8b5cf6', width: 80, height: 180, isEssential: true },
  { libId: 'resize_4_8', type: 'RESIZE_4_8', category: 'Bus', label: '4→8BIT', inputs: [{ id: 'high', label: 'High 4b', isBus: true }, { id: 'low',  label: 'Low 4b',  isBus: true }], outputs: [{ id: 'out', label: '8b', isBus: true }], color: '#6366f1', width: 80, height: 80, isEssential: true },
  { libId: 'resize_8_4', type: 'RESIZE_8_4', category: 'Bus', label: '8→4BIT', inputs: [{ id: 'in', label: '8b', isBus: true }], outputs: [{ id: 'high', label: 'High 4b', isBus: true }, { id: 'low',  label: 'Low 4b',  isBus: true }], color: '#6366f1', width: 80, height: 80, isEssential: true },
  { libId: 'tri_buffer', type: 'TRI_BUFFER', category: 'Bus', label: '3-State', inputs: [{ id: 'in', label: 'In' }, { id: 'en', label: 'En' }], outputs: [{ id: 'out', label: 'Out' }], color: '#8b5cf6', width: 80, height: 60, isEssential: true },

  { 
    libId: 'display_7seg', type: '7SEG', category: 'Output', label: '7-Seg', 
    inputs: [
      {id:'a', label:'a'}, {id:'b', label:'b'}, {id:'c', label:'c'}, {id:'d', label:'d'}, 
      {id:'e', label:'e'}, {id:'f', label:'f'}, {id:'g', label:'g'}, {id:'dp', label:'dp'}
    ], 
    outputs: [], color: '#111111', width: 60, height: 130, isEssential: true
  },
];

// --- Firebase Initialization ---
let app, auth, db;
let appId = 'default-app-id';
let firebaseAvailable = false;
try {
  if (typeof __firebase_config !== 'undefined') {
    const firebaseConfig = JSON.parse(__firebase_config);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    if (typeof __app_id !== 'undefined') appId = __app_id;
    firebaseAvailable = true;
  }
} catch (e) {}

// --- Core Simulation Logic ---
class UnionFind {
  constructor(n) {
    this.p = Array.from({ length: n }, (_, i) => i);
    this.r = Array(n).fill(0);
  }
  find(x) {
    while (this.p[x] !== x) {
      this.p[x] = this.p[this.p[x]];
      x = this.p[x];
    }
    return x;
  }
  union(a, b) {
    let ra = this.find(a), rb = this.find(b);
    if (ra === rb) return;
    if (this.r[ra] < this.r[rb]) [ra, rb] = [rb, ra];
    this.p[rb] = ra;
    if (this.r[ra] === this.r[rb]) this.r[ra]++;
  }
}

const inferBusBits = (node, portId) => {
  const ports = [...(node.inputs || []), ...(node.outputs || [])];
  const p = ports.find(x => x.id === portId);
  if (!p || !p.isBus) return 1;
  if (node.type === 'RESIZE_8_4') return portId === 'in' ? 8 : 4;
  if (node.type === 'RESIZE_4_8') return portId === 'out' ? 8 : 4;
  if (node.type.endsWith('_8') || ['PIN_IN_8', 'PIN_OUT_8', 'MERGE_8', 'SPLIT_8'].includes(node.type)) return 8;
  if (node.type.endsWith('_4') || ['PIN_IN_4', 'PIN_OUT_4', 'MERGE_4', 'SPLIT_4'].includes(node.type)) return 4;
  const lbl = String(p.label || '').toLowerCase();
  if (lbl.includes('8')) return 8;
  if (lbl.includes('4')) return 4;
  return 4;
};

const getPortMeta = (node, portId) => {
  if (!node) return { role: 'io', bits: 1, isJoint: false };
  if (node.type === 'JOINT') return { role: 'io', bits: 1, isJoint: true }; 
  const ins = node.inputs || [];
  const outs = node.outputs || [];
  const isInput = ins.some(p => p.id === portId);
  const isOutput = outs.some(p => p.id === portId);
  const role = (isInput && isOutput) ? 'io' : (isOutput ? 'output' : (isInput ? 'input' : 'io'));
  const bits = Math.max(1, inferBusBits(node, portId));
  return { role, bits, isJoint: false };
};

const normaliseToBus = (val, bits) => {
  if (bits <= 1) return !!getBool(val);
  if (Array.isArray(val)) {
    const out = val.slice(0, bits).map(v => !!v);
    while (out.length < bits) out.push(false);
    return out;
  }
  return Array(bits).fill(!!getBool(val));
};

const mergeValsOR = (a, b, bits) => {
  if (bits <= 1) return !!getBool(a) || !!getBool(b);
  const A = normaliseToBus(a, bits);
  const B = normaliseToBus(b, bits);
  const out = Array(bits);
  for (let i = 0; i < bits; i++) out[i] = !!A[i] || !!B[i];
  return out;
};

const buildNetlist = (nodes, wires) => {
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const termIndex = new Map(); 
  const terms = [];            
  const keyFor = (nodeId, portId) => {
    const n = nodeById.get(nodeId);
    if (n && n.type === 'JOINT') return `${nodeId}::joint`;
    return `${nodeId}::${portId}`;
  };
  const ensureTerm = (nodeId, portId) => {
    const n = nodeById.get(nodeId);
    if (!n) return -1;
    const k = keyFor(nodeId, portId);
    let idx = termIndex.get(k);
    if (idx === undefined) {
      const meta = getPortMeta(n, portId);
      idx = terms.length;
      termIndex.set(k, idx);
      terms.push({ nodeId, portId, role: meta.role, bits: meta.bits, isJoint: meta.isJoint });
    }
    return idx;
  };
  for (const w of wires) { ensureTerm(w.fromNode, w.fromPort); ensureTerm(w.toNode, w.toPort); }
  const uf = new UnionFind(terms.length);
  for (const w of wires) {
    const a = ensureTerm(w.fromNode, w.fromPort);
    const b = ensureTerm(w.toNode, w.toPort);
    if (a >= 0 && b >= 0) uf.union(a, b);
  }
  const netsByRoot = new Map();
  for (let i = 0; i < terms.length; i++) {
    const root = uf.find(i);
    let net = netsByRoot.get(root);
    if (!net) { net = { id: root, bits: 1, value: false, sources: [], sinks: [], joints: new Set() }; netsByRoot.set(root, net); }
    const t = terms[i];
    net.bits = Math.max(net.bits, t.bits);
    if (t.isJoint || t.role === 'joint') { net.joints.add(t.nodeId); continue; }
    if (t.role === 'output' || t.role === 'io') net.sources.push({ nodeId: t.nodeId, portId: t.portId });
    if (t.role === 'input'  || t.role === 'io') net.sinks.push({ nodeId: t.nodeId, portId: t.portId });
  }
  return { _wireCount: wires.length, _nodeCount: nodes.length, nets: Array.from(netsByRoot.values()) };
};

const simulateGraph = (nodes, wires, depth = 0, updateClocks = true, cachedNetlist = null) => {
  if (depth > 20) return { nodes, changed: false };
  const nodeMap = new Map();
  for (let i = 0; i < nodes.length; i++) nodeMap.set(nodes[i].id, nodes[i]);
  let changed = false;

  nodes.forEach(n => {
    if (!n.outputState) n.outputState = {};
    if (!n.inputState) n.inputState = {};
    n.inputState = {};
    if (n.type === 'JOINT') n.outputState = { joint: false };

    if (n.type === 'CLOCK') {
      if (typeof n.tick === 'undefined') n.tick = 0;
      if (typeof n.freq === 'undefined') n.freq = 1;
      if (typeof n.running === 'undefined') n.running = true;
      if (updateClocks && n.running) {
        const periodMs = 1000 / n.freq;
        const halfPeriodTicks = Math.max(1, Math.round((periodMs / 2) / 50));
        n.tick++;
        if (n.tick >= halfPeriodTicks) { n.tick = 0; n.state = !n.state; }
      }
      n.outputState.out = n.running ? n.state : false;
    }
  });

  const netlistOk = cachedNetlist && cachedNetlist._wireCount === wires.length && cachedNetlist._nodeCount === nodes.length;
  const netlist = netlistOk ? cachedNetlist : buildNetlist(nodes, wires);
  const nets = netlist.nets;

  const MAX_PASSES = 10;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let anyOutputChanged = false;
    nodes.forEach(n => { n.inputState = {}; });

    for (const net of nets) {
      const bits = net.bits;
      let v = (bits <= 1) ? false : Array(bits).fill(false);
      for (const src of net.sources) {
        const s = nodeMap.get(src.nodeId);
        if (!s) continue;
        const outVal = s.outputState?.[src.portId];
        v = mergeValsOR(v, outVal, bits);
      }
      net.value = v;
      for (const sink of net.sinks) {
        const t = nodeMap.get(sink.nodeId);
        if (!t) continue;
        const prev = t.inputState?.[sink.portId];
        t.inputState[sink.portId] = (prev === undefined) ? v : mergeValsOR(prev, v, bits);
      }
    }

    for (const n of nodes) {
      const iState = n.inputState || {};
      const prevOut = n.outputState ? { ...n.outputState } : {};
      if (!n.outputState) n.outputState = {};

      switch (n.type) {
        case 'PIN_IN': n.outputState.out = !!n.state; break;
        case 'PIN_IN_4': n.outputState.out = Array.isArray(n.state) ? n.state : [false,false,false,false]; break;
        case 'PIN_IN_8': n.outputState.out = Array.isArray(n.state) ? n.state : Array(8).fill(false); break;
        case 'SWITCH': n.outputState.out = !!n.state; break;
        case 'LIGHT': n.state = getBool(iState.in); break;
        case 'LIGHT_4': n.state = iState.in; break;
        case 'LIGHT_8': n.state = iState.in; break;
        case 'AND': n.outputState.out = (getBool(iState.a) && getBool(iState.b)); break;
        case 'OR': n.outputState.out = (getBool(iState.a) || getBool(iState.b)); break;
        case 'XOR': n.outputState.out = (!!getBool(iState.a) ^ !!getBool(iState.b)); break;
        case 'NAND': n.outputState.out = !(getBool(iState.a) && getBool(iState.b)); break;
        case 'NOR': n.outputState.out = !(getBool(iState.a) || getBool(iState.b)); break;
        case 'NOT': n.outputState.out = !getBool(iState.in); break;
        case 'PIN_OUT': n.state = iState.in; break;
        case 'PIN_OUT_4': n.state = iState.in; break;
        case 'PIN_OUT_8': n.state = iState.in; break;
        case 'JOINT': break;
        case 'MERGE_4': n.outputState.out = [3,2,1,0].map(k => getBool(iState[`i${k}`])); break;
        case 'SPLIT_4': { const arr = Array.isArray(iState.in) ? iState.in : [!!iState.in]; [3,2,1,0].forEach((bit, idx) => n.outputState[`o${bit}`] = arr[idx] || false); break; }
        case 'MERGE_8': n.outputState.out = [7,6,5,4,3,2,1,0].map(k => getBool(iState[`i${k}`])); break;
        case 'SPLIT_8': { const arr = Array.isArray(iState.in) ? iState.in : [!!iState.in]; [7,6,5,4,3,2,1,0].forEach((bit, idx) => n.outputState[`o${bit}`] = arr[idx] || false); break; }
        case 'RESIZE_8_4': { const arr = Array.isArray(iState.in) ? iState.in : [!!iState.in]; n.outputState.high = arr.slice(4, 8); n.outputState.low = arr.slice(0, 4); break; }
        case 'RESIZE_4_8': { const hi = Array.isArray(iState.high) ? iState.high : [!!iState.high]; const lo = Array.isArray(iState.low) ? iState.low : [!!iState.low]; n.outputState.out = [...(lo.slice(0, 4)), ...(hi.slice(0, 4))]; break; }
        case 'TRI_BUFFER': n.outputState.out = getBool(iState.en) ? getBool(iState.in) : false; break;
        case '7SEG': n.state = { a: getBool(iState.a), b: getBool(iState.b), c: getBool(iState.c), d: getBool(iState.d), e: getBool(iState.e), f: getBool(iState.f), g: getBool(iState.g), dp: getBool(iState.dp) }; break;
        default:
          if (n.internalData && n.internalData.nodes) {
            const iNodes = n.internalData.nodes;
            const iWires = n.internalData.wires;
            if (n._cachedInternalNodes !== iNodes) {
              n._cachedInternalNodes = iNodes;
              n._sortedInPins = iNodes.filter(x => x.type.startsWith('PIN_IN')).sort((a, b) => a.y - b.y);
              n._sortedOutPins = iNodes.filter(x => x.type.startsWith('PIN_OUT')).sort((a, b) => a.y - b.y);
              n._hasClock = iNodes.some(x => x.type === 'CLOCK');
            }
            const sortedInps = n._sortedInPins || [];
            if (n.inputs) n.inputs.forEach((inp, idx) => { const internalPin = sortedInps[idx]; if (internalPin) { internalPin.state = iState[inp.id]; if (!internalPin.outputState) internalPin.outputState = {}; internalPin.outputState.out = iState[inp.id]; } });
            let inputChanged = false;
            if (!n._lastInputs) n._lastInputs = {};
            if (n.inputs) {
              const currentIds = new Set();
              n.inputs.forEach(inp => {
                currentIds.add(inp.id);
                const val = iState[inp.id];
                if (!valsEqual(n._lastInputs[inp.id], val)) {
                  inputChanged = true;
                  n._lastInputs[inp.id] = Array.isArray(val) ? val.slice() : val;
                }
              });
              Object.keys(n._lastInputs).forEach(key => {
                if (!currentIds.has(key)) {
                  inputChanged = true;
                  delete n._lastInputs[key];
                }
              });
            }
            if (n._hasClock || inputChanged || pass === 0) { simulateGraph(iNodes, iWires, depth + 1, false); }
            const sortedOuts = n._sortedOutPins || [];
            if (n.outputs) n.outputs.forEach((outp, idx) => { const internalPin = sortedOuts[idx]; if (internalPin) n.outputState[outp.id] = internalPin.inputState?.in || false; });
          }
          break;
      }
      for (const key in n.outputState) { if (!valsEqual(n.outputState[key], prevOut[key])) { anyOutputChanged = true; break; } }
    }

    for (const net of nets) {
      for (const jid of net.joints) {
        const j = nodeMap.get(jid);
        if (j) j.outputState.joint = net.value;
      }
    }
    if (anyOutputChanged) changed = true;
    if (pass > 0 && !anyOutputChanged) break;
  }
  return { nodes, changed };
};

// --- Helper for Migration ---
function buildDefMap(currentLib) {
    const baseLib = createBaseLibrary();
    const map = new Map();
    [...baseLib, ...(currentLib || [])].forEach(d => {
        if (d) {
            // FIXED: Map both type AND libId to ensure custom chips are found
            if (d.type) map.set(d.type, d);
            if (d.libId) map.set(d.libId, d);
        }
    });
    return map;
}

function rehydrateNodeDef(n, defMap) {
    if (!n) return n;
    if (n.def) return n;
    // FIXED: Try looking up by specific libId first (for custom chips), then fallback to type
    const def = (n.libId && defMap.get(n.libId)) || defMap.get(n.type);
    return def ? { ...n, def } : n;
}

function migrateProjectData(tab, defMap) {
    if (!tab) return { tab, converted: 0 };
    const isChipTab = tab.type === 'chip' || !!tab.chipId || !!tab.editingChipId;
    if (isChipTab) return { tab, converted: 0 };

    const nodes = tab.nodes || [];
    const wires = tab.wires || [];
    const convertIds = new Set();
    const legacyJointIds = new Set();

    for (const n of nodes) {
      if ((n.type === 'PIN_IN' || n.type === 'PIN_OUT') && (!n.label || n.label === 'Input Pin' || n.label === 'Output Pin')) {
          convertIds.add(n.id);
      }
      if (n.type === 'JOINT') legacyJointIds.add(n.id);
    }

    if (convertIds.size === 0 && legacyJointIds.size === 0) return { tab, converted: 0 };
    const jointDef = defMap.get('JOINT');

    const nextNodes = nodes.map(n => {
      if (convertIds.has(n.id)) {
          const { def, inputState, outputState, _prevInputHash, running, freq, ...rest } = n;
          return { ...rest, type: 'JOINT', label: '', inputs: [{ id: 'joint', label: '' }], outputs: [{ id: 'joint', label: '' }], state: false, def: jointDef, width: 12, height: 12 };
      }
      if (legacyJointIds.has(n.id)) {
          return { ...n, inputs: [{ id: 'joint', label: '' }], outputs: [{ id: 'joint', label: '' }], width: 12, height: 12 };
      }
      return n;
    });

    const nextWires = wires.map(w => {
      let ww = { ...w };
      if (convertIds.has(ww.fromNode) || legacyJointIds.has(ww.fromNode)) ww.fromPort = 'joint';
      if (convertIds.has(ww.toNode) || legacyJointIds.has(ww.toNode)) ww.toPort = 'joint';
      return ww;
    });

    return { tab: { ...tab, nodes: nextNodes, wires: nextWires }, converted: convertIds.size + legacyJointIds.size };
}

const getDisplayCandidates = (nodes) => {
    return nodes.filter(n => {
        if (['7SEG', 'PIN_IN_4', 'PIN_IN_8', 'PIN_OUT_4', 'PIN_OUT_8'].includes(n.type)) return true;
        // Check for sub-chips with visible elements
        if (n.type === 'CUSTOM' || n.libId) {
             const hasVis = n.def?.visibleElements?.length > 0 || n.visibleElements?.length > 0;
             return hasVis;
        }
        return false;
    });
};

const hasVisualDisplays = (nodes) => {
    for (const node of nodes) {
        if (node.type === '7SEG') return true;
        if (node.type === 'CUSTOM' || node.libId) {
             const nestedVis = node.def?.visibleElements || node.visibleElements;
             if (nestedVis && nestedVis.length > 0) {
                 const innerNodes = node.internalData?.nodes || [];
                 const visibleInner = innerNodes.filter(n => nestedVis.includes(n.id));
                 if (hasVisualDisplays(visibleInner)) return true;
             }
        }
    }
    return false;
};

// Recursive width estimation for displays
const estimateDisplayWidth = (nodes) => {
    let width = 0;
    for (const node of nodes) {
        if (node.type === '7SEG') width += 20; // Exact w-5 (20px)
        else if (node.type.includes('8') || node.type.includes('4')) width += 34; // Grids are 34px
        else if (node.type === 'CUSTOM' || node.libId) {
             const nestedVis = node.def?.visibleElements || node.visibleElements;
             if (nestedVis && nestedVis.length > 0) {
                 const innerNodes = node.internalData?.nodes || [];
                 const visibleInner = innerNodes.filter(n => nestedVis.includes(n.id));
                 // Add internal width + padding for the container (p-1 is 4px total, plus borders & safety)
                 width += estimateDisplayWidth(visibleInner) + 12; 
             } else {
                 width += 40; 
             }
        } else {
             width += 25;
        }
    }
    return width;
};

const cleanNodeForDiff = (n) => { const { inputState, outputState, internalData, def, state, ...rest } = n; return rest; };
const getNetForWire = (startWireIndex, wires, nodes, wireAdj) => {
    const net = new Set();
    const queue = [startWireIndex];
    const visitedWires = new Set([startWireIndex]);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const addConnectedWires = (nodeId) => {
        const edges = wireAdj.get(nodeId) || [];
        edges.forEach(idx => {
            if (!visitedWires.has(idx)) {
                visitedWires.add(idx);
                queue.push(idx);
            }
        });
    };
    while (queue.length > 0) {
        const currentIdx = queue.pop();
        net.add(currentIdx);
        const wire = wires[currentIdx];
        if (!wire) continue;
        const fromNode = nodeMap.get(wire.fromNode);
        if (fromNode && fromNode.type === 'JOINT') addConnectedWires(fromNode.id);
        const toNode = nodeMap.get(wire.toNode);
        if (toNode && toNode.type === 'JOINT') addConnectedWires(toNode.id);
    }
    return net;
};

const findClosestPort = (x, y, nodes, threshold = 5) => {
    let closest = null; let minDst = Infinity;
    nodes.forEach(n => {
        (n.inputs || []).forEach(p => {
            const pos = getPortPosition(n, p.id, true);
            const dist = Math.hypot(pos.x - x, pos.y - y);
            if (dist < minDst && dist < threshold) { minDst = dist; closest = { nodeId: n.id, portId: p.id, isInput: true, x: pos.x, y: pos.y }; }
        });
        (n.outputs || []).forEach(p => {
            const pos = getPortPosition(n, p.id, false);
            const dist = Math.hypot(pos.x - x, pos.y - y);
            if (dist < minDst && dist < threshold) { minDst = dist; closest = { nodeId: n.id, portId: p.id, isInput: false, x: pos.x, y: pos.y }; }
        });
    });
    return closest;
};

const getPortPosition = (node, portId, isInput) => {
    if (node.type === 'JOINT') return { x: node.x, y: node.y };
    const ports = isInput ? node.inputs : node.outputs;
    if (!ports) return { x: node.x, y: node.y };
    const index = ports.findIndex(p => p.id === portId);
    if (index === -1) return { x: node.x, y: node.y };
    const count = ports.length;
    const width = node.width || node.def?.width || 80;
    const spacing = 20; 
    const totalPinHeight = (count - 1) * spacing;
    const startY = node.y - (totalPinHeight / 2);
    const y = startY + index * spacing;
    const x = isInput ? (node.x - width / 2) : (node.x + width / 2);
    return { x, y };
};

const updateAllInstances = (currentNodes, targetLibId, newData, newInputs, newOutputs, newWidth, newHeight, newVisibleElements) => {
    let updatedCount = 0;
    currentNodes.forEach(node => {
        // Check if this node is the one we are updating
        const isTarget = node.libId === targetLibId || (node.def && node.def.libId === targetLibId);

        if (isTarget) {
            // Update the instance with new data
            node.internalData = JSON.parse(JSON.stringify(newData));
            node.inputs = JSON.parse(JSON.stringify(newInputs));
            node.outputs = JSON.parse(JSON.stringify(newOutputs));
            node.width = newWidth;
            node.height = newHeight;
            if (newVisibleElements) {
                if (!node.def) node.def = {};
                node.def.visibleElements = newVisibleElements;
                node.visibleElements = newVisibleElements; 
            }
            updatedCount++;
            // CRITICAL FIX: Do NOT recurse into the node we just updated.
            // We have just set its internals to the new definition. 
            // Searching it again would cause an infinite loop if the chip contains itself.
        } else if (node.internalData && node.internalData.nodes) {
            // Only recurse into children if this node was NOT the target
            // (e.g., looking inside a 'ParentChip' to see if it contains 'TargetChip')
            updatedCount += updateAllInstances(node.internalData.nodes, targetLibId, newData, newInputs, newOutputs, newWidth, newHeight, newVisibleElements);
        }
    });
    return updatedCount;
};

export default function App() {
  const [user, setUser] = useState(null);
  
  const [tabs, setTabs] = useState([{ id: 'main', title: 'Main', type: 'main', nodes: [], wires: [], dirty: false, pan: {x:0, y:0}, scale: 1 }]);
  const [activeTabId, setActiveTabId] = useState('main');

  const simErrorOnceRef = useRef(false);
  const [nodes, setNodes] = useState([]);
  const [wires, setWires] = useState([]);
  const [library, setLibrary] = useState(createBaseLibrary());
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
  const [editingNodeId, setEditingNodeId] = useState(null); 
  const [placementQueue, setPlacementQueue] = useState([]);
  
  const [history, setHistory] = useState([]); 
  const [future, setFuture] = useState([]); 
  const [clipboard, setClipboard] = useState(null);
  const dragStartSnapshotRef = useRef(null);
  const dragRafRef = useRef(null);
  const dragStateRef = useRef(null);
  const pendingDragRef = useRef(null);
  
  const [collections, setCollections] = useState(['I/O', 'Gates', 'Basic', 'Bus', 'Output']); 
  const [collapsedCategories, setCollapsedCategories] = useState(new Set());
  const [collectionSortModes, setCollectionSortModes] = useState({});
  const [draggedLibId, setDraggedLibId] = useState(null); 
  const [dragOverLibId, setDragOverLibId] = useState(null); 
  const [isHoveringEndZone, setIsHoveringEndZone] = useState(false); 
  const [autoExpandedCategory, setAutoExpandedCategory] = useState(null);
  const [draggedCollectionIdx, setDraggedCollectionIdx] = useState(null);

  const [hoveredWireIndex, setHoveredWireIndex] = useState(null);
  const [hoveredNet, setHoveredNet] = useState(new Set());
  const [snapTarget, setSnapTarget] = useState(null);

  const [contextMenu, setContextMenu] = useState(null); 
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  
  const [saveDisplayCandidates, setSaveDisplayCandidates] = useState([]);
  const [saveDisplaySelection, setSaveDisplaySelection] = useState(new Set());

  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false); 
  const [itemToEdit, setItemToEdit] = useState(null); 
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isDeleteLibConfirmOpen, setIsDeleteLibConfirmOpen] = useState(false);
  
  const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false);
  const [tabToCloseId, setTabToCloseId] = useState(null);

  const [statusMsg, setStatusMsg] = useState(null); 
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [dragState, setDragState] = useState(null); 
  const [mousePos, setMousePos] = useState({ worldX: 0, worldY: 0 }); 
  const [isSimulating, setIsSimulating] = useState(true);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const cachedNetlist = useMemo(() => buildNetlist(nodes, wires), [wires, nodes.length, activeTabId]);
  const nodeById = useMemo(() => {
    const map = new Map();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);
  const wireAdj = useMemo(() => {
    const byNode = new Map();
    wires.forEach((w, idx) => {
      if (!byNode.has(w.fromNode)) byNode.set(w.fromNode, []);
      if (!byNode.has(w.toNode)) byNode.set(w.toNode, []);
      byNode.get(w.fromNode).push(idx);
      byNode.get(w.toNode).push(idx);
    });
    return byNode;
  }, [wires]);
  const portPositions = useMemo(() => {
    const map = new Map();
    nodes.forEach(n => {
      const entry = new Map();
      (n.inputs || []).forEach(p => entry.set(`in:${p.id}`, getPortPosition(n, p.id, true)));
      (n.outputs || []).forEach(p => entry.set(`out:${p.id}`, getPortPosition(n, p.id, false)));
      map.set(n.id, entry);
    });
    return map;
  }, [nodes]);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null); 
  const saveTimeoutRef = useRef(null);
  const isInitialLoad = useRef(true);
  const lastLocalSave = useRef('');
  const isDraggingRef = useRef(false);
  
  const markDirty = useCallback(() => {
    setTabs(prev => {
        const index = prev.findIndex(t => t.id === activeTabId);
        if (index === -1) return prev;
        const tab = prev[index];
        if (tab.id === 'main' || tab.dirty) return prev;
        const newTabs = [...prev];
        newTabs[index] = { ...tab, dirty: true };
        return newTabs;
    });
  }, [activeTabId]);

  const resolveNodeType = useCallback((n) => {
    if (['AND','OR','XOR','NOT','NAND','NOR'].includes(n.type)) return n.type;
    let label = n.label;
    if (n.libId) { 
        const def = library.find(i => i.libId === n.libId);
        if (def && def.label) label = def.label;
    }
    if (!label) return null;
    const upper = label.toUpperCase();
    if (upper.includes('NAND')) return 'NAND';
    if (upper.includes('NOR')) return 'NOR';
    if (upper.startsWith('XOR')) return 'XOR'; 
    if (upper.includes('AND') && !upper.includes('NAND') && !upper.includes('BAND')) return 'AND'; 
    if (upper.includes('OR') && !upper.includes('NOR') && !upper.includes('XOR') && !upper.includes('PORT')) return 'OR'; 
    if (upper.includes('NOT') || upper.includes('INV')) return 'NOT';
    return null;
  }, [library]);

  const showStatus = useCallback((text, type = 'success') => {
    setStatusMsg({ text, type });
  }, []);

  const stateRef = useRef({ nodes, wires, selectedNodeIds, mousePos });
  useEffect(() => { stateRef.current = { nodes, wires, selectedNodeIds, mousePos }; }, [nodes, wires, selectedNodeIds, mousePos]);
  useEffect(() => { dragStateRef.current = dragState; }, [dragState]);

  const snapshot = useCallback(() => {
    setHistory(prev => {
        const { nodes: currentNodes, wires: currentWires } = stateRef.current;
        const newEntry = { nodes: JSON.parse(JSON.stringify(currentNodes)), wires: JSON.parse(JSON.stringify(currentWires)) };
        const newHist = [...prev, newEntry];
        if (newHist.length > HISTORY_LIMIT) newHist.shift();
        return newHist;
    });
    setFuture([]); 
  }, []);

  const snapshotDragStart = useCallback(() => {
    if (dragStartSnapshotRef.current) {
        const entry = dragStartSnapshotRef.current;
        setHistory(prev => {
            const newHist = [...prev, entry];
            if (newHist.length > HISTORY_LIMIT) newHist.shift();
            return newHist;
        });
        setFuture([]);
        dragStartSnapshotRef.current = null;
    }
  }, []);

  const undo = useCallback(() => {
    setHistory(prev => {
        if (prev.length === 0) return prev;
        const lastState = prev[prev.length - 1]; 
        const remaining = prev.slice(0, -1);
        
        setFuture(f => {
            const { nodes: currentNodes, wires: currentWires } = stateRef.current;
            const currentEntry = { nodes: JSON.parse(JSON.stringify(currentNodes)), wires: JSON.parse(JSON.stringify(currentWires)) };
            return [currentEntry, ...f];
        });

        setNodes(lastState.nodes);
        setWires(lastState.wires);
        return remaining;
    });
    showStatus('Undo');
    markDirty(); 
  }, [showStatus, markDirty]);

  const redo = useCallback(() => {
      setFuture(prev => {
          if (prev.length === 0) return prev;
          const nextState = prev[0];
          const remaining = prev.slice(1);

          setHistory(h => {
             const { nodes: currentNodes, wires: currentWires } = stateRef.current;
             const currentEntry = { nodes: JSON.parse(JSON.stringify(currentNodes)), wires: JSON.parse(JSON.stringify(currentWires)) };
             const newHist = [...h, currentEntry];
             if (newHist.length > HISTORY_LIMIT) newHist.shift();
             return newHist;
          });

          setNodes(nextState.nodes);
          setWires(nextState.wires);
          return remaining;
      });
      showStatus('Redo');
      markDirty();
  }, [showStatus, markDirty]);

  const fitToView = useCallback((targetNodes) => {
      if (!targetNodes || targetNodes.length === 0) {
          setPan({ x: 0, y: 0 });
          setScale(1);
          return;
      }
      
      const container = canvasRef.current;
      const cWidth = container ? container.clientWidth : window.innerWidth - (isSidebarOpen ? 256 : 0);
      const cHeight = container ? container.clientHeight : window.innerHeight - 48; // approx header height

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      targetNodes.forEach(n => {
          minX = Math.min(minX, n.x - (n.width||80)/2);
          minY = Math.min(minY, n.y - (n.height||40)/2);
          maxX = Math.max(maxX, n.x + (n.width||80)/2);
          maxY = Math.max(maxY, n.y + (n.height||40)/2);
      });

      const padding = 100;
      const contentW = maxX - minX + padding * 2;
      const contentH = maxY - minY + padding * 2;
      
      const scaleX = cWidth / contentW;
      const scaleY = cHeight / contentH;
      const newScale = Math.min(Math.max(0.2, Math.min(scaleX, scaleY)), 2); // Cap auto-zoom between 0.2 and 2

      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;
      
      // Calculate Pan to center the content
      const newPanX = (cWidth / 2) - (midX * newScale);
      const newPanY = (cHeight / 2) - (midY * newScale);

      setPan({ x: newPanX, y: newPanY });
      setScale(newScale);
  }, [isSidebarOpen]);

  const copy = useCallback(() => {
      const { nodes: currentNodes, wires: currentWires, selectedNodeIds: currentSelection } = stateRef.current;
      if (currentSelection.size === 0) return;
      const nodesToCopy = currentNodes.filter(n => currentSelection.has(n.id));
      const wiresToCopy = currentWires.filter(w => currentSelection.has(w.fromNode) && currentSelection.has(w.toNode));
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      nodesToCopy.forEach(n => { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); });
      const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2;
      setClipboard({ nodes: JSON.parse(JSON.stringify(nodesToCopy)), wires: JSON.parse(JSON.stringify(wiresToCopy)), centroid: { x: centerX, y: centerY } });
      showStatus("Copied to clipboard");
  }, [showStatus]);

  const paste = useCallback(() => {
      if (!clipboard) return;
      const { mousePos: currentMousePos } = stateRef.current;
      snapshot(); 
      const idMap = new Map();
      const newNodes = clipboard.nodes.map(n => {
          const newId = generateId(); idMap.set(n.id, newId);
          const offsetX = currentMousePos.worldX - clipboard.centroid.x; const offsetY = currentMousePos.worldY - clipboard.centroid.y;
          return { ...n, id: newId, x: snapToGrid(n.x + offsetX), y: snapToGrid(n.y + offsetY), state: n.state };
      });
      const newWires = clipboard.wires.map(w => ({ ...w, fromNode: idMap.get(w.fromNode), toNode: idMap.get(w.toNode) }));
      setNodes(prev => [...prev, ...newNodes]);
      setWires(prev => [...prev, ...newWires]);
      setSelectedNodeIds(new Set(newNodes.map(n => n.id))); 
      showStatus("Pasted");
      markDirty(); 
  }, [clipboard, snapshot, showStatus, markDirty]);

  const getSortedItems = useCallback((cat) => {
      const items = library.filter(i => i.category === cat);
      return collectionSortModes[cat] === 'alpha' ? [...items].sort((a,b)=>a.label.localeCompare(b.label)) : items;
  }, [library, collectionSortModes]);

  const addToPlacementQueue = useCallback((item) => {
    setPlacementQueue(prev => [...prev, item]);
  }, []);

  const openCollectionModal = () => { setNewCollectionName(''); setIsCollectionModalOpen(true); };
  
  const refreshCollapseState = useCallback((lib, cols) => {
      const uncategorisedItems = lib.filter(i => i.category === 'root' && !i.type.startsWith('PIN_'));
      const hasUncategorised = uncategorisedItems.length > 0;
      const activeCollections = [...cols];
      let openCategory = null;
      if (hasUncategorised) { openCategory = 'root'; } else if (activeCollections.length > 0) { openCategory = activeCollections[activeCollections.length - 1]; }
      const allPossible = [...activeCollections, 'root'];
      const newCollapsed = new Set();
      allPossible.forEach(c => { if (c !== openCategory) newCollapsed.add(c); });
      setCollapsedCategories(newCollapsed);
  }, []);

  const removeSelectedNodes = useCallback(() => {
    if (selectedNodeIds.size === 0) return;
    snapshot(); 
    setNodes(prev => prev.filter(n => !selectedNodeIds.has(n.id)));
    setWires(prev => prev.filter(w => !selectedNodeIds.has(w.fromNode) && !selectedNodeIds.has(w.toNode)));
    setSelectedNodeIds(new Set());
    showStatus("Deleted selection");
    markDirty(); 
  }, [selectedNodeIds, showStatus, snapshot, markDirty]);

  const handleKeyDown = useCallback((e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); copy(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); paste(); return; }
    
    // Undo: Ctrl+Z
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) { 
        e.preventDefault(); 
        undo(); 
        return; 
    }
    
    // Redo: Ctrl+Y OR Ctrl+Shift+Z
    if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) || 
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
    ) {
        e.preventDefault();
        redo();
        return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') { removeSelectedNodes(); }
    if (e.key === 'Escape') {
        setPlacementQueue([]); setSelectedNodeIds(new Set()); setDragState(null); setEditingNodeId(null);
        setIsSaveModalOpen(false); setIsCollectionModalOpen(false); setIsClearConfirmOpen(false); setIsRenameModalOpen(false); setIsDeleteLibConfirmOpen(false); setIsUnsavedModalOpen(false); setContextMenu(null);
    }
  }, [removeSelectedNodes, undo, redo, copy, paste]);

  const getEventCoords = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { worldX: (e.clientX - r.left - pan.x) / scale, worldY: (e.clientY - r.top - pan.y) / scale };
  };

  const splitWire = (wire, x, y, newJointId) => {
      snapshot(); 
      const jointDef = library.find(i => i.type === 'JOINT') || createBaseLibrary().find(i => i.type === 'JOINT');
      const jointNode = { id: newJointId, type: 'JOINT', label: '', x: snapToGrid(x), y: snapToGrid(y), inputs: [{ id: 'joint', label: '' }], outputs: [{ id: 'joint', label: '' }], state: false, def: jointDef };
      setNodes(prev => [...prev, jointNode]);
      setWires(prev => [ ...prev.filter(w => w !== wire), { fromNode: wire.fromNode, fromPort: wire.fromPort, toNode: newJointId, toPort: 'joint' }, { fromNode: newJointId, fromPort: 'joint', toNode: wire.toNode, toPort: wire.toPort } ]);
      markDirty(); 
  };

  const confirmCreateCollection = () => { 
      if (!newCollectionName.trim() || collections.includes(newCollectionName)) return; 
      const newCols = [...collections, newCollectionName];
      setCollections(newCols); refreshCollapseState(library, newCols); setIsCollectionModalOpen(false); 
  };

  const deleteCollection = (name) => { 
      if (confirm(`Remove collection '${name}'? Components will move to Uncategorised.`)) { 
          const newLib = library.map(i => i.category === name ? { ...i, category: 'root' } : i);
          setLibrary(newLib); 
          const newCols = collections.filter(c => c !== name);
          setCollections(newCols); refreshCollapseState(newLib, newCols);
      } 
  };

  const initRenameLibItem = () => { if (!itemToEdit) return; setRenameValue(itemToEdit.label); setIsRenameModalOpen(true); setContextMenu(null); };

  const switchToTab = useCallback((tabId) => {
    // 1. Save current Tab state (including Zoom/Pan)
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, nodes, wires, pan, scale } : t));
    
    // 2. Find Next Tab
    const targetTab = tabs.find(t => t.id === tabId);
    if (!targetTab) return;
    
    setActiveTabId(tabId);
    setNodes(targetTab.nodes || []);
    setWires(targetTab.wires || []);
    setSelectedNodeIds(new Set());
    setEditingNodeId(null);
    setHistory([]); 
    setFuture([]);

    // 3. Restore Zoom/Pan OR Auto-Zoom if new
    if (targetTab.pan && targetTab.scale) {
        setPan(targetTab.pan);
        setScale(targetTab.scale);
    } else {
        // Auto-zoom for tabs that haven't been visited yet or imported without view data
        setTimeout(() => fitToView(targetTab.nodes), 0);
    }
  }, [activeTabId, nodes, wires, tabs, pan, scale, fitToView]);

  const openChipInTab = useCallback((chipItem) => {
    const existingTab = tabs.find(t => t.chipId === chipItem.libId);
    if (existingTab) { switchToTab(existingTab.id); return; }
    
    const newNodes = chipItem.internalData?.nodes ? JSON.parse(JSON.stringify(chipItem.internalData.nodes)) : [];
    const newTab = { id: generateId(), title: chipItem.label, type: 'chip', chipId: chipItem.libId, nodes: newNodes, wires: chipItem.internalData?.wires ? JSON.parse(JSON.stringify(chipItem.internalData.wires)) : [], dirty: false };
    
    setTabs(prev => { const savedPrev = prev.map(t => t.id === activeTabId ? { ...t, nodes, wires, pan, scale } : t); return [...savedPrev, newTab]; });
    setActiveTabId(newTab.id); 
    setNodes(newTab.nodes); 
    setWires(newTab.wires); 
    setSelectedNodeIds(new Set()); 
    setEditingNodeId(null); 
    setHistory([]); 
    setFuture([]);
    
    // Auto-zoom the new tab
    setTimeout(() => fitToView(newNodes), 0);
  }, [tabs, activeTabId, nodes, wires, switchToTab, pan, scale, fitToView]);

  const handleEditSource = () => {
    if (!contextMenu || !contextMenu.item) return;
    const item = contextMenu.item;
    let libItem = item;
    if (contextMenu.type === 'CANVAS') { const libId = item.def?.libId || item.libId; libItem = library.find(i => i.libId === libId); }
    if (libItem && libItem.type === 'CUSTOM') { openChipInTab(libItem); }
    setContextMenu(null);
  };

  const confirmRenameLibItem = () => { 
      if (itemToEdit && renameValue.trim()) { 
          if (itemToEdit.type === 'COLLECTION') {
              const oldName = itemToEdit.label; const newName = renameValue.trim();
              if (collections.includes(newName)) { showStatus("Collection name exists", "error"); return; }
              setCollections(prev => prev.map(c => c === oldName ? newName : c));
              setLibrary(prev => prev.map(i => i.category === oldName ? { ...i, category: newName } : i));
              if (collapsedCategories.has(oldName)) { setCollapsedCategories(prev => { const next = new Set(prev); next.delete(oldName); next.add(newName); return next; }); }
          } else if (contextMenu && contextMenu.type === 'CANVAS') { 
              setNodes(prev => prev.map(n => n.id === itemToEdit.id ? { ...n, label: renameValue } : n)); 
              markDirty(); 
          } else { 
              setLibrary(prev => prev.map(i => i.libId === itemToEdit.libId ? { ...i, label: renameValue } : i)); 
              setTabs(prev => prev.map(t => t.chipId === itemToEdit.libId ? { ...t, title: renameValue } : t)); 
          } 
      } 
      setIsRenameModalOpen(false); setItemToEdit(null);
  };
  
  const initDeleteLibItem = () => { setIsDeleteLibConfirmOpen(true); setContextMenu(null); };
  
  const confirmDeleteLibItem = () => { 
      if (itemToEdit) { 
          if (itemToEdit.type === 'COLLECTION') { deleteCollection(itemToEdit.label); } else {
              const libIdToDelete = itemToEdit.libId;
              setLibrary(prev => prev.filter(i => i.libId !== libIdToDelete)); 
              setTabs(prev => { const remaining = prev.filter(t => t.chipId !== libIdToDelete); return remaining; });
              if (tabs.find(t => t.chipId === libIdToDelete)?.id === activeTabId) {
                  const mainTab = tabs.find(t => t.id === 'main');
                  if (mainTab) { setActiveTabId('main'); setNodes(mainTab.nodes || []); setWires(mainTab.wires || []); setPan({ x: 0, y: 0 }); }
              }
              showStatus("Deleted"); 
          }
      } 
      setIsDeleteLibConfirmOpen(false); setItemToEdit(null);
  };

  const handleCollectionContextMenu = (e, category) => { e.preventDefault(); e.stopPropagation(); const item = { type: 'COLLECTION', label: category }; setItemToEdit(item); setContextMenu({ x: e.clientX, y: e.clientY, item, type: 'COLLECTION' }); };

  const handlePackChipClick = () => {
      if (nodes.filter(n => n.type.startsWith('PIN_')).length === 0) { showStatus("Need IO pins to save a chip!", "error"); return; }
      const name = tabs.find(t => t.id === activeTabId)?.title || '';
      setSaveName(name);
      
      // NEW: Use Top-Level Candidate Selection Only
      const candidates = getDisplayCandidates(nodes);
      
      setSaveDisplayCandidates(candidates);
      const existingItem = library.find(i => i.label === name);
      if (existingItem && existingItem.visibleElements) { const prevSet = new Set(existingItem.visibleElements); setSaveDisplaySelection(prevSet); } else { setSaveDisplaySelection(new Set(candidates.map(c => c.id))); }
      setIsSaveModalOpen(true);
  };

  const saveChipFromTab = (tabToSave, newNodes, newWires, displaySelection) => {
      const name = saveName.trim(); if (!name) return;
      const inputNodes = newNodes.filter(n => n.type.startsWith('PIN_IN')).sort((a,b)=>a.y-b.y);
      const outputNodes = newNodes.filter(n => n.type.startsWith('PIN_OUT')).sort((a,b)=>a.y-b.y);
      const existingIdx = library.findIndex(i => i.label === name);
      const existingItem = existingIdx >= 0 ? library[existingIdx] : null;
      const chipInputs = inputNodes.map((n, i) => { let width = 1; if (n.type.includes('_4')) width = 4; if (n.type.includes('_8')) width = 8; const oldId = existingItem?.inputs?.[i]?.id; return { id: oldId || generateId(), label: n.label || 'in', isBus: width > 1, bits: width }; });
      const chipOutputs = outputNodes.map((n, i) => { let width = 1; if (n.type.includes('_4')) width = 4; if (n.type.includes('_8')) width = 8; const oldId = existingItem?.outputs?.[i]?.id; return { id: oldId || generateId(), label: n.label || 'out', isBus: width > 1, bits: width }; });
      
      const visibleNodes = newNodes.filter(n => displaySelection.has(n.id));
      // Sort visible nodes by X to ensure they appear in visual order on the face
      visibleNodes.sort((a, b) => a.x - b.x);

      // Check height recursively
      const hasInternalDisplays = hasVisualDisplays(visibleNodes);

      const virtualPinCount = hasInternalDisplays ? 1 : Math.max(chipInputs.length, chipOutputs.length);
      const maxPins = virtualPinCount;
      
      // NEW WIDTH CALCULATION
      const calculatedDisplayWidth = estimateDisplayWidth(visibleNodes);
      const neededWidth = Math.max(80, calculatedDisplayWidth + 20); 
      const newWidth = neededWidth;

      let baseHeight;
      if (hasInternalDisplays) { baseHeight = 120; } else { baseHeight = maxPins * 20 + 20; }
      const newHeight = Math.max(hasInternalDisplays ? 100 : 60, baseHeight); 
      const internalData = { nodes: JSON.parse(JSON.stringify(newNodes)), wires: JSON.parse(JSON.stringify(newWires)) };
      const visibleElementsArray = Array.from(displaySelection);
      let targetLibId = null;

      if (existingIdx >= 0) {
        targetLibId = library[existingIdx].libId;
        setLibrary(prev => {
            const nextLib = prev.map((item, idx) => idx === existingIdx ? { ...item, inputs: chipInputs, outputs: chipOutputs, height: newHeight, width: newWidth, internalData, visibleElements: visibleElementsArray } : item);
            nextLib.forEach(libItem => { if (libItem.libId !== targetLibId && libItem.internalData && libItem.internalData.nodes) { updateAllInstances(libItem.internalData.nodes, targetLibId, internalData, chipInputs, chipOutputs, newWidth, newHeight, visibleElementsArray); } });
            return nextLib;
        });
        setTabs(prevTabs => { const nextTabs = [...prevTabs]; nextTabs.forEach(tab => { if (tab.nodes) { updateAllInstances(tab.nodes, targetLibId, internalData, chipInputs, chipOutputs, newWidth, newHeight, visibleElementsArray); } }); return nextTabs; });
        setNodes(currentNodes => { const nextNodes = JSON.parse(JSON.stringify(currentNodes)); const count = updateAllInstances(nextNodes, targetLibId, internalData, chipInputs, chipOutputs, newWidth, newHeight, visibleElementsArray); return count > 0 ? nextNodes : currentNodes; });
        
        if (activeTabId === 'main') {
             const newTabId = generateId();
             setTabs(prev => { const renamed = prev.map(t => t.id === 'main' ? { ...t, id: newTabId, title: name, type: 'chip', chipId: targetLibId, dirty: false } : t); return [...renamed, { id: 'main', title: 'Main', type: 'main', nodes: [], wires: [], dirty: false }]; });
             setActiveTabId(newTabId);
        } else if (tabToSave.title !== name) {
             // Rename current tab when saving as new name (Save As behavior)
             setTabs(prev => prev.map(t => t.id === activeTabId ? { 
                 ...t, 
                 title: name, 
                 chipId: targetLibId, 
                 dirty: false 
             } : t));
        } else { setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, dirty: false } : t)); }
        showStatus(`Updated "${name}" & propagated changes`);
      } else {
        const newLibId = generateId();
        const newChip = { libId: newLibId, type: 'CUSTOM', category: 'root', label: name, inputs: chipInputs, outputs: chipOutputs, color: '#8b5cf6', width: newWidth, height: newHeight, internalData, visibleElements: visibleElementsArray };
        setLibrary(prev => { const newLib = [...prev, newChip]; refreshCollapseState(newLib, collections); return newLib; });
        if (activeTabId === 'main') {
             const newTabId = generateId();
             setTabs(prev => { const renamed = prev.map(t => t.id === 'main' ? { ...t, id: newTabId, title: name, type: 'chip', chipId: newLibId, dirty: false } : t); return [...renamed, { id: 'main', title: 'Main', type: 'main', nodes: [], wires: [], dirty: false }]; });
             setActiveTabId(newTabId);
        } else {
             if (name !== tabToSave.title) {
                 // Rename current tab when saving as new name (Save As behavior)
                 setTabs(prev => prev.map(t => t.id === activeTabId ? { 
                     ...t, 
                     title: name, 
                     chipId: newLibId, 
                     dirty: false 
                 } : t));
             }
        }
        showStatus(`Saved "${name}"`);
      }
  };

  const confirmSaveChip = () => { 
      const currentTab = tabs.find(t => t.id === activeTabId) || { title: saveName };
      saveChipFromTab(currentTab, nodes, wires, saveDisplaySelection); 
      setIsSaveModalOpen(false); 
  };

  const handleExport = () => {
    try {
      const cleanNode = (n) => { const { def, inputState, outputState, _prevInputHash, ...rest } = n; if (rest.internalData && rest.internalData.nodes) { rest.internalData = { ...rest.internalData, nodes: rest.internalData.nodes.map(cleanNode) }; } return rest; };
      const currentTabSynced = tabs.map(t => t.id === activeTabId ? { ...t, nodes, wires } : t);
      const cleanedTabs = currentTabSynced.map(t => ({ ...t, nodes: (t.nodes || []).map(cleanNode) }));
      const cleanedLibrary = library.map(item => { if (item.internalData && item.internalData.nodes) { return { ...item, internalData: { ...item.internalData, nodes: item.internalData.nodes.map(cleanNode) } }; } return item; });
      const data = { library: cleanedLibrary, collections, tabs: cleanedTabs, activeTabId };
      let jsonString;
      try { jsonString = JSON.stringify(data, null, 2); } catch (e) { console.warn("Export too large for formatting."); jsonString = JSON.stringify(data); }
      const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `logicsim_backup_${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
      showStatus("Exported library");
    } catch (e) { console.error("Export failed:", e); showStatus("Export failed: " + e.message, "error"); }
  };

  const handleImport = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        let loadedLib = library; let loadedCols = collections;

        if (data.library) {
            const baseLib = createBaseLibrary(); const baseMap = new Map(baseLib.map(i => [i.libId, i]));
            const mergedLib = data.library.map(importItem => {
                const baseItem = baseMap.get(importItem.libId);
                if (baseItem) {
                    // Force update structure for components that had label/layout changes (Mergers, Splitters, Resizers)
                    const forceStructure = ['merge_4', 'split_4', 'merge_8', 'split_8', 'resize_4_8', 'resize_8_4'].includes(importItem.libId);
                    
                    return { 
                        ...importItem, 
                        width: baseItem.width, 
                        height: baseItem.height, 
                        category: (importItem.category && importItem.category !== 'root') ? importItem.category : baseItem.category, 
                        isEssential: baseItem.isEssential, 
                        ...(forceStructure ? { inputs: baseItem.inputs, outputs: baseItem.outputs } : {}) 
                    };
                }
                return { ...importItem, libId: importItem.libId || generateId(), category: importItem.type.startsWith('PIN_') ? 'I/O' : importItem.category };
            });
            baseLib.forEach(base => { if (base.isEssential && !mergedLib.find(i => i.libId === base.libId)) { mergedLib.push(base); } });
            loadedLib = mergedLib; setLibrary(loadedLib);
        }

        if (data.collections) {
            let mergedCols = data.collections.filter(c => c !== 'hidden');
            const usedCategories = new Set(); loadedLib.forEach(item => { if (item.category && item.category !== 'root' && item.category !== 'hidden') { usedCategories.add(item.category); } });
            usedCategories.forEach(cat => { if (!mergedCols.includes(cat)) { mergedCols.push(cat); } });
            loadedCols = mergedCols; setCollections(loadedCols);
        }

        if (data.tabs && Array.isArray(data.tabs) && data.tabs.length > 0) {
          const defMap = buildDefMap(loadedLib);

          const migratedTabs = data.tabs.map(t => {
            const cleanedNodes = (t.nodes || []).map(n => {
              let node = n;
              if (['PIN_IN_4','PIN_IN_8','PIN_OUT_4','PIN_OUT_8','CLOCK','7SEG','SWITCH','LIGHT'].includes(n.type)) {
                const { width, height, ...rest } = n;
                node = rehydrateNodeDef(rest, defMap);
              } else {
                node = rehydrateNodeDef(n, defMap);
              }

              // Ensure loaded nodes have arrays for inputs/outputs
              node = {
                  ...node,
                  inputs: node.inputs || [],
                  outputs: node.outputs || []
              };

              // Force Refresh inputs/outputs for Mergers/Splitters on the canvas to match new labels
              if (['MERGE_4', 'SPLIT_4', 'MERGE_8', 'SPLIT_8', 'RESIZE_4_8', 'RESIZE_8_4'].includes(node.type) && node.def) {
                   node.inputs = JSON.parse(JSON.stringify(node.def.inputs));
                   node.outputs = JSON.parse(JSON.stringify(node.def.outputs));
              }

              return node;
            });
            const cleanedTab = { ...t, nodes: cleanedNodes, wires: (t.wires || []) };
            const migrated = migrateProjectData(cleanedTab, defMap);
            return migrated.tab;
          });

          setTabs(migratedTabs);
          const t = migratedTabs.find(x => x.id === data.activeTabId) || migratedTabs[0];
          setNodes(t.nodes || []);
          setWires(t.wires || []);
          setActiveTabId(t.id);
          setHistory([]);
          setFuture([]);
          
          // Trigger Auto-Zoom for the imported active tab
          setTimeout(() => fitToView(t.nodes), 0);
        }

        refreshCollapseState(loadedLib, loadedCols); showStatus("Imported successfully");
      } catch (err) { showStatus("Failed to load: " + (err.message || 'error'), "error"); }
    };
    reader.readAsText(file); e.target.value = null;
  };

  const handleLibContextMenu = (e, item) => { e.preventDefault(); e.stopPropagation(); setItemToEdit(item); setContextMenu({ x: e.clientX, y: e.clientY, item, type: 'LIBRARY' }); };
  
  const handleCanvasContextMenu = (e) => { e.preventDefault(); const nodeEl = e.target.closest('[data-node-wrapper]'); if (nodeEl) { const nodeId = nodeEl.getAttribute('data-node-id'); const node = nodes.find(n => n.id === nodeId); if (node) { setItemToEdit(node); setContextMenu({ x: e.clientX, y: e.clientY, item: node, type: 'CANVAS' }); } } };

  const toggleCategory = (cat) => setCollapsedCategories(prev => { const n = new Set(prev); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; });
  const toggleSortMode = (e, cat) => { e.stopPropagation(); setCollectionSortModes(prev => ({ ...prev, [cat]: prev[cat] === 'alpha' ? 'custom' : 'alpha' })); };
  const onLibDragStart = (id) => setDraggedLibId(id);
  const handleDragEnd = () => { setDraggedLibId(null); setDragOverLibId(null); setIsHoveringEndZone(false); setAutoExpandedCategory(null); setDraggedCollectionIdx(null); isDraggingRef.current = false; };
  const onLibDropCategory = (e, cat) => { e.preventDefault(); if (draggedLibId) setLibrary(prev => prev.map(i => i.libId === draggedLibId ? { ...i, category: cat } : i)); handleDragEnd(); };
  const onLibDropItem = (e, target) => { e.preventDefault(); e.stopPropagation(); if (!draggedLibId || draggedLibId === target.libId) return; snapshot(); const newLib = [...library]; const fromIdx = newLib.findIndex(i => i.libId === draggedLibId); const item = newLib.splice(fromIdx, 1)[0]; item.category = target.category || 'root'; const toIdx = newLib.findIndex(i => i.libId === target.libId); newLib.splice(toIdx, 0, item); setLibrary(newLib); handleDragEnd(); };
  const onLibDropToEnd = (e, cat) => { e.preventDefault(); if (draggedLibId) { setLibrary(prev => { const item = prev.find(i => i.libId === draggedLibId); return [...prev.filter(i => i.libId !== draggedLibId), { ...item, category: cat }]; }); } setDraggedLibId(null); };
  
  const handleDragEnterCategory = (cat) => { 
    if (draggedLibId) { setCollapsedCategories(prev => { const next = new Set(collections); const hasRoot = library.some(i => i.category === 'root' && !i.type.startsWith('PIN_')); if (hasRoot) next.add('root'); next.delete(cat); return next; }); setAutoExpandedCategory(cat); } 
  };

  const onCollectionDragStart = (e, idx) => { setDraggedCollectionIdx(idx); e.dataTransfer.effectAllowed = "move"; };
  const onCollectionDragOver = (e, idx) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onCollectionDrop = (e, cat, idx) => { e.preventDefault(); e.stopPropagation(); if (draggedCollectionIdx !== null) { if (draggedCollectionIdx === idx) return; const newCols = [...collections]; const [moved] = newCols.splice(draggedCollectionIdx, 1); newCols.splice(idx, 0, moved); setCollections(newCols); setDraggedCollectionIdx(null); return; } if (draggedLibId) onLibDropCategory(e, cat); };

  const performCloseTab = (tabId) => {
    if (activeTabId === tabId) { const index = tabs.findIndex(t => t.id === tabId); const fallback = tabs[index - 1] || tabs[index + 1] || tabs[0]; setActiveTabId(fallback.id); setNodes(fallback.nodes || []); setWires(fallback.wires || []); setPan({ x: 0, y: 0 }); }
    setTabs(prev => prev.filter(t => t.id !== tabId)); setIsUnsavedModalOpen(false); setTabToCloseId(null);
  };

  const attemptCloseTab = (e, tabId) => { e.stopPropagation(); if (tabs.length <= 1) return; const tab = tabs.find(t => t.id === tabId); if (!tab) return; if (tab.type === 'chip' && tab.dirty) { setTabToCloseId(tabId); setIsUnsavedModalOpen(true); return; } performCloseTab(tabId); };
  const handleUnsavedSave = () => { const tab = tabs.find(t => t.id === tabToCloseId); if (tab) { const currentNodes = (tab.id === activeTabId) ? nodes : tab.nodes; const currentWires = (tab.id === activeTabId) ? wires : tab.wires; saveChipFromTab(tab, currentNodes, currentWires); } performCloseTab(tabToCloseId); };
  const handleUnsavedDiscard = () => { performCloseTab(tabToCloseId); };

  const handleMouseDown = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const coords = getEventCoords(e);
    if (canvasRef.current) canvasRef.current.focus();
    if (placementQueue.length > 0) return;
    if (editingNodeId && e.target.tagName !== 'INPUT') setEditingNodeId(null);
    
    const action = e.target.getAttribute('data-action');
    if (action) {
        const nodeId = e.target.getAttribute('data-node-id');
        setNodes(prev => prev.map(n => { if (n.id !== nodeId) return n; if (action === 'clock-toggle') { return { ...n, running: !n.running }; } let newFreq = n.freq || 1; if (action === 'clock-inc') newFreq = Math.min(10, newFreq + 0.5); if (action === 'clock-dec') newFreq = Math.max(0.5, newFreq - 0.5); return { ...n, freq: newFreq }; }));
        return; 
    }

    const portEl = e.target.closest('[data-port-id]');
    if (portEl) {
        const nodeId = portEl.getAttribute('data-node-id'); const node = nodes.find(n => n.id === nodeId);
        if (node && node.type !== 'JOINT') { setDragState({ type: 'WIRE', nodeId: portEl.getAttribute('data-node-id'), portId: portEl.getAttribute('data-port-id'), isInputPort: portEl.getAttribute('data-is-input') === 'true', startX: coords.worldX, startY: coords.worldY, currentX: coords.worldX, currentY: coords.worldY }); isDraggingRef.current = true; return; }
    }

    if (e.target.tagName === 'path' && e.target.hasAttribute('data-wire-index')) {
        const wire = wires[parseInt(e.target.getAttribute('data-wire-index'))];
        if (wire) { const jId = generateId(); splitWire(wire, coords.worldX, coords.worldY, jId); setSelectedNodeIds(new Set([jId])); setDragState({ type: 'NODE', ids: [jId], startX: coords.worldX, startY: coords.worldY, initialPositions: { [jId]: { x: snapToGrid(coords.worldX), y: snapToGrid(coords.worldY) } } }); isDraggingRef.current = true; return; }
    }

    const nodeEl = e.target.closest('[data-node-wrapper]');
    if (nodeEl) {
      const nodeId = nodeEl.getAttribute('data-node-id'); const n = nodes.find(x => x.id === nodeId);
      if (n) {
          // CAPTURE STATE BEFORE DRAG STARTS
          dragStartSnapshotRef.current = { 
              nodes: JSON.parse(JSON.stringify(nodes)), 
              wires: JSON.parse(JSON.stringify(wires)) 
          };

          if (n.type === 'JOINT') {
             if (e.shiftKey) { setDragState({ type: 'WIRE', nodeId: n.id, portId: 'joint', isInputPort: false, startX: coords.worldX, startY: coords.worldY, currentX: coords.worldX, currentY: coords.worldY }); isDraggingRef.current = true; return; } 
             else { setSelectedNodeIds(new Set([nodeId])); setDragState({ type: 'NODE', ids: [nodeId], startX: coords.worldX, startY: coords.worldY, initialPositions: { [nodeId]: { x: n.x, y: n.y } } }); isDraggingRef.current = true; return; }
          }
          let newSelection = new Set(selectedNodeIds); if (e.shiftKey) { if (newSelection.has(nodeId)) newSelection.delete(nodeId); else newSelection.add(nodeId); } else if (!newSelection.has(nodeId)) { newSelection = new Set([nodeId]); }
          setSelectedNodeIds(newSelection);
          const initialPositions = {}; newSelection.forEach(id => { const nData = nodes.find(x => x.id === id); if(nData) initialPositions[id] = {x:nData.x, y:nData.y}; });
          setDragState({ type: 'NODE', ids: Array.from(newSelection), startX: coords.worldX, startY: coords.worldY, initialPositions }); isDraggingRef.current = true; return;
      }
    }

    if (e.button === 1 || e.code === 'Space' || e.shiftKey) { setDragState({ type: 'PAN', startX: e.clientX, startY: e.clientY, initialPan: { ...pan } }); isDraggingRef.current = true; } else { setDragState({ type: 'SELECT', startX: coords.worldX, startY: coords.worldY, currentX: coords.worldX, currentY: coords.worldY }); isDraggingRef.current = true; setSelectedNodeIds(new Set()); }
  };

  const handleWheel = useCallback((e) => {
    // 1. Identify Contexts
    const isCanvas = canvasRef.current && canvasRef.current.contains(e.target);
    const scrollableX = e.target.closest('.overflow-x-auto');
    const scrollableY = e.target.closest('.overflow-y-auto');
    
    // 2. Canvas: Complete Control
    if (isCanvas) {
        e.preventDefault();
        
        if (e.shiftKey) {
            // Zoom logic (Shift + Wheel)
            const r = canvasRef.current.getBoundingClientRect();
            const mouseX = e.clientX - r.left;
            const mouseY = e.clientY - r.top;

            const worldX = (mouseX - pan.x) / scale;
            const worldY = (mouseY - pan.y) / scale;

            const zoomSensitivity = 0.001;
            const newScale = Math.min(Math.max(0.1, scale - e.deltaY * zoomSensitivity), 5);

            const newPanX = mouseX - (worldX * newScale);
            const newPanY = mouseY - (worldY * newScale);

            setScale(newScale);
            setPan({ x: newPanX, y: newPanY });
        } else {
            // Pan logic (Wheel only - uses both deltas for 2D pan)
            setPan(prev => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
        return;
    }

    // 3. Horizontal Scroll Container (Tabs)
    if (scrollableX) {
        e.preventDefault();
        scrollableX.scrollLeft += e.deltaX;
        return;
    }

    // 4. Vertical Scroll Container (Sidebar, Modals)
    if (scrollableY) {
        // If mostly horizontal, block it to prevent Back gesture
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            e.preventDefault();
        }
        // Otherwise allow native vertical scroll
        return;
    }

    // 5. Static UI (Headers, Empty spaces)
    // Block ALL scrolling here to be safe
    e.preventDefault();

  }, [pan, scale]);

  // --- NEW: Attach non-passive wheel listener for preventing browser navigation ---
  const handleWheelRef = useRef(handleWheel);
  handleWheelRef.current = handleWheel;

  useEffect(() => {
    const canvas = canvasRef.current;
    
    // We use a ref to the handler so we don't need to re-bind the event listener
    // every time pan/scale changes, while still accessing the latest state via closures/refs if needed.
    const listener = (e) => handleWheelRef.current(e);

    // Attach to window to catch events globally
    window.addEventListener('wheel', listener, { passive: false });

    return () => {
        window.removeEventListener('wheel', listener);
    };
  }, []); // Run once on mount

  useEffect(() => {
    const localData = localStorage.getItem('logicsim_data_v6');
    if (localData) {
      try {
        const parsed = JSON.parse(localData); let loadedLib = library;
        if (parsed.library) {
            const baseLib = createBaseLibrary(); const mergedLib = [...parsed.library];
            baseLib.forEach(base => { if(!mergedLib.find(i => i.type === base.type)) mergedLib.push(base); });
            loadedLib = mergedLib.map(i => ({ ...i, libId: i.libId || generateId(), category: i.type.startsWith('PIN_') ? 'I/O' : i.category }));
            setLibrary(loadedLib);
        }
        if (parsed.collections) setCollections(parsed.collections);
        if (parsed.tabs && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
            const defMap = buildDefMap(loadedLib);
            // MIGRATE LOADED TABS IMMEDIATELY TO FIX WIRES/NODES
            const migratedTabs = parsed.tabs.map(t => {
                const cleanedNodes = (t.nodes || []).map(n => rehydrateNodeDef(n, defMap));
                const cleanedTab = { ...t, nodes: cleanedNodes, wires: (t.wires || []) };
                const migrated = migrateProjectData(cleanedTab, defMap);
                return migrated.tab;
            });
            setTabs(migratedTabs); 
            const t = migratedTabs.find(x => x.id === parsed.activeTabId) || migratedTabs[0]; 
            setNodes(t.nodes || []); 
            setWires(t.wires || []); 
            setActiveTabId(t.id); 
        }
        refreshCollapseState(loadedLib, parsed.collections || collections);
      } catch(e) {}
    }
    isInitialLoad.current = false;
  }, []);

  useEffect(() => {
    if (isInitialLoad.current) return;
    const saveData = async () => {
      const currentTabSynced = tabs.map(t => t.id === activeTabId ? { ...t, nodes, wires, pan, scale } : t);
      const data = { library, collections, tabs: currentTabSynced, activeTabId };
      const dataStr = JSON.stringify(data);
      if (dataStr !== lastLocalSave.current) {
        try { localStorage.setItem('logicsim_data_v6', dataStr); } catch (e) { console.warn("Quota exceeded"); }
        lastLocalSave.current = dataStr;
        if (firebaseAvailable && user) { setIsCloudSaving(true); try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logicSimData', 'save_v6'), data); setTimeout(() => setIsCloudSaving(false), 500); } catch (e) { setIsCloudSaving(false); } }
      }
    };
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(saveData, 1500);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [nodes, wires, library, collections, tabs, activeTabId, user, pan, scale]);

  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      if (isDraggingRef.current) return;

      setNodes(currentNodes => {
        try {
          const simulationNodes = [...currentNodes];
          const result = simulateGraph(simulationNodes, wires, 0, true, cachedNetlist);
          simErrorOnceRef.current = false;
          return result.changed ? result.nodes : currentNodes;
        } catch (e) {
          if (!simErrorOnceRef.current) {
            console.error("simulateGraph failed:", e);
            simErrorOnceRef.current = true;
          }
          return currentNodes;
        }
      });
    }, 50);

    return () => clearInterval(interval);
  }, [wires, isSimulating, cachedNetlist]);

  useEffect(() => {
    const handleGlobalMouseDown = () => setContextMenu(null);
    window.addEventListener('mousedown', handleGlobalMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('mousedown', handleGlobalMouseDown); window.removeEventListener('keydown', handleKeyDown); };
  }, [handleKeyDown]);

  useEffect(() => { if (statusMsg) { const timer = setTimeout(() => setStatusMsg(null), 10000); return () => clearTimeout(timer); } }, [statusMsg]);

  // --- Render Helpers ---
  const renderLibraryItem = (item, idx, total) => {
    const isDragging = draggedLibId === item.libId; const isLast = idx === total - 1; const isDragOver = dragOverLibId === item.libId && !isDragging && !isLast;
    return (
      <div key={item.libId} draggable onDragStart={()=>onLibDragStart(item.libId)} onDragEnd={handleDragEnd} onDragOver={e=>{e.preventDefault();setDragOverLibId(item.libId);}} onDrop={e=>onLibDropItem(e, item)} onContextMenu={e => handleLibContextMenu(e, item)} onClick={() => addToPlacementQueue(item)} className={`p-3 bg-white/5 hover:bg-white/10 rounded-lg flex items-center gap-3 mb-1 group cursor-pointer border border-transparent hover:border-white/10 transition-all ${isDragging?'opacity-50':''} ${isDragOver?'mt-6':''}`}>
          {isDragOver && <div className="absolute -top-6 left-0 right-0 h-6 border-b-2 border-dashed border-indigo-500/50 pointer-events-none"/>}
          <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.1)]" style={{ backgroundColor: item.color }} />
          <span className="text-xs font-semibold truncate flex-1">{item.label}</span>
          {item.type === 'CUSTOM' && <button onClick={e => {e.stopPropagation(); openChipInTab(item);}} className="p-1 opacity-0 group-hover:opacity-100 hover:text-indigo-400"><Pencil size={12}/></button>}
          <GripVertical className="w-3 h-3 text-white/10 opacity-0 group-hover:opacity-100" />
      </div>
    );
  };

  const handleMouseMove = (e) => {
    const coords = getEventCoords(e);
    if (!dragState || dragState.type === 'SELECT' || placementQueue.length > 0) { setMousePos(coords); }
    if (!dragState) return;
    
    if (!dragState && e.target.tagName === 'path' && e.target.hasAttribute('data-wire-index')) {
        const idx = parseInt(e.target.getAttribute('data-wire-index'));
        if (hoveredWireIndex !== idx) { setHoveredWireIndex(idx); setHoveredNet(getNetForWire(idx, wires, nodes, wireAdj)); }
    } else if (!dragState) { if (hoveredWireIndex !== null) { setHoveredWireIndex(null); setHoveredNet(new Set()); } }

    if (dragState.type === 'PAN') { setPan({ x: dragState.initialPan.x + e.clientX - dragState.startX, y: dragState.initialPan.y + e.clientY - dragState.startY }); }
    else if (dragState.type === 'NODE') { 
        pendingDragRef.current = coords;
        if (!dragRafRef.current) {
            dragRafRef.current = requestAnimationFrame(() => {
                dragRafRef.current = null;
                const latest = pendingDragRef.current;
                const currentDrag = dragStateRef.current;
                if (!latest || !currentDrag || currentDrag.type !== 'NODE') return;
                setNodes(prev => prev.map(n => currentDrag.ids.includes(n.id) ? { ...n, x: snapToGrid(currentDrag.initialPositions[n.id].x + latest.worldX - currentDrag.startX), y: snapToGrid(currentDrag.initialPositions[n.id].y + latest.worldY - currentDrag.startY) } : n));
                if (!currentDrag.hasMoved && (Math.abs(latest.worldX - currentDrag.startX) > 1 || Math.abs(latest.worldY - currentDrag.startY) > 1)) {
                    setDragState(prev => prev ? ({ ...prev, hasMoved: true }) : prev);
                }
            });
        }
    } 
    else if (dragState.type === 'SELECT') { setDragState(prev => ({ ...prev, currentX: coords.worldX, currentY: coords.worldY })); const x1 = Math.min(dragState.startX, coords.worldX); const x2 = Math.max(dragState.startX, coords.worldX); const y1 = Math.min(dragState.startY, coords.worldY); const y2 = Math.max(dragState.startY, coords.worldY); const newSel = new Set(); nodes.forEach(n => { if (n.x >= x1 && n.x <= x2 && n.y >= y1 && n.y <= y2) newSel.add(n.id); }); setSelectedNodeIds(newSel); } 
    else { setDragState(prev => ({ ...prev, currentX: coords.worldX, currentY: coords.worldY })); }
  };

  const handleMouseUp = (e) => {
    if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
    }
    pendingDragRef.current = null;
    if (!dragState) {
        if (placementQueue.length > 0) {
            snapshot(); 
            const newNs = placementQueue.map((def, idx) => {
                let initialState = false; if (def.type === 'PIN_IN_4') initialState = [false,false,false,false]; if (def.type === 'PIN_IN_8') initialState = [false,false,false,false,false,false,false,false];
                const newNode = { id: generateId(), ...def, x: snapToGrid(mousePos.worldX), y: snapToGrid(mousePos.worldY + idx * 80), state: initialState };
                if (newNode.internalData) { newNode.internalData = JSON.parse(JSON.stringify(newNode.internalData)); }
                return newNode;
            });
            setNodes(prev => [...prev, ...newNs]);
            setPlacementQueue([]);
            markDirty(); 
        }
        return;
    }
    
    const upCoords = getEventCoords(e);

    if (dragState.type === 'WIRE') {
        const targetPort = findClosestPort(upCoords.worldX, upCoords.worldY, nodes);
        setSnapTarget(null); 
        
        if (targetPort) {
            const { nodeId: toId, portId: toPortId } = targetPort;
            if (toId !== dragState.nodeId) {
                snapshot(); 
                setWires(prev => [...prev, { fromNode: dragState.nodeId, fromPort: dragState.portId, toNode: toId, toPort: toPortId }]);
                markDirty(); 
            }
        } else if (e.altKey) {
            snapshot(); const jointId = generateId(); const jointX = snapToGrid(upCoords.worldX); const jointY = snapToGrid(upCoords.worldY);
            const jointDef = library.find(i => i.type === 'JOINT') || createBaseLibrary().find(i => i.type === 'JOINT');
            const newJoint = { id: jointId, type: 'JOINT', label: '', x: jointX, y: jointY, inputs: [{ id: 'joint', label: '' }], outputs: [{ id: 'joint', label: '' }], state: false, def: jointDef };
            setNodes(prev => [...prev, newJoint]);
            if (dragState.isInputPort) { setWires(prev => [...prev, { fromNode: jointId, fromPort: 'joint', toNode: dragState.nodeId, toPort: dragState.portId }]); } else { setWires(prev => [...prev, { fromNode: dragState.nodeId, fromPort: dragState.portId, toNode: jointId, toPort: 'joint' }]); }
            setDragState({ type: 'WIRE', nodeId: jointId, portId: 'joint', isInputPort: false, startX: jointX, startY: jointY, currentX: upCoords.worldX, currentY: upCoords.worldY });
            isDraggingRef.current = true;
            markDirty(); 
            return; 
        }
    } else if (dragState.type === 'NODE' && dragState.ids.length === 1) {
        const r = canvasRef.current.getBoundingClientRect(); const clickX = (e.clientX - r.left - pan.x) / scale; const clickY = (e.clientY - r.top - pan.y) / scale;
        
        // If we moved significantly, check if we should snapshot
        if (dragState.hasMoved) {
             snapshotDragStart();
             markDirty();
        }

        if (Math.abs(clickX - dragState.startX) < 1 && !dragState.hasMoved) {
            const n = nodes.find(x => x.id === dragState.ids[0]);
            if (n) {
                if (n.type === 'SWITCH' || n.type === 'PIN_IN') { 
                    snapshot(); // State change (toggle) needs standard snapshot
                    setNodes(prev => prev.map(x => x.id === n.id ? { ...x, state: !x.state } : x)); 
                } 
                else if (n.type === 'PIN_IN_4' || n.type === 'PIN_IN_8') {
                    const width = n.def?.width || (n.type.includes('8') ? 80 : 80); const height = n.type.includes('8') ? 50 : 40; const is8Bit = n.type.includes('8'); const nodeX = n.x - width/2; const nodeY = n.y - height/2;
                    const headerHeight = 12; const paddingX = 2; const paddingTop = 2; const gridWidth = width - (paddingX * 2); const startY = nodeY + paddingTop + headerHeight; const startX = nodeX + paddingX; const gap = 2; const cellW = (gridWidth - (3 * gap)) / 4; const cellH = cellW;
                    let clickedBit = -1;
                    const checkRow = (rowIndex, bitOffset) => {
                         for(let col=0; col<4; col++) {
                            const bit = bitOffset - col; const boxX = startX + (col * (cellW + gap)); const boxY = startY + (rowIndex * (cellH + gap));
                            if ( clickX >= boxX - 1 && clickX <= boxX + cellW + 1 && clickY >= boxY - 1 && clickY <= boxY + cellH + 1 ) { return bit; }
                         }
                         return -1;
                    };
                    if (is8Bit) { let b = checkRow(0, 7); if (b === -1) b = checkRow(1, 3); clickedBit = b; } else { clickedBit = checkRow(0, 3); }
                    if (clickedBit !== -1) { 
                        snapshot(); // State change
                        const currentState = n.state || (is8Bit ? Array(8).fill(false) : Array(4).fill(false)); const newState = [...currentState]; newState[clickedBit] = !newState[clickedBit]; setNodes(prev => prev.map(x => x.id === n.id ? { ...x, state: newState } : x)); 
                    }
                }
            }
            setSelectedNodeIds(new Set([n.id]));
        } 
    } else if (dragState.type === 'NODE') { 
        if (dragState.hasMoved) {
            snapshotDragStart();
            markDirty(); 
        }
    } 
    setDragState(null); isDraggingRef.current = false;
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0a0a0a] text-white overflow-hidden font-sans select-none" tabIndex={0}>
      <TailwindInjector />
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div 
            className={`bg-[#141414] border-r border-white/5 flex flex-col z-20 shadow-2xl transition-all duration-300 ease-in-out overflow-hidden`}
            style={{ width: isSidebarOpen ? '16rem' : '0px', opacity: isSidebarOpen ? 1 : 0 }}
        >
          <div className="p-4 border-b border-white/5 bg-[#1a1a1a] flex items-center justify-between flex-shrink-0 min-w-[16rem]">
            <div className="flex items-center gap-2">
                <button onClick={() => setIsSidebarOpen(false)} className="hover:text-white/80 transition-colors text-white/50"><PanelLeftClose size={18}/></button>
                <h1 className="text-lg font-black tracking-tight flex items-center gap-2 text-indigo-500">LOGIC SIM</h1>
            </div>
            <div className="flex gap-1">
                <button onClick={undo} className={`p-1.5 hover:bg-white/5 rounded-lg transition-colors ${history.length > 0 ? 'text-white' : 'text-white/30 cursor-not-allowed'}`} title="Undo (Ctrl+Z)" disabled={history.length === 0}><Undo2 size={18}/></button>
                <button onClick={redo} className={`p-1.5 hover:bg-white/5 rounded-lg transition-colors ${future.length > 0 ? 'text-white' : 'text-white/30 cursor-not-allowed'}`} title="Redo (Ctrl+Y)" disabled={future.length === 0}><Redo2 size={18}/></button>
                <button onClick={openCollectionModal} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors ml-1"><FolderPlus size={18}/></button>
            </div>
          </div>
          <div className="flex gap-1 p-2 flex-shrink-0 min-w-[16rem]">
            <button onClick={handleExport} className="flex-1 py-1.5 bg-white/5 rounded text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-1"><Download size={10}/> Export</button>
            <button onClick={() => fileInputRef.current.click()} className="flex-1 py-1.5 bg-white/5 rounded text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-1"><Upload size={10}/> Import</button>
            <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json"/>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 min-w-[16rem] no-swipe-nav" style={{ touchAction: 'pan-y' }}>
            {collections.map((cat, idx) => (
              <div key={cat} onDrop={e => onCollectionDrop(e, cat, idx)} onDragOver={e => onCollectionDragOver(e, idx)} onDragEnter={() => handleDragEnterCategory(cat)} onContextMenu={e => handleCollectionContextMenu(e, cat)} className={`${draggedCollectionIdx === idx ? 'opacity-30' : ''}`} >
                <div draggable onDragStart={(e) => onCollectionDragStart(e, idx)} className="flex items-center justify-between text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] px-2 mb-2 cursor-pointer group hover:bg-white/5 rounded-lg p-1" onClick={() => toggleCategory(cat)} >
                  <div className="flex items-center gap-2"> <GripVertical size={12} className="text-white/20 opacity-0 group-hover:opacity-100 cursor-grab"/> {collapsedCategories.has(cat) ? <ChevronRight size={10}/> : <ChevronDown size={10}/>} {cat} </div>
                  <div className="flex gap-2"> <button onClick={e => toggleSortMode(e, cat)} className="hover:text-white opacity-0 group-hover:opacity-100">{collectionSortModes[cat]==='alpha'?<ArrowDownAZ size={10}/>:<List size={10}/>}</button> <X size={10} className="opacity-0 group-hover:opacity-100 hover:text-red-400" onClick={e => { e.stopPropagation(); const item = { type: 'COLLECTION', label: cat }; setItemToEdit(item); setIsDeleteLibConfirmOpen(true); }}/> </div>
                </div>
                {!collapsedCategories.has(cat) && ( <div className="pl-2 border-l border-white/5"> {getSortedItems(cat).map((item, idx, arr) => renderLibraryItem(item, idx, arr.length))} <div className={`transition-all ${draggedLibId ? 'h-6 border-2 border-dashed border-white/10 rounded flex items-center justify-center mt-1' : 'h-1'}`} onDrop={e => onLibDropToEnd(e, cat)} onDragOver={e => e.preventDefault()}/> </div> )}
              </div>
            ))}
            {library.some(i => i.category === 'root' && !i.type.startsWith('PIN_')) && (
                <div onDrop={e => onLibDropCategory(e, 'root')} onDragOver={e => e.preventDefault()} onDragEnter={() => handleDragEnterCategory('root')}>
                    <div className="flex items-center justify-between text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] px-2 mb-2 mt-4 cursor-pointer" onClick={() => toggleCategory('root')}>
                         <div className="flex items-center gap-2">{collapsedCategories.has('root') ? <ChevronRight size={10}/> : <ChevronDown size={10}/>} <span className="flex items-center gap-2"><FolderOpen size={10}/> Uncategorised</span></div>
                         <button onClick={e => toggleSortMode(e, 'root')} className="hover:text-white">{collectionSortModes['root']==='alpha'?<ArrowDownAZ size={10}/>:<List size={10}/>}</button>
                    </div>
                    {!collapsedCategories.has('root') && getSortedItems('root').filter(i => !i.type.startsWith('PIN_')).map((item, idx, arr) => renderLibraryItem(item, idx, arr.length))}
                    <div className={`transition-all ${draggedLibId ? 'h-6 border-2 border-dashed border-white/10 rounded flex items-center justify-center mt-1' : 'h-1'}`} onDrop={e => onLibDropToEnd(e, 'root')} onDragOver={e => e.preventDefault()}/>
                </div>
            )}
          </div>
          <div className="p-4 border-t border-white/5 space-y-2 bg-[#1a1a1a] flex-shrink-0 min-w-[16rem]">
            <button onClick={handlePackChipClick} className="w-full py-3 bg-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-900/20 hover:bg-indigo-500 transition-all active:scale-95 flex items-center justify-center gap-2"><Save size={16}/> Save Chip</button>
            <button onClick={() => setIsClearConfirmOpen(true)} className="w-full py-2 bg-white/5 rounded-xl text-[9px] font-black uppercase tracking-tighter text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-all">Clear board</button>
          </div>
        </div>

        {/* Workspace */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0a0a0a]">
          {/* Floating Sidebar Toggle Button */}
          {!isSidebarOpen && (
              <button 
                  onClick={() => setIsSidebarOpen(true)} 
                  className="absolute top-3 left-3 z-[60] p-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors shadow-lg"
              >
                  <Menu size={20} />
              </button>
          )}
          
          <button 
              onClick={() => fitToView(nodes)} 
              className="absolute top-3 right-3 z-[60] p-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors shadow-lg"
              title="Fit to Screen"
          >
              <Maximize size={20} />
          </button>

          <div className="flex-1 relative overflow-hidden focus:outline-none overscroll-none" ref={canvasRef} tabIndex={0} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onContextMenu={handleCanvasContextMenu} onMouseLeave={() => { setHoveredWireIndex(null); setHoveredNet(new Set()); }} style={{ touchAction: 'none' }}>
            <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0', width:'100%', height:'100%' }}>
              <svg className="absolute inset-0 overflow-visible pointer-events-auto">
                {wires.map((w, i) => {
                  const n1 = nodeById.get(w.fromNode); const n2 = nodeById.get(w.toNode);
                  if (!n1 || !n2) return null;
                  const p1Entry = portPositions.get(n1.id);
                  const p2Entry = portPositions.get(n2.id);
                  const p1 = (p1Entry && p1Entry.get(`out:${w.fromPort}`)) || getPortPosition(n1, w.fromPort, false);
                  const p2 = (p2Entry && p2Entry.get(`in:${w.toPort}`)) || getPortPosition(n2, w.toPort, true);
                  
                  const portName = (n1.type === 'JOINT') ? 'joint' : w.fromPort;
                  const val = n1.outputState?.[portName];
                  
                  const isBus = Array.isArray(val); 
                  const isActive = isBus ? true : !!val; 

                  const strokeColor = isBus ? COLORS.wireBus : (isActive ? COLORS.wireOn : COLORS.wireOff); 
                  let strokeWidth = 3; if (isBus) strokeWidth = (val?.length || 4) >= 8 ? 9 : 6;
                  
                  const isHovered = hoveredNet.has(i); const displayWidth = isHovered ? strokeWidth * 2 : strokeWidth; const displayColor = isHovered ? (isBus ? '#d8b4fe' : '#fca5a5') : strokeColor;
                  
                  return <g key={`wire-${i}`} onMouseEnter={() => { setHoveredWireIndex(i); setHoveredNet(getNetForWire(i, wires, nodes, wireAdj)); }} onMouseLeave={() => { setHoveredWireIndex(null); setHoveredNet(new Set()); }}> <path d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`} stroke="transparent" strokeWidth="20" fill="none" data-wire-index={i} className="cursor-pointer"/> <path d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`} stroke={displayColor} strokeWidth={displayWidth} fill="none" strokeLinecap="round" className="pointer-events-none transition-all duration-150"/> </g>;
                })}
                {dragState?.type==='WIRE' && <path d={`M ${dragState.startX} ${dragState.startY} L ${dragState.currentX} ${dragState.currentY}`} stroke="white" strokeWidth="2" strokeDasharray="5,5" fill="none"/>}
              </svg>
              {snapTarget && ( <div className="absolute w-6 h-6 border-2 border-white rounded-full animate-ping pointer-events-none" style={{ left: snapTarget.x, top: snapTarget.y, transform: 'translate(-50%, -50%)' }} /> )}
              {nodes.map(n => {
                const inferredType = resolveNodeType(n); const isGate = inferredType !== null; const renderType = inferredType || n.type;
                let libDef = null; if (n.libId) { libDef = library.find(l => l.libId === n.libId); } else if (n.def?.libId) { libDef = library.find(l => l.libId === n.def.libId); }
                const w = n.type==='JOINT'?12:(libDef?.width || n.width || n.def?.width || 80); const h = n.type==='JOINT'?12:(Math.max(libDef?.height || n.height || n.def?.height || 40, Math.max((n.inputs || []).length, (n.outputs || []).length)*20+20));
                
                if (n.type === 'JOINT') {
                    const isSelected = selectedNodeIds.has(n.id);
                    const val = n.outputState?.joint;
                    const isBus = Array.isArray(val);
                    const isHigh = !isBus && !!val;
                    
                    let bgColor = COLORS.nodeJoint; 
                    if (isHigh) bgColor = COLORS.wireOn; 
                    
                    return (
                        <div key={n.id} data-node-wrapper="true" data-node-id={n.id} onDoubleClick={e => handleDoubleClick(e, n.id)}
                            className={`absolute rounded-full transition-all duration-150 shadow-md ${isSelected ? 'scale-125' : ''}`}
                            style={{ 
                                left: n.x, top: n.y, width: 12, height: 12, transform: 'translate(-50%,-50%)', 
                                backgroundColor: isSelected ? COLORS.nodeSelected : bgColor,
                                border: isSelected ? `2px solid #fff` : 'none',
                                zIndex: 10
                            }}>
                            <div data-node-id={n.id} data-port-id="joint" data-is-input="false" className="absolute inset-0 z-50 cursor-crosshair"/>
                        </div>
                    );
                }
                return (
                <div key={n.id} data-node-wrapper="true" data-node-id={n.id} onDoubleClick={e => handleDoubleClick(e, n.id)} className={`absolute flex items-center justify-center transition-all duration-150 ${isGate ? '' : n.type === 'COMMENT' ? 'rounded-xl shadow-lg border-2 bg-yellow-900/40 border-yellow-600/50' : 'rounded-xl shadow-2xl border-2 bg-[#222222]'}`} style={{ left: n.x, top: n.y, width: w, height: h, transform: 'translate(-50%,-50%)', borderColor: selectedNodeIds.has(n.id) ? COLORS.nodeSelected : (n.type === 'COMMENT' ? undefined : (n.type === 'CLOCK' ? (n.outputState?.out ? COLORS.wireOn : '#333') : (n.state ? COLORS.wireOn : (n.def?.color || '#333')))) }}>
                  {isGate ? (
                      <div className="relative w-full h-full"> <GateRenderer type={renderType} width={w} height={h} color={selectedNodeIds.has(n.id) ? COLORS.nodeSelected : (n.outputState?.out ? COLORS.wireOn : '#e0e0e0')} /> <div className="absolute inset-0 flex items-center justify-center pointer-events-none"> {editingNodeId === n.id ? ( <input autoFocus className="bg-black/50 text-white text-[10px] text-center w-16 outline-none p-0.5 rounded pointer-events-auto" value={n.label} onChange={e => setNodes(nodes.map(x=>x.id===n.id?{...x, label:e.target.value}:x))} onBlur={()=>{setEditingNodeId(null);markDirty();}} onKeyDown={(e) => { if(e.key === 'Enter') { setEditingNodeId(null); markDirty(); } e.stopPropagation(); }} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}/> ) : ( <span onDoubleClick={(e)=>{e.stopPropagation(); setEditingNodeId(n.id);}} className="text-[10px] font-bold text-white/50 cursor-text pointer-events-auto">{n.label}</span> )} </div> </div>
                  ) : (
                    <>
                    { n.type === '7SEG' ? ( <div className="relative w-full h-full p-2 flex flex-col items-center"> <div className="flex-1 w-full relative"> <svg viewBox="0 0 60 100" className="w-full h-full overflow-visible"> <path d="M 10 10 L 50 10 L 45 15 L 15 15 Z" fill={n.state?.a ? '#ef4444' : '#331111'} /> <path d="M 50 10 L 55 15 L 55 45 L 50 50 L 45 45 L 45 15 Z" fill={n.state?.b ? '#ef4444' : '#331111'} /> <path d="M 50 50 L 55 55 L 55 85 L 50 90 L 45 85 L 45 55 Z" fill={n.state?.c ? '#ef4444' : '#331111'} /> <path d="M 10 90 L 50 90 L 45 85 L 15 85 Z" fill={n.state?.d ? '#ef4444' : '#331111'} /> <path d="M 10 50 L 15 55 L 15 85 L 10 90 L 5 85 L 5 55 Z" fill={n.state?.e ? '#ef4444' : '#331111'} /> <path d="M 10 10 L 15 15 L 15 45 L 10 50 L 5 45 L 5 15 Z" fill={n.state?.f ? '#ef4444' : '#331111'} /> <path d="M 10 50 L 50 50 L 45 55 L 15 55 L 10 50 L 15 45 L 45 45 Z" fill={n.state?.g ? '#ef4444' : '#331111'} /> <circle cx="55" cy="90" r="3" fill={n.state?.dp ? '#ef4444' : '#331111'} /> </svg> </div> {editingNodeId === n.id ? ( <input autoFocus className="bg-black/50 text-white text-[10px] text-center w-full outline-none p-0.5 rounded pointer-events-auto mt-1" value={n.label} onChange={e => setNodes(nodes.map(x=>x.id===n.id?{...x, label:e.target.value}:x))} onBlur={()=>{setEditingNodeId(null);markDirty();}} onKeyDown={(e) => { if(e.key === 'Enter') {setEditingNodeId(null);markDirty();} e.stopPropagation(); }} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}/> ) : ( <span onDoubleClick={(e)=>{e.stopPropagation(); setEditingNodeId(n.id);}} className="text-[10px] font-bold text-white/50 cursor-text pointer-events-auto mt-1 whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">{n.label}</span> )} </div> ) : ( (n.type === 'PIN_IN_4' || n.type === 'PIN_IN_8') ? ( <div className="absolute inset-0 flex flex-col items-center justify-start pt-0.5 px-0.5"> {editingNodeId === n.id ? ( <input autoFocus className="bg-black/50 text-white text-[8px] text-center w-full outline-none p-0 rounded pointer-events-auto mb-0.5" value={n.label} onChange={e => setNodes(nodes.map(x=>x.id===n.id?{...x, label:e.target.value}:x))} onBlur={()=>{setEditingNodeId(null);markDirty();}} onKeyDown={(e) => { if(e.key === 'Enter') {setEditingNodeId(null);markDirty();} e.stopPropagation(); }} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}/> ) : ( <span onDoubleClick={(e)=>{e.stopPropagation(); setEditingNodeId(n.id);}} className="text-[8px] font-bold text-white/50 cursor-text pointer-events-auto mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis w-full text-center leading-tight">{n.label}</span> )} <div className={`grid ${n.type.includes('8') ? 'grid-cols-4 grid-rows-2' : 'grid-cols-4 grid-rows-1'} gap-0.5 w-full flex justify-items-center`}> {n.type.includes('8') ? ( <> {[7,6,5,4].map(bit => ( <div key={bit} className={`aspect-square w-full rounded border transition-colors ${n.state?.[bit] ? 'bg-green-500 border-green-400 shadow-[0_0_5px_rgba(74,222,128,0.5)]' : 'bg-black/50 border-white/10'}`} /> ))} {[3,2,1,0].map(bit => ( <div key={bit} className={`aspect-square w-full rounded border transition-colors ${n.state?.[bit] ? 'bg-green-500 border-green-400 shadow-[0_0_5px_rgba(74,222,128,0.5)]' : 'bg-black/50 border-white/10'}`} /> ))} </> ) : ( [3,2,1,0].map(bit => ( <div key={bit} className={`aspect-square w-full rounded border transition-colors ${n.state?.[bit] ? 'bg-green-500 border-green-400 shadow-[0_0_5px_rgba(74,222,128,0.5)]' : 'bg-black/50 border-white/10'}`} /> )) )} </div> </div> ) : (n.type === 'PIN_OUT_4' || n.type === 'PIN_OUT_8') ? ( <div className="absolute inset-0 flex flex-col items-center justify-center font-mono font-bold text-white"> {editingNodeId === n.id ? ( <input autoFocus className="bg-black/50 text-white text-[8px] text-center w-16 outline-none p-0.5 rounded pointer-events-auto mb-1" value={n.label} onChange={e => setNodes(nodes.map(x=>x.id===n.id?{...x, label:e.target.value}:x))} onBlur={()=>{setEditingNodeId(null);markDirty();}} onKeyDown={(e) => { if(e.key === 'Enter') {setEditingNodeId(null);markDirty();} e.stopPropagation(); }} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}/> ) : ( <span onDoubleClick={(e)=>{e.stopPropagation(); setEditingNodeId(n.id);}} className="text-[8px] opacity-50 mb-1 cursor-text pointer-events-auto">{n.label}</span> )} <span className="text-sm bg-black/50 px-2 rounded text-emerald-400"> {boolsToVal(n.state || []).toString(16).toUpperCase().padStart(n.type.includes('4')?1:2, '0')} </span> </div> ) : (n.type === 'CLOCK') ? ( <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"> {editingNodeId === n.id ? ( <input autoFocus className="bg-black/50 text-white text-[8px] text-center w-16 outline-none p-0.5 rounded pointer-events-auto mb-1" value={n.label} onChange={e => setNodes(nodes.map(x=>x.id===n.id?{...x, label:e.target.value}:x))} onBlur={()=>{setEditingNodeId(null);markDirty();}} onKeyDown={(e) => { if(e.key === 'Enter') {setEditingNodeId(null);markDirty();} e.stopPropagation(); }} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}/> ) : ( <span onDoubleClick={(e)=>{e.stopPropagation(); setEditingNodeId(n.id);}} className="text-[8px] font-bold text-white/50 mb-1 cursor-text pointer-events-auto">{n.label}</span> )} <div className="text-xs font-black text-emerald-400 mb-1">{n.freq || 1} Hz</div> <div className="flex gap-1 pointer-events-auto"> <div data-action="clock-dec" data-node-id={n.id} className="w-4 h-4 bg-white/10 hover:bg-white/20 rounded flex items-center justify-center text-[10px] cursor-pointer">-</div> <div data-action="clock-toggle" data-node-id={n.id} className="w-4 h-4 bg-white/10 hover:bg-white/20 rounded flex items-center justify-center text-[10px] cursor-pointer"> {n.running === false ? <Play size={10} className="pointer-events-none"/> : <Square size={8} className="pointer-events-none fill-current"/>} </div> <div data-action="clock-inc" data-node-id={n.id} className="w-4 h-4 bg-white/10 hover:bg-white/20 rounded flex items-center justify-center text-[10px] cursor-pointer">+</div> </div> </div> ) : (n.type === 'COMMENT') ? ( <div className="absolute inset-0 p-2 flex flex-col"> {editingNodeId === n.id ? ( <textarea autoFocus className="w-full h-full bg-transparent text-white/90 text-[10px] outline-none resize-none font-mono leading-tight pointer-events-auto" value={n.label} onChange={e => setNodes(nodes.map(x=>x.id===n.id?{...x, label:e.target.value}:x))} onBlur={() => { if (!n.label.trim()) { setNodes(nodes.map(x => x.id === n.id ? { ...x, label: 'Comment' } : x)); } setEditingNodeId(null); markDirty(); }} onKeyDown={(e) => { e.stopPropagation(); }} onMouseDown={e=>e.stopPropagation()} /> ) : ( <div onDoubleClick={(e)=>{ e.stopPropagation(); if (n.label === 'Comment') { setNodes(nodes.map(x => x.id === n.id ? { ...x, label: '' } : x)); } setEditingNodeId(n.id); }} className="w-full h-full text-[10px] text-white/70 font-mono whitespace-pre-wrap leading-tight cursor-text pointer-events-auto overflow-hidden select-text" > {n.label} </div> )} </div> ) : ( n.type !== 'JOINT' && (editingNodeId===n.id ? <input autoFocus className="bg-black text-white text-[10px] text-center w-full outline-none p-1 rounded-lg pointer-events-auto" value={n.label} onChange={e => setNodes(nodes.map(x=>x.id===n.id?{...x, label:e.target.value}:x))} onBlur={()=>{setEditingNodeId(null);markDirty();}} onKeyDown={(e) => { if(e.key === 'Enter') {setEditingNodeId(null);markDirty();} e.stopPropagation(); }} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}/> : ( <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-1"> 
                    <ChipFace node={n} onLabelDoubleClick={(e) => { e.stopPropagation(); setEditingNodeId(n.id); }} />
                </div> ))) ) } </> )} {n.inputs?.map((inp, idx) => { const marginTop = (idx - (n.inputs.length-1)/2)*20; const isBusPin = inp.isBus || (inp.label && (inp.label.includes('8b') || inp.label.includes('4b'))); return ( <div key={inp.id} data-node-id={n.id} data-port-id={inp.id} data-is-input="true" className="absolute flex items-center group/pin" style={{ left: -6, top: '50%', marginTop: marginTop - 6 }}> <div className="w-5 h-5 absolute -left-2.5 -top-2.5 z-50 cursor-crosshair"/> <div className={`w-3 h-3 ${isBusPin ? 'rounded-sm bg-purple-500' : 'rounded-full bg-white/10'} border border-white/5 hover:scale-125 transition-transform z-40 pointer-events-none`}/> <span className="absolute left-4 text-[8px] text-white/30 opacity-0 group-hover/pin:opacity-100 pointer-events-none whitespace-nowrap">{inp.label}</span> </div> ) })} {n.outputs?.map((out, idx) => { const marginTop = (idx - (n.outputs.length-1)/2)*20; const isBusPin = out.isBus || (out.label && (out.label.includes('8b') || out.label.includes('4b'))); return ( <div key={out.id} data-node-id={n.id} data-port-id={out.id} data-is-input="false" className="absolute flex items-center justify-end group/pin" style={{ right: -6, top: '50%', marginTop: marginTop - 6 }}> <div className="w-5 h-5 absolute -right-2.5 -top-2.5 z-50 cursor-crosshair"/> <div className={`w-3 h-3 ${isBusPin ? 'rounded-sm bg-purple-500' : 'rounded-full bg-white/10'} border border-white/5 hover:scale-125 transition-transform z-40 pointer-events-none`}/> <span className="absolute right-4 text-[8px] text-white/30 opacity-0 group-hover/pin:opacity-100 pointer-events-none whitespace-nowrap">{out.label}</span> </div> ) })} </div> )})}
              {placementQueue.length > 0 && ( <div className="absolute pointer-events-none opacity-50 z-50" style={{ left: mousePos.worldX, top: mousePos.worldY }}> {placementQueue.map((item, idx) => ( <div key={idx} className="absolute border-2 border-dashed border-white/50 rounded flex items-center justify-center bg-white/10" style={{ width: 80, height: 40, top: idx*50, transform: 'translate(-50%, -50%)' }}> <span className="text-[10px] font-bold text-white">{item.label}</span> </div> ))} </div> )}
              {dragState?.type==='SELECT' && <div className="absolute border border-blue-500 bg-blue-500/10 rounded-lg pointer-events-none" style={{ left: Math.min(dragState.startX, dragState.currentX), top: Math.min(dragState.startY, dragState.currentY), width: Math.abs(dragState.currentX - dragState.startX), height: Math.abs(dragState.currentY - dragState.startY) }}/>}
            </div>
          </div>
          <div className="h-12 bg-[#0d0d0d] border-t border-white/5 flex items-center px-4 gap-2 justify-between no-swipe-nav" style={{ touchAction: 'pan-x' }}>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar no-swipe-nav">
                {tabs.map(t => { return ( <div key={t.id} onClick={() => switchToTab(t.id)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer flex items-center gap-4 transition-all flex-shrink-0 ${activeTabId===t.id ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-900/40' : 'bg-white/5 text-white/30 hover:bg-white/10 relative group'}`}> <span className="flex items-center gap-1"> {t.title} {t.dirty && <span className="text-orange-400 text-xs">*</span>} </span> {t.id!=='main' && <X size={12} className="hover:text-red-400 ml-2" onClick={e => attemptCloseTab(e, t.id)}/>} </div> ); })}
            </div>
          </div>
        </div>
      </div>

      {contextMenu && (
        <div className="fixed bg-[#1a1a1a] border border-white/10 shadow-2xl rounded-2xl py-1.5 z-[100] w-44 overflow-hidden backdrop-blur-xl" style={{ top: contextMenu.y, left: contextMenu.x }} onMouseDown={e => e.stopPropagation()} >
          {contextMenu.type === 'LIBRARY' ? ( <> <button onClick={initRenameLibItem} className="w-full text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-white/5 flex items-center gap-3 transition-colors"><Edit3 size={16} className="text-indigo-400"/> Rename</button> <button onClick={initDeleteLibItem} className="w-full text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-red-500/10 text-red-400 flex items-center gap-3 transition-colors"><Trash2 size={16}/> Delete</button> {contextMenu.item.type === 'CUSTOM' && <button onClick={handleEditSource} className="w-full text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-white/5 flex items-center gap-3 transition-colors"><Cpu size={16} className="text-emerald-400"/> Edit Source</button>} </> ) 
          : contextMenu.type === 'COLLECTION' ? ( <> <button onClick={() => { setRenameValue(itemToEdit.label); setIsRenameModalOpen(true); setContextMenu(null); }} className="w-full text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-white/5 flex items-center gap-3 transition-colors"><Edit3 size={16} className="text-indigo-400"/> Rename</button> <button onClick={initDeleteLibItem} className="w-full text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-red-500/10 text-red-400 flex items-center gap-3 transition-colors"><Trash2 size={16}/> Delete</button> </> ) 
          : ( <> <button onClick={() => { setEditingNodeId(contextMenu.item.id); setContextMenu(null); }} className="w-full text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-white/5 flex items-center gap-3 transition-colors"><Edit3 size={16} className="text-indigo-400"/> Rename</button> <button onClick={() => { setNodes(prev => prev.filter(n => n.id !== contextMenu.item.id)); setWires(prev => prev.filter(w => w.fromNode !== contextMenu.item.id && w.toNode !== contextMenu.item.id)); setContextMenu(null); showStatus("Deleted"); markDirty(); }} className="w-full text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-red-500/10 text-red-400 flex items-center gap-3 transition-colors"><Trash2 size={16}/> Delete</button> <button onClick={() => { const selected = new Set([contextMenu.item.id]); const nodesToCopy = nodes.filter(n => selected.has(n.id)); setClipboard({ nodes: JSON.parse(JSON.stringify(nodesToCopy)), wires: [], centroid: { x: contextMenu.item.x, y: contextMenu.item.y } }); showStatus("Copied"); setContextMenu(null); }} className="w-full text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-white/5 flex items-center gap-3 transition-colors"><Copy size={16} className="text-blue-400"/> Copy</button> {contextMenu.item.type === 'CUSTOM' && <button onClick={handleEditSource} className="w-full text-left px-5 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-white/5 flex items-center gap-3 transition-colors"><Cpu size={16} className="text-emerald-400"/> Edit Source</button>} </> )}
        </div>
      )}

      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <div className="bg-[#1a1a1a] p-10 rounded-[3rem] w-full max-w-sm border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] max-h-[90vh] overflow-y-auto flex flex-col no-swipe-nav">
            <h2 className="text-3xl font-black mb-2 tracking-tighter uppercase">Save Chip</h2>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.3em] mb-8">Same name will overwrite original</p>
            <input autoFocus className="w-full bg-[#0a0a0a] border border-white/5 rounded-3xl p-5 mb-8 text-white outline-none focus:border-indigo-500 transition-all font-bold flex-shrink-0" value={saveName} onChange={e=>setSaveName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&confirmSaveChip()}/>
            {saveDisplayCandidates.length > 0 && (
                <div className="mb-8 flex-1 overflow-y-auto min-h-0 no-swipe-nav">
                    <h3 className="text-[10px] text-white/30 font-bold uppercase tracking-[0.3em] mb-4">Show on Chip Face</h3>
                    <div className="space-y-2">
                        {saveDisplayCandidates.map(node => ( <div key={node.id} className={`p-3 rounded-xl border border-white/5 flex items-center justify-between cursor-pointer transition-colors ${saveDisplaySelection.has(node.id) ? 'bg-indigo-900/30 border-indigo-500/50' : 'bg-black/20 hover:bg-white/5'}`} onClick={() => setSaveDisplaySelection(prev => { const next = new Set(prev); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next; })} > <div className="flex items-center gap-3"> {saveDisplaySelection.has(node.id) ? <Eye size={14} className="text-indigo-400"/> : <EyeOff size={14} className="text-white/20"/>} <span className="text-xs font-bold text-white/80">{node.label}</span> </div> <span className="text-[9px] font-black uppercase text-white/20 bg-white/5 px-2 py-1 rounded">{node.type}</span> </div> ))}
                    </div>
                </div>
            )}
            <div className="flex gap-4 mt-auto flex-shrink-0">
              <button onClick={()=>setIsSaveModalOpen(false)} className="flex-1 py-5 text-white/40 font-black uppercase text-[10px] tracking-widest">Cancel</button>
              <button onClick={confirmSaveChip} className="flex-2 px-10 py-5 bg-indigo-600 rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-900/20">Confirm Save</button>
            </div>
          </div>
        </div>
      )}

      {isRenameModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <div className="bg-[#1a1a1a] p-10 rounded-[3rem] w-full max-w-sm border border-white/10 shadow-2xl">
            <h2 className="text-3xl font-black mb-8 tracking-tighter uppercase">Rename</h2>
            <input autoFocus className="w-full bg-[#0a0a0a] border border-white/5 rounded-3xl p-5 mb-8 text-white outline-none focus:border-indigo-500 transition-all font-bold" value={renameValue} onChange={e=>setRenameValue(e.target.value)} onKeyDown={e=>e.key==='Enter'&&confirmRenameLibItem()}/>
            <div className="flex gap-4">
              <button onClick={()=>setIsRenameModalOpen(false)} className="flex-1 py-5 text-white/40 font-black uppercase text-[10px]">Cancel</button>
              <button onClick={confirmRenameLibItem} className="flex-2 px-10 py-5 bg-indigo-600 rounded-3xl font-black text-[10px] uppercase tracking-widest">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {isDeleteLibConfirmOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <div className="bg-[#1a1a1a] p-10 rounded-[3rem] w-full max-w-sm border border-white/10 shadow-2xl">
            <h2 className="text-3xl font-black mb-4 text-red-500 tracking-tighter uppercase">Delete?</h2>
            <p className="text-sm text-white/50 font-bold mb-8 leading-relaxed"> {itemToEdit?.type === 'COLLECTION' ? `Remove folder '${itemToEdit?.label}'? Components inside will be moved to Uncategorised.` : `Remove '${itemToEdit?.label}'? This will break existing circuits using it.`} </p>
            <div className="flex gap-4">
              <button onClick={()=>setIsDeleteLibConfirmOpen(false)} className="flex-1 py-5 text-white/40 font-black uppercase text-[10px]">Back</button>
              <button onClick={confirmDeleteLibItem} className="flex-2 px-10 py-5 bg-red-600 rounded-3xl font-black text-[10px] uppercase tracking-widest">Delete</button>
            </div>
          </div>
        </div>
      )}

      {isUnsavedModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <div className="bg-[#1a1a1a] p-10 rounded-[3rem] w-full max-w-sm border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)]">
            <h2 className="text-3xl font-black mb-2 tracking-tighter uppercase">Unsaved Changes</h2>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.3em] mb-8">Save before closing?</p>
            <div className="flex gap-4">
                <button onClick={handleUnsavedDiscard} className="flex-1 py-5 text-red-400 font-black uppercase text-[10px] tracking-widest hover:bg-red-500/10 rounded-3xl">Discard</button>
                <button onClick={() => setIsUnsavedModalOpen(false)} className="flex-1 py-5 text-white/40 font-black uppercase text-[10px] tracking-widest">Cancel</button>
                <button onClick={handleUnsavedSave} className="flex-2 px-10 py-5 bg-indigo-600 rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-900/20">Save</button>
            </div>
          </div>
        </div>
      )}

      {isClearConfirmOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4 text-center">
          <div className="bg-[#1a1a1a] p-10 rounded-[3rem] w-full max-w-sm border border-white/10 shadow-2xl">
            <h2 className="text-3xl font-black mb-4 text-red-500 tracking-tighter uppercase">Clear board</h2>
            <p className="text-sm text-white/50 font-bold mb-8 leading-relaxed">This wipes the active workspace only. Your library remains untouched.</p>
            <div className="flex gap-4">
              <button onClick={()=>setIsClearConfirmOpen(false)} className="flex-1 py-5 text-white/40 font-black uppercase text-[10px]">Cancel</button>
              <button onClick={() => { setNodes([]); setWires([]); setSelectedNodeIds(new Set()); setIsClearConfirmOpen(false); showStatus("Board Cleared"); }} className="flex-2 px-10 py-5 bg-red-600 rounded-3xl font-black text-[10px] uppercase tracking-widest">Wipe Workspace</button>
            </div>
          </div>
        </div>
      )}

      {isCollectionModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-4 text-center">
          <div className="bg-[#1a1a1a] p-10 rounded-[3rem] w-full max-w-sm border border-white/10 shadow-2xl">
            <h2 className="text-3xl font-black mb-8 tracking-tighter uppercase">New Folder</h2>
            <input autoFocus className="w-full bg-[#0a0a0a] border border-white/5 rounded-3xl p-5 mb-8 text-white outline-none focus:border-indigo-500 transition-all font-bold" value={newCollectionName} onChange={e=>setNewCollectionName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&confirmCreateCollection()}/>
            <div className="flex gap-4">
              <button onClick={()=>setIsCollectionModalOpen(false)} className="flex-1 py-5 text-white/40 font-black uppercase text-[10px]">Cancel</button>
              <button onClick={confirmCreateCollection} className="flex-2 px-10 py-5 bg-indigo-600 rounded-3xl font-black text-[10px] uppercase tracking-widest">Create</button>
            </div>
          </div>
        </div>
      )}

      {statusMsg && (
        <div className={`fixed top-8 left-1/2 -translate-x-1/2 px-8 py-3.5 rounded-full shadow-2xl border border-white/10 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest z-[300] transition-all animate-in slide-in-from-top-4 duration-1000 ${statusMsg.type === 'error' ? 'bg-red-600/90 text-white' : 'bg-indigo-600/90 text-white'}`}>
          {statusMsg.type === 'error' ? <AlertCircle size={14}/> : <CheckCircle size={14}/>} 
          {typeof statusMsg.text === 'string' ? statusMsg.text : 'Notification'}
        </div>
      )}
    </div>
  );
}
