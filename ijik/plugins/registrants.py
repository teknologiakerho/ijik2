import json

import fastapi
import pydantic
from sqlalchemy.orm import Session

import ijik
from ijik.helpers import filter_none, partial

__all__ = ["RegistrantsPlugin"]

class EditorUserProps(pydantic.BaseModel):
    name: str

class EditorUserInfo(EditorUserProps):
    class Config:
        orm_mode = True

class RegistrantsPlugin:

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        self.mixins = app.mixins
        self.entitymanager = app.entitymanager
        self.pluginmanager = app.pluginmanager
        self.sessionmanager = app.sessionmanager
        self.templates = app.templates

        ijik.mixin(self.mixins.EditorNewSignup)(EditorUserInfo)
        ijik.mixin(self.mixins.EditorUpdateUser)(partial(EditorUserProps))
        ijik.mixin(self.mixins.EditorUserInfo)(EditorUserInfo)

    @ijik.hookimpl
    def ijik_editor_setup(self, editor, router):
        UpdateUser = self.mixins.EditorUpdateUser.to_class("UpdateUser")
        UserInfo = self.mixins.EditorUserInfo.to_class("UserInfo")

        self.pluginmanager.register(EditorUserHooksPlugin(UserInfo=UserInfo))

        @router.patch("/details")
        async def update_user(
                schema: UpdateUser,
                user: ijik.Registrant = fastapi.Depends(editor.get_auth),
                db: Session = fastapi.Depends(self.sessionmanager.get_session)
            ):

            self.entitymanager.session(db).update(user, **filter_none(schema.dict()))
            return UserInfo.from_orm(user)

    @ijik.hookimpl
    def ijik_monitor_setup(self, monitor, router):
        hide_template = self.templates.get_template("monitor/hide.html")

        @monitor.field("Registrant", name="Id", prio=-1000, html=False)
        def id(registrant):
            return registrant.id

        @monitor.field("Registrant", name="Nimi", prio=-100)
        def name(registrant):
            return registrant.name

        @monitor.field("Registrant", name="Avain", prio=100)
        def key(registrant):
            return registrant.key

        @key.html
        def key(registrant):
            return hide_template.render({ "content": registrant.key, "text": "Näytä avain" })

class EditorUserHooksPlugin:

    def __init__(self, *, UserInfo):
        self.UserInfo = UserInfo

    @ijik.hookimpl
    def ijik_editor_render(self, registrant, template):
        info = self.UserInfo.from_orm(registrant)
        template.js.append(f"ijik.plugins.user({json.dumps(info.dict())})")
