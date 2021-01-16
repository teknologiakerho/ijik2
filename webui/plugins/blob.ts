import m from "mithril";
import {Ijik, ijik} from "../editor";
import {Errors} from "../errors";
import {
	Input$, LabeledFormComponent, PluggableComponent,
	bindChange, checkbox, input, isChecked
} from "../components";

import {EditMemberInfo, NewMemberInfo, editorSection as memberEditorSection} from "./members";
import {UserInfo, editorSection as userEditorSection} from "./user";

declare module "../editor" {
	interface Ijik {
		blob?: any
	}
}

const getBlob = (obj: any, attribute: string) => {
	if(typeof obj[attribute] === "undefined")
		obj[attribute] = {};
	return obj[attribute];
};

// the types are only known at runtime so not much type checking can be done here unfortunately.
// they serve mostly as documentation.

type Field = { name: string; type: string; };
type FieldDef = Field & { immutable?: boolean; };
type Entry<T> = { name: string; label?: string; } & ( T | { schema: Schema<T> } );
type Schema<T=Field> = Entry<T>[];
type Blob = { [field: string]: any };

type GetSchema<T,U=Field> = (t: T) => Schema<U>;
type GetField<T> = (t: T) => Field;

type InputAttrs = {
	blob: Blob;
	field: Field;
	errors?: [string]
};

const inputs: { [type: string]: m.ComponentTypes<InputAttrs> } = {
	str: vnode_ => {
		const field = vnode_.attrs.field as Field & { placeholder?: string; disabled?: boolean; };
		const bind = bindChange<InputAttrs, "blob", string>("blob", field.name);

		return {
			view: vnode => m(
				Input$,
				{ errors: vnode.attrs.errors },
				input({
					onchange: bind(vnode),
					value: bind.get(vnode),
					errors: !!vnode.attrs.errors,
					placeholder: field.placeholder,
					disabled: field.disabled
				})
			)
		};
	},

	bool: vnode_ => {
		const field = vnode_.attrs.field as Field & { disabled?: boolean };
		const bind = bindChange<InputAttrs, "blob", string>("blob", field.name, isChecked);

		return {
			view: vnode => m(
				Input$,
				{ errors: vnode.attrs.errors },
				checkbox({
					onchange: bind(vnode),
					checked: !!bind.get(vnode),
					disabled: field.disabled,
					_: console.log(vnode.attrs)
				})
			)
		}
	}
};

const EntryComponent: m.Component<{
	blob: Blob;
	entry: Entry<Field>;
	errors?: Errors;
}> = {
	view: vnode => {
		const entry = vnode.attrs.entry;

		if("type" in entry){
			return m(
				inputs[entry.type],
				{
					blob: vnode.attrs.blob,
					field: entry,
					errors: vnode.attrs.errors?.field(entry.name)?.asArray()
				}
			);
		}else{
			return m(
				EditorComponent,
				{
					blob: getBlob(vnode.attrs.blob, entry.name),
					schema: entry.schema,
					errors: vnode.attrs.errors?.field(entry.name)
				}
			)
		}
	}
};

const EditorComponent: m.Component<{
	blob: Blob;
	schema: Schema<Field>;
	errors?: Errors;
	attrs?: any;
}> = {
	view: vnode => m(
		// TODO: this is the same style as components/LabeledFormComponent.
		//       maybe merge them?
		"table",
		vnode.attrs.attrs,
		vnode.attrs.schema.map(entry => m(
			"tr",
			{ key: entry.name },
			m("td.w-32.p-2", m("label", entry.label || entry.name)),
			m("td.p-2", m(
				EntryComponent,
				{
					blob: vnode.attrs.blob,
					entry,
					errors: vnode.attrs.errors
				}
			))
		))
	)
};

type EditorInfo = { isNew?: boolean; }

const updateTemplateField = (field: FieldDef, info: EditorInfo) => {
	// XXX: const should only be present when setting disabled on the field makes sense,
	// but there's not a good way to express that in typescript (?)
	if(field.immutable)
		(field as any).disabled = !info.isNew;
};

const updateTemplateSchema = (schema: Schema<FieldDef>, info: EditorInfo) => {
	for(const entry of schema)
		updateTemplateEntry(entry, info);
	return schema;
}

const updateTemplateEntry = (entry: Entry<FieldDef>, info: EditorInfo) => {
	if("type" in entry){
		updateTemplateField(entry, info);
	}else{
		updateTemplateSchema(entry.schema, info);
	}
};

ijik.blob = {

	schema: (template: Schema<FieldDef>): GetSchema<EditorInfo> => 
		info => {
			updateTemplateSchema(template, info);
			return template;
		},
	
	updateTemplateSchema

};

type EditorState<T> = {
	info: T;
	errors?: Errors;
};

type EditorInjectOptions<T> = {
	attribute: string;
	getSchema: GetSchema<T>;
};

const makeSection = <T>(options : EditorInjectOptions<T> & {
	title?: string;
	order?: number;
}): PluggableComponent<EditorState<T>> => {
	const { attribute, getSchema, title, order } = {
		title: "Lisätiedot",
		order: 90,
		...options
	};

	return {
		title,
		order,
		component: {
			view: vnode => m(
				EditorComponent,
				{
					blob: getBlob(vnode.attrs.info, attribute),
					schema: getSchema(vnode.attrs.info),
					errors: vnode.attrs.errors?.field(attribute),
					attrs: { class: "mt-1" }
				}
			)
		}
	};
};

ijik.plugins.blob = {

	member: (options: EditorInjectOptions<EditMemberInfo|NewMemberInfo>) => {
		memberEditorSection(makeSection(options));
	},

	registrant: (options: EditorInjectOptions<UserInfo>) => {
		userEditorSection(makeSection(options));
	}	

};
