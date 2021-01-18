import m from "mithril";
import {ijik} from "../editor";
import {Help, Layout, menu} from "../layout";
import {route} from "../routes";
import {PluggableComponent, action, plugger, triangle} from "../components";

const infoPanels: PluggableComponent[] = [
	{
		title: "Ilmoittautumisnäkymät",
		order: -100,
		component: Help
	},
	{
		title: "Tietoa ilmoittautumisjärjestelmästä",
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
		title: "Kirjaudu ulos",
		order: -100,
		component: {
			view: () => action({
				element: "a[href='/logout'].px-6.bg-red-500.hover:bg-red-600",
				children: "Kirjaudu ulos"
			})
		},
		help: "Kirjaudu ulos ilmoittautumisjärjestelmästä. Voit jatkaa ilmoittautumista myöhemmin"
			+" henkilökohtaisella linkilläsi."
	}
];

export const homeAction = plugger(actions);

const notifications: m.ComponentTypes[] = [];
export const homeNotification = (component: m.ComponentTypes) => notifications.push(component);

const InfoPage: m.Component = {
	view: () => [
		m(
			".p-4.text-xl.text-center",
			"Tervetuloa ",
			m("span.text-green-600", "IjIk"),
			"-ilmoittautumisjärjestelmään"
		),
		notifications.length > 0 && m(
			".p-4.space-y-4",
			notifications.map(notification => m(notification))
		),
		m(
			"table.border-collapse.m-0.sm:m-8.text-sm.sm:text-base",
			actions.map(action => m(
				"tr.group",
				m("td", m(action.component)),
				m(
					"td.text-gray-800.group-hover:text-black.pl-1.sm:pl-4",
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
		title: "Aloitusnäyttö",
		order: -100,
		icon: "i.fas.fa-home",
		onclick: () => m.route.set("/"),
		isActive: () => m.route.get() === "/",
		help: {
			view: () => [
				"Aloitusnäyttö",
				(m.route.get() === "/" || m.route.get() === "") && " (Tämä sivu)"
			]
		}
	});
};
