document.addEventListener("DOMContentLoaded", async () => {

    let dadosLocais = localStorage.getItem("dados_kanban");

    carregarListas();
    renderizarQuadro();
    if (dadosLocais) {
        return; // 🚀 Interrompe a execução para evitar carregamento desnecessário da nuvem
    } else {
        await carregarDadosDaNuvem(); // Busca os dados da nuvem 
    }
});

let idListaAtual = null;

document.addEventListener("DOMContentLoaded", function () {
    // Limite para adicionar Lista (máx. 25 caracteres)
    let inputLista = document.getElementById("input-nova-lista");
    if (inputLista) aplicarLimitador(inputLista, 25, "aviso-lista");

    // Limite para adicionar Tarefa (máx. 20 caracteres)
    let inputTarefa = document.getElementById("input-nova-tarefa");
    if (inputTarefa) aplicarLimitador(inputTarefa, 20, "aviso-tarefa");
});

/**
 * Aplica um limitador de caracteres ao campo de input
 * @param {HTMLElement} input - O campo de entrada de texto
 * @param {number} maxCaracteres - O limite máximo de caracteres
 * @param {string} idAviso - O ID do aviso para exibição de erro
 */

/**
 * Exibe o modal de confirmação para excluir listas, tarefas, etiquetas ou etiquetas globais.
 * @param {string} tipo - Pode ser 'lista', 'tarefa', 'etiqueta' ou 'etiquetaGlobal'.
 * @param {string} id - O ID do item a ser excluído.
 * @param {string} nome - O nome do item a ser excluído (para exibir no modal).
 */
function abrirModalConfirmacao(tipo, id, nome) {
    let titulo = document.getElementById("titulo-confirmacao");
    let mensagem = document.getElementById("mensagem-confirmacao");
    let botaoConfirmar = document.getElementById("botao-confirmar");

    if (!titulo || !mensagem || !botaoConfirmar) {
        return;
    }

    if (tipo === "lista") {
        titulo.textContent = "Excluir Lista?";
        mensagem.textContent = `Tem certeza que deseja excluir a lista "${nome}" e todas as suas tarefas?`;
        botaoConfirmar.onclick = () => excluirLista(id);
    } else if (tipo === "tarefa") {
        titulo.textContent = "Excluir Tarefa?";
        mensagem.textContent = `Tem certeza que deseja excluir a tarefa "${nome}"?`;
        botaoConfirmar.onclick = () => excluirTarefa(id);
    } else if (tipo === "etiqueta") {
        titulo.textContent = "Remover Etiqueta?";
        mensagem.textContent = `Tem certeza que deseja remover a etiqueta "${nome}" desta tarefa?`;
        botaoConfirmar.onclick = () => removerEtiquetaConfirmada(id);
    } else if (tipo === "etiquetaGlobal") {
        titulo.textContent = "Excluir Etiqueta Global?";
        mensagem.textContent = `Atenção! Isso removerá a etiqueta "${nome}" de todas as tarefas. Tem certeza?`;
        botaoConfirmar.onclick = function () {
            deletarEtiquetaGlobalConfirmada(id);
            fecharModalConfirmacao();
        };
    } else {
        return;
    }

    // 🔥 Exibe o modal
    let modal = document.getElementById("modal-confirmacao");
    let fundoEscuro = document.getElementById("fundo-escuro");
    modal.classList.remove("oculto");
    fundoEscuro.classList.remove("oculto");
}

/**
 * Fecha o modal de confirmação.
 */
function fecharModalConfirmacao() {
    const modal = document.getElementById("modal-confirmacao");
    const fundoEscuro = document.getElementById("fundo-escuro");

    if (modal) modal.classList.add("oculto"); // Esconde o modal
    if (fundoEscuro) fundoEscuro.classList.add("oculto"); // Esconde o fundo escuro
}

document.getElementById("botao-cancelar").addEventListener("click", fecharModalConfirmacao);

document.getElementById("fundo-escuro").addEventListener("click", () => {
    const modaisAbertos = document.querySelectorAll(".modal:not(.oculto)");
    modaisAbertos.forEach(modal => {
        modal.classList.add("oculto"); // Fecha os modais abertos
    });

    const fundoEscuro = document.getElementById("fundo-escuro");
    if (fundoEscuro) fundoEscuro.classList.add("oculto"); // Esconde o fundo-escuro
});

document.addEventListener("DOMContentLoaded", () => {
    const quadro = document.getElementById("quadro"); // Container das listas

    let scrollInterval = null;

    quadro.addEventListener("dragover", (evento) => {
        evento.preventDefault();
        const limite = 200; // Distância das bordas para ativar o scroll
        const velocidade = 100; // Velocidade do scroll

        let mouseX = evento.clientX;
        let quadroRect = quadro.getBoundingClientRect();

        // Se o mouse estiver próximo da borda esquerda, rola para a esquerda
        if (mouseX < quadroRect.left + limite) {
            iniciarScroll(-velocidade);
        }
        // Se o mouse estiver próximo da borda direita, rola para a direita
        else if (mouseX > quadroRect.right - limite) {
            iniciarScroll(velocidade);
        } else {
            pararScroll();
        }
    });

    quadro.addEventListener("dragleave", pararScroll);
    quadro.addEventListener("drop", pararScroll);

    function iniciarScroll(velocidade) {
        if (scrollInterval) return;
        scrollInterval = setInterval(() => {
            quadro.scrollLeft += velocidade;
        }, 30); // Ajusta a taxa de atualização do scroll
    }

    function pararScroll() {
        clearInterval(scrollInterval);
        scrollInterval = null;
    }
});



// Variável para armazenar a lista onde será adicionada a tarefa

function adicionarTarefa(idLista) {
    if (!idLista) {
        alert("Erro: Nenhuma lista foi selecionada!");
        return;
    }

    idListaAtual = idLista; // Salva o ID da lista corretamente
    abrirModais('modal-adicionar-tarefa');
}

function confirmarAdicionarTarefa() {
    let inputTarefa = document.getElementById("input-nova-tarefa");
    let textoTarefa = inputTarefa.value.trim();

    // 🛑 Verifica se a lista foi selecionada antes de continuar
    if (!idListaAtual) {
        alert("Erro: Nenhuma lista foi selecionada!");
        return;
    }

    if (!textoTarefa) {
        alert("O nome da tarefa não pode estar vazio.");
        return;
    }

    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };

    let agora = new Date();
    let dataAtual = agora.toISOString().split("T")[0]; // 📌 Data no formato YYYY-MM-DD
    let horaAtual = agora.toLocaleTimeString("pt-BR", { hour12: false });

    let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
    let criador = acesso.usuario || "Desconhecido";

    let idTarefa = unicoID(); // 🔥 Gera um ID único para a tarefa
    let idHistorico = unicoID(); // 🔥 Gera um ID único para o primeiro histórico

    let novaTarefa = {
        id: idTarefa,
        texto: textoTarefa,
        lista: idListaAtual,
        descricao: {
            chamado: "",
            endereco: "",
            start: dataAtual,
            entrega: "",
            pedidoServico: "",
            pedidoVenda: "",
            escopo: "",
            equipe: ""
        },
        etiquetas: {}, // 🔥 Agora é um OBJETO em vez de um array
        atividades: {},
        historico: {
            [idHistorico]: {
                id: idHistorico,
                tipo: "criação",
                mensagem: `Tarefa criada por ${criador}`,
                data: dataAtual,
                hora: horaAtual
            }
        }
    };

    dados.tarefas[idTarefa] = novaTarefa;
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // 🔥 Envia a tarefa isoladamente para a nuvem
    enviar(`dados_kanban/tarefas/${idTarefa}`, novaTarefa);

    // 🔥 LIMPA O INPUT APÓS ADICIONAR A TAREFA
    inputTarefa.value = "";

    renderizarQuadro();
    fecharModais("modal-adicionar-tarefa");
}
function adicionarLista() {
    abrirModais('modal-adicionar-lista');
}

