import m from "mithril";
import {ijik} from "../editor";
import {Errors} from "../errors";
import {Layout, menu} from "../layout";
import {pushNotification} from "../notify";
import {route, routeHome} from "../routes";
import {
	Input$, LabeledFormComponent, Notification, PluggableComponent, SectionFormFrame,
	SectionListComponent, Tooltip,
	action, bindChange, input, plugger, postForm
} from "../components";

export type UserInfo = {
	name: string;
};

let user: UserInfo|undefined;

// TODO: take authkey cookie name as parameter, it could be something else
const getKey = () => document.cookie.match(/authkey=(\w+)/)![1];

interface EditorState {
	info: UserInfo;
	errors?: Errors;
	onsave?: () => void;
	oncancel?: () => void;
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
					errors: !!vnode.attrs.errors?.field("name"),
					placeholder: "Nimi"
				})
			)
		}
	},
	{
		title: "Avain",
		order: -90,
		component: {
			view: vnode => m(
				".group.relative",
				m(
					".block.group-hover:hidden.bg-gray-100.rounded.border.p-2",
					"Näytä avain"
				),
				m(
					".hidden.group-hover:block.rounded.border.p-2",
					getKey(),
				),
				m(
					Tooltip,
					{
						text: "Henkilökohtainen&nbsp;ilmoittautumisavaimesi."
						+"<br/>Älä jaa tätä muille."
					}
				)
			)
		}
	}
];

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
				}
			)
		}
	}
];
export const editorSection = plugger(editorSections);

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
				text: "Tallenna muutokset"
			},
			no: vnode.attrs.oncancel && {
				onclick: vnode.attrs.oncancel,
				text: "Poistu tallentamatta"
			},
			disabled: !!vnode.attrs.loading,
		})		
	)
};

const UserPage: m.ClosureComponent = () => {
	const info: UserInfo = JSON.parse(JSON.stringify(user));

	const post = postForm({
		url: "/details",
		method: "PATCH"
	});

	const onsave = () => {
		post({ body: info }).then(userInfo => {
			Object.assign(user, userInfo);
			pushNotification(Notification.Success, "Muutokset tallennettu").dismiss(5000);
			m.route.set("/");
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

ijik.plugins.user = (userInfo: UserInfo) => {
	console.log("User plugin started with info", userInfo);
	user = userInfo;

	route("/user", {
		render: () => m(
			Layout,
			{
				top: {
					view: () => m(".text-2xl", "Ilmoittajan tiedot")
				}
			},
			m(UserPage)
		) 
	});

	menu({
		title: "Ilmoittajan tiedot",
		order: -70,
		icon: "i.far.fa-user-circle",
		onclick: () => m.route.set("/user"),
		isActive: () => m.route.get() === "/user",
		help: {
			view: () => [
				m(
					m.route.Link,
					{
						class: "bg-green-50 text-green-700 p-2 mr-4",
						href: "/user"
					},
					"Ilmoittajan tiedot"
				),
				"Muokkaa ilmoittajan (sinä) tietoja"
			]
		}
	});
};
