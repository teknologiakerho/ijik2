class Category:

    def __init__(self, id, name=None, group=None):
        self.id = id
        self.name = name or id
        self.group = group

    def dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "group": self.group
        }