function salvarListas(novasListas) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: {} };

    // ✅ Atualiza apenas as listas, sem modificar outras partes dos dados
    dados.listas = novasListas;

    // ✅ Salva no localStorage
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

}

function salvarTarefas(novasTarefas) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };

    // Atualiza as tarefas no objeto local
    dados.tarefas = novasTarefas;

    // Salva no LocalStorage
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // 🔥 Envia cada tarefa separadamente para a nuvem
    for (let idTarefa in novasTarefas) {
        let tarefa = novasTarefas[idTarefa];
        enviar(`dados_kanban/tarefas/${idTarefa}`, tarefa);
    }
}


function salvarEtiquetasGlobais(novasEtiquetas) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: {} };

    // ✅ Atualiza apenas as etiquetas globais, sem modificar outras partes dos dados
    dados.etiquetasGlobais = novasEtiquetas;

    // ✅ Salva no localStorage
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

}

function carregarListas() {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: {} };

    // ✅ Garante que `etiquetasGlobais` seja um objeto e não um array
    if (!dados.etiquetasGlobais || typeof dados.etiquetasGlobais !== "object") {
        dados.etiquetasGlobais = {};
    }

    renderizarQuadro();
}

function excluirTarefa(idTarefa) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {} };

    if (!dados.tarefas[idTarefa]) {
        return;
    }

    // 🔥 Deletar a tarefa na nuvem
    deletar(`dados_kanban/tarefas/${idTarefa}`);

    // 🗑️ Remove a tarefa localmente
    delete dados.tarefas[idTarefa];

    // 🔄 Atualiza o localStorage
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // 🔄 Atualiza a interface
    fecharModalConfirmacao();
    renderizarQuadro();
}

function excluirLista(idLista) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {} };

    if (!dados.listas[idLista]) {
        return;
    }

    // 🔥 Remove todas as tarefas associadas à lista
    for (let idTarefa in dados.tarefas) {
        if (dados.tarefas[idTarefa].lista === idLista) {
            deletar(`dados_kanban/tarefas/${idTarefa}`); // 🔥 Remove na nuvem
            delete dados.tarefas[idTarefa]; // 🗑️ Remove localmente
        }
    }

    // 🔥 Remove a lista diretamente usando a chave
    delete dados.listas[idLista];

    // 🔥 Atualiza no LocalStorage
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // 🔥 Deleta a lista na nuvem
    deletar(`dados_kanban/listas/${idLista}`);

    // 🔄 Atualiza a interface
    fecharModalConfirmacao();
    renderizarQuadro();
}

async function confirmarAdicionarLista() {
    let inputLista = document.getElementById("input-nova-lista");
    let nomeLista = inputLista.value.trim();

    if (!nomeLista) {
        alert("O nome da lista não pode estar vazio.");
        return;
    }

    // 🔥 Garante que `dados` seja um objeto válido
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || {};

    // 🔥 Garante que `listas` seja um objeto antes de atribuir um novo item
    if (!dados.listas || typeof dados.listas !== "object") {
        dados.listas = {};
    }

    let idLista = unicoID(); // Gera um ID único para a lista

    dados.listas[idLista] = {
        id: idLista,
        titulo: nomeLista
    };

    if (!dados.tarefas) {
        dados.tarefas = {};
    }

    // 🔥 Salva os dados atualizados no LocalStorage
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // 🔥 Envia apenas a nova lista para a nuvem
    enviar(`dados_kanban/listas/${idLista}`, dados.listas[idLista]);

    // 🔥 LIMPA O INPUT APÓS ADICIONAR A LISTA
    inputLista.value = "";

    renderizarQuadro();
    fecharModais("modal-adicionar-lista");
}

function renderizarQuadro() {
    let quadro = document.getElementById("quadro");
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || {};

    // 🛠️ Garante que cada propriedade seja um objeto antes de acessar
    dados.listas = dados.listas && typeof dados.listas === "object" ? dados.listas : {};
    dados.tarefas = dados.tarefas && typeof dados.tarefas === "object" ? dados.tarefas : {};
    dados.etiquetasGlobais = dados.etiquetasGlobais && typeof dados.etiquetasGlobais === "object" ? dados.etiquetasGlobais : {};

    quadro.innerHTML = Object.values(dados.listas)
        .map(lista => {
            let tarefasDaLista = Object.values(dados.tarefas).filter(tarefa => tarefa.lista === lista.id);

            return `
                <div class="lista" id="${lista.id}">
                    <div class="titulo-lista">
                        <h3 ondblclick="editarTituloLista('${lista.id}', this)">${lista.titulo}</h3>
                        <button class="botao-excluir" onclick="abrirModalConfirmacao('lista', '${lista.id}', '${lista.titulo}')">❌</button>
                    </div>
                    <div class="tarefas" ondrop="soltar(event)" ondragover="permitirSoltar(event)">
                        ${tarefasDaLista.map(tarefa => `
                            <div class="tarefa" draggable="true" ondragstart="arrastar(event)" id="${tarefa.id}" 
                                onclick="abrirModal('${tarefa.lista}', '${tarefa.id}')">
                                <div class="etiquetas-tarefa">
                                    ${Object.values(tarefa.etiquetas || {}).map(etiqueta => `
                                        <span class="etiqueta-bolinha" style="background-color: ${etiqueta.cor};"></span>
                                    `).join("") || ""}
                                </div>
                                <p>${tarefa.texto}</p>
                                <button class="botao-excluir-tarefa" onclick="abrirModalConfirmacao('tarefa', '${tarefa.id}', '${tarefa.texto}'); event.stopPropagation();">❌</button>
                            </div>
                        `).join("")}
                    </div>
                    <button onclick="adicionarTarefa('${lista.id}')">➕ Adicionar Tarefa</button>
                </div>
            `;
        }).join("");
}

function editarTituloLista(idLista, elementoH3) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {} };
    let listaAlvo = dados.listas[idLista];

    if (!listaAlvo) return;

    let input = document.createElement("input");
    input.type = "text";
    input.value = listaAlvo.titulo;
    input.className = "input-edicao";
    input.setAttribute("data-id", idLista);

    // Aplica limitador de caracteres no input (máx. 25)
    aplicarLimitador(input, 25, `aviso-editar-lista-${idLista}`);

    elementoH3.replaceWith(input);
    input.focus();

    input.addEventListener("blur", () => salvarNovoTituloLista(input, elementoH3));
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") salvarNovoTituloLista(input, elementoH3);
    });
}

