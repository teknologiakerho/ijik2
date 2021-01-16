import ijik

__all__ = ["ValidationPlugin"]

class EntityValidatorPlugin:

    def __init__(self, validator):
        self.validator = validator

    @ijik.hookimpl
    def ijik_add_entity(self, entity, db):
        validator = self.validator.get_validator(entity)
        if not validator:
            return

        yield
        yield validator(entity, db=db, is_new=True)

    @ijik.hookimpl
    def ijik_update_entity(self, entity, db):
        validator = self.validator.get_validator(entity)
        if not validator:
            return

        yield
        yield validator(entity, db=db, is_new=False)

class ValidationPlugin:

    def __init__(self, *, entity_validators=()):
        self.entity_validators = entity_validators

    @ijik.hookimpl
    def ijik_plugin_init(self, app):
        for ev in self.entity_validators:
            app.pluginmanager.register(EntityValidatorPlugin(ev))
