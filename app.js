/* ============================================================
   B²GC BROKERS
   PORTAFOLIOS + LÍNEA DE TIEMPO + SUBASTAS
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    /* ========================================================
       CONFIGURACIÓN
       ======================================================== */

    const STORAGE_PORTFOLIOS = "b2gc_portfolios";
    const STORAGE_OFFERS = "b2gc_auction_offers";
    const STORAGE_AUCTIONS = "b2gc_auctions";
    const STORAGE_USER = "b2gc_user";

    let auctionTimer = null;

    /* ========================================================
       PORTAFOLIOS DE EJEMPLO
       Solo se crean si no existen
       ======================================================== */

    const defaultPortfolios = [
        {
            id: "PORT-001",
            name: "Cartera Corporativa Norte",
            seller: "Banco Nacional",
            city: "Bogotá D.C.",
            type: "Corporativa",
            amount: 4850000000,
            discount: 18,
            debtors: 124,
            createdAt: "2026-09-15",
            reviewDays: 7,
            status: "En revisión",
            stage: "revision",
            auctionStatus: "pending",
            auctionDuration: null,
            auctionStartedAt: null,
            auctionEndsAt: null
        },
        {
            id: "PORT-002",
            name: "Cartera Consumo 2026",
            seller: "Financiera Andina",
            city: "Medellín",
            type: "Consumo",
            amount: 2750000000,
            discount: 25,
            debtors: 386,
            createdAt: "2026-09-18",
            reviewDays: 3,
            status: "Data Room",
            stage: "dataroom",
            auctionStatus: "pending",
            auctionDuration: null,
            auctionStartedAt: null,
            auctionEndsAt: null
        },
        {
            id: "PORT-003",
            name: "Cartera Pyme Regional",
            seller: "Inversiones Colombia",
            city: "Cali",
            type: "Pyme",
            amount: 1920000000,
            discount: 22,
            debtors: 87,
            createdAt: "2026-09-20",
            reviewDays: 0,
            status: "Lista para subasta",
            stage: "auction",
            auctionStatus: "pending",
            auctionDuration: null,
            auctionStartedAt: null,
            auctionEndsAt: null
        }
    ];

    /* ========================================================
       INICIALIZACIÓN
       ======================================================== */

    let portfolios = getStorage(STORAGE_PORTFOLIOS, null);

    if (!portfolios) {
        portfolios = defaultPortfolios;
        saveStorage(STORAGE_PORTFOLIOS, portfolios);
    }

    renderPortfolios();

    /* ========================================================
       UTILIDADES
       ======================================================== */

    function getStorage(key, fallback) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : fallback;
        } catch (error) {
            console.error("Error leyendo localStorage:", error);
            return fallback;
        }
    }

    function saveStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency: "COP",
            maximumFractionDigits: 0
        }).format(value || 0);
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("es-CO").format(value || 0);
    }

    function formatDate(date) {
        if (!date) return "-";

        return new Date(date).toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    }

    function escapeHTML(value) {
        const div = document.createElement("div");
        div.textContent = value ?? "";
        return div.innerHTML;
    }

    /* ========================================================
       RENDER PORTAFOLIOS
       ======================================================== */

    function renderPortfolios() {

        const container =
            document.querySelector("#portfolio-grid") ||
            document.querySelector(".portfolio-grid") ||
            document.querySelector("#portfolios-container");

        if (!container) return;

        container.innerHTML = "";

        portfolios.forEach(portfolio => {

            const card = document.createElement("article");

            card.className = "portfolio-card";

            card.innerHTML = `
                <div class="portfolio-card-header">
                    <span class="portfolio-id">
                        ${escapeHTML(portfolio.id)}
                    </span>

                    <span class="badge ${getStatusClass(portfolio.stage)}">
                        ${escapeHTML(portfolio.status)}
                    </span>
                </div>

                <h3>
                    ${escapeHTML(portfolio.name)}
                </h3>

                <p class="portfolio-seller">
                    ${escapeHTML(portfolio.seller)}
                </p>

                <div class="portfolio-card-data">

                    <div>
                        <span>Valor</span>
                        <strong>
                            ${formatCurrency(portfolio.amount)}
                        </strong>
                    </div>

                    <div>
                        <span>Deudores</span>
                        <strong>
                            ${formatNumber(portfolio.debtors)}
                        </strong>
                    </div>

                    <div>
                        <span>Descuento</span>
                        <strong>
                            ${portfolio.discount}%
                        </strong>
                    </div>

                </div>

                <button
                    class="btn btn-primary btn-view-portfolio"
                    data-id="${portfolio.id}">
                    Ver portafolio
                </button>
            `;

            container.appendChild(card);
        });

        document
            .querySelectorAll(".btn-view-portfolio")
            .forEach(button => {

                button.addEventListener("click", () => {

                    const id = button.dataset.id;

                    openPortfolioDetail(id);

                });

            });
    }

    function getStatusClass(stage) {

        const classes = {
            review: "badge-warning",
            dataroom: "badge-info",
            auction: "badge-success",
            awarded: "badge-success",
            closed: "badge-neutral",
            deserted: "badge-danger"
        };

        return classes[stage] || "badge-neutral";
    }

    /* ========================================================
       DETALLE DEL PORTAFOLIO
       ======================================================== */

    window.openPortfolioDetail = function (portfolioId) {

        const portfolio = portfolios.find(
            p => p.id === portfolioId
        );

        if (!portfolio) return;

        let overlay = document.querySelector("#detail-overlay");

        if (!overlay) {

            overlay = document.createElement("div");

            overlay.id = "detail-overlay";

            document.body.appendChild(overlay);
        }

        overlay.innerHTML = buildPortfolioDetail(portfolio);

        overlay.classList.add("active");

        document.body.classList.add("modal-open");

        initializeDetailEvents(portfolio);

        initializeAuction(portfolio);
    };

    /* ========================================================
       CONSTRUIR DETALLE
       ======================================================== */

    function buildPortfolioDetail(portfolio) {

        const timeline = buildTimeline(portfolio);

        const currentStage = getCurrentStage(portfolio);

        return `
            <div class="detail-modal">

                <header class="detail-header">

                    <div>

                        <button
                            id="close-detail"
                            class="btn btn-secondary">
                            ← Volver
                        </button>

                    </div>

                    <div class="detail-header-actions">

                        <button
                            class="btn btn-secondary"
                            id="download-summary">
                            Descargar resumen
                        </button>

                        <button
                            class="btn btn-primary"
                            id="open-offer-form">
                            Presentar oferta
                        </button>

                    </div>

                </header>


                <main class="detail-panel">

                    <!-- HERO -->

                    <section class="portfolio-hero">

                        <div>

                            <div class="portfolio-id">
                                ${escapeHTML(portfolio.id)}
                            </div>

                            <h1>
                                ${escapeHTML(portfolio.name)}
                            </h1>

                            <p>
                                Portafolio de
                                ${escapeHTML(portfolio.type)}
                                ·
                                ${escapeHTML(portfolio.city)}
                            </p>

                        </div>

                        <div>

                            <span class="badge ${getStatusClass(portfolio.stage)}">
                                ${escapeHTML(portfolio.status)}
                            </span>

                        </div>

                    </section>


                    <!-- KPIS -->

                    <section class="portfolio-kpis">

                        <div class="kpi-card">

                            <span>Valor nominal</span>

                            <strong>
                                ${formatCurrency(portfolio.amount)}
                            </strong>

                        </div>

                        <div class="kpi-card">

                            <span>Descuento</span>

                            <strong>
                                ${portfolio.discount}%
                            </strong>

                        </div>

                        <div class="kpi-card">

                            <span>Deudores</span>

                            <strong>
                                ${formatNumber(portfolio.debtors)}
                            </strong>

                        </div>

                        <div class="kpi-card">

                            <span>Publicado</span>

                            <strong>
                                ${formatDate(portfolio.createdAt)}
                            </strong>

                        </div>

                    </section>


                    <!-- TABS -->

                    <nav class="detail-tabs">

                        <button
                            class="detail-tab active"
                            data-tab="process">
                            Proceso
                        </button>

                        <button
                            class="detail-tab"
                            data-tab="auction">
                            Subasta
                        </button>

                        <button
                            class="detail-tab"
                            data-tab="dataroom">
                            Data Room
                        </button>

                        <button
                            class="detail-tab"
                            data-tab="information">
                            Información
                        </button>

                    </nav>


                    <!-- PROCESO -->

                    <section
                        id="tab-process"
                        class="detail-tab-content active">

                        <div class="section-heading">

                            <div>

                                <span class="eyebrow">
                                    ESTADO DEL PROCESO
                                </span>

                                <h2>
                                    Línea de tiempo
                                </h2>

                            </div>

                        </div>


                        <div class="process-layout">

                            <div class="process-timeline">

                                ${timeline}

                            </div>


                            <aside class="current-stage-card">

                                <span class="eyebrow">
                                    ETAPA ACTUAL
                                </span>

                                <h3>
                                    ${currentStage.title}
                                </h3>

                                <p>
                                    ${currentStage.description}
                                </p>

                                <div class="stage-counter">

                                    <span>
                                        ${currentStage.label}
                                    </span>

                                    <strong>
                                        ${currentStage.remaining}
                                    </strong>

                                </div>

                            </aside>

                        </div>

                    </section>


                    <!-- SUBASTA -->

                    <section
                        id="tab-auction"
                        class="detail-tab-content">

                        ${buildAuctionSection(portfolio)}

                    </section>


                    <!-- DATA ROOM -->

                    <section
                        id="tab-dataroom"
                        class="detail-tab-content">

                        <div class="section-heading">

                            <div>

                                <span class="eyebrow">
                                    DOCUMENTACIÓN
                                </span>

                                <h2>
                                    Data Room
                                </h2>

                                <p>
                                    Información disponible para los compradores
                                    autorizados.
                                </p>

                            </div>

                        </div>

                        <div class="dataroom-grid">

                            ${buildDataRoomCard(
                                "01",
                                "Información financiera",
                                "Estados financieros, saldos y estructura de cartera."
                            )}

                            ${buildDataRoomCard(
                                "02",
                                "Base de deudores",
                                "Información consolidada de obligaciones."
                            )}

                            ${buildDataRoomCard(
                                "03",
                                "Documentación legal",
                                "Contratos, soportes y documentos jurídicos."
                            )}

                            ${buildDataRoomCard(
                                "04",
                                "Soportes",
                                "Documentación complementaria del portafolio."
                            )}

                        </div>

                    </section>


                    <!-- INFORMACIÓN -->

                    <section
                        id="tab-information"
                        class="detail-tab-content">

                        <div class="section-heading">

                            <span class="eyebrow">
                                INFORMACIÓN GENERAL
                            </span>

                            <h2>
                                Detalles del portafolio
                            </h2>

                        </div>

                        <div class="information-table">

                            <div>
                                <span>ID</span>
                                <strong>
                                    ${escapeHTML(portfolio.id)}
                                </strong>
                            </div>

                            <div>
                                <span>Vendedor</span>
                                <strong>
                                    ${escapeHTML(portfolio.seller)}
                                </strong>
                            </div>

                            <div>
                                <span>Tipo</span>
                                <strong>
                                    ${escapeHTML(portfolio.type)}
                                </strong>
                            </div>

                            <div>
                                <span>Ciudad</span>
                                <strong>
                                    ${escapeHTML(portfolio.city)}
                                </strong>
                            </div>

                            <div>
                                <span>Valor nominal</span>
                                <strong>
                                    ${formatCurrency(portfolio.amount)}
                                </strong>
                            </div>

                            <div>
                                <span>Deudores</span>
                                <strong>
                                    ${formatNumber(portfolio.debtors)}
                                </strong>
                            </div>

                        </div>

                    </section>

                </main>

            </div>
        `;
    }

    /* ========================================================
       TIMELINE
       ======================================================== */

    function buildTimeline(portfolio) {

        const stages = [
            {
                key: "created",
                title: "Portafolio registrado",
                description: "El vendedor creó el portafolio."
            },
            {
                key: "review",
                title: "Revisión",
                description: "B²GC está validando la información."
            },
            {
                key: "dataroom",
                title: "Data Room",
                description: "La información está disponible para compradores."
            },
            {
                key: "auction",
                title: "Subasta",
                description: "El portafolio está disponible para recibir ofertas."
            },
            {
                key: "awarded",
                title: "Adjudicación",
                description: "Se selecciona la oferta ganadora."
            },
            {
                key: "closed",
                title: "Cierre",
                description: "El proceso de negociación ha finalizado."
            }
        ];

        const currentIndex = getStageIndex(portfolio.stage);

        return stages.map((stage, index) => {

            let status = "pending";

            if (index < currentIndex) {
                status = "completed";
            }

            if (index === currentIndex) {
                status = "current";
            }

            return `
                <div class="timeline-item ${status}">

                    <div class="timeline-marker">

                        ${
                            status === "completed"
                                ? "✓"
                                : index + 1
                        }

                    </div>

                    <div class="timeline-content">

                        <div class="timeline-title-row">

                            <h3>
                                ${stage.title}
                            </h3>

                            ${
                                status === "current"
                                    ? `
                                    <span class="badge badge-success">
                                        Actual
                                    </span>
                                    `
                                    : ""
                            }

                        </div>

                        <p>
                            ${stage.description}
                        </p>

                        ${
                            status === "current"
                                ? `
                                <div class="timeline-current-info">

                                    <span>
                                        Estado
                                    </span>

                                    <strong>
                                        ${portfolio.status}
                                    </strong>

                                </div>
                                `
                                : ""
                        }

                    </div>

                </div>
            `;

        }).join("");
    }

    function getStageIndex(stage) {

        const order = [
            "created",
            "review",
            "dataroom",
            "auction",
            "awarded",
            "closed"
        ];

        const index = order.indexOf(stage);

        return index === -1 ? 0 : index;
    }

    function getCurrentStage(portfolio) {

        const data = {

            created: {
                title: "Portafolio registrado",
                description: "El portafolio fue registrado y está iniciando el proceso.",
                label: "Estado",
                remaining: "Pendiente"
            },

            review: {
                title: "En revisión",
                description: "El equipo está validando la información del portafolio.",
                label: "Días restantes",
                remaining: `${portfolio.reviewDays} días`
            },

            dataroom: {
                title: "Data Room abierto",
                description: "Los compradores autorizados pueden consultar la documentación.",
                label: "Estado",
                remaining: "Disponible"
            },

            auction: {
                title: "Lista para subasta",
                description: "El portafolio puede recibir ofertas.",
                label: "Estado",
                remaining: "Disponible"
            },

            awarded: {
                title: "Adjudicación",
                description: "La subasta terminó y se está gestionando la oferta ganadora.",
                label: "Estado",
                remaining: "En proceso"
            },

            closed: {
                title: "Proceso cerrado",
                description: "La negociación del portafolio finalizó.",
                label: "Estado",
                remaining: "Finalizado"
            },

            deserted: {
                title: "Subasta desierta",
                description: "La subasta terminó sin recibir ofertas.",
                label: "Resultado",
                remaining: "Sin ofertas"
            }

        };

        return data[portfolio.stage] || data.created;
    }

    /* ========================================================
       DATA ROOM
       ======================================================== */

    function buildDataRoomCard(number, title, description) {

        return `
            <div class="dataroom-card">

                <span class="dataroom-number">
                    ${number}
                </span>

                <h3>
                    ${title}
                </h3>

                <p>
                    ${description}
                </p>

                <button class="btn btn-secondary">
                    Ver documentos
                </button>

            </div>
        `;
    }

    /* ========================================================
       SUBASTA
       ======================================================== */

    function buildAuctionSection(portfolio) {

        const auction = getAuction(portfolio.id);

        const offers = getOffers(portfolio.id);

        let auctionContent = "";

        if (auction?.status === "deserted") {

            auctionContent = `
                <div class="auction-deserted">

                    <div class="auction-state-icon">
                        !
                    </div>

                    <h2>
                        Subasta desierta
                    </h2>

                    <p>
                        El tiempo de la subasta terminó sin recibir ofertas.
                    </p>

                    <button
                        class="btn btn-primary"
                        id="restart-auction">
                        Abrir nueva subasta
                    </button>

                </div>
            `;

        } else if (auction?.status === "active") {

            auctionContent = buildActiveAuction(
                portfolio,
                auction,
                offers
            );

        } else if (auction?.status === "finished") {

            auctionContent = `
                <div class="auction-awarded">

                    <span class="eyebrow">
                        RESULTADO
                    </span>

                    <h2>
                        Subasta finalizada
                    </h2>

                    <p>
                        La subasta ha terminado.
                    </p>

                    ${
                        offers.length
                            ? `
                                <strong>
                                    Mejor oferta:
                                    ${formatCurrency(
                                        Math.max(
                                            ...offers.map(o => o.amount)
                                        )
                                    )}
                                </strong>
                            `
                            : `
                                <strong>
                                    No se recibieron ofertas.
                                </strong>
                            `
                    }

                </div>
            `;

        } else {

            auctionContent = `
                <div class="auction-start">

                    <div>

                        <span class="eyebrow">
                            MOTOR DE SUBASTA
                        </span>

                        <h2>
                            Subastar este portafolio
                        </h2>

                        <p>
                            Selecciona la duración de la subasta.
                            Los portafolios se presentan uno por uno.
                        </p>

                    </div>


                    <div class="auction-duration">

                        <button
                            class="duration-option active"
                            data-duration="15">
                            <strong>15</strong>
                            minutos
                        </button>

                        <button
                            class="duration-option"
                            data-duration="30">
                            <strong>30</strong>
                            minutos
                        </button>

                    </div>


                    <button
                        class="btn btn-primary btn-large"
                        id="start-auction">
                        Iniciar subasta
                    </button>

                </div>
            `;
        }

        return `
            <div class="auction-container">

                <div class="section-heading">

                    <div>

                        <span class="eyebrow">
                            SUBASTA
                        </span>

                        <h2>
                            Motor de ofertas
                        </h2>

                    </div>

                </div>

                ${auctionContent}

            </div>
        `;
    }

    /* ========================================================
       SUBASTA ACTIVA
       ======================================================== */

    function buildActiveAuction(
        portfolio,
        auction,
        offers
    ) {

        const bestOffer = getBestOffer(offers);

        return `
            <div class="auction-layout">

                <div class="auction-main">

                    <div class="auction-clock-card">

                        <span>
                            TIEMPO RESTANTE
                        </span>

                        <strong
                            id="auction-clock"
                            data-end="${auction.endsAt}">
                            --:--
                        </strong>

                        <small>
                            Subasta de ${auction.duration} minutos
                        </small>

                    </div>


                    <div class="auction-best-offer">

                        <span>
                            MEJOR OFERTA
                        </span>

                        <strong id="best-offer">
                            ${
                                bestOffer
                                    ? formatCurrency(bestOffer.amount)
                                    : "Sin ofertas"
                            }
                        </strong>

                    </div>


                    <div class="auction-offers">

                        <div class="table-header">

                            <h3>
                                Ofertas recibidas
                            </h3>

                            <span id="offer-count">
                                ${offers.length} ofertas
                            </span>

                        </div>

                        <div id="offers-table">

                            ${buildOffersTable(offers)}

                        </div>

                    </div>

                </div>


                <aside class="auction-sidebar">

                    <div class="auction-bid-card">

                        <span class="eyebrow">
                            HACER OFERTA
                        </span>

                        <h3>
                            Presentar oferta
                        </h3>

                        <form id="bid-form">

                            <label>
                                Valor de la oferta
                            </label>

                            <input
                                type="number"
                                id="bid-amount"
                                min="1"
                                required
                                placeholder="Ej. 3.500.000.000"
                            >

                            <button
                                type="submit"
                                class="btn btn-primary btn-large">
                                Enviar oferta
                            </button>

                        </form>

                        <p class="form-help">
                            La oferta queda registrada con fecha y hora.
                        </p>

                    </div>


                    <div class="auction-info">

                        <div>
                            <span>Valor nominal</span>
                            <strong>
                                ${formatCurrency(portfolio.amount)}
                            </strong>
                        </div>

                        <div>
                            <span>Descuento esperado</span>
                            <strong>
                                ${portfolio.discount}%
                            </strong>
                        </div>

                    </div>

                </aside>

            </div>
        `;
    }

    function buildOffersTable(offers) {

        if (!offers.length) {

            return `
                <div class="empty-state">
                    <p>
                        Aún no se han recibido ofertas.
                    </p>
                </div>
            `;
        }

        const sorted = [...offers].sort(
            (a, b) => b.amount - a.amount
        );

        return `
            <div class="offers-table">

                <div class="offer-row offer-head">

                    <span>Comprador</span>
                    <span>Oferta</span>
                    <span>Hora</span>

                </div>

                ${sorted.map((offer, index) => `

                    <div class="offer-row">

                        <span>
                            ${escapeHTML(offer.buyer)}
                            ${
                                index === 0
                                    ? `
                                    <span class="badge badge-success">
                                        Mejor oferta
                                    </span>
                                    `
                                    : ""
                            }
                        </span>

                        <strong>
                            ${formatCurrency(offer.amount)}
                        </strong>

                        <span>
                            ${formatTime(offer.createdAt)}
                        </span>

                    </div>

                `).join("")}

            </div>
        `;
    }

    function formatTime(date) {

        return new Date(date).toLocaleTimeString(
            "es-CO",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );
    }

    /* ========================================================
       EVENTOS DEL DETALLE
       ======================================================== */

    function initializeDetailEvents(portfolio) {

        const overlay = document.querySelector("#detail-overlay");

        /* Cerrar */

        document
            .querySelector("#close-detail")
            ?.addEventListener("click", closePortfolioDetail);


        /* Tabs */

        document
            .querySelectorAll(".detail-tab")
            .forEach(tab => {

                tab.addEventListener("click", () => {

                    const target = tab.dataset.tab;

                    document
                        .querySelectorAll(".detail-tab")
                        .forEach(t =>
                            t.classList.remove("active")
                        );

                    document
                        .querySelectorAll(".detail-tab-content")
                        .forEach(content =>
                            content.classList.remove("active")
                        );

                    tab.classList.add("active");

                    document
                        .querySelector(`#tab-${target}`)
                        ?.classList.add("active");

                    if (target === "auction") {
                        initializeAuction(portfolio);
                    }

                });

            });


        /* Descargar resumen */

        document
            .querySelector("#download-summary")
            ?.addEventListener("click", () => {

                downloadPortfolioSummary(portfolio);

            });


        /* Presentar oferta */

        document
            .querySelector("#open-offer-form")
            ?.addEventListener("click", () => {

                const auctionTab =
                    document.querySelector('[data-tab="auction"]');

                auctionTab?.click();

            });


        /* Duraciones */

        document
            .querySelectorAll(".duration-option")
            .forEach(option => {

                option.addEventListener("click", () => {

                    document
                        .querySelectorAll(".duration-option")
                        .forEach(item =>
                            item.classList.remove("active")
                        );

                    option.classList.add("active");

                });

            });


        /* Iniciar subasta */

        document
            .querySelector("#start-auction")
            ?.addEventListener("click", () => {

                const selected =
                    document.querySelector(
                        ".duration-option.active"
                    );

                const duration =
                    Number(selected?.dataset.duration || 15);

                startAuction(
                    portfolio.id,
                    duration
                );

            });


        /* Reiniciar */

        document
            .querySelector("#restart-auction")
            ?.addEventListener("click", () => {

                startAuction(
                    portfolio.id,
                    15
                );

            });


        /* Cerrar haciendo click fuera */

        overlay?.addEventListener("click", event => {

            if (event.target === overlay) {
                closePortfolioDetail();
            }

        });

    }

    function closePortfolioDetail() {

        const overlay =
            document.querySelector("#detail-overlay");

        overlay?.classList.remove("active");

        document.body.classList.remove("modal-open");

        stopAuctionTimer();
    }

    /* ========================================================
       MOTOR DE SUBASTA
       ======================================================== */

    function getAuction(portfolioId) {

        const auctions =
            getStorage(STORAGE_AUCTIONS, []);

        return auctions.find(
            auction => auction.portfolioId === portfolioId
        ) || null;
    }

    function saveAuction(auction) {

        const auctions =
            getStorage(STORAGE_AUCTIONS, []);

        const index =
            auctions.findIndex(
                item =>
                    item.portfolioId === auction.portfolioId
            );

        if (index >= 0) {
            auctions[index] = auction;
        } else {
            auctions.push(auction);
        }

        saveStorage(
            STORAGE_AUCTIONS,
            auctions
        );
    }

    function startAuction(
        portfolioId,
        duration
    ) {

        const now = Date.now();

        const endsAt =
            now + duration * 60 * 1000;

        const auction = {

            portfolioId,

            status: "active",

            duration,

            startedAt: now,

            endsAt,

            id:
                "AUC-" +
                Date.now()

        };

        saveAuction(auction);

        updatePortfolioStage(
            portfolioId,
            "auction",
            "Subasta activa"
        );

        renderPortfolios();

        openPortfolioDetail(portfolioId);

        showNotification(
            `Subasta iniciada por ${duration} minutos.`
        );
    }

    function initializeAuction(portfolio) {

        stopAuctionTimer();

        const auction =
            getAuction(portfolio.id);

        if (!auction || auction.status !== "active") {
            return;
        }

        updateAuctionClock(
            portfolio.id,
            auction
        );

        auctionTimer = setInterval(() => {

            updateAuctionClock(
                portfolio.id,
                auction
            );

        }, 1000);
    }

    function updateAuctionClock(
        portfolioId,
        auction
    ) {

        const clock =
            document.querySelector("#auction-clock");

        if (!clock) return;

        const remaining =
            auction.endsAt - Date.now();

        if (remaining <= 0) {

            finishAuction(portfolioId);

            return;
        }

        const totalSeconds =
            Math.floor(remaining / 1000);

        const minutes =
            Math.floor(totalSeconds / 60);

        const seconds =
            totalSeconds % 60;

        clock.textContent =
            `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function finishAuction(portfolioId) {

        stopAuctionTimer();

        const offers =
            getOffers(portfolioId);

        const auction =
            getAuction(portfolioId);

        if (!auction) return;

        if (offers.length === 0) {

            auction.status = "deserted";

            saveAuction(auction);

            updatePortfolioStage(
                portfolioId,
                "deserted",
                "Subasta desierta"
            );

            showNotification(
                "La subasta terminó sin ofertas."
            );

        } else {

            auction.status = "finished";

            saveAuction(auction);

            updatePortfolioStage(
                portfolioId,
                "awarded",
                "Subasta finalizada"
            );

            showNotification(
                "La subasta terminó y tiene ofertas."
            );
        }

        renderPortfolios();

        openPortfolioDetail(portfolioId);
    }

    function stopAuctionTimer() {

        if (auctionTimer) {

            clearInterval(auctionTimer);

            auctionTimer = null;
        }
    }

    /* ========================================================
       OFERTAS
       ======================================================== */

    function getOffers(portfolioId) {

        const offers =
            getStorage(STORAGE_OFFERS, []);

        return offers.filter(
            offer =>
                offer.portfolioId === portfolioId
        );
    }

    function getBestOffer(offers) {

        if (!offers.length) return null;

        return [...offers].sort(
            (a, b) =>
                b.amount - a.amount
        )[0];
    }

    function saveOffer(offer) {

        const offers =
            getStorage(STORAGE_OFFERS, []);

        offers.push(offer);

        saveStorage(
            STORAGE_OFFERS,
            offers
        );
    }

    function submitBid(
        portfolioId,
        amount
    ) {

        const auction =
            getAuction(portfolioId);

        if (!auction || auction.status !== "active") {

            showNotification(
                "La subasta ya no está activa."
            );

            return;
        }

        if (Date.now() >= auction.endsAt) {

            finishAuction(portfolioId);

            return;
        }

        const user =
            getStorage(
                STORAGE_USER,
                null
            );

        const buyer =
            user?.company ||
            user?.name ||
            "Comprador registrado";

        const offer = {

            id:
                "OFF-" +
                Date.now(),

            portfolioId,

            buyer,

            amount: Number(amount),

            createdAt:
                new Date().toISOString()

        };

        saveOffer(offer);

        showNotification(
            "Oferta enviada correctamente."
        );

        refreshAuctionView(portfolioId);
    }

    function refreshAuctionView(portfolioId) {

        const portfolio =
            portfolios.find(
                p => p.id === portfolioId
            );

        if (!portfolio) return;

        openPortfolioDetail(portfolioId);

        setTimeout(() => {

            document
                .querySelector('[data-tab="auction"]')
                ?.click();

        }, 50);
    }

    /* ========================================================
       FORMULARIO DE OFERTA
       ======================================================== */

    document.addEventListener("submit", event => {

        if (event.target.id !== "bid-form") {
            return;
        }

        event.preventDefault();

        const input =
            document.querySelector("#bid-amount");

        const amount =
            Number(input?.value);

        if (!amount || amount <= 0) {

            showNotification(
                "Ingresa un valor válido."
            );

            return;
        }

        const portfolioId =
            getCurrentPortfolioId();

        if (!portfolioId) return;

        submitBid(
            portfolioId,
            amount
        );

    });

    function getCurrentPortfolioId() {

        const overlay =
            document.querySelector("#detail-overlay");

        if (!overlay) return null;

        const activePortfolio =
            portfolios.find(
                portfolio => {

                    const title =
                        overlay.querySelector(
                            ".portfolio-hero h1"
                        );

                    return title &&
                        title.textContent.trim() ===
                        portfolio.name;
                }
            );

        return activePortfolio?.id || null;
    }

    /* ========================================================
       ACTUALIZAR ETAPA
       ======================================================== */

    function updatePortfolioStage(
        portfolioId,
        stage,
        status
    ) {

        const portfolio =
            portfolios.find(
                p => p.id === portfolioId
            );

        if (!portfolio) return;

        portfolio.stage = stage;

        portfolio.status = status;

        saveStorage(
            STORAGE_PORTFOLIOS,
            portfolios
        );
    }

    /* ========================================================
       REGISTRO DE USUARIOS
       ======================================================== */

    window.openRegistration = function (
        type = "buyer"
    ) {

        const overlay =
            document.createElement("div");

        overlay.id = "registration-overlay";

        overlay.className =
            "detail-overlay active";

        overlay.innerHTML = buildRegistration(type);

        document.body.appendChild(overlay);

        initializeRegistrationEvents(
            type
        );
    };

    function buildRegistration(type) {

        const isBuyer =
            type === "buyer";

        return `

            <div class="detail-modal auth-modal">

                <header class="detail-header">

                    <h2>
                        ${
                            isBuyer
                                ? "Registro de comprador"
                                : "Registro de vendedor"
                        }
                    </h2>

                    <button
                        class="btn btn-secondary"
                        id="close-registration">
                        Cerrar
                    </button>

                </header>


                <main class="auth-container">

                    <div class="auth-intro">

                        <span class="eyebrow">
                            B²GC BROKERS
                        </span>

                        <h1>
                            ${
                                isBuyer
                                    ? "Registra tu empresa para comprar portafolios"
                                    : "Registra tu empresa para vender portafolios"
                            }
                        </h1>

                        <p>
                            Completa la información para iniciar
                            el proceso de validación.
                        </p>

                    </div>


                    <div class="auth-steps">

                        <div class="auth-step active">
                            <span>1</span>
                            Empresa
                        </div>

                        <div class="auth-step">
                            <span>2</span>
                            Contacto
                        </div>

                        <div class="auth-step">
                            <span>3</span>
                            Validación
                        </div>

                        <div class="auth-step">
                            <span>4</span>
                            Cuenta
                        </div>

                    </div>


                    <form
                        id="registration-form"
                        data-type="${type}">

                        <div class="form-grid">

                            <div class="form-field">

                                <label>
                                    Razón social
                                </label>

                                <input
                                    name="company"
                                    required
                                    placeholder="Nombre de la empresa">

                            </div>


                            <div class="form-field">

                                <label>
                                    NIT
                                </label>

                                <input
                                    name="nit"
                                    required
                                    placeholder="900000000-0">

                            </div>


                            <div class="form-field">

                                <label>
                                    Nombre del representante
                                </label>

                                <input
                                    name="representative"
                                    required
                                    placeholder="Nombre completo">

                            </div>


                            <div class="form-field">

                                <label>
                                    Cargo
                                </label>

                                <input
                                    name="position"
                                    required
                                    placeholder="Cargo">

                            </div>


                            <div class="form-field">

                                <label>
                                    Correo corporativo
                                </label>

                                <input
                                    type="email"
                                    name="email"
                                    required
                                    placeholder="correo@empresa.com">

                            </div>


                            <div class="form-field">

                                <label>
                                    Teléfono
                                </label>

                                <input
                                    name="phone"
                                    required
                                    placeholder="+57">

                            </div>


                            <div class="form-field full">

                                <label>
                                    Ciudad
                                </label>

                                <input
                                    name="city"
                                    required
                                    placeholder="Bogotá">

                            </div>

                        </div>


                        <div class="form-actions">

                            <button
                                type="submit"
                                class="btn btn-primary btn-large">
                                Continuar registro
                            </button>

                        </div>

                    </form>

                </main>

            </div>

        `;
    }

    function initializeRegistrationEvents(type) {

        document
            .querySelector("#close-registration")
            ?.addEventListener(
                "click",
                () => {

                    document
                        .querySelector(
                            "#registration-overlay"
                        )
                        ?.remove();

                }
            );


        document
            .querySelector("#registration-form")
            ?.addEventListener(
                "submit",
                event => {

                    event.preventDefault();

                    const form =
                        event.target;

                    const data =
                        Object.fromEntries(
                            new FormData(form)
                        );

                    data.type = type;

                    saveStorage(
                        STORAGE_USER,
                        data
                    );

                    showNotification(
                        "Registro guardado correctamente."
                    );

                    document
                        .querySelector(
                            "#registration-overlay"
                        )
                        ?.remove();

                }
            );
    }

    /* ========================================================
       RESUMEN DESCARGABLE
       ======================================================== */

    function downloadPortfolioSummary(
        portfolio
    ) {

        const text = `

B²GC BROKERS
RESUMEN DE PORTAFOLIO

ID:
${portfolio.id}

PORTAFOLIO:
${portfolio.name}

VENDEDOR:
${portfolio.seller}

TIPO:
${portfolio.type}

CIUDAD:
${portfolio.city}

VALOR NOMINAL:
${formatCurrency(portfolio.amount)}

DESCUENTO:
${portfolio.discount}%

DEUDORES:
${formatNumber(portfolio.debtors)}

ESTADO:
${portfolio.status}

FECHA:
${formatDate(portfolio.createdAt)}

        `.trim();

        const blob =
            new Blob(
                [text],
                {
                    type: "text/plain;charset=utf-8"
                }
            );

        const url =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = url;

        link.download =
            `${portfolio.id}-resumen.txt`;

        link.click();

        URL.revokeObjectURL(url);
    }

    /* ========================================================
       NOTIFICACIONES
       ======================================================== */

    function showNotification(message) {

        let notification =
            document.querySelector(
                "#b2gc-notification"
            );

        if (!notification) {

            notification =
                document.createElement("div");

            notification.id =
                "b2gc-notification";

            document.body.appendChild(
                notification
            );
        }

        notification.textContent =
            message;

        notification.classList.add(
            "show"
        );

        setTimeout(() => {

            notification.classList.remove(
                "show"
            );

        }, 3000);
    }

});
