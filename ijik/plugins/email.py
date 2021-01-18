import functools
import ijik

__all__ = ["TemplateMailerMixin"]

class TemplateMailerMixin:

    Message = ijik.TemplateMessage
    template = "email/base.html"

    def __init__(self, sender, Message=None, template=None):
        self.sender = sender
        if Message is not None:
            self.Message = Message
        if template is not None:
            self.template = template

    @ijik.hookimpl(specname="ijik_plugin_init")
    def _template_mailer_plugin_init(self, app):
        self.template = app.templates.get_template(self.template)

    def send(self, **kwargs):
        message = self.Message(**kwargs, template=self.template)
        with self.sender() as send:
            send(message)
