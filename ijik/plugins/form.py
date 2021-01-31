import typing

import pydantic

import ijik
from ijik.helpers import unpack_container

__all__ = ["DefaultFormRendererPlugin"]

class DefaultFormRendererPlugin:

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        app.pluginmanager.register(DefaultJsRendererPlugin())
        app.pluginmanager.register(DefaultHTMLRendererPlugin())

class DefaultJsRendererPlugin:

    @ijik.hookimpl(trylast=True)
    def ijik_render_js_field(self, field):
        type_ = self._get_input_type(field.type_)

        if type_ is None:
            return

        return {
            "type": type_,
            "name": field.name,
            "label": field.label,
            "placeholder": field.placeholder,
            "immutable": field.immutable
        }

    @staticmethod
    def _get_input_type(type_):
        if type_ is bool:
            return "bool"

        if type_ in (int, float):
            return "str"

        if issubclass(type_, str):
            return "str"

class DefaultHTMLRendererPlugin:

    template = "editor/input.html"

    input_types = {
        pydantic.EmailStr: "email",
        str: "text",
        bool: "checkbox",
        int: "number",
        float: "number",
    }

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        self.templates = app.templates

    @ijik.hookimpl(trylast=True)
    def ijik_render_html_field(self, field, value, errors):
        kw = self._get_input_type(field.type_)

        if kw is None:
            return

        template = self.templates.get_template(field.template or self.template)
        return template.render({
            **kw,
            "name": field.name,
            "label": field.label,
            "placeholder": field.placeholder,
            "value": value,
            "errors": errors and errors.direct_causes,
        })

    def _get_input_type(self, type_):
        container, type_ = unpack_container(type_)

        # type `type_ is bool` is a workaround for checkboxes being completely retarded and
        # not sending ANY value when unchecked. adding a `required` to the checkbox
        # (means it must be checked) does NOT mean the same thing as the field being required
        # (it must have a value).
        if container is typing.Optional:
            kw = {}
        elif container is typing.Literal:
            if type_ is True:
                return { "required": True, "type": "checkbox" }
            return
        elif container is None:
            kw = {} if type_ is bool else { "required": True }
        else:
            return

        for typ, it in self.input_types.items():
            if issubclass(type_, typ):
                kw["type"] = it
                return kw
