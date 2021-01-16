import m from "mithril";
import {ijik} from "../editor";
import {Errors} from "../errors";
import {Hook, hook} from "../hook";
import {Layout, menu} from "../layout";
import {pushNotification} from "../notify";
import {dismissPopup, setPopup} from "../popup";
import {route} from "../routes";
import {
	Confirm, Form, Input$, LabeledFormComponent, Notification, OverlayAttrs, OverlayHost,
	PluggableComponent, SectionListComponent, Tooltip$,
	plugger, bindChange, input, action, postForm
} from "../components";


// ---- Team Management ----------------------------------------

export interface Team {
	id: number;
	name: string;
}

export const teams: Team[] = [];
const addTeam = (team: Team) => teams.push(team);
const getTeam = (id: number) => teams.find(t => t.id === id);
const deleteTeam = (id: number) => {
	const idx = teams.findIndex(t => t.id === id);
	if(idx >= 0){
		const team = teams[idx];
		teams.splice(idx, 1);
		return team;
	}
};

// ---- Externals ----------------------------------------

export const TeamBadge: m.Component<{team: Team}> = {
	view: vnode => m(
		Tooltip$,
		{ text: "Muokkaa&nbsp;joukkuetta" },
		m(
			m.route.Link,
			{
				href: `/teams/edit/${vnode.attrs.team.id}`,
				class: "text-blue-600"
			},
			vnode.attrs.team.name
		)
	)
};

// ---- Team list ----------------------------------------

const ConfirmDelete: m.Component<{
	team: Team;
	yes: () => void;
}> = {
	view: vnode => m(
		Confirm,
		{
			yes: vnode.attrs.yes,
			yesText: [
				m("i.fas.fa-trash"),
				" Poista joukkue"
			],
			no: dismissPopup
		},
		"Haluatko varmasti poistaa joukkueen ",
		m("span.font-bold", vnode.attrs.team.name),
		"?",
		m("br"),
		"Et voi peruuttaa poistoa."
	)
};

const DeleteTeam: m.ClosureComponent<{team: Team}> = vnode => {
	const deleteRequest = postForm({
		url: "/teams/:id",
		method: "DELETE"
	});

	return {
		view: () => deleteRequest.loading ?
			m("i.fas.fa-spinner.animate-spin") : 
			m(
				"i.fas.fa-times.text-red-600.cursor-pointer",
				{
					onclick: () => setPopup(ConfirmDelete, {
						team: vnode.attrs.team,
						yes: () => {
							dismissPopup();
							deleteRequest({ params: { id: vnode.attrs.team.id } })
							.then(
								() => deleteTeam(vnode.attrs.team.id),
								() => pushNotification(Notification.Error, deleteRequest.errors!.desc()).dismiss(5000)
							);
						}
					})
				}
			)
	}	
};

const teamActions: PluggableComponent<{team: Team}>[] = [
	{
		title: "Poista&nbsp;joukkue",
		order: 100,
		component: DeleteTeam
	}
];

export const teamAction = plugger(teamActions);

const teamListColumns: PluggableComponent<{team: Team}>[] = [
	{
		title: "Joukkue",
		order: -100,
		component: TeamBadge
	},
	{
		title: "Toiminnot",
		order: 100,
		component: {
			view: vnode => teamActions.map(action => m(
				Tooltip$,
				{ text: action.title },
				m(action.component, { team: vnode.attrs.team })
			))
		}
	}
];

export const teamListColumn = plugger(teamListColumns);

const TeamList: m.Component<{
	teams: Team[]
}> = {
	view: vnode => m(
		"table.w-full",
		m(
			"tr.text-left",
			teamListColumns.map(col => m("th.p-2", col.title))
		),
		vnode.attrs.teams.map(team => m(
			"tr.align-top.even:bg-gray-100",
			{ key: team.id },
			teamListColumns.map(col => m(
				"td.p-2",
				m(col.component, { team })
			))
		))
	)
};

const TeamListPage: m.Component = {
	view: () => m(TeamList, { teams })
};

// ---- Editor ----------------------------------------

export interface TeamInfo {
	name: string;
}

export interface NewTeamInfo extends TeamInfo {
	isNew: true;
}

export interface EditTeamInfo extends TeamInfo {
	id: number;
	isNew: false;
}

export interface EditorState {
	info: NewTeamInfo | EditTeamInfo;
	errors?: Errors;
	onsave?: () => void;
	loading?: boolean;
}

const bindName = bindChange<EditorState, "info", "name">("info", "name");
const details: PluggableComponent<EditorState>[] = [
	{
		title: "Nimi",
		order: -100,
		component: {
			view: vnode => m(
				Input$,
				{ errors: vnode.attrs.errors?.field("name")?.asArray() },
				input({
					onchange: bindName(vnode),
					value: bindName.get(vnode),
					errors: !!vnode.attrs.errors?.field("name")
				})
			)
		}
	}
];
export const editorDetail = plugger(details);

const editorSections: PluggableComponent[] = [
	{
		title: "Perustiedot",
		order: -100,
		component: {
			view: vnode => m(
				LabeledFormComponent,
				{
					controls: details,
					componentAttrs: vnode.attrs,
					attrs: { class: "mt-1" }
				},
			)
		}
	}
];
export const editorSection = plugger(editorSections);

