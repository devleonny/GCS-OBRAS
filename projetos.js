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
        let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};
        let listaAlvo = listas[idListaAtual];

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

            salvarListas(listas);
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

function salvarListas(listas) {
    localStorage.setItem("dados_kanban", JSON.stringify(listas));
}

function carregarListas() {
    let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};

    // Garante que todas as listas tenham uma estrutura válida
    Object.values(listas).forEach(lista => {
        if (!Array.isArray(lista.tarefas)) {
            lista.tarefas = [];
        }
        lista.tarefas.forEach(tarefa => {
            tarefa.descricao ||= {
                chamado: "", endereco: "", start: "", entrega: "",
                pedidoServico: "", pedidoVenda: "", escopo: "", equipe: ""
            };
            tarefa.atividades ||= [];
            tarefa.etiquetas ||= [];
            tarefa.historico ||= []; // Garante que o histórico exista
        });
    });

    salvarListas(listas);
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
    let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};
    delete listas[idLista]; // Remove a lista do objeto

    salvarListas(listas);
    renderizarQuadro();
}

function confirmarAdicionarLista() {
    let nomeLista = document.getElementById("input-nova-lista").value.trim();
    if (nomeLista) {
        let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};
        let idLista = unicoID(); // Gerando ID único para a lista

        listas[idLista] = {
            id: idLista,
            titulo: nomeLista,
            tarefas: []
        };

        salvarListas(listas);
        renderizarQuadro();
        fecharModais("modal-adicionar-lista");
    } else {
        alert("O nome da lista não pode estar vazio.");
    }
}

function renderizarQuadro() {
    let quadro = document.getElementById("quadro");
    let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};

    quadro.innerHTML = Object.values(listas)
        .map(lista => `
            <div class="lista" id="${lista.id}">
                <div class="titulo-lista">
                    <h3 ondblclick="editarTituloLista('${lista.id}')">${lista.titulo}</h3>
                    <button class="botao-excluir" onclick="excluirLista('${lista.id}')">❌</button>
                </div>
                <div class="tarefas" ondrop="soltar(event)" ondragover="permitirSoltar(event)">
                    ${lista.tarefas.map(tarefa => `
                        <div class="tarefa" draggable="true" ondragstart="arrastar(event)" id="${tarefa.id}" onclick="abrirModal('${lista.id}', '${tarefa.id}')">
                            <div class="indicadores-etiquetas">
                                ${tarefa.etiquetas.map(etiqueta => `
                                    <span class="indicador-etiqueta" style="background-color: ${etiqueta.cor}" title="${etiqueta.nome}"></span>
                                `).join("")}
                            </div>
                            ${tarefa.texto}
                            <button class="botao-excluir-tarefa" onclick="excluirTarefa('${lista.id}', '${tarefa.id}')">❌</button>
                        </div>
                    `).join("")}
                </div>
                <button onclick="adicionarTarefa('${lista.id}')">➕ Adicionar Tarefa</button>
            </div>
        `).join("");
}

function editarTituloLista(idLista) {
    let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};
    let listaAlvo = listas[idLista];

    if (listaAlvo) {
        let novoTitulo = prompt("Edite o título da lista:", listaAlvo.titulo);
        if (novoTitulo !== null) {
            listaAlvo.titulo = novoTitulo.trim();
            salvarListas(listas);
            renderizarQuadro();
        }
    }
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

    let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};
    
    // Encontrar a lista de origem e a lista de destino
    let listaOrigem = Object.values(listas).find(lista => lista.tarefas.some(tarefa => tarefa.id === idTarefa));
    let listaDestino = listas[idListaDestino];

    if (!listaOrigem || !listaDestino) {
        console.error("Erro: Lista de origem ou destino não encontrada.");
        return;
    }

    // Encontrar e mover a tarefa
    let tarefaMovida = listaOrigem.tarefas.find(tarefa => tarefa.id === idTarefa);
    listaOrigem.tarefas = listaOrigem.tarefas.filter(tarefa => tarefa.id !== idTarefa);
    listaDestino.tarefas.push(tarefaMovida);

    salvarListas(listas);
    renderizarQuadro();
}

