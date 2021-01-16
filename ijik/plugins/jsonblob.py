import functools
import json

import pydantic

import ijik
from ijik.helpers import partial
from ijik.form import get_config
from ijik.jsonblob import SchemaMap, mutable

__all__ = ["BlobPlugin"]

# ---- Plugin class selection ----------------------------------------

class PluginClassCache:

    def __init__(self):
        self.creators = []

    def plugin_class(self, entity, variants):
        def ret(cls):
            def create(entity_, blob):
                if entity != entity_:
                    return

                variant = [c for c in (v.select_mixin(blob) for v in variants) if c is not None]
                if len(variant) != 1:
                    raise ValueError(f"No variant selected for entity {entity} with blob {blob}: {variant}")

                return self._plugin_class(cls, variant[0])
            self.creators.append(create)
        return ret

    @functools.lru_cache
    def _plugin_class(self, cls, variant):
        return type(
                f"Blob_{cls.__name__}_{variant.__name__}",
                (cls, variant),
                {}
        )

    def create_plugin_class(self, entity, blob):
        cls = [c for c in (create(entity, blob) for create in self.creators) if c is not None]
        if len(cls) != 1:
            raise ValueError(f"No creator selected for entity {entity} with blob {blob}: {cls}")
        return cls[0]

cache = PluginClassCache()

# ---- Attribute mixins ----------------------------------------

# always inject the same schema for the same entity.
# this is special-cased because it allows for nicer api docs and static html forms
# (no javascript needed).
# this is the only kind of attribute that the login page (Registrant) supports.
class StaticBlobMixin:

    def __init__(self, attribute, schema):
        self.attribute = attribute
        self.schema = schema
    
    @functools.cached_property
    def inject_model(self):
        return pydantic.create_model(
                f"{self.schema.__name__}_JSONBlob",
                **{ self.attribute: (self.schema, ...) }
        )

    @functools.cached_property
    def inject_update_model(self):
        return pydantic.create_model(
                f"{self.schema.__name__}_MutableJSONBlob",
                **{ self.attribute: (mutable(self.schema), ...) }
        )

    def new(self, entity):
        pass

    def update(self, entity, kwargs):
        if self.attribute not in kwargs:
            return

        # just merge, validation isn't needed because we inject the actual model

        kwargs[self.attribute] = {
                **getattr(entity, self.attribute),
                **kwargs[self.attribute]
        }

    @ijik.hookimpl(specname="ijik_plugin_init")
    def ijik_plugin_init_(self, app):
        self.renderer = app.form_renderer

    @ijik.hookimpl
    def ijik_editor_render(self, template):
        template.js.append(f"""{self.js_plugin}({{
            attribute: {json.dumps(self.attribute)},
            getSchema: ijik.blob.schema({json.dumps(self.renderer.render_js(schema=self.schema))})
        }}) """)

    @ijik.hookimpl
    def ijik_monitor_setup(self, monitor):
        conf = get_config(self.schema)
        if not conf:
            return

        for name in self.schema.__fields__:
            fc = conf.get(name)
            mon = fc and fc.get("monitor")
            if mon is None:
                return

            if mon is True:
                mon = {}

            if "name" not in mon:
                mon["name"] = fc.get("label")

            self._inject_monitor_field(monitor, name, mon)

    def _inject_monitor_field(self, monitor, attr, kwargs):

        @monitor.field(self.entity_class, html="auto", **kwargs)
        def injected_field(entity):
            return getattr(entity, self.attribute).get(attr)

    @classmethod
    def select_mixin(cls, blob):
        if isinstance(blob, type) and issubclass(blob, pydantic.BaseModel):
            return cls

