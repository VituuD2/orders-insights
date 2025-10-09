document.addEventListener("DOMContentLoaded", () => {
    // --- ESTADO DA APLICAÇÃO ---
    const state = {
        allOrders: [],
        filteredOrders: [],
        meta: 0,
        marketplaceOrders: 0,
        atacadoPeso: 0,
        sort: {
            column: 'data',
            order: 'desc'
        }
    };

    // --- ELEMENTOS DA DOM ---
    const fileInput = document.getElementById("fileInput");
    const metaInput = document.getElementById("metaInput");
    const startDateInput = document.getElementById("startDate");
    const endDateInput = document.getElementById("endDate");
    const applyFilterBtn = document.getElementById("applyFilter");
    const clearFilterBtn = document.getElementById("clearFilter");
    const loader = document.getElementById("loader");
    const tableBody = document.querySelector("#ordersTable tbody");
    const metricsContainer = document.getElementById("metrics");
    const themeToggle = document.getElementById("theme-toggle");
    const marketplaceInput = document.getElementById("marketplaceInput");
    const atacadoInput = document.getElementById("atacadoInput");

    // --- FUNÇÕES DE COMUNICAÇÃO COM O SERVIDOR (NOVO) ---

    async function loadDataFromServer() {
        try {
            loader.classList.remove("hidden");
            console.log("Buscando dados salvos...");
            // Pede os dados para o nosso backend na Vercel
            const response = await fetch('/api/data'); 
            if (!response.ok) throw new Error('Falha ao carregar dados do servidor.');

            const savedState = await response.json();

            // Se houver dados salvos, atualiza o estado da aplicação
            if (savedState && savedState.allOrders && savedState.allOrders.length > 0) {
                console.log("Dados encontrados. Carregando...");
                state.allOrders = savedState.allOrders.map(order => ({
                    ...order,
                    // IMPORTANTE: Converte a string de data de volta para um objeto Date
                    data: new Date(order.data) 
                }));
                state.filteredOrders = [...state.allOrders];
                state.meta = savedState.meta || 0;
                state.marketplaceOrders = savedState.marketplaceOrders || 0;
                state.atacadoPeso = savedState.atacadoPeso || 0;

                // Atualiza os inputs na tela com os valores salvos
                metaInput.value = state.meta;
                marketplaceInput.value = state.marketplaceOrders;
                atacadoInput.value = state.atacadoPeso;
            } else {
                 console.log("Nenhum dado salvo encontrado. Iniciando do zero.");
            }
            // Renderiza a tabela e as métricas com os dados carregados (ou o estado inicial)
            render(); 
        } catch (error) {
            console.error("Erro ao carregar dados do servidor:", error);
            // Não usamos alert aqui para não interromper a experiência do usuário se a API falhar
        } finally {
            loader.classList.add("hidden");
        }
    }

    async function saveDataToServer() {
        try {
            // Prepara o objeto de estado para ser salvo, garantindo que não há dados circulares
            const stateToSave = {
                allOrders: state.allOrders,
                meta: state.meta,
                marketplaceOrders: state.marketplaceOrders,
                atacadoPeso: state.atacadoPeso
            };
            
            console.log("Salvando dados no servidor...");

            const response = await fetch('/api/data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Envia o estado como uma string JSON
                body: JSON.stringify(stateToSave), 
            });

            if (!response.ok) throw new Error('Falha ao salvar os dados.');

            console.log("Dados salvos com sucesso!");

        } catch (error) {
            console.error("Erro ao salvar dados no servidor:", error);
            // Poderíamos adicionar uma notificação visual de erro aqui no futuro
        }
    }


    // --- INICIALIZAÇÃO E EVENT LISTENERS ---
    themeToggle.addEventListener("click", () => {
        document.body.classList.toggle("light-mode");
    });

    fileInput.addEventListener("change", handleFileUpload);
    applyFilterBtn.addEventListener("click", applyDateFilter);
    clearFilterBtn.addEventListener("click", clearDateFilter);
    document.querySelectorAll("th[data-column]").forEach(th => th.addEventListener("click", () => sortTable(th.dataset.column)));


    // --- INICIALIZAÇÃO DOS COMPONENTES CUSTOMIZADOS ---
    flatpickr("#startDate, #endDate", {
        locale: "pt",
        dateFormat: "Y-m-d",
        onChange: function(selectedDates, dateStr, instance) {
            updateDateFacadeWithDate(instance.element, selectedDates[0]);
        }
    });

    function setupNumberInputs() {
        document.querySelectorAll('.stepper-btn').forEach(button => {
            button.addEventListener('click', () => {
                const input = button.parentElement.querySelector('input[type="number"]');
                if (input) {
                    const step = button.dataset.step === 'plus' ? 1 : -1;
                    const currentValue = parseInt(input.value) || 0;
                    input.value = Math.max(0, currentValue + step);
                    input.dispatchEvent(new Event('input'));
                }
            });
        });

        document.getElementById('applyMeta').addEventListener('click', applyMeta);

        // MODIFICADO: Função para atualizar e SALVAR valores manuais
        const updateManualValues = () => {
            state.marketplaceOrders = parseInt(marketplaceInput.value) || 0;
            state.atacadoPeso = parseInt(atacadoInput.value) || 0;
            updateMetrics(); // Recalcula as métricas
            saveDataToServer(); // Salva no servidor a cada alteração
        };

        marketplaceInput.addEventListener('input', updateManualValues);
        atacadoInput.addEventListener('input', updateManualValues);
    }

    setupNumberInputs();


    function updateDateFacadeWithDate(inputElement, dateObject) {
        const container = inputElement.closest('.custom-date-input');
        const facade = container.querySelector('.date-facade');
        const placeholder = facade.getAttribute('data-placeholder');

        if (dateObject) {
            const day = String(dateObject.getDate()).padStart(2, '0');
            const month = String(dateObject.getMonth() + 1).padStart(2, '0');
            const year = dateObject.getFullYear();
            facade.textContent = `${day}/${month}/${year}`;
            facade.classList.add('has-value');
        } else {
            facade.textContent = placeholder;
            facade.classList.remove('has-value');
        }
    }

    // --- FUNÇÕES PRINCIPAIS ---

    function parseBrazilianDate(dateString) {
        if (!dateString || typeof dateString !== 'string') return null;
        const parts = dateString.split(' ');
        const dateParts = parts[0].split('/');
        if (dateParts.length !== 3) return new Date(dateString); 
        const [day, month, year] = dateParts;
        const timePart = parts[1] || '00:00:00';
        const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}`;
        const date = new Date(isoString);
        return isNaN(date.getTime()) ? null : date;
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        loader.classList.remove("hidden");
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="placeholder">Processando planilha...</td></tr>`;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {
                    type: "array"
                });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(sheet);
                processOrders(json);
            } catch (error) {
                console.error("Erro ao ler o arquivo:", error);
                if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="placeholder">Erro ao ler o arquivo. Verifique o formato.</td></tr>`;
            } finally {
                loader.classList.add("hidden");
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // MODIFICADO: para salvar após processar
    function processOrders(rows) {
        const ordersMap = new Map();
        rows.forEach(row => {
            const orderId = row["Número do pedido"];
            if (!orderId) return;
            const date = parseBrazilianDate(row["Data de criação"]);
            if (!date) {
                console.warn(`Data inválida ou em formato não esperado, pulando linha: ${row["Data de criação"]}`);
                return;
            }
            const price = parseFloat(String(row["Preço venda"]).replace(",", ".")) || 0;
            const quantity = parseInt(row["Quantidade"]) || 0;
            if (!ordersMap.has(orderId)) {
                const hasSpecialSKU = row["SKU"] === "SBSR00S-K001";
                ordersMap.set(orderId, {
                    numero: orderId,
                    nome: row["Nome"],
                    data: date,
                    situacao: row["Situação"],
                    totalValor: 0,
                    totalItens: 0,
                    hasSpecialSKU: hasSpecialSKU
                });
            }
            const order = ordersMap.get(orderId);
            order.totalValor += price * quantity;
            order.totalItens += quantity;
        });

        state.allOrders = Array.from(ordersMap.values()).map(o => ({
            ...o,
            peso: (() => {
                if (o.hasSpecialSKU) {
                    return o.totalValor >= 700 ? 3 : 2;
                }
                return o.totalValor > 699 ? 2 : 1;
            })()
        }));

        state.filteredOrders = [...state.allOrders];
        render();
        saveDataToServer(); // Salva os novos dados da planilha no servidor
    }

    // MODIFICADO: para salvar após definir a meta
    function applyMeta() {
        const metaValue = parseInt(metaInput.value);
        if (isNaN(metaValue) || metaValue < 0) {
            // Não usamos alert para uma melhor experiência
            metaInput.style.border = '1px solid red';
            return;
        }
        metaInput.style.border = ''; // Limpa o erro
        state.meta = metaValue;
        updateMetrics();
        saveDataToServer(); // Salva a nova meta no servidor
    }

    function applyDateFilter() {
        const start = startDateInput.value ? new Date(startDateInput.value + 'T00:00:00') : null;
        const end = endDateInput.value ? new Date(endDateInput.value + 'T23:59:59') : null;
        state.filteredOrders = state.allOrders.filter(o => {
            if (start && o.data < start) return false;
            if (end && o.data > end) return false;
            return true;
        });
        render();
    }

    function clearDateFilter() {
        flatpickr("#startDate").clear();
        flatpickr("#endDate").clear();
        state.filteredOrders = [...state.allOrders];
        render();
    }

    function sortTable(column) {
        const { sort } = state;
        sort.order = (sort.column === column && sort.order === 'asc') ? 'desc' : 'asc';
        sort.column = column;
        state.filteredOrders.sort((a, b) => {
            const valA = a[column],
                valB = b[column];
            if (valA < valB) return sort.order === 'asc' ? -1 : 1;
            if (valA > valB) return sort.order === 'asc' ? 1 : -1;
            return 0;
        });
        renderTable();
        updateSortArrows();
    }

    function render() {
        // A ordenação já acontece dentro da sortTable, então chamamos renderTable diretamente
        renderTable();
        updateMetrics();
        updateSortArrows(); // Garante que as setas estejam corretas após qualquer renderização
    }

    function renderTable() {
        if (!tableBody) return;
        if (state.allOrders.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="placeholder">Aguardando planilha...</td></tr>`;
            return;
        }
        if (state.filteredOrders.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="placeholder">Nenhum pedido encontrado para o filtro aplicado.</td></tr>`;
            return;
        }
        tableBody.innerHTML = state.filteredOrders.map(o => `<tr><td>${o.numero}</td><td>${o.data.toLocaleDateString("pt-BR")}</td><td>${o.nome}</td><td>${o.totalItens}</td><td>${o.totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td>${o.peso}</td><td>${o.situacao}</td></tr>`).join("");
    }

    function updateMetrics() {
        const data = state.filteredOrders;
        const pesoDosPedidos = data.reduce((sum, o) => sum + o.peso, 0);
        const pesoMarketplace = Math.floor(state.marketplaceOrders / 5);
        const pesoAtacado = state.atacadoPeso;
        const totalPeso = pesoDosPedidos + pesoMarketplace + pesoAtacado;
        const totalValor = data.reduce((sum, o) => sum + o.totalValor, 0);
        const days = new Set(data.map(o => o.data.toISOString().split('T')[0]));
        const numDays = days.size || 1;
        const mediaDiaPeso = (totalPeso / numDays).toFixed(2);
        const metaAtingida = state.meta > 0 ? (totalPeso / state.meta) * 100 : 0;
        
        metricsContainer.innerHTML = `<div class="metric-card glass-panel"><h3>Vendas</h3><div class="value">${totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div></div><div class="metric-card glass-panel"><h3>Peso Total</h3><div class="value">${totalPeso}</div></div><div class="metric-card glass-panel"><h3>Média Peso/Dia</h3><div class="value">${mediaDiaPeso}</div></div><div class="metric-card glass-panel"><h3>Meta</h3><div class="value">${metaAtingida.toFixed(1)}%</div><div class="meta-progress"><div class="progress-bar" style="width: ${Math.min(metaAtingida, 100)}%;"></div></div></div>`;
    }

    function updateSortArrows() {
        document.querySelectorAll("th[data-column]").forEach(th => {
            const arrow = th.querySelector(".sort-arrow");
            if (arrow) {
                arrow.textContent = (th.dataset.column === state.sort.column) ? (state.sort.order === 'asc' ? '▲' : '▼') : '';
            }
        });
    }

    // --- CHAMADA INICIAL ---
    // Carrega os dados salvos do servidor assim que a página é carregada
    loadDataFromServer();
});