function salvarNovoTituloLista(input, elementoH3) {
    let idLista = input.getAttribute("data-id");
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {} };
    let listaAlvo = dados.listas[idLista];

    if (!listaAlvo) return;

    let novoTitulo = input.value.trim();
    if (!novoTitulo) return;

    listaAlvo.titulo = novoTitulo;
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    enviar(`dados_kanban/listas/${idLista}/titulo`, novoTitulo);

    let h3 = document.createElement("h3");
    h3.textContent = listaAlvo.titulo;
    h3.ondblclick = () => editarTituloLista(idLista, h3);
    input.replaceWith(h3);
}

function editarTituloTarefa(idLista, idTarefa) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { tarefas: {} };
    let tarefaAlvo = dados.tarefas[idTarefa];

    if (!tarefaAlvo) return;

    let input = document.createElement("input");
    input.type = "text";
    input.value = tarefaAlvo.texto;
    input.className = "input-edicao";
    input.setAttribute("data-id", idTarefa);

    // Criar um elemento de aviso caso necessário
    let avisoId = `aviso-editar-tarefa-${idTarefa}`;
    let aviso = document.getElementById(avisoId);
    if (!aviso) {
        aviso = document.createElement("p");
        aviso.id = avisoId;
        aviso.style.color = "red";
        aviso.style.fontSize = "12px";
        aviso.style.margin = "5px 0 0 0"; // Garante que fique abaixo do input
        aviso.style.display = "none"; // Esconde inicialmente
    }

    aplicarLimitador(input, 20, avisoId);

    let tarefaElemento = document.getElementById(idTarefa);
    if (tarefaElemento) {
        tarefaElemento.innerHTML = ""; // Limpa o conteúdo para inserir o input
        tarefaElemento.appendChild(input);
        tarefaElemento.appendChild(aviso); // Adiciona o aviso logo abaixo do input
    }

    input.focus();
    input.addEventListener("blur", () => salvarNovoTituloTarefa(input, idLista, idTarefa));
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") salvarNovoTituloTarefa(input, idLista, idTarefa);
    });
}

function salvarNovoTituloTarefa(input, idLista, idTarefa) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { tarefas: {} };
    let tarefaAlvo = dados.tarefas[idTarefa];

    if (!tarefaAlvo) return;

    let novoTitulo = input.value.trim();
    if (!novoTitulo) return;

    tarefaAlvo.texto = novoTitulo;
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    enviar(`dados_kanban/tarefas/${idTarefa}/texto`, novoTitulo);

    let tarefaElemento = document.getElementById(idTarefa);
    if (tarefaElemento) {
        tarefaElemento.innerHTML = `<p ondblclick="editarTituloTarefa('${idLista}', '${idTarefa}')">${novoTitulo}</p>`;
    }
}

function permitirSoltar(evento) {
    evento.preventDefault();
}

function arrastar(evento) {
    evento.dataTransfer.setData("texto", evento.target.id);
}

function soltar(evento) {
    evento.preventDefault();
    let idTarefa = evento.dataTransfer.getData("texto");
    let idListaDestino = evento.target.closest(".lista")?.id;

    if (!idListaDestino) {
        return;
    }

    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };

    let tarefaMovida = dados.tarefas[idTarefa];

    if (!tarefaMovida) {
        return;
    }

    let idListaOrigem = tarefaMovida.lista;

    // 🔥 Atualiza a lista da tarefa
    tarefaMovida.lista = idListaDestino;

    // 🔥 Atualiza na nuvem o novo local da tarefa
    enviar(`dados_kanban/tarefas/${idTarefa}/lista`, idListaDestino);

    // 🔥 Usa a nova função para salvar corretamente
    salvarTarefas(dados.tarefas);

    // Atualiza Interface
    renderizarQuadro();
}

