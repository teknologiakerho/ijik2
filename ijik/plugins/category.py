import json
from typing import Optional

import pydantic

import ijik

__all__ = ["CategoriesPlugin"]

class EditorTeamCategory(pydantic.BaseModel):
    category: str

class CategoriesPlugin:

    def __init__(self, *, categories=None, categories_for_user=None):
        self.categories = categories
        self.categories_for_user = categories_for_user

    def for_user(self, f):
        self.categories_for_user = f
        return f

    def get_categories(self, user):
        return self.categories_for_user(user) if self.categories_for_user else self.categories

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        ijik.mixin(app.mixins.EditorNewTeam)(EditorTeamCategory)
        ijik.mixin(app.mixins.EditorTeamInfo)(EditorTeamCategory)

    @ijik.hookimpl
    @ijik.validator
    @ijik.entity_hook("Team")
    def ijik_add_entity(self, team):
        allowed = self.get_categories(team.registrant)
        if team.category not in (cat.id for cat in allowed):
            raise ijik.Cancel({"category": "Virheellinen valinta"})

    @ijik.hookimpl
    def ijik_editor_render(self, registrant, template):
        categories = [cat.dict() for cat in self.get_categories(registrant)]
        template.js.append(f"ijik.plugins.category({json.dumps(categories)})")

    @ijik.hookimpl
    def ijik_monitor_setup(self, monitor):

        @monitor.field("Team", name="Sarja")
        def category(team):
            return team.category
