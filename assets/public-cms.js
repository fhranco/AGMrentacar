/**
 * AGM Rent a Car — Public CMS Module (Vanilla JS)
 * Static Fallback + Runtime CMS
 *
 * Exclusivamente utiliza SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY con fetch nativo.
 * Inmune a XSS: Todo el contenido dinámico se crea con DOM APIs (createElement, textContent).
 */

(function () {
  "use strict";

  const SUPABASE_URL =
    window.AGM_CONFIG?.SUPABASE_URL || "https://pteogwhauodbxudywsdm.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    window.AGM_CONFIG?.SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_L0IKXS54ynXQotuFBiyB7w_30I6gF1l";

  // Cache en memoria durante la sesión
  let cmsData = {
    models: null,
    modelTranslations: null,
    posts: null,
    postTranslations: null,
  };

  const KNOWN_IMAGES = {
    "nissan-kicks": "assets/images/nissan-kicks.jpg",
    "ford-territory": "assets/images/ford-territory.jpg",
    "mazda-cx-5": "assets/images/mazda-cx5.jpg",
    "toyota-rav4": "assets/images/toyota-rav4.jpg",
    "toyota-4runner": "assets/images/toyota-4runner.jpg",
    "mazda-bt-50": "assets/images/mazda-bt50.jpg",
  };

  const KNOWN_BLOG_METADATA = {
    "torres-del-paine": {
      image: "assets/images/blog-torres-del-paine.jpg",
      recommendedVehicle: "Toyota RAV4",
      locale: {
        es: {
          category: "Rutas Australes",
          readTime: "5 min de lectura",
          route: "Ruta 9 Norte",
        },
        en: {
          category: "Southern Routes",
          readTime: "5 min read",
          route: "Route 9 North",
        },
        pt: {
          category: "Rotas Austrais",
          readTime: "5 min de leitura",
          route: "Rota 9 Norte",
        },
      },
    },
    "cruce-argentina": {
      image: "assets/images/blog-cruce-argentina.jpg",
      recommendedVehicle: "Toyota 4Runner",
      locale: {
        es: {
          category: "Frontera y Trámites",
          readTime: "6 min de lectura",
          route: "El Calafate / Ushuaia",
        },
        en: {
          category: "Border & Customs",
          readTime: "6 min read",
          route: "El Calafate / Ushuaia",
        },
        pt: {
          category: "Fronteira e Trâmites",
          readTime: "6 min de leitura",
          route: "El Calafate / Ushuaia",
        },
      },
    },
    "conduccion-patagonia": {
      image: "assets/images/blog-conduccion-patagonia.jpg",
      recommendedVehicle: "Mazda CX-5",
      locale: {
        es: {
          category: "Seguridad y Clima",
          readTime: "4 min de lectura",
          route: "Consejos de Manejo",
        },
        en: {
          category: "Safety & Weather",
          readTime: "4 min read",
          route: "Driving Tips",
        },
        pt: {
          category: "Segurança e Clima",
          readTime: "4 min de leitura",
          route: "Dicas de Direção",
        },
      },
    },
  };

  const I18N = {
    es: {
      transmission: { automatic: "Automática", manual: "Manual" },
      seats: (n) => `${n} Pers.`,
      luggage: (n, slug) =>
        slug === "mazda-bt-50" || n === 0 ? "Faenas" : `${n} Maletas`,
      ac: (val) => (val ? "A/C" : "Sin A/C"),
      // Reservado para especificaciones futuras (el diseño público actual mantiene 4 specs: pasajeros, equipaje, transmisión, A/C)
      drivetrain: {
        "4x4": "4x4",
        "4x2": "4x2",
        awd: "AWD",
        unconfirmed: "Sin confirmar",
      },
      fuel_type: {
        gasoline: "Bencina",
        diesel: "Diésel",
        hybrid: "Híbrido",
        electric: "Eléctrico",
        unconfirmed: "Sin confirmar",
      },
      available: "Disponible",
      rate: "Tarifa",
      onRequest: "A consultar",
      quoteBtn: "Cotizar",
      turbodiesel: "Turbo diésel",
      readGuide: "Leer guía completa",
      defaultBlogCategory: "Guía de viaje",
      defaultRouteTag: "Patagonia",
      readingTime: (m) => `${m} min de lectura`,
      emptyBlog: "No hay guías publicadas disponibles.",
    },
    en: {
      transmission: { automatic: "Automatic", manual: "Manual" },
      seats: (n) => `${n} Seats`,
      luggage: (n, slug) =>
        slug === "mazda-bt-50" || n === 0 ? "Work/Cargo" : `${n} Bags`,
      ac: (val) => (val ? "A/C" : "No A/C"),
      // Reserved for future technical specifications
      drivetrain: {
        "4x4": "4x4",
        "4x2": "4x2",
        awd: "AWD",
        unconfirmed: "To be confirmed",
      },
      fuel_type: {
        gasoline: "Gasoline",
        diesel: "Diesel",
        hybrid: "Hybrid",
        electric: "Electric",
        unconfirmed: "To be confirmed",
      },
      available: "Available",
      rate: "Rate",
      onRequest: "On request",
      quoteBtn: "Request quote",
      turbodiesel: "Turbo diesel",
      readGuide: "Read full guide",
      defaultBlogCategory: "Travel guide",
      defaultRouteTag: "Patagonia",
      readingTime: (m) => `${m} min read`,
      emptyBlog: "No travel guides are available in this language yet.",
    },
    pt: {
      transmission: { automatic: "Automática", manual: "Manual" },
      seats: (n) => `${n} Lugares`,
      luggage: (n, slug) =>
        slug === "mazda-bt-50" || n === 0 ? "Trabalho/Carga" : `${n} Malas`,
      ac: (val) => (val ? "A/C" : "Sem A/C"),
      // Reservado para especificações futuras
      drivetrain: {
        "4x4": "4x4",
        "4x2": "4x2",
        awd: "AWD",
        unconfirmed: "A confirmar",
      },
      fuel_type: {
        gasoline: "Gasolina",
        diesel: "Diesel",
        hybrid: "Híbrido",
        electric: "Elétrico",
        unconfirmed: "A confirmar",
      },
      available: "Disponível",
      rate: "Tarifa",
      onRequest: "A consultar",
      quoteBtn: "Cotar",
      turbodiesel: "Turbo diesel",
      readGuide: "Ler guia completo",
      defaultBlogCategory: "Guia de viagem",
      defaultRouteTag: "Patagônia",
      readingTime: (m) => `${m} min de leitura`,
      emptyBlog: "Ainda não há guias disponíveis neste idioma.",
    },
  };

  const getLocale = () =>
    document.documentElement.lang ||
    localStorage.getItem("agm_lang") ||
    "es";

  /**
   * Validación estricta de imagen: Solo rutas relativas seguras a assets/images/...
   */
  function getSafeVehicleImage(model) {
    if (
      typeof model.image_url === "string" &&
      model.image_url.startsWith("assets/images/") &&
      /^[a-zA-Z0-9_\-\./]+\.(jpg|jpeg|png|webp|svg)$/.test(model.image_url)
    ) {
      return model.image_url;
    }
    return KNOWN_IMAGES[model.slug] || `assets/images/${model.slug}.jpg`;
  }

  function getSafeBlogImage(post) {
    if (
      typeof post.featured_image_path === "string" &&
      post.featured_image_path.startsWith("assets/images/") &&
      /^[a-zA-Z0-9_\-\./]+\.(jpg|jpeg|png|webp|svg)$/.test(
        post.featured_image_path,
      )
    ) {
      return post.featured_image_path;
    }
    const known = KNOWN_BLOG_METADATA[post.slug];
    return known?.image || `assets/images/blog-${post.slug}.jpg`;
  }

  /**
   * Consulta agrupada a PostgREST con timeout
   */
  async function fetchCMSData() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const headers = {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    };

    try {
      const [modelsRes, mTransRes, postsRes, pTransRes] = await Promise.all([
        fetch(
          `${SUPABASE_URL}/rest/v1/vehicle_models?select=id,slug,make,model,display_name,transmission,drivetrain,fuel_type,seats,luggage_capacity,air_conditioning,image_url,description,sort_order,active,category_id,usage_tags&active=eq.true&order=sort_order.asc`,
          { headers, signal: controller.signal },
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/vehicle_model_translations?select=vehicle_model_id,locale,display_name,category_name,description,translation_status`,
          { headers, signal: controller.signal },
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/blog_posts?select=id,slug,status,published_at,featured_image_path&status=eq.published&order=published_at.desc`,
          { headers, signal: controller.signal },
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/blog_post_translations?select=blog_post_id,locale,title,excerpt,content,seo_title,meta_description,translation_status`,
          { headers, signal: controller.signal },
        ),
      ]);

      clearTimeout(timeoutId);

      if (!modelsRes.ok || !mTransRes.ok || !postsRes.ok || !pTransRes.ok) {
        throw new Error(
          `HTTP error fetching CMS data (${modelsRes.status}/${postsRes.status})`,
        );
      }

      const [models, modelTranslations, posts, postTranslations] =
        await Promise.all([
          modelsRes.json(),
          mTransRes.json(),
          postsRes.json(),
          pTransRes.json(),
        ]);

      cmsData = { models, modelTranslations, posts, postTranslations };
      return cmsData;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn("CMS fetch failed, keeping static fallback:", err);
      return null;
    }
  }

  /**
   * Resuelve el contenido de un vehículo según el idioma actual y reglas de fallback
   */
  function resolveVehicleTranslation(model, locale) {
    const translations = cmsData.modelTranslations || [];
    const esTrans = translations.find(
      (t) =>
        t.vehicle_model_id === model.id &&
        t.locale === "es" &&
        t.translation_status === "original",
    );

    if (locale === "es") {
      return {
        displayName:
          esTrans?.display_name ||
          model.display_name ||
          `${model.make} ${model.model}`,
        categoryName: esTrans?.category_name || null,
        description: esTrans?.description || model.description || "",
      };
    }

    const localeTrans = translations.find(
      (t) =>
        t.vehicle_model_id === model.id &&
        t.locale === locale &&
        ["translated", "reviewed"].includes(t.translation_status),
    );

    return {
      displayName:
        localeTrans?.display_name ||
        esTrans?.display_name ||
        model.display_name ||
        `${model.make} ${model.model}`,
      categoryName:
        localeTrans?.category_name || esTrans?.category_name || null,
      description:
        localeTrans?.description ||
        esTrans?.description ||
        model.description ||
        "",
    };
  }

  /**
   * Renderiza las tarjetas de la flota dinámicamente con DOM seguro
   */
  function renderFleet(locale) {
    const fleetGrid = document.getElementById("fleetGrid");
    if (!fleetGrid || !cmsData.models || cmsData.models.length === 0) return;

    const dict = I18N[locale] || I18N.es;
    const fragment = document.createDocumentFragment();

    cmsData.models.forEach((model) => {
      const trans = resolveVehicleTranslation(model, locale);
      const safeImg = getSafeVehicleImage(model);

      // Wrapper card
      const card = document.createElement("div");
      card.className =
        "lg:col-span-4 bg-surface-white rounded-xl border border-brand-blue/15 p-5 lg:p-6 hover:border-brand-blue/50 hover:shadow-xl transition-all flex flex-col justify-between group";

      // Categorías para filtrado
      const categories = Array.isArray(model.usage_tags)
        ? model.usage_tags.join(" ")
        : "suv-crossover";
      card.setAttribute("data-vehicle-category", categories);
      card.dataset.baseSpan = "lg:col-span-4";

      // Sección superior
      const topSection = document.createElement("div");

      // Fila de badges (Categoría + Disponibilidad/Turbo diesel)
      const badgeRow = document.createElement("div");
      badgeRow.className = "flex items-center justify-between mb-3";

      const catBadge = document.createElement("span");
      let catBadgeClasses =
        "px-2.5 py-1 rounded-md font-label-sm text-label-sm font-bold ";
      if (model.slug === "toyota-4runner") {
        catBadgeClasses += "bg-brand-blue text-surface-white";
      } else if (
        model.slug === "ford-territory" ||
        model.slug === "toyota-rav4"
      ) {
        catBadgeClasses += "bg-brand-lime/20 text-slate-900";
      } else {
        catBadgeClasses += "bg-slate-100 text-slate-700";
      }
      catBadge.className = catBadgeClasses;
      catBadge.textContent =
        trans.categoryName ||
        (model.slug === "mazda-bt-50"
          ? dict.pickupBadge
          : "SUV • Crossover");

      const statusBadge = document.createElement("span");
      if (model.slug === "mazda-bt-50") {
        statusBadge.className =
          "flex items-center gap-1 text-[12px] font-bold text-primary";
        statusBadge.textContent = dict.turbodiesel;
      } else {
        statusBadge.className =
          "flex items-center gap-1 text-[12px] font-bold text-success";
        const dot = document.createElement("span");
        dot.className = "w-2 h-2 rounded-full bg-success";
        statusBadge.appendChild(dot);
        statusBadge.appendChild(
          document.createTextNode(" " + dict.available),
        );
      }

      badgeRow.appendChild(catBadge);
      badgeRow.appendChild(statusBadge);
      topSection.appendChild(badgeRow);

      // Título
      const title = document.createElement("h3");
      title.className =
        "font-title-md text-title-md font-bold text-slate-900 mb-1 group-hover:text-primary transition-colors";
      title.textContent = trans.displayName;
      topSection.appendChild(title);

      // Descripción
      const desc = document.createElement("p");
      desc.className = "font-body-sm text-body-sm text-slate-500 mb-4";
      desc.textContent = trans.description;
      topSection.appendChild(desc);

      // Contenedor de imagen
      const imgContainer = document.createElement("div");
      imgContainer.className =
        "relative h-52 w-full flex items-center justify-center bg-slate-100 rounded-lg overflow-hidden mb-4 p-1";

      const img = document.createElement("img");
      img.className =
        "w-full h-full object-cover rounded-md group-hover:scale-105 transition-transform duration-500";
      img.alt = `${trans.displayName} de AGM Rent a Car`;
      img.src = safeImg;
      imgContainer.appendChild(img);
      topSection.appendChild(imgContainer);

      // Grid de especificaciones técnicas
      const specsGrid = document.createElement("div");
      specsGrid.className =
        "grid grid-cols-4 gap-1 py-3 border-t border-b border-slate-100 text-center font-label-sm text-label-sm text-slate-600 mb-4";

      // 1. Asientos
      const specSeats = document.createElement("div");
      specSeats.className = "flex flex-col items-center";
      const iconSeats = document.createElement("span");
      iconSeats.className =
        "material-symbols-outlined text-[18px] text-slate-500";
      iconSeats.textContent = "group";
      const textSeats = document.createElement("span");
      textSeats.textContent = dict.seats(model.seats || 5);
      specSeats.appendChild(iconSeats);
      specSeats.appendChild(textSeats);

      // 2. Equipaje
      const specLuggage = document.createElement("div");
      specLuggage.className = "flex flex-col items-center";
      const iconLuggage = document.createElement("span");
      iconLuggage.className =
        "material-symbols-outlined text-[18px] text-slate-500";
      iconLuggage.textContent = "luggage";
      const textLuggage = document.createElement("span");
      textLuggage.textContent = dict.luggage(
        model.luggage_capacity ?? 2,
        model.slug,
      );
      specLuggage.appendChild(iconLuggage);
      specLuggage.appendChild(textLuggage);

      // 3. Transmisión
      const specTrans = document.createElement("div");
      specTrans.className = "flex flex-col items-center";
      const iconTrans = document.createElement("span");
      iconTrans.className =
        "material-symbols-outlined text-[18px] text-slate-500";
      iconTrans.textContent = "settings";
      const textTrans = document.createElement("span");
      textTrans.textContent =
        dict.transmission[model.transmission] ||
        dict.transmission.automatic;
      specTrans.appendChild(iconTrans);
      specTrans.appendChild(textTrans);

      // 4. A/C
      const specAc = document.createElement("div");
      specAc.className = "flex flex-col items-center";
      const iconAc = document.createElement("span");
      iconAc.className =
        "material-symbols-outlined text-[18px] text-slate-500";
      iconAc.textContent = "ac_unit";
      const textAc = document.createElement("span");
      textAc.textContent = dict.ac(model.air_conditioning !== false);
      specAc.appendChild(iconAc);
      specAc.appendChild(textAc);

      specsGrid.appendChild(specSeats);
      specsGrid.appendChild(specLuggage);
      specsGrid.appendChild(specTrans);
      specsGrid.appendChild(specAc);
      topSection.appendChild(specsGrid);

      card.appendChild(topSection);

      // Sección inferior / Cotizar
      const bottomSection = document.createElement("div");
      bottomSection.className = "pt-2";

      const tariffRow = document.createElement("div");
      tariffRow.className = "flex items-baseline justify-between mb-3";

      const tariffLabel = document.createElement("span");
      tariffLabel.className = "font-body-sm text-body-sm text-slate-500";
      tariffLabel.textContent = dict.rate;

      const tariffVal = document.createElement("span");
      tariffVal.className =
        "font-currency-display text-currency-display text-slate-950 font-extrabold";
      tariffVal.textContent = dict.onRequest;

      tariffRow.appendChild(tariffLabel);
      tariffRow.appendChild(tariffVal);
      bottomSection.appendChild(tariffRow);

      const quoteBtn = document.createElement("button");
      quoteBtn.type = "button";
      quoteBtn.className =
        "w-full py-2.5 rounded-lg bg-brand-blue-dark hover:bg-brand-blue text-surface-white group-hover:bg-brand-lime group-hover:text-slate-950 font-label-md text-label-md font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer";
      quoteBtn.setAttribute("aria-haspopup", "dialog");
      quoteBtn.setAttribute("aria-controls", "quoteDialog");
      quoteBtn.setAttribute("data-vehicle-slug", model.slug);
      quoteBtn.setAttribute("data-vehicle-name", trans.displayName);

      const btnSpan = document.createElement("span");
      btnSpan.textContent = dict.quoteBtn;
      const btnIcon = document.createElement("span");
      btnIcon.className = "material-symbols-outlined text-[18px]";
      btnIcon.textContent = "check";

      quoteBtn.appendChild(btnSpan);
      quoteBtn.appendChild(btnIcon);

      quoteBtn.addEventListener("click", () => {
        if (typeof window.openVehicleQuote === "function") {
          window.openVehicleQuote(model.slug, quoteBtn);
        } else if (window.AGM_APP?.openVehicleQuote) {
          window.AGM_APP.openVehicleQuote(model.slug, quoteBtn);
        }
      });

      bottomSection.appendChild(quoteBtn);
      card.appendChild(bottomSection);

      fragment.appendChild(card);
    });

    fleetGrid.replaceChildren(fragment);

    // Re-aplicar filtro activo si existe función de filtrado
    if (typeof window.applyFleetFilter === "function") {
      const activeBtn = document.querySelector(
        "[data-category-filter][aria-pressed='true']",
      );
      window.applyFleetFilter(activeBtn?.dataset.categoryFilter || "all");
    } else if (window.AGM_APP?.applyFleetFilter) {
      window.AGM_APP.applyFleetFilter(
        window.AGM_APP.getActiveFilter?.() || "all",
      );
    }
  }

  /**
   * Resuelve artículos de blog publicados con traducción pública válida para el idioma
   */
  function getValidBlogArticles(locale) {
    if (!cmsData.posts || cmsData.posts.length === 0) return [];

    const translations = cmsData.postTranslations || [];
    const validArticles = [];

    cmsData.posts.forEach((post) => {
      let trans = null;
      if (locale === "es") {
        trans = translations.find(
          (t) =>
            t.blog_post_id === post.id &&
            t.locale === "es" &&
            t.translation_status === "original",
        );
      } else {
        trans = translations.find(
          (t) =>
            t.blog_post_id === post.id &&
            t.locale === locale &&
            ["translated", "reviewed"].includes(t.translation_status),
        );
      }

      if (trans && trans.title && trans.content) {
        const legacy = KNOWN_BLOG_METADATA[post.slug] || {};
        const legacyMeta = legacy.locale?.[locale] || {};
        validArticles.push({
          id: post.id,
          slug: post.slug,
          title: trans.title,
          excerpt: trans.excerpt || "",
          content: trans.content,
          image: getSafeBlogImage(post),
          category:
            legacyMeta.category ||
            I18N[locale]?.defaultBlogCategory ||
            "Guía",
          readTime:
            legacyMeta.readTime ||
            I18N[locale]?.readingTime(5) ||
            "5 min",
          route:
            legacyMeta.route ||
            I18N[locale]?.defaultRouteTag ||
            "Patagonia",
          recommendedVehicle: legacy.recommendedVehicle || "",
        });
      }
    });

    return validArticles;
  }

  /**
   * Renderiza el contenido seguro de un artículo de blog en el modal blogDialog
   */
  function openBlogArticleModal(slug) {
    const locale = getLocale();
    const articles = getValidBlogArticles(locale);
    const article = articles.find((a) => a.slug === slug);
    if (!article) return;

    const blogDialog = document.getElementById("blogDialog");
    const blogDialogClose = document.getElementById("blogDialogClose");
    const blogDialogImage = document.getElementById("blogDialogImage");
    const blogDialogCategory = document.getElementById("blogDialogCategory");
    const blogDialogReadTime = document.getElementById("blogDialogReadTime");
    const blogDialogTitle = document.getElementById("blogDialogTitle");
    const blogDialogBody = document.getElementById("blogDialogBody");
    const blogDialogCta = document.getElementById("blogDialogCta");

    if (!blogDialog) return;

    if (blogDialogImage) blogDialogImage.src = article.image;
    if (blogDialogCategory) blogDialogCategory.textContent = article.category;
    if (blogDialogReadTime) {
      blogDialogReadTime.replaceChildren();
      const schedIcon = document.createElement("span");
      schedIcon.className = "material-symbols-outlined text-[16px]";
      schedIcon.textContent = "schedule";
      blogDialogReadTime.appendChild(schedIcon);
      blogDialogReadTime.appendChild(
        document.createTextNode(" " + article.readTime),
      );
    }
    if (blogDialogTitle) blogDialogTitle.textContent = article.title;
    if (blogDialogCta) {
      blogDialogCta.dataset.recommendedVehicle =
        article.recommendedVehicle || "";
    }

    // Renderizado seguro de contenido (párrafos y listas, sin innerHTML)
    if (blogDialogBody) {
      blogDialogBody.replaceChildren();
      const rawLines = article.content.split(/\r?\n/);
      let currentList = null;

      rawLines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
          currentList = null;
          return;
        }

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          if (!currentList) {
            currentList = document.createElement("ul");
            currentList.className =
              "space-y-1.5 list-disc list-inside text-slate-700 font-body-sm text-body-sm mb-4";
            blogDialogBody.appendChild(currentList);
          }
          const li = document.createElement("li");
          li.textContent = trimmed.replace(/^[-*]\s+/, "");
          currentList.appendChild(li);
        } else {
          currentList = null;
          const p = document.createElement("p");
          p.className =
            "font-body-md text-body-md text-slate-700 leading-relaxed mb-4";
          p.textContent = trimmed;
          blogDialogBody.appendChild(p);
        }
      });
    }

    if (typeof blogDialog.showModal === "function") {
      blogDialog.showModal();
      blogDialogClose?.focus();
    }
  }

  /**
   * Renderiza el grid de blog si existen artículos válidos publicados
   */
  function renderBlog(locale) {
    const blogGrid = document.getElementById("blogGrid");
    if (!blogGrid) return;

    // Caso A: No hay posts CMS publicados en la base de datos o falló la consulta
    if (!cmsData.posts || cmsData.posts.length === 0) {
      // Mantener el fallback estático actual en el HTML
      return;
    }

    // Caso B: Existen posts publicados en Supabase. Las reglas del CMS gobiernan el Blog.
    const validArticles = getValidBlogArticles(locale);
    const dict = I18N[locale] || I18N.es;

    if (validArticles.length === 0) {
      // No hay artículos publicados válidos para este idioma.
      // Limpiar el grid y mostrar estado vacío seguro y localizado (nunca mostrar contenido en español).
      const emptyCard = document.createElement("div");
      emptyCard.className =
        "col-span-full py-12 px-6 text-center rounded-2xl bg-surface-white border border-slate-200/80 shadow-sm";
      const emptyText = document.createElement("p");
      emptyText.className = "font-body-md text-body-md text-slate-500";
      emptyText.textContent = dict.emptyBlog;
      emptyCard.appendChild(emptyText);
      blogGrid.replaceChildren(emptyCard);
      return;
    }

    const dict = I18N[locale] || I18N.es;
    const fragment = document.createDocumentFragment();

    validArticles.forEach((article) => {
      const card = document.createElement("article");
      card.className =
        "bg-surface-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group";

      // Top section
      const topDiv = document.createElement("div");

      // Imagen y tag
      const imgWrap = document.createElement("div");
      imgWrap.className = "relative h-56 w-full overflow-hidden bg-slate-100";

      const img = document.createElement("img");
      img.src = article.image;
      img.alt = article.title;
      img.className =
        "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500";
      imgWrap.appendChild(img);

      const tagBadge = document.createElement("span");
      tagBadge.className =
        "absolute top-4 left-4 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-surface-white font-label-sm text-label-sm font-semibold";
      tagBadge.textContent = article.category;
      imgWrap.appendChild(tagBadge);

      topDiv.appendChild(imgWrap);

      // Contenido card
      const contentDiv = document.createElement("div");
      contentDiv.className = "p-6";

      const metaRow = document.createElement("div");
      metaRow.className =
        "flex items-center gap-4 text-slate-400 font-label-sm text-label-sm mb-3";

      const readSpan = document.createElement("span");
      readSpan.className = "flex items-center gap-1";
      const schedIcon = document.createElement("span");
      schedIcon.className = "material-symbols-outlined text-[16px]";
      schedIcon.textContent = "schedule";
      const readText = document.createElement("span");
      readText.textContent = article.readTime;
      readSpan.appendChild(schedIcon);
      readSpan.appendChild(readText);

      const dotSpan = document.createElement("span");
      dotSpan.textContent = "·";

      const routeSpan = document.createElement("span");
      routeSpan.textContent = article.route;

      metaRow.appendChild(readSpan);
      metaRow.appendChild(dotSpan);
      metaRow.appendChild(routeSpan);
      contentDiv.appendChild(metaRow);

      const titleH3 = document.createElement("h3");
      titleH3.className =
        "font-title-md text-title-md font-bold text-slate-950 mb-3 group-hover:text-primary transition-colors leading-snug";
      titleH3.textContent = article.title;
      contentDiv.appendChild(titleH3);

      const excerptP = document.createElement("p");
      excerptP.className =
        "font-body-sm text-body-sm text-slate-600 line-clamp-3 leading-relaxed";
      excerptP.textContent = article.excerpt;
      contentDiv.appendChild(excerptP);

      topDiv.appendChild(contentDiv);
      card.appendChild(topDiv);

      // Bottom section / Leer guía
      const bottomDiv = document.createElement("div");
      bottomDiv.className = "px-6 pb-6 pt-2";

      const readBtn = document.createElement("button");
      readBtn.type = "button";
      readBtn.className =
        "w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-brand-lime text-slate-900 font-label-md text-label-md font-bold transition-all flex items-center justify-center gap-2 cursor-pointer";
      readBtn.setAttribute("data-blog-id", article.slug);

      const btnText = document.createElement("span");
      btnText.textContent = dict.readGuide;
      const arrowIcon = document.createElement("span");
      arrowIcon.className = "material-symbols-outlined text-[18px]";
      arrowIcon.textContent = "arrow_forward";

      readBtn.appendChild(btnText);
      readBtn.appendChild(arrowIcon);

      readBtn.addEventListener("click", () => {
        openBlogArticleModal(article.slug);
      });

      bottomDiv.appendChild(readBtn);
      card.appendChild(bottomDiv);

      fragment.appendChild(card);
    });

    blogGrid.replaceChildren(fragment);
  }

  /**
   * Actualiza el renderizado del CMS completo para el idioma especificado
   */
  function renderAllCMS(locale) {
    renderFleet(locale);
    renderBlog(locale);
  }

  // Inicialización del módulo
  async function init() {
    const data = await fetchCMSData();
    if (!data) return; // Conserva fallback estático en caso de fallo

    const locale = getLocale();
    renderAllCMS(locale);

    // Escucha cambios de idioma
    window.addEventListener("agm:languageChange", (event) => {
      const newLang = event.detail?.lang || "es";
      renderAllCMS(newLang);
    });
  }

  // Exposición pública para compatibilidad con código existente
  window.AGM_PUBLIC_CMS = {
    init,
    getArticle: (slug) => {
      const articles = getValidBlogArticles(getLocale());
      return articles.find((a) => a.slug === slug) || null;
    },
    openModal: openBlogArticleModal,
    render: renderAllCMS,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
