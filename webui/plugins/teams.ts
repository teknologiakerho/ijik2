import m from "mithril";
import {ijik} from "../editor";
import {Errors} from "../errors";
import {Hook, hook} from "../hook";
import {Layout, menu} from "../layout";
import {$} from "../messages";
import {pushNotification} from "../notify";
import {dismissPopup, setPopup} from "../popup";
import {route, routeHome} from "../routes";
import {
	Confirm, Input$, LabeledFormComponent, Notification, OverlayAttrs, OverlayHost,
	PluggableComponent, SectionFormFrame, SectionListComponent, Tooltip$,
	plugger, bindChange, input, action, postForm
} from "../components";

$.defaults({
	"team:confirm-delete": ({team}) => `Haluatko varmasti poistaa joukkueen`
		+ ` <span class=font-bold>${team.name}</span>?`
		+ "<br/>Et voi peruuttaa poistoa.",
	"team:delete-button": "<i class='fas fa-trash'></i> Poista joukkue",
	"team:delete-hover": "Poista&nbsp;joukkue",
	"team:edit-cancel": "Poistu tallentamatta",
	"team:edit-details": "Perustiedot",
	"team:edit-hover": "Muokkaa&nbsp;joukkuetta",
	"team:edit-name": "Joukkueen nimi",
	"team:edit-return": "Palaa takaisin",
	"team:edit-save": ({info}) => info.isNew ? "Ilmoita joukkue" : "Tallenna muutokset",
	"team:edit-title": "Muokkaa joukkuetta",
	"team:list-help": "Tarkastele, muokkaa ja poista ilmoittamiasi joukkueita",
	"team:list-title": "Ilmoitetut joukkueet",
	"team:name-column": "Joukkue",
	"team:new-help": "Ilmoita uusi joukkue",
	"team:new-title": "Uusi joukkue",
	"team:notify-saved": ({isNew}) => isNew ? "Joukkue ilmoitettu" : "Muutokset tallennettu"
});

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
		{ text: $("team:edit-hover")},
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
			yesText: m.trust($("team:delete-button", { team: vnode.attrs.team })),
			no: dismissPopup
		},
		m.trust($("team:confirm-delete", { team: vnode.attrs.team }))
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
		title: $("team:delete-hover"),
		order: 100,
		component: DeleteTeam
	}
];

export const teamAction = plugger(teamActions);

const teamListColumns: PluggableComponent<{team: Team}>[] = [
	{
		title: $("team:name-column"),
		order: -100,
		component: TeamBadge
	},
	{
		title: $("edit:actions"),
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
	oncancel?: () => void;
	loading?: boolean;
}

const bindName = bindChange<EditorState, "info", "name">("info", "name");
const details: PluggableComponent<EditorState>[] = [
	{
		title: $("team:edit-name"),
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
		title: $("team:edit-details"),
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
		SectionFormFrame,
		{ errors: vnode.attrs.errors?.asArray() },
		m(
			SectionListComponent,
			{
				sections: editorSections,
				componentAttrs: vnode.attrs
			}
		),
		SectionFormFrame.actions({
			yes: {
				onclick: vnode.attrs.onsave,
				text: $("team:edit-save", { info: vnode.attrs.info }),
			},
			no: vnode.attrs.oncancel && {
				onclick: vnode.attrs.oncancel,
				text: $("team:edit-cancel", { info: vnode.attrs.info })
			},
			disabled: !!vnode.attrs.loading
		})
	)
};

const EditorOverlayFrame: m.Component<OverlayAttrs> = {
	view: vnode => [
		m(
			".flex.items-center.border-b.text-red-500.text-lg.p-2.pl-4.cursor-pointer"
			+".hover:bg-red-100",
			{ onclick: vnode.attrs.popOverlay },
			m("i.fas.fa-arrow-left"),
			m("span.ml-2", $("team:edit-return")),
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
			pushNotification(Notification.Success, $("team:notify-saved", {
				...team,
				isNew: true
			})).dismiss(5000);
			m.route.set("/teams/list");
		});
	};

	return {
		view: () => m(
			Editor,
			{
				info,
				onsave,
				oncancel: routeHome,
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
			pushNotification(Notification.Success, $("team:notify-saved", {
				...team,
				isNew: false
			})).dismiss(5000);
			m.route.set("/teams/list");
		});
	};

	return {
		view: () => m(
			Editor,
			{
				info,
				onsave,
				oncancel: routeHome,
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
					view: () => m(".text-2xl", $("team:new-title"))
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
						view: () => m(".text-2xl", $("team:edit-title"))
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
					view: () => m(".text-2xl", $("team:list-title"))
				}
			},
			m(TeamListPage)
		)
	});

	menu({
		title: $("team:list-title"),
		order: -90,
		icon: "i.fas.fa-list-ul",
		onclick: () => m.route.set("/teams/list"),
		isActive: () => m.route.get() === "/teams/list",
		help: {
			view: () => [
				m(
					m.route.Link,
					{
						class: "bg-green-50 text-green-700 p-2 rounded mr-4",
						href: "/teams/list"
					},
					$("team:list-title"),
				),
				$("team:list-help")
			]
		}
	});

	menu({
		title: $("team:new-title"),
		order: -95,
		icon: "i.fas.fa-plus",
		onclick: () => m.route.set("/teams/new"),
		isActive: () => m.route.get() === "/teams/new" || m.route.get().startsWith("/teams/edit/"),
		help: {
			view: () => [
				m(
					m.route.Link,
					{
						class: "bg-green-600 text-white p-2 rounded font-bold mr-4",
						href: "/teams/new"
					},
					$("team:new-title")
				),
				$("team:new-help")
			]
		}
	});
};
