/* Winziger DOM-Helfer. Kein Framework, keine virtuelle DOM-Schicht:
   der Player rendert immer einen ganzen Bildschirm neu, und ein
   Bildschirm hat selten mehr als 60 Knoten.                        */

export function h(tag, props = null, ...children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
      else if (key === "bind") node.setAttribute("data-bind", value);
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === true) node.setAttribute(key, "");
      else node.setAttribute(key, value);
    }
  }
  append(node, children);
  return node;
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/* Bild-URL aus dem Asset-Speicher. Assets liegen als Data-URL im
   Dokument, damit der Export eine einzige Datei bleibt.            */
export function assetUrl(cfg, id) {
  const asset = cfg?.assets?.[id];
  if (!asset) return null;
  return asset.data || null;
}