# dynamically select the injected schema based on attributes.
# allows for more flexibility than the static schema, but we will not get nice api docs,
# and require dynamic (javascript) forms.
# only supported on the editor webui.
class DynamicBlobMixin:

    def __init__(self, attribute, schema_map):
        self.attribute = attribute
        self.schema_map = schema_map

    @functools.cached_property
    def inject_model(self):
        return pydantic.create_model(
                "JSONBlob",
                **{ self.attribute: (dict, ...) }
        )

    @property
    def inject_update_model(self):
        return self.inject_model

    def new(self, entity):
        old = getattr(entity, self.attribute, None)
        if not old:
            return

        model = self.schema_map.get(entity)
        setattr(entity, self.attribute, model(**old).dict())

    def update(self, entity, kwargs):
        if self.attribute not in kwargs:
            return

        model = self.schema_map.get(entity)
        kwargs[self.attribute] = model(
                **getattr(entity, self.attribute),
                **kwargs[self.attribute]
        ).dict()

    @ijik.hookimpl(specname="ijik_plugin_init")
    def ijik_plugin_init_(self, app):
        self.renderer = app.form_renderer

    @ijik.hookimpl
    def ijik_editor_render(self, template):
        rules = ", ".join(
                f"[{match.js_matcher}, {json.dumps(self.renderer.render_js(schema=schema))}]"
                for match, schema in self.schema_map
        )

        template.js.append(f"""{self.js_plugin}({{
            attribute: {json.dumps(self.attribute)},
            getSchema: ijik.blob.schemaMap([{rules}])
        }})""")

    @classmethod
    def select_mixin(cls, blob):
        if isinstance(blob, SchemaMap):
            return cls

# ---- Entity specialization ----------------------------------------

def redirector_mixin(name):

    class RedirectorMixin:

        entity_class = name

        @ijik.hookimpl(specname="ijik_new_entity")
        @ijik.entity_hook(name)
        def _redirect_new_entity(self, entity):
            self.new(entity)

        @ijik.hookimpl(specname="ijik_update_entity")
        @ijik.entity_hook(name)
        def _redirect_update_entity(self, entity, kwargs):
            self.update(entity, kwargs)

    return RedirectorMixin

@cache.plugin_class(entity="Member", variants=(StaticBlobMixin, DynamicBlobMixin))
class MemberMixin(redirector_mixin("Member")):

    js_plugin = "ijik.plugins.blob.member"

    @ijik.hookimpl(specname="ijik_plugin_init")
    def _member_mixin_init(self, app):
        ijik.mixin(app.mixins.EditorNewMember)(self.inject_model)
        ijik.mixin(app.mixins.EditorUpdateMember)(partial(self.inject_update_model))
        ijik.mixin(app.mixins.EditorMemberInfo)(self.inject_model)

@cache.plugin_class(entity="Team", variants=(StaticBlobMixin, DynamicBlobMixin))
class TeamMixin(redirector_mixin("Team")):

    js_plugin = "ijik.plugins.blob.team"

    @ijik.hookimpl(specname="ijik_plugin_init")
    def _team_mixin_init(self, app):
        ijik.mixin(app.mixins.EditorNewTeam)(self.inject_model)
        ijik.mixin(app.mixins.EditorUpdateTeam)(partial(self.inject_update_model))
        ijik.mixin(app.mixins.EditorTeamInfo)(self.inject_model)

@cache.plugin_class(entity="Registrant", variants=(StaticBlobMixin, ))
class RegistrantStaticMixin(redirector_mixin("Registrant")):

    js_plugin = "ijik.plugins.blob.registrant"

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        ijik.mixin(app.mixins.EditorNewSignup)(self.schema) # note: this is the static model
        ijik.mixin(app.mixins.EditorUpdateUser)(partial(self.inject_update_model))
        ijik.mixin(app.mixins.EditorUserInfo)(self.inject_model)

    @ijik.hookimpl
    def ijik_editor_create_signup(self, kwargs):
        kwargs[self.attribute] = dict((k, kwargs[k]) for k in self.schema.__fields__)
        for k in self.schema.__fields__:
            del kwargs[k]

    @ijik.hookimpl
    def ijik_editor_render_signup(self, editor, schema, errors, template):
        template.input(self.renderer.render_html(schema=self.schema, value=schema, errors=errors))

# --------------------------------------------------------------------------------

class BlobPlugin:

    def __init__(self, blobs=[], attribute="attrs"):
        self.blobs = blobs
        self.attribute = attribute

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        for entity, blob in self.blobs:
            cls = cache.create_plugin_class(entity, blob)
            app.pluginmanager.register(cls(self.attribute, blob))
