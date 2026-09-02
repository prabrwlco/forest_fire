import os
from dotenv import load_dotenv

load_dotenv()

# NASA FIRMS
FIRMS_MAP_KEY = os.getenv("FIRMS_MAP_KEY", "")

FIRMS_SOURCE = os.getenv(
    "FIRMS_SOURCE",
    "VIIRS_SNPP_NRT"
)
FIRMS_MAP_KEY = os.getenv("FIRMS_MAP_KEY", "16edaa9fdc9c5322428a2160942fd4b4")
NEPAL_BBOX = os.getenv(
    "NEPAL_BBOX",
    "80.0,26.3,88.3,30.5"
)

FIRMS_DAY_RANGE = int(
    os.getenv("FIRMS_DAY_RANGE", "1")
)

FIRMS_AREA_URL = (
    "https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
    "{map_key}/{source}/{bbox}/{days}"
)

# Flask
FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))
DEBUG_MODE = os.getenv("FLASK_DEBUG", "true").lower() == "true"

# Email
EMAIL_SENDER = os.getenv("EMAIL_SENDER", "")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