async function abrirModal(idLista, idTarefa) {

    if (!idLista || !idTarefa) {
        return;
    }

    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };

    // 🛠️ Garante que tarefas seja um objeto válido
    if (!dados.tarefas || typeof dados.tarefas !== "object") {
        dados.tarefas = {};
        localStorage.setItem("dados_kanban", JSON.stringify(dados));
    }

    let tarefaAlvo = dados.tarefas[idTarefa];

    if (!tarefaAlvo) {
        return;
    }

    // 🔍 Campos do orçamento
    let idOrcamento = tarefaAlvo.idOrcamento || "";  // Armazena o ID real do orçamento
    let nomeOrcamento = tarefaAlvo.nomeOrcamento || "Nenhum"; // Nome formatado do orçamento

    // 🔍 Recupera orçamentos
    const orcamentos = await recuperarDados("dados_orcamentos") || {};

    if (idOrcamento && orcamentos[idOrcamento]) {
        let dadosOrcamento = orcamentos[idOrcamento].dados_orcam || {};
        let cliente = dadosOrcamento.cliente_selecionado || "Cliente desconhecido";
        let contrato = dadosOrcamento.contrato || "Contrato não informado";

        nomeOrcamento = `${cliente} - ${contrato}`;
    }

    let listaAlvo = dados.listas[idLista];

    if (!listaAlvo) {
        return;
    }

    if (tarefaAlvo) {
        // Garante que as etiquetas existam
        if (!tarefaAlvo.etiquetas) {
            tarefaAlvo.etiquetas = [];
        }

        let modal = document.getElementById("modal");
        let modalCorpo = document.getElementById("modal-corpo");
        let fundoEscuro = document.getElementById("fundo-escuro"); // Obtenha o fundo-escuro

        // Redefine o conteúdo do modal, mas preserva o título
        modalCorpo.innerHTML = `
          <div>
                <label for="tarefa-titulo">Título da Tarefa:</label>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="text" id="tarefa-titulo" value="${tarefaAlvo.texto}" 
                        class="input-estilo" maxlength="20" oninput="mostrarBotaoSalvar()">
                    <button id="botao-salvar-titulo" 
                        onclick="salvarTituloTarefa('${idLista}', '${idTarefa}')"
                        style="display: none;" 
                        class="botao-salvar">Salvar
                    </button>
                </div>
                <p id="aviso-tarefa-modal" style="color: red; font-size: 12px; display: none;"></p>
            </div>
            <div class="etiquetas">
                <h3>Etiquetas</h3>
        <div id="lista-etiquetas">
        ${Object.entries(tarefaAlvo.etiquetas || {}).map(([idEtiqueta, etiqueta]) => {
            let corTexto = definirCorTexto(etiqueta.cor); // 🔥 Chama a função para definir a cor do texto
            return `
                <span class="etiqueta" style="background-color: ${etiqueta.cor}; color: ${corTexto};">
                    ${etiqueta.nome}
                    <button class="botao-excluir"
                        onclick="removerEtiqueta('${idLista}', '${idTarefa}', '${idEtiqueta}')"
                        style="color: ${corTexto}; border: none; background: transparent; font-size: 14px;">✖</button>
                </span>
            `;
        }).join("") || "<p style='color: gray;'>Nenhuma etiqueta</p>"}
        </div>
        
        <button onclick="exibirOpcoesEtiquetas('${idLista}', '${idTarefa}')">➕ Adicionar Etiqueta</button>
            </div>

        <div class="descricao">
            <h3>Descrição</h3>
            <div>
                <label>N° Chamado:</label>
                <input type="text" id="input-chamado" value="${tarefaAlvo.descricao.chamado}">
            </div>
            <div>
                <label>Endereço da Loja:</label>
                <input type="text" id="input-endereco" value="${tarefaAlvo.descricao.endereco}">
            </div>
            <div>
                <label>Start:</label>
                <input type="date" id="input-start" value="${tarefaAlvo.descricao.start}">
            </div>
            <div>
                <label>Entrega:</label>
                <input type="date" id="input-entrega" value="${tarefaAlvo.descricao.entrega}">
            </div>
            <div>
                <label>Pedido de Serviço:</label>
                <input type="text" id="input-pedido-servico" value="${tarefaAlvo.descricao.pedidoServico}">
            </div>
            <div>
                <label>Pedido de Venda:</label>
                <input type="text" id="input-pedido-venda" value="${tarefaAlvo.descricao.pedidoVenda}">
            </div>
            <div>
                <label>Escopo:</label>
                <input type="text" id="input-escopo" value="${tarefaAlvo.descricao.escopo}">
            </div>
            <div>
                <label>Equipe:</label>
                <input type="text" id="input-equipe" value="${tarefaAlvo.descricao.equipe}">
            </div>
            <!-- Auto-complete para orçamento -->
            <h3>Orçamento</h3>
            <div style="position: relative;">
                <label for="input-auto-complete">Buscar Orçamento:</label>
                <input type="text" id="input-auto-complete" placeholder="Digite para buscar...">
                <ul id="sugestoes" class="auto-complete-list"></ul>
                <label>Orçamento Selecionado:</label>
                <p id="orcamento-selecionado">
                    <a href="#" id="orcamento-link" data-id="${idOrcamento}">${nomeOrcamento}</a>
                </p>
            </div>
        </div>

        <button onclick="salvarDescricao('${idLista}', '${idTarefa}')">Salvar Descrição</button>
        </div>
        <div class="anexos">
            <h3>Anexos</h3>
            <input type="file" id="input-anexos" multiple onchange="salvar_anexos_kanban(this, '${idTarefa}')">
            <div id="lista-anexos"></div>
        </div>
        <div class="atividades">
            <h3>Atividades</h3>
            <div id="lista-atividades"></div>
            <textarea id="novo-comentario" placeholder="Escreva um comentário..."></textarea>
            <button onclick="adicionarComentario('${idLista}', '${idTarefa}')">Adicionar Comentário</button>
        </div>`;

        // Renderizar as atividades dentro do modal
        renderizarAtividades(tarefaAlvo.atividades, tarefaAlvo.historico, idTarefa);

        setTimeout(() => {
            let orcamentoLink = document.getElementById("orcamento-link");
            if (orcamentoLink && idOrcamento) {
                orcamentoLink.addEventListener("click", (event) => {
                    event.preventDefault();
                    exibir_todos_os_status(idOrcamento);
                    fecharModal();
                });
            }
        }, 100);

        // Configuração do auto-complete
        const inputAutoComplete = document.getElementById("input-auto-complete");
        const listaSugestoes = document.getElementById("sugestoes");
        const paragrafoSelecionado = document.getElementById("orcamento-selecionado");

        inputAutoComplete.addEventListener("input", async () => {
            const termoBusca = inputAutoComplete.value.trim().toLowerCase();
            listaSugestoes.innerHTML = ""; // Limpa as sugestões

            if (termoBusca) {
                listaSugestoes.style.display = "block"; // Mostra a lista
                const dadosOrcamentos = await recuperarDados("dados_orcamentos") || {};

                // 🔍 Filtra apenas os orçamentos válidos (com cliente e contrato)
                const sugestoes = Object.entries(dadosOrcamentos)
                    .filter(([id, dados]) =>
                        dados.dados_orcam?.cliente_selecionado &&
                        dados.dados_orcam?.contrato &&
                        (
                            dados.dados_orcam.cliente_selecionado.toLowerCase().includes(termoBusca) ||
                            dados.dados_orcam.contrato.toLowerCase().includes(termoBusca)
                        )
                    );

                // Renderiza as sugestões formatadas corretamente
                sugestoes.forEach(([id, dados]) => {
                    const nomeFormatado = `${dados.dados_orcam.cliente_selecionado} - ${dados.dados_orcam.contrato}`;

                    const li = document.createElement("li");
                    li.textContent = nomeFormatado;

                    li.addEventListener("click", () => {
                        // 📌 Salva **idOrcamento** e **nomeOrcamento** corretamente
                        tarefaAlvo.idOrcamento = id;
                        tarefaAlvo.nomeOrcamento = nomeFormatado;

                        // 📌 Atualiza a exibição com o nome formatado
                        paragrafoSelecionado.innerHTML = `<a href="#" id="orcamento-link" data-id="${id}">${nomeFormatado}</a>`;

                        // 📌 Salva no LocalStorage
                        localStorage.setItem("dados_kanban", JSON.stringify(dados));

                        // 📌 Salva na nuvem os **dois campos**
                        enviar(`dados_kanban/tarefas/${idTarefa}/idOrcamento`, id);
                        enviar(`dados_kanban/tarefas/${idTarefa}/nomeOrcamento`, nomeFormatado);

                        // 📌 Limpa a lista de sugestões
                        listaSugestoes.innerHTML = "";
                        listaSugestoes.style.display = "none";
                        inputAutoComplete.value = "";

                        // 📌 Adiciona o evento de clique para abrir os detalhes
                        document.getElementById("orcamento-link").addEventListener("click", (event) => {
                            event.preventDefault();
                            exibir_todos_os_status(idOrcamento);
                            fecharModal();
                        });
                    });

                    listaSugestoes.appendChild(li);
                });

            } else {
                listaSugestoes.style.display = "none"; // Oculta a lista
            }
        });

        document.addEventListener("click", (event) => {
            if (!inputAutoComplete.contains(event.target) && !listaSugestoes.contains(event.target)) {
                listaSugestoes.style.display = "none";
            }
        });

        let inputTitulo = document.getElementById("tarefa-titulo");
        aplicarLimitador(inputTitulo, 20, "aviso-tarefa-modal");

        renderizarAnexos(idTarefa)

        // Exibe o modal
        modal.classList.remove("oculto");
        modal.style.display = "flex";
        fundoEscuro.classList.remove("oculto"); // Exibe o fundo escuro
    }
}

function mostrarBotaoSalvar() {
    let botao = document.getElementById("botao-salvar-titulo");
    let titulo = document.getElementById("tarefa-titulo").value.trim();
    botao.style.display = titulo ? "inline-block" : "none";
}

function fecharModal() {
    const modal = document.getElementById("modal");
    const fundoEscuro = document.getElementById("fundo-escuro");

    if (modal && fundoEscuro) {
        modal.style.display = "none"; // Esconde o modal
        fundoEscuro.classList.add("oculto"); // Esconde o fundo-escuro
    }
}

function abrirModais(modalId) {
    const modal = document.getElementById(modalId);
    const fundoEscuro = document.getElementById("fundo-escuro");

    if (modal && fundoEscuro) {
        modal.classList.remove("oculto"); // Mostra o modal
        fundoEscuro.classList.remove("oculto"); // Mostra o fundo-escuro
    }
}

