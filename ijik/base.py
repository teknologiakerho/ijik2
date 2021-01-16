import sqlalchemy as sa
from sqlalchemy.orm import relationship
from sqlalchemy.ext.associationproxy import association_proxy
from sqlalchemy.ext.declarative import declared_attr

class MroReprMixin:

    def _mro_repr(self, /, full):
        info = (C.__log_repr__(self, full=full)
                for C in self.__class__.__mro__ if hasattr(C, "__log_repr__"))
        info = (x for x in info if x is not None)

        if full:
            info = '\n\t'.join(info) or "(empty)"
            return f"{self.__class__.__name__}: {info}"
        else:
            info = ' '.join(info) or "empty"
            return f"{self.__class__.__name__}[{info}]"

    @property
    def short_repr(self):
        return self._mro_repr(full=False)

    @property
    def full_repr(self):
        return self._mro_repr(full=True)

    def __repr__(self):
        return self.short_repr

    def __str__(self):
        return self.full_repr

class AttributeMixin:

    attrs = sa.Column(sa.JSON, nullable=False, default={})

    def __log_repr__(self, full):
        if full:
            return f"attrs: {self.attrs}"
        else:
            return f"attrs: {{{', '.join(self.attrs)}}}"

class IdentityMixin:

    id = sa.Column(sa.Integer, primary_key=True)
    name = sa.Column(sa.Text, nullable=False)

    def __log_repr__(self, full):
        return f"id: {self.id} name: '{self.name}'"

class Registrant(MroReprMixin, IdentityMixin, AttributeMixin):
    __tablename__ = "registrants"

    key = sa.Column(sa.Text, nullable=False, unique=True, index=True)
    event = sa.Column(sa.Text, nullable=False, default="")

    def __log_repr__(self, full):
        if full:
            return f"key: '{self.key}'"

class RegistrantOwnedMixin:

    @declared_attr
    def registrant_id(cls):
        return sa.Column(sa.Integer,
                sa.ForeignKey(Registrant.id, ondelete="CASCADE"),
                nullable=False,
                index=True
        )

    @declared_attr
    def registrant(cls):
        return relationship("Registrant")

    def __log_repr__(self, full):
        if full:
            return f"registrant: {self.registrant.short_repr}"

class Team(MroReprMixin, IdentityMixin, RegistrantOwnedMixin, AttributeMixin):
    __tablename__ = "teams"

    category = sa.Column(sa.Text, nullable=False, default="")

    members_assoc = relationship("TeamMember",
            cascade="all, delete-orphan",
            passive_deletes=True,
            back_populates="team"
    )
    member_ids = association_proxy("members_assoc", "member_id",
            creator=lambda x: TeamMember(member_id=x))
    members = association_proxy("members_assoc", "member")

    def __log_repr__(self, full):
        if full:
            return f"members: [{', '.join(m.short_repr for m in self.members)}]"

class Member(MroReprMixin, IdentityMixin, RegistrantOwnedMixin, AttributeMixin):
    __tablename__ = "members"

    last_name = sa.Column(sa.Text, nullable=False)
    first_name = sa.Column(sa.Text, nullable=False)

    teams_assoc = relationship("TeamMember",
            cascade="all, delete-orphan",
            passive_deletes=True,
            back_populates="member"
    )
    team_ids = association_proxy("teams_assoc", "team_id",
            creator=lambda x: TeamMember(team_id=x))
    teams = association_proxy("teams_assoc", "team")

    @property
    def name(self):
        return f"{self.first_name} {self.last_name}"

    def __log_repr__(self, full):
        if full:
            return f"teams: [{', '.join(t.short_repr for t in self.teams)}]"

class TeamMember(MroReprMixin):
    __tablename__ = "team_members"
    __table_args__ = ( sa.PrimaryKeyConstraint("team_id", "member_id"), )

    team_id = sa.Column(sa.Integer, sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False, index=True)
    member_id = sa.Column(sa.Integer, sa.ForeignKey("members.id", ondelete="CASCADE"),
            nullable=False, index=True)

    team = relationship("Team")
    member = relationship("Member")

    def __log_repr__(self, full):
        return f"team: {self.team.short_repr} member: {self.member.short_repr}"
