type Template = string | ((context: any) => string);
type Templates = { [name: string]: Template };

type Render = {
	(template: string, context?: any): string;
	defaults: (templates: Templates) => void;
	define: (templates: Templates) => void;
};

const templates: Templates = {};

export const $: Render = (template, context) => {
	const t = templates[template];
	if(!t)
		return "";
	if(typeof t === "string")
		return t;
	return t(context);
};

$.defaults = tmpl => {
	for(let name of Object.keys(tmpl)){
		if(!templates[name])
			templates[name] = tmpl[name];
	}
}

$.define = tmpl => Object.assign(templates, tmpl);
