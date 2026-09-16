/* =========================================================
   B²GC BROKERS
   APP.JS COMPLETO
   Dashboard + Simulador + Gráficas
   ========================================================= */


/* =========================================================
   VARIABLES GLOBALES
   ========================================================= */

let currentAuthMode = "login";
let currentRole = "originador";
let currentDetail = null;
let toastTimer = null;


/* =========================================================
   ESTADO DE LA APLICACIÓN
   ========================================================= */

const DEMO_STORAGE_KEY = "b2gc_demo_state_v2";

const demoAccounts = {
    originador: {
        email: "originador@demo.b2gc.co",
        password: "Demo123!",
        company: "Originador Demo S.A.S.",
        avatar: "OD"
    },
    comprador: {
        email: "comprador@demo.b2gc.co",
        password: "Demo123!",
        company: "Comprador Demo S.A.S.",
        avatar: "CD"
    }
};

const appState = {
    loggedIn: false,
    demoMode: true,
    company: "Originador Demo S.A.S.",
    avatar: "OD",
    userEmail: demoAccounts.originador.email,
    originador: {
        stats: {
            cartera: "$18.420 M",
            operaciones: "126",
            compradores: "47",
            cierre: "82%"
        }
    },
    comprador: {
        stats: {
            oportunidades: "32",
            ofertas: "14",
            adjudicadas: "8",
            cierre: "76%"
        }
    },
    offers: [],
    uploadedDocuments: []
};

const originatorLots = [
    {
        id: "LOTE-TEST-001",
        title: "Cartera de consumo — Demo",
        originador: "Originador Demo S.A.S.",
        type: "Consumo", amount: "$4.850 M", discount: "18%", debtors: "2.840",
        status: "Subasta activa", statusClass: "badge-green", modality: "Subasta privada", deadline: "18 Sep 2026", score: "A+"
    },
    {
        id: "LOTE-TEST-002",
        title: "Cartera libranza — Demo",
        originador: "Originador Demo S.A.S.",
        type: "Libranza", amount: "$3.240 M", discount: "15%", debtors: "1.460",
        status: "En negociación", statusClass: "badge-blue", modality: "Compra directa", deadline: "22 Sep 2026", score: "A"
    },
    {
        id: "LOTE-TEST-003",
        title: "Cartera comercial — Demo",
        originador: "Originador Demo S.A.S.",
        type: "Comercial", amount: "$6.780 M", discount: "22%", debtors: "860",
        status: "Data room abierto", statusClass: "badge-blue", modality: "Híbrida", deadline: "25 Sep 2026", score: "B+"
    }
];

const lots = [
    {
        id: "LOTE-TEST-001",
        title: "Cartera de consumo — Demo",
        originador: "Entidad Financiera Demo A",
        type: "Consumo",
        amount: "$4.850 M",
        discount: "18%",
        debtors: "2.840",
        status: "Subasta activa",
        statusClass: "badge-green",
        modality: "Subasta privada",
        deadline: "18 Sep 2026",
        score: "A+"
    },
    {
        id: "LOTE-TEST-002",
        title: "Cartera libranza — Demo",
        originador: "Entidad Financiera Demo B",
        type: "Libranza",
        amount: "$3.240 M",
        discount: "15%",
        debtors: "1.460",
        status: "En negociación",
        statusClass: "badge-blue",
        modality: "Compra directa",
        deadline: "22 Sep 2026",
        score: "A"
    },
    {
        id: "LOTE-TEST-003",
        title: "Cartera comercial — Demo",
        originador: "Entidad Financiera Demo C",
        type: "Comercial",
        amount: "$6.780 M",
        discount: "22%",
        debtors: "860",
        status: "Precalificación",
        statusClass: "badge-gold",
        modality: "Híbrida",
        deadline: "25 Sep 2026",
        score: "B+"
    },
    {
        id: "LOTE-TEST-004",
        title: "Cartera hipotecaria — Demo",
        originador: "Entidad Financiera Demo D",
        type: "Hipotecaria",
        amount: "$8.920 M",
        discount: "12%",
        debtors: "420",
        status: "Data room abierto",
        statusClass: "badge-blue",
        modality: "Subasta privada",
        deadline: "30 Sep 2026",
        score: "A+"
    },
    {
        id: "LOTE-TEST-005",
        title: "Cartera pyme — Demo",
        originador: "Originador Demo E",
        type: "PYME",
        amount: "$2.160 M",
        discount: "20%",
        debtors: "315",
        status: "Nueva",
        statusClass: "badge-green",
        modality: "Compra directa",
        deadline: "02 Oct 2026",
        score: "A"
    }
];

const buyerOpportunities = lots.map(lot => ({ ...lot }));

const testDocuments = [
    { id: "DOC-TEST-001", name: "Resumen ejecutivo", type: "PDF", size: "320 KB", category: "Comercial", lotId: "LOTE-TEST-001", status: "Disponible", content: "RESUMEN EJECUTIVO — LOTE-TEST-001\n\nDocumento ficticio para pruebas de B²GC Brokers.\n\nValor nominal: $4.850 M\nTipo: Consumo\nModalidad: Subasta privada\nCalificación: A+\n\nEste documento no contiene información real y solo debe utilizarse para pruebas." },
    { id: "DOC-TEST-002", name: "Base anonimizada", type: "XLSX", size: "1,2 MB", category: "Datos", lotId: "LOTE-TEST-001", status: "Disponible", content: "BASE ANONIMIZADA — LOTE-TEST-001\n\nArchivo de prueba. Registros ficticios: 2.840 deudores anonimizados.\nNo contiene PII real." },
    { id: "DOC-TEST-003", name: "Información de saldos", type: "PDF", size: "540 KB", category: "Financiero", lotId: "LOTE-TEST-002", status: "Disponible", content: "INFORMACIÓN DE SALDOS — LOTE-TEST-002\n\nSaldo nominal de prueba: $3.240 M\nDeudores de prueba: 1.460\nTipo: Libranza\n\nInformación ficticia para validar el flujo documental." },
    { id: "DOC-TEST-004", name: "Metodología de valoración", type: "DOCX", size: "210 KB", category: "Valoración", lotId: "LOTE-TEST-003", status: "Disponible", content: "METODOLOGÍA DE VALORACIÓN — DEMO\n\nModelo ilustrativo para pruebas. La valoración utiliza escenarios y porcentajes configurables dentro del simulador." },
    { id: "DOC-TEST-005", name: "Documentación jurídica", type: "PDF", size: "760 KB", category: "Legal", lotId: "LOTE-TEST-004", status: "Disponible", content: "DOCUMENTACIÓN JURÍDICA — DEMO\n\nChecklist jurídico ficticio: contrato, certificaciones y anexos.\nEstado de prueba: documentación disponible para revisión." },
    { id: "DOC-TEST-006", name: "Certificación de cartera", type: "PDF", size: "430 KB", category: "Legal", lotId: "LOTE-TEST-005", status: "Disponible", content: "CERTIFICACIÓN DE CARTERA — LOTE-TEST-005\n\nDocumento ficticio para validar consulta, descarga y trazabilidad." }
];

function loadDemoState() {
    try {
        const saved = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || "null");
        if (saved && Array.isArray(saved.offers)) {
            appState.offers = saved.offers;
        }
        if (saved && Array.isArray(saved.uploadedDocuments)) {
            appState.uploadedDocuments = saved.uploadedDocuments;
        }
    } catch (error) {
        console.warn("No fue posible cargar el estado demo.", error);
        appState.offers = [];
    }
}

function saveDemoState() {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({
        offers: appState.offers,
        uploadedDocuments: appState.uploadedDocuments
    }));
}

function resetDemoData() {
    appState.offers = [];
    appState.uploadedDocuments = [];
    saveDemoState();
    showToast("Datos de prueba restaurados.");
    if (appState.loggedIn) {
        const page = document.querySelector("#page-h1")?.textContent || "";
        if (page === "Centro de pruebas") {
            renderPage("pruebas");
        } else {
            setRole(currentRole);
        }
    }
}

loadDemoState();


/* =========================================================
   SELECTORES
   ========================================================= */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => document.querySelectorAll(selector);


/* =========================================================
   AUTENTICACIÓN
   ========================================================= */

function openAuth(mode = "login") {

    currentAuthMode = mode;

    const overlay = $("#auth-overlay");
    const title = $("#auth-title");
    const subtitle = $("#auth-sub");
    const switchText = $("#auth-switch");
    const rolePick = $("#role-pick");

    if (!overlay) return;

    overlay.classList.remove("hidden");


    if (mode === "register") {

        if (title) {
            title.textContent = "Crear cuenta";
        }

        if (subtitle) {
            subtitle.textContent =
                "Registra tu empresa y comienza a operar en B²GC Brokers.";
        }

        if (switchText) {

            switchText.innerHTML =
                '¿Ya tienes una cuenta? <button class="btn-text" onclick="openAuth(\'login\')">Inicia sesión</button>';

        }

        if (rolePick) {
            rolePick.classList.remove("hidden");
        }

    } else {

        if (title) {
            title.textContent = "Iniciar sesión";
        }

        if (subtitle) {
            subtitle.textContent =
                "Accede a tu cuenta de B²GC Brokers.";
        }

        if (switchText) {

            switchText.innerHTML =
                '¿Aún no tienes cuenta? <button class="btn-text" onclick="openAuth(\'register\')">Regístrate</button>';

        }

        if (rolePick) {
            rolePick.classList.remove("hidden");
        }

    }


    setTimeout(() => {

        const email = $("#auth-email");

        if (email) {
            email.focus();
        }

    }, 150);

}


