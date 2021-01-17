import m from "mithril";
import {ijik} from "../editor";
import {Errors} from "../errors";
import {Hook, hook} from "../hook";
import {Layout, menu} from "../layout";
import {pushNotification} from "../notify";
import {route} from "../routes";
import {
	Input$, LabeledFormComponent, Notification, OverlayAttrs, PluggableComponent,
	SectionFormFrame, SectionListComponent, Tooltip$,
	action, bindChange, input, plugger, postForm
} from "../components";
import {
	EditorState as TeamEditorState, TeamBadge,
	editorSection as teamEditorSection, newTeam_, teamListColumn, teams
} from "../plugins/teams";

declare module "../plugins/teams" {
	interface Team {
		member_ids?: number[];
	}

	interface TeamInfo {
		member_ids?: number[];
	}
}

// ---- Members management ----------------------------------------

export interface Member {
	id: number;
	first_name: string;
	last_name: string;
}

const members: Member[] = [];
const idMap: {[id: number]: Member} = {};

const displayName = (member: Member) => `${member.first_name} ${member.last_name}`;

const addMember = (member: Member) => {
	members.push(member);
	idMap[member.id] = member;
};

const deleteMember = (id: number) => {
	if(!idMap[id])
		return;

	delete idMap[id];
	const idx = members.findIndex(m => m.id === id);
	const member = members[idx];
	members.splice(idx, 1);
	return member;
};

const getMembers = (ids?: number[]): Member[] => {
	return ids?.map(id => idMap[id]).filter(m => !!m) || [];
}; 

const filterMember_: Hook<(member: Member, search: string) => boolean> = hook();

filterMember_.hook((member, search) => search
				   .toLowerCase()
				   .split(/\s+/)
				   .every(s => member.last_name.toLowerCase().includes(s)
						  || member.first_name.toLowerCase().includes(s)));

const filterMembers = (members: Member[], search: string) => members.filter(
	m => filterMember_(m, search).some(x => !!x));

const hasTeams = (id: number) => teams.some(t => t.member_ids?.includes(id));
const getTeams = (id: number) => teams.filter(t => t.member_ids?.includes(id));

// ---- Externals ----------------------------------------

const MemberBadge: m.Component<{member: Member}> = {
	view: vnode => m(
		Tooltip$,
		{ text: "Muokkaa&nbsp;osallistujaa" },
		m(
			m.route.Link,
			{
				href: `/members/edit/${vnode.attrs.member.id}`,
				class: "text-blue-600"
			},
			displayName(vnode.attrs.member)
		)
	)
};

// ---- Member list ----------------------------------------

const DeleteMember: m.ClosureComponent<{member: Member}> = vnode => {
	if(hasTeams(vnode.attrs.member.id)){
		return {
			view: () => m("i.fas.fa-times.text-gray-400.cursor-not-allowed")
		};
	}

	const deleteRequest = postForm({
		url: "/members/:id",
		method: "DELETE"
	});

	return {
		view: () => deleteRequest.loading ?
			m("i.fas.fa-spinner.animate-spin") :
			m(
				"i.fas.fa-times.text-red-600.cursor-pointer",
				{
					onclick: () => deleteRequest({ params: { id: vnode.attrs.member.id } })
						.then(
							() => deleteMember(vnode.attrs.member.id),
							() => pushNotification(Notification.Error, deleteRequest.errors!.desc()).dismiss(5000)
						)
				}
		)
	};
};

const memberActions: PluggableComponent<{member: Member}>[] = [
	{
		title: "Poista&nbsp;osallistuja",
		order: 100,
		component: DeleteMember
	}
];

const memberListColumns: PluggableComponent<{member: Member}>[] = [
	{
		title: "Osallistuja",
		order: -100,
		component: MemberBadge
	},
	{
		title: "Joukkueet",
		order: -90,
		component: {
			view: vnode => m(
				".inline-flex.flex-col",
				getTeams(vnode.attrs.member.id).map(team => m(TeamBadge, { team }))
			)
		}
	},
	{
		title: "Toiminnot",
		order: 100,
		component: {
			view: vnode => m(
				".space-x-4",
				memberActions.map(action => m(
					Tooltip$,
					{ text: action.title },
					m(action.component, { member: vnode.attrs.member })
				))
			)
		}
	}
];

const MemberList: m.Component<{
	members: Member[]
}> = {
	view: vnode => m(
		"table.w-full",
		m(
			"tr.text-left",
			memberListColumns.map(col => m("th.p-2", col.title))
		),
		vnode.attrs.members.map(member => m(
			"tr.align-top.even:bg-gray-100",
			{ key: member.id },
			memberListColumns.map(col => m(
				"td.p-2",
				m(col.component, { member })
			))
		))
	)
};

const MembersListPage: m.Component = {
	view: () => m(MemberList, { members })
};

// ---- Member editor ----------------------------------------

export interface MemberInfo {
	first_name: string;
	last_name: string;
}

export interface NewMemberInfo extends MemberInfo {
	isNew: true;
}