function fecharModais(modalId) {
    const modal = document.getElementById(modalId);
    const fundoEscuro = document.getElementById("fundo-escuro");

    if (modal && fundoEscuro) {
        modal.classList.add("oculto"); // Esconde o modal
        fundoEscuro.classList.add("oculto"); // Esconde o fundo-escuro
    }
}

function adicionarComentario(idLista, idTarefa) {
    let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
    let criador = acesso.usuario || "Usuário desconhecido";

    let comentarioTexto = document.getElementById("novo-comentario").value.trim();
    if (!comentarioTexto) {
        alert("O comentário não pode estar vazio!");
        return;
    }

    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };
    let tarefaAlvo = dados.tarefas[idTarefa];

    if (!tarefaAlvo) {
        return;
    }

    if (!tarefaAlvo.atividades || typeof tarefaAlvo.atividades !== "object") {
        tarefaAlvo.atividades = {}; // Agora é um objeto!
    }

    let idComentario = unicoID(); // 🔥 Gera um ID único para o comentário

    // 📌 Captura data e hora
    let agora = new Date();
    let dataFormatada = agora.toLocaleDateString("pt-BR"); // "DD/MM/AAAA"
    let horaFormatada = agora.toLocaleTimeString("pt-BR", { hour12: false });

    // 📝 Adiciona o novo comentário ao objeto de atividades
    tarefaAlvo.atividades[idComentario] = {
        id: idComentario,
        tipo: "comentario",
        comentario: comentarioTexto,
        criador: criador,
        data: dataFormatada,
        hora: horaFormatada
    };

    // 🔥 Salva no localStorage
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // 🔥 Enviar **apenas** o novo comentário para a nuvem
    enviar(`dados_kanban/tarefas/${idTarefa}/atividades/${idComentario}`, tarefaAlvo.atividades[idComentario]);

    // ✅ LIMPA O TEXTAREA APÓS O COMENTÁRIO
    document.getElementById("novo-comentario").value = "";

    // Atualiza a exibição no modal
    renderizarAtividades(tarefaAlvo.atividades, tarefaAlvo.historico, idLista, idTarefa);
}

function renderizarAtividades(atividades, historico, idLista, idTarefa) {
    const listaAtividades = document.getElementById("lista-atividades");

    if (!listaAtividades) return;

    // 🚀 Garante que atividades e histórico sejam objetos válidos
    atividades = atividades && typeof atividades === "object" ? Object.values(atividades) : [];
    historico = historico && typeof historico === "object" ? Object.values(historico) : [];

    let todasAtividades = [...atividades, ...historico];

    // 🚨 Verifica se há atividades antes de exibir
    if (todasAtividades.length === 0) {
        listaAtividades.innerHTML = "<p style='color: gray;'>Nenhuma atividade registrada.</p>";
        return;
    }

    // 🔥 Ordena por data e hora
    todasAtividades.sort((a, b) => {
        let dataA = new Date(`${a.data.split("/").reverse().join("-")} ${a.hora}`).getTime();
        let dataB = new Date(`${b.data.split("/").reverse().join("-")} ${b.hora}`).getTime();
        return dataB - dataA;
    });

    listaAtividades.innerHTML = todasAtividades
        .map(atividade => {
            let icone = "💬";
            let mensagem = "";
            let botaoExcluir = "";

            if (atividade.tipo === "comentario") {
                icone = "💬";
                mensagem = `${atividade.criador}: ${atividade.comentario || "⚠️ Sem descrição"}`;

                // 🔥 Exibir botão de exclusão se for o criador do comentário
                let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
                let usuarioLogado = acesso.usuario || "Usuário desconhecido";
                if (atividade.criador === usuarioLogado) {
                    botaoExcluir = `<button class="botao-excluir-comentario" onclick="excluirComentario('${idLista}', '${idTarefa}', '${atividade.id}')">❌</button>`;
                }
            } else if (atividade.tipo === "alteração") {
                icone = "✏️";
                let camposFormatados = atividade.campos && atividade.campos.length > 0 ? atividade.campos.join(", ") : "⚠️ Alteração desconhecida";
                mensagem = `${atividade.criador} fez alterações em: ${camposFormatados}`;
            } else if (atividade.tipo === "criação") {
                icone = "📌";
                mensagem = `${atividade.mensagem}`;
            }

            return `
                <div class="comentario-container">
                    <div class="comentario-info">
                        <span class="comentario-data">${atividade.data} ${atividade.hora}</span>
                        ${botaoExcluir}
                    </div>
                    <textarea class="comentario-textarea" readonly>${mensagem}</textarea>
                </div>
            `;
        })
        .join("");
}

/**
 * Função para formatar a data no padrão brasileiro (DD/MM/AA)
 */
function formatarData(dataISO) {
    if (!dataISO) return "Data inválida";
    const data = new Date(dataISO);
    return data.toLocaleDateString("pt-BR", { year: "2-digit", month: "2-digit", day: "2-digit" });
}
/**
 * Função auxiliar para formatar a data no padrão brasileiro
 */

function salvarDescricao(idLista, idTarefa) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };

    if (!dados.tarefas) {
        dados.tarefas = {};
    }

    let tarefaAlvo = dados.tarefas[idTarefa];

    if (!tarefaAlvo) {
        return;
    }

    let descricaoAntiga = { ...tarefaAlvo.descricao };

    // 🔍 Captura os valores do formulário
    let novaDescricao = {
        chamado: document.getElementById("input-chamado")?.value.trim() || "",
        endereco: document.getElementById("input-endereco")?.value.trim() || "",
        start: document.getElementById("input-start")?.value.trim() || "",
        entrega: document.getElementById("input-entrega")?.value.trim() || "",
        pedidoServico: document.getElementById("input-pedido-servico")?.value.trim() || "",
        pedidoVenda: document.getElementById("input-pedido-venda")?.value.trim() || "",
        escopo: document.getElementById("input-escopo")?.value.trim() || "",
        equipe: document.getElementById("input-equipe")?.value.trim() || ""
    };

    // 🔍 Mapeia nomes técnicos para nomes legíveis
    const nomesCampos = {
        chamado: "N° Chamado",
        endereco: "Endereço da Loja",
        start: "Data de Início",
        entrega: "Data de Entrega",
        pedidoServico: "Pedido de Serviço",
        pedidoVenda: "Pedido de Venda",
        escopo: "Escopo",
        equipe: "Equipe"
    };

    // 🔍 Detecta quais campos foram alterados e converte para rótulos legíveis
    let camposAlterados = [];
    for (let chave in novaDescricao) {
        if (novaDescricao[chave] !== descricaoAntiga[chave]) {
            camposAlterados.push(nomesCampos[chave]); // Converte para nome legível
        }
    }

    // Se nada foi alterado, interrompe a função
    if (camposAlterados.length === 0) {
        return;
    }

    // Atualiza a descrição da tarefa
    tarefaAlvo.descricao = { ...novaDescricao };

    let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
    let usuario = acesso.usuario || "Usuário desconhecido";

    let agora = new Date();
    let dataFormatada = agora.toISOString().split("T")[0];
    let horaFormatada = agora.toLocaleTimeString("pt-BR", { hour12: false });

    // 📌 Garante que `historico` seja um objeto antes de adicionar um novo registro
    if (!tarefaAlvo.historico || typeof tarefaAlvo.historico !== "object") {
        tarefaAlvo.historico = {};
    }

    // 🔥 Adiciona corretamente os campos alterados no histórico
    let idHistorico = unicoID();
    tarefaAlvo.historico[idHistorico] = {
        tipo: "alteração",
        criador: usuario,
        mensagem: `Alteração realizada nos campos: ${camposAlterados.join(", ")}`,
        campos: camposAlterados, // Agora armazena os nomes legíveis
        data: dataFormatada,
        hora: horaFormatada
    };

    // 🔥 Salva no LocalStorage corretamente
    dados.tarefas[idTarefa] = tarefaAlvo;
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // 🔥 Atualiza na nuvem apenas os dados alterados
    enviar(`dados_kanban/tarefas/${idTarefa}/descricao`, tarefaAlvo.descricao);
    enviar(`dados_kanban/tarefas/${idTarefa}/historico/${idHistorico}`, tarefaAlvo.historico[idHistorico]);

    // Atualiza a interface do quadro e reabre o modal para refletir as alterações
    renderizarQuadro();
    abrirModal(idLista, idTarefa);
}

