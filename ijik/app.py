import itertools
import pathlib
import fastapi
import pluggy
from fastapi.templating import Jinja2Templates
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import registry as sa_registry
import ijik
from ijik.db import SessionManager
from ijik.entity import EntityManager, Hooks as EntityHooks
from ijik.form import FormRenderer, Hooks as FormHooks
from ijik.mixin import Mixins

class Hooks:

    @ijik.hookspec(historic=True)
    def ijik_plugin_init(self, app):
        pass

    @ijik.hookspec
    def ijik_plugin_start(self):
        pass

    @ijik.hookspec
    def ijik_app_setup(self):
        pass

    @ijik.hookspec
    def ijik_uncaught_exception(self, exc):
        pass

class Ijik:

    def __init__(self, *,
            api: fastapi.FastAPI,
            templates: Jinja2Templates,
            pluginmanager: pluggy.PluginManager,
            registry: sa_registry,
            sessionmanager: SessionManager,
            entitymanager: EntityManager,
            mixins: Mixins,
            form_renderer: FormRenderer
        ):

        self.api = api
        self.templates = templates
        self.pluginmanager = pluginmanager
        self.registry = registry
        self.sessionmanager = sessionmanager
        self.get_session = sessionmanager.get_session
        self.entitymanager = entitymanager
        self.mixins = mixins
        self.form_renderer = form_renderer

    def init(self):
        self.pluginmanager.hook.ijik_plugin_init.call_historic(kwargs={"app": self})

    def setup(self):
        self.pluginmanager.hook.ijik_app_setup()

    def plugin(self, plugin):
        self.pluginmanager.register(plugin)

def create_app(*,
        plugins=(),
        template_paths=(),
        **plugin_kwargs
    ):

    api = fastapi.FastAPI()
    api.mount("/static", StaticFiles(directory=ijik_path("static")), name="static")

    pluginmanager = pluggy.PluginManager("ijik")
    pluginmanager.add_hookspecs(Hooks)
    pluginmanager.add_hookspecs(EntityHooks)
    pluginmanager.add_hookspecs(FormHooks)

    for p in itertools.chain(core_plugins(**plugin_kwargs), plugins):
        pluginmanager.register(p)

    @api.exception_handler(Exception)
    async def api_error(request, exc):
        pluginmanager.hook.ijik_uncaught_exception(exc=exc)
        return PlainTextResponse("Internal Server Error", status_code=500)

    ijik = Ijik(
            api = api,
            templates = Jinja2Templates(directory=[ *template_paths, ijik_path("templates") ]),
            pluginmanager = pluginmanager,
            registry = sa_registry(),
            sessionmanager = SessionManager(),
            entitymanager = EntityManager(pluginmanager),
            mixins = Mixins(),
            form_renderer = FormRenderer(pluginmanager)
    )

    ijik.init()
    ijik.setup()

    return api

def core_plugins(*, db_path="db.sqlite3"):
    yield ijik.DbPlugin(db_path)
    yield ijik.FastAPIErrorsPlugin()
    yield ijik.DefaultFormRendererPlugin()
    yield ijik.LoggingPlugin()

    yield ijik.RegistrantsPlugin()
    yield ijik.TeamsPlugin()

def ijik_path(name):
    return str(pathlib.Path(__file__).parent.parent.absolute() / name)