async function abrirModal(idLista, idTarefa) {
    
    let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};
    let listaAlvo = listas[idLista]; // Pegando a lista pelo ID diretamente do objeto
    let tarefaAlvo = listaAlvo?.tarefas.find(tarefa => tarefa.id === idTarefa);

    let dados_orcamentos = await recuperarDados("dados_orcamentos");

    if (tarefaAlvo) {
        // Garante que as etiquetas existam
        if (!tarefaAlvo.etiquetas) {
            tarefaAlvo.etiquetas = [];
        }

        let etiquetasGlobais = JSON.parse(localStorage.getItem("etiquetasGlobais")) || [];
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
                .map(
                    etiqueta => `
                        <span class="etiqueta" style="background-color: ${etiqueta.cor}">
                            ${etiqueta.nome}
                            <button class="remover-etiqueta" onclick="removerEtiqueta('${idLista}', '${idTarefa}', '${etiqueta.nome}')">❌</button>
                        </span>`
                )
                .join("")}
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
                        salvarListas(listas);
                
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
            if (orcamentoLink) {
                orcamentoLink.addEventListener("click", (event) => {
                    event.preventDefault();
                    exibir_todos_os_status(tarefaAlvo.orcamento);
                    fecharModal()
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
    const acesso = JSON.parse(localStorage.getItem("acesso")) || {};
    const criador = acesso.usuario || "Usuário desconhecido"; // Se não encontrar, usa um padrão

    const comentarioTexto = document.getElementById("novo-comentario").value.trim();

    if (!comentarioTexto) {
        alert("O comentário não pode estar vazio!");
        return;
    }

    let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};
    let listaAlvo = listas[idLista]; 
    let tarefaAlvo = listaAlvo?.tarefas.find(tarefa => tarefa.id === idTarefa);

    if (!listaAlvo || !tarefaAlvo) {
        console.error("Erro: Lista ou tarefa não encontrada.");
        return;
    }

    if (!tarefaAlvo.atividades) {
        tarefaAlvo.atividades = []; 
    }

    const agora = new Date();
    const data = agora.toISOString().split("T")[0]; 
    const hora = agora.toLocaleTimeString("pt-BR", { hour12: false }); 

    // Adiciona o comentário com o criador e tipo
    tarefaAlvo.atividades.push({
        tipo: "comentario",
        comentario: comentarioTexto,
        criador: criador, 
        data: data,
        hora: hora
    });

    // Salva no localStorage
    salvarListas(listas);

    // Atualiza a exibição no modal
    renderizarAtividades(tarefaAlvo.atividades, tarefaAlvo.historico, idLista, idTarefa);

    // Limpa o campo de comentário
    document.getElementById("novo-comentario").value = "";
}

function renderizarAtividades(atividades, historico, idLista, idTarefa) {
    const listaAtividades = document.getElementById("lista-atividades");

    if (!listaAtividades) {
        console.error("Erro: Elemento lista-atividades não encontrado.");
        return;
    }

    // Garante que atividades e histórico sejam arrays válidos
    atividades = Array.isArray(atividades) ? atividades : [];
    historico = Array.isArray(historico) ? historico : [];

    // Junta atividades e histórico
    let todasAtividades = [...atividades, ...historico];

    // Ordena por data e hora
    todasAtividades.sort((a, b) => {
        let dataA = new Date(`${a.data} ${a.hora}`).getTime() || 0;
        let dataB = new Date(`${b.data} ${b.hora}`).getTime() || 0;
        return dataB - dataA;
    });

    console.log("📌 Atividades para renderizar:", todasAtividades);

    // Obtém o usuário logado
    let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
    let usuarioLogado = acesso.usuario || "Usuário desconhecido";

    listaAtividades.innerHTML = todasAtividades
        .map((atividade, index) => {
            let tipo = atividade?.tipo || "comentario";
            let criador = atividade?.criador || "Usuário desconhecido"; 
            let dataHora = atividade?.data && atividade?.hora 
                ? formatarData(atividade.data) + " " + atividade.hora 
                : "⚠️ Data/Hora desconhecida";
            let icone = "📝"; 
            let mensagem = "";
            let botaoExcluir = ""; // Inicialmente, o botão de excluir não aparece

            if (tipo === "comentario") {
                icone = "💬";
                mensagem = `${criador}: ${atividade.comentario || "⚠️ Sem descrição"}`;

                // 🔥 Exibe o botão **somente** se o criador for o usuário logado
                if (criador === usuarioLogado) {
                    botaoExcluir = `<button class="botao-excluir-comentario" onclick="excluirComentario('${idLista}', '${idTarefa}', ${index})">❌</button>`;
                }
            } else if (tipo === "alteração") {
                icone = "✏️";
                let camposAlterados = atividade.campos || [];
                let camposFormatados = camposAlterados.length > 0 
                    ? camposAlterados.map(campo => `${campo}`).join(", ") 
                    : "⚠️ Alteração desconhecida";
                mensagem = `${criador} fez alterações em: ${camposFormatados}`;
            } else if (tipo === "criação") {
                icone = "📌";
                mensagem = `${atividade.mensagem}`;
            }

            return `
                <div class="comentario-container">
                    <div class="comentario-info">
                        <span class="comentario-data">${dataHora}</span>
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
    let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};
    let listaAlvo = listas[idLista];
    let tarefaAlvo = listaAlvo?.tarefas.find(tarefa => tarefa.id === idTarefa);

    if (tarefaAlvo) {
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

        let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
        let usuario = acesso.usuario || "Desconhecido";

        // 📌 Captura corretamente a data e hora separadas
        let agora = new Date();
        let dataFormatada = agora.toISOString().split("T")[0]; // Formato YYYY-MM-DD
        let horaFormatada = agora.toLocaleTimeString("pt-BR", { hour12: false }); // Formato HH:MM:SS

        // 🔍 Mapeamento dos campos para exibição correta
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

        // 🔍 Verifica quais campos foram alterados
        let alteracoes = [];
        for (let campo in novaDescricao) {
            if (tarefaAlvo.descricao[campo] !== novaDescricao[campo]) {
                alteracoes.push(nomesCampos[campo]); // Usa o nome correto da label
            }
        }

        // ✅ Se houver alterações, adiciona ao histórico
        if (alteracoes.length > 0) {
            tarefaAlvo.historico.push({
                tipo: "alteração",
                criador: usuario,
                campos: alteracoes,
                data: dataFormatada,  // 📅 Armazena corretamente a data
                hora: horaFormatada   // ⏰ Armazena corretamente a hora
            });
        }

        // Atualiza a descrição
        tarefaAlvo.descricao = novaDescricao;

        salvarListas(listas);
        abrirModal(idLista, idTarefa); // Reabre o modal para refletir a atualização
    } else {
        console.error("Erro: Tarefa não encontrada ou estrutura inválida.");
    }
}

function salvarTituloTarefa(idLista, idTarefa) {
    let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};
    let listaAlvo = listas[idLista]; // Acessa a lista pelo ID diretamente do objeto
    let tarefaAlvo = listaAlvo?.tarefas.find(tarefa => tarefa.id === idTarefa);

    if (tarefaAlvo) {
        let novoTitulo = document.getElementById("tarefa-titulo").value.trim();
        if (novoTitulo) {
            tarefaAlvo.texto = novoTitulo; // Atualiza o título
            salvarListas(listas);
            abrirModal(idLista, idTarefa); // Reabre o modal com o título atualizado
            renderizarQuadro(); // Atualiza o quadro para refletir o novo título
        } else {
            alert("O título da tarefa não pode estar vazio.");
        }
    }
}

function adicionarEtiquetaTarefa(idLista, idTarefa, nomeEtiqueta) {
    let etiquetasGlobais = JSON.parse(localStorage.getItem("etiquetasGlobais")) || [];
    let etiqueta = etiquetasGlobais.find(et => et.nome === nomeEtiqueta);

    if (etiqueta) {
        let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};
    let listaAlvo = listas[idLista]; // Acessa a lista pelo ID diretamente do objeto
    let tarefaAlvo = listaAlvo?.tarefas.find(tarefa => tarefa.id === idTarefa);


        if (tarefaAlvo) {
            tarefaAlvo.etiquetas.push(etiqueta);
            salvarListas(listas);
            abrirModal(idLista, idTarefa);
        }
    }
}


function adicionarEtiquetaGlobal(idLista, idTarefa) {
    let nome = document.getElementById("nova-etiqueta-nome-global").value.trim();
    let cor = document.getElementById("nova-etiqueta-cor-global").value;

    if (nome) {
        let etiquetasGlobais = JSON.parse(localStorage.getItem("etiquetasGlobais")) || [];
        etiquetasGlobais.push({ nome, cor });
        localStorage.setItem("etiquetasGlobais", JSON.stringify(etiquetasGlobais));

        adicionarEtiquetaTarefa(idLista, idTarefa, nome); // Associa à tarefa automaticamente
    } else {
        alert("O nome da etiqueta não pode estar vazio.");
    }
}


function removerEtiqueta(idLista, idTarefa, nomeEtiqueta) {
    let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};
    let listaAlvo = listas[idLista]; // Acessa a lista pelo ID diretamente do objeto
    let tarefaAlvo = listaAlvo?.tarefas.find(tarefa => tarefa.id === idTarefa);


    if (tarefaAlvo) {
        tarefaAlvo.etiquetas = tarefaAlvo.etiquetas.filter(etiqueta => etiqueta.nome !== nomeEtiqueta);
        salvarListas(listas);
        abrirModal(idLista, idTarefa); // Reabre o modal para atualizar a exibição
    }
}

function inicializarEtiquetasGlobais() {
    let etiquetasGlobais = JSON.parse(localStorage.getItem("etiquetasGlobais")) || [];
    if (etiquetasGlobais.length === 0) {
        // Adicione algumas etiquetas padrão, se necessário
        etiquetasGlobais = [
            { nome: "Prioridade Alta", cor: "#ff0000" },
            { nome: "Em Andamento", cor: "#00ff00" },
            { nome: "Concluído", cor: "#0000ff" }
        ];
        localStorage.setItem("etiquetasGlobais", JSON.stringify(etiquetasGlobais));
    }
}

function exibirOpcoesEtiquetas(idLista, idTarefa) {
    let etiquetasGlobais = JSON.parse(localStorage.getItem("etiquetasGlobais")) || [];

    // Verifica se as opções já estão no modal
    let opcoesExistentes = document.getElementById("opcoes-etiquetas");
    if (opcoesExistentes) return; // Evita duplicações

    let modalCorpo = document.getElementById("modal-corpo");
    let opcoesHTML = `
        <div id="opcoes-etiquetas">
            <h3>Escolha uma Etiqueta</h3>
            <div id="lista-etiquetas-globais">
                ${etiquetasGlobais
            .map(
                etiqueta => `
                    <span class="etiqueta" style="background-color: ${etiqueta.cor}" onclick="adicionarEtiquetaTarefa('${idLista}', '${idTarefa}', '${etiqueta.nome}')">
                        ${etiqueta.nome}
                    </span>
                `
            )
            .join("")}
            </div>
            <h3>Nova Etiqueta</h3>
            <div>
                <input type="text" id="nova-etiqueta-nome-global" placeholder="Nome da Etiqueta" />
                <input type="color" id="nova-etiqueta-cor-global" value="#ff0000" />
                <button onclick="adicionarEtiquetaGlobal('${idLista}', '${idTarefa}')">Adicionar</button>
            </div>
        </div>
    `;

    modalCorpo.insertAdjacentHTML("beforeend", opcoesHTML); // Adiciona sem sobrescrever o conteúdo existente
}

function excluirComentario(idLista, idTarefa, index) {
    let listas = JSON.parse(localStorage.getItem("dados_kanban")) || {};
    let listaAlvo = listas[idLista];

    if (!listaAlvo) {
        console.error(`Erro: Lista com ID ${idLista} não encontrada.`);
        return;
    }

    let tarefaAlvo = listaAlvo.tarefas.find(tarefa => tarefa.id === idTarefa);
    if (!tarefaAlvo) {
        console.error(`Erro: Tarefa com ID ${idTarefa} não encontrada.`);
        return;
    }

    // Verifica se a atividade a ser excluída é um comentário
    if (tarefaAlvo.atividades[index]?.tipo !== "comentario") {
        alert("❌ Apenas comentários podem ser excluídos!");
        return;
    }

    // Verifica se o usuário é o criador do comentário
    let acesso = JSON.parse(localStorage.getItem("acesso")) || {};
    let usuarioLogado = acesso.usuario || "Usuário desconhecido";
    let criadorComentario = tarefaAlvo.atividades[index]?.criador;

    if (usuarioLogado !== criadorComentario) {
        alert("❌ Você só pode excluir seus próprios comentários!");
        return;
    }

    // Remove o comentário
    tarefaAlvo.atividades.splice(index, 1);

    // Salva a atualização no localStorage
    salvarListas(listas);

    // Atualiza a exibição do modal
    renderizarAtividades(tarefaAlvo.atividades, tarefaAlvo.historico, idLista, idTarefa);
}
