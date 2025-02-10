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
    let textoTarefa = document.getElementById('input-nova-tarefa').value.trim();
    if (textoTarefa && idListaAtual) {
        let listas = JSON.parse(localStorage.getItem('listas')) || [];
        let listaAlvo = listas.find(lista => lista.id === idListaAtual);

        if (listaAlvo) {
            listaAlvo.tarefas.push({
                id: 'tarefa' + new Date().getTime(),
                texto: textoTarefa,
                descricao: {
                    chamado: '',
                    endereco: '',
                    start: '',
                    entrega: '',
                    pedidoServico: '',
                    pedidoVenda: '',
                    escopo: '',
                    equipe: ''
                },
                etiquetas: [], // Inicializa as etiquetas
                atividades: [] // Inicializa as atividades
            });
            salvarListas(listas);
            renderizarQuadro();
            fecharModais('modal-adicionar-tarefa');
        }
    } else {
        alert('O nome da tarefa não pode estar vazio.');
    }
}

function adicionarLista() {
    abrirModais('modal-adicionar-lista');
}

function salvarListas(listas) {
    console.log("Listas atualizadas no localStorage:", listas);
    localStorage.setItem("listas", JSON.stringify(listas));
}

function carregarListas() {
    let listas = JSON.parse(localStorage.getItem("listas")) || [];

    // Garante que todas as tarefas tenham uma estrutura válida
    listas.forEach(lista => {
        lista.tarefas.forEach(tarefa => {
            if (!tarefa.descricao) {
                tarefa.descricao = {
                    chamado: "",
                    endereco: "",
                    start: "",
                    entrega: "",
                    pedidoServico: "",
                    pedidoVenda: "",
                    escopo: "",
                    equipe: ""
                };
            }
            if (!tarefa.atividades) {
                tarefa.atividades = []; // Inicializa atividades se não existir
            }
            if (!tarefa.etiquetas) {
                tarefa.etiquetas = []; // Inicializa etiquetas se não existir
            }
        });
    });

    salvarListas(listas); // Salva as atualizações no localStorage
    renderizarQuadro();
}


function excluirTarefa(idLista, idTarefa) {
    let listas = JSON.parse(localStorage.getItem("listas")) || [];
    let listaAlvo = listas.find(lista => lista.id === idLista);

    if (listaAlvo) {
        listaAlvo.tarefas = listaAlvo.tarefas.filter(tarefa => tarefa.id !== idTarefa);
        salvarListas(listas);
        renderizarQuadro();
    }
}

function excluirLista(idLista) {
    let listas = JSON.parse(localStorage.getItem("listas")) || [];
    listas = listas.filter(lista => lista.id !== idLista);
    salvarListas(listas);
    renderizarQuadro();
}

function confirmarAdicionarLista() {
    let nomeLista = document.getElementById('input-nova-lista').value.trim();
    if (nomeLista) {
        let listas = JSON.parse(localStorage.getItem('listas')) || [];
        listas.push({
            id: 'lista' + new Date().getTime(),
            titulo: nomeLista,
            tarefas: []
        });
        salvarListas(listas);
        renderizarQuadro();
        fecharModais('modal-adicionar-lista');
    } else {
        alert('O nome da lista não pode estar vazio.');
    }
}

function renderizarQuadro() {
    let quadro = document.getElementById("quadro");
    let listas = JSON.parse(localStorage.getItem("listas")) || [];

    // Constrói o HTML do quadro
    quadro.innerHTML = listas
        .map(lista => {
            return `
                <div class="lista" id="${lista.id}">
                    <div class="titulo-lista">
                        <h3 ondblclick="editarTituloLista('${lista.id}')">${lista.titulo}</h3>
                        <button class="botao-excluir" onclick="excluirLista('${lista.id}')">❌</button>
                    </div>
                    <div class="tarefas" ondrop="soltar(event)" ondragover="permitirSoltar(event)">
                        ${lista.tarefas
                    .map(
                        tarefa => `
                                    <div class="tarefa" draggable="true" ondragstart="arrastar(event)" id="${tarefa.id}" onclick="abrirModal('${lista.id}', '${tarefa.id}')">
                                        <div class="indicadores-etiquetas">
                                            ${tarefa.etiquetas
                                .map(
                                    etiqueta => `
                                                        <span class="indicador-etiqueta" style="background-color: ${etiqueta.cor}" title="${etiqueta.nome}"></span>
                                                    `
                                )
                                .join("")}
                                        </div>
                                        ${tarefa.texto}
                                        <button class="botao-excluir-tarefa" onclick="excluirTarefa('${lista.id}', '${tarefa.id}')">❌</button>
                                    </div>
                                `
                    )
                    .join("")}
                    </div>
                    <!-- Corrigido para passar o ID real da lista -->
                    <button onclick="adicionarTarefa('${lista.id}')">➕ Adicionar Tarefa</button>
                </div>
            `;
        })
        .join("");
}

