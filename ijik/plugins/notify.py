import json
import ijik

__all__ = ["NotifyPlugin"]

class NotifyPlugin:

    def __init__(self, get_notifications):
        self.get_notifications = get_notifications

    @ijik.hookimpl
    def ijik_editor_render(self, registrant, template):
        notifications = [{"style": style, "text": text} for style,text
                in self.get_notifications(registrant)]

        if not notifications:
            return

        template.js.append(f"ijik.plugins.notify({json.dumps(notifications)})")
