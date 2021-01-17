import m from "mithril";
import {Errors, errorsFromResponse} from "./errors";

export type Pluggable = {
	title: string;
	order: number;
}

type IgnoreOrder<T> = Omit<T, "order">

export const plug = <T extends Pluggable, U extends T>(ts: T[], t: IgnoreOrder<U>) => {
	// see: https://www.typescriptlang.org/docs/handbook/variable-declarations.html#spread
	const t_ = {order: 0, ...t} as U;
	ts.push(t_);
	ts.sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title));
	return t_;
};

export const plugger: <T extends Pluggable>(items: T[]) => <U extends T>(item: U) => U
	= items => item => plug(items, item);

export type PluggableComponent<A={},S={}> = Pluggable & { component: m.ComponentTypes<A,S> }

// ---- UI sections ----------------------------------------

// section1   section 1 content     | #section1
//            . . . . . . . . .     | #section2
//            . . . . . . . . .     | #sectionN
//
// section2   section 2 content
//            . . . . . . . . .
//            . . . . . . . . .
//
// sectionN   section N content
//            . . . . . . . . .
//            . . . . . . . . .

export const SectionListComponent : m.Component<{
	sections: IgnoreOrder<PluggableComponent>[],
	componentAttrs?: any
}> = {
	view: vnode => m(
		".flex",
		m(".w-full.lg:w-4/5.grid.grid-cols-1.lg:grid-cols-4", vnode.attrs.sections.map(
			({title, component}) => [
				m(
					".text-2xl.text-green-600.lg:p-4"
					+".lg:col-start-1.lg:text-right.lg:min-h-full",
					title
				),
				m(
					".lg:pl-4.lg:border-l.lg:col-start-2.lg:col-end-5.lg:pb-24",
					m(component, vnode.attrs.componentAttrs)
				)
			]
		)),
		m(".hidden.lg:block.w-1/5")
	)
};

//          <------ errors ------->
//
// [header] content content content
//          . . . . . . . . . . . .
//          . . . . . . . . . . . .
//          . . . . . . . . . . . .
//
//          <action-yes> <action-no>
export const SectionFormFrame : m.Component<{
	errors?: [string];
}> & {
	errors: (errors?: [string]) => m.Vnode|undefined;
	actions: (opt: {
		yes: ActionOptions & { text?: string };
		no?: ActionOptions & { text?: string };
		[option: string]: any;
	}) => m.Vnode;
} = {
	view: vnode => m(
		Form,
		SectionFormFrame.errors(vnode.attrs.errors),
		vnode.children
	),

	errors: errors => errors && m(
		".w-full.lg:w-3/5.m-auto.my-4",
		errors.map(e => m(Notification.Error, e))
	),

	actions: ({yes, no, ...opt}) => {
		return m(
			".flex.w-full.lg:w-3/5.m-auto.lg:p-4.mt-8.lg:mt-0",
			action({
				element: "button.px-10.bg-green-600.hover:bg-green-500",
				children: yes.text && [
					m("i.fas.fa-check.mr-2"),
					" ",
					yes.text
				],
				...opt,
				...yes,
				text: undefined
			}),
			no && action({
				element: "button.px-4.sm:px-10.bg-red-500.hover:bg-red-400.ml-auto.sm:mr-auto",
				children: no.text && [
					m("i.fas.fa-times"),
					m(".hidden.sm:inline.pl-2", no.text)
				],
				...opt,
				...no,
				text: undefined
			})
		);
	}
};

// ---- CSS shapes ----------------------------------------
// see: https://css-tricks.com/snippets/css/css-triangle/

export const triangle = (side: string, size: string) => `[style='${[
	"width: 0",
	"height: 0",
	`border-width: ${size}`,
	...["right", "top", "left", "bottom"]
		.filter(s => s != side)
		.map(s => `border-${s}-color: transparent`)
].join("; ")}']`;

// ---- Tooltips ----------------------------------------
//
// +---------+
// | tooltip |
// +---------+
//      v
// [ element ]

// you need to put this inside a group container with position: relative
// TODO: maybe allow configuring right/top/left/bottom?
export const Tooltip: m.Component<{
	text: string
}> = {
	view: vnode => m(
		".hidden.group-hover:flex.flex-col.items-center.absolute.bottom-full.right-1/2.transform.translate-x-1/2.-mb-3"
		+".pointer-events-none.z-30",
		m(".bg-gray-800.text-white.text-sm.rounded.px-2.py-1", m.trust(vnode.attrs.text)),
		m(`.border-gray-800 ${triangle("top", "0.5rem")}`)
	)
};

// container
export const Tooltip$: m.Component<{
	text: string;
}> = {
	view: vnode => m(
		".inline-block.relative.group",
		vnode.children,
		m(Tooltip, { text: vnode.attrs.text })
	)
};

