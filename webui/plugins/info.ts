import m from "mithril";
import {ijik} from "../editor";
import {Help, Layout, menu} from "../layout";
import {$} from "../messages";
import {route} from "../routes";
import {PluggableComponent, action, plugger, triangle} from "../components";

$.defaults({
	"info:header": "<div class='p-4 text-xl text-center'>"
		+"Tervetuloa <span class='text-green-600'>IjIk</span>-ilmoittautumisjärjestelmään",
	"info:help": () => "Aloitusnäyttö"
		+((m.route.get() === "/" || m.route.get() === "") ? " (Tämä sivu)" : ""),
	"info:links-title": "Tietoa ilmoittautumisjärjestelmästä",
	"info:logout-title": "Kirjaudu ulos",
	"info:logout-help": "Kirjaudu ulos ilmoittautumisjärjestelmästä. "
		+"Voit jatkaa ilmoittautumista myöhemmin henkilökohtaisella linkilläsi",
	"info:views-title": "Ilmoittautumisnäkymät",
	"info:title": "Aloitusnäyttö",
});

const infoPanels: PluggableComponent[] = [
	{
		title: $("info:views-title"),
		order: -100,
		component: Help
	},
	{
		title: $("info:links-title"),
		order: 100,
		component: {
			view: () => m(
				"table",
				m(
					"tr",
					m("td.p-2", m("i.fab.fa-github")),
					m("td.p-2", m(
						"a",
						{href: "https://github.com/teknologiakerho/ijik2"},
						"teknologiakerho/ijik2"
					))
				),
				m(
					"tr",
					m("td.p-2", m("i.fas.fa-globe")),
					m("td.p-2", m(
						"a.text-blue-600",
						{href: "https://teknologiakerho.fi"},
						"teknologiakerho.fi"
					))
				)
			)
		}
	}	
];

export const infoPanel = plugger(infoPanels);

type Action = PluggableComponent & { help: string|m.ComponentTypes };

const actions: Action[] = [
	{
		title: $("info:logout-title"),
		order: -100,
		component: {
			view: () => action({
				element: "a[href='/logout'].block.px-6.bg-red-500.hover:bg-red-600",
				children: $("info:logout-title")
			})
		},
		help: $("info:logout-help")
	}
];

export const homeAction = plugger(actions);

const notifications: m.ComponentTypes[] = [];
export const homeNotification = (component: m.ComponentTypes) => notifications.push(component);

const InfoPage: m.Component = {
	view: () => [
		m.trust($("info:header")),
		notifications.length > 0 && m(
			".p-4.space-y-4",
			notifications.map(notification => m(notification))
		),
		m(
			"table.border-collapse.m-0.sm:m-8.text-sm.sm:text-base",
			actions.map(action => m(
				"tr.group",
				m("td.p-2", m(action.component)),
				m(
					"td.text-gray-800.group-hover:text-black.p-2.sm:pl-4",
					typeof(action.help) === "string" ? action.help : m(action.help)
				)	
			))
		),
		infoPanels.map(panel => m(
			".my-4",
			m(".bg-gray-100.font-bold.p-2", panel.title),
			m(
				".ml-8",
				m(panel.component)
			)
		))
	]
};

ijik.plugins.info = () => {
	route("/", {
		render: () => m(
			Layout,
			m(InfoPage)
		)
	});

	menu({
		title: $("info:title"),
		order: -100,
		icon: "i.fas.fa-home",
		onclick: () => m.route.set("/"),
		isActive: () => m.route.get() === "/",
		help: {
			view: () => $("info:help")
		}
	});

	menu({
		title: $("info:logout-title"),
		order: 100,
		icon: "i.fas.fa-sign-out-alt.bg-green-700",
		onclick: () => window.location.href = "/logout"
	});
};
