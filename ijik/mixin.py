import functools
import typing
import ijik

def add_mixin(cls, c, *, back=False):
    if back:
        cls.__bases__ += (c, )
    else:
        cls.__bases__ = (c, *cls.__bases__)
    return cls

def mixin(cls, **kwargs):
    f = getattr(cls, "__mixin__", add_mixin)
    return functools.partial(f, **kwargs)

class bases(list):

    def __mixin__(self, cls, *, back=False):
        if back:
            self.append(cls)
        else:
            self.insert(0, cls)
        return cls

    def to_class(self, name, bases=()):
        return type(name, tuple((*self, *bases)), {})

    def apply_to(self, cls):
        cls.__bases__ = (*self, *cls.__bases__)

class Mixins:

    def __getattr__(self, key):
        b = bases()
        setattr(self, key, b)
        return b

# https://bugs.python.org/issue672115
class AnySuperclass:
    pass
