from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from elfant.config import DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_session():
    return SessionLocal()