// ---- Notifications ----------------------------------------
//
// +-------------------------------------------+
// |                                           |
// | [icon]   Message goes here              X |
// |                                           |
// +-------------------------------------------+

export const Notification: m.Component<{
	icon?: string;
	[attr: string]: any;
}> & {
	Error: m.Component;
	Success: m.Component;
} = {
	view: vnode => {
		const { icon, ...attrs } = vnode.attrs;

		return m(
			".p-4.rounded.flex.items-center",
			attrs,
			icon && m(icon),
			m("", vnode.children)
		);
	},

	Error: {
		view: vnode => m(
			Notification,
			{
				icon: "i.fas.fa-exclamation-circle.text-red-600.text-xl.mr-4",
				class: "text-red-500 bg-red-100",
			},
			vnode.children
		)	
	},

	Success: {
		view: vnode => m(
			Notification,
			{
				icon: "i.fas.fa-check.text-green-600.text-xl.mr-4",
				class: "text-green-700 bg-green-100",
			},
			vnode.children
		)
	}
};

// ---- Popups ----------------------------------------
//
// /-------------------\
// |:::::::::::::::::::|
// |::::+---------+::::|
// |::::| content |::::|
// |::::+---------+::::|
// |:::::::::::::::::::|
// \-------------------/

export const Popup$: m.Component<{
	blur?: () => void;
	containerElement?: string|m.ComponentTypes;
}> = {
	view: vnode => m(
		".fixed.inset-0.z-40.flex.items-center.justify-center.bg-gray-900.bg-opacity-50"
		+"[tabindex=-1]",
		{ onclick: vnode.attrs.blur },
		(m as any)(
			vnode.attrs.containerElement || "",
			{ onclick: e => e.stopPropagation() },
			vnode.children
		)
	)
};

export const Confirm: m.Component<{
	yes?: () => void;
	yesText?: any;
	no?: () => void;
	noText?: any;
}> = {
	view: vnode => m(
		Popup$,
		{
			containerElement: ".bg-white.rounded.p-4",
			blur: vnode.attrs.no
		},
		vnode.children,
		m(
			".flex.mt-4",
			action({
				class: "bg-white text-gray-700",
				children: vnode.attrs.yesText || "OK",
				onclick: vnode.attrs.yes
			}),
			action({
				class: "ml-auto bg-white text-red-500",
				children: vnode.attrs.noText || "Peruuta",
				onclick: vnode.attrs.no
			})
		)
	)
};

// ---- Forms ----------------------------------------

// not preventing this may cause page reloads

const preventDefault = e => e.preventDefault();
export const Form: m.Component<{
	attrs?: any;
}> = {
	view: vnode => m(
		"form.p-4",
		{
			...vnode.attrs.attrs,
			onsubmit: preventDefault
		},
		vnode.children
	)
};

// label1   control1
// label2   control2

export const LabeledFormComponent: m.Component<{
	controls: IgnoreOrder<PluggableComponent>[],
	attrs?: any;
	componentAttrs?: any
}> = {
	view: vnode => m(
		"table",
		vnode.attrs.attrs,
		vnode.attrs.controls.map(
			({title, component}) => m(
				"tr",
				m("td.w-32.p-2", m("label", title)),
				m("td.p-2", m(component, vnode.attrs.componentAttrs))
			)
		)
	)
};

// bound inputs
// note: the `any` is union of all htmlelement types,
// but typescript doesn't have that one predefined

export const value = (e: any): any => e.value;
export const isChecked = (e: any): boolean => e.checked;

export const bindChange = <A,V extends keyof A,K extends keyof A[V]>(
	attr: V,
	key: K,
	map?: (e: any) => A[V][K]
) => {

	let obj;

	map = map || value;
	const f = e => obj[key] = map!(e.target);

	const bind = (vnode: m.Vnode<A>) => {
		obj = vnode.attrs[attr];
		return f;
	};

	bind.get = (vnode: m.Vnode<A>) => vnode.attrs[attr][key];

	return bind;
}

// styled input
// (the type signature is sound, typescript doesn't understand that the or legs will match
// different overloads)
const inputStyle = errors => "bg-white disabled:bg-gray-200 disabled:text-gray-700 rounded border p-2 w-64"
			+ (errors ? " border-red-500" : "");
export const input = ({element, children, errors, ...attrs} : {
	element?: string | m.ComponentTypes;
	children?: any;
	errors?: boolean;
	[attr: string]: any;
}) => (m as any)(
	element || `input.${inputStyle(errors).replace(' ', '.')}`,
	{
		class: inputStyle(errors),
		...attrs
	},
	children
);

// same but for checkbox
export const checkbox = attrs => m(
	"input[type='checkbox'].disabled:bg-gray-200.h-5.w-5",
	attrs
);

