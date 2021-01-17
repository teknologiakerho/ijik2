import json
from typing import List, Optional

import fastapi
from fastapi.responses import JSONResponse
import pydantic
from sqlalchemy.ext.associationproxy import _AssociationList
from sqlalchemy.orm import Session

import ijik
from ijik.helpers import abort, escape, filter_none, loc_validator, partial

__all__ = ["MembersPlugin"]

class EditorMemberProps(pydantic.BaseModel):
    first_name: str
    last_name: str

    @pydantic.root_validator
    @loc_validator("name")
    def name_nonempty(cls, values):
        if not (values.get("first_name") and values.get("last_name")):
            raise ValueError("Nimi puuttuu")
        return values

class EditorMemberInfo(EditorMemberProps, pydantic.BaseModel):
    id: int

    class Config:
        orm_mode = True

class EditorTeamMembers(pydantic.BaseModel):
    member_ids: List[int]

    @pydantic.validator("member_ids", pre=True)
    def assoclist_to_list(cls, v):
        if isinstance(v, _AssociationList):
            v = list(v)
        return v

class MembersPlugin:

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        self.mixins = app.mixins
        self.pluginmanager = app.pluginmanager
        self.sessionmanager = app.sessionmanager
        self.entitymanager = app.entitymanager
        self.templates = app.templates

        ijik.mixin(self.mixins.EditorNewMember)(EditorMemberProps)
        ijik.mixin(self.mixins.EditorUpdateMember)(partial(EditorMemberProps))
        ijik.mixin(self.mixins.EditorMemberInfo)(EditorMemberInfo)

        ijik.mixin(self.mixins.EditorNewTeam)(EditorTeamMembers)
        ijik.mixin(self.mixins.EditorUpdateTeam)(partial(EditorTeamMembers))
        ijik.mixin(self.mixins.EditorTeamInfo)(EditorTeamMembers)

    @ijik.hookimpl
    def ijik_editor_setup(self, editor, router):
        NewMember = self.mixins.EditorNewMember.to_class("NewMember")
        UpdateMember = self.mixins.EditorUpdateMember.to_class("UpdateMember")
        MemberInfo = self.mixins.EditorMemberInfo.to_class("EditorMemberInfo")

        self.pluginmanager.register(EditorMemberHooksPlugin(
            MemberInfo = MemberInfo
        ))

        @router.post("/members/new", response_model=MemberInfo)
        async def new_member(
                schema: NewMember,
                user: ijik.Registrant = fastapi.Depends(editor.get_auth),
                db: Session = fastapi.Depends(self.sessionmanager.get_session)
            ):

            member = ijik.Member(registrant=user, **schema.dict())
            self.entitymanager.session(db).add(member)
            return MemberInfo.from_orm(member)

        @router.patch("/members/{id}", response_model=MemberInfo)
        async def update_member(
                id: int,
                schema: UpdateMember,
                user: ijik.Registrant = fastapi.Depends(editor.get_auth),
                db: Session = fastapi.Depends(self.sessionmanager.get_session)
            ):

            member = db.query(ijik.Member).filter_by(id=id, registrant_id=user.id).one_or_none() or abort(404)
            self.entitymanager.session(db).update(member, **filter_none(schema.dict()))
            return MemberInfo.from_orm(member)

        @router.delete("/members/{id}")
        async def delete_member(
                id: int,
                user: ijik.Registrant = fastapi.Depends(editor.get_auth),
                db: Session = fastapi.Depends(self.sessionmanager.get_session)
            ):

            member = db.query(ijik.Member).filter_by(id=id, registrant_id=user.id).one_or_none() or abort(404)
            self.entitymanager.session(db).delete(member)

    @ijik.hookimpl
    def ijik_monitor_setup(self, monitor, router):
        hoverlist_template = self.templates.get_template("monitor/hoverlist.html")

        @monitor.field("Member", name="Id", prio=-1000, html=False)
        def id(member):
            return member.id

        @monitor.field("Member", name="Sukunimi", prio=-100)
        def last_name(member):
            return member.last_name

        @monitor.field("Member", name="Etunimi", prio=-99)
        def first_name(member):
            return member.first_name

        @monitor.field("Member", name="Ilmoittaja Id", prio=-999, html=False)
        def registrant_id(member):
            return member.registrant_id

        @monitor.field("Member", name="Ilmoittaja")
        def registrant(member):
            return member.registrant.name

        @monitor.field("Member", name="Joukkueet")
        def teams(member):
            return ",".join(str(t.id) for t in member.teams)

        @teams.html
        def teams(member):
            return hoverlist_template.render({ "items": [t.name for t in member.teams] })

        @monitor.field("Member", name="Joukkueiden nimet", html=False)
        def team_names(member):
            return ",".join(escape(t.name, ",") for t in member.teams)

        @monitor.field("Team", name="Jäsenet")
        def members(team):
            return ",".join(str(m.id) for m in team.members)

        @members.html
        def members(team):
            return hoverlist_template.render({ "items": [m.name for m in team.members] })

        @monitor.field("Team", name="Jäsenten nimet", html=False)
        def member_names(team):
            return ",".join(escape(m.name, ",") for m in team.members)

class EditorMemberHooksPlugin:

    def __init__(self, *, MemberInfo):
        self.MemberInfo = MemberInfo

    @ijik.hookimpl
    def ijik_editor_render(self, db, registrant, template):
        members = [self.MemberInfo.from_orm(member).dict() for member in
                db.query(ijik.Member).filter_by(registrant_id=registrant.id).all()]
        template.js.append(f"ijik.plugins.members({json.dumps(members)})")
