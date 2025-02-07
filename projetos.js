document.addEventListener("DOMContentLoaded", carregarListas);

function adicionarTarefa(idLista) {
    let textoTarefa = prompt("Digite o nome da nova tarefa:");
    if (textoTarefa) {
        let listas = JSON.parse(localStorage.getItem("listas")) || [];
        let listaAlvo = listas.find(lista => lista.id === idLista);

        if (listaAlvo) {
            listaAlvo.tarefas.push({
                id: "tarefa" + new Date().getTime(),
                texto: textoTarefa,
                descricao: {
                    chamado: "",
                    endereco: "",
                    start: "",
                    entrega: "",
                    pedidoServico: "",
                    pedidoVenda: "",
                    escopo: "",
                    equipe: ""
                },
                atividades: [] // Inicializa as atividades
            });
            salvarListas(listas);
            renderizarQuadro();
        }
    }
}


function adicionarLista() {
    let nomeLista = prompt("Digite o nome da nova lista:");
    if (nomeLista) {
        let listas = JSON.parse(localStorage.getItem("listas")) || [];
        listas.push({
            id: "lista" + new Date().getTime(),
            titulo: nomeLista,
            tarefas: []
        });
        salvarListas(listas);
        renderizarQuadro();
    }
}

function salvarListas(listas) {
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
                                    ${tarefa.texto}
                                    <button class="botao-excluir-tarefa" onclick="excluirTarefa('${lista.id}', '${tarefa.id}')">❌</button>
                                </div>
                            `
                            )                            
                            .join("")}
                    </div>
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

function abrirModal(idLista, idTarefa) {
    let listas = JSON.parse(localStorage.getItem("listas")) || [];
    let listaAlvo = listas.find(lista => lista.id === idLista);
    let tarefaAlvo = listaAlvo?.tarefas.find(tarefa => tarefa.id === idTarefa);

    if (tarefaAlvo) {
        // Garante que a estrutura da descrição exista
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

        let modal = document.getElementById("modal");
        let modalCorpo = document.getElementById("modal-corpo");

        // Gera o conteúdo do modal
        modalCorpo.innerHTML = `
            <div>
                <label for="tarefa-titulo">Título da Tarefa:</label>
                <input type="text" id="tarefa-titulo" value="${tarefaAlvo.texto}" />
                <button onclick="salvarTituloTarefa('${idLista}', '${idTarefa}')">Salvar Título</button>
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
                <button onclick="salvarDescricao('${idLista}', '${idTarefa}')">Salvar Descrição</button>
            </div>
            <div class="atividades">
                <h3>Atividades</h3>
                <div id="lista-atividades">
                    ${(tarefaAlvo.atividades || []).map(comentario => `<div class="comentario">${comentario}</div>`).join("")}
                </div>
                <textarea id="novo-comentario" placeholder="Escreva um comentário..."></textarea>
                <button onclick="adicionarComentario('${idLista}', '${idTarefa}')">Adicionar Comentário</button>
            </div>
        `;

        modal.classList.remove("oculto");
        modal.style.display = "flex";
    }
}

function fecharModal() {
    let modal = document.getElementById("modal");
    modal.style.display = "none";
}

function adicionarComentario(idLista, idTarefa) {
    let comentario = document.getElementById("novo-comentario").value.trim();
    if (comentario) {
        let listas = JSON.parse(localStorage.getItem("listas")) || [];
        let listaAlvo = listas.find(lista => lista.id === idLista);
        let tarefaAlvo = listaAlvo?.tarefas.find(tarefa => tarefa.id === idTarefa);

        if (tarefaAlvo) {
            if (!tarefaAlvo.atividades) {
                tarefaAlvo.atividades = [];
            }
            tarefaAlvo.atividades.push(comentario);

            salvarListas(listas);
            renderizarAtividades(tarefaAlvo.atividades);
            document.getElementById("novo-comentario").value = ""; // Limpa o campo de texto
        }
    }
}

function renderizarAtividades(atividades) {
    let listaAtividades = document.getElementById("lista-atividades");
    listaAtividades.innerHTML = atividades
        .map(comentario => `<div class="comentario">${comentario}</div>`)
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
