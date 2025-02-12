document.addEventListener("DOMContentLoaded", () => {
    inicializarEtiquetasGlobais();
    carregarListas();
});

document.getElementById("fundo-escuro").addEventListener("click", () => {
    const modaisAbertos = document.querySelectorAll(".modal:not(.oculto)");
    modaisAbertos.forEach(modal => {
        modal.classList.add("oculto"); // Fecha os modais abertos
    });

    const fundoEscuro = document.getElementById("fundo-escuro");
    if (fundoEscuro) fundoEscuro.classList.add("oculto"); // Esconde o fundo-escuro
});


let idListaAtual = null; // Variável para armazenar a lista onde será adicionada a tarefa

function adicionarTarefa(idLista) {
    idListaAtual = idLista; // Salva o ID da lista para referência posterior
    abrirModais('modal-adicionar-tarefa');
}

function confirmarAdicionarTarefa() {
    let textoTarefa = document.getElementById("input-nova-tarefa").value.trim();
    if (textoTarefa && idListaAtual) {
        let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };
        let listaAlvo = dados.listas[idListaAtual];

        if (listaAlvo) {
            let dataAtual = new Date().toISOString().split("T")[0]; // Data atual no formato YYYY-MM-DD
            let horaAtual = new Date().toLocaleTimeString("pt-BR"); // Hora atual
            let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
            let criador = acesso.usuario || "Desconhecido";

            let novaTarefa = {
                id: unicoID(),
                texto: textoTarefa,
                descricao: {
                    chamado: "",
                    endereco: "",
                    start: dataAtual, // Start definido como a data atual
                    entrega: "",
                    pedidoServico: "",
                    pedidoVenda: "",
                    escopo: "",
                    equipe: ""
                },
                etiquetas: [],
                atividades: [],
                historico: [] // Novo campo para armazenar histórico
            };

            // Adiciona o registro de criação ao histórico
            novaTarefa.historico.push({
                tipo: "criação",
                mensagem: `Tarefa criada por ${criador}`,
                data: dataAtual,
                hora: horaAtual
            });

            listaAlvo.tarefas.push(novaTarefa);

            // ✅ Agora estamos salvando o objeto `dados.listas` corretamente
            salvarListas(dados.listas);

            renderizarQuadro();
            fecharModais("modal-adicionar-tarefa");
        }
    } else {
        alert("O nome da tarefa não pode estar vazio.");
    }
}

function adicionarLista() {
    abrirModais('modal-adicionar-lista');
}

function salvarListas(novasListas) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };

    // Garante que as etiquetas globais não sejam alteradas
    dados.listas = novasListas;

    localStorage.setItem("dados_kanban", JSON.stringify(dados));
}

function salvarEtiquetasGlobais(novasEtiquetas) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };
    dados.etiquetasGlobais = novasEtiquetas; // Garante que estamos atualizando apenas as etiquetas

    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    console.log("✅ Etiquetas globais salvas:", novasEtiquetas);
}

function carregarListas() {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };

    // ✅ Garantimos que os valores sejam preservados sem sobrescrever incorretamente
    if (!dados.listas || typeof dados.listas !== "object") {
        dados.listas = {};
    }

    if (!Array.isArray(dados.etiquetasGlobais)) {
        dados.etiquetasGlobais = [];
    }

    renderizarQuadro();
}

function excluirTarefa(idLista, idTarefa) {
    let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};
    let listaAlvo = listas[idLista];

    if (listaAlvo) {
        listaAlvo.tarefas = listaAlvo.tarefas.filter(tarefa => tarefa.id !== idTarefa);
        salvarListas(listas);
        renderizarQuadro();
    }
}

function excluirLista(idLista) {
    console.log(`🗑 Excluindo lista: ${idLista}`);

    // Obtém os dados do localStorage
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };

    if (!dados.listas[idLista]) {
        console.warn(`⚠️ Lista com ID ${idLista} não encontrada.`);
        return;
    }

    // Remove a lista do objeto `listas`
    delete dados.listas[idLista];

    // Salva a nova estrutura no `localStorage`
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    // Atualiza o quadro para refletir a exclusão
    renderizarQuadro();

    console.log(`✅ Lista ${idLista} removida com sucesso!`);
}

