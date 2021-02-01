import m from "mithril";
import {ijik} from "../editor";
import {infoLink} from "./info";

ijik.plugins.privacypolicy = (opt: {
	href: string
}) => {
	infoLink({
		title: "Tietosuojaseloste",
		order: 20,
		href: opt.href,
		icon: "i.fas.fa-user-secret",
		selector: "a.text-blue-600"
	});
};
