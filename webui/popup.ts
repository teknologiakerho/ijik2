import m from "mithril";
import {overlay} from "./overlay";

type Render = () => m.Vnode;
let activePopup: Render|undefined;
export const dismissPopup = () => activePopup = undefined;
export const setPopup = <T>(component: m.ComponentTypes<T>, attrs?: T) =>
	activePopup = () => m(component, attrs as T);

const PopupHost: m.Component = {
	view: () => activePopup?.()
};

export const setup = () => {
	overlay(PopupHost);
};
