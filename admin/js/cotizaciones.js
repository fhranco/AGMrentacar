// Lógica del panel administrativo de cotizaciones y leads (/admin/cotizaciones)
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

  // Elementos DOM principales
  const tableBody = document.getElementById("quotesTableBody");
  const metricTotal = document.getElementById("metricTotal");
  const metricRequested = document.getElementById("metricRequested");
  const metricReviewing = document.getElementById("metricReviewing");
  const metricConfirmed = document.getElementById("metricConfirmed");
  const quotesAlert = document.getElementById("quotesAlert");
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const refreshBtn = document.getElementById("refreshBtn");

  // Elementos del Modal
  const modal = document.getElementById("quoteDetailModal");
  const modalAlert = document.getElementById("modalAlert");
  const modalForm = document.getElementById("quoteDetailForm");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const cancelDetailBtn = document.getElementById("cancelDetailBtn");
  const saveDetailBtn = document.getElementById("saveDetailBtn");

  // Campos del Modal (Lectura)
  const detailReservationId = document.getElementById("detailReservationId");
  const detailCustomerName = document.getElementById("detailCustomerName");
  const detailCustomerType = document.getElementById("detailCustomerType");
  const detailCustomerEmail = document.getElementById("detailCustomerEmail");
  const detailCustomerPhone = document.getElementById("detailCustomerPhone");
  const detailCompanyWrap = document.getElementById("detailCompanyWrap");
  const detailCompanyName = document.getElementById("detailCompanyName");
  const detailCompanyTaxId = document.getElementById("detailCompanyTaxId");
  const detailPickupLocation = document.getElementById("detailPickupLocation");
  const detailPickupDatetime = document.getElementById("detailPickupDatetime");
  const detailReturnLocation = document.getElementById("detailReturnLocation");
  const detailReturnDatetime = document.getElementById("detailReturnDatetime");
  const detailDuration = document.getElementById("detailDuration");
  const detailVehicleModel = document.getElementById("detailVehicleModel");
  const detailCustomerNotes = document.getElementById("detailCustomerNotes");

  // Campos del Modal (Edición)
  const detailStatus = document.getElementById("detailStatus");
  const detailQuotedClp = document.getElementById("detailQuotedClp");
  const detailInternalNotes = document.getElementById("detailInternalNotes");

  // Estado local en memoria
  let reservationsData = [];
  let customersMap = new Map();
  let locationsMap = new Map();
  let vehicleModelsMap = new Map();

  const showAlert = (el, msg, type = "danger") => {
    if (!el) return;
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.style.display = "block";
  };

  const hideAlert = (el) => {
    if (!el) return;
    el.textContent = "";
    el.style.display = "none";
  };

  // Formateadores
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat("es-CL", {
        timeZone: "America/Punta_Arenas",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const calculateDays = (pickupStr, returnStr) => {
    try {
      const p = new Date(pickupStr).getTime();
      const r = new Date(returnStr).getTime();
      if (Number.isNaN(p) || Number.isNaN(r) || r <= p) return 1;
      const diffMs = r - p;
      const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return Math.max(1, days);
    } catch {
      return 1;
    }
  };

  const formatCurrency = (val) => {
    if (val === null || val === undefined || val === "") return "Sin cotizar";
    const num = Number(val);
    if (Number.isNaN(num)) return "Sin cotizar";
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case "requested":
        return { label: "Solicitada", css: "res-status-requested" };
      case "reviewing":
        return { label: "En revisión", css: "res-status-reviewing" };
      case "quoted":
        return { label: "Cotizada", css: "res-status-quoted" };
      case "confirmed":
        return { label: "Confirmada", css: "res-status-confirmed" };
      case "rejected":
        return { label: "Rechazada", css: "res-status-rejected" };
      case "completed":
        return { label: "Finalizada", css: "res-status-completed" };
      case "cancelled":
        return { label: "Cancelada", css: "res-status-cancelled" };
      default:
        return { label: status || "Pendiente", css: "res-status-requested" };
    }
  };

  const getCustomerTypeLabel = (type) => {
    switch (type) {
      case "tourism":
        return "Turismo";
      case "business":
        return "Empresa";
      case "mining":
        return "Minería";
      default:
        return type || "Particular";
    }
  };

  const cleanPhoneForWhatsApp = (rawPhone) => {
    if (!rawPhone) return "";
    let clean = rawPhone.replace(/\D/g, "");
    if (clean.length === 9 && clean.startsWith("9")) {
      clean = "56" + clean;
    } else if (clean.length === 8) {
      clean = "569" + clean;
    }
    return clean;
  };

  // Cargar datos desde Supabase
  const loadData = async () => {
    hideAlert(quotesAlert);
    tableBody.innerHTML = "";

    const loadingTr = document.createElement("tr");
    const loadingTd = document.createElement("td");
    loadingTd.colSpan = 7;
    loadingTd.className = "empty-state";
    loadingTd.textContent = "Cargando cotizaciones y leads...";
    loadingTr.appendChild(loadingTd);
    tableBody.appendChild(loadingTr);

    try {
      const [resRes, custRes, locRes, modRes] = await Promise.all([
        client
          .from("reservations")
          .select("*")
          .order("created_at", { ascending: false }),
        client
          .from("customers")
          .select("id, full_name, email, phone, tax_id"),
        client
          .from("locations")
          .select("id, name, slug"),
        client
          .from("vehicle_models")
          .select("id, name"),
      ]);

      if (resRes.error) throw resRes.error;

      reservationsData = resRes.data || [];

      customersMap = new Map(
        (custRes.data || []).map((c) => [c.id, c]),
      );
      locationsMap = new Map(
        (locRes.data || []).map((l) => [l.id, l.name]),
      );
      vehicleModelsMap = new Map(
        (modRes.data || []).map((m) => [m.id, m.name]),
      );

      updateMetrics();
      renderTable();
    } catch (err) {
      console.error("Error al cargar cotizaciones:", err);
      showAlert(
        quotesAlert,
        "Error al conectar con la base de datos de cotizaciones: " + (err.message || "Revisa la conexión."),
      );
      tableBody.innerHTML = "";
      const errTr = document.createElement("tr");
      const errTd = document.createElement("td");
      errTd.colSpan = 7;
      errTd.className = "empty-state";
      errTd.textContent = "No se pudieron cargar las cotizaciones.";
      errTr.appendChild(errTd);
      tableBody.appendChild(errTr);
    }
  };

  // Actualizar métricas
  const updateMetrics = () => {
    const total = reservationsData.length;
    const requested = reservationsData.filter((r) => r.status === "requested").length;
    const reviewing = reservationsData.filter((r) => r.status === "reviewing" || r.status === "quoted").length;
    const confirmed = reservationsData.filter((r) => r.status === "confirmed").length;

    if (metricTotal) metricTotal.textContent = `${total} Solicitudes`;
    if (metricRequested) metricRequested.textContent = `${requested} Nuevas`;
    if (metricReviewing) metricReviewing.textContent = `${reviewing} En Revisión`;
    if (metricConfirmed) metricConfirmed.textContent = `${confirmed} Confirmadas`;
  };

  // Filtrar lista
  const getFilteredReservations = () => {
    const term = (searchInput?.value || "").toLowerCase().trim();
    const statusVal = statusFilter?.value || "all";

    return reservationsData.filter((item) => {
      // Filtro de estado
      if (statusVal !== "all" && item.status !== statusVal) {
        return false;
      }

      // Filtro de búsqueda
      if (!term) return true;

      const customer = customersMap.get(item.customer_id);
      const refCode = (item.reference_code || "").toLowerCase();
      const clientName = (customer?.full_name || "").toLowerCase();
      const clientEmail = (customer?.email || "").toLowerCase();
      const clientPhone = (customer?.phone || "").toLowerCase();
      const company = (item.company_name || "").toLowerCase();
      const notes = (item.customer_notes || "").toLowerCase();

      return (
        refCode.includes(term) ||
        clientName.includes(term) ||
        clientEmail.includes(term) ||
        clientPhone.includes(term) ||
        company.includes(term) ||
        notes.includes(term)
      );
    });
  };

  // Renderizar tabla
  const renderTable = () => {
    tableBody.innerHTML = "";
    const filtered = getFilteredReservations();

    if (filtered.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
      td.className = "empty-state";
      td.textContent = "No se encontraron cotizaciones con los filtros aplicados.";
      tr.appendChild(td);
      tableBody.appendChild(tr);
      return;
    }

    filtered.forEach((res) => {
      const customer = customersMap.get(res.customer_id);
      const tr = document.createElement("tr");

      // 1. Columna Código / Fecha
      const tdCode = document.createElement("td");
      const codeSpan = document.createElement("div");
      codeSpan.className = "blog-post-title";
      codeSpan.textContent = res.reference_code || `AGM-#${res.id}`;
      const dateSpan = document.createElement("div");
      dateSpan.className = "blog-post-slug";
      dateSpan.textContent = formatDate(res.created_at);
      tdCode.appendChild(codeSpan);
      tdCode.appendChild(dateSpan);
      tr.appendChild(tdCode);

      // 2. Columna Cliente / Contacto
      const tdCustomer = document.createElement("td");
      const nameDiv = document.createElement("div");
      nameDiv.style.fontWeight = "600";
      nameDiv.textContent = customer?.full_name || "Cliente sin nombre";

      const typeBadge = document.createElement("span");
      typeBadge.className = "customer-type-badge";
      typeBadge.textContent = getCustomerTypeLabel(res.customer_type);
      nameDiv.appendChild(document.createTextNode(" "));
      nameDiv.appendChild(typeBadge);

      const contactActions = document.createElement("div");
      contactActions.className = "quick-contact-actions";

      // Botón WhatsApp si tiene teléfono
      if (customer?.phone) {
        const waNumber = cleanPhoneForWhatsApp(customer.phone);
        if (waNumber) {
          const waLink = document.createElement("a");
          waLink.href = `https://wa.me/${waNumber}`;
          waLink.target = "_blank";
          waLink.rel = "noopener noreferrer";
          waLink.className = "contact-chip contact-chip-wa";
          waLink.title = "Abrir WhatsApp con el cliente";
          waLink.textContent = "💬 " + customer.phone;
          contactActions.appendChild(waLink);
        } else {
          const phoneLink = document.createElement("a");
          phoneLink.href = `tel:${customer.phone}`;
          phoneLink.className = "contact-chip contact-chip-phone";
          phoneLink.textContent = "📞 " + customer.phone;
          contactActions.appendChild(phoneLink);
        }
      }

      if (customer?.email) {
        const emailLink = document.createElement("a");
        emailLink.href = `mailto:${customer.email}?subject=Cotizaci%C3%B3n%20AGM%20Rent%20a%20Car%20-${encodeURIComponent(res.reference_code || "")}`;
        emailLink.className = "contact-chip contact-chip-email";
        emailLink.title = "Enviar correo formal";
        emailLink.textContent = "✉ " + customer.email;
        contactActions.appendChild(emailLink);
      }

      tdCustomer.appendChild(nameDiv);
      tdCustomer.appendChild(contactActions);
      tr.appendChild(tdCustomer);

      // 3. Columna Arriendo / Fechas
      const tdDates = document.createElement("td");
      const daysCount = calculateDays(res.pickup_at, res.return_at);
      const durationBadge = document.createElement("strong");
      durationBadge.textContent = `${daysCount} ${daysCount === 1 ? "día" : "días"}`;

      const dateDetail = document.createElement("div");
      dateDetail.className = "form-help";
      dateDetail.textContent = `${formatDate(res.pickup_at)} → ${formatDate(res.return_at)}`;

      tdDates.appendChild(durationBadge);
      tdDates.appendChild(dateDetail);
      tr.appendChild(tdDates);

      // 4. Columna Sucursales
      const tdLocations = document.createElement("td");
      const pickupLoc = locationsMap.get(res.pickup_location_id) || "Punta Arenas";
      const returnLoc = locationsMap.get(res.return_location_id) || pickupLoc;

      const locText = document.createElement("div");
      locText.style.fontSize = "0.8125rem";
      if (pickupLoc === returnLoc) {
        locText.textContent = pickupLoc;
      } else {
        locText.textContent = `${pickupLoc} ➔ ${returnLoc}`;
      }
      tdLocations.appendChild(locText);
      tr.appendChild(tdLocations);

      // 5. Columna Estado
      const tdStatus = document.createElement("td");
      const statusInfo = getStatusInfo(res.status);
      const statusBadge = document.createElement("span");
      statusBadge.className = `res-status-badge ${statusInfo.css}`;
      statusBadge.textContent = statusInfo.label;
      tdStatus.appendChild(statusBadge);

      // Selector de cambio rápido de estado directamente en la tabla
      const quickSelect = document.createElement("select");
      quickSelect.className = "filter-select";
      quickSelect.style.padding = "0.2rem 0.4rem";
      quickSelect.style.fontSize = "0.75rem";
      quickSelect.style.borderRadius = "4px";
      quickSelect.style.border = "1px solid var(--color-slate-300)";
      quickSelect.style.marginTop = "0.35rem";
      quickSelect.style.display = "block";
      quickSelect.title = "Cambiar estado rápidamente";

      const quickOptions = [
        { val: "requested", text: "Solicitada" },
        { val: "reviewing", text: "En revisión" },
        { val: "quoted", text: "Cotizada" },
        { val: "rejected", text: "Rechazada" },
        { val: "cancelled", text: "Cancelada" },
      ];

      quickOptions.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.val;
        o.textContent = opt.text;
        if (res.status === opt.val) o.selected = true;
        quickSelect.appendChild(o);
      });

      quickSelect.addEventListener("change", async (e) => {
        const newSt = e.target.value;
        const prevSt = res.status;
        quickSelect.disabled = true;
        try {
          const updatePayload = {
            status: newSt,
            updated_at: new Date().toISOString(),
          };
          if (newSt === "quoted" && !res.quoted_at) {
            updatePayload.quoted_at = new Date().toISOString();
          }

          const { error } = await client
            .from("reservations")
            .update(updatePayload)
            .eq("id", res.id);

          if (error) throw error;

          res.status = newSt;
          res.updated_at = updatePayload.updated_at;
          updateMetrics();
          renderTable();
          showAlert(
            quotesAlert,
            `Cotización ${res.reference_code || `#${res.id}`} actualizada a "${getStatusInfo(newSt).label}".`,
            "success",
          );
          setTimeout(() => hideAlert(quotesAlert), 4000);
        } catch (err) {
          console.error("Error al cambiar estado rápido:", err);
          e.target.value = prevSt;
          showAlert(quotesAlert, "Error al actualizar estado: " + (err.message || "Intenta nuevamente."));
        } finally {
          quickSelect.disabled = false;
        }
      });

      tdStatus.appendChild(quickSelect);
      tr.appendChild(tdStatus);

      // 6. Columna Monto Cotizado
      const tdAmount = document.createElement("td");
      tdAmount.style.fontWeight = "600";
      tdAmount.textContent = formatCurrency(res.quoted_total_clp);
      tr.appendChild(tdAmount);

      // 7. Columna Acciones
      const tdActions = document.createElement("td");
      const detailBtn = document.createElement("button");
      detailBtn.type = "button";
      detailBtn.className = "btn btn-sm btn-outline";
      detailBtn.textContent = "Ver Detalle";
      detailBtn.addEventListener("click", () => openDetailModal(res));
      tdActions.appendChild(detailBtn);
      tr.appendChild(tdActions);

      tableBody.appendChild(tr);
    });
  };

  // Abrir Modal de Detalle
  const openDetailModal = (res) => {
    hideAlert(modalAlert);
    const customer = customersMap.get(res.customer_id);

    detailReservationId.value = res.id;
    document.getElementById("modalTitle").textContent = `Cotización ${res.reference_code || `#${res.id}`}`;

    // Datos del cliente
    detailCustomerName.textContent = customer?.full_name || "-";
    detailCustomerType.textContent = getCustomerTypeLabel(res.customer_type);

    // Email con link
    detailCustomerEmail.innerHTML = "";
    if (customer?.email) {
      const emailA = document.createElement("a");
      emailA.href = `mailto:${customer.email}?subject=Cotizaci%C3%B3n%20AGM%20Rent%20a%20Car%20-${encodeURIComponent(res.reference_code || "")}`;
      emailA.className = "contact-chip contact-chip-email";
      emailA.textContent = "✉ " + customer.email;
      detailCustomerEmail.appendChild(emailA);
    } else {
      detailCustomerEmail.textContent = "-";
    }

    // Teléfono con links
    detailCustomerPhone.innerHTML = "";
    if (customer?.phone) {
      const waNumber = cleanPhoneForWhatsApp(customer.phone);
      if (waNumber) {
        const waA = document.createElement("a");
        waA.href = `https://wa.me/${waNumber}`;
        waA.target = "_blank";
        waA.rel = "noopener noreferrer";
        waA.className = "contact-chip contact-chip-wa";
        waA.textContent = "💬 WhatsApp (" + customer.phone + ")";
        detailCustomerPhone.appendChild(waA);
      } else {
        const phoneA = document.createElement("a");
        phoneA.href = `tel:${customer.phone}`;
        phoneA.className = "contact-chip contact-chip-phone";
        phoneA.textContent = "📞 " + customer.phone;
        detailCustomerPhone.appendChild(phoneA);
      }
    } else {
      detailCustomerPhone.textContent = "-";
    }

    // Empresa
    if (res.customer_type === "business" || res.company_name || res.company_tax_id) {
      detailCompanyWrap.style.display = "block";
      detailCompanyName.textContent = res.company_name || customer?.full_name || "-";
      detailCompanyTaxId.textContent = res.company_tax_id || customer?.tax_id || "-";
    } else {
      detailCompanyWrap.style.display = "none";
    }

    // Itinerario
    detailPickupLocation.textContent = locationsMap.get(res.pickup_location_id) || "Punta Arenas";
    detailPickupDatetime.textContent = formatDate(res.pickup_at);
    detailReturnLocation.textContent = locationsMap.get(res.return_location_id) || locationsMap.get(res.pickup_location_id) || "Punta Arenas";
    detailReturnDatetime.textContent = formatDate(res.return_at);

    const days = calculateDays(res.pickup_at, res.return_at);
    detailDuration.textContent = `${days} ${days === 1 ? "día corrido" : "días corridos"}`;

    const modelName = vehicleModelsMap.get(res.requested_model_id);
    detailVehicleModel.textContent = modelName || "Cualquier modelo disponible / Categoría abierta";

    // Notas del cliente
    if (res.customer_notes && res.customer_notes.trim()) {
      detailCustomerNotes.textContent = res.customer_notes.trim();
      detailCustomerNotes.style.fontStyle = "normal";
      detailCustomerNotes.style.color = "#78350f";
    } else {
      detailCustomerNotes.textContent = "El cliente no ingresó notas adicionales.";
      detailCustomerNotes.style.fontStyle = "italic";
      detailCustomerNotes.style.color = "var(--color-slate-500)";
    }

    // Gestión editable
    detailStatus.value = res.status || "requested";
    detailQuotedClp.value = res.quoted_total_clp !== null && res.quoted_total_clp !== undefined ? res.quoted_total_clp : "";
    detailInternalNotes.value = res.internal_notes || "";

    modal.showModal();
  };

  const closeModal = () => {
    modal.close();
  };

  if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
  if (cancelDetailBtn) cancelDetailBtn.addEventListener("click", closeModal);

  // Guardar cambios en la cotización
  if (modalForm) {
    modalForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideAlert(modalAlert);

      const reservationId = Number(detailReservationId.value);
      if (!reservationId) return;

      const newStatus = detailStatus.value;
      const quotedClpVal = detailQuotedClp.value.trim();
      const newQuotedClp = quotedClpVal !== "" ? Number(quotedClpVal) : null;
      const newInternalNotes = detailInternalNotes.value.trim() || null;

      const currentRes = reservationsData.find((r) => r.id === reservationId);
      if (newStatus === "confirmed" && !currentRes?.assigned_unit_id) {
        showAlert(
          modalAlert,
          "Para confirmar una reserva la base de datos de AGM exige asignar una patente física. Actualmente puedes gestionarla como 'En revisión', 'Cotizada' o 'Rechazada'.",
        );
        return;
      }

      saveDetailBtn.disabled = true;
      saveDetailBtn.textContent = "Guardando...";

      try {
        const updatePayload = {
          status: newStatus,
          quoted_total_clp: newQuotedClp,
          internal_notes: newInternalNotes,
          updated_at: new Date().toISOString(),
        };

        if (newStatus === "quoted" && !updatePayload.quoted_at) {
          updatePayload.quoted_at = new Date().toISOString();
        } else if (newStatus === "confirmed" && !updatePayload.confirmed_at) {
          updatePayload.confirmed_at = new Date().toISOString();
        }

        const { error } = await client
          .from("reservations")
          .update(updatePayload)
          .eq("id", reservationId);

        if (error) throw error;

        // Actualizar datos en memoria
        const idx = reservationsData.findIndex((r) => r.id === reservationId);
        if (idx !== -1) {
          reservationsData[idx] = {
            ...reservationsData[idx],
            ...updatePayload,
          };
        }

        updateMetrics();
        renderTable();
        closeModal();
        showAlert(
          quotesAlert,
          `Cotización ${currentRes?.reference_code || `#${reservationId}`} actualizada correctamente.`,
          "success",
        );
        setTimeout(() => hideAlert(quotesAlert), 4000);
      } catch (err) {
        console.error("Error al actualizar cotización:", err);
        const errorMsg =
          err.message && err.message.includes("check constraint")
            ? "No se puede aplicar este estado debido a las reglas de integridad de la reserva."
            : (err.message || "Intenta nuevamente.");
        showAlert(modalAlert, "Error al guardar los cambios: " + errorMsg);
      } finally {
        saveDetailBtn.disabled = false;
        saveDetailBtn.textContent = "Guardar Cambios";
      }
    });
  }

  // Búsqueda y filtros
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderTable();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener("change", () => {
      renderTable();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadData();
    });
  }

  // Inicializar
  await loadData();
});
