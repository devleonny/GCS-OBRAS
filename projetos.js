document.addEventListener("DOMContentLoaded", async () => {
    await carregarDadosDaNuvem(); // Busca os dados da nuvem 
});

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



let idListaAtual = null; // Variável para armazenar a lista onde será adicionada a tarefa

function adicionarTarefa(idLista) {
    idListaAtual = idLista; // Salva o ID da lista para referência posterior
    abrirModais('modal-adicionar-tarefa');
}

function confirmarAdicionarTarefa() {
    let inputTarefa = document.getElementById("input-nova-tarefa");
    let textoTarefa = inputTarefa.value.trim();

    if (!textoTarefa || !idListaAtual) {
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
        etiquetas: [],
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
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };

    if (!dados.tarefas[idTarefa]) {
        return;
    }

    // 🔥 Deletar da nuvem
    deletar(`dados_kanban/tarefas/${idTarefa}`);

    // 🔥 Remove localmente
    delete dados.tarefas[idTarefa];

    // 🔥 Usa a nova função para salvar corretamente
    salvarTarefas(dados.tarefas);

    // Atualiza Interface
    renderizarQuadro();
}

function excluirLista(idLista) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };

    if (!dados.listas[idLista]) {
        return;
    }

    // 📌 Garante que o objeto tarefas exista
    if (!dados.tarefas || typeof dados.tarefas !== "object") {
        dados.tarefas = {};
    }

    // 🔥 Deleta todas as tarefas pertencentes à lista
    Object.keys(dados.tarefas).forEach(idTarefa => {
        if (dados.tarefas[idTarefa].lista === idLista) {
            delete dados.tarefas[idTarefa];

            // 🔥 Remove a tarefa da nuvem
            deletar(`dados_kanban/tarefas/${idTarefa}`);
        }
    });

    // 🔥 Remove a lista
    delete dados.listas[idLista];

    // 🔥 Atualiza o LocalStorage
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // 🔥 Remove a lista da nuvem
    deletar(`dados_kanban/listas/${idLista}`);

    // Atualiza a interface
    renderizarQuadro();
}

