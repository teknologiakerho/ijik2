import fastapi
from fastapi.responses import HTMLResponse, RedirectResponse, Response
import pydantic
from sqlalchemy.orm import Session

import ijik
from ijik.editor import Editor, Hooks
from ijik.helpers import as_param

__all__ = ["EditorPlugin"]

class EditorNewSignup(pydantic.BaseModel):
    name: str

class LoginRequest(pydantic.BaseModel):
    key: str

class EditorPlugin:

    def __init__(self, config={}, name_input=None):
        self.config = config
        self.name_input = name_input

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        self.api = app.api
        self.get_session = app.get_session
        self.mixins = app.mixins
        self.pluginmanager = app.pluginmanager
        self.entitymanager = app.entitymanager
        self.form_renderer = app.form_renderer

        app.pluginmanager.add_hookspecs(Hooks)

        self.editor = Editor(
                templates = app.templates,
                pluginmanager = app.pluginmanager,
                sessionmanager = app.sessionmanager,
                **self.config
        )

        ijik.mixin(self.mixins.EditorNewSignup)(EditorNewSignup)

    @ijik.hookimpl
    def ijik_app_setup(self):
        router = fastapi.APIRouter()
        self.editor.setup(router)
        self.api.include_router(router)

    @ijik.hookimpl
    def ijik_editor_setup(self, editor, router):
        NewSignup = self.mixins.EditorNewSignup.to_class("NewSignup")

        if not self.name_input:
            self.name_input = ijik.Field.from_pydantic(NewSignup, NewSignup.__fields__["name"])

        @router.get("/", response_class=HTMLResponse)
        async def index(
                request: fastapi.Request,
                db: Session = fastapi.Depends(self.get_session)
            ):

            user = editor.auth.get_login(request, db)
            if user:
                return editor.render(
                        db = db,
                        registrant = user,
                        request = request
                )
            else:
                return editor.render_signup(
                        db = db,
                        schema = None,
                        errors = None,
                        request = request
                )

        @router.post("/", response_class=HTMLResponse)
        async def signup(
                request: fastapi.Request,
                schema: NewSignup = fastapi.Depends(as_param(NewSignup, param=fastapi.Form)),
                db: Session = fastapi.Depends(self.get_session)
            ):

            user = editor.create_signup(schema.dict())

            try:
                self.entitymanager.session(db).add(user)
            except ijik.Cancel as e:
                return editor.render_signup(
                        db = db,
                        schema = schema.dict(),
                        errors = e.cause,
                        request = request
                )
            else:
                resp = RedirectResponse(request.url.path, status_code=303)
                editor.auth.login(resp, user.key)
                return resp

        @router.get("/login", response_class=HTMLResponse)
        async def login_page(request: fastapi.Request):
            return editor.render_login(request=request)

        @router.post("/login", response_class=HTMLResponse)
        async def login(
                request: fastapi.Request,
                schema: LoginRequest = fastapi.Depends(as_param(LoginRequest, param=fastapi.Form)),
                db: Session = fastapi.Depends(self.get_session)
            ):

            user = editor.auth.get(schema.key, db=db)

            if user:
                resp = RedirectResponse(request.url_for("index"), status_code=303)
                editor.auth.login(resp, user.key)
                return resp

            return editor.render_login(
                    request = request,
                    errors = ijik.Errors("Tarkista avain")
            )

        @router.post("/logout")
        @router.get("/logout")
        async def logout(request: fastapi.Request):
            if request.method == "GET":
                if editor.auth.get_key(request):
                    resp = RedirectResponse(request.url.path) 
                else:
                    return HTMLResponse(editor.render_logout(request=request))
            else:
                resp = Response(content="")
            editor.auth.logout(resp)
            return resp

    @ijik.hookimpl
    def ijik_editor_render_signup(self, editor, schema, errors, template):
        template.input(self.form_renderer.render_html(
            field = self.name_input,
            value = schema and schema.get("name"),
            errors = errors and errors.get("name")
        ), prio=-100)
