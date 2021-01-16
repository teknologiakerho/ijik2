import json
import functools

import ijik
from ijik.form import get_config

def mutable(schema):
    # XXX: including dunder fields breaks something in pydantic
    include = lambda k: not (k.startswith("__") or get_config(schema, k).get("immutable"))
    new_dict = dict((k,v) for k,v in schema.__dict__.items() if include(k))

    if "__annotations__" in schema.__dict__:
        new_dict["__annotations__"] = dict((k,v) for k,v in schema.__dict__["__annotations__"].items()
                if include(k))

    return type(
        schema.__name__,
        schema.__bases__,
        new_dict
    )

def _pattern_match_recursive(x, pattern):
    if isinstance(p, dict):
        for k,v in p.items():
            _pattern_match_recursive(getattr(x, k, None) or x[k], v)
    elif isinstance(p, (tuple, list, set)):
        for u,v in zip(x, p):
            _pattern_match_recursive(u, v)
    else:
        if x != pattern:
            raise ValueError

class PatternMatch:

    def __init__(self, pattern):
        self.pattern = pattern

    def __call__(self, entity):
        try:
            _pattern_match_recursive(entity, self.pattern)
        except (ValueError, TypeError, AttributeError):
            # this handles also the cases where the entity has wrong shape
            return False
        else:
            return True

    @functools.cached_property
    def js_matcher(self):
        return f"ijik.blob.patternMatch({json.dumps(self.pattern)})"

class SchemaMap:

    def __init__(self, rules):
        self.rules = rules

    def __call__(self, entity):
        for match, schema in self.rules:
            if match(entity):
                return schema

    def __iter__(self):
        yield from self.rules

def schema_map(rules):
    return SchemaMap([PatternMatch(pattern), schema] for pattern, schema in rules)
