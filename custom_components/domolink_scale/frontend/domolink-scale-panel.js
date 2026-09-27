/**
 * Domolink-Scale — Panneau Tactile & Suivi Corporel Multi-Marques (v1.0.0)
 * Suite DomoLink — Glassmorphism, multi-courbes SVG, analyse BIA & profils personnalisés.
 */

(function () {
  const PANEL_NAME = "domolink-scale-panel";

  const DEFAULT_COLORS = [
    "#3b82f6", "#10b981", "#f59e0b", "#ec4899",
    "#8b5cf6", "#06b6d4", "#f97316", "#14b8a6"
  ];

  class DomolinkScalePanel extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._data = { profiles: [], history: [], config: {}, options: {} };
      this._activeTab = "dashboard";
      this._selectedUserId = "all";
      this._timeFilter = "30d"; // 7d, 30d, 90d, 1y, all
      this._hoveredPoint = null;
      this._editingProfile = null;
    }

    set hass(hass) {
      const oldHass = this._hass;
      this._hass = hass;
      if (!oldHass) {
        this._fetchData();
      }
    }

    connectedCallback() {
      this._applySidebarBadge();
      window.addEventListener("resize", () => this._renderChart());
    }

    _applySidebarBadge() {
      try {
        const root = document.querySelector("home-assistant")?.shadowRoot
          ?.querySelector("home-assistant-main")?.shadowRoot
          ?.querySelector("ha-sidebar")?.shadowRoot;
        if (!root) return;

        const targets = root.querySelectorAll(`
          a[data-panel="domolink-scale"] .item-text,
          a[href*="domolink-scale"] .item-text,
          paper-icon-item[data-panel="domolink-scale"] .item-text,
          ha-list-item[data-panel="domolink-scale"] .item-text
        `);
        targets.forEach(el => {
          el.style.setProperty("background", "#0284c7", "important");
          el.style.setProperty("color", "#ffffff", "important");
          el.style.setProperty("border-radius", "10px", "important");
          el.style.setProperty("font-weight", "700", "important");
          el.style.setProperty("font-size", "12px", "important");
          el.style.setProperty("padding", "2px 8px", "important");
          el.style.setProperty("display", "inline-block", "important");
          el.style.setProperty("box-shadow", "0 2px 6px rgba(2, 132, 199, 0.4)", "important");
        });
      } catch (e) {}
    }

    async _fetchData() {
      if (!this._hass) return;
      try {
        const res = await this._hass.fetchWithAuth("/api/domolink_scale/data?limit=1000");
        if (res.ok) {
          this._data = await res.json();
          this._render();
        }
      } catch (err) {
        console.error("Erreur de chargement Domolink-Scale:", err);
      }
    }

    _formatDate(isoStr) {
      if (!isoStr) return "-";
      try {
        const d = new Date(isoStr);
        return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      } catch (e) {
        return isoStr;
      }
    }

    _render() {
      const { profiles, history } = this._data;

      // Select active user object
      const activeProfile = this._selectedUserId !== "all" 
        ? profiles.find(p => p.id === this._selectedUserId) 
        : (profiles[0] || null);

      // Latest measurement
      const latestItem = activeProfile && activeProfile.latest_metrics && Object.keys(activeProfile.latest_metrics).length > 0
        ? { metrics: activeProfile.latest_metrics, weight: activeProfile.reference_weight, timestamp: activeProfile.last_weigh_in, user_name: activeProfile.name }
        : (history.length > 0 ? history[history.length - 1] : null);

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            background: #090d16;
            color: #f1f5f9;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            min-height: 100vh;
            padding: 16px 24px 48px;
            box-sizing: border-box;
          }

          /* Header */
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 14px 24px;
            margin-bottom: 20px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          }
          .brand {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .brand-icon {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: linear-gradient(135deg, #0284c7, #38bdf8);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
          }
          .brand-text h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.5px;
            color: #ffffff;
          }
          .brand-text p {
            margin: 2px 0 0;
            font-size: 12px;
            color: #94a3b8;
          }

          .header-actions {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .btn {
            background: #1e293b;
            color: #e2e8f0;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
          }
          .btn:hover {
            background: #334155;
            color: #ffffff;
            border-color: rgba(255, 255, 255, 0.2);
          }
          .btn-primary {
            background: linear-gradient(135deg, #0284c7, #0369a1);
            border: none;
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
          }
          .btn-primary:hover {
            background: linear-gradient(135deg, #0369a1, #075985);
          }

          /* Tabs */
          .tabs {
            display: flex;
            gap: 8px;
            background: rgba(15, 23, 42, 0.8);
            padding: 6px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            margin-bottom: 24px;
            width: fit-content;
          }
          .tab-btn {
            padding: 8px 18px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            background: transparent;
            color: #94a3b8;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
          }
          .tab-btn.active {
            background: #0284c7;
            color: #ffffff;
            box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4);
          }

          /* Profile Bar */
          .profile-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
            gap: 16px;
            flex-wrap: wrap;
          }
          .user-pills {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }
          .user-pill {
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            background: rgba(30, 41, 59, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: #cbd5e1;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
          }
          .user-pill.active {
            background: rgba(2, 132, 199, 0.2);
            border-color: #38bdf8;
            color: #38bdf8;
          }
          .user-color-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
          }

          /* Main Grid */
          .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
          }
          @media (min-width: 1024px) {
            .dashboard-grid {
              grid-template-columns: 1.8fr 1.2fr;
            }
          }

          /* Card Container */
          .card {
            background: rgba(30, 41, 59, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
          }
          .card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
          }
          .card-title {
            font-size: 15px;
            font-weight: 700;
            color: #f8fafc;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          /* Time Filter Buttons */
          .time-filters {
            display: flex;
            gap: 4px;
            background: rgba(15, 23, 42, 0.6);
            padding: 3px;
            border-radius: 8px;
          }
          .time-btn {
            background: transparent;
            border: none;
            color: #94a3b8;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
          }
          .time-btn.active {
            background: #334155;
            color: #ffffff;
          }

          /* Chart SVG Container */
          .chart-container {
            width: 100%;
            height: 320px;
            position: relative;
          }
          svg.scale-chart {
            width: 100%;
            height: 100%;
            overflow: visible;
          }

          /* Summary Hero */
          .hero-metric {
            display: flex;
            align-items: baseline;
            gap: 8px;
            margin-bottom: 14px;
          }
          .hero-val {
            font-size: 42px;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: -1px;
          }
          .hero-unit {
            font-size: 18px;
            color: #94a3b8;
            font-weight: 600;
          }
          .hero-target-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            margin-left: 12px;
          }
          .target-loss {
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
          }
          .target-gain {
            background: rgba(245, 158, 11, 0.15);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.3);
          }

          /* Metrics Mini Grid */
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 12px;
          }
          .metric-box {
            background: rgba(15, 23, 42, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .metric-label {
            font-size: 11px;
            color: #94a3b8;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          .metric-value {
            font-size: 20px;
            font-weight: 700;
            color: #f1f5f9;
          }
          .metric-sub {
            font-size: 11px;
            color: #64748b;
          }
          .badge {
            display: inline-block;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            width: fit-content;
          }
          .badge-normal { background: rgba(16, 185, 129, 0.2); color: #34d399; }
          .badge-warning { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
          .badge-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; }

          /* Table */
          .history-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          .history-table th {
            text-align: left;
            padding: 10px 14px;
            color: #94a3b8;
            font-weight: 600;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }
          .history-table td {
            padding: 12px 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            color: #e2e8f0;
          }
          .history-table tr:hover td {
            background: rgba(255, 255, 255, 0.03);
          }

          /* Forms & Modals */
          .modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          .modal-card {
            background: #1e293b;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            width: 90%;
            max-width: 520px;
            padding: 24px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          }
          .form-group {
            margin-bottom: 14px;
          }
          .form-group label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: #94a3b8;
            margin-bottom: 6px;
          }
          .form-input {
            width: 100%;
            background: #0f172a;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 14px;
            color: #f8fafc;
            box-sizing: border-box;
          }
          .form-input:focus {
            outline: none;
            border-color: #0284c7;
          }
          .color-picker-wrapper {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          input[type="color"] {
            -webkit-appearance: none;
            border: none;
            width: 38px;
            height: 38px;
            border-radius: 8px;
            cursor: pointer;
            background: transparent;
          }
        </style>

        <!-- Header -->
        <div class="header">
          <div class="brand">
            <div class="brand-icon">⚖️</div>
            <div class="brand-text">
              <h1>Domolink-Scale</h1>
              <p>Suivi Corporel & Composition BIA Multi-Marques</p>
            </div>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" id="btn-add-weigh-in">➕ Pesée Manuelle</button>
            <button class="btn" id="btn-refresh">🔄 Rafraîchir</button>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div class="tabs">
          <button class="tab-btn ${this._activeTab === "dashboard" ? "active" : ""}" data-tab="dashboard">📊 Évolution & Analyse</button>
          <button class="tab-btn ${this._activeTab === "history" ? "active" : ""}" data-tab="history">📋 Historique (${history.length})</button>
          <button class="tab-btn ${this._activeTab === "settings" ? "active" : ""}" data-tab="settings">⚙️ Profils & Paramètres</button>
        </div>

        <!-- User Switcher -->
        <div class="profile-bar">
          <div class="user-pills">
            <div class="user-pill ${this._selectedUserId === "all" ? "active" : ""}" data-user="all">
              <span>👥 Tous les profils</span>
            </div>
            ${profiles.map(p => `
              <div class="user-pill ${this._selectedUserId === p.id ? "active" : ""}" data-user="${p.id}">
                <div class="user-color-dot" style="background: ${p.color || '#3b82f6'};"></div>
                <span>${p.name}</span>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Dynamic Tab Content -->
        ${this._activeTab === "dashboard" ? this._renderDashboard(activeProfile, latestItem) : ""}
        ${this._activeTab === "history" ? this._renderHistory() : ""}
        ${this._activeTab === "settings" ? this._renderSettings() : ""}

        <div id="modal-container"></div>
      `;

      this._attachEvents();
      if (this._activeTab === "dashboard") {
        setTimeout(() => this._renderChart(), 50);
      }
    }

    _renderDashboard(activeProfile, latestItem) {
      const metrics = (latestItem && latestItem.metrics) || {};
      const curWeight = (latestItem && latestItem.weight) || (activeProfile && activeProfile.reference_weight) || 0;
      const targetWeight = (activeProfile && activeProfile.target_weight) || 0;
      const delta = targetWeight > 0 ? (curWeight - targetWeight).toFixed(1) : null;

      return `
        <div class="dashboard-grid">
          <!-- Graphique interactif multi-courbes -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">📈 Évolution du Poids & Objectifs</div>
              <div class="time-filters">
                <button class="time-btn ${this._timeFilter === "7d" ? "active" : ""}" data-time="7d">7j</button>
                <button class="time-btn ${this._timeFilter === "30d" ? "active" : ""}" data-time="30d">30j</button>
                <button class="time-btn ${this._timeFilter === "90d" ? "active" : ""}" data-time="90d">3m</button>
                <button class="time-btn ${this._timeFilter === "1y" ? "active" : ""}" data-time="1y">1a</button>
                <button class="time-btn ${this._timeFilter === "all" ? "active" : ""}" data-time="all">Tout</button>
              </div>
            </div>
            <div class="chart-container" id="chart-box">
              <!-- SVG chart rendered via _renderChart() -->
            </div>
          </div>

          <!-- Analyse Corporelle de la dernière pesée -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">🧬 Composition Corporelle</div>
              <span style="font-size: 12px; color: #94a3b8;">${this._formatDate(latestItem?.timestamp)}</span>
            </div>

            <div class="hero-metric">
              <div class="hero-val">${curWeight.toFixed(2)}</div>
              <div class="hero-unit">kg</div>
              ${delta !== null ? `
                <div class="hero-target-pill ${delta <= 0 ? 'target-loss' : 'target-gain'}">
                  🎯 Cible : ${targetWeight} kg (${delta > 0 ? '+' : ''}${delta} kg)
                </div>
              ` : ''}
            </div>

            <div class="metrics-grid">
              <div class="metric-box">
                <div class="metric-label">IMC</div>
                <div class="metric-value">${metrics.bmi || "-"}</div>
                <div class="metric-sub">
                  <span class="badge ${metrics.bmi_label === 'normal' ? 'badge-normal' : (metrics.bmi_label === 'overweight' ? 'badge-warning' : 'badge-danger')}">
                    ${metrics.bmi_label === 'normal' ? 'Normal' : (metrics.bmi_label === 'overweight' ? 'Surpoids' : (metrics.bmi_label || 'N/A'))}
                  </span>
                </div>
              </div>

              <div class="metric-box">
                <div class="metric-label">Masse Grasse</div>
                <div class="metric-value">${metrics.fat_percentage ? metrics.fat_percentage + '%' : '-'}</div>
                <div class="metric-sub">${metrics.fat_mass ? metrics.fat_mass + ' kg' : '-'}</div>
              </div>

              <div class="metric-box">
                <div class="metric-label">Masse Musculaire</div>
                <div class="metric-value">${metrics.muscle_mass ? metrics.muscle_mass + ' kg' : '-'}</div>
                <div class="metric-sub">${metrics.muscle_percentage ? metrics.muscle_percentage + '%' : '-'}</div>
              </div>

              <div class="metric-box">
                <div class="metric-label">Eau Corporelle</div>
                <div class="metric-value">${metrics.water_percentage ? metrics.water_percentage + '%' : '-'}</div>
                <div class="metric-sub">${metrics.water_mass ? metrics.water_mass + ' L' : '-'}</div>
              </div>

              <div class="metric-box">
                <div class="metric-label">Graisse Viscérale</div>
                <div class="metric-value">${metrics.visceral_fat || "-"}</div>
                <div class="metric-sub">
                  <span class="badge ${metrics.visceral_fat <= 9 ? 'badge-normal' : 'badge-warning'}">
                    ${metrics.visceral_fat <= 9 ? 'Sain (≤9)' : 'Élevé (>9)'}
                  </span>
                </div>
              </div>

              <div class="metric-box">
                <div class="metric-label">Masse Osseuse</div>
                <div class="metric-value">${metrics.bone_mass ? metrics.bone_mass + ' kg' : '-'}</div>
                <div class="metric-sub">Minéralisation</div>
              </div>

              <div class="metric-box">
                <div class="metric-label">Métabolisme (BMR)</div>
                <div class="metric-value">${metrics.bmr || "-"}</div>
                <div class="metric-sub">kcal / jour</div>
              </div>

              <div class="metric-box">
                <div class="metric-label">Âge Métabolique</div>
                <div class="metric-value">${metrics.metabolic_age ? metrics.metabolic_age + ' ans' : '-'}</div>
                <div class="metric-sub">Estimation BIA</div>
              </div>

              <div class="metric-box">
                <div class="metric-label">Score Corporel</div>
                <div class="metric-value" style="color: #38bdf8;">${metrics.body_score ? metrics.body_score + '/100' : '-'}</div>
                <div class="metric-sub">Global santé</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    _renderChart() {
      const container = this.shadowRoot.getElementById("chart-box");
      if (!container) return;

      const width = container.clientWidth || 600;
      const height = container.clientHeight || 300;
      const padding = { top: 20, right: 30, bottom: 40, left: 45 };

      const { profiles, history } = this._data;

      // Filter by timeframe
      const now = new Date().getTime();
      let minTime = 0;
      if (this._timeFilter === "7d") minTime = now - 7 * 86400 * 1000;
      else if (this._timeFilter === "30d") minTime = now - 30 * 86400 * 1000;
      else if (this._timeFilter === "90d") minTime = now - 90 * 86400 * 1000;
      else if (this._timeFilter === "1y") minTime = now - 365 * 86400 * 1000;

      let filteredHistory = history.filter(h => {
        const t = new Date(h.timestamp).getTime();
        return t >= minTime;
      });

      if (filteredHistory.length === 0) {
        container.innerHTML = `
          <div style="display: flex; height: 100%; align-items: center; justify-content: center; color: #64748b; font-size: 14px;">
            Aucune donnée de pesée pour cette période.
          </div>
        `;
        return;
      }

      // Group points by user
      const usersToDisplay = this._selectedUserId === "all" 
        ? profiles 
        : profiles.filter(p => p.id === this._selectedUserId);

      // Find min/max weights for Y scale
      let minWeight = Infinity;
      let maxWeight = -Infinity;
      filteredHistory.forEach(h => {
        if (h.weight < minWeight) minWeight = h.weight;
        if (h.weight > maxWeight) maxWeight = h.weight;
      });
      usersToDisplay.forEach(u => {
        if (u.target_weight) {
          if (u.target_weight < minWeight) minWeight = u.target_weight;
          if (u.target_weight > maxWeight) maxWeight = u.target_weight;
        }
      });

      minWeight = Math.floor(minWeight - 2);
      maxWeight = Math.ceil(maxWeight + 2);
      if (minWeight >= maxWeight) { minWeight -= 2; maxWeight += 2; }

      const tMin = new Date(filteredHistory[0].timestamp).getTime();
      const tMax = Math.max(now, new Date(filteredHistory[filteredHistory.length - 1].timestamp).getTime());

      const getX = (t) => {
        if (tMax === tMin) return padding.left + (width - padding.left - padding.right) / 2;
        return padding.left + ((t - tMin) / (tMax - tMin)) * (width - padding.left - padding.right);
      };

      const getY = (w) => {
        return height - padding.bottom - ((w - minWeight) / (maxWeight - minWeight)) * (height - padding.top - padding.bottom);
      };

      // Y-axis grid lines
      let yGridSvg = "";
      const step = (maxWeight - minWeight) / 4;
      for (let i = 0; i <= 4; i++) {
        const wVal = minWeight + i * step;
        const yPos = getY(wVal);
        yGridSvg += `
          <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
          <text x="${padding.left - 8}" y="${yPos + 4}" fill="#64748b" font-size="11" text-anchor="end">${wVal.toFixed(0)} kg</text>
        `;
      }

      // Draw lines per user
      let linesSvg = "";
      usersToDisplay.forEach(u => {
        const uColor = u.color || "#3b82f6";
        const uHistory = filteredHistory.filter(h => h.user_id === u.id);

        // Draw target line
        if (u.target_weight) {
          const targetY = getY(u.target_weight);
          linesSvg += `
            <line x1="${padding.left}" y1="${targetY}" x2="${width - padding.right}" y2="${targetY}" 
                  stroke="${uColor}" stroke-dasharray="4,4" stroke-width="1.5" opacity="0.6" />
            <text x="${width - padding.right}" y="${targetY - 6}" fill="${uColor}" font-size="10" text-anchor="end">
              Cible ${u.name}: ${u.target_weight} kg
            </text>
          `;
        }

        if (uHistory.length === 0) return;

        // Path points
        const points = uHistory.map(h => ({
          x: getX(new Date(h.timestamp).getTime()),
          y: getY(h.weight),
          data: h
        }));

        let dPath = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          dPath += ` L ${points[i].x} ${points[i].y}`;
        }

        // Draw smooth polyline
        linesSvg += `
          <path d="${dPath}" fill="none" stroke="${uColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        `;

        // Draw dots
        points.forEach(p => {
          linesSvg += `
            <circle cx="${p.x}" cy="${p.y}" r="5" fill="#0f172a" stroke="${uColor}" stroke-width="2.5" class="chart-dot" 
                    data-info="${p.data.user_name} | ${p.data.weight} kg | ${this._formatDate(p.data.timestamp)}">
              <title>${p.data.user_name}: ${p.data.weight} kg (${this._formatDate(p.data.timestamp)})</title>
            </circle>
          `;
        });
      });

      container.innerHTML = `
        <svg class="scale-chart" viewBox="0 0 ${width} ${height}">
          ${yGridSvg}
          ${linesSvg}
        </svg>
      `;
    }

    _renderHistory() {
      const { history } = this._data;
      const reversed = [...history].reverse();

      return `
        <div class="card">
          <div class="card-header">
            <div class="card-title">📋 Historique des Pesées</div>
          </div>
          <table class="history-table">
            <thead>
              <tr>
                <th>Date & Heure</th>
                <th>Profil</th>
                <th>Poids</th>
                <th>IMC</th>
                <th>Masse Grasse</th>
                <th>Impédance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${reversed.map(item => `
                <tr>
                  <td>${this._formatDate(item.timestamp)}</td>
                  <td>
                    <span style="font-weight: 600; color: #f8fafc;">${item.user_name || 'Invité'}</span>
                  </td>
                  <td style="font-weight: 700; color: #38bdf8;">${item.weight} kg</td>
                  <td>${item.metrics?.bmi || '-'}</td>
                  <td>${item.metrics?.fat_percentage ? item.metrics.fat_percentage + '%' : '-'}</td>
                  <td>${item.impedance ? item.impedance + ' Ω' : '-'}</td>
                  <td>
                    <button class="btn btn-reassign" data-id="${item.id}" style="padding: 4px 8px; font-size: 11px;">🔄 Réassigner</button>
                    <button class="btn btn-delete-weigh-in" data-id="${item.id}" style="padding: 4px 8px; font-size: 11px; color: #f87171;">🗑️</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    _renderSettings() {
      const { profiles } = this._data;

      return `
        <div class="dashboard-grid">
          <!-- Profils Existants -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">👥 Profils Enregistrés (${profiles.length})</div>
              <button class="btn btn-primary" id="btn-new-profile">➕ Nouveau Profil</button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${profiles.map(p => `
                <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between;">
                  <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: ${p.color || '#3b82f6'}; border: 2px solid #ffffff;"></div>
                    <div>
                      <div style="font-size: 15px; font-weight: 700; color: #ffffff;">${p.name}</div>
                      <div style="font-size: 12px; color: #94a3b8;">
                        ${p.gender === 'male' ? 'Homme' : 'Femme'} • ${p.height} cm • Cible: ${p.target_weight} kg (±${p.tolerance} kg)
                      </div>
                    </div>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <button class="btn btn-edit-profile" data-id="${p.id}" style="padding: 6px 12px; font-size: 12px;">✏️ Modifier</button>
                    <button class="btn btn-delete-profile" data-id="${p.id}" style="padding: 6px 12px; font-size: 12px; color: #f87171;">🗑️</button>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>

          <!-- Documentation & Infos Domolink -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">ℹ️ Algorithme Multi-Marques</div>
            </div>
            <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
              <strong>Domolink-Scale</strong> prend en charge les balances universelles (Xiaomi, Withings, Garmin, Eufy, etc.).
            </p>
            <ul style="font-size: 13px; color: #94a3b8; line-height: 1.7; padding-left: 20px;">
              <li><strong>Attribution intelligente :</strong> Détection automatique du profil via la fenêtre de tolérance (± kg) autour du dernier poids mesuré.</li>
              <li><strong>Calculs BIA :</strong> Équations scientifiques médicales (formules Zepp/Tanita/Deurenberg) calculant 13 métriques corporelles complètes.</li>
              <li><strong>Couleur personnalisée :</strong> Chaque profil a sa propre couleur d'affichage sur les graphiques d'évolution.</li>
            </ul>
          </div>
        </div>
      `;
    }

    _attachEvents() {
      // Tab navigation
      this.shadowRoot.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          this._activeTab = btn.getAttribute("data-tab");
          this._render();
        });
      });

      // User pill filter
      this.shadowRoot.querySelectorAll(".user-pill").forEach(pill => {
        pill.addEventListener("click", () => {
          this._selectedUserId = pill.getAttribute("data-user");
          this._render();
        });
      });

      // Time filter buttons
      this.shadowRoot.querySelectorAll(".time-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          this._timeFilter = btn.getAttribute("data-time");
          this._render();
        });
      });

      // Refresh button
      const btnRefresh = this.shadowRoot.getElementById("btn-refresh");
      if (btnRefresh) {
        btnRefresh.addEventListener("click", () => this._fetchData());
      }

      // Add weigh in modal
      const btnAddWeighIn = this.shadowRoot.getElementById("btn-add-weigh-in");
      if (btnAddWeighIn) {
        btnAddWeighIn.addEventListener("click", () => this._showAddWeighInModal());
      }

      // New profile button
      const btnNewProfile = this.shadowRoot.getElementById("btn-new-profile");
      if (btnNewProfile) {
        btnNewProfile.addEventListener("click", () => this._showProfileModal());
      }

      // Edit profile
      this.shadowRoot.querySelectorAll(".btn-edit-profile").forEach(btn => {
        btn.addEventListener("click", () => {
          const pId = btn.getAttribute("data-id");
          const p = this._data.profiles.find(x => x.id === pId);
          if (p) this._showProfileModal(p);
        });
      });

      // Delete profile
      this.shadowRoot.querySelectorAll(".btn-delete-profile").forEach(btn => {
        btn.addEventListener("click", async () => {
          const pId = btn.getAttribute("data-id");
          if (confirm("Supprimer définitivement ce profil ?")) {
            await this._hass.fetchWithAuth("/api/domolink_scale/profile_delete", {
              method: "POST",
              body: JSON.stringify({ id: pId }),
            });
            await this._fetchData();
          }
        });
      });

      // Delete weigh in
      this.shadowRoot.querySelectorAll(".btn-delete-weigh-in").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-id");
          if (confirm("Supprimer cette pesée ?")) {
            await this._hass.fetchWithAuth("/api/domolink_scale/weigh_in_delete", {
              method: "POST",
              body: JSON.stringify({ id }),
            });
            await this._fetchData();
          }
        });
      });

      // Reassign weigh in
      this.shadowRoot.querySelectorAll(".btn-reassign").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          this._showReassignModal(id);
        });
      });
    }

    _showProfileModal(profile = null) {
      const container = this.shadowRoot.getElementById("modal-container");
      const isEdit = !!profile;
      const p = profile || {
        name: "",
        gender: "male",
        birthdate: "1985-01-01",
        height: 178,
        reference_weight: 80.0,
        target_weight: 75.0,
        tolerance: 3.5,
        color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
      };

      container.innerHTML = `
        <div class="modal-overlay" id="profile-modal-overlay">
          <div class="modal-card">
            <h2 style="margin-top: 0; font-size: 18px; color: #ffffff;">
              ${isEdit ? "✏️ Modifier le Profil" : "➕ Nouveau Profil Utilisateur"}
            </h2>

            <div class="form-group">
              <label>Nom ou Prénom</label>
              <input type="text" id="prof-name" class="form-input" value="${p.name}" placeholder="Ex: Jean-Frédéric" required />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label>Sexe</label>
                <select id="prof-gender" class="form-input">
                  <option value="male" ${p.gender === 'male' ? 'selected' : ''}>Homme</option>
                  <option value="female" ${p.gender === 'female' ? 'selected' : ''}>Femme</option>
                </select>
              </div>

              <div class="form-group">
                <label>Date de Naissance</label>
                <input type="date" id="prof-birthdate" class="form-input" value="${p.birthdate}" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label>Taille (cm)</label>
                <input type="number" id="prof-height" class="form-input" value="${p.height}" step="1" />
              </div>

              <div class="form-group">
                <label>Poids Actuel / Référence (kg)</label>
                <input type="number" id="prof-ref-weight" class="form-input" value="${p.reference_weight}" step="0.1" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label>Poids Cible / Objectif (kg)</label>
                <input type="number" id="prof-target-weight" class="form-input" value="${p.target_weight}" step="0.1" />
              </div>

              <div class="form-group">
                <label>Tolérance Détection (± kg)</label>
                <input type="number" id="prof-tolerance" class="form-input" value="${p.tolerance}" step="0.5" />
              </div>
            </div>

            <div class="form-group">
              <label>Couleur Personnalisée de la Courbe</label>
              <div class="color-picker-wrapper">
                <input type="color" id="prof-color" value="${p.color || '#3b82f6'}" />
                <span style="font-size: 13px; color: #cbd5e1;" id="color-hex-label">${p.color || '#3b82f6'}</span>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button class="btn" id="modal-cancel">Annuler</button>
              <button class="btn btn-primary" id="modal-save">Enregistrer</button>
            </div>
          </div>
        </div>
      `;

      const colorInput = container.querySelector("#prof-color");
      const colorLabel = container.querySelector("#color-hex-label");
      colorInput.addEventListener("input", (e) => {
        colorLabel.textContent = e.target.value;
      });

      container.querySelector("#modal-cancel").addEventListener("click", () => {
        container.innerHTML = "";
      });

      container.querySelector("#modal-save").addEventListener("click", async () => {
        const payload = {
          name: container.querySelector("#prof-name").value,
          gender: container.querySelector("#prof-gender").value,
          birthdate: container.querySelector("#prof-birthdate").value,
          height: parseFloat(container.querySelector("#prof-height").value),
          reference_weight: parseFloat(container.querySelector("#prof-ref-weight").value),
          target_weight: parseFloat(container.querySelector("#prof-target-weight").value),
          tolerance: parseFloat(container.querySelector("#prof-tolerance").value),
          color: colorInput.value,
        };

        if (isEdit) {
          payload.id = profile.id;
          await this._hass.fetchWithAuth("/api/domolink_scale/profile_update", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        } else {
          await this._hass.fetchWithAuth("/api/domolink_scale/profile_add", {
            method: "POST",
            body: JSON.stringify(payload),
          });
        }

        container.innerHTML = "";
        await this._fetchData();
      });
    }

    _showAddWeighInModal() {
      const container = this.shadowRoot.getElementById("modal-container");
      const { profiles } = this._data;

      container.innerHTML = `
        <div class="modal-overlay">
          <div class="modal-card">
            <h2 style="margin-top: 0; font-size: 18px; color: #ffffff;">➕ Ajouter une Pesée Manuelle</h2>

            <div class="form-group">
              <label>Profil Utilisateur</label>
              <select id="weigh-user" class="form-input">
                <option value="">Attribution automatique (selon le poids)</option>
                ${profiles.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
              </select>
            </div>

            <div class="form-group">
              <label>Poids Mesuré (kg)</label>
              <input type="number" id="weigh-weight" class="form-input" placeholder="Ex: 82.5" step="0.05" required />
            </div>

            <div class="form-group">
              <label>Impédance Brute (Ω, optionnel)</label>
              <input type="number" id="weigh-impedance" class="form-input" placeholder="Ex: 680" step="1" />
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button class="btn" id="modal-cancel">Annuler</button>
              <button class="btn btn-primary" id="modal-save">Valider la Pesée</button>
            </div>
          </div>
        </div>
      `;

      container.querySelector("#modal-cancel").addEventListener("click", () => {
        container.innerHTML = "";
      });

      container.querySelector("#modal-save").addEventListener("click", async () => {
        const weight = parseFloat(container.querySelector("#weigh-weight").value);
        if (!weight || weight <= 0) return alert("Veuillez saisir un poids valide.");

        const uId = container.querySelector("#weigh-user").value || null;
        const imp = parseFloat(container.querySelector("#weigh-impedance").value) || null;

        await this._hass.fetchWithAuth("/api/domolink_scale/weigh_in_add", {
          method: "POST",
          body: JSON.stringify({ weight, user_id: uId, impedance: imp }),
        });

        container.innerHTML = "";
        await this._fetchData();
      });
    }

    _showReassignModal(entryId) {
      const container = this.shadowRoot.getElementById("modal-container");
      const { profiles } = this._data;

      container.innerHTML = `
        <div class="modal-overlay">
          <div class="modal-card">
            <h2 style="margin-top: 0; font-size: 18px; color: #ffffff;">🔄 Réassigner cette Pesée</h2>
            <div class="form-group">
              <label>Sélectionner le bon utilisateur :</label>
              <select id="reassign-user" class="form-input">
                ${profiles.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
                <option value="guest">Invité</option>
              </select>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button class="btn" id="modal-cancel">Annuler</button>
              <button class="btn btn-primary" id="modal-save">Confirmer</button>
            </div>
          </div>
        </div>
      `;

      container.querySelector("#modal-cancel").addEventListener("click", () => {
        container.innerHTML = "";
      });

      container.querySelector("#modal-save").addEventListener("click", async () => {
        const uId = container.querySelector("#reassign-user").value;
        await this._hass.fetchWithAuth("/api/domolink_scale/weigh_in_reassign", {
          method: "POST",
          body: JSON.stringify({ id: entryId, user_id: uId }),
        });
        container.innerHTML = "";
        await this._fetchData();
      });
    }
  }

  customElements.define(PANEL_NAME, DomolinkScalePanel);

  console.info(
    `%c DOMOLINK-SCALE %c v1.0.0 chargé avec succès `,
    "background: #0284c7; color: #fff; font-weight: bold; border-radius: 4px 0 0 4px;",
    "background: #0f172a; color: #38bdf8; border-radius: 0 4px 4px 0;"
  );
})();
