import inspect
import pydantic
import ijik

def webhook(id):
    def deco(f):
        def w(*args):
            if args[-2] == id:
                return f(*args[:-2], **args[-1])

        sig = inspect.signature(f)
        params = [ "self" ] if "self" in sig.parameters else []
        params += [ "id", "kwargs" ]
        params = [inspect.Parameter(name, inspect.Parameter.POSITIONAL_ONLY) for name in params]
        w.__signature__ = inspect.Signature(params)
        return ijik.hookimpl(specname="ijik_webhook")(w)
    return deco

class Hooks:

    @ijik.hookspec
    def ijik_webhook(id, kwargs):
        pass

class UserWebhook:

    plugin = "user"

    def __init__(self, id, name=None, desc=None, endpoint=None, success=None):
        self.id = id
        self.name = name or id
        self.desc = desc or ""
        self.endpoint = endpoint or f"/webhooks/{id}"
        self.success = success

    def dict(self):
        return {
            "name": self.name,
            "desc": self.desc,
            "endpoint": self.endpoint,
            "successText": self.success
        }
