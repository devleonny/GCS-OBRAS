let linhasAtuais = [];
let quantidadeFornecedores = 0;

recuperarCotacoes()

document.addEventListener("DOMContentLoaded", () => {
    obter_materiais();
    adicionarLinha();
});


function atualizarQuantidadeItens() {

    const itemCountElement = document.getElementById("itemCount");
    const tabela = document.getElementById("cotacaoTable").querySelector("tbody");
    itemCountElement.textContent = tabela.children.length;

}

function adicionarLinha() {
    const fornecedoresHeader = document.getElementById("fornecedoresHeader");
    const tabela = document.getElementById("cotacaoTable").querySelector("tbody");
    const novaLinha = document.createElement("tr");
    let operacao = localStorage.getItem("operacao");

    // Obtém o número do item anterior para determinar o próximo número
    let ultimoNumeroItem = 0;
    if (tabela.children.length > 0) {
        ultimoNumeroItem = parseInt(
            tabela.lastElementChild.querySelector("td:nth-child(2)").textContent
        );
    }

    const numeroItemAtual = ultimoNumeroItem + 1

    novaLinha.setAttribute("id", `linha-${numeroItemAtual}`);

    const acao = document.createElement("td");
    const removeImg = document.createElement("img");
    removeImg.src = "imagens/remover.png";
    removeImg.alt = "Remover";
    removeImg.className = "remove-img";
    removeImg.onclick = () => {
        tabela.removeChild(novaLinha);
        atualizarQuantidadeItens();
        linhasAtuais = linhasAtuais.filter((item) => item !== novaLinha);
    };

    acao.appendChild(removeImg);
    novaLinha.appendChild(acao);

    const numeroItem = document.createElement("td");
    numeroItem.textContent = numeroItemAtual;
    novaLinha.appendChild(numeroItem);

    const partnumber = document.createElement("td");
    const inputPartnumber = document.createElement("input");
    inputPartnumber.type = "text";
    inputPartnumber.readOnly = true;
    partnumber.appendChild(inputPartnumber);
    novaLinha.appendChild(partnumber);

    const nomeItem = document.createElement("td");
    const inputNome = document.createElement("input");
    inputNome.type = "text";
    inputNome.placeholder = "Digite o nome do item";
    inputNome.oninput = () => mostrarSugestoes(inputNome, partnumber, estoque);
    nomeItem.appendChild(inputNome);

    const sugestoes = document.createElement("div");
    sugestoes.className = "autocomplete-suggestions";
    nomeItem.appendChild(sugestoes);
    novaLinha.appendChild(nomeItem);

    const tipoUnitario = document.createElement("td");
    const inputTipo = document.createElement("input");
    inputTipo.type = "text";
    inputTipo.value = "UND";
    tipoUnitario.appendChild(inputTipo);
    novaLinha.appendChild(tipoUnitario);

    const quantidade = document.createElement("td");
    const inputQuantidade = document.createElement("input");
    inputQuantidade.type = "number";
    inputQuantidade.min = "1";
    inputQuantidade.placeholder = "Digite a quantidade";
    inputQuantidade.id = `quantidade-${numeroItemAtual}`;
    quantidade.appendChild(inputQuantidade);
    novaLinha.appendChild(quantidade);

    const estoque = document.createElement("td");
    const inputEstoque = document.createElement("input");
    inputEstoque.type = "text";
    inputEstoque.readOnly = true;
    estoque.appendChild(inputEstoque);
    novaLinha.appendChild(estoque);

    linhasAtuais.push(novaLinha);

    if (fornecedoresHeader.style.display == "table-cell") {
        let linhaAtualQuantidade = numeroItemAtual;

        const dados = JSON.parse(localStorage.getItem("dados_cotacao"));
        let cotacaoEditarID = localStorage.getItem("cotacaoEditandoID");

        if (operacao == "editar") {
            quantidadeFornecedores = dados[cotacaoEditarID].dados[0].fornecedores.length;
        }

        for (let i = 1; i <= quantidadeFornecedores; i++) {
            let tdPrecoUnitario = document.createElement("td");
            let inputPrecoUnitario = document.createElement("input");
            inputPrecoUnitario.type = "number";
            inputPrecoUnitario.placeholder = "Digite o preço unitário";
            inputPrecoUnitario.id = `precoUnitario-${i}-${linhaAtualQuantidade}`;

            let linhaQuantidade = inputPrecoUnitario.id.split("-")[2];
            let numeroDoFornecedor = inputPrecoUnitario.id.split("-")[1];

            inputQuantidade.addEventListener("input", () => {
                let quantidadeAtual =
                    Number(document.querySelector(`#quantidade-${linhaQuantidade}`).value) ||
                    0;
                let precoUnitarioAtual =
                    Number(
                        document.querySelector(`#precoUnitario-${numeroDoFornecedor}-${linhaQuantidade}`).value
                    ) || 0;
                let precoTotalAtual = document.querySelector(
                    `#precoTotal-${numeroDoFornecedor}-${linhaQuantidade}`
                );

                precoTotalAtual.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`;
            });

            tdPrecoUnitario.appendChild(inputPrecoUnitario);

            let tdPrecototal = document.createElement("td");
            let inputPrecoTotal = document.createElement("input");
            inputPrecoTotal.type = "text";
            inputPrecoTotal.readOnly = true;

            inputPrecoTotal.id = `precoTotal-${i}-${linhaAtualQuantidade}`;

            inputPrecoTotal.classList.add(`resultadoPrecoTotal-linha-${linhaAtualQuantidade}`);
            inputPrecoTotal.classList.add(`resultadoPrecoTotal-fornecedor-${i}`);

            tdPrecototal.appendChild(inputPrecoTotal);

            inputPrecoUnitario.addEventListener("input", () => {
                let quantidadeAtual =
                    Number(document.querySelector(`#quantidade-${linhaQuantidade}`).value) ||
                    0;
                let precoUnitarioAtual =
                    Number(
                        document.querySelector(`#precoUnitario-${numeroDoFornecedor}-${linhaQuantidade}`).value
                    ) || 0;
                let precoTotalAtual = document.querySelector(
                    `#precoTotal-${numeroDoFornecedor}-${linhaQuantidade}`
                );

                precoTotalAtual.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`;

                decidirMelhorOferta(linhaQuantidade);
            });

            novaLinha.append(tdPrecoUnitario, tdPrecototal);
        }
    }

    tabela.appendChild(novaLinha);

    atualizarQuantidadeItens();
}


function mostrarSugestoes(input, partnumberCell, estoqueCell) {
    const listaMateriais = JSON.parse(localStorage.getItem("dados_materiais")) || {};
    const valor = input.value.toLowerCase();
    const sugestoes = input.parentElement.querySelector(".autocomplete-suggestions");

    sugestoes.innerHTML = "";

    const itensFiltrados = Object.values(listaMateriais)
        .filter(item => item.descricao && item.descricao.toLowerCase().startsWith(valor))
        .sort((a, b) => a.descricao.localeCompare(b.descricao));

    itensFiltrados.forEach(item => {
        const sugestao = document.createElement("div");
        sugestao.textContent = item.descricao;
        sugestao.onclick = () => {
            input.value = item.descricao;
            partnumberCell.querySelector("input").value = item.partnumber || "";
            estoqueCell.querySelector("input").value = item.estoque ?? 0;
            sugestoes.innerHTML = ""; // Limpa as sugestões
        };

        sugestoes.appendChild(sugestao);
    });
}


let nomeFornecedor = "";

function abrirModal() {

    const modal = document.getElementById("fornecedorModal");
    modal.style.display = "block";
    const input = document.getElementById("pesquisarFornecedor");

    input.addEventListener("input", () => filtroFornecedores())

}

function fecharModal() {
    const modal = document.getElementById("fornecedorModal");
    modal.style.display = "none";
}

function salvarFornecedor() {
    // Verifica quantos fornecedores já existem no localStorage se a operação for "editar"
    let operacao = localStorage.getItem("operacao");
    let fornecedoresExistentes = 0;

    if (operacao === "editar") {
        const cotacoes = JSON.parse(localStorage.getItem("dados_cotacao")) || {};
        const cotacaoEditandoID = localStorage.getItem("cotacaoEditandoID");

        if (cotacoes[cotacaoEditandoID] && cotacoes[cotacaoEditandoID].dados.length > 0) {
            fornecedoresExistentes = cotacoes[cotacaoEditandoID].dados[0].fornecedores.length;
        }
    }

    // Atualiza a quantidade de fornecedores
    quantidadeFornecedores = fornecedoresExistentes + 1;

    // Conta quantas linhas existem atualmente na tabela
    const tabela = document.querySelector("#cotacaoTable tbody");
    const numeroLinhas = tabela.querySelectorAll("tr").length; // Total de linhas na tabela

    const input = document.getElementById("pesquisarFornecedor");
    const sugestoes = document.getElementById("listaFornecedores");
    const mensagemErro = document.getElementById("mensagemErro");

    const trNomeFornecedor = document.querySelector(".count-row");
    const thNomeFornecedor = document.createElement("th");
    const trTopicostabela = document.querySelector("#topicos-tabela");
    const thPrecoUnitario = document.createElement("th");
    const thPrecoTotal = document.createElement("th");

    thPrecoUnitario.textContent = "Preço Unitário";
    thPrecoTotal.textContent = "Preço Total";

    thNomeFornecedor.colSpan = "2";

    if (input.value.trim() !== "") {
        nomeFornecedor = input.value.trim();

        // Limpa o campo "pesquisarFornecedor" e oculta as sugestões
        input.value = "";
        sugestoes.style.display = "none";

        // Remove mensagem de erro, caso exista
        if (mensagemErro) mensagemErro.textContent = "";

        // Percorre cada linha existente na tabela para criar os inputs necessários
        for (let linhaAtualQuantidade = 1; linhaAtualQuantidade <= numeroLinhas; linhaAtualQuantidade++) {
            let tdPrecoUnitario = document.createElement("td");
            let inputPrecoUnitario = document.createElement("input");
            inputPrecoUnitario.type = "number";
            inputPrecoUnitario.placeholder = "Digite o preço unitário";
            inputPrecoUnitario.id = `precoUnitario-${quantidadeFornecedores}-${linhaAtualQuantidade}`;

            let inputQuantidade = document.querySelector(`#quantidade-${linhaAtualQuantidade}`);

            let linhaQuantidade = linhaAtualQuantidade;
            let numeroDoFornecedor = quantidadeFornecedores;

            inputQuantidade.addEventListener("input", () => {
                let quantidadeAtual = Number(document.querySelector(`#quantidade-${linhaQuantidade}`).value) || 0;
                let precoUnitarioAtual = Number(
                    document.querySelector(`#precoUnitario-${numeroDoFornecedor}-${linhaQuantidade}`).value
                ) || 0;
                let precoTotalAtual = document.querySelector(
                    `#precoTotal-${numeroDoFornecedor}-${linhaQuantidade}`
                );

                precoTotalAtual.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`;
            });

            inputPrecoUnitario.addEventListener("input", () => {
                let quantidadeAtual = Number(document.querySelector(`#quantidade-${linhaQuantidade}`).value) || 0;
                let precoUnitarioAtual = Number(
                    document.querySelector(`#precoUnitario-${numeroDoFornecedor}-${linhaQuantidade}`).value
                ) || 0;
                let precoTotalAtual = document.querySelector(
                    `#precoTotal-${numeroDoFornecedor}-${linhaQuantidade}`
                );

                precoTotalAtual.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`;

                decidirMelhorOferta(linhaQuantidade);
            });

            tdPrecoUnitario.appendChild(inputPrecoUnitario);

            let tdPrecototal = document.createElement("td");
            let inputPrecoTotal = document.createElement("input");
            inputPrecoTotal.type = "text";
            inputPrecoTotal.readOnly = "true";

            inputPrecoTotal.id = `precoTotal-${quantidadeFornecedores}-${linhaAtualQuantidade}`;

            inputPrecoTotal.classList.add(`resultadoPrecoTotal-linha-${linhaAtualQuantidade}`);
            inputPrecoTotal.classList.add(`resultadoPrecoTotal-fornecedor-${quantidadeFornecedores}`);

            tdPrecototal.append(inputPrecoTotal);

            // Adiciona os novos inputs na linha correspondente
            let linhaParaAdicionar = document.querySelector(`#linha-${linhaAtualQuantidade}`);
            linhaParaAdicionar.append(tdPrecoUnitario, tdPrecototal);
        }

        adiconarFooter();

        const fornecedoresHeader = document.getElementById("fornecedoresHeader");

        fornecedoresHeader.style.display = "table-cell";

        thNomeFornecedor.textContent = nomeFornecedor;

        trNomeFornecedor.appendChild(thNomeFornecedor);

        trTopicostabela.append(thPrecoUnitario, thPrecoTotal);

        fecharModal();

        console.log("Fornecedor salvo:", nomeFornecedor);
    } else {
        // Adiciona ou exibe mensagem de erro em vermelho abaixo do campo
        if (!mensagemErro) {
            const novoErro = document.createElement("span");
            novoErro.id = "mensagemErro";
            novoErro.style.color = "red";
            novoErro.style.fontSize = "12px";
            novoErro.textContent = "Por favor, digite um nome válido.";
            input.parentElement.appendChild(novoErro);
        } else {
            mensagemErro.textContent = "Por favor, digite um nome válido.";
        }
    }
}



function esconderFornecedores() {

    const fornecedoresHeader = document.getElementById("fornecedoresHeader");

    fornecedoresHeader.style.display = "none";

}

function decidirMelhorOferta(linha_quantidade){

    let listaValores = document.querySelectorAll(`input.resultadoPrecoTotal-linha-${linha_quantidade}`)

    menorValor = descobrirMenorValor(listaValores)

    estilizarMelhorPreco(listaValores, menorValor)

}

function adiconarFooter(){

    let linhaDesconto = document.querySelector("#linhaDesconto")

    let linhaSubtotal = document.querySelector("#linhaSubtotal")

    let linhaFrete = document.querySelector("#linhaFrete")

    let linhaCondicaoPagar = document.querySelector("#linhaCondicaoPagar")

    let linhaTotal = document.querySelector("#linhaTotal")

    let tdDesconto = document.createElement("td")
    let inputDesconto = document.createElement("input")

    inputDesconto.id = `input-desconto-${quantidadeFornecedores}`
    tdDesconto.colSpan = "2"
    inputDesconto.placeholder = "Digite a % do Desconto"
    inputDesconto.type = 'number'

    let numeroFornecedorDesconto = inputDesconto.id[15]

    inputDesconto.addEventListener('input', () => calculoSubtotal(numeroFornecedorDesconto))

    tdDesconto.appendChild(inputDesconto)
    linhaDesconto.appendChild(tdDesconto)

    let tdSubtotal = document.createElement("td")
    let inputSubtotal = document.createElement("input")

    inputSubtotal.id = `input-subtotal-${quantidadeFornecedores}`
    inputSubtotal.classList.add("inputs-subtotal")
    tdSubtotal.colSpan = "2"
    inputSubtotal.readOnly = "true"
    
    tdSubtotal.appendChild(inputSubtotal)
    linhaSubtotal.appendChild(tdSubtotal)

    let tdFrete = document.createElement("td")
    let inputFrete = document.createElement("input")

    inputFrete.id = `input-frete-${quantidadeFornecedores}`
    tdFrete.colSpan = "2"
    inputFrete.placeholder = "Digite o Frete"
    inputFrete.type = "number"

    let numeroFornecedorFrete = inputFrete.id[12]

    inputFrete.addEventListener('input', () => calculoTotal(numeroFornecedorFrete))

    tdFrete.appendChild(inputFrete)
    linhaFrete.appendChild(tdFrete)

    let tdCondicaoPagar = document.createElement("td")
    let inputCondicaoPagar = document.createElement("input")

    inputCondicaoPagar.id = `input-condicao-pagar-${quantidadeFornecedores}`
    tdCondicaoPagar.colSpan = "2"
    inputCondicaoPagar.placeholder = "Digite a Condição de Pagamento"

    tdCondicaoPagar.appendChild(inputCondicaoPagar)
    linhaCondicaoPagar.appendChild(tdCondicaoPagar)

    let tdTotal = document.createElement("td")
    let inputTotal = document.createElement("input")

    inputTotal.id = `input-total-${quantidadeFornecedores}`
    inputTotal.classList.add("inputs-total")
    tdTotal.colSpan = "2"
    inputTotal.readOnly = "true"

    tdTotal.appendChild(inputTotal)
    linhaTotal.appendChild(tdTotal)

}

function calculoSubtotal(numeroFornecedor){

    let tdSubtotal = document.querySelector(`#input-subtotal-${numeroFornecedor}`)

    let inputsSubtotal = document.querySelectorAll(".inputs-subtotal")
    
    let quantidadeDesconto = document.querySelector(`#input-desconto-${numeroFornecedor}`).value
    
    let valorSubtotal = 0
    
    let listaValores = document.querySelectorAll(`input.resultadoPrecoTotal-fornecedor-${numeroFornecedor}`)
    
    for(valor of listaValores){
        
        valorReal = valor.value
        
        valorReal = parseFloat(valorReal.slice(3))
        
        valorSubtotal += valorReal
        
    }
    
    let valorDesconto = valorSubtotal * (quantidadeDesconto / 100)
    
    tdSubtotal.value = `R$ ${(valorSubtotal - valorDesconto).toFixed(2)}`
    
     let menorValor = descobrirMenorValor(inputsSubtotal)

    estilizarMelhorPreco(inputsSubtotal, menorValor)

}

function calculoTotal(numeroFornecedor){

    let inputsTotal = document.querySelectorAll(".inputs-total")

    let tdFrete = parseFloat(document.querySelector(`#input-frete-${numeroFornecedor}`).value)

    let tdSubtotal = parseFloat(document.querySelector(`#input-subtotal-${numeroFornecedor}`).value.slice(3))

    let inputTotal = document.querySelector(`#input-total-${numeroFornecedor}`)

    inputTotal.value = `R$ ${(tdSubtotal + tdFrete).toFixed(2)}`

    menorValor = descobrirMenorValor(inputsTotal)

    estilizarMelhorPreco(inputsTotal, menorValor)

}

function estilizarMelhorPreco(listaValores, menorValor){

    for(valor of listaValores){

        valorReal = valor.value
        
        valorReal = parseFloat(valorReal.slice(3))

        if(menorValor == valorReal){

            valor.parentElement.style.backgroundColor =  "#00ff37"
            valor.style.backgroundColor = "#00ff37"


        }else{

            valor.parentElement.style.backgroundColor =  "white"
            valor.style.backgroundColor = "white"

        }

    }

}

function descobrirMenorValor(listaValores){

    let menorValor = Infinity

    for(valor of listaValores){
        
        valorReal = valor.value
        
        valorReal = parseFloat(valorReal.slice(3))

        if(valorReal < menorValor){

            menorValor = valorReal

        }

    }

    return menorValor

}

async function carregarFornecedores(){

    const fornecedores = await recuperarDados('dados_clientes');
    return Object.values(fornecedores);

}

async function filtroFornecedores() {
    
    const termo = document.getElementById('pesquisarFornecedor').value.toLowerCase();
    const lista = document.getElementById('listaFornecedores');
    lista.style.display = "block"
    lista.innerHTML = "";

    if (termo.trim() === "") {
        
        lista.style.display = "none"

        return};

    const fornecedores = await carregarFornecedores();

    const resultados = fornecedores.filter(fornecedor =>{

        if(fornecedor.nome && fornecedor.cnpj){

            return fornecedor.nome.toLowerCase().includes(termo) || fornecedor.cnpj.includes(termo)

        }else if(fornecedor.nome){

            return fornecedor.nome.toLowerCase().includes(termo)

        }else if(fornecedor.cnpj){

            return fornecedor.cnpj.includes(termo)

        }


        
    }

    
);

resultados.forEach(fornecedor => {
    const item = document.createElement('li');
    item.textContent = fornecedor.nome;
    item.dataset.cnpj = fornecedor.cnpj;

    item.addEventListener('click', function () {
        document.getElementById('pesquisarFornecedor').value = fornecedor.nome;
        lista.style.display = "none"
        lista.innerHTML = "";
    });

    lista.appendChild(item);
});

}

function salvarObjeto() {
    const informacoes = salvarInformacoes();
    const dados = salvarDados();
    const valorFinal = salvarValorFinal();
    const operacao = localStorage.getItem("operacao");
    const status = "ativo"

    const novaCotacao = { informacoes, dados, valorFinal, operacao, status };

    // Envia a nova cotação para a API
    const payload = {
        tabela: "cotacoes",
        cotacao: novaCotacao,
    };

    enviar_dados_generico(payload); // Envia os dados para a API

    // Exibe mensagem de sucesso
    const aviso = document.getElementById("salvarAviso");
    aviso.style.display = "block";
    setTimeout(() => (aviso.style.display = "none"), 3000);

    console.log("Cotação salva:", informacoes.apelidoCotacao);
    
    // Atualiza a tabela com os novos dados
    fecharModalApelido();

    carregarCotacoesSalvas();
}



// Função para salvar as informações gerais (id, data, hora, criador)
function salvarInformacoes() {
    const operacao = localStorage.getItem("operacao");
    const now = new Date();
    const dia = String(now.getDate()).padStart(2, "0");
    const mes = String(now.getMonth() + 1).padStart(2, "0");
    const ano = now.getFullYear();
    const horas = String(now.getHours()).padStart(2, "0");
    const minutos = String(now.getMinutes()).padStart(2, "0");
    const segundos = String(now.getSeconds()).padStart(2, "0");

    const dataFormatada = `${dia}/${mes}/${ano}`;
    const horaFormatada = `${horas}:${minutos}:${segundos}`;

    const apelidoCotacao = document.getElementById("inputApelido").value;

    // Obter o criador do localStorage
    const acesso = JSON.parse(localStorage.getItem("acesso"));
    const criador = acesso?.usuario || "Desconhecido";

    // Geração do ID único usando a função unicoID
    if(operacao == "incluir"){

        id = unicoID();

    }else if(operacao == "editar"){
        id =  localStorage.getItem("cotacaoEditandoID");

    }

    return {
        id,
        data: dataFormatada,
        hora: horaFormatada,
        criador,
        apelidoCotacao
    };
}
// Função para salvar os dados dos itens
function salvarDados() {
    const tabela = document.getElementById("cotacaoTable");
    const linhas = tabela.querySelectorAll("tbody tr");

    if (linhas.length === 0) {
        console.warn("Não há itens na tabela para salvar.");
        return [];
    }

    return Array.from(linhas).map(linha => {
        const celulas = linha.querySelectorAll("td");
        const fornecedoresHeaders = Array.from(document.querySelectorAll(".count-row th"));

        const item = {
            numeroItem: linha.querySelector("td:nth-child(2)")?.textContent || "",
            partnumber: linha.querySelector("td:nth-child(3) input")?.value || "",
            nomeItem: linha.querySelector("td:nth-child(4) input")?.value || "",
            tipoUnitario: linha.querySelector("td:nth-child(5) input")?.value || "",
            quantidade: linha.querySelector("td:nth-child(6) input")?.value || "",
            estoque: linha.querySelector("td:nth-child(7) input")?.value || "",
            fornecedores: []
        };

        fornecedoresHeaders.forEach((th, index) => {
            if (index === 0) return; // Ignorar o título do cabeçalho
            const nomeFornecedor = th.textContent.trim();
            const precoUnitarioInput = celulas[7 + (index - 1) * 2]?.querySelector("input");
            const precoTotalInput = celulas[8 + (index - 1) * 2]?.querySelector("input");

            item.fornecedores.push({
                nome: nomeFornecedor,
                precoUnitario: precoUnitarioInput ? precoUnitarioInput.value : "",
                precoTotal: precoTotalInput ? precoTotalInput.value : ""
            });
        });

        return item;
    });
}

// Função para salvar os dados dos fornecedores (valorFinal)
function salvarValorFinal() {
    const fornecedoresHeaders = Array.from(document.querySelectorAll(".count-row th"));

    return fornecedoresHeaders.slice(1).map((th, fornecedorIndex) => {
        const nomeFornecedor = th.textContent.trim();
        const idSuffix = fornecedorIndex + 1;

        const porcentagemDesconto = document.getElementById(`input-desconto-${idSuffix}`)?.value || "";
        const subtotal = document.getElementById(`input-subtotal-${idSuffix}`)?.value || "";
        const valorFrete = document.getElementById(`input-frete-${idSuffix}`)?.value || "";
        const condicaoPagar = document.getElementById(`input-condicao-pagar-${idSuffix}`)?.value || "";
        const valorTotal = document.getElementById(`input-total-${idSuffix}`)?.value || "";

        return {
            nome: nomeFornecedor,
            porcentagemDesconto,
            subtotal,
            valorFrete,
            condicaoPagar,
            valorTotal
        };
    });
}

function abrirModalApelido(){

    const modal = document.getElementById("modalApelido");
    const input = document.getElementById("inputApelido");
    const button = document.getElementById("confirmarApelidoButton");

    modal.style.display = "block";
    input.value = "";

}

function fecharModalApelido() {
    const modal = document.getElementById("modalApelido");
    modal.style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
    carregarCotacoesSalvas();

    document.getElementById("novaCotacaoButton").addEventListener("click", () => {
        document.getElementById("cotacoesSalvasContainer").style.display = "none";
        document.getElementById("novaCotacaoContainer").style.display = "block";
        localStorage.setItem("operacao", "incluir");

    });
});

// Função para carregar cotações salvas do localStorage
function carregarCotacoesSalvas() {
    const tabelaBody = document.getElementById("cotacoesSalvasTable").querySelector("tbody");
    tabelaBody.innerHTML = "";

    const cotacoes = JSON.parse(localStorage.getItem("dados_cotacao")) || {};

    Object.entries(cotacoes).forEach(([id, cotacao]) => {
        const linha = document.createElement("tr");

        linha.innerHTML = `
            <td>${cotacao.informacoes.apelidoCotacao || "Sem Apelido"}</td>
            <td>${cotacao.informacoes.data}</td>
            <td>${cotacao.informacoes.criador}</td>
            <td>${cotacao.dados.length}</td>
            <td>${cotacao.valorFinal.length}</td>
            <td>
                <img src="imagens/editar.png" alt="Editar" class="img-editar" onclick="editarCotacao('${id}')">
                <img src="imagens/excluir.png" alt="Excluir" class="img-excluir" onclick="removerCotacao(this)">
            </td>
            <td style="display:none;" class="cotacao-id">${id}</td> <!-- Adiciona o ID oculto -->
        `;

        tabelaBody.appendChild(linha);
    });

    console.log("Cotações Salvas Carregadas!");
}





function editarCotacao(id) {
    const cotacoes = JSON.parse(localStorage.getItem("dados_cotacao")) || {};
    const cotacao = cotacoes[id];

    if (!cotacao) {
        console.error(`Cotação com ID ${id} não encontrada.`);
        return;
    }

    // Define a operação como editar
    localStorage.setItem("operacao", "editar");
    localStorage.setItem("cotacaoEditandoID", id);

    // Preenche o formulário com os dados da cotação
    preencherFormularioCotacao(cotacao);

    // Atualiza o valor de "Quantidade de Itens"
    atualizarQuantidadeItens();

    // Exibe a tela de edição
    document.getElementById("cotacoesSalvasContainer").style.display = "none";
    document.getElementById("novaCotacaoContainer").style.display = "block";

    // Itera sobre cada linha da tabela e chama decidirMelhorOferta
    const tabela = document.getElementById("cotacaoTable").querySelector("tbody");
    const linhas = tabela.children;

    for (let i = 0; i < linhas.length; i++) {
        const numeroItem = linhas[i].querySelector("td:nth-child(2)").textContent;
        decidirMelhorOferta(numeroItem);
    }

    // Atualiza os destaques de menor subtotal e menor total
    const inputsSubtotal = document.querySelectorAll(".inputs-subtotal");
    const inputsTotal = document.querySelectorAll(".inputs-total");

    const menorSubtotal = descobrirMenorValor(inputsSubtotal);
    const menorTotal = descobrirMenorValor(inputsTotal);

    estilizarMelhorPreco(inputsSubtotal, menorSubtotal);
    estilizarMelhorPreco(inputsTotal, menorTotal);

    console.log(`Cotação editada: ID ${id}`);
}


// Função para encontrar o menor valor entre uma lista de inputs
function descobrirMenorValor(inputs) {
    let menorValor = Infinity;

    inputs.forEach(input => {
        const valor = parseFloat(input.value.replace("R$", "").trim()) || Infinity;
        if (valor < menorValor) {
            menorValor = valor;
        }
    });

    return menorValor;
}


function preencherFormularioCotacao(cotacao) {

    const tabela = document.getElementById("cotacaoTable").querySelector("tbody");
    tabela.innerHTML = "";

    // Adicionar as linhas de dados dos itens
    cotacao.dados.forEach(dado => adicionarLinhaComDados(dado));

    // Verificar se há fornecedores
    if (cotacao.dados[0].fornecedores.length > 0) {

        const fornecedoresHeader = document.getElementById("fornecedoresHeader");
        fornecedoresHeader.style.display = "table-cell";

        // Adicionar cabeçalhos de fornecedores
        cotacao.dados[0].fornecedores.forEach(dado => adicionarNomeFornecedores(dado));

        // Adicionar valores finais para cada fornecedor
        cotacao.valorFinal.forEach((dado, index) => {
            adicionarValorFinal(dado, index + 1); // Passa o índice do fornecedor (+1 para iniciar em 1)
        });
    }
}


function adicionarLinhaComDados(dado) {
    const tabela = document.getElementById("cotacaoTable").querySelector("tbody");
    const novaLinha = document.createElement("tr");

    // Definir o ID da linha com base no número do item
    novaLinha.id = `linha-${dado.numeroItem}`;

    const tdRemover = document.createElement("td");
    const imgRemover = document.createElement("img");

    imgRemover.setAttribute("src", "imagens/remover.png");
    imgRemover.setAttribute("alt", "Remover");
    imgRemover.classList.add("remove-img");
    imgRemover.onclick = () => removerLinha(imgRemover);

    tdRemover.appendChild(imgRemover);

    const tdNumeroItem = document.createElement("td");
    tdNumeroItem.textContent = `${dado.numeroItem}`;

    const tdPartnumber = document.createElement("td");
    const inputPartnumber = document.createElement("input");

    inputPartnumber.setAttribute("value", `${dado.partnumber}`);
    inputPartnumber.setAttribute("readonly", "true");

    tdPartnumber.appendChild(inputPartnumber);

    const tdNomeItem = document.createElement("td");
    const inputNomeItem = document.createElement("input");

    inputNomeItem.setAttribute("value", `${dado.nomeItem}`);
    tdNomeItem.appendChild(inputNomeItem);

    const tdTipoUnitario = document.createElement("td");
    const inputTipoUnitario = document.createElement("input");

    inputTipoUnitario.setAttribute("value", `${dado.tipoUnitario}`);
    tdTipoUnitario.appendChild(inputTipoUnitario);

    const tdQuantidade = document.createElement("td");
    const inputQuantidade = document.createElement("input");

    // Definir o ID do campo quantidade com base na linha
    inputQuantidade.id = `quantidade-${dado.numeroItem}`;
    inputQuantidade.setAttribute("value", `${dado.quantidade}`);
    inputQuantidade.type = "number";

    // Adicionar event listener para atualizar os preços totais ao alterar a quantidade
    inputQuantidade.addEventListener("input", () => {
        const quantidadeAtual = Number(inputQuantidade.value) || 0;

        // Atualizar todos os preços totais relacionados a este item
        dado.fornecedores.forEach((fornecedor, index) => {
            const precoUnitarioInput = document.querySelector(`#precoUnitario-${index + 1}-${dado.numeroItem}`);
            const precoTotalInput = document.querySelector(`#precoTotal-${index + 1}-${dado.numeroItem}`);

            if (precoUnitarioInput && precoTotalInput) {
                const precoUnitarioAtual = Number(precoUnitarioInput.value) || 0;
                precoTotalInput.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`;
            }
            decidirMelhorOferta(dado.numeroItem);
        });
    });

    tdQuantidade.appendChild(inputQuantidade);

    const tdEstoque = document.createElement("td");
    const inputEstoque = document.createElement("input");

    inputEstoque.setAttribute("value", `${dado.estoque}`);
    inputEstoque.setAttribute("readonly", "true");

    tdEstoque.appendChild(inputEstoque);

    novaLinha.append(tdRemover, tdNumeroItem, tdPartnumber, tdNomeItem, tdTipoUnitario, tdQuantidade, tdEstoque);

    if (dado.fornecedores.length > 0) {
        adicionarPrecoUnitarioPrecoTotal(dado.fornecedores, novaLinha, dado.numeroItem);
    }

    tabela.appendChild(novaLinha);
}

function adicionarNomeFornecedores(dado){

    const linhaCountRow = document.querySelector(".count-row")

    const linhaTopicosTabela = document.querySelector("#topicos-tabela")

    const thTitulofornecedor = document.createElement("th")

    thTitulofornecedor.textContent = dado.nome

    thTitulofornecedor.setAttribute("colspan", "2")

    linhaCountRow.appendChild(thTitulofornecedor)

    const thPrecoUnitario = document.createElement("th")
    const thPrecoTotal = document.createElement("th")

    thPrecoUnitario.textContent = "Preço Unitário"

    thPrecoTotal.textContent = "Preço Total"

    linhaTopicosTabela.append(thPrecoUnitario, thPrecoTotal)

}

function adicionarPrecoUnitarioPrecoTotal(dado, novaLinha, numeroItem) {
    for (let i = 0; i < dado.length; i++) {
        const tdPrecoUnitario = document.createElement("td");
        const inputPrecoUnitario = document.createElement("input");

        // Definir o ID do input com base no fornecedor e número do item
        inputPrecoUnitario.id = `precoUnitario-${i + 1}-${numeroItem}`;
        inputPrecoUnitario.type = "number";
        inputPrecoUnitario.placeholder = "Digite o preço unitário";
        inputPrecoUnitario.setAttribute("value", `${dado[i].precoUnitario}`);

        tdPrecoUnitario.appendChild(inputPrecoUnitario);

        const tdPrecoTotal = document.createElement("td");
        const inputPrecoTotal = document.createElement("input");

        // Definir o ID do input do preço total
        inputPrecoTotal.id = `precoTotal-${i + 1}-${numeroItem}`;
        inputPrecoTotal.type = "text";
        inputPrecoTotal.readOnly = true;
        inputPrecoTotal.setAttribute("value", `${dado[i].precoTotal}`);

        // Adicionar as classes ao input do preço total
        inputPrecoTotal.classList.add(`resultadoPrecoTotal-linha-${numeroItem}`);
        inputPrecoTotal.classList.add(`resultadoPrecoTotal-fornecedor-${i + 1}`);

        tdPrecoTotal.appendChild(inputPrecoTotal);

        // Adicionar evento para atualizar preço total ao alterar o preço unitário
        inputPrecoUnitario.addEventListener("input", () => {
            const quantidadeAtual = Number(
                document.querySelector(`#quantidade-${numeroItem}`).value
            ) || 0;
            const precoUnitarioAtual = Number(inputPrecoUnitario.value) || 0;
            inputPrecoTotal.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`;
            decidirMelhorOferta(numeroItem);
        });

        novaLinha.append(tdPrecoUnitario, tdPrecoTotal);
    }
}


function adicionarValorFinal(dado, index) {
    criarLinhaInput("#linhaDesconto", "input-desconto", index, dado.porcentagemDesconto, "Digite a % do Desconto", () => calculoSubtotal(index));
    criarLinhaInput("#linhaSubtotal", "input-subtotal", index, dado.subtotal, null, null, true, "inputs-subtotal");
    criarLinhaInput("#linhaFrete", "input-frete", index, dado.valorFrete, "Digite o Frete", () => calculoTotal(index));
    criarLinhaInput("#linhaCondicaoPagar", "input-condicao-pagar", index, dado.condicaoPagar, "Digite a Condição de Pagamento");
    criarLinhaInput("#linhaTotal", "input-total", index, dado.valorTotal, null, null, true, "inputs-total");
}

function criarLinhaInput(linhaSelector, idPrefix, index, value, placeholder, eventListener = null, readOnly = false, additionalClass = null) {
    const linha = document.querySelector(linhaSelector);
    const td = document.createElement("td");
    const input = document.createElement("input");

    td.setAttribute("colspan", "2");
    input.setAttribute("id", `${idPrefix}-${index}`);
    input.setAttribute("value", value);

    if (placeholder) input.setAttribute("placeholder", placeholder);
    if (readOnly) input.setAttribute("readonly", "true");
    if (additionalClass) input.classList.add(additionalClass);

    if (eventListener) input.addEventListener("input", eventListener);

    td.appendChild(input);
    linha.appendChild(td);
}

function removerLinha(elemento) {
    const linha = elemento.parentElement.parentElement;
    linha.remove();
    atualizarQuantidadeItens();
}

function voltarParaTabela() {
    f5()
}

async function recuperarCotacoes() {
    const resposta = await fetch(
        'https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=cotacoes'
    );

    const dados = await resposta.json();

    // Inicializar o objeto para armazenar as cotações
    let cotacoes = {};

    // Transformar a lista de cotações em um objeto com ID como chave
    dados.forEach((cotacao) => {
        const id = cotacao.informacoes.id;
        cotacoes[id] = cotacao;
    });

    // Salvar no localStorage como um objeto
    localStorage.setItem("dados_cotacao", JSON.stringify(cotacoes));

    // Recarregar a tabela de cotações salvas
    carregarCotacoesSalvas();
}


function voltarParaInicio() {
    window.location.href = "inicial.html";
}

function removerCotacao(elemento) {
    // Encontra a linha associada ao botão clicado
    const linha = elemento.parentElement.parentElement;

    // Obtém o ID da cotação a partir da célula oculta
    const idCotacao = linha.querySelector(".cotacao-id").textContent;

    // Remove a linha da tabela
    linha.remove();

    let status = "excluido"

    let operacao = "excluir"

    const cotacaoParaExcluir = { operacao, status, idCotacao };

    // Envia a nova cotação para a API
    const payload = {
        tabela: "cotacoes",
        cotacao: cotacaoParaExcluir,
    };

    enviar_dados_generico(payload);

    console.log(`Cotação removida com ID: ${idCotacao}`);
    return idCotacao; // Retorna o ID da cotação removida
}