function salvarTituloTarefa(idLista, idTarefa) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };
    let tarefaAlvo = dados.tarefas[idTarefa];

    if (!tarefaAlvo) {
        return;
    }

    let novoTitulo = document.getElementById("tarefa-titulo").value.trim();

    if (!novoTitulo) {
        alert("O título da tarefa não pode estar vazio!");
        return;
    }

    // 📌 Armazena o título anterior para histórico
    let tituloAnterior = tarefaAlvo.texto;

    // 📌 Atualiza o título da tarefa
    tarefaAlvo.texto = novoTitulo;

    // 📌 Adiciona ao histórico
    let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
    let usuario = acesso.usuario || "Usuário desconhecido";

    let agora = new Date();
    let dataFormatada = agora.toISOString().split("T")[0];
    let horaFormatada = agora.toLocaleTimeString("pt-BR", { hour12: false });

    // Garante que `historico` seja um objeto antes de adicionar um novo registro
    if (!tarefaAlvo.historico || typeof tarefaAlvo.historico !== "object") {
        tarefaAlvo.historico = {};
    }

    // Gera um ID único para o novo histórico
    let idHistorico = unicoID();

    tarefaAlvo.historico[idHistorico] = {
        tipo: "alteração",
        criador: usuario,
        campos: ["Título da Tarefa"],
        mensagem: `Título alterado de "${tituloAnterior}" para "${novoTitulo}"`,
        data: dataFormatada,
        hora: horaFormatada
    };

    // 🔥 Atualiza os dados no LocalStorage corretamente
    dados.tarefas[idTarefa] = tarefaAlvo;
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // 🔥 Atualizar na nuvem (se aplicável)
    enviar(`dados_kanban/tarefas/${idTarefa}/texto`, novoTitulo);
    enviar(`dados_kanban/tarefas/${idTarefa}/historico/${idHistorico}`, tarefaAlvo.historico[idHistorico]);

    // Atualiza a interface do quadro e reabre o modal para refletir as alterações
    renderizarQuadro();
    abrirModal(idLista, idTarefa);
}

function adicionarEtiquetaTarefa(idLista, idTarefa, idEtiqueta) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };

    let tarefaAlvo = dados.tarefas[idTarefa];

    if (!tarefaAlvo) return;

    if (!tarefaAlvo.etiquetas || typeof tarefaAlvo.etiquetas !== "object") {
        tarefaAlvo.etiquetas = {}; // 🔥 Agora etiquetas é um objeto
    }

    if (!tarefaAlvo.etiquetas[idEtiqueta]) {
        let etiqueta = dados.etiquetasGlobais[idEtiqueta];

        if (!etiqueta) {
            alert("Etiqueta não encontrada.");
            return;
        }

        tarefaAlvo.etiquetas[idEtiqueta] = etiqueta; // 🔥 Agora armazenamos como objeto
        salvarTarefas(dados.tarefas);

        // 🔥 Envia apenas a nova etiqueta para a nuvem
        enviar(`dados_kanban/tarefas/${idTarefa}/etiquetas/${idEtiqueta}`, etiqueta);
    }

    renderizarQuadro();
    abrirModal(idLista, idTarefa);
}

function adicionarEtiquetaGlobal(idLista, idTarefa) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };

    // 📌 Garante que as estruturas essenciais existam
    if (!dados.etiquetasGlobais || typeof dados.etiquetasGlobais !== "object") {
        dados.etiquetasGlobais = {};
    }

    let nome = document.getElementById("nova-etiqueta-nome-global").value.trim();
    let cor = document.getElementById("nova-etiqueta-cor-global").value;

    if (!nome) {
        alert("O nome da etiqueta não pode estar vazio.");
        return;
    }

    // 📌 Garante que `unicoID` retorna um valor válido
    let idEtiqueta = unicoID();
    if (!idEtiqueta) {
        return;
    }

    let novaEtiqueta = { id: idEtiqueta, nome, cor };

    // 📌 Salva no objeto local e no localStorage
    dados.etiquetasGlobais[idEtiqueta] = novaEtiqueta;
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // 🔥 Enviar apenas a nova etiqueta para a nuvem
    enviar(`dados_kanban/etiquetasGlobais/${idEtiqueta}`, novaEtiqueta);

    // 📌 Atualiza a interface e a persistência global
    salvarEtiquetasGlobais(dados.etiquetasGlobais);

    // 📌 Só adiciona à tarefa se IDs forem válidos
    if (idLista && idTarefa) {
        adicionarEtiquetaTarefa(idLista, idTarefa, idEtiqueta);
    }
}

function removerEtiquetaConfirmada(idEtiqueta) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {} };

    Object.values(dados.tarefas).forEach(tarefa => {
        if (tarefa.etiquetas && tarefa.etiquetas[idEtiqueta]) {
            delete tarefa.etiquetas[idEtiqueta];
        }
    });

    // Salva no localStorage
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // Atualiza a interface
    fecharModalConfirmacao();
    renderizarQuadro();
}

function removerEtiqueta(idLista, idTarefa, idEtiqueta) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };

    let tarefaAlvo = dados.tarefas[idTarefa];

    if (!tarefaAlvo || !tarefaAlvo.etiquetas || !tarefaAlvo.etiquetas[idEtiqueta]) {
        return;
    }

    // 🗑️ Remove a etiqueta da tarefa
    delete tarefaAlvo.etiquetas[idEtiqueta];

    // 🔥 Atualiza no localStorage
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // 🔥 Remove da nuvem
    deletar(`dados_kanban/tarefas/${idTarefa}/etiquetas/${idEtiqueta}`);

    // 🔄 Atualiza a interface
    renderizarQuadro();
    abrirModal(idLista, idTarefa); // Reabre o modal atualizado
}


