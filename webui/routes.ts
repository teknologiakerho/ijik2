import m from "mithril";

const routes = {};

export const route = (path: string, component) => {
	routes[path] = component;
};

export const startRouter = ($root: HTMLElement) => {
	m.route($root, "/", routes);
}

export const routeHome = () => m.route.set("/");
