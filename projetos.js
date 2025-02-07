document.addEventListener("DOMContentLoaded", carregarListas);

function adicionarTarefa(idLista) {
    let textoTarefa = prompt("Digite o nome da nova tarefa:");
    if (textoTarefa) {
        let listas = JSON.parse(localStorage.getItem("listas")) || [];
        let listaAlvo = listas.find(lista => lista.id === idLista);

        if (listaAlvo) {
            listaAlvo.tarefas.push({ id: "tarefa" + new Date().getTime(), texto: textoTarefa });
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
                        <h3>${lista.titulo}</h3>
                        <button class="botao-excluir" onclick="excluirLista('${lista.id}')">❌</button>
                    </div>
                    <div class="tarefas" ondrop="soltar(event)" ondragover="permitirSoltar(event)">
                        ${lista.tarefas
                            .map(
                                tarefa => `
                                <div class="tarefa" draggable="true" ondragstart="arrastar(event)" id="${tarefa.id}">
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