function inicializarEtiquetasGlobais() {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: {} };

    // ✅ Se `etiquetasGlobais` não for um objeto, corrige
    if (typeof dados.etiquetasGlobais !== "object") {
        dados.etiquetasGlobais = {};
        salvarEtiquetasGlobais(dados.etiquetasGlobais);
    }
}

function exibirOpcoesEtiquetas(idLista, idTarefa) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: {} };
    let etiquetasGlobais = dados.etiquetasGlobais || {};

    let modalCorpo = document.getElementById("modal-corpo");
    let opcoesExistentes = document.getElementById("opcoes-etiquetas");
    if (opcoesExistentes) opcoesExistentes.remove();

    let opcoesHTML = `
        <div id="opcoes-etiquetas">
            <h3>Escolha uma Etiqueta</h3>
            <div id="lista-etiquetas-globais">
                ${Object.entries(etiquetasGlobais).length > 0
            ? Object.entries(etiquetasGlobais).map(([idEtiqueta, etiqueta]) => `
                    <div class="etiqueta-opcao" onclick="adicionarEtiquetaTarefa('${idLista}', '${idTarefa}', '${idEtiqueta}')">
                        <span class="etiqueta-bolinha" style="background-color: ${etiqueta.cor};"></span>
                        <span class="etiqueta-nome">${etiqueta.nome}</span>
                        <button class="botao-editar-etiqueta" onclick="editarEtiqueta('${idEtiqueta}'); event.stopPropagation();">✏️</button>
                        <button class="botao-excluir" onclick="abrirModalConfirmacao('etiquetaGlobal', '${idEtiqueta}', '${etiqueta.nome}'); event.stopPropagation();">❌</button>
                    </div>
                `).join("")
            : "<p style='color: gray;'>Nenhuma etiqueta disponível</p>"
        }
            </div>
            <h3>Nova Etiqueta</h3>
            <div>
                <input type="text" id="nova-etiqueta-nome-global" placeholder="Nome da Etiqueta" />
                <input type="color" id="nova-etiqueta-cor-global" value="#ff0000" />
                <button onclick="adicionarEtiquetaGlobal('${idLista}', '${idTarefa}')">Adicionar</button>
            </div>
        </div>
    `;

    modalCorpo.insertAdjacentHTML("beforeend", opcoesHTML);

    // 🔥 Faz o scroll para a área de opções de etiquetas
    setTimeout(() => {
        let opcoesEtiquetas = document.getElementById("opcoes-etiquetas");
        if (opcoesEtiquetas) {
            opcoesEtiquetas.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, 200);
}

function editarEtiqueta(idEtiqueta) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: {} };
    let etiqueta = dados.etiquetasGlobais[idEtiqueta];

    if (!etiqueta) {
        alert("Etiqueta não encontrada!");
        return;
    }

    let modalCorpo = document.getElementById("modal-corpo");

    // Criar um modal para edição
    let modalEdicao = document.createElement("div");
    modalEdicao.id = "modal-editar-etiqueta";
    modalEdicao.classList.add("modal");
    modalEdicao.innerHTML = `
        <h3>Editar Etiqueta</h3>
        <label>Nome:</label>
        <input type="text" id="editar-etiqueta-nome" value="${etiqueta.nome}" />
        <label>Cor:</label>
        <input type="color" id="editar-etiqueta-cor" value="${etiqueta.cor}" />
        <button onclick="salvarEdicaoEtiqueta('${idEtiqueta}')">Salvar</button>
        <button onclick="fecharModalEdicao()">Cancelar</button>
    `;

    // Remover o modal antigo caso já exista
    let modalAntigo = document.getElementById("modal-editar-etiqueta");
    if (modalAntigo) modalAntigo.remove();

    modalCorpo.appendChild(modalEdicao);

    // 🔥 Scroll automático para o modal de edição
    setTimeout(() => {
        modalEdicao.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 200);
}

function salvarEdicaoEtiqueta(idEtiqueta) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: {} };
    let etiqueta = dados.etiquetasGlobais[idEtiqueta];

    if (!etiqueta) return;

    let novoNome = document.getElementById("editar-etiqueta-nome").value.trim();
    let novaCor = document.getElementById("editar-etiqueta-cor").value;

    if (!novoNome) {
        alert("O nome da etiqueta não pode estar vazio!");
        return;
    }

    // Atualiza o localStorage
    etiqueta.nome = novoNome;
    etiqueta.cor = novaCor;
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // 🔥 Atualizar apenas os campos modificados na nuvem
    enviar(`dados_kanban/etiquetasGlobais/${idEtiqueta}/nome`, novoNome);
    enviar(`dados_kanban/etiquetasGlobais/${idEtiqueta}/cor`, novaCor);

    fecharModalEdicao();
    exibirOpcoesEtiquetas();
}

function deletarEtiquetaGlobalConfirmada(idEtiqueta) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };

    if (!dados.etiquetasGlobais || typeof dados.etiquetasGlobais !== "object") {
        dados.etiquetasGlobais = {};
    }

    // 🚨 Se a etiqueta não existir, interrompe a função
    if (!dados.etiquetasGlobais[idEtiqueta]) {
        return;
    }

    // 🔥 Remove a etiqueta global
    delete dados.etiquetasGlobais[idEtiqueta];

    // 🔥 Percorre todas as tarefas para remover a etiqueta delas
    let tarefasAfetadas = [];
    Object.values(dados.tarefas).forEach(tarefa => {
        if (tarefa.etiquetas && tarefa.etiquetas[idEtiqueta]) {
            delete tarefa.etiquetas[idEtiqueta]; // Remove a etiqueta da tarefa
            tarefasAfetadas.push(tarefa.id);

            // 🔥 Atualiza a tarefa na nuvem removendo a etiqueta
            deletar(`dados_kanban/tarefas/${tarefa.id}/etiquetas/${idEtiqueta}`);
        }
    });

    // 🔥 Salva no LocalStorage
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // 🔥 Remove a etiqueta global na nuvem
    deletar(`dados_kanban/etiquetasGlobais/${idEtiqueta}`);

    // 🔄 Atualiza a interface do quadro
    renderizarQuadro();

    // 🔄 Atualiza a interface do modal aberto (se houver)
    let modalCorpo = document.getElementById("modal-corpo");
    if (modalCorpo) {
        tarefasAfetadas.forEach(idTarefa => {
            let listaEtiquetas = document.getElementById("lista-etiquetas");
            if (listaEtiquetas) {
                let etiquetaRemovida = listaEtiquetas.querySelector(`[data-id="${idEtiqueta}"]`);
                if (etiquetaRemovida) etiquetaRemovida.remove(); // Remove a etiqueta visualmente
            }
        });
    }

    // 🔄 Atualiza o modal de etiquetas
    exibirOpcoesEtiquetas();
}

function fecharModalEdicao() {
    let modalEdicao = document.getElementById("modal-editar-etiqueta");
    if (modalEdicao) modalEdicao.remove();
}

