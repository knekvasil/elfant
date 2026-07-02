import os

DATABASE_URL = os.getenv(
    "ELFANT_DATABASE_URL",
    "postgresql://elfant:elfant@localhost:5432/elfant",
)
