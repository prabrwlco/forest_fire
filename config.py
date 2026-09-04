import os
from dotenv import load_dotenv

load_dotenv()

# NASA FIRMS
FIRMS_MAP_KEY = os.getenv("FIRMS_MAP_KEY", "")

# NEPAL_BBOX =("80.0,26.3,88.3,30.5")
NEPAL_BBOX = ("68.7,8.4,97.4,37.1")


# Flask
FLASK_HOST = os.getenv("FLASK_HOST", "0.0.0.0")
FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))
DEBUG_MODE = os.getenv("FLASK_DEBUG", "true").lower() == "true"

# Email
EMAIL_SENDER = os.getenv("EMAIL_SENDER", "")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")
SMTP_HOST =os.getenv("SMTP_HOST", "")
SMTP_PORT = os.getenv("SMTP_PORT", "")