export interface EditMemberInfo extends MemberInfo {
	id: number;
	isNew: false;
}

export interface EditorState {
	info: NewMemberInfo | EditMemberInfo;
	errors?: Errors;
	onsave?: () => void;
	loading?: boolean;
}

const bindFirstName = bindChange<EditorState, "info", "first_name">("info", "first_name");
const bindLastName = bindChange<EditorState, "info", "last_name">("info", "last_name");
const details: PluggableComponent<EditorState>[] = [
	{
		title: "Nimi",
		order: -100,
		component: {
			view: vnode => m(
				Input$,
				{ errors: vnode.attrs.errors?.field("name")?.asArray() },
				input({
					onchange: bindFirstName(vnode),
					value: bindFirstName.get(vnode),
					errors: !!vnode.attrs.errors?.field("name"),
					placeholder: "Etunimi"
				}),
				input({
					onchange: bindLastName(vnode),
					value: bindLastName.get(vnode),
					errors: !!vnode.attrs.errors?.field("name"),
					placeholder: "Sukunimi",
					class: ".lg:ml-4"
				})
			)
		}
	}
];
export const editorDetail = plugger(details);

const editorSections: PluggableComponent<EditorState>[] = [
	{
		title: "Osallistujatiedot",
		order: -100,
		component: {
			view: vnode => m(
				LabeledFormComponent,
				{
					controls: details,
					componentAttrs: vnode.attrs,
					attrs: { class: "mt-1" }
				}
			)
		}
	}
];
//export const editorSection = (section: m.Component<EditorState>) => editorSections.push(section);
export const editorSection = plugger(editorSections)

const Editor: m.Component<EditorState> = {
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
				text: vnode.attrs.info.isNew ? "Ilmoita osallistuja" : "Tallenna muutokset"
			},
			disabled: !!vnode.attrs.loading,
		})
	)
};

const CreateMember: m.ClosureComponent<{
	info?: Partial<MemberInfo>;
	done?: (member: Member) => void; 
}> = vnode => {

	const info: NewMemberInfo = {
		first_name: "",
		last_name: "",
		...vnode.attrs.info,
		isNew: true
	};

	const post = postForm({ url: "/members/new" });

	const onsave = () => {
		post({ body: { ...info, isNew: undefined } }).then((member: Member) => {
			addMember(member);
			if(vnode.attrs.done)
				vnode.attrs.done(member);
		})
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
	}
};

