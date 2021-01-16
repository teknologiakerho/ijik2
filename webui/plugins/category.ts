import m from "mithril";
import {ijik} from "../editor";
import {Errors} from "../errors";
import { Input$, Select, bindChange, input } from "../components";
import { EditorState, newTeam_, editorDetail, teamListColumn } from "../plugins/teams";

declare module "../plugins/teams" {
	interface Team {
		category?: string;
	}

	interface TeamInfo {
		category?: string;
	}
}

interface Category {
	id: string;
	name: string;
	group: string;
}

const categories: Category[] = [];
const idMap: {[id: string]: Category} = {};

const add = (...cats: Category[]) => {
	categories.push(...cats);
	categories.sort((a, b) => a.name.localeCompare(b.name));
	for(const c of cats)
		idMap[c.id] = c;
};

const group = ():{label: string, options: Category[]}[] => {
	const groups: {[name: string]: Category[]} = {};

	for(const cat of categories)
		(groups[cat.group] = groups[cat.group] || []).push(cat);

	return Object.entries(groups)
		.sort(([a, _], [b, __]) => a.localeCompare(b))
		.map(([label, options]) => ({ label, options }));
};

const get = id => idMap[id];

const bindCategory = bindChange<EditorState, "info", "category">("info", "category");

ijik.plugins.category = (cats: Category[]) => {
	if(cats.length === 0)
		return;

	add(...cats);

	newTeam_.hook(t => {
		t.category = categories[0].id;
	});

	const options = group();
	editorDetail({
		title: "Sarja",
		order: -90,
		component: {
			view: vnode => m(
				Input$,
				{ errors: vnode.attrs.errors?.field("category")?.asArray() },
				input({
					element: Select,
					options,
					onchange: bindCategory(vnode),
					value: bindCategory.get(vnode),
					errors: !!vnode.attrs.errors?.field("category"),
					disabled: !vnode.attrs.info.isNew
				})
			)
		}
	});

	teamListColumn({
		title: "Sarja",
		order: -90,
		component: {
			view: vnode => get(vnode.attrs.team.category)?.name
		}
	});

};
