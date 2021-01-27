import ijik

class EntityValidator:

    def get_validator(self, entity):
        return getattr(self, f"validate_{entity.__class__.__name__.lower()}", None)

class UniqueMembers(EntityValidator):

    def validate_member(self, member, db, is_new):
        query = db.query(ijik.Member).filter(
                ijik.Member.registrant_id == member.registrant_id,
                ijik.Member.first_name == member.first_name,
                ijik.Member.last_name == member.last_name,
                ijik.Member.id != member.id
        )

        if db.query(query.exists()).scalar():
            return ijik.Errors({"name": "Tämän niminen osallistuja on jo ilmoitettu"})

class UniqueTeams(EntityValidator):

    # this will work even if category/eventid plugins aren't used,
    # but it would be nicer to modularize this so that they won't appear in the query
    # unless enabled.
    def validate_team(self, team, db, is_new):
        query = (db.query(ijik.Team)
                #.join(ijik.Team.registrant)\
                .filter(
                    ijik.Team.name == team.name,
                    ijik.Team.category == team.category,
                    #ijik.Registrant.event_id == team.registrant.event_id,
                    ijik.Team.id != team.id
                ))

        if db.query(query.exists()).scalar():
            return ijik.Errors({"name": "Tämän niminen joukkue on jo ilmoitettu"})

class TeamSize(EntityValidator):

    def __init__(self, get_limits):
        self.get_limits = get_limits

    def validate_team(self, team, db, is_new):
        limit = self.get_limits(team)
        print(limit)
        if not limit:
            return

        m, M = limit

        if m is not None and len(team.member_ids) < m:
            return ijik.Errors({"members": f"Joukkueessa on oltava vähintään {m} jäsentä"})

        if M is not None and len(team.member_ids) > M:
            return ijik.Errors({"members": f"Joukkueessa saa olla korkeintaan {M} jäsentä"})
