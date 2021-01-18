import m from "mithril";
import {ijik} from "../editor";
import {Notification} from "../components";
import {homeNotification} from "./info";

type NotificationOptions = {
	style: string;
	text: string;
};

const notification = (opts: NotificationOptions) => ({
	view: () => m(
		Notification[opts.style],
		opts.text
	)
});

ijik.plugins.notify = (notifications: NotificationOptions[]) => {
	for(const n of notifications){
		homeNotification(notification(n));
	}
};
