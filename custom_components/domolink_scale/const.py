"""Constants for Domolink-Scale."""

DOMAIN = "domolink_scale"
NAME = "Domolink-Scale"
VERSION = "1.1.0"

# Panel Constants
PANEL_TITLE = "Domolink Scale"
PANEL_ICON = "mdi:scale-bathroom"
PANEL_NAME = "domolink-scale-panel"
PANEL_URL_PATH = "domolink-scale"
FRONTEND_URL_PATH = "/domolink_scale_frontend"
FRONTEND_FILE_NAME = "domolink-scale-panel.js"

# Storage
STORAGE_KEY = "domolink_scale_data"
STORAGE_VERSION = 1

# Configuration Keys - Sensors
CONF_MASS_ENTITY = "mass_entity"
CONF_NON_STABILIZED_ENTITY = "non_stabilized_entity"
CONF_IMPEDANCE_ENTITY = "impedance_entity"
CONF_HEART_RATE_ENTITY = "heart_rate_entity"
CONF_BODY_FAT_ENTITY = "body_fat_entity"
CONF_MUSCLE_MASS_ENTITY = "muscle_mass_entity"
CONF_WATER_ENTITY = "water_entity"
CONF_BONE_MASS_ENTITY = "bone_mass_entity"
CONF_VISCERAL_FAT_ENTITY = "visceral_fat_entity"
CONF_BMR_ENTITY = "bmr_entity"
CONF_PWV_ENTITY = "pwv_entity"
CONF_BATTERY_ENTITY = "battery_entity"
CONF_ENABLE_PANEL = "enable_panel"

# Default profile settings
DEFAULT_TOLERANCE = 3.5  # +/- kg for profile matching
DEFAULT_TARGET_WEIGHT = 75.0
DEFAULT_COLOR = "#3b82f6"

# Events
EVENT_WEIGH_IN = "domolink_scale_weigh_in"
