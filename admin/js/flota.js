// Lógica del panel administrativo de flota (/admin/flota)

document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.AGM_AUTH;
  if (!auth) return;

  // 1. Validar autenticación y personal activo
  const staffInfo = await auth.requireActiveStaff();
  if (!staffInfo) return;

  const client = auth.client;
  const user = staffInfo.user;
  const profile = staffInfo.profile;

  // Renderizar información del usuario en navbar
  const navUserEl = document.getElementById("navUserEmail");
  const navRoleEl = document.getElementById("navUserRole");
  if (navUserEl) navUserEl.textContent = profile?.full_name || user.email;
  if (navRoleEl) navRoleEl.textContent = profile?.role || "staff";

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await auth.signOut();
    });
  }

  // Elementos DOM
  const fleetGrid = document.getElementById("fleetGrid");
  const activeCountEl = document.getElementById("activeCount");
  const inactiveCountEl = document.getElementById("inactiveCount");
  const fleetAlert = document.getElementById("fleetAlert");

  // Elementos del Modal de Edición
  const editModal = document.getElementById("editModal");
  const editForm = document.getElementById("editVehicleForm");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const saveBtn = document.getElementById("saveVehicleBtn");

  // Elementos del Modal de Desactivación
  const deactivateModal = document.getElementById("deactivateModal");
  const deactivateModelName = document.getElementById("deactivateModelName");
  const cancelDeactivateBtn = document.getElementById("cancelDeactivateBtn");
  const confirmDeactivateBtn = document.getElementById("confirmDeactivateBtn");

  let categories = [];
  let fleetModels = [];
  let vehicleToDeactivate = null;

  const showAlert = (msg, type = "success") => {
    fleetAlert.textContent = msg;
    fleetAlert.className = `alert alert-${type}`;
    fleetAlert.style.display = "block";
    setTimeout(() => {
      fleetAlert.style.display = "none";
    }, 4500);
  };

  // Cargar categorías de la base de datos
  const loadCategories = async () => {
    const { data, error } = await client
      .from("vehicle_categories")
      .select("id, slug, name")
      .order("sort_order");

    if (error) {
      console.error("Error cargando categorías:", error);
      return;
    }
    categories = data || [];

    const categorySelect = document.getElementById("editCategory");
    if (categorySelect) {
      categorySelect.innerHTML = categories
        .map((c) => `<option value="${c.id}">${c.name}</option>`)
        .join("");
    }
  };

  // Cargar modelos y traducciones
  const loadFleet = async () => {
    fleetGrid.innerHTML = '<div class="loading-state">Cargando flota...</div>';

    // Obtener modelos técnicos
    const { data: models, error: modelsError } = await client
      .from("vehicle_models")
      .select(`
        id, category_id, slug, make, model, display_name,
        transmission, drivetrain, fuel_type, seats, luggage_capacity,
        air_conditioning, image_url, description, sort_order, active,
        vehicle_categories (id, name)
      `)
      .order("sort_order");

    if (modelsError) {
      console.error("Error al cargar modelos:", modelsError);
      fleetGrid.innerHTML = '<div class="alert alert-danger">Error al cargar el catálogo de flota.</div>';
      return;
    }

    // Obtener traducciones
    const { data: translations, error: transError } = await client
      .from("vehicle_model_translations")
      .select("*");

    if (transError) {
      console.error("Error al cargar traducciones:", transError);
    }

    const translationsMap = new Map();
    (translations || []).forEach((t) => {
      if (!translationsMap.has(t.vehicle_model_id)) {
        translationsMap.set(t.vehicle_model_id, {});
      }
      translationsMap.get(t.vehicle_model_id)[t.locale] = t;
    });

    fleetModels = (models || []).map((m) => ({
      ...m,
      translations: translationsMap.get(m.id) || {},
    }));

    renderFleet();
  };

  // Renderizar tarjetas de vehículos
  const renderFleet = () => {
    let activeCount = 0;
    let inactiveCount = 0;

    fleetModels.forEach((m) => {
      if (m.active) activeCount++;
      else inactiveCount++;
    });

    if (activeCountEl) activeCountEl.textContent = `${activeCount} Activos`;
    if (inactiveCountEl) inactiveCountEl.textContent = `${inactiveCount} Inactivos`;

    if (fleetModels.length === 0) {
      fleetGrid.innerHTML = '<p>No hay vehículos registrados en el catálogo.</p>';
      return;
    }

    fleetGrid.innerHTML = fleetModels
      .map((vm) => {
        const esTrans = vm.translations["es"] || {};
        const enTrans = vm.translations["en"] || {};
        const ptTrans = vm.translations["pt"] || {};

        const displayName = esTrans.display_name || vm.display_name || `${vm.make} ${vm.model}`;
        const categoryName = esTrans.category_name || vm.vehicle_categories?.name || "Sin categoría";
        const desc = esTrans.description || vm.description || "Sin descripción.";

        const drivetrainLabel = vm.drivetrain ? vm.drivetrain : "Sin confirmar";
        const isDrivetrainConfirmed = Boolean(vm.drivetrain);

        const fuelLabel = vm.fuel_type ? vm.fuel_type : "Sin confirmar";
        const isFuelConfirmed = Boolean(vm.fuel_type);

        const transStatusBadge = (locale, trans) => {
          const status = trans.translation_status || "pending";
          let label = "○ Pendiente";
          let css = "trans-pending";

          if (status === "original") {
            label = "✓ Original";
            css = "trans-original";
          } else if (status === "translated") {
            label = "✓ Traducido";
            css = "trans-translated";
          } else if (status === "reviewed") {
            label = "✓ Revisado";
            css = "trans-translated";
          } else if (status === "stale") {
            label = "△ Desactualizado";
            css = "trans-stale";
          } else if (status === "failed") {
            label = "✕ Error";
            css = "trans-failed";
          }

          return `<span class="trans-tag ${css}">${locale.toUpperCase()} ${label}</span>`;
        };

        const imagePath = vm.image_url ? `../../${vm.image_url}` : "";

        return `
          <div class="vehicle-card ${vm.active ? "" : "inactive"}" data-id="${vm.id}">
            <div class="vehicle-card-img-wrap">
              ${
                imagePath
                  ? `<img src="${imagePath}" alt="${displayName}" class="vehicle-card-img" />`
                  : `<div class="vehicle-card-img-placeholder">Sin imagen</div>`
              }
              <span class="vehicle-card-status-badge ${vm.active ? "status-active" : "status-inactive"}">
                ${vm.active ? "Activo" : "Inactivo"}
              </span>
            </div>
            <div class="vehicle-card-body">
              <div class="vehicle-card-category">${categoryName}</div>
              <h3 class="vehicle-card-title">${displayName}</h3>
              <p class="vehicle-card-desc">${desc}</p>

              <div class="vehicle-specs-grid">
                <div class="spec-item">
                  <span class="spec-label">Pasajeros</span>
                  <span class="spec-value">${vm.seats} Pers.</span>
                </div>
                <div class="spec-item">
                  <span class="spec-label">Equipaje</span>
                  <span class="spec-value">${vm.luggage_capacity} Maletas</span>
                </div>
                <div class="spec-item">
                  <span class="spec-label">Transmisión</span>
                  <span class="spec-value">${vm.transmission === "automatic" ? "Automática" : "Manual"}</span>
                </div>
                <div class="spec-item">
                  <span class="spec-label">Tracción</span>
                  <span class="spec-value ${isDrivetrainConfirmed ? "" : "unconfirmed"}">${drivetrainLabel}</span>
                </div>
                <div class="spec-item">
                  <span class="spec-label">Combustible</span>
                  <span class="spec-value ${isFuelConfirmed ? "" : "unconfirmed"}">${fuelLabel}</span>
                </div>
                <div class="spec-item">
                  <span class="spec-label">A/C</span>
                  <span class="spec-value">${vm.air_conditioning ? "Sí" : "No"}</span>
                </div>
              </div>

              <div class="translation-statuses">
                ${transStatusBadge("es", esTrans)}
                ${transStatusBadge("en", enTrans)}
                ${transStatusBadge("pt", ptTrans)}
              </div>

              <div class="vehicle-card-actions">
                <button type="button" class="btn btn-sm btn-primary btn-edit" data-id="${vm.id}">
                  Editar
                </button>
                <button type="button" class="btn btn-sm ${vm.active ? "btn-danger-outline btn-toggle-active" : "btn-outline btn-toggle-active"}" data-id="${vm.id}">
                  ${vm.active ? "Desactivar" : "Activar"}
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    // Conectar eventos de botones en tarjetas
    document.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        openEditModal(id);
      });
    });

    document.querySelectorAll(".btn-toggle-active").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        toggleActive(id);
      });
    });
  };

  // Abrir modal de edición
  const openEditModal = (id) => {
    const vehicle = fleetModels.find((m) => m.id === id);
    if (!vehicle) return;

    const esTrans = vehicle.translations["es"] || {};
    const enTrans = vehicle.translations["en"] || {};
    const ptTrans = vehicle.translations["pt"] || {};

    // Poblar campos técnicos
    document.getElementById("editVehicleId").value = vehicle.id;
    document.getElementById("editMake").value = vehicle.make || "";
    document.getElementById("editModel").value = vehicle.model || "";
    document.getElementById("editCategory").value = vehicle.category_id || "";
    document.getElementById("editSeats").value = vehicle.seats || 5;
    document.getElementById("editLuggage").value = vehicle.luggage_capacity || 2;
    document.getElementById("editTransmission").value = vehicle.transmission || "automatic";
    document.getElementById("editDrivetrain").value = vehicle.drivetrain || "";
    document.getElementById("editFuelType").value = vehicle.fuel_type || "";
    document.getElementById("editAirConditioning").checked = Boolean(vehicle.air_conditioning);
    document.getElementById("editSortOrder").value = vehicle.sort_order || 0;
    document.getElementById("editActive").checked = Boolean(vehicle.active);

    // Poblar contenido maestro en español
    document.getElementById("editDisplayName").value = esTrans.display_name || vehicle.display_name || "";
    document.getElementById("editCategoryName").value = esTrans.category_name || "";
    document.getElementById("editShortDescription").value = esTrans.short_description || "";
    document.getElementById("editDescription").value = esTrans.description || vehicle.description || "";
    document.getElementById("editSeoTitle").value = esTrans.seo_title || "";
    document.getElementById("editMetaDescription").value = esTrans.meta_description || "";

    // Indicadores de traducción
    document.getElementById("statusEsText").textContent = `ES ✓ Original (${esTrans.source_hash ? esTrans.source_hash.slice(0, 8) : "nuevo"})`;
    document.getElementById("statusEnText").textContent = `EN: ${enTrans.translation_status || "pending"}`;
    document.getElementById("statusPtText").textContent = `PT: ${ptTrans.translation_status || "pending"}`;

    editModal.showModal();
  };

  // Cerrar modal
  const closeEditModal = () => {
    editModal.close();
    editForm.reset();
  };

  if (closeModalBtn) closeModalBtn.addEventListener("click", closeEditModal);
  if (cancelEditBtn) cancelEditBtn.addEventListener("click", closeEditModal);

  // Guardar cambios del vehículo
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando...";

    const id = Number(document.getElementById("editVehicleId").value);
    const make = document.getElementById("editMake").value.trim();
    const model = document.getElementById("editModel").value.trim();
    const category_id = Number(document.getElementById("editCategory").value);
    const seats = Number(document.getElementById("editSeats").value);
    const luggage_capacity = Number(document.getElementById("editLuggage").value);
    const transmission = document.getElementById("editTransmission").value;
    const drivetrain = document.getElementById("editDrivetrain").value || null;
    const fuel_type = document.getElementById("editFuelType").value || null;
    const air_conditioning = document.getElementById("editAirConditioning").checked;
    const sort_order = Number(document.getElementById("editSortOrder").value);
    const active = document.getElementById("editActive").checked;

    // Contenido en español
    const display_name = document.getElementById("editDisplayName").value.trim();
    const category_name = document.getElementById("editCategoryName").value.trim() || null;
    const short_description = document.getElementById("editShortDescription").value.trim() || null;
    const description = document.getElementById("editDescription").value.trim() || null;
    const seo_title = document.getElementById("editSeoTitle").value.trim() || null;
    const meta_description = document.getElementById("editMetaDescription").value.trim() || null;

    try {
      // 1. Actualizar datos técnicos en vehicle_models
      const { error: modelUpdateError } = await client
        .from("vehicle_models")
        .update({
          make,
          model,
          category_id,
          seats,
          luggage_capacity,
          transmission,
          drivetrain,
          fuel_type,
          air_conditioning,
          sort_order,
          active,
          display_name, // legacy fallback
          description,  // legacy fallback
        })
        .eq("id", id);

      if (modelUpdateError) {
        throw modelUpdateError;
      }

      // 2. Actualizar contenido maestro en vehicle_model_translations (locale = 'es')
      // El trigger recalcula source_hash automáticamente y actualiza EN/PT a 'stale' si ES cambió.
      const { error: transUpdateError } = await client
        .from("vehicle_model_translations")
        .upsert(
          {
            vehicle_model_id: id,
            locale: "es",
            display_name,
            category_name,
            short_description,
            description,
            seo_title,
            meta_description,
            translation_source: "original",
            translation_status: "original",
          },
          { onConflict: "vehicle_model_id,locale" },
        );

      if (transUpdateError) {
        throw transUpdateError;
      }

      closeEditModal();
      showAlert("Vehículo actualizado correctamente. Se recalculó el hash de contenido.");
      await loadFleet();
    } catch (err) {
      console.error("Error al guardar vehículo:", err);
      alert(`Error al guardar: ${err.message || "Error inesperado."}`);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Guardar Cambios";
    }
  });

  // Alternar estado activo / inactivo
  const toggleActive = async (id) => {
    const vehicle = fleetModels.find((m) => m.id === id);
    if (!vehicle) return;

    if (vehicle.active) {
      // Pedir confirmación al desactivar
      vehicleToDeactivate = vehicle;
      deactivateModelName.textContent = `${vehicle.make} ${vehicle.model}`;
      deactivateModal.showModal();
    } else {
      // Reactivar directamente
      const { error } = await client
        .from("vehicle_models")
        .update({ active: true, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        alert(`Error al reactivar el modelo: ${error.message}`);
        return;
      }
      showAlert(`Modelo ${vehicle.make} ${vehicle.model} activado.`);
      await loadFleet();
    }
  };

  if (cancelDeactivateBtn) {
    cancelDeactivateBtn.addEventListener("click", () => {
      deactivateModal.close();
      vehicleToDeactivate = null;
    });
  }

  if (confirmDeactivateBtn) {
    confirmDeactivateBtn.addEventListener("click", async () => {
      if (!vehicleToDeactivate) return;
      confirmDeactivateBtn.disabled = true;

      const { error } = await client
        .from("vehicle_models")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("id", vehicleToDeactivate.id);

      confirmDeactivateBtn.disabled = false;
      deactivateModal.close();

      if (error) {
        alert(`Error al desactivar el modelo: ${error.message}`);
        return;
      }

      showAlert(`Modelo ${vehicleToDeactivate.make} ${vehicleToDeactivate.model} desactivado (conservando historial).`, "warning");
      vehicleToDeactivate = null;
      await loadFleet();
    });
  }

  // Inicializar
  await loadCategories();
  await loadFleet();
});
