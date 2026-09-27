"""HTTP API endpoints for Domolink-Scale panel."""

import logging
from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


class DomolinkScaleApiView(HomeAssistantView):
    """View to handle Domolink-Scale API requests from the frontend panel."""

    url = "/api/domolink_scale/{action}"
    name = "api:domolink_scale"
    requires_auth = True

    def __init__(self, coordinator) -> None:
        """Initialize the API view."""
        self.coordinator = coordinator

    async def get(self, request: web.Request, action: str) -> web.Response:
        """Handle GET requests."""
        if action == "data":
            history_limit = int(request.query.get("limit", 1000))
            user_id = request.query.get("user_id")

            history = self.coordinator.history
            if user_id and user_id != "all":
                history = [h for h in history if h.get("user_id") == user_id]

            return self.json({
                "success": True,
                "profiles": list(self.coordinator.profiles.values()),
                "history": history[-history_limit:],
                "total_weigh_ins": len(self.coordinator.history),
                "last_tare": self.coordinator.last_tare,
                "config": dict(self.coordinator.config_entry.data),
                "options": dict(self.coordinator.config_entry.options),
            })

        return self.json({"success": False, "error": f"Action inconnue: {action}"}, status=400)

    async def post(self, request: web.Request, action: str) -> web.Response:
        """Handle POST requests."""
        try:
            data = await request.json()
        except Exception:
            data = {}

        # 1. Profile Management
        if action == "profile_add":
            user_id = await self.coordinator.async_add_profile(data)
            return self.json({"success": True, "user_id": user_id})

        elif action == "profile_update":
            user_id = data.get("id")
            if not user_id:
                return self.json({"success": False, "error": "ID utilisateur manquant"}, status=400)
            res = await self.coordinator.async_update_profile(user_id, data)
            return self.json({"success": res})

        elif action == "profile_merge":
            source_id = data.get("source_id")
            target_id = data.get("target_id")
            if not source_id or not target_id:
                return self.json({"success": False, "error": "IDs de source et cible requis"}, status=400)
            res = await self.coordinator.async_merge_profiles(source_id, target_id)
            return self.json({"success": res})

        elif action == "profile_delete":
            user_id = data.get("id")
            if not user_id:
                return self.json({"success": False, "error": "ID utilisateur manquant"}, status=400)
            res = await self.coordinator.async_delete_profile(user_id)
            return self.json({"success": res})

        # 2. Weigh-in Management
        elif action == "weigh_in_add":
            weight = float(data.get("weight", 0))
            if weight <= 0:
                return self.json({"success": False, "error": "Poids invalide"}, status=400)
            item = await self.coordinator.async_process_weigh_in(
                weight=weight,
                timestamp=data.get("timestamp"),
                manual_user_id=data.get("user_id"),
                manual_impedance=data.get("impedance"),
            )
            return self.json({"success": True, "entry": item})

        elif action == "weigh_in_delete":
            entry_id = data.get("id")
            if not entry_id:
                return self.json({"success": False, "error": "ID de pesée manquant"}, status=400)
            res = await self.coordinator.async_delete_weigh_in(entry_id)
            return self.json({"success": res})

        elif action == "weigh_in_reassign":
            entry_id = data.get("id")
            new_user_id = data.get("user_id")
            if not entry_id or not new_user_id:
                return self.json({"success": False, "error": "Paramètres manquants"}, status=400)
            res = await self.coordinator.async_reassign_weigh_in(entry_id, new_user_id)
            return self.json({"success": res})

        return self.json({"success": False, "error": f"Action POST inconnue: {action}"}, status=400)
