import typing
import json

import pydantic
import jinja2

import ijik
from ijik.helpers import partial

class UserAgreeMixin(pydantic.BaseModel):
    privacy_ok: bool

class PrivacyPolicyPlugin:

    prio = 100

    def __init__(self, *,
                 label=None,
                 href=None,
                 fail_message="Sinun on hyväksyttävä tietosuojaehdot",
                 input_fail_message="Hyväksy tietosuojaehdot",
                 prio=None):

        if label is None:
            label = jinja2.Markup(f"<span>Hyväksyn <a href='{href}' class='text-blue-500' target=_blank>tietosuojaehdot</a></span>")\
                if href else "Hyväksyn tietosuojaehdot"

        self.field = ijik.Field(
            "privacy_ok", typing.Literal[True],
            label = label
        )

        self.href = href
        self.fail_message = fail_message
        self.input_fail_message = input_fail_message

        if prio is not None:
            self.prio = prio

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        self.form_renderer = app.form_renderer
        ijik.mixin(app.mixins.EditorNewSignup)(partial(UserAgreeMixin))

    @ijik.hookimpl
    def ijik_editor_render(self, template):
        if self.href:
            template.js.append(f"ijik.plugins.privacypolicy({json.dumps({'href': self.href})})")

    @ijik.hookimpl
    def ijik_editor_render_signup(self, schema, errors, template):
        template.input(self.form_renderer.render_html(
            field = self.field,
            value = schema and schema.get("privacy_ok"),
            errors = errors and errors.get("privacy_ok")
        ), self.prio)

    @ijik.hookimpl
    def ijik_editor_create_signup(self, kwargs):
        if not kwargs["privacy_ok"]:
            return ijik.Errors(self.fail_message, { "privacy_ok": self.input_fail_message })
        del kwargs["privacy_ok"]
