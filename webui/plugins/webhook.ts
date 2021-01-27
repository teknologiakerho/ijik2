import m from "mithril";
import {ijik} from "../editor";
import {$} from "../messages";
import {pushNotification} from "../notify";
import {
	Notification,
	action, postForm
} from "../components";
import {homeAction} from "./info";

ijik.plugins.webhook = {

	user: (webhook: {
		name: string;
		desc: string;
		endpoint: string;
		successText?: string;
	}) => {
		const post = postForm({ url: webhook.endpoint });

		const invoke = () => post().then(
			webhook.successText ? (() => pushNotification(
				Notification.Success,
				webhook.successText
			).dismiss(5000)) : undefined,
			() => pushNotification(
				Notification.Error,
				post.errors!.desc()
			).dismiss(5000)
		);

		homeAction({
			title: webhook.name,
			order: 10,
			component: {
				view: () => post.loading
					? m(".flex.items-center.justify-center", m("i.fas.fa-spinner.animate-spin"))
					: action({
						class: "bg-yellow-800 hover:bg-yellow-700",
						children: webhook.name,
						onclick: invoke
					})
			},
			help: webhook.desc
		});
	}

}