function confirmarAdicionarLista() {
    let nomeLista = document.getElementById("input-nova-lista").value.trim();
    if (nomeLista) {
        let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };

        let idLista = unicoID();
        dados.listas[idLista] = {
            id: idLista,
            titulo: nomeLista,
            tarefas: []
        };

        // ✅ Agora está salvando corretamente o objeto inteiro
        localStorage.setItem("dados_kanban", JSON.stringify(dados));

        renderizarQuadro();
        fecharModais("modal-adicionar-lista");
    } else {
        alert("O nome da lista não pode estar vazio.");
    }
}

function renderizarQuadro() {
    let quadro = document.getElementById("quadro");
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };

    dados.listas ||= {};

    quadro.innerHTML = Object.values(dados.listas)
        .map(lista => `
            <div class="lista" id="${lista.id}">
                <div class="titulo-lista">
                    <h3 ondblclick="editarTituloLista('${lista.id}', this)">${lista.titulo}</h3>
                    <button class="botao-excluir" onclick="excluirLista('${lista.id}')">❌</button>
                </div>
                <div class="tarefas" ondrop="soltar(event)" ondragover="permitirSoltar(event)">
                    ${lista.tarefas.map(tarefa => `
                        <div class="tarefa" draggable="true" ondragstart="arrastar(event)" id="${tarefa.id}" onclick="abrirModal('${lista.id}', '${tarefa.id}')">
                            <div class="etiquetas-tarefa">
    ${tarefa.etiquetas?.map(etiqueta => `
        <span class="etiqueta-bolinha" style="background-color: ${etiqueta.cor};"></span>
    `).join("") || ""}
</div>

                            <p>${tarefa.texto}</p>
                            <button class="botao-excluir-tarefa" onclick="excluirTarefa('${lista.id}', '${tarefa.id}'); event.stopPropagation();">❌</button>
                        </div>
                    `).join("")}
                </div>
                <button onclick="adicionarTarefa('${lista.id}')">➕ Adicionar Tarefa</button>
            </div>
        `).join("");
}

function editarTituloLista(idLista, elementoH3) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {} };
    let listaAlvo = dados.listas[idLista];

    if (!listaAlvo) {
        console.error(`❌ Lista com ID ${idLista} não encontrada.`);
        return;
    }

    // Criar input de edição
    let input = document.createElement("input");
    input.type = "text";
    input.value = listaAlvo.titulo;
    input.className = "input-edicao";
    input.setAttribute("data-id", idLista);

    // Substituir o título pelo input
    elementoH3.replaceWith(input);
    input.focus();

    // Confirmar edição ao pressionar Enter ou sair do campo
    input.addEventListener("blur", () => salvarNovoTituloLista(input));
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") salvarNovoTituloLista(input);
    });
}

function salvarNovoTituloLista(input) {
    let idLista = input.getAttribute("data-id");
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {} };
    let listaAlvo = dados.listas[idLista];

    if (!listaAlvo) return;

    let novoTitulo = input.value.trim();
    if (novoTitulo) {
        listaAlvo.titulo = novoTitulo;
        salvarListas(dados.listas);
    }

    // Criar novo h3 e substituir o input
    let h3 = document.createElement("h3");
    h3.textContent = listaAlvo.titulo;
    h3.ondblclick = () => editarTituloLista(idLista, h3);
    input.replaceWith(h3);
}

function editarTituloTarefa(idLista, idTarefa) {
    let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};
    let listaAlvo = listas[idLista]; // Acessa a lista pelo ID diretamente do objeto
    let tarefaAlvo = listaAlvo?.tarefas.find(tarefa => tarefa.id === idTarefa);

    if (tarefaAlvo) {
        let novoTexto = prompt("Edite o texto da tarefa:", tarefaAlvo.texto);
        if (novoTexto !== null) {
            tarefaAlvo.texto = novoTexto.trim();
            salvarListas(listas);
            renderizarQuadro();
        }
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
        console.error("Erro: Lista de destino não encontrada.");
        return;
    }

    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };

    // Encontrar a lista de origem e a lista de destino
    let listaOrigem = Object.values(dados.listas).find(lista => lista.tarefas.some(tarefa => tarefa.id === idTarefa));
    let listaDestino = dados.listas[idListaDestino];

    if (!listaOrigem || !listaDestino) {
        console.error("Erro: Lista de origem ou destino não encontrada.");
        return;
    }

    // Encontrar e mover a tarefa
    let tarefaMovida = listaOrigem.tarefas.find(tarefa => tarefa.id === idTarefa);
    listaOrigem.tarefas = listaOrigem.tarefas.filter(tarefa => tarefa.id !== idTarefa);
    listaDestino.tarefas.push(tarefaMovida);

    // ✅ Agora estamos garantindo que o objeto completo `dados.listas` seja salvo corretamente
    salvarListas(dados.listas);

    // Atualiza o quadro após mover a tarefa
    renderizarQuadro();
}