function editarTituloLista(idLista) {
    let listas = JSON.parse(localStorage.getItem("listas")) || [];
    let listaAlvo = listas.find(lista => lista.id === idLista);

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
    let listas = JSON.parse(localStorage.getItem("listas")) || [];
    let listaAlvo = listas.find(lista => lista.id === idLista);
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
    let idListaDestino = evento.target.closest(".lista").id;

    let listas = JSON.parse(localStorage.getItem("listas")) || [];
    let listaOrigem = listas.find(lista => lista.tarefas.some(tarefa => tarefa.id === idTarefa));
    let listaDestino = listas.find(lista => lista.id === idListaDestino);

    if (listaOrigem && listaDestino) {
        let tarefaMovida = listaOrigem.tarefas.find(tarefa => tarefa.id === idTarefa);
        listaOrigem.tarefas = listaOrigem.tarefas.filter(tarefa => tarefa.id !== idTarefa);
        listaDestino.tarefas.push(tarefaMovida);

        salvarListas(listas);
        renderizarQuadro();
    }
}

async function abrirModal(idLista, idTarefa) {
    
    let listas = JSON.parse(localStorage.getItem("listas")) || [];
    let listaAlvo = listas.find(lista => lista.id === idLista);
    let tarefaAlvo = listaAlvo?.tarefas.find(tarefa => tarefa.id === idTarefa);

    let dados_orcamentos = await recuperarDados("dados_orcamentos");
    console.log(dados_orcamentos);

    if (tarefaAlvo) {
        // Garante que as etiquetas existam
        if (!tarefaAlvo.etiquetas) {
            tarefaAlvo.etiquetas = [];
        }

        let etiquetasGlobais = JSON.parse(localStorage.getItem("etiquetasGlobais")) || [];
        let modal = document.getElementById("modal");
        let modalCorpo = document.getElementById("modal-corpo");
        let fundoEscuro = document.getElementById("fundo-escuro"); // Obtenha o fundo-escuro

        // Redefine o conteúdo do modal, mas preserva o título
        modalCorpo.innerHTML = `
        <div>
            <label for="tarefa-titulo">Título da Tarefa:</label>
            <input type="text" id="tarefa-titulo" value="${tarefaAlvo.texto}" />
            <button onclick="salvarTituloTarefa('${idLista}', '${idTarefa}')">Salvar Título</button>
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
                <input type="text" id="input-start" value="${tarefaAlvo.descricao.start}">
            </div>
            <div>
                <label>Entrega:</label>
                <input type="text" id="input-entrega" value="${tarefaAlvo.descricao.entrega}">
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
                <p id="orcamento-selecionado" class="orcamento-selecionado">
                    Orçamento Selecionado: ${tarefaAlvo.orcamento || "Nenhum"}
                </p>
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
        renderizarAtividades(tarefaAlvo.atividades);

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

                        // Atualiza o texto do parágrafo
                        exibir_todos_os_status(chave)
                        paragrafoSelecionado.textContent = `Orçamento Selecionado: ${chave}`;

                        // Salva a lista atualizada no localStorage
                        salvarListas(listas);

                        // Limpa a lista de sugestões e o campo de input
                        listaSugestoes.innerHTML = "";
                        listaSugestoes.style.display = "none";
                        inputAutoComplete.value = "";
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

        // Exibe o modal
        modal.classList.remove("oculto");
        modal.style.display = "flex";
        fundoEscuro.classList.remove("oculto"); // Exibe o fundo escuro
    } else {
        console.error("Erro: Tarefa não encontrada ou estrutura inválida.");
    }
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
    const criador = acesso.usuario || "Desconhecido";

    const comentarioTexto = document.getElementById("novo-comentario").value.trim();

    if (!comentarioTexto) {
        alert("O comentário não pode estar vazio!");
        return;
    }

    console.log("Comentário capturado:", comentarioTexto);

    let listas = JSON.parse(localStorage.getItem("listas")) || [];
    console.log("Listas carregadas do localStorage:", listas);

    const listaAlvo = listas.find(lista => lista.id === idLista);
    if (!listaAlvo) {
        console.error("Lista não encontrada:", idLista);
        return;
    }

    const tarefaAlvo = listaAlvo.tarefas.find(tarefa => tarefa.id === idTarefa);
    if (!tarefaAlvo) {
        console.error("Tarefa não encontrada:", idTarefa);
        return;
    }

    console.log("Tarefa encontrada:", tarefaAlvo);

    if (!tarefaAlvo.atividades) {
        tarefaAlvo.atividades = []; // Inicializa a lista de atividades, se necessário
    }

    const agora = new Date();
    const dataHora = agora.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

    // Adiciona o novo comentário
    tarefaAlvo.atividades.push({
        comentario: comentarioTexto,
        criador: criador,
        dataHora: dataHora,
    });

    console.log("Atividades atualizadas:", tarefaAlvo.atividades);

    // Salva no localStorage
    salvarListas(listas);

    // Atualiza a exibição no modal
    renderizarAtividades(tarefaAlvo.atividades);

    // Limpa o campo de texto do comentário
    document.getElementById("novo-comentario").value = "";
}

function renderizarAtividades(atividades) {
    const listaAtividades = document.getElementById("lista-atividades");

    if (!listaAtividades) {
        console.error("Erro: Elemento lista-atividades não encontrado.");
        return;
    }

    console.log("Renderizando atividades:", atividades);

    listaAtividades.innerHTML = atividades
        .map((atividade, index) => {
            if (!atividade || !atividade.comentario || !atividade.criador) {
                console.error("Atividade inválida:", atividade);
                return `<div class="comentario">Atividade inválida</div>`;
            }

            const podeExcluir = atividade.criador === (JSON.parse(localStorage.getItem("acesso"))?.usuario || "Desconhecido");

            return `
                <div class="comentario-linha">
                    <span class="comentario-nome"><strong>${atividade.criador}</strong></span>
                    <span class="comentario-data">${atividade.dataHora}</span>
                    <span class="comentario-texto">${atividade.comentario}</span>
                    ${
                        podeExcluir
                            ? `<button class="excluir-comentario" onclick="excluirComentario(${index})">Excluir</button>`
                            : ""
                    }
                </div>
            `;
        })
        .join("");
}

function salvarDescricao(idLista, idTarefa) {
    let listas = JSON.parse(localStorage.getItem("listas")) || [];
    let listaAlvo = listas.find(lista => lista.id === idLista);
    let tarefaAlvo = listaAlvo?.tarefas.find(tarefa => tarefa.id === idTarefa);

    if (tarefaAlvo) {
        // Garante que a descrição exista
        if (!tarefaAlvo.descricao) {
            tarefaAlvo.descricao = {
                chamado: "",
                endereco: "",
                start: "",
                entrega: "",
                pedidoServico: "",
                pedidoVenda: "",
                escopo: "",
                equipe: ""
            };
        }

        // Atualiza os valores da descrição
        tarefaAlvo.descricao.chamado = document.getElementById("input-chamado").value.trim();
        tarefaAlvo.descricao.endereco = document.getElementById("input-endereco").value.trim();
        tarefaAlvo.descricao.start = document.getElementById("input-start").value.trim();
        tarefaAlvo.descricao.entrega = document.getElementById("input-entrega").value.trim();
        tarefaAlvo.descricao.pedidoServico = document.getElementById("input-pedido-servico").value.trim();
        tarefaAlvo.descricao.pedidoVenda = document.getElementById("input-pedido-venda").value.trim();
        tarefaAlvo.descricao.escopo = document.getElementById("input-escopo").value.trim();
        tarefaAlvo.descricao.equipe = document.getElementById("input-equipe").value.trim();

        // Salva no localStorage e re-renderiza o modal
        salvarListas(listas);
        abrirModal(idLista, idTarefa);
    } else {
        console.error("Erro: Tarefa não encontrada ou estrutura inválida.");
    }
}

function salvarTituloTarefa(idLista, idTarefa) {
    let listas = JSON.parse(localStorage.getItem("listas")) || [];
    let listaAlvo = listas.find(lista => lista.id === idLista);
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
        let listas = JSON.parse(localStorage.getItem("listas")) || [];
        let listaAlvo = listas.find(lista => lista.id === idLista);
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
    let listas = JSON.parse(localStorage.getItem("listas")) || [];
    let listaAlvo = listas.find(lista => lista.id === idLista);
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

function excluirComentario(index) {
    const acesso = JSON.parse(localStorage.getItem("acesso")) || {};
    const usuarioAtual = acesso.usuario || "Desconhecido";

    // Recuperar a tarefa e a lista correspondente
    let listas = JSON.parse(localStorage.getItem("listas")) || [];
    let listaAlvo = listas.find(lista =>
        lista.tarefas.some(tarefa =>
            tarefa.atividades?.[index]?.criador === usuarioAtual
        )
    );

    if (listaAlvo) {
        let tarefaAlvo = listaAlvo.tarefas.find(tarefa =>
            tarefa.atividades?.[index]?.criador === usuarioAtual
        );

        if (tarefaAlvo) {
            // Verificar se o criador corresponde ao usuário atual
            const atividade = tarefaAlvo.atividades[index];
            if (atividade.criador === usuarioAtual) {
                tarefaAlvo.atividades.splice(index, 1); // Remove o comentário
                salvarListas(listas); // Atualiza o localStorage
                renderizarAtividades(tarefaAlvo.atividades); // Re-renderiza os comentários
            } else {
                alert("Você só pode excluir seus próprios comentários.");
            }
        }
    }
}
