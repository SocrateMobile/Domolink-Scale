/**
 * Domolink-Scale — Panneau Tactile & Suivi Corporel Multi-Marques (v1.1.0)
 * Suite DomoLink — Glassmorphism, multi-courbes SVG, analyse BIA, profils (Adulte/Enfant/Animaux), tare & fusion.
 */

(function () {
  const PANEL_NAME = "domolink-scale-panel";

  const DEFAULT_COLORS = [
    "#0284c7", "#10b981", "#f59e0b", "#ec4899",
    "#8b5cf6", "#06b6d4", "#f97316", "#14b8a6", "#6366f1"
  ];

  const CATEGORY_ICONS = {
    adult: "👤",
    child: "👶",
    cat: "🐱",
    dog: "🐶",
    luggage: "🧳",
  };

  const CATEGORY_LABELS = {
    adult: "Adulte",
    child: "Enfant",
    cat: "Chat",
    dog: "Chien",
    luggage: "Bagage",
  };

  class DomolinkScalePanel extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._data = { profiles: [], history: [], last_tare: null, config: {}, options: {} };
      this._activeTab = "dashboard";
      this._selectedUserId = "all";
      this._timeFilter = "30d";
      this._showTrend = true;
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
        const res = await this._hass.fetchWithAuth("/api/domolink_scale/data?limit=1500");
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
      const { profiles, history, last_tare } = this._data;

      const activeProfile = this._selectedUserId !== "all" 
        ? profiles.find(p => p.id === this._selectedUserId) 
        : (profiles[0] || null);

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
            margin-bottom: 16px;
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

          /* Tare Banner */
          .tare-banner {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.15));
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 12px;
            padding: 10px 18px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .tare-text {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
            color: #e2e8f0;
          }
          .tare-weight-badge {
            font-size: 16px;
            font-weight: 800;
            color: #34d399;
          }

          /* Tabs */
          .tabs {
            display: flex;
            gap: 8px;
            background: rgba(15, 23, 42, 0.8);
            padding: 6px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            margin-bottom: 20px;
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
            height: 330px;
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
            flex-wrap: wrap;
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
            margin-left: 8px;
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
          .trend-badge {
            background: rgba(2, 132, 199, 0.15);
            border: 1px solid rgba(2, 132, 199, 0.3);
            color: #38bdf8;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
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
            background: rgba(0, 0, 0, 0.75);
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
              <p>Suivi Multi-Marques • Attribution Biométrique & Tare</p>
            </div>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary" id="btn-add-weigh-in">➕ Pesée Manuelle</button>
            <button class="btn" id="btn-refresh">🔄 Rafraîchir</button>
          </div>
        </div>

        <!-- Tare Notification Banner if present -->
        ${last_tare ? `
          <div class="tare-banner">
            <div class="tare-text">
              <span>👶🐱🧳</span>
              <div>
                <strong>Dernière Tare détectée :</strong>
                <span class="tare-weight-badge">+${last_tare.tare_weight} kg</span>
                <span style="color: #94a3b8; font-size: 12px;">(Pèse-personne avec ${last_tare.base_user_name || 'utilisateur'} • ${this._formatDate(last_tare.timestamp)})</span>
              </div>
            </div>
            <button class="btn" id="btn-assign-tare" style="font-size: 12px; padding: 4px 10px;">Attribuer</button>
          </div>
        ` : ''}

        <!-- Navigation Tabs -->
        <div class="tabs">
          <button class="tab-btn ${this._activeTab === "dashboard" ? "active" : ""}" data-tab="dashboard">📊 Évolution & Analyse</button>
          <button class="tab-btn ${this._activeTab === "history" ? "active" : ""}" data-tab="history">📋 Historique (${history.length})</button>
          <button class="tab-btn ${this._activeTab === "settings" ? "active" : ""}" data-tab="settings">⚙️ Profils & Paramètres (${profiles.length})</button>
        </div>

        <!-- User Switcher -->
        <div class="profile-bar">
          <div class="user-pills">
            <div class="user-pill ${this._selectedUserId === "all" ? "active" : ""}" data-user="all">
              <span>👥 Tous les profils</span>
            </div>
            ${profiles.map(p => `
              <div class="user-pill ${this._selectedUserId === p.id ? "active" : ""}" data-user="${p.id}">
                <span style="font-size: 14px;">${CATEGORY_ICONS[p.category || 'adult'] || '👤'}</span>
                <div class="user-color-dot" style="background: ${p.color || '#0284c7'};"></div>
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
      const trend = activeProfile?.trend_7d || null;
      const isPet = activeProfile && ["cat", "dog", "chat", "chien", "luggage"].includes(activeProfile.category);
      const isChild = activeProfile && activeProfile.category === "child";

      return `
        <div class="dashboard-grid">
          <!-- Graphique interactif multi-courbes avec Tendance -->
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
            <div class="chart-container" id="chart-box"></div>
          </div>

          <!-- Analyse Corporelle -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">
                ${CATEGORY_ICONS[activeProfile?.category || 'adult'] || '👤'} 
                ${activeProfile?.name || 'Profil'} • Composition
              </div>
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

              ${trend ? `
                <div class="trend-badge">
                  📊 Tendance 7j : ${trend} kg
                </div>
              ` : ''}
            </div>

            ${isPet ? `
              <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; text-align: center; color: #94a3b8;">
                <div style="font-size: 32px; margin-bottom: 8px;">${CATEGORY_ICONS[activeProfile.category] || '🐾'}</div>
                <div style="font-size: 15px; font-weight: 700; color: #f8fafc;">Profil Animal de compagnie</div>
                <p style="font-size: 13px; margin: 4px 0 0;">Le suivi se concentre sur l'évolution du poids et les pesées par tare.</p>
              </div>
            ` : `
              <div class="metrics-grid">
                <div class="metric-box">
                  <div class="metric-label">IMC</div>
                  <div class="metric-value">${metrics.bmi || "-"}</div>
                  <div class="metric-sub">
                    <span class="badge ${['Poids normal', 'Normal', 'Enfant'].includes(metrics.bmi_label) ? 'badge-normal' : (['Surpoids', 'Poids insuffisant'].includes(metrics.bmi_label) ? 'badge-warning' : 'badge-danger')}">
                      ${metrics.bmi_label || 'N/A'}
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

                <div class="metric-box">
                  <div class="metric-label">Silhouette</div>
                  <div class="metric-value" style="font-size: 14px; font-weight: 600; color: #a78bfa;">${metrics.body_type || "-"}</div>
                  <div class="metric-sub">Morphologie</div>
                </div>
              </div>
            `}

            <!-- Objectif Activité & Marche Quotidienne -->
            <div style="margin-top: 14px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 14px;">
              <div style="font-size: 13px; font-weight: 700; color: #38bdf8; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                <span>🚶‍♂️ Activité & Marche Conseillée</span>
                <span style="font-size: 11px; color: #94a3b8; font-weight: 500;">Recommandation Santé OMS</span>
              </div>
              <div class="metrics-grid">
                <div class="metric-box">
                  <div class="metric-label">Pas / Jour</div>
                  <div class="metric-value" style="color: #38bdf8;">${metrics.daily_steps_goal ? metrics.daily_steps_goal.toLocaleString('fr-FR') : '-'}</div>
                  <div class="metric-sub">objectif quotidien</div>
                </div>
                <div class="metric-box">
                  <div class="metric-label">Durée Marche</div>
                  <div class="metric-value">${metrics.walking_duration_minutes ? Math.floor(metrics.walking_duration_minutes / 60) + 'h ' + (metrics.walking_duration_minutes % 60) + 'm' : (metrics.walking_duration_hours ? metrics.walking_duration_hours + ' h' : '-')}</div>
                  <div class="metric-sub">à allure normale</div>
                </div>
                <div class="metric-box">
                  <div class="metric-label">Distance Estimée</div>
                  <div class="metric-value">${metrics.walking_distance_km ? metrics.walking_distance_km + ' km' : '-'}</div>
                  <div class="metric-sub">foulée ~${metrics.stride_length_cm || 75} cm</div>
                </div>
                <div class="metric-box">
                  <div class="metric-label">Calories Estimées</div>
                  <div class="metric-value" style="color: #f59e0b;">${metrics.walking_calories_kcal ? metrics.walking_calories_kcal + ' kcal' : '-'}</div>
                  <div class="metric-sub">dépense de marche</div>
                </div>
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
      const height = container.clientHeight || 330;
      const padding = { top: 25, right: 30, bottom: 40, left: 45 };

      const { profiles, history } = this._data;

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
            Aucune pesée enregistrée pour cette période.
          </div>
        `;
        return;
      }

      const usersToDisplay = this._selectedUserId === "all" 
        ? profiles 
        : profiles.filter(p => p.id === this._selectedUserId);

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

      let linesSvg = "";
      usersToDisplay.forEach(u => {
        const uColor = u.color || "#0284c7";
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

        const points = uHistory.map(h => ({
          x: getX(new Date(h.timestamp).getTime()),
          y: getY(h.weight),
          data: h
        }));

        let dPath = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          dPath += ` L ${points[i].x} ${points[i].y}`;
        }

        // Draw actual curve
        linesSvg += `
          <path d="${dPath}" fill="none" stroke="${uColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        `;

        // Draw dots
        points.forEach(p => {
          linesSvg += `
            <circle cx="${p.x}" cy="${p.y}" r="5" fill="#0f172a" stroke="${uColor}" stroke-width="2.5" class="chart-dot">
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
                <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                  <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="font-size: 24px;">${CATEGORY_ICONS[p.category || 'adult'] || '👤'}</div>
                    <div style="width: 14px; height: 14px; border-radius: 50%; background: ${p.color || '#0284c7'}; border: 2px solid #ffffff;"></div>
                    <div>
                      <div style="font-size: 15px; font-weight: 700; color: #ffffff;">${p.name} <span style="font-size: 11px; color: #94a3b8;">(${CATEGORY_LABELS[p.category || 'adult'] || 'Adulte'})</span></div>
                      <div style="font-size: 12px; color: #94a3b8;">
                        ${p.height ? p.height + ' cm • ' : ''}Ref: ${p.reference_weight} kg • Cible: ${p.target_weight} kg (±${p.tolerance} kg)
                      </div>
                    </div>
                  </div>
                  <div style="display: flex; gap: 6px;">
                    <button class="btn btn-merge-profile" data-id="${p.id}" style="padding: 6px 10px; font-size: 12px; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border-color: rgba(245, 158, 11, 0.4);">🔀 Fusionner</button>
                    <button class="btn btn-edit-profile" data-id="${p.id}" style="padding: 6px 10px; font-size: 12px;">✏️ Modifier</button>
                    <button class="btn btn-delete-profile" data-id="${p.id}" style="padding: 6px 10px; font-size: 12px; color: #f87171;">🗑️</button>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>

          <!-- Documentation & Fonctionnement -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">ℹ️ Attribution Intelligente & Tare</div>
            </div>
            <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
              <strong>Domolink-Scale</strong> gère automatiquement toute la famille :
            </p>
            <ul style="font-size: 13px; color: #94a3b8; line-height: 1.7; padding-left: 20px;">
              <li><strong>Attribution par Poids & Impédance :</strong> Croise le poids mesuré avec la signature d'impédance biologique pour distinguer deux personnes de corpulence similaire.</li>
              <li><strong>Création Auto (> 5 kg) :</strong> Si une pesée s'écarte de plus de 5 kg de tous les membres connus, un nouveau profil est créé automatiquement.</li>
              <li><strong>Mode Tare (Bébé / Chien / Chat) :</strong> Si vous montez sur la balance puis remontez dans les 3 minutes avec un animal ou un bébé dans les bras, le surplus est automatiquement calculé en tare !</li>
              <li><strong>Fusion en 1 Clic :</strong> Vous pouvez fusionner n'importe quel profil temporaire avec un profil existant.</li>
            </ul>
          </div>
        </div>
      `;
    }

    _attachEvents() {
      this.shadowRoot.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          this._activeTab = btn.getAttribute("data-tab");
          this._render();
        });
      });

      this.shadowRoot.querySelectorAll(".user-pill").forEach(pill => {
        pill.addEventListener("click", () => {
          this._selectedUserId = pill.getAttribute("data-user");
          this._render();
        });
      });

      this.shadowRoot.querySelectorAll(".time-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          this._timeFilter = btn.getAttribute("data-time");
          this._render();
        });
      });

      const btnRefresh = this.shadowRoot.getElementById("btn-refresh");
      if (btnRefresh) {
        btnRefresh.addEventListener("click", () => this._fetchData());
      }

      // Easter egg: 3 clicks on brand header in < 2 seconds
      let brandClicks = [];
      const brand = this.shadowRoot.querySelector(".brand");
      if (brand) {
        brand.style.cursor = "pointer";
        brand.addEventListener("click", () => {
          const now = Date.now();
          brandClicks = brandClicks.filter(t => now - t < 2000);
          brandClicks.push(now);
          if (brandClicks.length >= 3) {
            brandClicks = [];
            launchSocrateRulesEasterEgg(this.shadowRoot);
          }
        });
      }

      const btnAddWeighIn = this.shadowRoot.getElementById("btn-add-weigh-in");
      if (btnAddWeighIn) {
        btnAddWeighIn.addEventListener("click", () => this._showAddWeighInModal());
      }

      const btnAssignTare = this.shadowRoot.getElementById("btn-assign-tare");
      if (btnAssignTare && this._data.last_tare) {
        btnAssignTare.addEventListener("click", () => this._showAddWeighInModal(this._data.last_tare.tare_weight));
      }

      const btnNewProfile = this.shadowRoot.getElementById("btn-new-profile");
      if (btnNewProfile) {
        btnNewProfile.addEventListener("click", () => this._showProfileModal());
      }

      this.shadowRoot.querySelectorAll(".btn-edit-profile").forEach(btn => {
        btn.addEventListener("click", () => {
          const pId = btn.getAttribute("data-id");
          const p = this._data.profiles.find(x => x.id === pId);
          if (p) this._showProfileModal(p);
        });
      });

      this.shadowRoot.querySelectorAll(".btn-merge-profile").forEach(btn => {
        btn.addEventListener("click", () => {
          const pId = btn.getAttribute("data-id");
          this._showMergeModal(pId);
        });
      });

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
        category: "adult",
        gender: "male",
        birthdate: "1985-01-01",
        height: 178,
        reference_weight: 80.0,
        target_weight: 75.0,
        tolerance: 5.0,
        color: DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)],
      };

      container.innerHTML = `
        <div class="modal-overlay">
          <div class="modal-card">
            <h2 style="margin-top: 0; font-size: 18px; color: #ffffff;">
              ${isEdit ? "✏️ Modifier le Profil" : "➕ Nouveau Profil Utilisateur / Animal"}
            </h2>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label>Nom ou Prénom</label>
                <input type="text" id="prof-name" class="form-input" value="${p.name}" placeholder="Ex: Jean-Frédéric, Minou..." required />
              </div>

              <div class="form-group">
                <label>Catégorie</label>
                <select id="prof-category" class="form-input">
                  <option value="adult" ${p.category === 'adult' ? 'selected' : ''}>👤 Adulte</option>
                  <option value="child" ${p.category === 'child' ? 'selected' : ''}>👶 Enfant</option>
                  <option value="cat" ${p.category === 'cat' ? 'selected' : ''}>🐱 Chat</option>
                  <option value="dog" ${p.category === 'dog' ? 'selected' : ''}>🐶 Chien</option>
                  <option value="luggage" ${p.category === 'luggage' ? 'selected' : ''}>🧳 Bagage</option>
                </select>
              </div>
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
                <label>Poids Référence (kg)</label>
                <input type="number" id="prof-ref-weight" class="form-input" value="${p.reference_weight}" step="0.1" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label>Poids Cible (kg)</label>
                <input type="number" id="prof-target-weight" class="form-input" value="${p.target_weight}" step="0.1" />
              </div>

              <div class="form-group">
                <label>Tolérance Détection (± kg)</label>
                <input type="number" id="prof-tolerance" class="form-input" value="${p.tolerance || 5.0}" step="0.5" />
              </div>
            </div>

            <div class="form-group">
              <label>Couleur de la Courbe</label>
              <div class="color-picker-wrapper">
                <input type="color" id="prof-color" value="${p.color || '#0284c7'}" />
                <span style="font-size: 13px; color: #cbd5e1;" id="color-hex-label">${p.color || '#0284c7'}</span>
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
          category: container.querySelector("#prof-category").value,
          gender: container.querySelector("#prof-gender").value,
          birthdate: container.querySelector("#prof-birthdate").value,
          height: parseFloat(container.querySelector("#prof-height").value) || 175,
          reference_weight: parseFloat(container.querySelector("#prof-ref-weight").value) || 70,
          target_weight: parseFloat(container.querySelector("#prof-target-weight").value) || 65,
          tolerance: parseFloat(container.querySelector("#prof-tolerance").value) || 5.0,
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

    _showMergeModal(sourceUserId) {
      const container = this.shadowRoot.getElementById("modal-container");
      const { profiles } = this._data;
      const sourceProf = profiles.find(p => p.id === sourceUserId);
      const otherProfiles = profiles.filter(p => p.id !== sourceUserId);

      if (otherProfiles.length === 0) {
        alert("Aucun autre profil disponible pour la fusion.");
        return;
      }

      container.innerHTML = `
        <div class="modal-overlay">
          <div class="modal-card">
            <h2 style="margin-top: 0; font-size: 18px; color: #ffffff;">🔀 Fusionner le Profil</h2>
            <p style="font-size: 13px; color: #cbd5e1; line-height: 1.5;">
              Vous vous apprêtez à fusionner <strong>${sourceProf?.name}</strong> dans un autre profil.<br/>
              Toutes les pesées de cet utilisateur seront transférées vers le profil cible et ${sourceProf?.name} sera supprimé.
            </p>

            <div class="form-group">
              <label>Profil cible de destination :</label>
              <select id="merge-target" class="form-input">
                ${otherProfiles.map(p => `
                  <option value="${p.id}">${CATEGORY_ICONS[p.category || 'adult'] || '👤'} ${p.name} (actuel: ${p.reference_weight} kg)</option>
                `).join("")}
              </select>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
              <button class="btn" id="modal-cancel">Annuler</button>
              <button class="btn btn-primary" id="modal-confirm-merge" style="background: linear-gradient(135deg, #f59e0b, #d97706);">Confirmer la Fusion</button>
            </div>
          </div>
        </div>
      `;

      container.querySelector("#modal-cancel").addEventListener("click", () => {
        container.innerHTML = "";
      });

      container.querySelector("#modal-confirm-merge").addEventListener("click", async () => {
        const targetId = container.querySelector("#merge-target").value;
        await this._hass.fetchWithAuth("/api/domolink_scale/profile_merge", {
          method: "POST",
          body: JSON.stringify({ source_id: sourceUserId, target_id: targetId }),
        });
        container.innerHTML = "";
        await this._fetchData();
      });
    }

    _showAddWeighInModal(defaultWeight = null) {
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
                ${profiles.map(p => `<option value="${p.id}">${CATEGORY_ICONS[p.category || 'adult'] || '👤'} ${p.name}</option>`).join("")}
              </select>
            </div>

            <div class="form-group">
              <label>Poids Mesuré (kg)</label>
              <input type="number" id="weigh-weight" class="form-input" value="${defaultWeight || ''}" placeholder="Ex: 82.5" step="0.05" required />
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
              <label>Sélectionner le bon profil :</label>
              <select id="reassign-user" class="form-input">
                ${profiles.map(p => `<option value="${p.id}">${CATEGORY_ICONS[p.category || 'adult'] || '👤'} ${p.name}</option>`).join("")}
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

  /* =========================================================================
   * 🎆 SOCRATE RULES - EASTER EGG MODULE
   * ========================================================================= */
  function launchSocrateRulesEasterEgg(targetRoot) {
    if (targetRoot.getElementById?.("socrate-rules-overlay") || targetRoot.querySelector?.("#socrate-rules-overlay")) return;

    if (!document.getElementById("socrate-rules-fonts")) {
      const fontLink = document.createElement("link");
      fontLink.id = "socrate-rules-fonts";
      fontLink.rel = "stylesheet";
      fontLink.href = "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;900&family=Poppins:wght@300;600&display=swap";
      document.head.appendChild(fontLink);
    }

    const overlay = document.createElement("div");
    overlay.id = "socrate-rules-overlay";
    overlay.innerHTML = `
      <style>
        #socrate-rules-overlay {
          position: fixed;
          top: 0; left: 0;
          width: 100vw; height: 100vh;
          z-index: 999999;
          background-color: #030008;
          font-family: 'Poppins', sans-serif;
          display: flex; justify-content: center; align-items: center;
          overflow: hidden;
          user-select: none;
          opacity: 0;
          transition: opacity 0.35s ease, transform 0.35s ease;
        }
        #socrate-rules-overlay canvas {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          z-index: 1; pointer-events: none;
        }
        #socrate-rules-overlay .socrate-container {
          position: relative; z-index: 10; text-align: center; pointer-events: auto;
        }
        #socrate-rules-overlay h1.socrate-title {
          font-family: 'Orbitron', sans-serif;
          font-size: 6.5rem; font-weight: 900; letter-spacing: 12px;
          text-transform: uppercase; display: inline-block; line-height: 1.1;
          filter: drop-shadow(0px 1px 0px #990066) drop-shadow(0px 3px 0px #330066) drop-shadow(0 0 25px rgba(127, 0, 255, 0.6));
          transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          cursor: pointer;
        }
        #socrate-rules-overlay h1.socrate-title:hover {
          transform: scale(1.05);
          filter: drop-shadow(0px 1px 0px #ff007f) drop-shadow(0px 4px 0px #330066) drop-shadow(0 0 40px rgba(0, 240, 255, 0.9));
        }
        #socrate-rules-overlay .socrate-letter {
          display: inline-block;
          background: linear-gradient(to bottom, #ff66b3 0%, #ff007f 35%, #7f00ff 65%, #00f0ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: socrate-wave 1.6s ease-in-out infinite;
        }
        #socrate-rules-overlay p.socrate-sub {
          font-size: 1.1rem; color: rgba(255, 255, 255, 0.6); margin-top: 30px;
          letter-spacing: 4px; text-transform: uppercase; font-weight: 300;
          opacity: 0; animation: socrate-fadeIn 2s ease forwards 0.8s;
        }
        #socrate-rules-overlay p.socrate-sub strong {
          color: #00f0ff; font-weight: 600; text-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
        }
        #socrate-rules-overlay p.socrate-exit-hint {
          font-size: 0.95rem; color: rgba(255, 255, 255, 0.6); margin-top: 16px;
          letter-spacing: 2px; text-transform: uppercase; font-weight: 300;
          opacity: 0; animation: socrate-fadeIn 2s ease forwards 1.1s; cursor: pointer;
        }
        #socrate-rules-overlay p.socrate-exit-hint strong {
          color: #ff007f; font-weight: 700; text-shadow: 0 0 10px rgba(255, 0, 127, 0.6);
        }
        #socrate-rules-overlay .socrate-instructions {
          position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
          z-index: 10; color: rgba(255, 255, 255, 0.4); font-size: 0.8rem;
          letter-spacing: 2px; text-transform: uppercase; pointer-events: none;
          animation: socrate-pulse 2s infinite; text-align: center;
        }
        @keyframes socrate-wave { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-25px); } }
        @keyframes socrate-fadeIn { to { opacity: 1; transform: translateY(0); } }
        @keyframes socrate-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.8; } }
        @media (max-width: 768px) {
          #socrate-rules-overlay h1.socrate-title { font-size: 3rem; letter-spacing: 6px; }
          #socrate-rules-overlay p.socrate-sub { font-size: 0.85rem; }
        }
      </style>
      <canvas id="socrateParticleCanvas"></canvas>
      <div class="socrate-container">
        <h1 class="socrate-title" id="socrateTitle">Socrate Rules</h1>
        <p class="socrate-sub" id="socrateSub">Une expérience visuelle <strong>hautement philosophique</strong>.</p>
        <p class="socrate-exit-hint" id="socrateExitHint">Cliquez 3 fois sur <strong>SOCRATE RULES</strong> pour quitter</p>
      </div>
      <div class="socrate-instructions">Bougez votre souris & cliquez n'importe où</div>
    `;

    targetRoot.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = "1"; });

    const canvas = overlay.querySelector("#socrateParticleCanvas");
    const ctx = canvas.getContext("2d");
    const title = overlay.querySelector("#socrateTitle");
    const TWO_PI = Math.PI * 2;

    const lines = ["Socrate", "Rules"];
    title.innerHTML = "";
    let globalCharIndex = 0;
    lines.forEach((lineText) => {
      const lineDiv = document.createElement("div");
      lineDiv.style.display = "block";
      [...lineText].forEach((char) => {
        const span = document.createElement("span");
        if (char === " ") span.innerHTML = "&nbsp;";
        else span.textContent = char;
        span.classList.add("socrate-letter");
        span.style.animationDelay = `${globalCharIndex * 0.07}s`;
        lineDiv.appendChild(span);
        globalCharIndex++;
      });
      title.appendChild(lineDiv);
    });

    let particlesArray = [];
    let sparksArray = [];
    let animId = null;
    let isClosing = false;
    let mouse = { x: null, y: null, radius: 150, radiusSq: 22500 };

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();

    class Particle {
      constructor(x, y, directionX, directionY, size, color) {
        this.x = x; this.y = y; this.directionX = directionX; this.directionY = directionY;
        this.size = size; this.color = color; this.originalSize = size;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, TWO_PI, false);
        ctx.fillStyle = this.color;
        ctx.fill();
      }
      update() {
        if (this.x > canvas.width || this.x < 0) this.directionX = -this.directionX;
        if (this.y > canvas.height || this.y < 0) this.directionY = -this.directionY;
        this.x += this.directionX;
        this.y += this.directionY;
        if (mouse.x != null && mouse.y != null) {
          let dx = mouse.x - this.x;
          let dy = mouse.y - this.y;
          let distanceSq = dx * dx + dy * dy;
          if (distanceSq < mouse.radiusSq) {
            let distance = Math.sqrt(distanceSq);
            this.x -= (dx / distance) * 3;
            this.y -= (dy / distance) * 3;
            if (this.size < this.originalSize * 3.5) this.size += 0.2;
          } else if (this.size > this.originalSize) {
            this.size -= 0.1;
          }
        } else if (this.size > this.originalSize) {
          this.size -= 0.1;
        }
        this.draw();
      }
    }

    class Spark {
      constructor(x, y) {
        this.x = x; this.y = y; this.size = Math.random() * 6 + 2;
        this.speedX = (Math.random() - 0.5) * 12;
        this.speedY = (Math.random() - 0.5) * 12;
        const colors = ["#ff007f", "#7f00ff", "#00f0ff", "#ffffff"];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.alpha = 1;
        this.decay = Math.random() * 0.015 + 0.01;
      }
      update() {
        this.x += this.speedX; this.y += this.speedY;
        this.speedX *= 0.98; this.speedY *= 0.98;
        this.alpha -= this.decay;
        if (this.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = this.alpha;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, TWO_PI);
          ctx.fillStyle = this.color;
          ctx.shadowBlur = 15;
          ctx.shadowColor = this.color;
          ctx.fill();
          ctx.restore();
        }
      }
    }

    function initParticles() {
      particlesArray = [];
      let baseParticles = (canvas.width * canvas.height) / 9000;
      let numberOfParticles = Math.min(baseParticles, 250);
      for (let i = 0; i < numberOfParticles; i++) {
        let size = Math.random() * 2 + 0.5;
        let x = Math.random() * canvas.width;
        let y = Math.random() * canvas.height;
        let directionX = Math.random() * 0.4 - 0.2;
        let directionY = Math.random() * 0.4 - 0.2;
        let colorPalette = ["rgba(127, 0, 255, 0.4)", "rgba(0, 240, 255, 0.3)", "rgba(255, 0, 127, 0.3)"];
        let color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        particlesArray.push(new Particle(x, y, directionX, directionY, size, color));
      }
    }

    function connectParticles() {
      let maxDistance = 120;
      let maxDistanceSq = maxDistance * maxDistance;
      for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a + 1; b < particlesArray.length; b++) {
          let dx = particlesArray[a].x - particlesArray[b].x;
          let dy = particlesArray[a].y - particlesArray[b].y;
          let distanceSq = dx * dx + dy * dy;
          if (distanceSq < maxDistanceSq) {
            let opacity = (1 - Math.sqrt(distanceSq) / maxDistance) * 0.15;
            ctx.strokeStyle = `rgba(127, 0, 255, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
            ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
            ctx.stroke();
          }
        }
      }
    }

    function animate() {
      ctx.fillStyle = "rgba(3, 0, 8, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particlesArray.length; i++) particlesArray[i].update();
      for (let i = sparksArray.length - 1; i >= 0; i--) {
        sparksArray[i].update();
        if (sparksArray[i].alpha <= 0) sparksArray.splice(i, 1);
      }
      connectParticles();
      animId = requestAnimationFrame(animate);
    }

    function onMouseMove(e) { mouse.x = e.clientX; mouse.y = e.clientY; }
    function onMouseOut() { mouse.x = null; mouse.y = null; }
    function onTouchMove(e) { if (e.touches && e.touches[0]) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; } }
    function onTouchEnd() { mouse.x = null; mouse.y = null; }
    function onOverlayClick(e) {
      const x = e.clientX || window.innerWidth / 2;
      const y = e.clientY || window.innerHeight / 2;
      for (let i = 0; i < 30; i++) sparksArray.push(new Spark(x, y));
    }
    function onKeyDown(e) { if (e.key === "Escape") cleanup(); }

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseout", onMouseOut);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    overlay.addEventListener("click", onOverlayClick);

    let exitClicks = [];
    function handleExitClick(clientX, clientY) {
      if (isClosing) return;
      const now = Date.now();
      exitClicks = exitClicks.filter((t) => now - t < 2000);
      exitClicks.push(now);
      const x = clientX || window.innerWidth / 2;
      const y = clientY || window.innerHeight / 2;
      for (let i = 0; i < 70; i++) sparksArray.push(new Spark(x, y));

      if (exitClicks.length >= 3) {
        isClosing = true;
        exitClicks = [];
        overlay.style.transition = "opacity 0.38s ease, transform 0.38s ease";
        overlay.style.opacity = "0";
        overlay.style.transform = "scale(1.05)";
        setTimeout(() => { cleanup(); }, 360);
      }
    }

    title.addEventListener("click", (e) => { e.stopPropagation(); handleExitClick(e.clientX, e.clientY); });
    const exitHint = overlay.querySelector("#socrateExitHint");
    if (exitHint) { exitHint.addEventListener("click", (e) => { e.stopPropagation(); handleExitClick(e.clientX, e.clientY); }); }

    function cleanup() {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
      overlay.removeEventListener("click", onOverlayClick);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    initParticles();
    animate();
  }

  customElements.define(PANEL_NAME, DomolinkScalePanel);

  console.info(
    `%c DOMOLINK-SCALE %c v1.2.0 chargé avec succès `,
    "background: #0284c7; color: #fff; font-weight: bold; border-radius: 4px 0 0 4px;",
    "background: #0f172a; color: #38bdf8; border-radius: 0 4px 4px 0;"
  );
})();
