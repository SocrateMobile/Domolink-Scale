"""Initialization file for Domolink-Scale integration."""

import logging
import os
from typing import Any

from homeassistant.components import frontend
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.typing import ConfigType

from .api import DomolinkScaleApiView
from .const import (
    CONF_ENABLE_PANEL,
    DOMAIN,
    FRONTEND_FILE_NAME,
    FRONTEND_URL_PATH,
    NAME,
    PANEL_ICON,
    PANEL_NAME,
    PANEL_TITLE,
    PANEL_URL_PATH,
    VERSION,
)
from .coordinator import DomolinkScaleCoordinator

_LOGGER = logging.getLogger(__name__)
PLATFORMS = ["sensor"]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Domolink-Scale component from configuration.yaml (not used)."""
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Domolink-Scale from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    coordinator = DomolinkScaleCoordinator(hass, entry)
    await coordinator.async_setup()

    hass.data[DOMAIN][entry.entry_id] = {
        "coordinator": coordinator,
    }

    # 1. Register static frontend path
    frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
    if os.path.exists(frontend_dir):
        if hasattr(hass.http, "async_register_static_paths"):
            from homeassistant.components.http import StaticPathConfig
            await hass.http.async_register_static_paths([
                StaticPathConfig(FRONTEND_URL_PATH, frontend_dir, cache_headers=False)
            ])
        elif hasattr(hass.http, "register_static_path"):
            try:
                hass.http.register_static_path(FRONTEND_URL_PATH, frontend_dir, cache_headers=False)
            except Exception as err:
                _LOGGER.debug("Erreur register_static_path: %s", err)

    # 2. Register Sidebar Panel
    enable_panel = entry.options.get(CONF_ENABLE_PANEL, True)
    if enable_panel:
        _async_register_panel(hass)
    else:
        _async_remove_panel(hass)

    # 3. Register HTTP API View
    hass.http.register_view(DomolinkScaleApiView(coordinator))

    # 4. Forward platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # 5. Register HA Services
    async def handle_add_profile(call: ServiceCall) -> None:
        """Service to add a new profile."""
        await coordinator.async_add_profile(dict(call.data))

    async def handle_update_profile(call: ServiceCall) -> None:
        """Service to update a profile."""
        user_id = call.data.get("id")
        if user_id:
            await coordinator.async_update_profile(user_id, dict(call.data))

    async def handle_delete_profile(call: ServiceCall) -> None:
        """Service to delete a profile."""
        user_id = call.data.get("id")
        if user_id:
            await coordinator.async_delete_profile(user_id)

    async def handle_add_weigh_in(call: ServiceCall) -> None:
        """Service to record a manual weigh-in."""
        weight = float(call.data.get("weight", 0))
        if weight > 0:
            await coordinator.async_process_weigh_in(
                weight=weight,
                timestamp=call.data.get("timestamp"),
                manual_user_id=call.data.get("user_id"),
                manual_impedance=call.data.get("impedance"),
            )

    async def handle_reassign_weigh_in(call: ServiceCall) -> None:
        """Service to reassign a weigh-in to another profile."""
        entry_id = call.data.get("id")
        user_id = call.data.get("user_id")
        if entry_id and user_id:
            await coordinator.async_reassign_weigh_in(entry_id, user_id)

    async def handle_merge_profiles(call: ServiceCall) -> None:
        """Service to merge two profiles."""
        source_id = call.data.get("source_id")
        target_id = call.data.get("target_id")
        if source_id and target_id:
            await coordinator.async_merge_profiles(source_id, target_id)

    hass.services.async_register(DOMAIN, "add_profile", handle_add_profile)
    hass.services.async_register(DOMAIN, "update_profile", handle_update_profile)
    hass.services.async_register(DOMAIN, "merge_profiles", handle_merge_profiles)
    hass.services.async_register(DOMAIN, "delete_profile", handle_delete_profile)
    hass.services.async_register(DOMAIN, "add_weigh_in", handle_add_weigh_in)
    hass.services.async_register(DOMAIN, "reassign_weigh_in", handle_reassign_weigh_in)

    entry.async_on_unload(entry.add_update_listener(async_reload_entry))
    _LOGGER.info("Domolink-Scale v%s initialisé avec succès.", VERSION)
    return True


def _async_register_panel(hass: HomeAssistant) -> None:
    """Register the built-in sidebar panel."""
    panel_url = f"{FRONTEND_URL_PATH}/{FRONTEND_FILE_NAME}?v={VERSION}"
    try:
        if hasattr(frontend, "add_extra_js_url"):
            frontend.add_extra_js_url(hass, panel_url)

        frontend.async_register_built_in_panel(
            hass,
            component_name="custom",
            sidebar_title=PANEL_TITLE,
            sidebar_icon=PANEL_ICON,
            frontend_url_path=PANEL_URL_PATH,
            config={
                "_panel_custom": {
                    "name": PANEL_NAME,
                    "module_url": panel_url,
                }
            },
            require_admin=False,
            update=True,
        )
        _LOGGER.info("Domolink-Scale: Panneau latéral enregistré avec succès.")
    except Exception as err:
        _LOGGER.debug("Panneau latéral Domolink-Scale déjà enregistré ou erreur: %s", err)


def _async_remove_panel(hass: HomeAssistant) -> None:
    """Remove sidebar panel."""
    try:
        frontend.async_remove_panel(hass, PANEL_URL_PATH)
    except Exception as err:
        _LOGGER.debug("Erreur retrait panneau latéral : %s", err)


async def async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload integration when options change."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload Domolink-Scale entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        data = hass.data[DOMAIN].pop(entry.entry_id, None)
        if data and "coordinator" in data:
            data["coordinator"].async_unload()

    return unload_ok
