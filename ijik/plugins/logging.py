import logging

import sqlalchemy as sa

import ijik
from ijik.helpers import wrap_argspec

__all__ = ["LoggingPlugin"]

class DbOperationLoggerPlugin:

    def __init__(self, logger):
        self.logger = logger

    @ijik.hookimpl
    def ijik_app_init(self, app):
        self.pluginmanager = app.pluginmanager

    @ijik.hookimpl(specname="ijik_add_entity")
    def ijik_add_entity(self, entity):
        try:
            yield
            yield
        except ijik.Cancel as exc:
            self.logger.debug((
                f"Cancel add: {entity}"
                f"\n-> exception: {exc}"
            ))
        else:
            self.logger.info(f"Created {entity}")

    @ijik.hookimpl
    def ijik_update_entity(self, entity, kwargs):
        #old = str(entity)

        try:
            yield
            yield
        except ijik.Cancel as exc:
            self.logger.debug((
                f"Cancel update: {entity}"
                f"\n-> update: {kwargs}"
                f"\n-> exception: {exc}"
            ))
        else:
            self.logger.info(f"Updated {kwargs} :: {entity}")
            #self.logger.info((
            #    f"Update {kwargs}"
            #    f"\n->from: {old}"
            #    f"\n->to:   {entity}"
            #))

    @ijik.hookimpl
    def ijik_delete_entity(self, entity):
        info = str(entity)

        try:
            yield
            yield
        except ijik.Cancel as exc:
            self.logger.debug((
                f"Cancel delete: {entity}"
                f"\n-> exception: {exc}"
            ))
        else:
            self.logger.info(f"Deleted {info}")

class ExceptionLoggerPlugin:

    def __init__(self, logger):
        self.logger = logger

    @ijik.hookimpl
    def ijik_uncaught_exception(self, exc):
        self.logger.error("Uncaught exception", exc_info=exc)

class LoggingPlugin:

    def __init__(self,
            logger = logging.getLogger("ijik"),
            *,
            format = None,
            level  = None,
            file   = None
        ):

        if file:
            handler = logging.FileHandler(file)
            if level:
                handler.setLevel(level)
            if format:
                handler.setFormatter(logging.Formatter(format))

            logger.addHandler(handler)

        if level:
            logger.setLevel(level)

        self.logger = logger

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        self.pluginmanager = app.pluginmanager
        self.pluginmanager.register(DbOperationLoggerPlugin(self.logger))
        self.pluginmanager.register(ExceptionLoggerPlugin(self.logger))

    def stringify(self, entity, full=False):
        s = self.pluginmanager.hook.ijik_stringify(entity=entity, full=full)
        return "\n".join(s) if s else str(entity)