async function confirmarAdicionarLista() {
    let inputLista = document.getElementById("input-nova-lista");
    let nomeLista = inputLista.value.trim();

    if (!nomeLista) {
        alert("O nome da lista não pode estar vazio.");
        return;
    }

    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };
    let idLista = unicoID(); // Gera um ID único para a lista

    dados.listas[idLista] = {
        id: idLista,
        titulo: nomeLista
    };

    if (!dados.tarefas) {
        dados.tarefas = {};
    }

    // Salva no LocalStorage
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
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };

    quadro.innerHTML = Object.values(dados.listas)
        .map(lista => {
            // 🔥 Obtendo as tarefas da lista correta
            let tarefasDaLista = Object.values(dados.tarefas).filter(tarefa => tarefa.lista === lista.id);

            return `
                <div class="lista" id="${lista.id}">
                    <div class="titulo-lista">
                        <h3 ondblclick="editarTituloLista('${lista.id}', this)">${lista.titulo}</h3>
                        <button class="botao-excluir" onclick="excluirLista('${lista.id}')">❌</button>
                    </div>
                    <div class="tarefas" ondrop="soltar(event)" ondragover="permitirSoltar(event)">
                        ${tarefasDaLista.map(tarefa => `
                            <div class="tarefa" draggable="true" ondragstart="arrastar(event)" id="${tarefa.id}" 
    onclick="abrirModal('${tarefa.lista}', '${tarefa.id}')">

                                <div class="etiquetas-tarefa">
                                    ${tarefa.etiquetas?.map(idEtiqueta => {
                let etiqueta = dados.etiquetasGlobais[idEtiqueta];
                return etiqueta
                    ? `<span class="etiqueta-bolinha" style="background-color: ${etiqueta.cor};"></span>`
                    : "";
            }).join("") || ""}
                                </div>
                                <p>${tarefa.texto}</p>
                                <button class="botao-excluir-tarefa" onclick="excluirTarefa('${tarefa.id}'); event.stopPropagation();">❌</button>
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

    if (!dados.tarefas || typeof dados.tarefas !== "object") {
        dados.tarefas = {};
        localStorage.setItem("dados_kanban", JSON.stringify(dados));
    }

    let tarefaAlvo = dados.tarefas[idTarefa];

    if (!tarefaAlvo) {
        return;
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

        let linkOrcamento = tarefaAlvo.orcamento
            ? `<a href="#" id="orcamento-link">${tarefaAlvo.orcamento}</a>`
            : "Nenhum";

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
        ${tarefaAlvo.etiquetas.map(idEtiqueta => {
            let etiqueta = dados.etiquetasGlobais[idEtiqueta];
            return etiqueta ? `
                <span class="etiqueta" style="background-color: ${etiqueta.cor}; color: ${definirCorTexto(etiqueta.cor)};">
                    ${etiqueta.nome}
                    <button class="botao-excluir botao-excluir-etiqueta" 
                        onclick="removerEtiqueta('${idLista}', '${idTarefa}', '${idEtiqueta}')">❌</button>
                </span>
            ` : "";
        }).join("")}
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
            <div style="position: relative;">
                <label for="input-auto-complete">Buscar Orçamento:</label>
                <input type="text" id="input-auto-complete" placeholder="Digite para buscar...">
                <ul id="sugestoes" class="auto-complete-list"></ul>
                <label>Orçamento Selecionado:</label>
                <p id="orcamento-selecionado">${linkOrcamento}</p>
            </div>
            <button onclick="salvarDescricao('${idLista}', '${idTarefa}')">Salvar Descrição</button>
        </div>
        <div class="atividades">
            <h3>Atividades</h3>
            <div id="lista-atividades"></div>
            <textarea id="novo-comentario" placeholder="Escreva um comentário..."></textarea>
            <button onclick="adicionarComentario('${idLista}', '${idTarefa}')">Adicionar Comentário</button>
        </div>`;

        // Renderizar as atividades dentro do modal
        renderizarAtividades(tarefaAlvo.atividades, tarefaAlvo.historico, idTarefa);

        // Configuração do auto-complete
        const inputAutoComplete = document.getElementById("input-auto-complete");
        const listaSugestoes = document.getElementById("sugestoes");
        const paragrafoSelecionado = document.getElementById("orcamento-selecionado");

        inputAutoComplete.addEventListener("input", async () => {
            const termoBusca = inputAutoComplete.value.trim().toLowerCase();
            listaSugestoes.innerHTML = ""; // Limpa as sugestões

            if (termoBusca) {
                listaSugestoes.style.display = "block"; // Mostra a lista
                const dadosOrcamentos = await recuperarDados("dados_orcamentos");

                // Filtra os dados
                const sugestoes = Object.keys(dadosOrcamentos).filter(chave =>
                    chave.toLowerCase().includes(termoBusca)
                );

                // Renderiza as sugestões
                sugestoes.forEach(chave => {
                    const li = document.createElement("li");
                    li.textContent = chave;

                    li.addEventListener("click", () => {
                        // Atualiza o orçamento na tarefa
                        tarefaAlvo.orcamento = chave;

                        // Substitui o parágrafo por um link
                        paragrafoSelecionado.innerHTML = `<a href="#" id="orcamento-link">${chave}</a>`;

                        // Salva a lista atualizada no localStorage
                        salvarListas(dados.listas);

                        // Limpa a lista de sugestões e o campo de input
                        listaSugestoes.innerHTML = "";
                        listaSugestoes.style.display = "none";
                        inputAutoComplete.value = "";

                        // Adiciona o evento de clique no link para chamar a função
                        document.getElementById("orcamento-link").addEventListener("click", (event) => {
                            event.preventDefault(); // Evita que o link recarregue a página
                            exibir_todos_os_status(chave);
                            fecharModal();
                        });
                    });

                    listaSugestoes.appendChild(li);
                });

            } else {
                listaSugestoes.style.display = "none"; // Oculta a lista
            }
        });


        // Oculta a lista ao clicar fora do campo de entrada
        document.addEventListener("click", (event) => {
            if (!inputAutoComplete.contains(event.target) && !listaSugestoes.contains(event.target)) {
                listaSugestoes.style.display = "none";
            }
        });

        setTimeout(() => {
            let orcamentoLink = document.getElementById("orcamento-link");
            if (orcamentoLink && tarefaAlvo.orcamento) {
                orcamentoLink.addEventListener("click", (event) => {
                    event.preventDefault();
                    exibir_todos_os_status(tarefaAlvo.orcamento);
                    fecharModal();
                });
            }
        }, 100);


        let inputTitulo = document.getElementById("tarefa-titulo");
        aplicarLimitador(inputTitulo, 20, "aviso-tarefa-modal");

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

    // 🔍 Verifica se a descrição mudou
    let alteracoesDetectadas = JSON.stringify(descricaoAntiga) !== JSON.stringify(novaDescricao);

    if (alteracoesDetectadas) {
        tarefaAlvo.descricao = { ...novaDescricao };

        let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
        let usuario = acesso.usuario || "Usuário desconhecido";

        let agora = new Date();
        let dataFormatada = agora.toISOString().split("T")[0];
        let horaFormatada = agora.toLocaleTimeString("pt-BR", { hour12: false });

        // 📌 Adiciona ao histórico
        tarefaAlvo.historico.push({
            tipo: "alteração",
            criador: usuario,
            mensagem: "Descrição da tarefa foi atualizada.",
            data: dataFormatada,
            hora: horaFormatada
        });

        // 🔥 Salva no LocalStorage corretamente
        dados.tarefas[idTarefa] = tarefaAlvo;
        localStorage.setItem("dados_kanban", JSON.stringify(dados));

        enviar(`dados_kanban/tarefas/${idTarefa}/descricao`, tarefaAlvo.descricao);

        // 🔥 Atualizar orçamento na nuvem apenas se foi alterado
        let inputOrcamento = document.getElementById("orcamento-selecionado")?.textContent.trim() || "";
        if (inputOrcamento !== "Nenhum" && inputOrcamento !== "" && inputOrcamento !== tarefaAlvo.orcamento) {
            tarefaAlvo.orcamento = inputOrcamento;
            enviar(`dados_kanban/tarefas/${idTarefa}/orcamento`, tarefaAlvo.orcamento);
        } else if (tarefaAlvo.orcamento && inputOrcamento === "Nenhum") {
            delete tarefaAlvo.orcamento;
            enviar(`dados_kanban/tarefas/${idTarefa}/orcamento`, null);
        }

        // Atualiza a interface do quadro e reabre o modal para refletir as alterações
        renderizarQuadro();
        abrirModal(idLista, idTarefa);
    }
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

    // 📌 Garante que a estrutura correta exista
    if (!dados.tarefas) dados.tarefas = {};
    if (!dados.etiquetasGlobais) dados.etiquetasGlobais = {};

    let tarefaAlvo = dados.tarefas[idTarefa];

    if (!tarefaAlvo) {
        return;
    }

    if (!Array.isArray(tarefaAlvo.etiquetas)) {
        tarefaAlvo.etiquetas = [];
    }

    if (!tarefaAlvo.etiquetas.includes(idEtiqueta)) {
        tarefaAlvo.etiquetas.push(idEtiqueta);
        salvarTarefas(dados.tarefas);

        // 🔥 Enviar APENAS a nova etiqueta para a nuvem no formato correto
        let etiquetaAdicionada = { id: idEtiqueta, ...dados.etiquetasGlobais[idEtiqueta] };
        enviar(`dados_kanban/tarefas/${idTarefa}/etiquetas/${idEtiqueta}`, etiquetaAdicionada);
    }

    // Atualizar o quadro e o modal
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

function removerEtiqueta(idLista, idTarefa, idEtiqueta) {

    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };
    let tarefaAlvo = dados.tarefas[idTarefa];

    if (!tarefaAlvo) {
        return;
    }

    if (!Array.isArray(tarefaAlvo.etiquetas)) {
        return;
    }

    let index = tarefaAlvo.etiquetas.indexOf(idEtiqueta);
    if (index !== -1) {
        tarefaAlvo.etiquetas.splice(index, 1); // Remove a etiqueta da lista de etiquetas da tarefa

        // 🔥 Salva as mudanças no localStorage
        localStorage.setItem("dados_kanban", JSON.stringify(dados));

        // 🔥 Atualiza na nuvem, removendo apenas essa etiqueta específica
        deletar(`dados_kanban/tarefas/${idTarefa}/etiquetas/${idEtiqueta}`);

        // Atualiza o quadro e reabre o modal para refletir a alteração
        renderizarQuadro();
        abrirModal(idLista, idTarefa);
    }
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
    if (opcoesExistentes) opcoesExistentes.remove(); // Remove opções antigas

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
                            <button class="botao-excluir-etiqueta" onclick="deletarEtiquetaGlobal('${idEtiqueta}'); event.stopPropagation();">❌</button>
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

function deletarEtiquetaGlobal(idEtiqueta) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, tarefas: {}, etiquetasGlobais: {} };

    if (!dados.etiquetasGlobais[idEtiqueta]) {
        return;
    }

    // 🔥 Remove do objeto local de etiquetas globais
    delete dados.etiquetasGlobais[idEtiqueta];

    // 🔥 Remove a etiqueta de todas as tarefas que a possuem
    Object.values(dados.tarefas).forEach(tarefa => {
        if (Array.isArray(tarefa.etiquetas)) {
            tarefa.etiquetas = tarefa.etiquetas.filter(etId => etId !== idEtiqueta);
        }
    });

    // 🔥 Salva as alterações no localStorage
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // 🔥 Remove a etiqueta globalmente na nuvem
    deletar(`dados_kanban/etiquetasGlobais/${idEtiqueta}`);

    // 🔥 Atualiza a interface do quadro e o modal de etiquetas
    renderizarQuadro(); 
    exibirOpcoesEtiquetas(); // 🛠 Atualiza a lista de etiquetas disponíveis no modal
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
    // 🔍 Verifica se já há dados salvos localmente
    let dadosLocais = localStorage.getItem("dados_kanban");

    if (dadosLocais) {
        carregarListas();
        renderizarQuadro();
        return; // 🚀 Interrompe a execução para evitar carregamento desnecessário da nuvem
    }
    let dadosRecebidos = await receber("dados_kanban");

    if (dadosRecebidos) {
        // 🚨 Corrige `etiquetasGlobais` caso seja um array antigo
        if (!dadosRecebidos.etiquetasGlobais || typeof dadosRecebidos.etiquetasGlobais !== "object") {
            dadosRecebidos.etiquetasGlobais = {};
        }

        localStorage.setItem("dados_kanban", JSON.stringify(dadosRecebidos));
        inicializarEtiquetasGlobais(); // 🔥 Inicializa etiquetas
        carregarListas();
        renderizarQuadro();
    }
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