const EditorMain: m.Component<EditorState & OverlayAttrs> = {
	view: vnode => m(
		Form,
		vnode.attrs.errors && m(
			".w-full.lg:w-3/5.m-auto.my-4",
			vnode.attrs.errors.asArray()?.map(e => m(Notification.Error, e))
		),
		m(
			SectionListComponent,
			{
				sections: editorSections,
				componentAttrs: vnode.attrs
			}
		),
		m(
			//".w-full.lg:w-3/5.lg:border-l.lg:border-r.m-auto.border-t.lg:border-t-0.bg-white.p-4",
			".w-full.lg:w-3/5.m-auto.lg:p-4.mt-8.lg:mt-0",
			action({
				element: "button.px-10.bg-green-600.hover:bg-green-500",
				disabled: !!vnode.attrs.loading,
				children: [
					m("i.fas.fa-check.pr-2"),
					" ",
					vnode.attrs.info.isNew ? "Ilmoita joukkue" : "Tallenna muutokset"
				],
				onclick: vnode.attrs.onsave,
			})
		)
	)
};

const EditorOverlayFrame: m.Component<OverlayAttrs> = {
	view: vnode => [
		m(
			".flex.items-center.border-b.text-red-500.text-lg.p-2.pl-4.cursor-pointer"
			+".hover:bg-red-100",
			{ onclick: vnode.attrs.popOverlay },
			m("i.fas.fa-arrow-left"),
			m("span.ml-2", "Palaa takaisin"),
		),
		vnode.children
	]
};

const Editor: m.Component<EditorState> = {
	view: vnode => m(
		OverlayHost,
		{
			component: EditorMain,
			attrs: vnode.attrs,
			frame: EditorOverlayFrame
		}
	)
};

export const newTeam_: Hook<(info: NewTeamInfo) => void> = hook();
export const submit_: Hook<(info: NewTeamInfo|EditTeamInfo) => void> = hook();

const NewTeamPage: m.ClosureComponent = () => {
	const info: NewTeamInfo = {
		isNew: true,
		name: ""
	};

	newTeam_(info);

	const post = postForm({ url: "/teams/new" });

	const onsave = () => {
		submit_(info);
		post({ body: { ...info, isNew: undefined }}).then(team => {
			addTeam(team);
			pushNotification(Notification.Success, "Joukkue luotu").dismiss(5000);
			m.route.set("/teams/list");
		});
	};

	return {
		view: () => m(
			Editor,
			{
				info,
				onsave,
				loading: post.loading,
				errors: post.errors
			}
		)
	};
};

const EditTeamPage: m.ClosureComponent<{
	info: Team;
}> = vnode => {

	// TODO: this will not work for complex objects and is dumb anyway
	const info: EditTeamInfo = JSON.parse(JSON.stringify(vnode.attrs.info));
	info.isNew = false;

	const post = postForm({
		url: "/teams/:id",
		method: "PATCH"
	});

	const onsave = () => {
		submit_(info);
		post({
			body: { ...info, isNew: undefined },
			params: { id: vnode.attrs.info.id }
		}).then(team => {
			Object.assign(vnode.attrs.info, team);
			pushNotification(Notification.Success, "Muutokset tallennettu").dismiss(5000);
			m.route.set("/teams/list");
		});
	};

	return {
		view: () => m(
			Editor,
			{
				info,
				onsave,
				loading: post.loading,
				errors: post.errors
			}
		)
	};
};

// --------------------------------------------------------------------------------

ijik.plugins.teams = teams => {
	console.log("Teams plugin started with teams", teams);
	for(const t of teams)
		addTeam(t);

	route("/teams/new", {
		render: () => m(
			Layout,
			{
				top: {
					view: () => m(".text-2xl", "Uusi joukkue")
				}
			},
			m(NewTeamPage)
		)
	});

	route("/teams/edit/:key", vnode => {
		const info = getTeam(+vnode.attrs.key);

		if(!info){
			m.route.set("/team/list");
			return { view: () => "" };
		}

		return {
			view: () => m(
				Layout,
				{
					top: {
						view: () => m(".text-2xl", "Muokkaa joukkuetta")
					}
				},
				m(EditTeamPage, { info })
			)
		}
	});

	route("/teams/list", {
		render: () => m(
			Layout,
			{
				top: {
					view: () => m(".text-2xl", "Ilmoitetut joukkueet")
				}
			},
			m(TeamListPage)
		)
	});

	menu({
		title: "Joukkueet",
		order: -90,
		icon: "i.fas.fa-list-ul",
		onclick: () => m.route.set("/teams/list"),
		isActive: () => m.route.get() === "/teams/list",
		help: {
			view: () => [
				m(
					m.route.Link,
					{
						class: "text-green-600",
						href: "/teams/list"
					},
					"Hallitse joukkueita: "
				),
				"Tarkastele, muokkaa ja poista ilmoittamiasi joukkueita"
			]
		}
	});

	menu({
		title: "Ilmoita joukkue",
		order: 90,
		icon: "i.fas.fa-plus",
		onclick: () => m.route.set("/teams/new"),
		isActive: () => m.route.get() === "/teams/new" || m.route.get().startsWith("/teams/edit/"),
		help: {
			view: () => [
				m(
					m.route.Link,
					{
						class: "text-green-600",
						href: "/teams/new"
					},
					"Ilmoita joukkue: "
				),
				"Ilmoita uusi joukkue"
			]
		}
	});
};
