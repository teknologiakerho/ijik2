import pydantic

import ijik

class TestDataPlugin:

    def __init__(self, get_data):
        self.get_data = get_data

    @ijik.hookimpl
    @ijik.entity_hook("Registrant")
    def ijik_add_entity(self, registrant, session):
        yield

        for entity in self.get_data(registrant):
            entity.registrant = registrant
            session.add(entity)

class TestErrorsPlugin:

    def __init__(self, **kwargs):
        self.enabled = [ getattr(self, f"error_{key}")(**(ka if isinstance(ka, dict) else {}))
                for key, ka in kwargs.items() ]

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        for plugin in self.enabled:
            app.pluginmanager.register(plugin)

    # ----------------------------------------

    class error_mixin_missing_prop:

        def __init__(self, mixins=()):
            self.mixins = mixins

        @ijik.hookimpl
        def ijik_plugin_init(self, app):
            class Missing(pydantic.BaseModel):
                missing_prop: str

            for m in self.mixins:
                ijik.mixin(getattr(app.mixins, m))(Missing)

    class error_cancel_hook:

        def __init__(self, **hooks):
            for hook, arg in hooks.items():
                setattr(self, hook, ijik.hookimpl(self.canceller(arg)))

        @staticmethod
        def canceller(*causes):
            def f():
                return ijik.Errors(*causes)
            return f
