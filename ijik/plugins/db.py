import ijik
from ijik.base import Registrant, Team, Member, TeamMember

__all__ = ["DbPlugin"]

class DbPlugin:

    def __init__(self, path):
        self.path = path

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        self.registry = app.registry
        self.sessionmanager = app.sessionmanager

    @ijik.hookimpl
    def ijik_app_setup(self):
        self.sessionmanager.connect(
            f"sqlite:///{self.path}",
            connect_args = { "check_same_thread": False }
        )
        
        for cls in (Registrant, Team, Member, TeamMember):
            self.registry.map_declaratively(cls)

        self.sessionmanager.create_tables(self.registry.metadata)
