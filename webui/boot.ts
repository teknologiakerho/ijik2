import {ijik} from "./editor";
(window as any).ijik = ijik;

import {setup as setupNotifications} from "./notify"
import {setup as setupPopup} from "./popup";

setupNotifications();
setupPopup();

import "./plugins/teams";
import "./plugins/members";
import "./plugins/user";
import "./plugins/category";
import "./plugins/blob";
import "./plugins/info";

ijik.plugins.info();
