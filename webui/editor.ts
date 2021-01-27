import {$} from "./messages";
import {startRouter} from "./routes";

export interface Ijik {
	({ root: string }): void;
	plugins: { [name: string]: any };
}

export const ijik : Ijik = (function(){
	const f = ({ root }) => startRouter(document.querySelector(root));
	f.plugins = {};
	return f;
})();

$.defaults({
	"edit:actions": "Toiminnot",
	"edit:entity-name": "Nimi"
});