const EditMember: m.ClosureComponent<{
	info: Member;
	done?: (member: Member) => void;
}> = vnode => {

	const info: EditMemberInfo = JSON.parse(JSON.stringify(vnode.attrs.info));
	info.isNew = false;

	const post = postForm({
		url: "/members/:id",
		method: "PATCH"
	});

	const onsave = () => {
		post({
			body: { ...info, isNew: undefined },
			params: { id: vnode.attrs.info.id }
		}).then(member => {
			Object.assign(vnode.attrs.info, member);
			if(vnode.attrs.done)
				vnode.attrs.done(member);
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

const EditMemberPage: m.Component<{
	info: Member;
}> = {
	view: vnode => m(
		EditMember,
		{
			info: vnode.attrs.info,
			done: () => m.route.set("/members/list")
		}
	)
};

// ---- Team editor extensions ----------------------------------------

const editorMemberActions: PluggableComponent<{state: TeamEditorState; member: Member}>[] = [
	{
		title: "Poista",
		order: 100,
		component: {
			view: vnode => m(
				"i.fas.fa-times.text-red-600.cursor-pointer.mx-2",
				{
					onclick: () => {
						const id = vnode.attrs.member.id;
						const idx = vnode.attrs.state.info.member_ids?.findIndex(id_ => id_ === id);
						if(idx !== undefined && idx >= 0)
							vnode.attrs.state.info.member_ids!.splice(idx, 1);
					}
				}
			)
		}
	}
];

const editorMemberListColumns: PluggableComponent<{state: TeamEditorState; member: Member}>[] = [
	{
		title: "Nimi",
		order: -100,
		component: {
			view: vnode => displayName(vnode.attrs.member)
		}
	},
	{
		title: "Toiminnot",
		order: 100,
		component: {
			view: vnode => editorMemberActions.map(action => m(
				Tooltip$,
				{ text: action.title },
				m(action.component, { state: vnode.attrs.state, member: vnode.attrs.member })
			))
		}
	}
];

const MemberCard: m.Component<{
	member: Member;
	[attr: string]: any;
}> = {
	view: vnode => m(
		".w-64.h-24.ml-4.mt-4.border.rounded.inline-flex.items-center.transition"
		+ ".hover:bg-blue-500.hover:text-white.cursor-pointer",
		vnode.attrs,
		m("i.fas.fa-user.text-4xl.opacity-50.p-4"),
		m(
			"",
			displayName(vnode.attrs.member)
		)
	)
};

const AddMemberCard: m.Component<any> = {
	view: vnode => m(
		".w-64.h-24.ml-4.mt-4.border.rounded.inline-flex.items-center.transition.group"
		+".hover:bg-green-500.hover:text-white.cursor-pointer",
		vnode.attrs,
		m("i.fas.fa-plus.text-4xl.text-green-500.group-hover:text-white.p-4"),
		m(
			".p-4",
			"Uusi henkilö"
		)
	)
};

type SelectMemberArgs = {
	members: Member[];
	selected: (member: Member) => void;
	create: (search: string) => void;
};

const SelectMember: m.ClosureComponent<SelectMemberArgs> = () => {
	let search = "";

	return {
		view: vnode => m(
			".w-full",
			input({
				class: "w-full",
				placeholder: "Hae henkilöitä...",
				oninput: e => search = e.target.value
			}),
			m(
				".mt-4",
				m(AddMemberCard, { onclick: () => vnode.attrs.create(search) }),
				(search === "" ? vnode.attrs.members : filterMembers(vnode.attrs.members, search))
				.map(member => m(
					MemberCard,
					{
						member,
						onclick: () => vnode.attrs.selected(member)
					}
				))
			)
		)
	};
};

const SelectMemberOverlay: m.Component<SelectMemberArgs> = {
	view: vnode => m(
		".p-4",
		m(SelectMember, vnode.attrs)
	)
};

const inferSearchDetails = (search: string): Partial<MemberInfo> => {
	const [first_name, last_name] = search.split(/\s+/);
	return { first_name, last_name };
};

const CreateMemberOverlay: m.Component<{
	search: string;
	done?: (member: Member) => void;
}> = {
	view: vnode => m(
		".p-4",
		m(CreateMember, {
			info: inferSearchDetails(vnode.attrs.search),
			done: vnode.attrs.done
		})
	)
}

const TeamEditorMembers: m.Component<TeamEditorState & OverlayAttrs> = {
	view: vnode => [
		vnode.attrs.errors?.field("members")?.asArray()?.map(e => m(Notification.Error, e)),
		m(
			"table.w-full.mt-3",
			(vnode.attrs.info.member_ids?.length as number) > 0 && m(
				"tr.text-left",
				editorMemberListColumns.map(col => m( "th.p-2", col.title))
			),
			getMembers(vnode.attrs.info.member_ids).map(member => m(
				"tr.even:bg-gray-100",
				{ key: member.id },
				editorMemberListColumns.map(col => m(
					"td.p-2",
					m(col.component, { state: vnode.attrs, member })
				))
			)),
			m("tr", m(
				"td.bg-white",
				{ colspan: editorMemberListColumns.length },
				action({
					element: "button.px-4.bg-blue-500.hover:bg-blue-400",
					children: [
						m("i.fas.fa-plus-circle.mr-2"),
						" ",
						"Lisää jäsen"
					],
					onclick: () => vnode.attrs.pushOverlay(SelectMemberOverlay, {
						members: members.filter(member => !vnode.attrs.info.member_ids?.includes(member.id)),
						selected: member => {
							vnode.attrs.popOverlay();
							vnode.attrs.info.member_ids?.push(member.id);
						},
						create: search => vnode.attrs.pushOverlay(CreateMemberOverlay, {
							search,
							done: member => {
								vnode.attrs.popOverlay(2);
								vnode.attrs.info.member_ids?.push(member.id);
							}
						})
					})
				})
			))
		)
	]
};

// --------------------------------------------------------------------------------

ijik.plugins.members = (mems: Member[]) => {
	console.log("Members plugin started with members", mems);
	for(const mem of mems)
		addMember(mem);

	newTeam_.hook(team => team.member_ids = []);

	route("/members/list", {
		render: () => m(
			Layout,
			{
				top: {
					view: () => m(".text-2xl", "Ilmoitetut osallistujat")
				}
			},
			m(MembersListPage)
		)
	});

	route("/members/edit/:key", vnode => {
		const info = idMap[+vnode.attrs.key];

		if(!info){
			m.route.set("/members/list");
			return { view: () => "" };
		}

		return {
			view: () => m(
				Layout,
				{
					top: {
						view: () => m(".text-2xl", "Muokkaa osallistujaa")
					}
				},
				m(EditMemberPage, { info })
			)
		};
	});

	menu({
		title: "Jäsenet",
		order: -80,
		icon: "i.fas.fa-users-cog",
		onclick: () => m.route.set("/members/list"),
		isActive: () => m.route.get() === "/members/list",
		help: {
			view: () => [
				m(
					m.route.Link,
					{
						class: "bg-green-50 text-green-700 p-2 rounded mr-4",
						href: "/members/list"
					},
					"Hallitse osallistujia"
				),
				"Tarkastele, muokkaa ja poista ilmoittamiasi osallistujia"
			]
		}	
	});

	teamEditorSection({
		title: "Jäsenet",
		order: -80,
		component: TeamEditorMembers
	});

	teamListColumn({
		title: "Jäsenet",
		order: -80,
		component: {
			view: vnode => m(
				".inline-flex.flex-col",
				vnode.attrs.team.member_ids?.map(id => idMap[id] && m(
					MemberBadge,
					{member: idMap[id]}
				))
			)
		}
	});
};
