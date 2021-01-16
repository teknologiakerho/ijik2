import fastapi
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session

import ijik
from ijik.monitor import Monitor, Hooks

__all__ = ["MonitorPlugin"]

class MonitorPlugin:

    def __init__(self, get_view, config={}):
        self.get_view = get_view
        self.config = config

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        self.api = app.api
        self.sessionmanager = app.sessionmanager

        app.pluginmanager.add_hookspecs(Hooks)

        self.monitor = Monitor(
                pluginmanager = app.pluginmanager,
                templates = app.templates,
                get_view = self.get_view,
                **self.config
        )

    @ijik.hookimpl
    def ijik_app_setup(self):
        router = fastapi.APIRouter()
        self.monitor.setup(router)
        self.api.include_router(router, prefix="/monitor/{key}")

    @ijik.hookimpl(trylast=True)
    def ijik_monitor_setup(self, monitor, router):

        @router.get("/", response_class=HTMLResponse)
        async def index(
                key: str,
                request: fastapi.Request,
                db: Session = fastapi.Depends(self.sessionmanager.get_session)
            ):

            view = monitor.view(db, key)
            if view is None:
                raise fastapi.HTTPException(404)

            return view.render(request=request)

        @router.get("/download/{id}")
        async def download(
                key: str,
                id: str,
                db: Session = fastapi.Depends(self.sessionmanager.get_session)
            ):

            # TODO: if content is iterator/async iterator, return a StreamingResponse

            dl = monitor.view(db, key).get_download(id)
            if not dl:
                raise fastapi.HTTPException(404)

            media_type, content = dl
            return Response(media_type=media_type, content=content)
