// Lógica del panel administrativo de blog (/admin/blog)
// Hardening XSS: toda la creación de nodos usa createElement y textContent
// Hotfix 3.1: Dirty tracking, metadata editable solo en ES y archivado sin tocar contenido

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
  const blogTableBody = document.getElementById("blogTableBody");
  const metricTotal = document.getElementById("metricTotal");
  const metricPublished = document.getElementById("metricPublished");
  const metricDraft = document.getElementById("metricDraft");
  const metricArchived = document.getElementById("metricArchived");
  const blogAlert = document.getElementById("blogAlert");
  const newPostBtn = document.getElementById("newPostBtn");

  // Elementos del Modal
  const blogModal = document.getElementById("blogModal");
  const modalTitle = document.getElementById("modalTitle");
  const blogForm = document.getElementById("blogForm");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const cancelBlogBtn = document.getElementById("cancelBlogBtn");
  const saveBlogBtn = document.getElementById("saveBlogBtn");

  // Inputs del Modal (Datos generales)
  const editBlogId = document.getElementById("editBlogId");
  const editSlug = document.getElementById("editSlug");
  const editStatus = document.getElementById("editStatus");
  const editFeaturedImagePath = document.getElementById("editFeaturedImagePath");
  const metaHelpText = document.getElementById("metaHelpText");

  const metaInputs = [editSlug, editStatus, editFeaturedImagePath];

  // Inputs del Modal (Contenido multilingüe)
  const editBlogTitle = document.getElementById("editBlogTitle");
  const editBlogExcerpt = document.getElementById("editBlogExcerpt");
  const editBlogContent = document.getElementById("editBlogContent");
  const editBlogSeoTitle = document.getElementById("editBlogSeoTitle");
  const editBlogMetaDescription = document.getElementById("editBlogMetaDescription");

  // Tabs de idioma
  const tabBtns = document.querySelectorAll(".lang-tab");
  const blogTabBadgeEs = document.getElementById("blogTabBadgeEs");
  const blogTabBadgeEn = document.getElementById("blogTabBadgeEn");
  const blogTabBadgePt = document.getElementById("blogTabBadgePt");
  const labelLocaleBlogTitle = document.getElementById("labelLocaleBlogTitle");
  const labelLocaleBlogExcerpt = document.getElementById("labelLocaleBlogExcerpt");
  const labelLocaleBlogContent = document.getElementById("labelLocaleBlogContent");
  const blogLocaleHelpText = document.getElementById("blogLocaleHelpText");

  // Modal de Archivado
  const archiveModal = document.getElementById("archiveModal");
  const archivePostTitle = document.getElementById("archivePostTitle");
  const cancelArchiveBtn = document.getElementById("cancelArchiveBtn");
  const confirmArchiveBtn = document.getElementById("confirmArchiveBtn");

  // Modal de Descarte de Cambios
  const discardModal = document.getElementById("discardModal");
  const keepEditingBtn = document.getElementById("keepEditingBtn");
  const confirmDiscardBtn = document.getElementById("confirmDiscardBtn");

  let blogPosts = [];
  let currentEditingPost = null;
  let currentLocale = "es";
  let isDirty = false;
  let postToArchive = null;
  let isSlugManuallyEdited = false;

  const showAlert = (msg, type = "success") => {
    blogAlert.textContent = msg;
    blogAlert.className = `alert alert-${type}`;
    blogAlert.style.display = "block";
    setTimeout(() => {
      blogAlert.style.display = "none";
    }, 4500);
  };

  const slugify = (text) => {
    return (text || "")
      .toString()
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const getTransBadgeInfo = (status) => {
    if (status === "original") return { label: "✓ Original", css: "trans-original" };
    if (status === "reviewed") return { label: "✓ Revisado", css: "trans-reviewed" };
    if (status === "translated") return { label: "✓ Traducido", css: "trans-translated" };
    if (status === "stale") return { label: "⚠ Desactualizado", css: "trans-stale" };
    if (status === "failed") return { label: "✕ Error", css: "trans-failed" };
    return { label: "○ Pendiente", css: "trans-pending" };
  };

  // Cargar artículos y traducciones
  const loadBlogPosts = async () => {
    blogTableBody.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "empty-state";
    td.textContent = "Cargando artículos del blog...";
    tr.appendChild(td);
    blogTableBody.appendChild(tr);

    const { data: posts, error: postsError } = await client
      .from("blog_posts")
      .select("id, slug, status, featured_image_path, author_id, published_at, created_at, updated_at")
      .order("id", { ascending: true });

    if (postsError) {
      console.error("Error cargando blog_posts:", postsError);
      blogTableBody.innerHTML = "";
      const errTr = document.createElement("tr");
      const errTd = document.createElement("td");
      errTd.colSpan = 6;
      errTd.className = "alert alert-danger";
      errTd.textContent = "Error al cargar los artículos del blog.";
      errTr.appendChild(errTd);
      blogTableBody.appendChild(errTr);
      return;
    }

    const { data: translations, error: transError } = await client
      .from("blog_post_translations")
      .select("*");

    if (transError) {
      console.error("Error cargando blog_post_translations:", transError);
    }

    const transMap = new Map();
    (translations || []).forEach((t) => {
      if (!transMap.has(t.blog_post_id)) {
        transMap.set(t.blog_post_id, {});
      }
      transMap.get(t.blog_post_id)[t.locale] = t;
    });

    blogPosts = (posts || []).map((p) => ({
      ...p,
      translations: transMap.get(p.id) || {},
    }));

    renderBlogList();
  };

  // Renderizar listado del blog de forma segura (Hardening XSS)
  const renderBlogList = () => {
    blogTableBody.innerHTML = "";

    let totalCount = blogPosts.length;
    let publishedCount = 0;
    let draftCount = 0;
    let archivedCount = 0;

    blogPosts.forEach((p) => {
      if (p.status === "published") publishedCount++;
      else if (p.status === "draft") draftCount++;
      else if (p.status === "archived") archivedCount++;
    });

    if (metricTotal) metricTotal.textContent = `${totalCount} Artículos`;
    if (metricPublished) metricPublished.textContent = `${publishedCount} Publicados`;
    if (metricDraft) metricDraft.textContent = `${draftCount} Borradores`;
    if (metricArchived) metricArchived.textContent = `${archivedCount} Archivados`;

    if (blogPosts.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.className = "empty-state";
      td.textContent = "No hay artículos registrados en el blog.";
      tr.appendChild(td);
      blogTableBody.appendChild(tr);
      return;
    }

    blogPosts.forEach((post) => {
      const esTrans = post.translations["es"] || {};
      const enTrans = post.translations["en"] || {};
      const ptTrans = post.translations["pt"] || {};

      const titleText = esTrans.title || "(Sin título en español)";
      const slugText = post.slug;

      const tr = document.createElement("tr");

      // 1. Título
      const tdTitle = document.createElement("td");
      const titleEl = document.createElement("div");
      titleEl.className = "blog-post-title";
      titleEl.textContent = titleText;
      tdTitle.appendChild(titleEl);
      tr.appendChild(tdTitle);

      // 2. Slug
      const tdSlug = document.createElement("td");
      const slugEl = document.createElement("span");
      slugEl.className = "blog-post-slug";
      slugEl.textContent = slugText;
      tdSlug.appendChild(slugEl);
      tr.appendChild(tdSlug);

      // 3. Estado
      const tdStatus = document.createElement("td");
      const statusBadge = document.createElement("span");
      statusBadge.className = `blog-status-badge status-${post.status}`;
      if (post.status === "published") statusBadge.textContent = "Publicado";
      else if (post.status === "draft") statusBadge.textContent = "Borrador";
      else if (post.status === "archived") statusBadge.textContent = "Archivado";
      else statusBadge.textContent = post.status;
      tdStatus.appendChild(statusBadge);
      tr.appendChild(tdStatus);

      // 4. Fecha Publicación
      const tdDate = document.createElement("td");
      if (post.published_at) {
        const d = new Date(post.published_at);
        tdDate.textContent = d.toLocaleDateString("es-CL", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } else {
        tdDate.textContent = "—";
      }
      tr.appendChild(tdDate);

      // 5. Idiomas
      const tdLangs = document.createElement("td");
      const transContainer = document.createElement("div");
      transContainer.className = "translation-statuses";

      const addBadge = (locale, trans) => {
        const info = getTransBadgeInfo(trans.translation_status);
        const tag = document.createElement("span");
        tag.className = `trans-tag ${info.css}`;
        tag.textContent = `${locale.toUpperCase()} ${info.label}`;
        transContainer.appendChild(tag);
      };

      addBadge("es", esTrans);
      addBadge("en", enTrans);
      addBadge("pt", ptTrans);

      tdLangs.appendChild(transContainer);
      tr.appendChild(tdLangs);

      // 6. Acciones
      const tdActions = document.createElement("td");
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "blog-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-sm btn-primary";
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", () => openEditModal(post.id));
      actionsDiv.appendChild(editBtn);

      if (post.status !== "archived") {
        const archiveBtn = document.createElement("button");
        archiveBtn.type = "button";
        archiveBtn.className = "btn btn-sm btn-danger-outline";
        archiveBtn.textContent = "Archivar";
        archiveBtn.addEventListener("click", () => openArchiveModal(post));
        actionsDiv.appendChild(archiveBtn);
      }

      tdActions.appendChild(actionsDiv);
      tr.appendChild(tdActions);

      blogTableBody.appendChild(tr);
    });
  };

  // Cargar datos de la traducción en los inputs de contenido
  const populateLocaleFields = (locale) => {
    currentLocale = locale;

    tabBtns.forEach((btn) => {
      const isCurrent = btn.dataset.locale === locale;
      btn.classList.toggle("active", isCurrent);
      btn.setAttribute("aria-selected", isCurrent ? "true" : "false");
    });

    const trans = currentEditingPost?.translations[locale] || {};

    editBlogTitle.value = trans.title || "";
    editBlogExcerpt.value = trans.excerpt || "";
    editBlogContent.value = trans.content || "";
    editBlogSeoTitle.value = trans.seo_title || "";
    editBlogMetaDescription.value = trans.meta_description || "";

    const tagText = `(${locale.toUpperCase()})`;
    if (labelLocaleBlogTitle) labelLocaleBlogTitle.textContent = tagText;
    if (labelLocaleBlogExcerpt) labelLocaleBlogExcerpt.textContent = tagText;
    if (labelLocaleBlogContent) labelLocaleBlogContent.textContent = tagText;

    // Regla Hotfix 3.1: Metadata general solo editable en ES
    if (locale === "es") {
      metaInputs.forEach((el) => {
        if (el) el.disabled = false;
      });
      if (metaHelpText) metaHelpText.textContent = "";
      if (blogLocaleHelpText) {
        blogLocaleHelpText.textContent = "El contenido en español es la fuente maestra. Al guardarlo, las versiones en inglés y portugués pasarán automáticamente al estado stale (desactualizado).";
      }
    } else {
      metaInputs.forEach((el) => {
        if (el) el.disabled = true;
      });
      if (metaHelpText) {
        metaHelpText.textContent = "Los datos generales del artículo se administran desde la pestaña Español.";
      }
      if (blogLocaleHelpText) {
        blogLocaleHelpText.textContent = "Traducción manual. Para marcarla como revisada (reviewed) debe tener al menos Título y Contenido. Si se vacía por completo volverá al estado pending.";
      }
    }
  };

  const updateModalTabBadges = () => {
    if (!currentEditingPost) {
      if (blogTabBadgeEs) blogTabBadgeEs.textContent = "Original";
      if (blogTabBadgeEn) blogTabBadgeEn.textContent = "Pendiente";
      if (blogTabBadgePt) blogTabBadgePt.textContent = "Pendiente";
      return;
    }

    const esTrans = currentEditingPost.translations["es"] || {};
    const enTrans = currentEditingPost.translations["en"] || {};
    const ptTrans = currentEditingPost.translations["pt"] || {};

    if (blogTabBadgeEs) blogTabBadgeEs.textContent = getTransBadgeInfo(esTrans.translation_status || "original").label;
    if (blogTabBadgeEn) blogTabBadgeEn.textContent = getTransBadgeInfo(enTrans.translation_status || "pending").label;
    if (blogTabBadgePt) blogTabBadgePt.textContent = getTransBadgeInfo(ptTrans.translation_status || "pending").label;
  };

  // Abrir modal para crear nuevo artículo
  const openNewPostModal = () => {
    currentEditingPost = null;
    isSlugManuallyEdited = false;
    isDirty = false;

    modalTitle.textContent = "Nuevo Artículo del Blog";
    editBlogId.value = "";
    editSlug.value = "";
    editStatus.value = "draft";
    editFeaturedImagePath.value = "";

    updateModalTabBadges();
    populateLocaleFields("es");

    if (typeof blogModal.showModal === "function") {
      blogModal.showModal();
    }
  };

  // Abrir modal para editar artículo existente
  const openEditModal = (postId) => {
    const post = blogPosts.find((p) => p.id === postId);
    if (!post) return;

    currentEditingPost = post;
    isSlugManuallyEdited = true;
    isDirty = false;

    modalTitle.textContent = "Editar Artículo del Blog";
    editBlogId.value = post.id;
    editSlug.value = post.slug;
    editStatus.value = post.status;
    editFeaturedImagePath.value = post.featured_image_path || "";

    updateModalTabBadges();
    populateLocaleFields("es");

    if (typeof blogModal.showModal === "function") {
      blogModal.showModal();
    }
  };

  // Auto-slugify solo al crear nuevo artículo si el usuario no editó el slug manualmente
  editBlogTitle.addEventListener("input", () => {
    if (!currentEditingPost && !isSlugManuallyEdited && currentLocale === "es") {
      editSlug.value = slugify(editBlogTitle.value);
    }
  });

  editSlug.addEventListener("input", () => {
    isSlugManuallyEdited = true;
  });

  // Dirty tracking en formulario
  blogForm.addEventListener("input", () => {
    isDirty = true;
  });
  blogForm.addEventListener("change", () => {
    isDirty = true;
  });

  // Switch de tabs con protección de dirty state
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const locale = btn.dataset.locale;
      if (locale === currentLocale) return;

      if (isDirty) {
        showAlert("Tienes cambios sin guardar. Guarda o descarta los cambios antes de cambiar de idioma.", "danger");
        return;
      }
      populateLocaleFields(locale);
    });
  });

  // Guardar formulario del blog
  blogForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const slugVal = editSlug.value.trim().toLowerCase();
    if (!slugVal.match(/^[a-z0-9]+(-[a-z0-9]+)*$/)) {
      showAlert("El slug no es válido. Solo debe contener letras minúsculas, números y guiones sencillos.", "danger");
      return;
    }

    saveBlogBtn.disabled = true;
    saveBlogBtn.textContent = "Guardando...";

    try {
      if (!currentEditingPost || currentLocale === "es") {
        // Guardar metadata + versión maestra ES mediante RPC admin_save_blog_post
        const postIdParam = currentEditingPost ? currentEditingPost.id : null;

        const { data: savedId, error } = await client.rpc("admin_save_blog_post", {
          p_blog_post_id: postIdParam,
          p_slug: slugVal,
          p_status: editStatus.value,
          p_featured_image_path: editFeaturedImagePath.value.trim() || null,
          p_title: editBlogTitle.value.trim(),
          p_excerpt: editBlogExcerpt.value.trim() || null,
          p_content: editBlogContent.value.trim(),
          p_seo_title: editBlogSeoTitle.value.trim() || null,
          p_meta_description: editBlogMetaDescription.value.trim() || null,
        });

        if (error) throw error;
        isDirty = false;
        showAlert("Artículo y contenido maestro en español guardados con éxito.");

        await loadBlogPosts();
        const updated = blogPosts.find((p) => p.id === (postIdParam || savedId));
        if (updated) {
          currentEditingPost = updated;
          modalTitle.textContent = "Editar Artículo del Blog";
          editBlogId.value = updated.id;
          updateModalTabBadges();
          populateLocaleFields(currentLocale);
        }
      } else {
        // Guardar traducción manual (EN o PT) mediante RPC admin_save_blog_translation
        const { error } = await client.rpc("admin_save_blog_translation", {
          p_blog_post_id: currentEditingPost.id,
          p_locale: currentLocale,
          p_title: editBlogTitle.value.trim() || null,
          p_excerpt: editBlogExcerpt.value.trim() || null,
          p_content: editBlogContent.value.trim() || null,
          p_seo_title: editBlogSeoTitle.value.trim() || null,
          p_meta_description: editBlogMetaDescription.value.trim() || null,
        });

        if (error) throw error;
        isDirty = false;
        showAlert(`Traducción en ${currentLocale.toUpperCase()} guardada con éxito.`);

        await loadBlogPosts();
        const updated = blogPosts.find((p) => p.id === currentEditingPost.id);
        if (updated) {
          currentEditingPost = updated;
          updateModalTabBadges();
          populateLocaleFields(currentLocale);
        }
      }
    } catch (err) {
      console.error("Error guardando artículo:", err);
      showAlert(`Error: ${err.message || "No se pudo guardar"}`, "danger");
    } finally {
      saveBlogBtn.disabled = false;
      saveBlogBtn.textContent = "Guardar Artículo";
    }
  });

  const closeBlogModal = () => {
    if (blogModal.open) blogModal.close();
    currentEditingPost = null;
    isSlugManuallyEdited = false;
    isDirty = false;
  };

  const requestCloseModal = () => {
    if (isDirty) {
      if (typeof discardModal.showModal === "function") {
        discardModal.showModal();
      }
      return;
    }
    closeBlogModal();
  };

  closeModalBtn.addEventListener("click", requestCloseModal);
  cancelBlogBtn.addEventListener("click", requestCloseModal);

  if (keepEditingBtn) {
    keepEditingBtn.addEventListener("click", () => {
      discardModal.close();
    });
  }

  if (confirmDiscardBtn) {
    confirmDiscardBtn.addEventListener("click", () => {
      isDirty = false;
      discardModal.close();
      closeBlogModal();
    });
  }

  if (newPostBtn) newPostBtn.addEventListener("click", openNewPostModal);

  // Modal de Archivado
  const openArchiveModal = (post) => {
    postToArchive = post;
    const esTrans = post.translations["es"] || {};
    archivePostTitle.textContent = esTrans.title || post.slug;
    if (typeof archiveModal.showModal === "function") {
      archiveModal.showModal();
    }
  };

  // Hotfix 3.1: Archivado mediante RPC admin_set_blog_status sin tocar contenido ni traducciones
  confirmArchiveBtn.addEventListener("click", async () => {
    if (!postToArchive) return;

    confirmArchiveBtn.disabled = true;
    try {
      const { error } = await client.rpc("admin_set_blog_status", {
        p_blog_post_id: postToArchive.id,
        p_status: "archived",
      });

      if (error) throw error;
      showAlert(`Artículo "${postToArchive.slug}" archivado correctamente.`);
      archiveModal.close();
      postToArchive = null;
      await loadBlogPosts();
    } catch (err) {
      console.error("Error al archivar:", err);
      showAlert(`Error al archivar: ${err.message}`, "danger");
    } finally {
      confirmArchiveBtn.disabled = false;
    }
  });

  cancelArchiveBtn.addEventListener("click", () => {
    archiveModal.close();
    postToArchive = null;
  });

  // Inicializar
  await loadBlogPosts();
});
