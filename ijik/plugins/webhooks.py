import json

import fastapi

import ijik
from ijik.webhooks import Hooks

__all__ = ["WebhooksPlugin"]

webhook_plugins = {}
def webhook_plugin(name):
    def deco(cls):
        webhook_plugins[name] = cls
        return cls
    return deco

# -------------------------------------------------------------------------------- 

@webhook_plugin("user")
class UserWebhookPlugin:

    def __init__(self, webhook):
        self.webhook = webhook

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        self.pluginmanager = app.pluginmanager

    @ijik.hookimpl
    def ijik_editor_setup(self, editor, router):

        @router.post(self.webhook.endpoint)
        async def user_webhook(
            user: ijik.Registrant = fastapi.Depends(editor.get_auth)
        ):
            self.pluginmanager.hook.ijik_webhook(id=self.webhook.id, kwargs={"registrant": user})

    @ijik.hookimpl
    def ijik_editor_render(self, template):
        template.js.append(f"ijik.plugins.webhook.user({json.dumps(self.webhook.dict())})")

class WebhooksPlugin:

    def __init__(self, webhooks):
        self.webhooks = [webhook_plugins[w.plugin](w) for w in webhooks]

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        app.pluginmanager.add_hookspecs(Hooks)
        for w in self.webhooks:
            app.pluginmanager.register(w)
