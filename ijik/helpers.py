import functools
import inspect
import typing
import fastapi
import pydantic
from pydantic.error_wrappers import ErrorWrapper

# advance each generator in `state`, yield non-generator values as is.
# `send` will send to each generator.
# `throw` will throw each generator and swallow if the generator rethrows the exception
def generator_hook(state, endless=False):
    gen, out = [], []

    for x in state:
        (gen if hasattr(x, "__next__") else out).append(x)

    send = None
    throw = None

    while gen or out or endless:
        nextgen = []

        for g in gen:
            try:
                if throw is not None:
                    try:
                        x = g.throw(throw)
                    except Exception as exc:
                        if exc != throw:
                            raise
                        x = None
                else:
                    x = g.send(send)
            except StopIteration:
                pass
            else:
                nextgen.append(g)

            if x is not None:
                out.append(x)

        send = None
        throw = None

        try:
            send = yield out
        except Exception as exc:
            throw = exc

        gen = nextgen
        out = []

# https://stackoverflow.com/questions/39926567/python-create-decorator-preserving-function-arguments
# pluggy uses instpect.getfullargspec, functools.wraps doesn't preserve argspec
def wrap_argspec(f):
    def deco(g):
        g.__signature__ = inspect.signature(f)
        return functools.wraps(f)(g)
    return deco

# make pluggy not complain about extra parameters
def omit_argspec(*names):
    def deco(f):
        sig = inspect.signature(f)
        f.__signature__ = sig.replace(parameters=[
            p for p in sig.parameters.values() if p.name not in names
        ])
        return f
    return deco

# return collected exceptions instead of raising them
# (note: works for generators but not async)
def collect_exceptions(collect=Exception):
    def deco(f):
        if inspect.isgeneratorfunction(f):
            def w(*args, **kwargs):
                try:
                    yield from f(*args, **kwargs)
                except collect as e:
                    yield e
        else:
            def w(*args, **kwargs):
                try:
                    return f(*args, **kwargs)
                except collect as e:
                    return e
        return wrap_argspec(f)(w)

    return deco

# return copy of d but without keys having None values
def filter_none(d):
    return dict((k,v) for k,v in d.items() if v is not None)

# this exists to allow writing
#
#     x = do_something() or abort(404)
#
# in routes, instead of the longer
#
#     x = do_something()
#     if not x:
#         raise fastapi.HTTPException(404)
#
# (which, imo, is more elegant than injecting a get_or_404() method to sqlalchemy)
def abort(*args, **kwargs):
    import fastapi
    raise fastapi.HTTPException(*args, **kwargs)

# create an equivalent pydantic model with all fields optional
def partial(model):
    return type(
        model.__name__,
        (model, ),
        { "__annotations__": dict((k, typing.Optional[v]) for k,v in model.__annotations__.items()) }
    )

# unpack a generic container, eg: Optional[int] -> Optional, int
def unpack_container(type_):
    origin = getattr(type_, "__origin__", None)
    if not origin:
        return None, type_

    if origin is typing.Union:
        if len(type_.__args__) == 2 and type(None) in type_.__args__:
            return typing.Optional, *(t for t in type_.__args__ if t is not type(None))
        return None, type_

    return origin, *type_.__args__

# fake location of pydantic validator
def loc_validator(loc):
    def ret(f):
        @wrap_argspec(f)
        def w(cls, *args, **kwargs):
            try:
                return f(cls, *args, **kwargs)
            except (TypeError, ValueError, AssertionError) as exc:
                raise pydantic.ValidationError([ErrorWrapper(exc, loc)], cls)
        return w
    return ret

# https://github.com/tiangolo/fastapi/issues/1989
# https://github.com/tiangolo/fastapi/issues/2387
# note: this will not work for nested models
def as_param(cls, param):
    async def dep(**kw):
        return cls(**kw)

    dep.__signature__ = inspect.signature(dep).replace(parameters=[inspect.Parameter(
        field.alias,
        inspect.Parameter.POSITIONAL_ONLY,
        default = fastapi.Form(... if field.required else field.default),
        annotation = field.outer_type_
    ) for field in cls.__fields__.values()])

    return dep


# useful for putting lists in plaintext (eg. csv)

def escape(s, ch, esc='\\'):
    return s.replace(esc, esc+esc).replace(ch, esc+ch)

def unescape(s, ch, esc='\\'):
    return s.replace(esc+ch, ch).replace(esc+esc, esc)
