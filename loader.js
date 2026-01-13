const CDN_IMPORTS = {
  react: 'https://esm.sh/react@18',
  'react-dom/client': 'https://esm.sh/react-dom@18/client',
  'lucide-react': 'https://esm.sh/lucide-react',
  'firebase/app': 'https://esm.sh/firebase@10/app',
  'firebase/auth': 'https://esm.sh/firebase@10/auth',
  'firebase/firestore': 'https://esm.sh/firebase@10/firestore'
};

const importRegex = /(?:import|export)\s+(?:[^'\"]+from\s+)?['\"]([^'\"]+)['\"]/g;
const moduleCache = new Map();
const embeddedSources = new Map();

const isBareSpecifier = (specifier) => !specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith('http://') && !specifier.startsWith('https://');

const rewriteImports = (code, depMap) => {
  return code.replace(/((?:import|export)\s+(?:[^'\"]+from\s+)?['\"])([^'\"]+)(['\"])/g, (match, prefix, specifier, suffix) => {
    const replacement = depMap.get(specifier);
    if (!replacement) return match;
    return `${prefix}${replacement}${suffix}`;
  });
};

const extractSpecifiers = (source) => {
  const specifiers = [];
  for (const match of source.matchAll(importRegex)) {
    specifiers.push(match[1]);
  }
  return specifiers;
};

const loadEmbeddedSources = () => {
  const scripts = document.querySelectorAll('script[data-module]');
  scripts.forEach((script) => {
    const key = script.getAttribute('data-module');
    if (!key) return;
    const url = new URL(key, location.href).href;
    embeddedSources.set(url, script.textContent || '');
  });
};

const getSourceForUrl = async (url) => {
  if (embeddedSources.has(url)) return embeddedSources.get(url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.text();
};

const compileModule = async (url) => {
  if (moduleCache.has(url)) return moduleCache.get(url);

  const source = await getSourceForUrl(url);
  const specifiers = extractSpecifiers(source);
  const depMap = new Map();

  for (const specifier of specifiers) {
    if (isBareSpecifier(specifier)) {
      depMap.set(specifier, CDN_IMPORTS[specifier] || specifier);
      continue;
    }

    const resolved = new URL(specifier, url).href;
    const compiled = await compileModule(resolved);
    depMap.set(specifier, compiled);
  }

  const transformed = Babel.transform(source, {
    presets: [['react', { runtime: 'classic' }]],
    sourceType: 'module'
  }).code;

  const rewritten = rewriteImports(transformed, depMap);
  const blobUrl = URL.createObjectURL(new Blob([rewritten], { type: 'text/javascript' }));
  moduleCache.set(url, blobUrl);
  return blobUrl;
};

const showError = (error) => {
  const root = document.getElementById('root') || document.body;
  const pre = document.createElement('pre');
  pre.style.whiteSpace = 'pre-wrap';
  pre.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  pre.style.fontSize = '12px';
  pre.style.padding = '12px';
  pre.style.color = '#b91c1c';
  pre.textContent = `LogicSim failed to start:\n${String(error)}`;
  root.appendChild(pre);
};

const startApp = async () => {
  loadEmbeddedSources();
  const entryUrl = new URL('./src/main.jsx', import.meta.url).href;
  const compiled = await compileModule(entryUrl);
  await import(compiled);
};

startApp().catch((error) => {
  console.error('Failed to start LogicSim:', error);
  showError(error);
});
