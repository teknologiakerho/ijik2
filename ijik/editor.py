import fastapi
from fastapi.templating import Jinja2Templates
import pluggy
from sqlalchemy.orm import Session
import ijik
from ijik.entity import check
from ijik.login import authkey_login

class Hooks:

    @ijik.hookspec
    def ijik_editor_setup(editor, router):
        pass

    # this hook exists only as a hack to support "nested" models in the signup form.
    # for validation etc. use ijik_add_registrant
    @ijik.hookspec
    def ijik_editor_create_signup(editor, kwargs):
        pass

    @ijik.hookspec
    def ijik_editor_render(editor, db, registrant, template):
        pass

    @ijik.hookspec
    def ijik_editor_render_signup(editor, db, schema, errors, template):
        pass

# this must be defined before Editor
def b58_time_rand_keygen(time_bytes, random_bytes):
    import base58
    import time
    import os

    mask = 2**(time_bytes*8) - 1

    return lambda: base58.b58encode((int(time.time()) & mask).to_bytes(time_bytes, "little")
            + os.urandom(random_bytes)).decode("utf8")

class Editor:

    def __init__(self, *,
            templates: Jinja2Templates,
            pluginmanager: pluggy.PluginManager,
            sessionmanager: ijik.SessionManager,
            keyfunc=b58_time_rand_keygen(3, 5),
            auth_cookie="authkey"
        ):

        self.templates = templates
        self.pluginmanager = pluginmanager
        self.sessionmanager = sessionmanager
        self.keyfunc = keyfunc
        self.auth = authkey_login(cookie_name=auth_cookie)(self.get_user)

        async def get_auth(
                request: fastapi.Request,
                db: Session = fastapi.Depends(sessionmanager.get_session)
            ):

            user = self.auth.get_login(request, db)
            if not user:
                raise fastapi.HTTPException(403)

            return user

        self.get_auth = get_auth

    def setup(self, router):
        self.pluginmanager.hook.ijik_editor_setup(
                editor = self,
                router = router
        )

    def create_signup(self, kwargs):
        kwargs["key"] = self.keyfunc()
        self.pluginmanager.hook.ijik_editor_create_signup(editor=self, kwargs=kwargs)
        return ijik.Registrant(**kwargs)

    def render(self, **context):
        template = EditorTemplate(editor=self, **context)
        self.pluginmanager.hook.ijik_editor_render(editor=self, template=template, **context)
        return self.templates.get_template(template.template).render(**template.context)

    def render_signup(self, **context):
        template = SignupTemplate(editor=self, **context)
        self.pluginmanager.hook.ijik_editor_render_signup(editor=self, template=template, **context)
        return self.templates.get_template(template.template).render(**template.context)

    def render_login(self, **context):
        return self.templates.get_template("editor/login.html").render(**context)

    def render_logout(self, **context):
        return self.templates.get_template("editor/logout.html").render(**context)

    @staticmethod
    def get_user(key, db):
        return db.query(ijik.Registrant).filter_by(key=key).one_or_none()

class EditorTemplate:

    template = "editor/editor.html"

    def __init__(self, **extra):
        self.extra = extra
        self.js = []

    @property
    def context(self):
        return {
            **self.extra,
            "js": "\n".join(self.js)
        }

class SignupTemplate:

    template = "editor/signup.html"

    def __init__(self, **extra):
        self.extra = extra
        self.inputs = []

    def input(self, input, prio=0):
        self.inputs.append((input, prio))

    @property
    def context(self):
        return {
            **self.extra,
            "inputs": [inp for inp,_ in sorted(self.inputs, key=lambda x:x[1])]
        }