async function abrirModal(idLista, idTarefa) {

    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };
    let listaAlvo = dados.listas[idLista];
    let tarefaAlvo = listaAlvo.tarefas.find(tarefa => tarefa.id === idTarefa);

    let dados_orcamentos = await recuperarDados("dados_orcamentos");

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
                    class="input-estilo" oninput="mostrarBotaoSalvar()">
                <button id="botao-salvar-titulo" onclick="salvarTituloTarefa('${idLista}', '${idTarefa}')" 
                    style="display: none;" class="botao-salvar">
                    Salvar
                </button>
            </div>
        </div>
        <div class="etiquetas">
            <h3>Etiquetas</h3>
            <div id="lista-etiquetas">
    ${tarefaAlvo.etiquetas
        .map(etiqueta => {
            let corTexto = definirCorTexto(etiqueta.cor);
            return `
                <span class="etiqueta" style="background-color: ${etiqueta.cor}; color: ${corTexto};">
                    ${etiqueta.nome}
                    <button class="botao-excluir botao-excluir-etiqueta" 
                        onclick="removerEtiqueta('${idLista}', '${idTarefa}', '${etiqueta.nome}')">❌</button>
                </span>`;
        }).join("")}
</div>

            <button onclick="exibirOpcoesEtiquetas('${idLista}', '${idTarefa}')">➕</button>
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
        renderizarAtividades(tarefaAlvo.atividades, tarefaAlvo.historico, idLista, idTarefa);

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
                    console.log(`🔗 Abrindo orçamento: ${tarefaAlvo.orcamento}`);
                    exibir_todos_os_status(tarefaAlvo.orcamento);
                    fecharModal();
                });
            }
        }, 100);


        // Exibe o modal
        modal.classList.remove("oculto");
        modal.style.display = "flex";
        fundoEscuro.classList.remove("oculto"); // Exibe o fundo escuro
    } else {
        console.error("Erro: Tarefa não encontrada ou estrutura inválida.");
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
    } else {
        console.error("Modal ou fundo-escuro não encontrados.");
    }
}

function abrirModais(modalId) {
    const modal = document.getElementById(modalId);
    const fundoEscuro = document.getElementById("fundo-escuro");

    if (modal && fundoEscuro) {
        modal.classList.remove("oculto"); // Mostra o modal
        fundoEscuro.classList.remove("oculto"); // Mostra o fundo-escuro
    } else {
        console.error(`Modal ou fundo-escuro não encontrados. Modal ID: ${modalId}`);
    }
}

function fecharModais(modalId) {
    const modal = document.getElementById(modalId);
    const fundoEscuro = document.getElementById("fundo-escuro");

    if (modal && fundoEscuro) {
        modal.classList.add("oculto"); // Esconde o modal
        fundoEscuro.classList.add("oculto"); // Esconde o fundo-escuro
    } else {
        console.error(`Modal ou fundo-escuro não encontrados. Modal ID: ${modalId}`);
    }
}