/* =========================================================
   CERRAR AUTENTICACIÓN
   ========================================================= */

function closeAuth() {

    const overlay = $("#auth-overlay");

    if (overlay) {
        overlay.classList.add("hidden");
    }

}


/* =========================================================
   SELECCIONAR ROL
   ========================================================= */

function pickRole(element, role) {

    currentRole = role;

    $$(".role-opt").forEach(item => {

        item.classList.remove("active");

    });


    if (element) {
        element.classList.add("active");
    }

}


/* =========================================================
   ENTRAR A LA PLATAFORMA
   ========================================================= */

function enterApp() {
    const email = $("#auth-email");
    const password = $("#auth-password");

    const emailValue = email ? email.value.trim().toLowerCase() : "";
    const passwordValue = password ? password.value : "";

    if (!emailValue) {
        showToast("Ingresa tu correo corporativo.");
        email?.focus();
        return;
    }

    if (!passwordValue) {
        showToast("Ingresa tu contraseña.");
        password?.focus();
        return;
    }

    const demoAccount = demoAccounts[currentRole];

    if (
        emailValue !== demoAccount.email ||
        passwordValue !== demoAccount.password
    ) {
        showToast(
            `Credenciales de prueba: ${demoAccount.email} / ${demoAccount.password}`
        );
        return;
    }

    appState.loggedIn = true;
    appState.demoMode = true;
    appState.userEmail = emailValue;
    appState.company = demoAccount.company;
    appState.avatar = demoAccount.avatar;

    closeAuth();

    const publicSite = $("#public-site");
    const appShell = $("#app-shell");

    publicSite?.classList.add("hidden");
    appShell?.classList.remove("hidden");

    setRole(currentRole);

    showToast(
        currentRole === "originador"
            ? "Bienvenido al entorno de pruebas como originador."
            : "Bienvenido al entorno de pruebas como comprador."
    );
}

/* =========================================================
   SALIR DE LA PLATAFORMA
   ========================================================= */

