import json
from typing import Optional

import fastapi
import pydantic
from sqlalchemy.orm import Session

import ijik
from ijik.helpers import abort, filter_none, partial

__all__ = ["TeamsPlugin"]

class EditorTeamProps(pydantic.BaseModel):
    name: pydantic.constr(min_length=1)

class EditorTeamInfo(EditorTeamProps, pydantic.BaseModel):
    id: int

    class Config:
        orm_mode = True

class TeamsPlugin:

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        self.mixins = app.mixins
        self.pluginmanager = app.pluginmanager
        self.sessionmanager = app.sessionmanager
        self.entitymanager = app.entitymanager

        ijik.mixin(self.mixins.EditorNewTeam)(EditorTeamProps)
        ijik.mixin(self.mixins.EditorUpdateTeam)(partial(EditorTeamProps))
        ijik.mixin(self.mixins.EditorTeamInfo)(EditorTeamInfo)

    @ijik.hookimpl
    def ijik_editor_setup(self, editor, router):
        NewTeam = self.mixins.EditorNewTeam.to_class("NewTeam")
        UpdateTeam = self.mixins.EditorUpdateTeam.to_class("UpdateTeam")
        TeamInfo = self.mixins.EditorTeamInfo.to_class("EditorTeamInfo")

        self.pluginmanager.register(EditorTeamHooksPlugin(
            TeamInfo = TeamInfo
        ))

        @router.post("/teams/new", response_model=TeamInfo)
        async def new_team(
                schema: NewTeam,
                user: ijik.Registrant = fastapi.Depends(editor.get_auth),
                db: Session = fastapi.Depends(self.sessionmanager.get_session)
            ):

            team = ijik.Team(registrant=user, **schema.dict())
            self.entitymanager.session(db).add(team)
            return TeamInfo.from_orm(team)

        @router.patch("/teams/{id}", response_model=TeamInfo)
        async def update_team(
                id: int,
                schema: UpdateTeam,
                user: ijik.Registrant = fastapi.Depends(editor.get_auth),
                db: Session = fastapi.Depends(self.sessionmanager.get_session)
            ):

            team = db.query(ijik.Team).filter_by(id=id, registrant_id=user.id).one_or_none() or abort(404)
            self.entitymanager.session(db).update(team, **filter_none(schema.dict()))
            return TeamInfo.from_orm(team)

        @router.delete("/teams/{id}")
        async def delete_team(
                id: int,
                user: ijik.Registrant = fastapi.Depends(editor.get_auth),
                db: Session = fastapi.Depends(self.sessionmanager.get_session)
            ):

            team = db.query(ijik.Team).filter_by(id=id, registrant_id=user.id).one_or_none() or abort(404)
            self.entitymanager.session(db).delete(team)

    @ijik.hookimpl
    def ijik_monitor_setup(self, monitor):

        @monitor.field("Team", name="Id", prio=-1000, html=False)
        def id(team):
            return team.id

        @monitor.field("Team", name="Ilmoittaja Id", prio=-999, html=False)
        def registrant_id(team):
            return team.registrant_id

        @monitor.field("Team", name="Nimi", prio=-100)
        def name(team):
            return team.name

        @monitor.field("Team", name="Ilmoittaja")
        def registrant(team):
            return team.registrant.name

class EditorTeamHooksPlugin:

    def __init__(self, *, TeamInfo):
        self.TeamInfo = TeamInfo

    @ijik.hookimpl
    def ijik_editor_render(self, registrant, template):
        teams = [self.TeamInfo.from_orm(team).dict() for team in registrant.teams]
        template.js.append(f"ijik.plugins.teams({json.dumps(teams)})")
