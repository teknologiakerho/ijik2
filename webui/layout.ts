import m from "mithril";
import {Pluggable, plugger} from "./components";
import {OverlayLayer} from "./overlay";

type MenuEntry = Pluggable & {
	icon: string;
	onclick: () => void;
	isActive?: () => boolean;
	help?: string|m.ComponentTypes;
};

const menus: MenuEntry[] = [];
export const menu = plugger(menus);

/*
menus.map(item => m(
	item.icon
	+".text-white.text-2xl.cursor-pointer.w-14.h-14.hover:bg-green-500"
	+".text-center[style='line-height: 3.5rem']"
	+(item.isActive?.() ? ".bg-green-500" : ""),
	{ onclick: item.onclick }
))
*/

const SideBarIcon: m.Component<{
	entry: MenuEntry
}> = {
	view: vnode => m(
		".group.relative.text-white.cursor-pointer.outline-none[tabindex=0]"
		+(vnode.attrs.entry.isActive?.() ? ".bg-green-500" : ""),
		{ onclick: vnode.attrs.entry.onclick },
		m(vnode.attrs.entry.icon+".w-14.h-14.text-2xl.text-center[style='line-height: 3.5rem']"),
		m(
			".absolute.hidden.group-hover:flex.group-focus:hidden.h-14.bg-green-600"
			+".top-0.left-auto.right-14.md:left-14.md:right-auto.px-2"
			+".whitespace-nowrap.font-bold.items-center",
			vnode.attrs.entry.title
		)
	)
};

export const Layout: m.ClosureComponent<{
	top?: m.ComponentTypes
}> = () => {

	let drawMenu = false;
	const toggleMenu = () => drawMenu = !drawMenu;

	return {
		view: vnode => [
			m(OverlayLayer),
			m(
				// this relative+zindex hack is needed to make tooltips show over the toolbar.
				// if the content area doesn't overlap the toolbar, then tooltips won't be able
				// to pop out of scrollable content area because of the overflow-auto property.
				// we fix this by overlapping the content area and the toolbar.

				".relative.w-screen.h-screen",

				// cast as any because the mithril.d.ts types are wrong
				(m as any)(
					".absolute.inset-y-0.left-auto.right-0.md:left-0.md:right-auto.mt-14.md:mt-0"
					+".w-14.bg-green-600"
					+".md:flex.flex-col.items-center[style='z-index:1']",
					{ class: drawMenu ? "flex" : "hidden", onclick: toggleMenu },
					menus.map(entry => m(SideBarIcon, { entry }))
				),

				m(
					".absolute.inset-0.md:pl-14.overflow-auto",
					undefined,

					(m as any)(
						".w-full.h-14.bg-green-600.text-white.md:bg-gray-100.md:text-black.pl-4.flex.items-center",
						{ class: (!vnode.attrs.top) && "md:hidden" },
						vnode.attrs.top && m(vnode.attrs.top),
						m(
							".md:hidden.ml-auto.mr-4.cursor-pointer.text-2xl",
							{ onclick: toggleMenu },
							m("i.fas.fa-bars")
						)
					),
					vnode.children
				)
			)
		]
	};
};

export const Help: m.Component = {
	view: () => m(
		"table",
		menus.map(item => item.help && m(
			"tr",
			m("td.p-2.text-green-600", m(item.icon)),
			m(
				"td.p-2.text-sm.text-gray-800",
				typeof item.help === "string" ? m.trust(item.help) : m(item.help)
			)
		))
	)
};