function adicionarComentario(idLista, idTarefa) {
    console.log(`📝 Adicionando comentário para Lista: ${idLista}, Tarefa: ${idTarefa}`);

    let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
    let criador = acesso.usuario || "Usuário desconhecido";

    let comentarioTexto = document.getElementById("novo-comentario").value.trim();

    if (!comentarioTexto) {
        alert("O comentário não pode estar vazio!");
        return;
    }

    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };
    let listaAlvo = dados.listas[idLista];

    if (!listaAlvo) {
        console.error("❌ Erro: Lista não encontrada!");
        return;
    }

    let tarefaAlvo = listaAlvo.tarefas.find(tarefa => tarefa.id === idTarefa);

    if (!tarefaAlvo) {
        console.error("❌ Erro: Tarefa não encontrada!");
        return;
    }

    if (!Array.isArray(tarefaAlvo.atividades)) {
        tarefaAlvo.atividades = []; // Garante que atividades é um array
    }

    let agora = new Date();
    let dataFormatada = agora.toISOString().split("T")[0];
    let horaFormatada = agora.toLocaleTimeString("pt-BR", { hour12: false });

    let novoComentario = {
        tipo: "comentario",
        comentario: comentarioTexto,
        criador: criador,
        data: dataFormatada,
        hora: horaFormatada
    };

    console.log("📌 Novo comentário:", novoComentario);

    // Adiciona o comentário
    tarefaAlvo.atividades.push(novoComentario);

    // Salva no `localStorage`
    salvarListas(dados.listas);

    // Atualiza a exibição do modal
    renderizarAtividades(tarefaAlvo.atividades, tarefaAlvo.historico, idLista, idTarefa);

    // Limpa o campo de comentário
    document.getElementById("novo-comentario").value = "";
}

