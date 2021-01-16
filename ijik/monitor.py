import collections
import csv
import functools
import html
import io
import re

import fastapi

import ijik

class Hooks:

    @ijik.hookspec
    def ijik_monitor_setup(monitor, router):
        pass

class Monitor:

    table_template = "monitor/table.html"
    main_template = "monitor/index.html"
    field_template = "monitor/field.html"

    def __init__(self, *, pluginmanager, templates, get_view):
        self.pluginmanager = pluginmanager
        self.table_template = templates.get_template(self.table_template)
        self.main_template = templates.get_template(self.main_template)
        self.field_template = templates.get_template(self.field_template)
        self.get_view = get_view
        self.fields = {}

    def view(self, db, key):
        widgets = self.get_view(key, db)
        if widgets is None:
            return None

        view = View(self)
        for widget in widgets:
            widget(view, monitor=self)

        return view

    def setup(self, router):
        self.pluginmanager.hook.ijik_monitor_setup(monitor=self, router=router)

    def add_field(self, cls, name=None, prio=0, **opt):
        if name is None:
            name = next(opt[x] for x in ("plaintext", "html", "json")).__name__

        field = Field(name=name, prio=prio, **opt)

        if cls in self.fields:
            self.fields[cls].append(field)
            self.fields[cls].sort(key=lambda c: (c.prio, c.name))
        else:
            self.fields[cls] = [field]

        return field

    def field(self, *args, loc="plaintext", **kwargs):
        def deco(f):
            if kwargs.get("html") == "auto":
                kwargs["html"] = self._auto_html(f)
            return self.add_field(*args, **kwargs, **{loc: f})
        return deco

    def get_fields(self, cls):
        try:
            return self.fields[cls]
        except KeyError:
            return ()

    def render_view(self, **context):
        return self.main_template.render(**context)

    def render_table(self, **context):
        return self.table_template.render(**context)

    def _auto_html(self, f):
        def render_html(entity):
            return self.field_template.render({"value": f(entity)})
        return render_html

class View:

    def __init__(self, monitor):
        self.monitor = monitor
        self.widgets = []
        self.downloads = {}

    def add_download(self, id, dl):
        self.downloads[id] = dl

    def get_download(self, id):
        try:
            dl = self.downloads[id]
        except KeyError:
            return None

        return dl()

    def add_widget(self, render, navi=None):
        self.widgets.append((render, navi))

    def render(self, **context):
        return self.monitor.render_view(
                **context,
                widgets = (w(**context) for w,_ in self.widgets),
                navis = (n for _,n in self.widgets if n is not None)
        )

class Table:

    def __init__(self, title, get_entities, id=None, columns=None):
        self.title = title
        self.get_entities = get_entities
        self.columns = columns

        if id:
            self.id = id

    def __call__(self, view, monitor):
        self.monitor = monitor
        view.add_widget(self.render, navi=(self.id, self.title))
        view.add_download(f"{self.id}.csv", self.download)

    def render(self, **context):
        return self.monitor.render_table(**context, table=self)

    def download(self):
        return "text/csv", self.data.plaintext.csv

    @functools.cached_property
    def id(self):
        return re.sub(r'[^\w-]+', "-", self.title).strip("-").lower()

    @functools.cached_property
    def entities(self):
        return self.get_entities()

    @functools.cached_property
    def data(self):
        colprio = collections.defaultdict(lambda: float("inf"))
        values = []

        for e in self.entities:
            vals = {}
            for field in self.monitor.get_fields(e.__class__.__name__):
                colprio[field.name] = min(field.prio, colprio[field.name])
                vals[field.name] = field(e)
            values.append(vals)

        if self.columns:
            columns = [c for c in self.columns if c in colprio]
        else:
            columns = sorted(colprio, key=lambda name: colprio[name])

        return TableData(columns, values)

class TableData:

    def __init__(self, columns, values):
        self.columns = columns
        self.values = values

    @property
    def width(self):
        return len(self.columns)

    @property
    def height(self):
        return len(self.values)

    @property
    def rows(self):
        for v in self.values:
            yield (v.get(c, Value.empty) for c in self.columns)

    @functools.cached_property
    def csv(self):
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(self.columns)
        writer.writerows((c.plaintext for c in r) for r in self.rows)
        return out.getvalue()

    @functools.cached_property
    def plaintext(self):
        return self._filter_attr("plaintext")

    @functools.cached_property
    def html(self):
        return self._filter_attr("html")

    @functools.cached_property
    def json(self):
        return self._filter_attr("json")

    def _filter_attr(self, attr):
        # select only columns which have at least one row with `attr`
        columns = set()

        for v in self.values:
            columns.update(c for c,x in v.items() if getattr(x, attr) is not None)

            # have all columns
            if len(columns) == len(self.columns):
                return self

        return TableData([c for c in self.columns if c in columns], self.values)

class Field:

    def __init__(self, name, prio, *, plaintext=None, html=None, json=None):
        self.name = name
        self.prio = prio
        self._plaintext = plaintext
        self._html = html
        self._json = json

    def plaintext(self, f):
        self._plaintext = f
        return self

    def html(self, f):
        self._html = f
        return self

    def json(self, f):
        self._json = f
        return self

    def __call__(self, entity):
        return Value(self, entity)

class Value:

    def __init__(self, field, entity):
        self.field = field
        self.entity = entity

    @functools.cached_property
    def plaintext(self):
        if self.field._plaintext:
            return self.field._plaintext(self.entity)

    @functools.cached_property
    def html(self):
        if self.field._html:
            return self.field._html(self.entity)
        if self.field._html is False:
            return

        if self.plaintext is not None:
            return html.escape(str(self.plaintext))

    @functools.cached_property
    def json(self):
        if self.field._json:
            return self.field._json(self.entity)
        if self.field._json is False:
            return

        return self.plaintext

    class empty:
        plaintext = ""
        html = ""
        json = None

class KeyRegistry:

    def __init__(self):
        self.views = {}

    def __call__(self, key, *args, **kwargs):
        try:
            view = self.views[key]
        except KeyError:
            return None

        return view(*args, **kwargs)

    def add_view(self, key, view):
        self.views[key] = view
        return view

    def view(self, key):
        def deco(view):
            return self.add_view(key, view)
        return deco
