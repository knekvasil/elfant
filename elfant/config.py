import os

_env_path = os.path.join(os.getcwd(), ".env")
if not os.path.exists(_env_path):
    _env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if not _line or _line.startswith("#") or "=" not in _line:
                continue
            _key, _, _value = _line.partition("=")
            _key = _key.strip()
            _value = _value.strip().strip("\"'")
            os.environ.setdefault(_key, _value)

DATABASE_URL = os.getenv(
    "ELFANT_DATABASE_URL",
    "postgresql://elfant:elfant@localhost:5432/elfant",
)