function renderizarAtividades(atividades, historico, idLista, idTarefa) {
    console.log("🔄 Renderizando atividades...");

    const listaAtividades = document.getElementById("lista-atividades");

    if (!listaAtividades) {
        console.error("❌ Erro: Elemento `lista-atividades` não encontrado.");
        return;
    }

    // 🚀 Garante que atividades e histórico sejam arrays válidos
    atividades = Array.isArray(atividades) ? atividades : [];
    historico = Array.isArray(historico) ? historico : [];

    let todasAtividades = [...atividades, ...historico];

    // 🚨 Verifica se há atividades antes de tentar exibir
    if (todasAtividades.length === 0) {
        listaAtividades.innerHTML = "<p style='color: gray;'>Nenhuma atividade registrada.</p>";
        console.warn("⚠️ Nenhuma atividade encontrada.");
        return;
    }

    // Ordena por data e hora
    todasAtividades.sort((a, b) => {
        let dataA = new Date(`${a.data} ${a.hora}`).getTime() || 0;
        let dataB = new Date(`${b.data} ${b.hora}`).getTime() || 0;
        return dataB - dataA;
    });

    console.log("📌 Atividades a serem exibidas:", todasAtividades);

    // Obtém o usuário logado
    let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
    let usuarioLogado = acesso.usuario || "Usuário desconhecido";

    listaAtividades.innerHTML = todasAtividades
        .map(atividade => {
            let icone = "💬";
            let mensagem = "";
            let botaoExcluir = "";

            if (atividade.tipo === "comentario") {
                icone = "💬";
                mensagem = `${atividade.criador}: ${atividade.comentario || "⚠️ Sem descrição"}`;

                // Se o usuário for o criador do comentário, exibe o botão de exclusão
                if (atividade.criador === usuarioLogado) {
                    botaoExcluir = `<button class="botao-excluir-comentario" onclick="excluirComentario('${idLista}', '${idTarefa}', '${atividade.data}', '${atividade.hora}')">❌</button>`;
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
                        <span class="comentario-data">${atividade.data || "???"} ${atividade.hora || "???"}</span>
                        ${botaoExcluir}
                    </div>
                    <textarea class="comentario-textarea" readonly>${mensagem}</textarea>
                </div>
            `;
        })
        .join("");

    console.log("✅ Atividades renderizadas!");
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
    console.log(`📌 Salvando descrição para Lista: ${idLista}, Tarefa: ${idTarefa}`);

    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };
    let listaAlvo = dados.listas[idLista];

    if (!listaAlvo) {
        console.error("❌ Erro: Lista não encontrada!");
        return;
    }

    let tarefaAlvo = listaAlvo.tarefas.find(tarefa => tarefa.id === idTarefa);

    if (!tarefaAlvo) {
        console.error("❌ Erro: Tarefa não encontrada!");
        return;
    }

    console.log("✅ Tarefa antes da atualização:", tarefaAlvo);

    let novaDescricao = {
        chamado: document.getElementById("input-chamado").value.trim(),
        endereco: document.getElementById("input-endereco").value.trim(),
        start: document.getElementById("input-start").value.trim(),
        entrega: document.getElementById("input-entrega").value.trim(),
        pedidoServico: document.getElementById("input-pedido-servico").value.trim(),
        pedidoVenda: document.getElementById("input-pedido-venda").value.trim(),
        escopo: document.getElementById("input-escopo").value.trim(),
        equipe: document.getElementById("input-equipe").value.trim(),
    };

    // 📌 Adicionando o orçamento corretamente
    let inputOrcamento = document.getElementById("orcamento-selecionado").textContent.trim();
    if (inputOrcamento !== "Nenhum") {
        tarefaAlvo.orcamento = inputOrcamento;
    } else {
        delete tarefaAlvo.orcamento; // Remove o campo se não houver orçamento selecionado
    }

    // 📌 Adiciona histórico de alteração
    let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
    let usuario = acesso.usuario || "Desconhecido";

    let agora = new Date();
    let dataFormatada = agora.toISOString().split("T")[0];
    let horaFormatada = agora.toLocaleTimeString("pt-BR", { hour12: false });

    const nomesCampos = {
        chamado: "N° Chamado",
        endereco: "Endereço da Loja",
        start: "Start",
        entrega: "Entrega",
        pedidoServico: "Pedido de Serviço",
        pedidoVenda: "Pedido de Venda",
        escopo: "Escopo",
        equipe: "Equipe"
    };

    let alteracoes = [];
    for (let campo in novaDescricao) {
        if (tarefaAlvo.descricao[campo] !== novaDescricao[campo]) {
            alteracoes.push(nomesCampos[campo]);
        }
    }

    if (alteracoes.length > 0) {
        tarefaAlvo.historico.push({
            tipo: "alteração",
            criador: usuario,
            campos: alteracoes,
            data: dataFormatada,
            hora: horaFormatada
        });
    }

    // Atualiza a descrição da tarefa
    tarefaAlvo.descricao = novaDescricao;

    console.log("✅ Tarefa após atualização:", tarefaAlvo);

    // ✅ Agora salva corretamente no LocalStorage
    salvarListas(dados.listas);

    // Reabre o modal para refletir as alterações
    abrirModal(idLista, idTarefa);
}

function salvarTituloTarefa(idLista, idTarefa) {
    console.log(`📝 Salvando título para Lista: ${idLista}, Tarefa: ${idTarefa}`);

    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };
    let listaAlvo = dados.listas[idLista];

    if (!listaAlvo) {
        console.error("❌ Erro: Lista não encontrada!");
        return;
    }

    let tarefaAlvo = listaAlvo.tarefas.find(tarefa => tarefa.id === idTarefa);

    if (!tarefaAlvo) {
        console.error("❌ Erro: Tarefa não encontrada!");
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

    // 📌 Garante que o histórico existe e é um array
    if (!Array.isArray(tarefaAlvo.historico)) {
        tarefaAlvo.historico = [];
    }

    // 📌 Adiciona ao histórico de alterações, garantindo que o campo `campos` esteja preenchido corretamente
    let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
    let usuario = acesso.usuario || "Usuário desconhecido";

    let agora = new Date();
    let dataFormatada = agora.toISOString().split("T")[0];
    let horaFormatada = agora.toLocaleTimeString("pt-BR", { hour12: false });

    tarefaAlvo.historico.push({
        tipo: "alteração",
        criador: usuario,
        campos: ["Título da Tarefa"], // ✅ Corrigido para garantir que o campo alterado seja identificado corretamente
        mensagem: `Título alterado de "${tituloAnterior}" para "${novoTitulo}"`,
        data: dataFormatada,
        hora: horaFormatada
    });

    // ✅ Agora salva corretamente no LocalStorage
    salvarListas(dados.listas);

    console.log("✅ Novo título salvo com sucesso!");

    // Atualiza a interface do quadro e reabre o modal para refletir as alterações
    renderizarQuadro();
    abrirModal(idLista, idTarefa);
}

function adicionarEtiquetaTarefa(idLista, idTarefa, nomeEtiqueta) {
    console.log(`🏷️ Tentando adicionar etiqueta '${nomeEtiqueta}' à tarefa ${idTarefa} na lista ${idLista}`);

    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };
    let listaAlvo = dados.listas[idLista];
    let tarefaAlvo = listaAlvo?.tarefas.find(tarefa => tarefa.id === idTarefa);

    if (!listaAlvo || !tarefaAlvo) {
        console.error("❌ Lista ou tarefa não encontrada.");
        return;
    }

    // Garante que as etiquetas existam
    if (!Array.isArray(tarefaAlvo.etiquetas)) {
        tarefaAlvo.etiquetas = [];
    }

    // Busca a etiqueta global correspondente
    let etiqueta = dados.etiquetasGlobais.find(et => et.nome === nomeEtiqueta);

    if (!etiqueta) {
        console.warn(`⚠️ Etiqueta '${nomeEtiqueta}' não encontrada nas etiquetas globais.`);
        return;
    }

    // Evita duplicação da mesma etiqueta
    if (!tarefaAlvo.etiquetas.some(et => et.nome === nomeEtiqueta)) {
        tarefaAlvo.etiquetas.push({ nome: etiqueta.nome, cor: etiqueta.cor });

        // ✅ Agora salva corretamente no LocalStorage
        salvarListas(dados.listas);

        console.log(`✅ Etiqueta '${nomeEtiqueta}' adicionada à tarefa.`);
    } else {
        console.warn(`⚠️ A etiqueta '${nomeEtiqueta}' já está adicionada.`);
    }

    // Atualiza a interface
    renderizarQuadro();
    abrirModal(idLista, idTarefa);
}

function adicionarEtiquetaGlobal(idLista, idTarefa) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };

    let nome = document.getElementById("nova-etiqueta-nome-global").value.trim();
    let cor = document.getElementById("nova-etiqueta-cor-global").value;

    if (!nome) {
        alert("O nome da etiqueta não pode estar vazio.");
        return;
    }

    // Verifica se a etiqueta já existe
    let etiquetaExiste = dados.etiquetasGlobais.some(et => et.nome === nome);

    if (!etiquetaExiste) {
        dados.etiquetasGlobais.push({ nome, cor });

        // Salva as etiquetas globais no localStorage
        salvarEtiquetasGlobais(dados.etiquetasGlobais);

        console.log(`✅ Etiqueta global '${nome}' adicionada.`);
    } else {
        console.warn(`⚠️ A etiqueta '${nome}' já existe.`);
    }

    // Adiciona a etiqueta à tarefa
    adicionarEtiquetaTarefa(idLista, idTarefa, nome);
}

function removerEtiqueta(idLista, idTarefa, nomeEtiqueta) {
    console.log(`🗑️ Removendo etiqueta '${nomeEtiqueta}' da tarefa '${idTarefa}' na lista '${idLista}'`);

    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };
    let listaAlvo = dados.listas[idLista];

    if (!listaAlvo) {
        console.error(`❌ Lista '${idLista}' não encontrada.`);
        return;
    }

    let tarefaAlvo = listaAlvo.tarefas.find(tarefa => tarefa.id === idTarefa);

    if (!tarefaAlvo) {
        console.error(`❌ Tarefa '${idTarefa}' não encontrada.`);
        return;
    }

    // 🔥 Removendo a etiqueta pelo nome
    let etiquetasAntes = tarefaAlvo.etiquetas.length;
    tarefaAlvo.etiquetas = tarefaAlvo.etiquetas.filter(etiqueta => etiqueta.nome !== nomeEtiqueta);
    let etiquetasDepois = tarefaAlvo.etiquetas.length;

    if (etiquetasAntes === etiquetasDepois) {
        console.warn(`⚠️ A etiqueta '${nomeEtiqueta}' não estava presente na tarefa.`);
        return;
    }

    // 🔥 Salvando a lista atualizada no localStorage
    salvarListas(dados.listas);

    // 🔥 Re-renderizando o quadro e mantendo o modal aberto
    renderizarQuadro();
    abrirModal(idLista, idTarefa);

    console.log(`✅ Etiqueta '${nomeEtiqueta}' removida com sucesso!`);
}

function inicializarEtiquetasGlobais() {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };

    // 🔥 Removemos a criação automática de etiquetas padrão
    if (!Array.isArray(dados.etiquetasGlobais)) {
        dados.etiquetasGlobais = [];
        salvarEtiquetasGlobais(dados.etiquetasGlobais);
    }
}

function exibirOpcoesEtiquetas(idLista, idTarefa) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };
    let etiquetasGlobais = dados.etiquetasGlobais || [];

    let modalCorpo = document.getElementById("modal-corpo");
    let opcoesExistentes = document.getElementById("opcoes-etiquetas");
    if (opcoesExistentes) opcoesExistentes.remove(); // Remove opções antigas

    let opcoesHTML = `
        <div id="opcoes-etiquetas">
            <h3>Escolha uma Etiqueta</h3>
            <div id="lista-etiquetas-globais">
                ${etiquetasGlobais.length > 0
            ? etiquetasGlobais.map(etiqueta => `
                        <div class="etiqueta-opcao" onclick="adicionarEtiquetaTarefa('${idLista}', '${idTarefa}', '${etiqueta.nome}')">
                            <span class="etiqueta-bolinha" style="background-color: ${etiqueta.cor};"></span>
                            <span class="etiqueta-nome">${etiqueta.nome}</span>
                            <button class="botao-excluir-etiqueta" onclick="removerEtiquetaGlobal('${etiqueta.nome}'); event.stopPropagation();">❌</button>
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

function removerEtiquetaGlobal(nomeEtiqueta) {
    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };

    // Filtra e mantém apenas as etiquetas diferentes da que foi removida
    dados.etiquetasGlobais = dados.etiquetasGlobais.filter(etiqueta => etiqueta.nome !== nomeEtiqueta);

    // Remove a etiqueta de todas as tarefas
    Object.values(dados.listas).forEach(lista => {
        lista.tarefas.forEach(tarefa => {
            if (tarefa.etiquetas) {
                tarefa.etiquetas = tarefa.etiquetas.filter(etiqueta => etiqueta.nome !== nomeEtiqueta);
            }
        });
    });

    // Atualiza o localStorage
    localStorage.setItem("dados_kanban", JSON.stringify(dados));

    console.log(`✅ Etiqueta '${nomeEtiqueta}' removida globalmente de todas as tarefas!`);

    // Atualiza a interface para refletir a remoção
    renderizarQuadro();
    exibirOpcoesEtiquetas();
}

function excluirComentario(idLista, idTarefa, data, hora) {
    console.log(`🗑 Excluindo comentário da Lista: ${idLista}, Tarefa: ${idTarefa}, Data: ${data}, Hora: ${hora}`);

    let dados = JSON.parse(localStorage.getItem("dados_kanban")) || { listas: {}, etiquetasGlobais: [] };
    let listaAlvo = dados.listas[idLista];

    if (!listaAlvo) {
        console.error(`❌ Erro: Lista com ID ${idLista} não encontrada.`);
        return;
    }

    let tarefaAlvo = listaAlvo.tarefas.find(tarefa => tarefa.id === idTarefa);
    if (!tarefaAlvo) {
        console.error(`❌ Erro: Tarefa com ID ${idTarefa} não encontrada.`);
        return;
    }

    if (!Array.isArray(tarefaAlvo.atividades)) {
        console.warn("⚠️ Nenhuma atividade encontrada nesta tarefa.");
        return;
    }

    // Obtém o usuário logado
    let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
    let usuarioLogado = acesso.usuario || "Usuário desconhecido";

    // Encontra o índice do comentário a ser excluído
    let indexComentario = tarefaAlvo.atividades.findIndex(atividade =>
        atividade.tipo === "comentario" &&
        atividade.data === data &&
        atividade.hora === hora &&
        atividade.criador === usuarioLogado
    );

    if (indexComentario === -1) {
        alert("❌ Você só pode excluir os comentários que você criou!");
        return;
    }

    // Remove o comentário da lista
    console.log("🗑 Removendo comentário:", tarefaAlvo.atividades[indexComentario]);
    tarefaAlvo.atividades.splice(indexComentario, 1);

    // Salva a atualização no localStorage
    salvarListas(dados.listas);

    // Atualiza a exibição no modal
    renderizarAtividades(tarefaAlvo.atividades, tarefaAlvo.historico, idLista, idTarefa);

    console.log("✅ Comentário excluído com sucesso!");
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
