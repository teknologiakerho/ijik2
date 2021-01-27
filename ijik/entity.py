import functools
import inspect
import itertools
import pluggy
import ijik
from ijik.helpers import collect_exceptions, generator_hook, omit_argspec, wrap_argspec

# ---- Entity manager ----------------------------------------

class EntityManager:

    def __init__(self, pluginmanager):
        self.pluginmanager = pluginmanager
        self.managed = {}

    def add_managed_class(self, name, hooks):
        if name in self.managed:
            raise KeyError(name)
        self.managed[name] = hooks

    def hooks(self, entity):
        return self.managed[entity.__class__.__name__]

    def session(self, db):
        return Session(self, db)

class Session:

    def __init__(self, entitymanager, db):
        self.entitymanager = entitymanager
        self.db = db

    @property
    def pluginmanager(self):
        return self.entitymanager.pluginmanager

    def add(self, entity):
        hook = self._hook(self.pluginmanager.hook.ijik_add_entity, entity=entity)

        try:
            result = check(next(hook))
            self.db.add(entity)
            self.db.flush()
            result += check(next(hook))
            self.db.commit()
        except Exception as e:
            hook.throw(e)
            self.db.rollback()
            raise

        result += next(hook)

        return result

    def update(self, entity, /, **kwargs):
        hook = self._hook(self.pluginmanager.hook.ijik_update_entity, entity=entity, kwargs=kwargs)

        try:
            result = check(next(hook))

            # note: can't update __dict__ directly, use setattr here so sqlalchemy
            # detects the changes
            for k,v in kwargs.items():
                setattr(entity, k, v)

            self.db.flush()
            result += check(next(hook))
            self.db.commit()
        except Exception as e:
            hook.throw(e)
            self.db.rollback()
            raise

        result += next(hook)

        return result

    def delete(self, entity):
        hook = self._hook(self.pluginmanager.hook.ijik_delete_entity, entity=entity)

        try:
            result = check(next(hook))
            self.db.delete(entity)
            self.db.flush()
            result += check(next(hook))
            self.db.commit()
        except Exception as e:
            hook.throw(e)
            self.db.rollback()
            raise

        result += next(hook)

        return result

    def _hook(self, hook, /, **kwargs):
        kwargs.update({
            "session": self,
            "db": self.db
        })

        return generator_hook(hook(**kwargs), endless=True)

# ---- Transaction hooks (generator hooks) ----------------------------------------
# e.g.
#
#    @ijik.hookimpl
#    def transaction_hook(...):
#        # note: raising an exception anywhere in this hook rollbacks the transaction
#        before_transaction()
#        yield
#        after_transaction()
#

class Hooks:

    @ijik.hookspec
    def ijik_add_entity(entity, session, db):
        pass

    @ijik.hookspec
    def ijik_update_entity(entity, session, db, kwargs):
        pass

    @ijik.hookspec
    def ijik_delete_entity(entity, session, db):
        pass

def entity_hook(name):
    def deco(f):
        sig = inspect.signature(f)
        try:
            pos = next(i for i,p in enumerate(sig.parameters.values()) if p.name in ("entity", name.lower()))
        except StopIteration:
            raise NotImplementedError("TODO: entity not on signature")
        else:
            def w(*args):
                entity = args[pos]
                if entity.__class__.__name__ == name:
                    return f(*args)

            parameters = list(sig.parameters.values())
            parameters[pos] = parameters[pos].replace(name="entity")
            sig = sig.replace(parameters=parameters)
            w.__signature__ = sig

        return w

    return deco

# ---- Cancels ----------------------------------------

class Errors:

    def __init__(self, *causes):
        self.direct_causes = []
        self.suberrors = {}

        for c in causes:
            self.update(c)

    def __str__(self):
        out = list(self.direct_causes)
        for k,err in self.suberrors.items():
            out.append(f"{k} -> {err}")
        return "\n".join(out)

    def __getitem__(self, key):
        return self.suberrors[key]

    def get(self, key, /, create=False):
        try:
            return self.suberrors[key]
        except KeyError:
            if create:
                self.suberrors[key] = Errors()
                return self.suberrors[key]
            else:
                return None

    def update(self, cause):
        if isinstance(cause, Errors):
            self.update(cause.direct_causes)
            self.update(cause.suberrors)

        elif isinstance(cause, dict):
            for key, se in cause.items():
                self.get(key, create=True).update(se)

        elif isinstance(cause, (list, tuple, set)):
            for c in cause:
                self.update(c)

        else:
            self.direct_causes.append(cause)

    def dict(self):
        ret = dict((k, e.dict()) for k,e in self.suberrors.items())
        if self.direct_causes:
            ret["_"] = self.direct_causes
        return ret

class Cancel(Exception):

    def __init__(self, *causes):
        self.cause = Errors(causes)
        super().__init__(f"cancelled: {self.cause}")

    def dict(self):
        return self.cause.dict()

validator = collect_exceptions(Cancel)

def cancelled(result):
    return any(isinstance(x, Errors) for x in result)

def check(result):
    if cancelled(result):
        raise Cancel(*(x for x in result if isinstance(x, Errors)))
    return result
