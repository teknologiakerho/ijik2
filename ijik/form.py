import typing as ty
import ijik

# mini-wtforms-kind of library, but:
#     * can render to either js schema or html
#     * behavior overrideable by plugins
#     * can use pydantic models

class Hooks:

    @ijik.hookspec(firstresult=True)
    def ijik_render_js_field(render, field):
        pass

    @ijik.hookspec(firstresult=True)
    def ijik_render_html_field(render, field, value, errors):
        pass

def config_proxy(key):
    @property
    def proxy(self):
        return self.config.get(key)
    return proxy

class Field:

    label = config_proxy("label")
    placeholder = config_proxy("placeholder")
    immutable = config_proxy("immutable")
    template = config_proxy("template")

    def __init__(self, name, type_, /, **config):
        self.name = name
        self.type_ = type_
        self.config = config

    @classmethod
    def from_pydantic(cls, schema, field):
        config = get_config(schema, field.name)
        return cls(field.name, field.type_, **config)

class FormRenderer:

    def __init__(self, pluginmanager):
        self.pluginmanager = pluginmanager

    def render_js(self, /, schema=None, field=None):
        if field is None:
            return [self.render_js(
                field = Field.from_pydantic(schema, f)
            ) for f in schema.__fields__.values()]

        ret = self.pluginmanager.hook.ijik_render_js_field(
                render = self.render_js,
                field = field
        )

        if ret is None:
            raise ValueError(f"No js renderer for field {field} of schema {schema}")

        return ret

    def render_html(self, /, schema=None, field=None, value=None, errors=None):
        if field is None:
            return "\n".join(self.render_html(
                field = Field.from_pydantic(schema, f),
                value = value and value.get(f.name),
                errors = errors and errors.get(f.name)
            ) for f in schema.__fields__.values())

        ret = self.pluginmanager.hook.ijik_render_html_field(
                render = self.render_html,
                field = field,
                value = value,
                errors = errors
        )

        if ret is None:
            raise ValueError(f"No html renderer for field {field} of schema {schema}")

        return ret

def get_config(schema, name=None):
    conf = getattr(schema, "__ijik_config__", None)
    if conf:
        conf = conf.__dict__
    if conf and name:
        conf = conf.get(name)
    return conf or {}
