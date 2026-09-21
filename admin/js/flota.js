// Lógica del panel administrativo de flota (/admin/flota)
// Hardening XSS: toda la creación de nodos usa createElement y textContent

document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.AGM_AUTH;
  if (!auth) return;

  // 1. Validar autenticación y personal activo
  const staffInfo = await auth.requireActiveStaff();
  if (!staffInfo) return;

  const client = auth.client;
  const user = staffInfo.user;
  const profile = staffInfo.profile;

  // Renderizar información del usuario en navbar de forma segura
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

  // Pestañas de idioma en Modal
  const tabBtns = document.querySelectorAll(".lang-tab");
  const tabBadgeEs = document.getElementById("tabBadgeEs");
  const tabBadgeEn = document.getElementById("tabBadgeEn");
  const tabBadgePt = document.getElementById("tabBadgePt");
  const labelLocaleTagDisplayName = document.getElementById("labelLocaleTagDisplayName");
  const labelLocaleTagCategoryName = document.getElementById("labelLocaleTagCategoryName");
  const labelLocaleTagShortDesc = document.getElementById("labelLocaleTagShortDesc");
  const labelLocaleTagDesc = document.getElementById("labelLocaleTagDesc");
  const localeHelpText = document.getElementById("localeHelpText");

  // Inputs del Modal
  const editVehicleId = document.getElementById("editVehicleId");
  const editMake = document.getElementById("editMake");
  const editModel = document.getElementById("editModel");
  const editCategory = document.getElementById("editCategory");
  const editSeats = document.getElementById("editSeats");
  const editLuggage = document.getElementById("editLuggage");
  const editTransmission = document.getElementById("editTransmission");
  const editDrivetrain = document.getElementById("editDrivetrain");
  const editFuelType = document.getElementById("editFuelType");
  const editAirConditioning = document.getElementById("editAirConditioning");
  const editSortOrder = document.getElementById("editSortOrder");
  const editActive = document.getElementById("editActive");

  const editDisplayName = document.getElementById("editDisplayName");
  const editCategoryName = document.getElementById("editCategoryName");
  const editShortDescription = document.getElementById("editShortDescription");
  const editDescription = document.getElementById("editDescription");
  const editSeoTitle = document.getElementById("editSeoTitle");
  const editMetaDescription = document.getElementById("editMetaDescription");

  // Modal de Desactivación
  const deactivateModal = document.getElementById("deactivateModal");
  const deactivateModelName = document.getElementById("deactivateModelName");
  const cancelDeactivateBtn = document.getElementById("cancelDeactivateBtn");
  const confirmDeactivateBtn = document.getElementById("confirmDeactivateBtn");

  let categories = [];
  let fleetModels = [];
  let currentEditingVehicle = null;
  let currentLocale = "es";
  let vehicleToDeactivate = null;

  const showAlert = (msg, type = "success") => {
    fleetAlert.textContent = msg;
    fleetAlert.className = `alert alert-${type}`;
    fleetAlert.style.display = "block";
    setTimeout(() => {
      fleetAlert.style.display = "none";
    }, 4500);
  };

  // Helper para textos y estilos de estado de traducción
  const getTransBadgeInfo = (status) => {
    if (status === "original") return { label: "✓ Original", css: "trans-original" };
    if (status === "reviewed") return { label: "✓ Revisado", css: "trans-reviewed" };
    if (status === "translated") return { label: "✓ Traducido", css: "trans-translated" };
    if (status === "stale") return { label: "⚠ Desactualizado", css: "trans-stale" };
    if (status === "failed") return { label: "✕ Error", css: "trans-failed" };
    return { label: "○ Pendiente", css: "trans-pending" };
  };

  // Cargar categorías
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

    if (editCategory) {
      editCategory.innerHTML = "";
      categories.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        editCategory.appendChild(opt);
      });
    }
  };

  // Cargar flota completa con traducciones
  const loadFleet = async () => {
    fleetGrid.innerHTML = "";
    const loadingEl = document.createElement("div");
    loadingEl.className = "empty-state";
    loadingEl.textContent = "Cargando catálogo de flota...";
    fleetGrid.appendChild(loadingEl);

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
      fleetGrid.innerHTML = "";
      const errEl = document.createElement("div");
      errEl.className = "alert alert-danger";
      errEl.textContent = "Error al cargar el catálogo de flota.";
      errEl.style.display = "block";
      fleetGrid.appendChild(errEl);
      return;
    }

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

  // Renderizar tarjetas de vehículos de forma segura (Hardening XSS: createElement + textContent)
  const renderFleet = () => {
    fleetGrid.innerHTML = "";

    let activeCount = 0;
    let inactiveCount = 0;

    fleetModels.forEach((m) => {
      if (m.active) activeCount++;
      else inactiveCount++;
    });

    if (activeCountEl) activeCountEl.textContent = `${activeCount} Activos`;
    if (inactiveCountEl) inactiveCountEl.textContent = `${inactiveCount} Inactivos`;

    if (fleetModels.length === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "empty-state";
      emptyEl.textContent = "No hay vehículos registrados en el catálogo.";
      fleetGrid.appendChild(emptyEl);
      return;
    }

    fleetModels.forEach((vm) => {
      const esTrans = vm.translations["es"] || {};
      const enTrans = vm.translations["en"] || {};
      const ptTrans = vm.translations["pt"] || {};

      const displayNameText = esTrans.display_name || vm.display_name || `${vm.make} ${vm.model}`;
      const categoryNameText = esTrans.category_name || vm.vehicle_categories?.name || "Sin categoría";
      const descText = esTrans.description || vm.description || "Sin descripción.";

      // Crear tarjeta contenedora
      const card = document.createElement("div");
      card.className = `vehicle-card ${vm.active ? "" : "inactive"}`;
      card.dataset.id = vm.id;

      // Imagen
      const imgWrap = document.createElement("div");
      imgWrap.className = "vehicle-card-img-wrap";

      if (vm.image_url) {
        const img = document.createElement("img");
        img.src = `../../${vm.image_url}`;
        img.alt = displayNameText;
        img.className = "vehicle-card-img";
        imgWrap.appendChild(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "vehicle-card-img-placeholder";
        placeholder.textContent = "Sin imagen";
        imgWrap.appendChild(placeholder);
      }

      const statusBadge = document.createElement("span");
      statusBadge.className = `vehicle-card-status-badge ${vm.active ? "status-active" : "status-inactive"}`;
      statusBadge.textContent = vm.active ? "Activo" : "Inactivo";
      imgWrap.appendChild(statusBadge);

      card.appendChild(imgWrap);

      // Cuerpo de la tarjeta
      const cardBody = document.createElement("div");
      cardBody.className = "vehicle-card-body";

      const catEl = document.createElement("div");
      catEl.className = "vehicle-card-category";
      catEl.textContent = categoryNameText;
      cardBody.appendChild(catEl);

      const titleEl = document.createElement("h3");
      titleEl.className = "vehicle-card-title";
      titleEl.textContent = displayNameText;
      cardBody.appendChild(titleEl);

      const descEl = document.createElement("p");
      descEl.className = "vehicle-card-desc";
      descEl.textContent = descText;
      cardBody.appendChild(descEl);

      // Especificaciones técnicas
      const specsGrid = document.createElement("div");
      specsGrid.className = "vehicle-specs-grid";

      const addSpec = (label, val, unconfirmed = false) => {
        const item = document.createElement("div");
        item.className = "spec-item";
        const l = document.createElement("span");
        l.className = "spec-label";
        l.textContent = label;
        const v = document.createElement("span");
        v.className = `spec-value ${unconfirmed ? "unconfirmed" : ""}`;
        v.textContent = val;
        item.appendChild(l);
        item.appendChild(v);
        specsGrid.appendChild(item);
      };

      addSpec("Pasajeros", `${vm.seats} Pers.`);
      addSpec("Equipaje", `${vm.luggage_capacity} Maletas`);
      addSpec("Transmisión", vm.transmission === "automatic" ? "Automática" : "Manual");
      addSpec("Tracción", vm.drivetrain ? vm.drivetrain : "Sin confirmar", !vm.drivetrain);
      addSpec("Combustible", vm.fuel_type ? vm.fuel_type : "Sin confirmar", !vm.fuel_type);
      addSpec("A/C", vm.air_conditioning ? "Sí" : "No");

      cardBody.appendChild(specsGrid);

      // Semáforo de traducciones
      const transStatuses = document.createElement("div");
      transStatuses.className = "translation-statuses";

      const addTransTag = (locale, trans) => {
        const info = getTransBadgeInfo(trans.translation_status);
        const tag = document.createElement("span");
        tag.className = `trans-tag ${info.css}`;
        tag.textContent = `${locale.toUpperCase()} ${info.label}`;
        transStatuses.appendChild(tag);
      };

      addTransTag("es", esTrans);
      addTransTag("en", enTrans);
      addTransTag("pt", ptTrans);

      cardBody.appendChild(transStatuses);

      // Acciones
      const actions = document.createElement("div");
      actions.className = "vehicle-card-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-sm btn-primary btn-edit";
      editBtn.dataset.id = vm.id;
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", () => openEditModal(vm.id));

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = `btn btn-sm ${vm.active ? "btn-danger-outline" : "btn-outline"} btn-toggle-active`;
      toggleBtn.dataset.id = vm.id;
      toggleBtn.textContent = vm.active ? "Desactivar" : "Activar";
      toggleBtn.addEventListener("click", () => handleToggleActive(vm));

      actions.appendChild(editBtn);
      actions.appendChild(toggleBtn);
      cardBody.appendChild(actions);

      card.appendChild(cardBody);
      fleetGrid.appendChild(card);
    });
  };

  // Cargar datos de la traducción en los inputs de contenido
  const populateLocaleFields = (locale) => {
    currentLocale = locale;

    // Actualizar tabs visuales
    tabBtns.forEach((btn) => {
      const isCurrent = btn.dataset.locale === locale;
      btn.classList.toggle("active", isCurrent);
      btn.setAttribute("aria-selected", isCurrent ? "true" : "false");
    });

    const trans = currentEditingVehicle?.translations[locale] || {};

    editDisplayName.value = trans.display_name || "";
    editCategoryName.value = trans.category_name || "";
    editShortDescription.value = trans.short_description || "";
    editDescription.value = trans.description || "";
    editSeoTitle.value = trans.seo_title || "";
    editMetaDescription.value = trans.meta_description || "";

    const tagText = `(${locale.toUpperCase()})`;
    if (labelLocaleTagDisplayName) labelLocaleTagDisplayName.textContent = tagText;
    if (labelLocaleTagCategoryName) labelLocaleTagCategoryName.textContent = tagText;
    if (labelLocaleTagShortDesc) labelLocaleTagShortDesc.textContent = tagText;
    if (labelLocaleTagDesc) labelLocaleTagDesc.textContent = tagText;

    if (localeHelpText) {
      if (locale === "es") {
        localeHelpText.textContent = "El contenido en español es la fuente maestra. Al guardarlo, las traducciones en inglés y portugués pasarán automáticamente al estado stale (desactualizado).";
      } else {
        localeHelpText.textContent = "Traducción manual. Para marcarla como revisada (reviewed) debe tener al menos Nombre y Descripción. Si se vacía por completo volverá al estado pending.";
      }
    }
  };

  // Actualizar badges en los tabs del modal
  const updateModalTabBadges = () => {
    if (!currentEditingVehicle) return;

    const esTrans = currentEditingVehicle.translations["es"] || {};
    const enTrans = currentEditingVehicle.translations["en"] || {};
    const ptTrans = currentEditingVehicle.translations["pt"] || {};

    if (tabBadgeEs) tabBadgeEs.textContent = getTransBadgeInfo(esTrans.translation_status || "original").label;
    if (tabBadgeEn) tabBadgeEn.textContent = getTransBadgeInfo(enTrans.translation_status || "pending").label;
    if (tabBadgePt) tabBadgePt.textContent = getTransBadgeInfo(ptTrans.translation_status || "pending").label;
  };

  // Abrir modal de edición
  const openEditModal = (vehicleId) => {
    const vm = fleetModels.find((m) => m.id === vehicleId);
    if (!vm) return;

    currentEditingVehicle = vm;
    editVehicleId.value = vm.id;

    // Sección 1: Datos Técnicos
    editMake.value = vm.make || "";
    editModel.value = vm.model || "";
    if (editCategory) editCategory.value = vm.category_id || "";
    editSeats.value = vm.seats || 5;
    editLuggage.value = vm.luggage_capacity || 2;
    editTransmission.value = vm.transmission || "automatic";
    editDrivetrain.value = vm.drivetrain || "";
    editFuelType.value = vm.fuel_type || "";
    editAirConditioning.checked = Boolean(vm.air_conditioning);
    editSortOrder.value = vm.sort_order ?? 100;
    editActive.checked = Boolean(vm.active);

    // Sección 2: Contenido Multilingüe
    updateModalTabBadges();
    populateLocaleFields("es");

    if (typeof editModal.showModal === "function") {
      editModal.showModal();
    }
  };

  // Event listeners para tabs de idioma
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const locale = btn.dataset.locale;
      populateLocaleFields(locale);
    });
  });

  // Guardar formulario del modal
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentEditingVehicle) return;

    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando...";

    try {
      if (currentLocale === "es") {
        // Guardar datos técnicos + ES maestro mediante RPC atómico admin_save_vehicle_model
        const { error } = await client.rpc("admin_save_vehicle_model", {
          p_vehicle_model_id: currentEditingVehicle.id,
          p_display_name: editDisplayName.value.trim(),
          p_category_name: editCategoryName.value.trim() || null,
          p_short_description: editShortDescription.value.trim() || null,
          p_description: editDescription.value.trim() || null,
          p_seo_title: editSeoTitle.value.trim() || null,
          p_meta_description: editMetaDescription.value.trim() || null,
          p_category_id: parseInt(editCategory.value, 10),
          p_transmission: editTransmission.value,
          p_drivetrain: editDrivetrain.value || null,
          p_fuel_type: editFuelType.value || null,
          p_seats: parseInt(editSeats.value, 10),
          p_luggage_capacity: parseInt(editLuggage.value, 10),
          p_air_conditioning: editAirConditioning.checked,
          p_sort_order: parseInt(editSortOrder.value, 10) || 100,
          p_active: editActive.checked,
        });

        if (error) throw error;
        showAlert("Datos técnicos y contenido maestro en español guardados con éxito.");
      } else {
        // Guardar traducción manual (EN o PT) mediante RPC admin_save_vehicle_translation
        const { error } = await client.rpc("admin_save_vehicle_translation", {
          p_vehicle_model_id: currentEditingVehicle.id,
          p_locale: currentLocale,
          p_display_name: editDisplayName.value.trim() || null,
          p_category_name: editCategoryName.value.trim() || null,
          p_short_description: editShortDescription.value.trim() || null,
          p_description: editDescription.value.trim() || null,
          p_seo_title: editSeoTitle.value.trim() || null,
          p_meta_description: editMetaDescription.value.trim() || null,
        });

        if (error) throw error;
        showAlert(`Traducción en ${currentLocale.toUpperCase()} guardada con éxito.`);
      }

      // Recargar catálogo y actualizar el vehículo actual en el modal
      await loadFleet();
      const updatedVm = fleetModels.find((m) => m.id === currentEditingVehicle.id);
      if (updatedVm) {
        currentEditingVehicle = updatedVm;
        updateModalTabBadges();
        populateLocaleFields(currentLocale);
      }
    } catch (err) {
      console.error("Error al guardar vehículo:", err);
      showAlert(`Error: ${err.message || "No se pudo guardar"}`, "danger");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Guardar Cambios";
    }
  });

  // Cerrar modal
  const closeModal = () => {
    if (editModal.open) editModal.close();
    currentEditingVehicle = null;
  };

  closeModalBtn.addEventListener("click", closeModal);
  cancelEditBtn.addEventListener("click", closeModal);

  // Desactivar / Activar vehículo
  const handleToggleActive = async (vm) => {
    if (vm.active) {
      vehicleToDeactivate = vm;
      deactivateModelName.textContent = vm.display_name || `${vm.make} ${vm.model}`;
      if (typeof deactivateModal.showModal === "function") {
        deactivateModal.showModal();
      }
    } else {
      // Activar directamente
      const { error } = await client
        .from("vehicle_models")
        .update({ active: true, updated_at: new Date().toISOString() })
        .eq("id", vm.id);

      if (error) {
        console.error("Error al activar:", error);
        showAlert("Error al activar el modelo.", "danger");
      } else {
        showAlert(`Modelo ${vm.make} ${vm.model} activado.`);
        await loadFleet();
      }
    }
  };

  confirmDeactivateBtn.addEventListener("click", async () => {
    if (!vehicleToDeactivate) return;

    confirmDeactivateBtn.disabled = true;
    const { error } = await client
      .from("vehicle_models")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", vehicleToDeactivate.id);

    confirmDeactivateBtn.disabled = false;

    if (error) {
      console.error("Error al desactivar:", error);
      showAlert("Error al desactivar el modelo.", "danger");
    } else {
      showAlert(`Modelo ${vehicleToDeactivate.make} ${vehicleToDeactivate.model} desactivado.`);
      deactivateModal.close();
      vehicleToDeactivate = null;
      await loadFleet();
    }
  });

  cancelDeactivateBtn.addEventListener("click", () => {
    deactivateModal.close();
    vehicleToDeactivate = null;
  });

  // Inicializar
  await loadCategories();
  await loadFleet();
});
