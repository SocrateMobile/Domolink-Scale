"""Config flow for Domolink-Scale integration."""

import logging
from typing import Any, Dict, Optional

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    BooleanSelector,
    EntitySelector,
    EntitySelectorConfig,
)

from .const import (
    CONF_BATTERY_ENTITY,
    CONF_BODY_FAT_ENTITY,
    CONF_BONE_MASS_ENTITY,
    CONF_ENABLE_PANEL,
    CONF_HEART_RATE_ENTITY,
    CONF_IMPEDANCE_ENTITY,
    CONF_MASS_ENTITY,
    CONF_MUSCLE_MASS_ENTITY,
    CONF_NON_STABILIZED_ENTITY,
    CONF_VISCERAL_FAT_ENTITY,
    CONF_WATER_ENTITY,
    DOMAIN,
    NAME,
)

_LOGGER = logging.getLogger(__name__)


class DomolinkScaleConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Domolink-Scale."""

    VERSION = 1

    def __init__(self) -> None:
        """Initialize config flow."""
        self._data: Dict[str, Any] = {}

    async def async_step_user(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> config_entries.ConfigFlowResult:
        """Handle initial step: primary scale sensors."""
        errors: Dict[str, str] = {}

        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_advanced()

        schema = vol.Schema({
            vol.Required(CONF_MASS_ENTITY): EntitySelector(
                EntitySelectorConfig(domain="sensor")
            ),
            vol.Optional(CONF_NON_STABILIZED_ENTITY): EntitySelector(
                EntitySelectorConfig(domain="sensor")
            ),
            vol.Optional(CONF_IMPEDANCE_ENTITY): EntitySelector(
                EntitySelectorConfig(domain="sensor")
            ),
        })

        return self.async_show_form(
            step_id="user",
            data_schema=schema,
            errors=errors,
            description_placeholders={"name": NAME},
        )

    async def async_step_advanced(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> config_entries.ConfigFlowResult:
        """Handle step 2: optional multi-brand and health sensors."""
        if user_input is not None:
            self._data.update(user_input)
            return self.async_create_entry(
                title="Domolink-Scale",
                data=self._data,
            )

        schema = vol.Schema({
            vol.Optional(CONF_HEART_RATE_ENTITY): EntitySelector(
                EntitySelectorConfig(domain="sensor")
            ),
            vol.Optional(CONF_BODY_FAT_ENTITY): EntitySelector(
                EntitySelectorConfig(domain="sensor")
            ),
            vol.Optional(CONF_MUSCLE_MASS_ENTITY): EntitySelector(
                EntitySelectorConfig(domain="sensor")
            ),
            vol.Optional(CONF_WATER_ENTITY): EntitySelector(
                EntitySelectorConfig(domain="sensor")
            ),
            vol.Optional(CONF_BONE_MASS_ENTITY): EntitySelector(
                EntitySelectorConfig(domain="sensor")
            ),
            vol.Optional(CONF_VISCERAL_FAT_ENTITY): EntitySelector(
                EntitySelectorConfig(domain="sensor")
            ),
            vol.Optional(CONF_BATTERY_ENTITY): EntitySelector(
                EntitySelectorConfig(domain="sensor")
            ),
        })

        return self.async_show_form(
            step_id="advanced",
            data_schema=schema,
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> config_entries.OptionsFlow:
        """Create the options flow handler."""
        return DomolinkScaleOptionsFlowHandler(config_entry)


class DomolinkScaleOptionsFlowHandler(config_entries.OptionsFlow):
    """Handle options for Domolink-Scale."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> config_entries.ConfigFlowResult:
        """Manage scale configuration options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        current = {**self.config_entry.data, **self.config_entry.options}

        schema = vol.Schema({
            vol.Required(
                CONF_MASS_ENTITY, default=current.get(CONF_MASS_ENTITY)
            ): EntitySelector(EntitySelectorConfig(domain="sensor")),
            vol.Optional(
                CONF_NON_STABILIZED_ENTITY,
                description={"suggested_value": current.get(CONF_NON_STABILIZED_ENTITY)},
            ): EntitySelector(EntitySelectorConfig(domain="sensor")),
            vol.Optional(
                CONF_IMPEDANCE_ENTITY,
                description={"suggested_value": current.get(CONF_IMPEDANCE_ENTITY)},
            ): EntitySelector(EntitySelectorConfig(domain="sensor")),
            vol.Optional(
                CONF_HEART_RATE_ENTITY,
                description={"suggested_value": current.get(CONF_HEART_RATE_ENTITY)},
            ): EntitySelector(EntitySelectorConfig(domain="sensor")),
            vol.Optional(
                CONF_BODY_FAT_ENTITY,
                description={"suggested_value": current.get(CONF_BODY_FAT_ENTITY)},
            ): EntitySelector(EntitySelectorConfig(domain="sensor")),
            vol.Optional(
                CONF_MUSCLE_MASS_ENTITY,
                description={"suggested_value": current.get(CONF_MUSCLE_MASS_ENTITY)},
            ): EntitySelector(EntitySelectorConfig(domain="sensor")),
            vol.Optional(
                CONF_WATER_ENTITY,
                description={"suggested_value": current.get(CONF_WATER_ENTITY)},
            ): EntitySelector(EntitySelectorConfig(domain="sensor")),
            vol.Optional(
                CONF_BATTERY_ENTITY,
                description={"suggested_value": current.get(CONF_BATTERY_ENTITY)},
            ): EntitySelector(EntitySelectorConfig(domain="sensor")),
            vol.Optional(
                CONF_ENABLE_PANEL, default=current.get(CONF_ENABLE_PANEL, True)
            ): BooleanSelector(),
        })

        return self.async_show_form(step_id="init", data_schema=schema)
