import m from "mithril";

const overlays: m.ComponentTypes[] = [];
export const overlay = (layer: m.ComponentTypes) => overlays.push(layer);

export const OverlayLayer: m.Component = {
	view: vnode => overlays.map(component => m(component))
};
