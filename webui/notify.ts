import m from "mithril";
import {overlay} from "./overlay";

const activeNotifications: Notification[] = [];
const dismiss = (notification: Notification) => {
	const idx = activeNotifications.indexOf(notification);
	if(idx >= 0)
		activeNotifications.splice(idx, 1);
}

class Notification {
	render: () => m.Vnode;

	constructor(render: () => m.Vnode){
		this.render = render;
	}

	dismiss(timeout?: number){
		setTimeout(() => {
			dismiss(this);
			m.redraw();
		}, timeout);
		return this;
	}
};

// this should only accept undefined attrs when {} is assignable to T,
// but typescript doesn't seem to support that (?)
export const pushNotification = <T>(component: m.ComponentTypes<T>, attrs?: T) => {
	const notification = new Notification(() => m(component, attrs as T));
	activeNotifications.push(notification);
	return notification;
};

const NotificationHost: m.Component = {
	view: () => m(
		".fixed.bottom-4.w-screen.flex.flex-col.items-center",
		activeNotifications.map(notification => notification.render())
	)
};

export const setup = () => {
	overlay(NotificationHost);
};