function exitApp() {

    appState.loggedIn = false;


    const publicSite = $("#public-site");
    const appShell = $("#app-shell");


    if (appShell) {
        appShell.classList.add("hidden");
    }


    if (publicSite) {
        publicSite.classList.remove("hidden");
    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    showToast("Has salido de la plataforma.");

}


/* =========================================================
   CAMBIAR ROL
   ========================================================= */

function setRole(role) {

    currentRole = role;

    const account = demoAccounts[role];
    if (account) {
        appState.company = account.company;
        appState.avatar = account.avatar;
    }

    const companyName = $("#company-name");
    const avatar = $(".avatar");
    if (companyName) companyName.textContent = appState.company;
    if (avatar) avatar.textContent = appState.avatar;

    const originadorButton = $("#rt-originador");
    const compradorButton = $("#rt-comprador");


    if (originadorButton) {

        originadorButton.classList.toggle(
            "active",
            role === "originador"
        );

    }


    if (compradorButton) {

        compradorButton.classList.toggle(
            "active",
            role === "comprador"
        );

    }


    buildSidebar();

    renderDashboard();

}


/* =========================================================
   SIDEBAR
   ========================================================= */

function buildSidebar() {

    const nav = $("#sidebar-nav");

    if (!nav) return;


    if (currentRole === "originador") {

        nav.innerHTML = `

            <a href="#" class="active"
               onclick="navigate(event,'dashboard')">

                <span>▦</span>
                Dashboard

            </a>


            <a href="#"
               onclick="navigate(event,'cartera')">

                <span>◫</span>
                Mis carteras

            </a>


            <a href="#"
               onclick="navigate(event,'oportunidades')">

                <span>◇</span>
                Interés de compradores

            </a>


            <a href="#"
               onclick="navigate(event,'negociaciones')">

                <span>⇄</span>
                Negociaciones

            </a>


            <a href="#"
               onclick="navigate(event,'documentos')">

                <span>□</span>
                Documentos y cierre

            </a>


            <a href="#"
               onclick="navigate(event,'reportes')">

                <span>▥</span>
                Reportes

            </a>

            <a href="#"
               onclick="navigate(event,'pruebas')">

                <span>✓</span>
                Pruebas

            </a>


            <div class="sidebar-market-status">

                <div class="status-title">
                    Mercado activo
                </div>

                <p>
                    47 compradores conectados
                </p>

            </div>

        `;

    } else {

        nav.innerHTML = `

            <a href="#" class="active"
               onclick="navigate(event,'dashboard')">

                <span>▦</span>
                Dashboard

            </a>


            <a href="#"
               onclick="navigate(event,'mercado')">

                <span>◇</span>
                Mercado

            </a>


            <a href="#"
               onclick="navigate(event,'ofertas')">

                <span>⇄</span>
                Mis ofertas

            </a>


            <a href="#"
               onclick="navigate(event,'adjudicaciones')">

                <span>✓</span>
                Adjudicaciones

            </a>


            <a href="#"
               onclick="navigate(event,'dataroom')">

                <span>□</span>
                Data room

            </a>


            <a href="#"
               onclick="navigate(event,'reportes')">

                <span>▥</span>
                Reportes

            </a>

            <a href="#"
               onclick="navigate(event,'pruebas')">

                <span>✓</span>
                Pruebas

            </a>


            <div class="sidebar-market-status">

                <div class="status-title">
                    Mercado activo
                </div>

                <p>
                    32 oportunidades disponibles
                </p>

            </div>

        `;

    }

}


/* =========================================================
   NAVEGACIÓN
   ========================================================= */

function navigate(event, page) {

    if (event) {
        event.preventDefault();
    }


    const pageTitle = $("#page-h1");


    $$("#sidebar-nav a").forEach(link => {

        link.classList.remove("active");

    });


    if (event && event.currentTarget) {

        event.currentTarget.classList.add("active");

    }


    const titles = {

        dashboard: "Dashboard",

        cartera: "Mis carteras",

        oportunidades: "Oportunidades",

        negociaciones: "Negociaciones",

        documentos: "Documentos",

        reportes: "Reportes",

        mercado: "Mercado de oportunidades",

        ofertas: "Mis ofertas",

        adjudicaciones: "Adjudicaciones",

        dataroom: "Data room"

    };


    if (pageTitle) {

        pageTitle.textContent =
            titles[page] || "Dashboard";

    }


    if (page === "dashboard") {

        renderDashboard();

    } else {

        renderPage(page);

    }

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {
    const content = $("#content");
    if (!content) return;

    const isOriginator = currentRole === "originador";
    const roleData = isOriginator ? {
        kicker: "VISTA GENERAL DEL ORIGINADOR",
        title: "Controla tu cartera y tus procesos de venta.",
        description: "Publica portafolios, revisa compradores, gestiona negociaciones y acompaña el cierre documental.",
        kpis: [
            ["Valor de cartera publicada", "$18.420 M", "↗ +12.8% este mes"],
            ["Operaciones gestionadas", "126", "↗ +8.4% vs. periodo anterior"],
            ["Compradores interesados", "47", "↗ +6 nuevos"],
            ["Tasa de cierre", "82%", "↗ +4.2 puntos"]
        ]
    } : {
        kicker: "VISTA GENERAL DEL COMPRADOR",
        title: "Encuentra, analiza y oferta en nuevas oportunidades.",
        description: "Explora cartera disponible, revisa data rooms, presenta ofertas y haz seguimiento a tus adjudicaciones.",
        kpis: [
            ["Oportunidades disponibles", "32", "↗ 7 nuevas hoy"],
            ["Ofertas realizadas", "14", "↗ +3 esta semana"],
            ["Adjudicaciones", "8", "↗ +2 este mes"],
            ["Tasa de cierre", "76%", "↗ +3.8 puntos"]
        ]
    };

    content.innerHTML = `
        <div class="dashboard-welcome reveal visible">
            <div style="margin-bottom:25px;">
                <div class="section-kicker">${roleData.kicker}</div>
                <h2 style="font-size:30px;letter-spacing:-1px;color:var(--navy);margin-top:5px;">${roleData.title}</h2>
                <p style="color:var(--muted);font-size:13px;margin-top:5px;">${roleData.description}</p>
            </div>
            <div class="kpi-grid">
                ${roleData.kpis.map(k => kpiCard(k[0], k[1], k[2], "up")).join("")}
            </div>
            ${renderDashboardCharts(currentRole)}
            ${renderLotsCard()}
        </div>`;

    initReveal();
}


/* =========================================================
   KPI CARD
   ========================================================= */

function kpiCard(
    label,
    value,
    change,
    direction = "up"
) {

    return `

        <div class="kpi-card">

            <div class="label">
                ${label}
            </div>

            <div class="value">
                ${value}
            </div>

            <div class="change ${
                direction === "down"
                    ? "down"
                    : ""
            }">

                ${change}

            </div>

        </div>

    `;

}


/* =========================================================
   DASHBOARD GRÁFICAS
   ========================================================= */

function renderDashboardCharts(role) {
    const isOriginator = role === "originador";
    const data = isOriginator ? {
        lineKicker: "TU CARTERA", lineTitle: "Valor de cartera publicada", lineSubtitle: "Evolución de tu portafolio en los últimos 7 meses",
        values: [12400, 13200, 14800, 15600, 16900, 17500, 18420],
        donutKicker: "TU PORTAFOLIO", donutTitle: "Distribución por tipo", donutTotal: "126", donutLabel: "operaciones",
        donut: [["Consumo",42],["Libranza",28],["Comercial",18],["Hipotecaria",12]],
        activityTitle: "Operaciones gestionadas",
        statusTitle: "Estado de tus operaciones",
        statuses: [["En mercado",36,"active"],["En negociación",18,"negotiation"],["Cerradas",72,"completed"]]
    } : {
        lineKicker: "MERCADO PARA TI", lineTitle: "Valor de oportunidades", lineSubtitle: "Valor nominal de las oportunidades que puedes analizar",
        values: [10800, 11600, 12150, 13400, 14200, 15100, 15950],
        donutKicker: "MERCADO DISPONIBLE", donutTitle: "Tipos de oportunidad", donutTotal: "32", donutLabel: "oportunidades",
        donut: [["Consumo",34],["Libranza",27],["Comercial",23],["Hipotecaria",16]],
        activityTitle: "Actividad de compras",
        statusTitle: "Tu pipeline de compra",
        statuses: [["Disponibles",32,"active"],["Con oferta",14,"negotiation"],["Adjudicadas",8,"completed"]]
    };

    const max = 20000;
    const points = data.values.map((v,i) => {
        const x = (700/(data.values.length-1))*i;
        const y = 245 - (v/max)*205;
        return [x,y];
    });
    const linePath = points.map(([x,y],i) => `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L700,260 L0,260 Z`;
    const months = ["Mar","Abr","May","Jun","Jul","Ago","Sep"];

    return `
        <div class="dashboard-chart-grid">
            <div class="dashboard-chart-card dashboard-chart-large">
                <div class="dashboard-chart-header"><div><div class="chart-kicker">${data.lineKicker}</div><h3>${data.lineTitle}</h3><p>${data.lineSubtitle}</p></div><div class="chart-period">Mar — Sep 2026</div></div>
                <div class="line-chart">
                    <div class="line-chart-y"><span>20.000 M</span><span>15.000 M</span><span>10.000 M</span><span>5.000 M</span><span>0</span></div>
                    <div class="line-chart-area"><div class="chart-lines"><span></span><span></span><span></span><span></span><span></span></div>
                        <svg viewBox="0 0 700 260" preserveAspectRatio="none" class="market-line-svg" aria-label="${escapeHtml(data.lineTitle)}">
                            <defs><linearGradient id="marketGradient-${role}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-opacity=".22"/><stop offset="100%" stop-opacity="0"/></linearGradient></defs>
                            <path class="market-area" fill="url(#marketGradient-${role})" d="${areaPath}"></path>
                            <path class="market-line" d="${linePath}"></path>
                            <circle cx="${points.at(-1)[0]}" cy="${points.at(-1)[1]}" r="6" class="chart-current-point"></circle>
                        </svg>
                        <div class="line-chart-x">${months.map(m=>`<span>${m}</span>`).join("")}</div>
                    </div>
                </div>
            </div>

            <div class="dashboard-chart-card">
                <div class="dashboard-chart-header"><div><div class="chart-kicker">${data.donutKicker}</div><h3>${data.donutTitle}</h3></div></div>
                <div class="portfolio-donut-wrap"><div class="portfolio-donut role-${role}"><div class="portfolio-donut-center"><strong>${data.donutTotal}</strong><span>${data.donutLabel}</span></div></div></div>
                <div class="portfolio-legend">${data.donut.map((item,i)=>`<div><i class="legend-${i}"></i><span>${item[0]}</span><strong>${item[1]}%</strong></div>`).join("")}</div>
            </div>

            <div class="dashboard-chart-card">
                <div class="dashboard-chart-header"><div><div class="chart-kicker">ACTIVIDAD</div><h3>${data.activityTitle}</h3></div></div>
                <div class="activity-chart">${renderActivityBars(role)}</div>
            </div>

            <div class="dashboard-chart-card">
                <div class="dashboard-chart-header"><div><div class="chart-kicker">SEGUIMIENTO</div><h3>${data.statusTitle}</h3></div></div>
                <div class="status-summary">${data.statuses.map((item)=>`<div class="status-row"><div class="status-name"><span class="status-dot ${item[2]}"></span>${item[0]}</div><strong>${item[1]}</strong></div><div class="status-progress"><span style="width:${Math.min(100, item[1] / Math.max(...data.statuses.map(s=>s[1])) * 100)}%"></span></div>`).join("")}</div>
            </div>
        </div>`;
}


/* =========================================================
   BARRAS DEL DASHBOARD
   ========================================================= */

function renderActivityBars(role) {

    const values =
        role === "originador"
            ? [48, 55, 62, 70, 66, 81, 88]
            : [38, 46, 58, 52, 70, 64, 84];


    const labels = [
        "Mar",
        "Abr",
        "May",
        "Jun",
        "Jul",
        "Ago",
        "Sep"
    ];


    return values.map((value, index) => `

        <div class="activity-column">

            <div
                class="activity-value"
                style="height:${value}%"
            ></div>

            <span>
                ${labels[index]}
            </span>

        </div>

    `).join("");

}


/* =========================================================
   TABLA DE LOTES
   ========================================================= */

function renderLotsCard() {
    const isOriginator = currentRole === "originador";
    const items = isOriginator ? originatorLots : buyerOpportunities;
    const title = isOriginator ? "Mis portafolios y operaciones" : "Oportunidades disponibles";
    const subtitle = isOriginator ? "Portafolios propios y procesos activos de prueba" : "Lotes que puedes analizar y ofertar";

    return `
        <div class="card">
            <div class="card-header"><div><h3>${title}</h3><p>${subtitle}</p></div>
                <button class="btn btn-ghost btn-small" onclick="navigate(event, currentRole === 'originador' ? 'cartera' : 'mercado')">Ver todo</button>
            </div>
            <div class="table-wrap"><table><thead><tr>
                <th>Lote</th><th>Tipo</th><th>Valor</th><th>${isOriginator ? 'Compradores' : 'Descuento'}</th><th>Modalidad</th><th>Estado</th><th></th>
            </tr></thead><tbody>
                ${items.map(lot=>`<tr><td><strong style="color:var(--navy);">${lot.id}</strong></td><td>${lot.type}</td><td><strong>${lot.amount}</strong></td><td>${isOriginator ? ({'LOTE-TEST-001':'18','LOTE-TEST-002':'11','LOTE-TEST-003':'7'}[lot.id] || '4') : lot.discount}</td><td>${lot.modality}</td><td><span class="badge ${lot.statusClass}">${lot.status}</span></td><td><button class="btn btn-ghost btn-small" onclick="openDetail('${lot.id}')">Ver</button></td></tr>`).join("")}
            </tbody></table></div>
        </div>`;
}


/* =========================================================
   PÁGINAS INTERNAS
   ========================================================= */

function renderPage(page) {
    const content = $("#content");
    if (!content) return;

    const data = {
        cartera: {
            title: "Mis carteras",
            description: "Portafolios publicados por el originador demo."
        },
        oportunidades: {
            title: currentRole === "originador" ? "Interés de compradores" : "Oportunidades",
            description: currentRole === "originador" ? "Compradores demo que han mostrado interés en tus portafolios." : "Oportunidades disponibles para analizar y ofertar."
        },
        negociaciones: {
            title: currentRole === "originador" ? "Negociaciones con compradores" : "Mis negociaciones",
            description: currentRole === "originador" ? "Seguimiento a propuestas recibidas y contrapropuestas de tus portafolios." : "Seguimiento a tus propuestas y contrapropuestas."
        },
        documentos: {
            title: currentRole === "originador" ? "Documentos y cierre" : "Documentos de oportunidades",
            description: currentRole === "originador" ? "Gestiona documentos de tus portafolios y soportes de cierre." : "Consulta la documentación disponible en los data rooms de prueba."
        },
        mercado: {
            title: "Mercado de oportunidades",
            description: "Lotes demo disponibles para explorar y ofertar."
        },
        ofertas: {
            title: "Mis ofertas",
            description: "Ofertas creadas durante las pruebas del comprador."
        },
        adjudicaciones: {
            title: currentRole === "originador" ? "Cierres de mis portafolios" : "Mis adjudicaciones",
            description: currentRole === "originador" ? "Procesos adjudicados y pendientes de cierre documental." : "Operaciones que has ganado o que están en proceso de cierre."
        },
        dataroom: {
            title: "Data room",
            description: "Documentos demo para validar el flujo de due diligence."
        },
        reportes: {
            title: "Reportes",
            description: "Indicadores simulados para validar visualizaciones."
        },
        pruebas: {
            title: "Centro de pruebas",
            description: "Herramientas para validar el prototipo sin usar datos reales."
        }
    };

    const current = data[page] || data.reportes;

    if (page === "pruebas") {
        content.innerHTML = renderTestCenter();
        runSelfTests(false);
        return;
    }

    if (page === "ofertas") {
        content.innerHTML = renderOffersPage();
        return;
    }

    if (["cartera", "oportunidades", "mercado"].includes(page)) {
        const items = currentRole === "originador" ? originatorLots : buyerOpportunities;
        const visibleItems = page === "cartera" && currentRole === "originador" ? originatorLots : items;
        content.innerHTML = `
            <div class="card page-card">
                <div class="section-kicker">DATOS DE PRUEBA · ${currentRole === "originador" ? "ORIGINADOR" : "COMPRADOR"}</div>
                <h2>${current.title}</h2>
                <p>${current.description}</p>
                <div class="test-lot-grid">
                    ${visibleItems.map(lot => `
                        <article class="test-lot-card">
                            <div class="lot-number">${lot.id}</div>
                            <h3>${lot.title}</h3>
                            <span>${lot.type} · ${lot.modality}</span>
                            <strong>${lot.amount}</strong>
                            <div class="test-lot-meta">
                                <span class="badge ${lot.statusClass}">${lot.status}</span>
                                <span>${lot.discount} descuento</span>
                            </div>
                            <button class="btn btn-ghost btn-small" onclick="openDetail('${lot.id}')">
                                Ver lote
                            </button>
                        </article>
                    `).join("")}
                </div>
            </div>
        `;
        return;
    }

    if (page === "negociaciones") {
        const rows = currentRole === "comprador" && appState.offers.length
            ? appState.offers
            : currentRole === "originador"
                ? [
                    { id: "NEG-ORIG-001", lotId: "LOTE-TEST-002", amount: "$2.754 M", status: "En revisión", date: "16 Sep 2026", counterparty: "Fondo Demo Andino" },
                    { id: "NEG-ORIG-002", lotId: "LOTE-TEST-003", amount: "$5.220 M", status: "Contrapropuesta", date: "15 Sep 2026", counterparty: "Inversiones Demo Capital" }
                ]
                : [
                    { id: "NEG-COMP-001", lotId: "LOTE-TEST-002", amount: "$2.754 M", status: "En revisión", date: "16 Sep 2026", counterparty: "Originador Demo S.A.S." },
                    { id: "NEG-COMP-002", lotId: "LOTE-TEST-003", amount: "$5.017 M", status: "Contrapropuesta", date: "15 Sep 2026", counterparty: "Entidad Financiera Demo C" }
                ];

        content.innerHTML = `
            <div class="card page-card">
                <div class="section-kicker">PIPELINE DEMO</div>
                <h2>${current.title}</h2>
                <p>${current.description}</p>
                <div class="table-wrap page-table">
                    <table>
                        <thead><tr><th>Proceso</th><th>Lote</th><th>Contraparte</th><th>Valor</th><th>Estado</th><th>Fecha</th></tr></thead>
                        <tbody>
                            ${rows.map(row => `
                                <tr>
                                    <td><strong>${row.id}</strong></td>
                                    <td>${row.lotId}</td>
                                    <td>${row.counterparty || "Originador / contraparte demo"}</td>
                                    <td>${row.amount}</td>
                                    <td><span class="badge badge-blue">${row.status}</span></td>
                                    <td>${row.date}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        return;
    }

    if (page === "documentos" || page === "dataroom") {
        content.innerHTML = renderDocumentsPage(page);
        return;
    }

    if (page === "adjudicaciones") {
        content.innerHTML = renderAdjudicationsPage();
        return;
    }

    if (page === "reportes") {
        content.innerHTML = renderReportsPage();
        return;
    }

    content.innerHTML = `
        <div class="card page-card">
            <div class="section-kicker">B²GC BROKERS · DEMO</div>
            <h2>${current.title}</h2>
            <p>${current.description}</p>
            <div class="page-placeholder">
                <strong>Módulo funcional de prueba</strong>
                <span>Los datos mostrados son ficticios y están almacenados únicamente en este navegador.</span>
            </div>
        </div>
    `;
}

function renderDocumentsPage(page = "documentos") {
    const uploaded = appState.uploadedDocuments || [];
    const allDocs = [...testDocuments, ...uploaded];
    const title = page === "dataroom" ? "Data room" : "Documentos";
    const kicker = page === "dataroom" ? "DUE DILIGENCE · DEMO" : "GESTIÓN DOCUMENTAL · DEMO";
    const description = page === "dataroom"
        ? "Consulta documentos de prueba, revisa el contenido y carga archivos para validar el flujo de due diligence."
        : "Documentos ficticios listos para consultar, descargar y reemplazar durante las pruebas.";

    return `
        <div class="card page-card documents-page">
            <div class="documents-head">
                <div>
                    <div class="section-kicker">${kicker}</div>
                    <h2>${title}</h2>
                    <p>${description}</p>
                </div>
                <div class="documents-head-actions">
                    <input id="document-upload-input" type="file" class="hidden-file-input"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
                        onchange="handleDocumentUpload(event)">
                    <button class="btn btn-navy" type="button" onclick="triggerDocumentUpload()">＋ Subir documento</button>
                </div>
            </div>

            <div class="document-stats">
                <div><strong>${testDocuments.length}</strong><span>Documentos de prueba</span></div>
                <div><strong>${uploaded.length}</strong><span>Archivos cargados</span></div>
                <div><strong>${allDocs.length}</strong><span>Total disponible</span></div>
            </div>

            <div class="document-list document-list-enhanced">
                ${allDocs.map((doc, index) => {
                    const uploadedDoc = doc.source === "upload";
                    return `
                        <div class="document-row document-row-enhanced">
                            <div class="document-main">
                                <div class="document-icon ${uploadedDoc ? "uploaded" : "test"}">${escapeHtml(doc.type || "DOC")}</div>
                                <div class="document-info">
                                    <strong>${escapeHtml(doc.name)}</strong>
                                    <span>${uploadedDoc ? "Archivo cargado" : "Documento de prueba"} · ${escapeHtml(doc.category || "General")} · ${escapeHtml(doc.lotId || "Sin lote")}</span>
                                    <small>${escapeHtml(doc.size || "Tamaño demo")} · ${escapeHtml(doc.status || "Disponible")}</small>
                                </div>
                            </div>
                            <div class="document-actions">
                                <button class="btn btn-ghost btn-small" type="button" onclick="openDocumentViewer('${doc.id}')">Ver</button>
                                <button class="btn btn-ghost btn-small" type="button" onclick="downloadDocument('${doc.id}')">Descargar</button>
                                ${uploadedDoc ? `<button class="btn btn-danger-soft btn-small" type="button" onclick="removeUploadedDocument('${doc.id}')">Eliminar</button>` : `<button class="btn btn-blue-soft btn-small" type="button" onclick="triggerDocumentUpload('${doc.id}')">Subir reemplazo</button>`}
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>

            <div class="document-upload-zone" onclick="triggerDocumentUpload()" role="button" tabindex="0">
                <div class="upload-symbol">↑</div>
                <div>
                    <strong>Sube un archivo de prueba</strong>
                    <span>PDF, Word, Excel, CSV o imagen · máximo 2 MB por archivo</span>
                </div>
            </div>
        </div>
    `;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[char]));
}

let pendingDocumentReplacementId = null;
let pendingDocumentLotId = null;

function triggerDocumentUpload(replaceId = null, lotId = null) {
    pendingDocumentReplacementId = replaceId;
    pendingDocumentLotId = lotId;
    const input = $("#document-upload-input");
    if (input) {
        input.value = "";
        input.click();
    } else {
        showToast("Abre primero la sección Documentos.");
    }
}

function handleDocumentUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        showToast("El archivo supera el límite demo de 2 MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = String(reader.result || "");
        const extension = file.name.includes(".") ? file.name.split(".").pop().toUpperCase() : "FILE";
        const id = pendingDocumentReplacementId || `UPLOAD-TEST-${Date.now()}`;
        const existingIndex = appState.uploadedDocuments.findIndex(doc => doc.id === id);
        const uploaded = {
            id,
            name: file.name,
            type: extension,
            size: formatFileSize(file.size),
            category: "Cargado por usuario",
            lotId: pendingDocumentLotId || "Sin lote",
            status: "Cargado",
            source: "upload",
            mimeType: file.type || "application/octet-stream",
            dataUrl,
            uploadedAt: new Date().toLocaleString("es-CO")
        };

        try {
            if (existingIndex >= 0) appState.uploadedDocuments[existingIndex] = uploaded;
            else appState.uploadedDocuments.unshift(uploaded);
            saveDemoState();
            showToast(`Archivo ${file.name} cargado correctamente.`);
            renderPage(document.querySelector("#page-h1")?.textContent === "Data room" ? "dataroom" : "documentos");
        } catch (error) {
            console.error(error);
            showToast("No fue posible guardar el archivo. Prueba con un archivo más pequeño.");
        } finally {
            pendingDocumentReplacementId = null;
            pendingDocumentLotId = null;
        }
    };
    reader.onerror = () => showToast("No fue posible leer el archivo.");
    reader.readAsDataURL(file);
}

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function findDocument(documentId) {
    return [...testDocuments, ...(appState.uploadedDocuments || [])].find(doc => doc.id === documentId);
}

function openDocumentViewer(documentId) {
    const doc = findDocument(documentId);
    if (!doc) return;
    $("#document-viewer-overlay")?.remove();

    const content = doc.source === "upload"
        ? `<p><strong>Archivo:</strong> ${escapeHtml(doc.name)}</p><p><strong>Tipo:</strong> ${escapeHtml(doc.type)}</p><p><strong>Tamaño:</strong> ${escapeHtml(doc.size)}</p><p><strong>Fecha de carga:</strong> ${escapeHtml(doc.uploadedAt)}</p><p>El archivo fue guardado localmente en este navegador para las pruebas.</p>`
        : `<pre class="document-preview-text">${escapeHtml(doc.content)}</pre>`;

    const overlay = document.createElement("div");
    overlay.id = "document-viewer-overlay";
    overlay.className = "document-viewer-overlay";
    overlay.innerHTML = `
        <div class="document-viewer-modal">
            <button class="detail-close" type="button" onclick="closeDocumentViewer()">×</button>
            <div class="section-kicker">${doc.source === "upload" ? "ARCHIVO CARGADO" : "DOCUMENTO DE PRUEBA"}</div>
            <h2>${escapeHtml(doc.name)}</h2>
            <p>${escapeHtml(doc.lotId || "Documento general")} · ${escapeHtml(doc.type || "DOC")} · ${escapeHtml(doc.size || "")}</p>
            <div class="document-viewer-content">${content}</div>
            <div class="offer-actions">
                <button class="btn btn-ghost" type="button" onclick="closeDocumentViewer()">Cerrar</button>
                <button class="btn btn-navy" type="button" onclick="downloadDocument('${doc.id}')">Descargar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function closeDocumentViewer() {
    $("#document-viewer-overlay")?.remove();
}

function downloadDocument(documentId) {
    const doc = findDocument(documentId);
    if (!doc) return;

    if (doc.source === "upload" && doc.dataUrl) {
        const link = document.createElement("a");
        link.href = doc.dataUrl;
        link.download = doc.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
    } else {
        const blob = new Blob([doc.content || `Documento de prueba: ${doc.name}`], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${doc.id}.txt`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 500);
    }
    showToast(`Descarga preparada: ${doc.name}`);
}

function removeUploadedDocument(documentId) {
    const doc = findDocument(documentId);
    if (!doc || doc.source !== "upload") return;
    if (!confirm(`¿Eliminar el archivo de prueba "${doc.name}"?`)) return;
    appState.uploadedDocuments = appState.uploadedDocuments.filter(item => item.id !== documentId);
    saveDemoState();
    showToast("Archivo eliminado del entorno demo.");
    renderPage(document.querySelector("#page-h1")?.textContent === "Data room" ? "dataroom" : "documentos");
}

function renderAdjudicationsPage() {
    const adjudications = currentRole === "originador"
        ? [
            { id: "ADJ-ORIG-001", lot: "LOTE-TEST-001", buyer: "Comprador Demo S.A.S.", value: "$3.977 M", status: "Adjudicada", date: "12 Sep 2026" },
            { id: "ADJ-ORIG-002", lot: "LOTE-TEST-002", buyer: "Fondo Demo Andino", value: "$2.754 M", status: "En cierre", date: "15 Sep 2026" },
            { id: "ADJ-ORIG-003", lot: "LOTE-TEST-003", buyer: "Inversiones Demo Capital", value: "$5.220 M", status: "Documental", date: "16 Sep 2026" }
        ]
        : [
            { id: "ADJ-COMP-001", lot: "LOTE-TEST-001", buyer: "Originador Demo S.A.S.", value: "$3.977 M", status: "Adjudicada", date: "12 Sep 2026" },
            { id: "ADJ-COMP-002", lot: "LOTE-TEST-004", buyer: "Entidad Financiera Demo D", value: "$7.850 M", status: "En cierre", date: "14 Sep 2026" },
            { id: "ADJ-COMP-003", lot: "LOTE-TEST-002", buyer: "Originador Demo S.A.S.", value: "$2.754 M", status: "Documental", date: "15 Sep 2026" }
        ];
    return `
        <div class="card page-card">
            <div class="section-kicker">CIERRES · ${currentRole === "originador" ? "ORIGINADOR" : "COMPRADOR"}</div>
            <h2>${currentRole === "originador" ? "Cierres de mis portafolios" : "Mis adjudicaciones"}</h2>
            <p>${currentRole === "originador" ? "Operaciones de tus portafolios que avanzan hacia cierre." : "Operaciones adjudicadas a tu cuenta de comprador demo."}</p>
            <div class="table-wrap page-table"><table><thead><tr><th>Adjudicación</th><th>Lote</th><th>${currentRole === "originador" ? "Comprador" : "Originador"}</th><th>Valor</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>
                ${adjudications.map(item => `<tr><td><strong>${item.id}</strong></td><td>${item.lot}</td><td>${item.buyer}</td><td>${item.value}</td><td><span class="badge badge-green">${item.status}</span></td><td>${item.date}</td></tr>`).join("")}
            </tbody></table></div>
        </div>`;
}


function renderReportsPage() {
    const isOriginator = currentRole === "originador";
    const items = isOriginator ? originatorLots : buyerOpportunities;
    const totalNominal = items.reduce((sum, lot) => sum + parseLotAmount(lot), 0);
    const active = items.filter(lot => /activa|nueva|abierto/i.test(lot.status)).length;
    const negotiations = items.filter(lot => /negociación/i.test(lot.status)).length;
    return `
        <div class="card page-card">
            <div class="section-kicker">REPORTES · ${isOriginator ? "ORIGINADOR" : "COMPRADOR"}</div>
            <h2>${isOriginator ? "Reportes de cartera" : "Reportes de inversión"}</h2>
            <p>${isOriginator ? "Indicadores calculados sobre tus portafolios ficticios y su actividad comercial." : "Indicadores calculados sobre oportunidades, ofertas y adjudicaciones ficticias."}</p>
            <div class="report-kpi-grid">
                <div class="report-kpi"><span>${isOriginator ? "Valor de cartera propia" : "Valor de oportunidades"}</span><strong>$${totalNominal.toLocaleString("es-CO", {minimumFractionDigits:1, maximumFractionDigits:1})} M</strong><small>${items.length} registros demo</small></div>
                <div class="report-kpi"><span>${isOriginator ? "Portafolios activos" : "Oportunidades activas"}</span><strong>${active}</strong><small>Escenario actual</small></div>
                <div class="report-kpi"><span>${isOriginator ? "Negociaciones" : "Ofertas"}</span><strong>${isOriginator ? negotiations : appState.offers.length}</strong><small>${isOriginator ? "Con compradores demo" : "Registradas en este navegador"}</small></div>
                <div class="report-kpi"><span>${isOriginator ? "Compradores interesados" : "Adjudicaciones"}</span><strong>${isOriginator ? "47" : "8"}</strong><small>Dato ficticio de prueba</small></div>
            </div>
            <div class="report-bars">
                ${items.map(lot => `<div class="report-bar-row"><span>${lot.id}</span><div><i style="width:${Math.min(100, parseLotAmount(lot) / 89.5 * 100)}%"></i></div><strong>${lot.amount}</strong></div>`).join("")}
            </div>
        </div>`;
}


const receivedOffersDemo = [
    { id: "OF-REC-001", lotId: "LOTE-TEST-001", buyer: "Comprador Demo S.A.S.", amount: "$3.977 M", percent: 82, status: "En revisión", date: "16 Sep 2026" },
    { id: "OF-REC-002", lotId: "LOTE-TEST-002", buyer: "Fondo Demo Andino", amount: "$2.754 M", percent: 85, status: "Contrapropuesta", date: "15 Sep 2026" },
    { id: "OF-REC-003", lotId: "LOTE-TEST-003", buyer: "Inversiones Demo Capital", amount: "$5.017 M", percent: 74, status: "Recibida", date: "14 Sep 2026" }
];

function renderOffersPage() {
    const isBuyer = currentRole === "comprador";
    // Para el comprador: ofertas que él mismo presentó.
    // Para el originador: ofertas postuladas sobre sus propias carteras,
    // incluyendo las creadas durante la prueba desde la cuenta comprador.
    const submittedForOriginator = (appState.offers || [])
        .filter(offer => originatorLots.some(lot => lot.id === offer.lotId))
        .map(offer => ({
            ...offer,
            buyer: offer.buyer || "Comprador Demo S.A.S."
        }));

    const offers = isBuyer
        ? appState.offers
        : [...submittedForOriginator, ...receivedOffersDemo.filter(received =>
            !submittedForOriginator.some(submitted => submitted.lotId === received.lotId && submitted.amount === received.amount)
        )];
    const title = isBuyer ? "Mis ofertas" : "Ofertas recibidas";
    return `
        <div class="card page-card">
            <div class="section-kicker">${currentRole === "comprador" ? "ACTIVIDAD DEL COMPRADOR" : "ACTIVIDAD DEL ORIGINADOR"}</div>
            <h2>${title}</h2>
            <p>${currentRole === "comprador" ? "Registra y consulta las ofertas creadas durante el testeo." : "Consulta las propuestas recibidas sobre tus portafolios de prueba."}</p>

            ${offers.length ? `
                <div class="table-wrap page-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Oferta</th>
                                <th>Lote</th>
                                <th>${isBuyer ? "Valor" : "Comprador"}</th>
                                <th>${isBuyer ? "Porcentaje" : "Valor"}</th>
                                <th>Estado</th>
                                <th>Fecha</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${offers.map(offer => `
                                <tr>
                                    <td><strong>${offer.id}</strong></td>
                                    <td>${offer.lotId}</td>
                                    <td>${isBuyer ? offer.amount : offer.buyer}</td>
                                    <td>${isBuyer ? `${offer.percent}%` : offer.amount}</td>
                                    <td><span class="badge badge-green">${offer.status}</span></td>
                                    <td>${offer.date || "16 Sep 2026"}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            ` : `
                <div class="page-placeholder">
                    <strong>Aún no hay ofertas creadas</strong>
                    <span>Entra a Mercado, abre un lote y usa “Presentar oferta” para generar una oferta de prueba.</span>
                </div>
            `}
        </div>
    `;
}

function renderTestCenter() {
    return `
        <div class="card page-card">
            <div class="section-kicker">QA · ENTORNO CONTROLADO</div>
            <h2>Centro de pruebas</h2>
            <p>Todo lo que aparece aquí es información ficticia. Puedes crear ofertas, navegar por roles y restaurar el escenario inicial.</p>

            <div class="test-banner">
                <div>
                    <strong>Modo demo activo</strong>
                    <span>Sin conexión a base de datos, pagos ni información real.</span>
                </div>
                <span class="badge badge-gold">TEST DATA</span>
            </div>

            <div class="test-actions">
                <button class="btn btn-navy" onclick="runSelfTests(true)">Ejecutar pruebas</button>
                <button class="btn btn-ghost" onclick="resetDemoData()">Restaurar datos</button>
                <button class="btn btn-ghost" onclick="showToast('Estado guardado en localStorage.')">Ver persistencia</button>
            </div>

            <div id="test-results" class="test-results"></div>

            <div class="test-credentials">
                <div>
                    <strong>Originador demo</strong>
                    <span>originador@demo.b2gc.co</span>
                    <span>Demo123!</span>
                </div>
                <div>
                    <strong>Comprador demo</strong>
                    <span>comprador@demo.b2gc.co</span>
                    <span>Demo123!</span>
                </div>
            </div>
        </div>
    `;
}

function runSelfTests(showFeedback = true) {
    const results = [];
    const assert = (name, condition) => results.push({ name, ok: Boolean(condition) });

    assert("Existen 5 lotes de prueba", lots.length === 5);
    assert("Todos los lotes tienen ID único", new Set(lots.map(lot => lot.id)).size === lots.length);
    assert("Todos los lotes tienen valor nominal", lots.every(lot => lot.amount.includes("$")));
    assert("Todos los lotes tienen modalidad", lots.every(lot => lot.modality));
    assert("Simulador puede calcular un valor", Number.isFinite(parseLotAmount(lots[0])));
    assert("El estado de ofertas es un arreglo", Array.isArray(appState.offers));
    assert("Las cuentas demo están configuradas", Object.values(demoAccounts).every(account => account.password));
    assert("Existen documentos demo consultables", testDocuments.length >= 5);
    assert("Los documentos demo tienen contenido", testDocuments.every(doc => doc.name && doc.content));
    assert("Los archivos cargados se manejan como arreglo", Array.isArray(appState.uploadedDocuments));

    const target = $("#test-results");
    if (target) {
        target.innerHTML = results.map(result => `
            <div class="test-result ${result.ok ? "pass" : "fail"}">
                <span>${result.ok ? "✓" : "×"}</span>
                <strong>${result.name}</strong>
                <small>${result.ok ? "OK" : "REVISAR"}</small>
            </div>
        `).join("");
    }

    const passed = results.filter(item => item.ok).length;
    if (showFeedback) {
        showToast(`${passed}/${results.length} pruebas automáticas pasaron.`);
    }

    return results;
}

function parseLotAmount(lot) {
    return Number(
        String(lot.amount)
            .replace("$", "")
            .replace(/\./g, "")
            .replace(",", ".")
            .replace(" M", "")
    );
}

/* =========================================================
   DETALLE DEL LOTE
   ========================================================= */

function openDetail(lotId) {

    const lot =
        lots.find(item => item.id === lotId);


    if (!lot) return;


    currentDetail = lot;


    const overlay = $("#detail-overlay");

    if (!overlay) return;


    overlay.classList.remove("hidden");


    const lotElement = $("#d-lot");
    const titleElement = $("#d-title");


    if (lotElement) {
        lotElement.textContent = lot.id;
    }


    if (titleElement) {
        titleElement.textContent = lot.title;
    }


    renderDetailSummary(lot);

    renderSimulator(lot);

    renderDataRoom(lot);

    showTab("resumen");

}


/* =========================================================
   CERRAR DETALLE
   ========================================================= */

function closeDetail() {

    const overlay = $("#detail-overlay");


    if (overlay) {
        overlay.classList.add("hidden");
    }


    currentDetail = null;

}


/* =========================================================
   RESUMEN
   ========================================================= */

function renderDetailSummary(lot) {

    const panel = $("#tab-resumen");

    if (!panel) return;


    panel.innerHTML = `

        <div
            style="
                display:grid;
                grid-template-columns:repeat(2,1fr);
                gap:12px;
            "
        >

            ${detailMetric(
                "Valor nominal",
                lot.amount
            )}

            ${detailMetric(
                "Descuento objetivo",
                lot.discount
            )}

            ${detailMetric(
                "Número de deudores",
                lot.debtors
            )}

            ${detailMetric(
                "Calificación",
                lot.score
            )}

        </div>


        <div
            style="
                margin-top:25px;
                padding:22px;
                border-radius:17px;
                background:var(--paper);
                border:1px solid var(--line);
            "
        >

            <div
                style="
                    font-size:10px;
                    color:var(--muted-2);
                    text-transform:uppercase;
                    font-family:'IBM Plex Mono';
                "
            >
                Modalidad
            </div>


            <strong
                style="
                    display:block;
                    margin-top:5px;
                    color:var(--navy);
                    font-size:16px;
                "
            >
                ${lot.modality}
            </strong>


            <p
                style="
                    margin-top:10px;
                    color:var(--muted);
                    font-size:12px;
                "
            >
                Fecha límite del proceso:
                <strong>
                    ${lot.deadline}
                </strong>
            </p>

        </div>


        <div style="margin-top:25px;">

            <button
                class="btn btn-navy"
                onclick="makeOffer('${lot.id}')"
            >

                ${
                    currentRole === "comprador"
                        ? "Presentar oferta"
                        : "Gestionar operación"
                }

            </button>

        </div>

    `;

}


/* =========================================================
   MÉTRICA DE DETALLE
   ========================================================= */

function detailMetric(label, value) {

    return `

        <div
            style="
                padding:20px;
                border-radius:15px;
                background:white;
                border:1px solid var(--line);
            "
        >

            <div
                style="
                    color:var(--muted-2);
                    font-size:9px;
                    text-transform:uppercase;
                    font-family:'IBM Plex Mono';
                "
            >
                ${label}
            </div>


            <div
                style="
                    margin-top:5px;
                    color:var(--navy);
                    font-size:20px;
                    font-weight:800;
                "
            >
                ${value}
            </div>

        </div>

    `;

}


/* =========================================================
   SIMULADOR
   ========================================================= */

function renderSimulator(lot) {

    const panel = $("#tab-simulador");

    if (!panel) return;


    panel.innerHTML = `

        <div class="simulator-container">


            <!-- HEADER -->

            <div class="simulator-header">

                <div>

                    <div class="section-kicker">
                        ANÁLISIS FINANCIERO
                    </div>

                    <h3>
                        Simulador de oferta
                    </h3>

                    <p>
                        Analiza diferentes escenarios de compra
                        y visualiza cómo cambia el valor de tu oferta.
                    </p>

                </div>


                <div class="simulator-lot">

                    <span>
                        ${lot.id}
                    </span>

                    <strong>
                        ${lot.type}
                    </strong>

                </div>

            </div>


            <!-- CONTROLES -->

            <div class="simulator-top">


                <div class="simulator-control-card">

                    <div class="simulator-label">
                        Porcentaje sobre valor nominal
                    </div>


                    <div class="percent-input-row">

                        <input
                            id="offer-percent"
                            type="range"
                            min="1"
                            max="100"
                            value="82"
                            oninput="updateSimulator('${lot.id}')"
                        >


                        <div class="percent-number">

                            <input
                                id="offer-percent-number"
                                type="number"
                                min="1"
                                max="100"
                                value="82"
                                oninput="updateSimulator('${lot.id}')"
                            >

                            <span>%</span>

                        </div>

                    </div>


                    <div class="range-labels">

                        <span>1%</span>
                        <span>50%</span>
                        <span>100%</span>

                    </div>

                </div>


                <div class="simulator-main-value">

                    <div class="metric-caption">
                        VALOR ESTIMADO DE OFERTA
                    </div>


                    <div
                        class="simulator-price"
                        id="simulated-value"
                    >
                        $0 M
                    </div>


                    <div
                        class="simulator-price-sub"
                        id="simulated-discount"
                    >
                        Calculando...
                    </div>

                </div>

            </div>


            <!-- KPIS -->

            <div class="simulator-kpis">


                <div class="simulator-kpi">

                    <div class="simulator-kpi-icon">
                        ◈
                    </div>

                    <div>

                        <span>
                            Valor nominal
                        </span>

                        <strong id="sim-nominal">
                            $0 M
                        </strong>

                    </div>

                </div>


                <div class="simulator-kpi">

                    <div class="simulator-kpi-icon">
                        ↘
                    </div>

                    <div>

                        <span>
                            Descuento
                        </span>

                        <strong id="sim-discount">
                            0%
                        </strong>

                    </div>

                </div>


                <div class="simulator-kpi">

                    <div class="simulator-kpi-icon">
                        ◎
                    </div>

                    <div>

                        <span>
                            Ahorro estimado
                        </span>

                        <strong id="sim-saving">
                            $0 M
                        </strong>

                    </div>

                </div>


                <div class="simulator-kpi">

                    <div class="simulator-kpi-icon">
                        %
                    </div>

                    <div>

                        <span>
                            Precio de compra
                        </span>

                        <strong id="sim-price-percent">
                            82%
                        </strong>

                    </div>

                </div>

            </div>


            <!-- GRÁFICAS -->

            <div class="simulator-charts">


                <!-- COMPARACIÓN -->

                <div class="chart-card simulator-chart-main">

                    <div class="chart-card-header">

                        <div>

                            <div class="chart-kicker">
                                VALOR DE OPERACIÓN
                            </div>

                            <h4>
                                Nominal vs. oferta
                            </h4>

                        </div>


                        <div class="chart-legend">

                            <span>

                                <i class="legend-dot nominal"></i>

                                Nominal

                            </span>


                            <span>

                                <i class="legend-dot offer"></i>

                                Oferta

                            </span>

                        </div>

                    </div>


                    <div class="comparison-chart">

                        <div class="comparison-grid">

                            <div class="grid-line"></div>
                            <div class="grid-line"></div>
                            <div class="grid-line"></div>
                            <div class="grid-line"></div>
                            <div class="grid-line"></div>

                        </div>


                        <div class="comparison-bars">


                            <div class="comparison-column">

                                <div
                                    class="bar-value"
                                    id="nominal-bar-value"
                                >
                                    $0 M
                                </div>


                                <div
                                    class="comparison-bar nominal-bar"
                                    style="height:100%"
                                ></div>


                                <span>
                                    Valor nominal
                                </span>

                            </div>


                            <div class="comparison-column">

                                <div
                                    class="bar-value"
                                    id="offer-bar-value"
                                >
                                    $0 M
                                </div>


                                <div
                                    class="comparison-bar offer-bar"
                                    id="offer-bar"
                                    style="height:82%"
                                ></div>


                                <span>
                                    Tu oferta
                                </span>

                            </div>


                        </div>

                    </div>

                </div>


                <!-- DONUT -->

                <div class="chart-card simulator-chart-side">

                    <div class="chart-card-header">

                        <div>

                            <div class="chart-kicker">
                                ESTRUCTURA
                            </div>

                            <h4>
                                Precio de compra
                            </h4>

                        </div>

                    </div>


                    <div class="donut-wrapper">

                        <div
                            class="donut-chart"
                            id="sim-donut"
                        >

                            <div class="donut-center">

                                <strong id="donut-percent">
                                    82%
                                </strong>

                                <span>
                                    del nominal
                                </span>

                            </div>

                        </div>

                    </div>


                    <div class="donut-info">


                        <div>

                            <span
                                class="donut-indicator offer"
                            ></span>

                            <span>
                                Precio de compra
                            </span>

                            <strong id="donut-offer">
                                $0 M
                            </strong>

                        </div>


                        <div>

                            <span
                                class="donut-indicator remaining"
                            ></span>

                            <span>
                                Diferencia
                            </span>

                            <strong id="donut-saving">
                                $0 M
                            </strong>

                        </div>


                    </div>

                </div>

            </div>


            <!-- SENSIBILIDAD -->

            <div class="chart-card sensitivity-card">

                <div class="chart-card-header">

                    <div>

                        <div class="chart-kicker">
                            ANÁLISIS DE ESCENARIOS
                        </div>

                        <h4>
                            Sensibilidad de la oferta
                        </h4>

                        <p>
                            Compara rápidamente cuánto pagarías
                            según diferentes porcentajes de adquisición.
                        </p>

                    </div>

                </div>


                <div
                    class="sensitivity-chart"
                    id="sensitivity-chart"
                ></div>

            </div>


        </div>

    `;


    updateSimulator(lot.id);

}


/* =========================================================
   ACTUALIZAR SIMULADOR
   ========================================================= */

function updateSimulator(lotId) {

    const lot =
        lots.find(item => item.id === lotId);


    if (!lot) return;


    const range = $("#offer-percent");
    const number = $("#offer-percent-number");


    if (!range || !number) return;


    let percentage;


    if (document.activeElement === number) {

        percentage = Number(number.value);

    } else {

        percentage = Number(range.value);

    }


    if (!percentage || percentage < 1) {
        percentage = 1;
    }


    if (percentage > 100) {
        percentage = 100;
    }


    range.value = percentage;

    number.value = percentage;


    /*
     * CONVERTIR VALOR
     */

    const numericValue = parseFloat(

        lot.amount
            .replace("$", "")
            .replace(/\./g, "")
            .replace(",", ".")
            .replace(" M", "")

    );


    /*
     * CÁLCULO
     */

    const offerValue =
        numericValue *
        (percentage / 100);


    const saving =
        numericValue -
        offerValue;


    const discount =
        100 -
        percentage;


    /*
     * FORMATO DINERO
     */

    const money = value =>

        "$" +

        value.toLocaleString(
            "es-CO",
            {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            }
        ) +

        " M";


    /*
     * VALOR PRINCIPAL
     */

    const simulatedValue =
        $("#simulated-value");


    if (simulatedValue) {

        simulatedValue.textContent =
            money(offerValue);

    }


    /*
     * TEXTO DESCUENTO
     */

    const simulatedDiscount =
        $("#simulated-discount");


    if (simulatedDiscount) {

        simulatedDiscount.textContent =
            `${discount.toFixed(0)}% por debajo del valor nominal`;

    }


    /*
     * KPIS
     */

    const nominal =
        $("#sim-nominal");

    const discountElement =
        $("#sim-discount");

    const savingElement =
        $("#sim-saving");

    const pricePercent =
        $("#sim-price-percent");


    if (nominal) {

        nominal.textContent =
            money(numericValue);

    }


    if (discountElement) {

        discountElement.textContent =
            `${discount.toFixed(0)}%`;

    }


    if (savingElement) {

        savingElement.textContent =
            money(saving);

    }


    if (pricePercent) {

        pricePercent.textContent =
            `${percentage}%`;

    }


    /*
     * BARRA
     */

    const offerBar =
        $("#offer-bar");


    if (offerBar) {

        offerBar.style.height =
            `${percentage}%`;

    }


    const nominalBarValue =
        $("#nominal-bar-value");


    const offerBarValue =
        $("#offer-bar-value");


    if (nominalBarValue) {

        nominalBarValue.textContent =
            money(numericValue);

    }


    if (offerBarValue) {

        offerBarValue.textContent =
            money(offerValue);

    }


    /*
     * DONUT
     */

    const donut =
        $("#sim-donut");


    const donutPercent =
        $("#donut-percent");


    if (donut) {

        const angle =
            percentage * 3.6;


        donut.style.background =

            `conic-gradient(
                var(--blue) 0deg ${angle}deg,
                #e8edf5 ${angle}deg 360deg
            )`;

    }


    if (donutPercent) {

        donutPercent.textContent =
            `${percentage}%`;

    }


    const donutOffer =
        $("#donut-offer");


    const donutSaving =
        $("#donut-saving");


    if (donutOffer) {

        donutOffer.textContent =
            money(offerValue);

    }


    if (donutSaving) {

        donutSaving.textContent =
            money(saving);

    }


    /*
     * GRÁFICA DE SENSIBILIDAD
     */

    renderSensitivityChart(
        numericValue,
        percentage
    );

}


/* =========================================================
   GRÁFICA DE SENSIBILIDAD
   ========================================================= */

function renderSensitivityChart(
    nominalValue,
    selectedPercentage
) {

    const container =
        $("#sensitivity-chart");


    if (!container) return;


    const scenarios = [
        60,
        65,
        70,
        75,
        80,
        85,
        90,
        95
    ];


    const maxValue =
        nominalValue;


    container.innerHTML =

        scenarios.map(percent => {


            const value =
                nominalValue *
                (percent / 100);


            const height =
                (value / maxValue) *
                100;


            const selected =
                Math.abs(
                    percent -
                    selectedPercentage
                ) < 0.1;


            return `

                <div
                    class="
                        sensitivity-column
                        ${selected ? "selected" : ""}
                    "
                    onclick="
                        selectSensitivity(${percent})
                    "
                >

                    <div class="sensitivity-value">
                        ${percent}%
                    </div>


                    <div class="sensitivity-track">

                        <div
                            class="sensitivity-bar"
                            style="height:${height}%"
                        ></div>

                    </div>


                    <div class="sensitivity-label">
                        ${percent}%
                    </div>

                </div>

            `;

        }).join("");

}


/* =========================================================
   SELECCIONAR ESCENARIO
   ========================================================= */

function selectSensitivity(percent) {

    const range =
        $("#offer-percent");


    const number =
        $("#offer-percent-number");


    if (range) {

        range.value =
            percent;

    }


    if (number) {

        number.value =
            percent;

    }


    if (currentDetail) {

        updateSimulator(
            currentDetail.id
        );

    }

}


/* =========================================================
   DATA ROOM
   ========================================================= */

function renderDataRoom(lot) {
    const panel = $("#tab-dataroom");
    if (!panel) return;

    const docs = testDocuments.filter(doc => !lot || doc.lotId === lot.id || doc.lotId === "LOTE-TEST-001");
    panel.innerHTML = `
        <div class="dataroom-panel-head">
            <div>
                <div class="section-kicker">DATA ROOM · ${lot?.id || "DEMO"}</div>
                <h3>Documentos disponibles</h3>
                <p>Archivos ficticios para revisar el flujo de due diligence.</p>
            </div>
            <div class="documents-head-actions">
                <input id="document-upload-input" type="file" class="hidden-file-input"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
                    onchange="handleDocumentUpload(event)">
                <button class="btn btn-navy btn-small" type="button" onclick="triggerDocumentUpload(null,'${lot?.id || ""}')">↑ Subir archivo</button>
                <button class="btn btn-ghost btn-small" type="button" onclick="navigate(null,'dataroom')">Gestionar</button>
            </div>
        </div>
        <div class="document-list">
            ${docs.map(doc => `
                <div class="document-row document-row-enhanced">
                    <div class="document-main">
                        <div class="document-icon test">${escapeHtml(doc.type)}</div>
                        <div class="document-info"><strong>${escapeHtml(doc.name)}</strong><span>${escapeHtml(doc.category)} · ${escapeHtml(doc.size)}</span></div>
                    </div>
                    <div class="document-actions">
                        <button class="btn btn-ghost btn-small" type="button" onclick="openDocumentViewer('${doc.id}')">Ver</button>
                        <button class="btn btn-blue-soft btn-small" type="button" onclick="downloadDocument('${doc.id}')">Descargar</button>
                    </div>
                </div>`).join("")}
        </div>`;
}


/* =========================================================
   TABS
   ========================================================= */

function showTab(tabName) {

    $$(".tab").forEach(tab => {

        tab.classList.toggle(
            "active",
            tab.dataset.tab === tabName
        );

    });


    $$(".tab-panel").forEach(panel => {

        panel.classList.add("hidden");

    });


    const selected =
        $(`#tab-${tabName}`);


    if (selected) {

        selected.classList.remove("hidden");

    }

}


/* =========================================================
   OFERTAS
   ========================================================= */

function makeOffer(lotId) {
    const lot = lots.find(item => item.id === lotId);
    if (!lot) return;

    if (currentRole !== "comprador") {
        showToast("La presentación de ofertas está disponible para compradores.");
        return;
    }

    const existing = $("#offer-overlay");
    if (existing) existing.remove();

    const numericValue = parseLotAmount(lot);

    const overlay = document.createElement("div");
    overlay.id = "offer-overlay";
    overlay.className = "offer-overlay";
    overlay.innerHTML = `
        <div class="offer-modal">
            <button class="detail-close" type="button" aria-label="Cerrar"
                onclick="closeOfferModal()">×</button>

            <div class="section-kicker">NUEVA OFERTA · DEMO</div>
            <h2>Presentar oferta</h2>
            <p>${lot.id} · ${lot.title}</p>

            <div class="offer-summary">
                <span>Valor nominal</span>
                <strong>${lot.amount}</strong>
            </div>

            <label class="offer-field">
                <span>Porcentaje de compra</span>
                <input id="offer-form-percent" type="number" min="1" max="100" value="82">
            </label>

            <label class="offer-field">
                <span>Comentario</span>
                <textarea id="offer-form-note" rows="3" placeholder="Comentario opcional para esta prueba"></textarea>
            </label>

            <div class="offer-preview">
                <span>Valor estimado</span>
                <strong id="offer-form-value">$0 M</strong>
            </div>

            <div class="offer-actions">
                <button class="btn btn-ghost" onclick="closeOfferModal()">Cancelar</button>
                <button class="btn btn-navy" onclick="submitOffer('${lot.id}')">Guardar oferta</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const input = $("#offer-form-percent");
    const updatePreview = () => {
        const percent = Math.min(100, Math.max(1, Number(input?.value) || 1));
        if (input) input.value = percent;
        const value = numericValue * percent / 100;
        const output = $("#offer-form-value");
        if (output) {
            output.textContent = "$" + value.toLocaleString("es-CO", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            }) + " M";
        }
    };

    input?.addEventListener("input", updatePreview);
    updatePreview();
    input?.focus();
}

function submitOffer(lotId) {
    const lot = lots.find(item => item.id === lotId);
    const percent = Math.min(100, Math.max(1, Number($("#offer-form-percent")?.value) || 0));
    const note = ($("#offer-form-note")?.value || "").trim();

    if (!lot || !percent) {
        showToast("Ingresa un porcentaje válido.");
        return;
    }

    const numericValue = parseLotAmount(lot);
    const offerValue = numericValue * percent / 100;

    const offer = {
        id: `OF-TEST-${String(appState.offers.length + 1).padStart(3, "0")}`,
        lotId: lot.id,
        amount: "$" + offerValue.toLocaleString("es-CO", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }) + " M",
        percent,
        note,
        status: "Enviada",
        date: new Date().toLocaleDateString("es-CO"),
        buyer: appState.company || "Comprador Demo S.A.S.",
        submittedByRole: currentRole
    };

    appState.offers.unshift(offer);
    saveDemoState();
    closeOfferModal();
    closeDetail();
    showToast(`Oferta ${offer.id} guardada en el entorno demo.`);
}

function closeOfferModal() {
    $("#offer-overlay")?.remove();
}

/* =========================================================
   TOAST
   ========================================================= */

function showToast(message) {

    const toast =
        $("#toast");


    if (!toast) return;


    toast.textContent =
        message;


    toast.classList.add("show");


    clearTimeout(toastTimer);


    toastTimer = setTimeout(() => {

        toast.classList.remove("show");

    }, 3000);

}


/* =========================================================
   ANIMACIONES
   ========================================================= */

function initReveal() {

    const elements =
        $$(".reveal");


    if (!elements.length) return;


    if (!("IntersectionObserver" in window)) {

        elements.forEach(element => {

            element.classList.add("visible");

        });

        return;

    }


    const observer =
        new IntersectionObserver(

            entries => {

                entries.forEach(entry => {

                    if (entry.isIntersecting) {

                        entry.target.classList.add(
                            "visible"
                        );

                        observer.unobserve(
                            entry.target
                        );

                    }

                });

            },

            {
                threshold: .12
            }

        );


    elements.forEach(element => {

        observer.observe(element);

    });

}


/* =========================================================
   CERRAR MODALES AL HACER CLICK AFUERA
   ========================================================= */

document.addEventListener(
    "click",
    event => {


        const authOverlay =
            $("#auth-overlay");


        if (
            authOverlay &&
            event.target === authOverlay
        ) {

            closeAuth();

        }


        const detailOverlay =
            $("#detail-overlay");


        if (
            detailOverlay &&
            event.target === detailOverlay
        ) {

            closeDetail();

        }

        const offerOverlay = $("#offer-overlay");

        if (offerOverlay && event.target === offerOverlay) {
            closeOfferModal();
        }

        const documentViewer = $("#document-viewer-overlay");
        if (documentViewer && event.target === documentViewer) {
            closeDocumentViewer();
        }

    }
);


/* =========================================================
   ESCAPE
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (event.key !== "Escape") return;


        closeAuth();

        closeDetail();

        closeOfferModal();
        closeDocumentViewer();

    }
);


/* =========================================================
   INICIO
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        buildSidebar();

        initReveal();


        if (appState.loggedIn) {

            const publicSite =
                $("#public-site");


            const appShell =
                $("#app-shell");


            if (publicSite) {

                publicSite.classList.add(
                    "hidden"
                );

            }


            if (appShell) {

                appShell.classList.remove(
                    "hidden"
                );

            }


            setRole(currentRole);

        }

    }
);