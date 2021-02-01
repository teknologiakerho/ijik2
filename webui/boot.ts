import {ijik} from "./editor";
(window as any).ijik = ijik;

import {setup as setupNotifications} from "./notify"
import {setup as setupPopup} from "./popup";

setupNotifications();
setupPopup();

import "./plugins/blob";
import "./plugins/category";
import "./plugins/info";
import "./plugins/members";
import "./plugins/notify";
import "./plugins/privacypolicy";
import "./plugins/teams";
import "./plugins/user";
import "./plugins/webhook";

ijik.plugins.info();