function excluirComentario(idLista, idTarefa, idComentario) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };

    let tarefaAlvo = dados.tarefas[idTarefa];

    if (!tarefaAlvo || !tarefaAlvo.atividades || !tarefaAlvo.atividades[idComentario]) {
        return;
    }

    let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
    let usuarioLogado = acesso.usuario || "Usuário desconhecido";

    if (tarefaAlvo.atividades[idComentario].criador !== usuarioLogado) {
        alert("❌ Você só pode excluir os comentários que você criou!");
        return;
    }

    // 🗑️ Remove o comentário da estrutura local
    delete tarefaAlvo.atividades[idComentario];

    // 🔥 Salva as mudanças no localStorage
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // 🔥 Deletar **apenas** o comentário na nuvem
    deletar(`dados_kanban/tarefas/${idTarefa}/atividades/${idComentario}`);

    // Atualiza a exibição no modal
    renderizarAtividades(tarefaAlvo.atividades, tarefaAlvo.historico, idLista, idTarefa);
}

function definirCorTexto(corHex) {
    // Remove o "#" se estiver presente
    corHex = corHex.replace("#", "");

    // Converte o HEX para valores RGB
    let r = parseInt(corHex.substring(0, 2), 16);
    let g = parseInt(corHex.substring(2, 4), 16);
    let b = parseInt(corHex.substring(4, 6), 16);

    // Calcula a luminância
    let luminancia = (0.299 * r) + (0.587 * g) + (0.114 * b);

    // Se for clara, retorna preto, senão branco
    return luminancia > 128 ? "#000000" : "#FFFFFF";
}

async function carregarDadosDaNuvem() {

    // 🔥 Exibe o overlay carregando
    document.body.insertAdjacentHTML("beforebegin", overlay_aguarde())

    let dadosRecebidos = await receber("dados_kanban");

    console.log("Dados Recebidos!!!");

    if (dadosRecebidos) {
        if (!dadosRecebidos.etiquetasGlobais || typeof dadosRecebidos.etiquetasGlobais !== "object") {
            dadosRecebidos.etiquetasGlobais = {};
        }

        localStorage.setItem("dados_kanban", JSON.stringify(dadosRecebidos));
        inicializarEtiquetasGlobais();
        carregarListas();
        renderizarQuadro();
    }
    
    document.getElementById("aguarde").remove()
    
}

function aplicarLimitador(input, maxCaracteres, idAviso) {
    let aviso = document.getElementById(idAviso);

    if (!aviso) {
        aviso = document.createElement("p");
        aviso.id = idAviso;
        aviso.style.color = "red";
        aviso.style.fontSize = "12px";
        aviso.style.marginTop = "5px";
        aviso.style.display = "none";
        input.insertAdjacentElement("afterend", aviso);
    }

    input.addEventListener("input", function () {
        if (this.value.length > maxCaracteres) {
            this.value = this.value.substring(0, maxCaracteres);
            aviso.textContent = `⚠️ Máximo de ${maxCaracteres} caracteres permitido.`;
            aviso.style.display = "block";
        } else {
            aviso.style.display = "none";
        }
    });

    input.addEventListener("blur", function () {
        aviso.style.display = "none";
    });
}

document.addEventListener("DOMContentLoaded", function () {
    // Validação para criar Lista (máx. 25 caracteres)
    let inputLista = document.getElementById("input-nova-lista");
    if (inputLista) {
        inputLista.addEventListener("input", function () {
            let maxCaracteres = 25;
            let aviso = document.getElementById("aviso-lista");

            if (!aviso) {
                aviso = document.createElement("p");
                aviso.id = "aviso-lista";
                aviso.style.color = "red";
                aviso.style.fontSize = "12px";
                this.insertAdjacentElement("afterend", aviso);
            }

            if (this.value.length > maxCaracteres) {
                this.value = this.value.substring(0, maxCaracteres);
                aviso.textContent = `⚠️ O nome da lista pode ter no máximo ${maxCaracteres} caracteres.`;
            } else {
                aviso.textContent = ""; // Remove o aviso quando o texto está dentro do limite
            }
        });
    }

    // Validação para criar Tarefa (máx. 20 caracteres)
    let inputTarefa = document.getElementById("input-nova-tarefa");
    if (inputTarefa) {
        inputTarefa.addEventListener("input", function () {
            let maxCaracteres = 20;
            let aviso = document.getElementById("aviso-tarefa");

            if (!aviso) {
                aviso = document.createElement("p");
                aviso.id = "aviso-tarefa";
                aviso.style.color = "red";
                aviso.style.fontSize = "12px";
                this.insertAdjacentElement("afterend", aviso);
            }

            if (this.value.length > maxCaracteres) {
                this.value = this.value.substring(0, maxCaracteres);
                aviso.textContent = `⚠️ O nome da tarefa pode ter no máximo ${maxCaracteres} caracteres.`;
            } else {
                aviso.textContent = ""; // Remove o aviso quando o texto está dentro do limite
            }
        });
    }
});

async function salvar_anexos_kanban(input, idTarefa) {
    if (!idTarefa) {
        alert("Erro: Nenhuma tarefa foi selecionada!");
        return;
    }

    let anexos = await anexo_v2(input); // Simulação da função de upload
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {} };
    let tarefa = dados.tarefas[idTarefa];

    if (!tarefa) return;

    if (!tarefa.anexos) {
        tarefa.anexos = {};
    }

    anexos.forEach(anexo => {
        tarefa.anexos[anexo.link] = anexo;
        enviar(`dados_kanban/tarefas/${idTarefa}/anexos/${anexo.link}`, anexo);
    });

    // Atualiza localmente
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // Recarrega os anexos no modal
    renderizarAnexos(idTarefa);
}

function renderizarAnexos(idTarefa) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {} };
    let tarefa = dados.tarefas[idTarefa];

    let listaAnexos = document.getElementById("lista-anexos");
    if (!listaAnexos) return;

    if (!tarefa || !tarefa.anexos || Object.keys(tarefa.anexos).length === 0) {
        listaAnexos.innerHTML = "<p style='color: gray;'>Nenhum anexo encontrado.</p>";
        return;
    }

    listaAnexos.innerHTML = Object.values(tarefa.anexos)
        .map(anexo => {
            let nomeFormatado = anexo.nome.length > 15
                ? `${anexo.nome.slice(0, 6)}...${anexo.nome.slice(-6)}`
                : anexo.nome;

            return `
            <div class="contorno" style="display: flex; align-items: center; justify-content: center; width: max-content; gap: 10px; background-color: #222; color: white;">
                <div style="cursor: pointer;" class="anexo-item" onclick="abrirArquivo('${anexo.link}')">
                    <img src="imagens/anexo2.png" style="width: 25px; height: 25px;">
                    <label title="${anexo.nome}">${nomeFormatado}</label>
                </div>
                <img src="imagens/cancel.png" style="width: 25px; height: 25px; cursor: pointer;" onclick="removerAnexo('${idTarefa}', '${anexo.link}')">
            </div>
                </div>
            `;
        })
        .join("");

}

function removerAnexo(idTarefa, linkAnexo) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {} };
    let tarefa = dados.tarefas[idTarefa];

    if (!tarefa || !tarefa.anexos || !tarefa.anexos[linkAnexo]) return;

    delete tarefa.anexos[linkAnexo];

    // Atualiza o localStorage
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // Remove da nuvem
    deletar(`dados_kanban/tarefas/${idTarefa}/anexos/${linkAnexo}`);

    // Atualiza a interface
    renderizarAnexos(idTarefa);
}