// input container for showing errors
//
//  +-------+   +--------+
//  | input |  <| error1 |
//  +-------+   | error2 |
//              +--------+
//
export const InputErrors: m.ClosureComponent<{
	errors: [string]
}> = () => {
	let dismissed = false;
	const dismiss = () => dismissed = true;

	return {
		view: vnode => m(
			".absolute.flex-col.items-center.top-full.text-sm.text-white.w-full.-mt-2"
			+".cursor-pointer.transition.z-20"
			+".group-hover:flex" + (dismissed ? ".hidden.pointer-events-none" : ".flex.hover:opacity-50"),
			{ onclick: dismiss },
			m(`.border-red-500 ${triangle("bottom", "0.5rem")}`),
			m(
				".bg-red-500.p-1.rounded",
				vnode.attrs.errors.map( e => m("", e))
			)
		)
	};
};

export const Input$: m.Component<{
	errors?: [string];
	attrs?: any;
}> = {
	view: vnode => m(
		".relative.group",
		vnode.attrs.attrs,
		vnode.children,
		(vnode.attrs.errors?.length as number) > 0 && m(InputErrors, { errors: vnode.attrs.errors! })
	)
};

type ActionOptions = {
	element?: string | m.ComponentTypes;
	children?: any;
	[attr: string]: any;
};

// styled action button
const actionStyle = "rounded p-2 disabled:bg-gray-200 disabled:text-gray-700 text-white transition font-bold whitespace-nowrap";
export const action = ({element, children, ...attrs} : ActionOptions) => (m as any)(
	element || `button.${actionStyle.replace(' ', '.')}`,
	{
		class: actionStyle,
		...attrs
	},
	children
);

// utility for posting forms
type ServerErrors = { [error: string]: string | [string] | ServerErrors };
type ValidationErrors = { message: string }; // TODO?
export type PostForm<T> = {
	(options?: m.RequestOptions<T> & { url?: string }): Promise<T>;
	loading: boolean;
	errors?: Errors;
}

export const postForm = <T=any>(options?: m.RequestOptions<T> & { url?: string }) => {
	const post: PostForm<T> = options_ => new Promise((resolve, reject) => {
		post.loading = true;
		post.errors = undefined;

		// we lie to ts about having the url here. it can be provided in either of the options
		// but this is too awkward to express in the type system.
		m.request({
			method: "POST",
			...(options || {}),
			...(options_ || {})
		} as m.RequestOptions<T> & {url: string}).then(resolve, e => {
			post.errors = errorsFromResponse(e);
			reject(e);
			throw e;
		}).finally(() => post.loading = false);
	});

	post.loading = false;
	return post;
};

// ---- <select> dropdowns ----------------------------------------
//
// +------------+
// | value    v |
// +------------+
// | option1    |
// | option2    |
// | optionN    |
// +------------+

type SelectOption = { id: string; name: string; } | { label: string; options: SelectOption[] };

const renderOption = (option: SelectOption, value?: string) => {
	if("label" in option) {
		return m(
			"optgroup",
			{ label: option.label },
			option.options.map(opt => renderOption(opt, value))
		);
	} else {
		const attrs: any = { value: option.id };
		if(option.id === value)
			attrs.selected = true;

		return m(
			"option",
			attrs,
			option.name
		);
	}
};

export const Select: m.Component<{
	options: SelectOption[];
	value?: string;
	[attr: string]: any;
}> = {
	view: vnode => {
		const { options, value, ...attrs } = vnode.attrs;

		return m(
			"select",
			attrs,
			options.map(opt => renderOption(opt, value))
		);
	}
};

// ---- Overlay stack ----------------------------------------
//
//   +---------------+
//  +| upmost . . .  |
// +|| . . component |
// ||+---------------+
// |+---------------+
// +---------------+
//

export type OverlayAttrs = {
	pushOverlay: <T>(component: m.ComponentTypes<T>, attrs: T) => void;
	popOverlay: (n?: number) => void;
};

type Overlay<T> = {
	component: m.ComponentTypes<T & OverlayAttrs>;
	attrs: T;
};

export const OverlayHost: m.ClosureComponent<
	(Overlay<any> | {}) & {
		frame?: m.ComponentTypes<OverlayAttrs>
	}
> = () => {
	const stack: Overlay<any>[] = [];
	const popOverlay = n => {
		n = typeof(n) === "number" && n || 1;
		for(let i = 0;i < n; i++)
			stack.pop();
	};
	const pushOverlay = (component, attrs) => stack.push({
		component,
		attrs: {
			...attrs,
			pushOverlay,
			popOverlay
		},
	});

	return {
		view: vnode => {
			if(stack.length > 0){
				const last = stack[stack.length-1];
				const overlay = m(
					last.component,
					last.attrs
				);

				if(vnode.attrs.frame)
					return m(vnode.attrs.frame, last.attrs, overlay)

				return overlay;
			}

			if("component" in vnode.attrs)
				return m(vnode.attrs.component, {
					...vnode.attrs.attrs,
					pushOverlay,
					popOverlay
				});

			return vnode.children;
		}
	};
};
