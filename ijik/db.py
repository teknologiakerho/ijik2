import sqlalchemy as sa
from sqlalchemy.orm import registry, sessionmaker

class SessionManager:

    def __init__(self):
        self.engine = None
        self.Session = None

    def connect(self, *args, **kwargs):
        self.engine = sa.create_engine(*args, **kwargs)
        self.Session = sessionmaker(bind=self.engine)

    # fastapi will run non-async code in a threadpool
    async def get_session(self):
        session = self.Session()
        try:
            yield session
        finally:
            session.close()

    def create_tables(self, metadata):
        metadata.create_all(self.engine)
