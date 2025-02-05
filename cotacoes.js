let linhasAtuais = [];
let quantidadeFornecedores = 0;


document.addEventListener("DOMContentLoaded", async () => {
    obter_materiais();
    adicionarLinha();
    await recuperarCotacoes();
    
    const idEdicao = localStorage.getItem("cotacaoEditandoID");
    const operacao = localStorage.getItem("operacao");
    const iniciouPorClique = localStorage.getItem("iniciouPorClique");
    const cotacoes = JSON.parse(localStorage.getItem("dados_cotacao")) || {};
    
    // Só chama editarCotacao se a flag indicar que foi pelo link específico
    if (idEdicao && operacao === "editar" && iniciouPorClique === "true") {
        editarCotacao(idEdicao);
        localStorage.removeItem("iniciouPorClique"); // Remove para evitar execuções indesejadas
    }
    if (idEdicao && cotacoes[idEdicao]) {
        atualizarBotoesFinalizarReabrir(cotacoes[idEdicao].status);
    }
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
    inputEstoque.type = "number";

    inputEstoque.id = `estoque-${numeroItemAtual}`

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

            inputEstoque.addEventListener("input", () => {

                let quantidadeAtual = Number(document.querySelector(`#quantidade-${linhaQuantidade}`).value) || 0;

                let precoUnitarioAtual = Number(document.querySelector(`#precoUnitario-${numeroDoFornecedor}-${linhaQuantidade}`).value) || 0;

                let precoTotalAtual = document.querySelector(`#precoTotal-${numeroDoFornecedor}-${linhaQuantidade}`);

                let valorEstoque = Number(document.querySelector(`#estoque-${linhaQuantidade}`).value) || 0

                quantidadeAtual -= valorEstoque

                precoTotalAtual.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`;

                decidirMelhorOferta(linhaQuantidade);

            });

            inputQuantidade.addEventListener("input", () => {

                let quantidadeAtual = Number(document.querySelector(`#quantidade-${linhaQuantidade}`).value) || 0;

                let precoUnitarioAtual = Number(document.querySelector(`#precoUnitario-${numeroDoFornecedor}-${linhaQuantidade}`).value) || 0;

                let precoTotalAtual = document.querySelector(`#precoTotal-${numeroDoFornecedor}-${linhaQuantidade}`);

                let valorEstoque = Number(document.querySelector(`#estoque-${linhaQuantidade}`).value) || 0

                quantidadeAtual -= valorEstoque

                precoTotalAtual.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`;

                decidirMelhorOferta(linhaQuantidade);

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

                let quantidadeAtual = Number(document.querySelector(`#quantidade-${linhaQuantidade}`).value) || 0;

                let precoUnitarioAtual = Number(document.querySelector(`#precoUnitario-${numeroDoFornecedor}-${linhaQuantidade}`).value) || 0;

                let precoTotalAtual = document.querySelector(`#precoTotal-${numeroDoFornecedor}-${linhaQuantidade}`);

                let valorEstoque = Number(document.querySelector(`#estoque-${linhaQuantidade}`).value) || 0

                quantidadeAtual -= valorEstoque

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

    // Verifica se o contêiner global de sugestões já existe, senão cria
    let sugestoes = document.getElementById("autocomplete-container");
    if (!sugestoes) {
        sugestoes = document.createElement("div");
        sugestoes.id = "autocomplete-container";
        sugestoes.style.position = "absolute";
        sugestoes.style.zIndex = "1000";
        document.body.appendChild(sugestoes);
    }

    sugestoes.innerHTML = ""; // Limpa as sugestões anteriores

    if (!valor) {
        sugestoes.style.display = "none"; // Oculta se o valor estiver vazio
        return;
    }

    // Filtra os itens baseados no texto digitado, usando includes em partnumber e descricao
    const itensFiltrados = Object.values(listaMateriais)
        .filter(item =>
            (item.partnumber && item.partnumber.toLowerCase().includes(valor)) ||
            (item.descricao && item.descricao.toLowerCase().includes(valor))
        )
        .sort((a, b) => a.partnumber.localeCompare(b.partnumber)); // Opcional: ordena os resultados

    if (itensFiltrados.length === 0) {
        sugestoes.style.display = "none"; // Oculta se não houver resultados
        return;
    }

    itensFiltrados.forEach(item => {
        const sugestao = document.createElement("div");
        sugestao.textContent = `${item.descricao} (${item.partnumber})`; // Mostra o nome e o partnumber
        sugestao.style.padding = "8px";
        sugestao.style.cursor = "pointer";
        sugestao.style.backgroundColor = "#fff";
        sugestao.style.borderBottom = "1px solid #ccc";

        sugestao.onclick = () => {
            input.value = item.descricao; // Preenche o campo com o nome do item
            partnumberCell.querySelector("input").value = item.partnumber || ""; // Preenche o partnumber correspondente
            estoqueCell.querySelector("input").value = item.estoque ?? 0; // Preenche o estoque
            sugestoes.style.display = "none"; // Oculta após seleção
        };

        sugestoes.appendChild(sugestao);
    });

    // Define a posição do contêiner em relação ao input
    const rect = input.getBoundingClientRect();
    sugestoes.style.left = `${rect.left}px`;
    sugestoes.style.top = `${rect.bottom + window.scrollY}px`;
    sugestoes.style.width = `${rect.width}px`;
    sugestoes.style.display = "block"; // Exibe as sugestões
}


let nomeFornecedor = "";

function abrirModal() {
    const modal = document.getElementById("fornecedorModal");
    modal.style.display = "block";

    const input = document.getElementById("pesquisarFornecedor");
    if (input) {
        input.addEventListener("input", () => filtroFornecedores());
    } else {
        console.error("Elemento com id='pesquisarFornecedor' não encontrado.");
    }
}

function abrirModalFinalizar(){



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

        const ultimoNumeroItem = obterUltimoNumeroItem();

        // Percorre cada linha existente na tabela para criar os inputs necessários
        for (let linhaAtualQuantidade = 1; linhaAtualQuantidade <= ultimoNumeroItem; linhaAtualQuantidade++) {
            let tdPrecoUnitario = document.createElement("td");
            let inputPrecoUnitario = document.createElement("input");
            inputPrecoUnitario.type = "number";
            inputPrecoUnitario.placeholder = "Digite o preço unitário";
            inputPrecoUnitario.id = `precoUnitario-${quantidadeFornecedores}-${linhaAtualQuantidade}`;

            let inputQuantidade = document.querySelector(`#quantidade-${linhaAtualQuantidade}`);

            if (inputQuantidade) {

                let linhaQuantidade = linhaAtualQuantidade;
                let numeroDoFornecedor = quantidadeFornecedores;

                inputQuantidade.addEventListener("input", () => {

                    let quantidadeAtual = Number(document.querySelector(`#quantidade-${linhaQuantidade}`).value) || 0;

                    let precoUnitarioAtual = Number(document.querySelector(`#precoUnitario-${numeroDoFornecedor}-${linhaQuantidade}`).value) || 0;

                    let precoTotalAtual = document.querySelector(`#precoTotal-${numeroDoFornecedor}-${linhaQuantidade}`);

                    let valorEstoque = Number(document.querySelector(`#estoque-${linhaQuantidade}`).value) || 0

                    quantidadeAtual -= valorEstoque

                    precoTotalAtual.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`;

                    decidirMelhorOferta(linhaQuantidade);

                });

                inputPrecoUnitario.addEventListener("input", () => {

                    let quantidadeAtual = Number(document.querySelector(`#quantidade-${linhaQuantidade}`).value) || 0;

                    let precoUnitarioAtual = Number(document.querySelector(`#precoUnitario-${numeroDoFornecedor}-${linhaQuantidade}`).value) || 0;

                    let precoTotalAtual = document.querySelector(`#precoTotal-${numeroDoFornecedor}-${linhaQuantidade}`);

                    let valorEstoque = Number(document.querySelector(`#estoque-${linhaQuantidade}`).value) || 0

                    quantidadeAtual -= valorEstoque

                    precoTotalAtual.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`;

                    decidirMelhorOferta(linhaQuantidade);

                });

                tdPrecoUnitario.appendChild(inputPrecoUnitario);

                let inputEstoque = document.querySelector(`#estoque-${linhaAtualQuantidade}`)

                console.log(inputEstoque)

                inputEstoque.addEventListener("input", () => {

                    let quantidadeAtual = Number(document.querySelector(`#quantidade-${linhaQuantidade}`).value) || 0;

                    let precoUnitarioAtual = Number(document.querySelector(`#precoUnitario-${numeroDoFornecedor}-${linhaQuantidade}`).value) || 0;

                    let precoTotalAtual = document.querySelector(`#precoTotal-${numeroDoFornecedor}-${linhaQuantidade}`);

                    let valorEstoque = Number(document.querySelector(`#estoque-${linhaQuantidade}`).value) || 0

                    quantidadeAtual -= valorEstoque

                    precoTotalAtual.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`;

                    decidirMelhorOferta(linhaQuantidade);

                });

                let tdPrecototal = document.createElement("td");
                let inputPrecoTotal = document.createElement("input");
                inputPrecoTotal.type = "text";
                inputPrecoTotal.readOnly = "true";
                inputPrecoTotal.value = "R$ 0,00"

                inputPrecoTotal.id = `precoTotal-${quantidadeFornecedores}-${linhaAtualQuantidade}`;

                inputPrecoTotal.classList.add(`resultadoPrecoTotal-linha-${linhaAtualQuantidade}`);
                inputPrecoTotal.classList.add(`resultadoPrecoTotal-fornecedor-${quantidadeFornecedores}`);

                tdPrecototal.append(inputPrecoTotal);

                // Adiciona os novos inputs na linha correspondente
                let linhaParaAdicionar = document.querySelector(`#linha-${linhaAtualQuantidade}`);
                linhaParaAdicionar.append(tdPrecoUnitario, tdPrecototal);
            }

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

const obterUltimoNumeroItem = () => {
    const elementosNumeroItem = document.querySelectorAll('td:nth-child(2)'); // Segunda coluna (Número do Item)
    let maiorNumero = 0;

    elementosNumeroItem.forEach((elemento) => {
        const numero = parseInt(elemento.textContent.trim(), 10); // Converte para inteiro
        if (!isNaN(numero) && numero > maiorNumero) {
            maiorNumero = numero;
        }
    });

    return maiorNumero; // Retorna o maior número encontrado
};

function decidirMelhorOferta(linha_quantidade) {

    let listaValores = document.querySelectorAll(`input.resultadoPrecoTotal-linha-${linha_quantidade}`)

    menorValor = descobrirMenorValor(listaValores)

    estilizarMelhorPreco(listaValores, menorValor)

}

function adiconarFooter() {

    let linhaDesconto = document.querySelector("#linhaDesconto")

    let linhaSubtotal = document.querySelector("#linhaSubtotal")

    let linhaFrete = document.querySelector("#linhaFrete")

    let linhaCondicaoPagar = document.querySelector("#linhaCondicaoPagar")

    let linhaTotal = document.querySelector("#linhaTotal")

    let tdDesconto = document.createElement("td")
    let selectDesconto = document.createElement("select")

    selectDesconto.id = `selectDesconto-${quantidadeFornecedores}`

    let optionPorcentagem = document.createElement("option")
    optionPorcentagem.value = "porcentagem"
    optionPorcentagem.textContent = "Porcentagem"

    let optionValorFixo = document.createElement("option")
    optionValorFixo.value = "valorFixo"
    optionValorFixo.textContent = "Valor Fixo"

    selectDesconto.append(optionPorcentagem, optionValorFixo)

    tdDesconto.appendChild(selectDesconto)

    let inputDesconto = document.createElement("input")

    inputDesconto.id = `input-desconto-${quantidadeFornecedores}`
    tdDesconto.colSpan = "2"
    inputDesconto.placeholder = "Digite a % do Desconto"
    inputDesconto.type = 'number'

    let numeroFornecedorDesconto = inputDesconto.id[15]

    inputDesconto.addEventListener('input', () => calculoSubtotal(numeroFornecedorDesconto))
    inputDesconto.addEventListener('input', () => calculoTotal(numeroFornecedorDesconto))

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

function calculoSubtotal(numeroFornecedor) {

    let tdSubtotal = document.querySelector(`#input-subtotal-${numeroFornecedor}`)

    let inputsSubtotal = document.querySelectorAll(".inputs-subtotal")

    let quantidadeDesconto = document.querySelector(`#input-desconto-${numeroFornecedor}`).value

    let valorSubtotal = 0

    let listaValores = document.querySelectorAll(`input.resultadoPrecoTotal-fornecedor-${numeroFornecedor}`)

    for (valor of listaValores) {

        valorReal = valor.value

        valorReal = parseFloat(valorReal.slice(3))

        valorSubtotal += valorReal

    }

    let valorDesconto = 0

    let selectDesconto = document.querySelector(`#selectDesconto-${numeroFornecedor}`)

    if (selectDesconto.value == "porcentagem") {

        valorDesconto = valorSubtotal * (quantidadeDesconto / 100)

    } else if (selectDesconto.value == "valorFixo") {

        valorDesconto = quantidadeDesconto

    }

    tdSubtotal.value = `R$ ${(valorSubtotal - valorDesconto).toFixed(2)}`

    let menorValor = descobrirMenorValor(inputsSubtotal)

    estilizarMelhorPreco(inputsSubtotal, menorValor)

}

function calculoTotal(numeroFornecedor) {
    let inputsTotal = document.querySelectorAll(".inputs-total");

    // Obtém o valor do input de frete e substitui vírgulas por pontos
    let tdFreteRaw = document.querySelector(`#input-frete-${numeroFornecedor}`).value;
    let tdFrete = parseFloat(tdFreteRaw.replace(",", ".") || "0"); // Substitui vírgulas e converte para número

    let tdSubtotal = parseFloat(document.querySelector(`#input-subtotal-${numeroFornecedor}`).value.slice(3)) || 0;

    let inputTotal = document.querySelector(`#input-total-${numeroFornecedor}`);
    inputTotal.value = `R$ ${(tdSubtotal + tdFrete).toFixed(2)}`; // Calcula e formata o total

    let menorValor = descobrirMenorValor(inputsTotal); // Descobre o menor valor
    estilizarMelhorPreco(inputsTotal, menorValor); // Estiliza os preços totais
}

function estilizarMelhorPreco(listaValores, menorValor) {

    for (valor of listaValores) {

        valorReal = valor.value

        valorReal = parseFloat(valorReal.slice(3))

        if (menorValor == valorReal) {

            valor.parentElement.style.backgroundColor = "#00ff37"
            valor.style.backgroundColor = "#00ff37"


        } else {

            valor.parentElement.style.backgroundColor = "white"
            valor.style.backgroundColor = "white"

        }

    }

}

function descobrirMenorValor(listaValores) {

    let menorValor = Infinity

    for (valor of listaValores) {

        valorReal = valor.value

        valorReal = parseFloat(valorReal.slice(3))

        if (valorReal < menorValor) {

            menorValor = valorReal

        }

    }

    return menorValor

}

async function carregarFornecedores() {

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

        return
    };

    const fornecedores = await carregarFornecedores();

    const resultados = fornecedores.filter(fornecedor => {

        if (fornecedor.nome && fornecedor.cnpj) {

            return fornecedor.nome.toLowerCase().includes(termo) || fornecedor.cnpj.includes(termo)

        } else if (fornecedor.nome) {

            return fornecedor.nome.toLowerCase().includes(termo)

        } else if (fornecedor.cnpj) {

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

function salvarObjeto(finalizar = false, reabrir = false) {
    const informacoes = salvarInformacoes();
    const dados = salvarDados();
    const valorFinal = salvarValorFinal();
    const operacao = localStorage.getItem("operacao");

    // Define o status corretamente
    let status = "Pendente";
    if (finalizar) status = "Finalizada";
    if (reabrir) status = "Pendente"; // Garante que ao reabrir, o status seja Pendente

    const novaCotacao = { informacoes, dados, valorFinal, operacao, status };

    // Envia a nova cotação para a API
    const payload = {
        tabela: "cotacoes",
        cotacao: novaCotacao,
    };

    enviar_dados_generico(payload);

    // Exibe mensagem de sucesso
    const aviso = document.getElementById("salvarAviso");
    aviso.style.display = "block";
    setTimeout(() => (aviso.style.display = "none"), 3000);

    console.log(`Cotação ${finalizar ? "Finalizada" : reabrir ? "Reaberta" : "Salva"}:`, informacoes.apelidoCotacao);

    // Atualiza os botões corretamente
    atualizarBotoesFinalizarReabrir(status);

    // Exibe o botão de exportar PDF
    const botaoPDF = document.getElementById("botaoExportarPDF");
    botaoPDF.style.display = "inline-block";

    // Atualiza a tabela com os novos dados
    fecharModalApelido();
    fecharModalFinalizar()
    fecharModalReabrir()
    carregarCotacoesSalvas();
}


// Função para salvar as informações gerais (id, data, hora, criador)
function salvarInformacoes() {
    const operacao = localStorage.getItem("operacao");
    const cotacoes = JSON.parse(localStorage.getItem("dados_cotacao")) || {};
    const id = localStorage.getItem("cotacaoEditandoID");

    let informacoes = {};
    if (operacao === "editar" && cotacoes[id]) {
        // Reaproveita as informações existentes para edições
        informacoes = cotacoes[id].informacoes;
    } else {
        // Geração de novas informações no caso de inclusão
        const now = new Date();
        const dia = String(now.getDate()).padStart(2, "0");
        const mes = String(now.getMonth() + 1).padStart(2, "0");
        const ano = now.getFullYear();
        const horas = String(now.getHours()).padStart(2, "0");
        const minutos = String(now.getMinutes()).padStart(2, "0");
        const segundos = String(now.getSeconds()).padStart(2, "0");
        const idOrcamento = ""
        const chavePedido = ""

        const dataFormatada = `${dia}/${mes}/${ano}`;
        const horaFormatada = `${horas}:${minutos}:${segundos}`;

        const apelidoCotacao = document.getElementById("inputApelido").value;

        // Obter o criador do localStorage
        const acesso = JSON.parse(localStorage.getItem("acesso"));
        const criador = acesso?.usuario || "Desconhecido";

        informacoes = {
            id: unicoID(),
            data: dataFormatada,
            hora: horaFormatada,
            criador,
            apelidoCotacao,
            idOrcamento,
            chavePedido,
        };
    }

    // Atualiza o apelido apenas se for modificado
    const novoApelido = document.getElementById("inputApelido").value;
    if (novoApelido) {
        informacoes.apelidoCotacao = novoApelido;
    }

    return informacoes;
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

function abrirModalApelido() {
    const modal = document.getElementById("modalApelido");
    const input = document.getElementById("inputApelido");
    const operacao = localStorage.getItem("operacao");

    // Exibe o modal
    modal.style.display = "block";

    // Se a operação for "editar", preenche o apelido com o valor atual
    if (operacao === "editar") {
        const cotacoes = JSON.parse(localStorage.getItem("dados_cotacao")) || {};
        const cotacaoEditandoID = localStorage.getItem("cotacaoEditandoID");
        const cotacaoAtual = cotacoes[cotacaoEditandoID];

        console.log(cotacaoAtual)

        if (cotacaoAtual && cotacaoAtual.informacoes.apelidoCotacao) {
            input.value = cotacaoAtual.informacoes.apelidoCotacao;
        } else {
            input.value = ""; // Deixa em branco caso não tenha apelido
        }
    } else {
        input.value = ""; // Limpa o campo se for uma nova cotação
    }
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

    // Verifica se há cotações
    if (Object.keys(cotacoes).length === 0) {
        const linhaMensagem = document.createElement("tr");
        const celulaMensagem = document.createElement("td");
        celulaMensagem.colSpan = 6; // Número de colunas na tabela
        celulaMensagem.textContent = "Não existem cotações disponíveis.";
        celulaMensagem.style.textAlign = "center"; // Centraliza a mensagem
        celulaMensagem.style.color = "gray"; // Adiciona uma cor para destaque
        linhaMensagem.appendChild(celulaMensagem);
        tabelaBody.appendChild(linhaMensagem);
        return;
    }

    // Transforma as cotações em um array e ordena pela data e hora
    const cotacoesOrdenadas = Object.entries(cotacoes).sort((a, b) => {
        const dataA = new Date(`${a[1].informacoes.data.split('/').reverse().join('-')}T${a[1].informacoes.hora}`);
        const dataB = new Date(`${b[1].informacoes.data.split('/').reverse().join('-')}T${b[1].informacoes.hora}`);
        return dataB - dataA; // Ordem decrescente (mais recente primeiro)
    });

    // Popula a tabela com as cotações ordenadas
    cotacoesOrdenadas.forEach(([id, cotacao]) => {
        const linha = document.createElement("tr");

        linha.innerHTML = `
            <td>${cotacao.informacoes.apelidoCotacao || 'Sem Apelido'}</td>
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

    // Exibe a mensagem "Cotações Carregadas e Ordenadas!"
    const mensagemDiv = document.getElementById("mensagemCargasOrdenadas");
    if (mensagemDiv) {
        mensagemDiv.textContent = "Cotações Carregadas e Ordenadas!";
        mensagemDiv.style.display = "block";

        setTimeout(() => {
            mensagemDiv.style.display = "none";
        }, 5000);
    } else {
        console.warn("Elemento mensagemCargasOrdenadas não encontrado.");
    }
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

    console.log(cotacao.status)

    // Atualiza os botões de Finalizar/Reabrir com base no status da cotação
    setTimeout(() => {
        atualizarBotoesFinalizarReabrir(cotacao.status);
    }, 100); // Pequeno delay para garantir atualização

    console.log(`Cotação editada: ID ${id}, Status: ${cotacao.status}`);

    // Atualiza o valor de "Quantidade de Itens"
    atualizarQuantidadeItens();

    const tabela = document.getElementById("cotacaoTable").querySelector("tbody");
    const linhas = tabela.children;

    for (let i = 0; i < linhas.length; i++) {
        const numeroItem = linhas[i].querySelector("td:nth-child(2)").textContent;
        decidirMelhorOferta(numeroItem);
    }

    // Estiliza os subtotais e totais do footer
    const inputsSubtotal = document.querySelectorAll(".inputs-subtotal");
    const inputsTotal = document.querySelectorAll(".inputs-total");

    const menorSubtotal = descobrirMenorValor(inputsSubtotal);
    const menorTotal = descobrirMenorValor(inputsTotal);

    estilizarMelhorPreco(inputsSubtotal, menorSubtotal);
    estilizarMelhorPreco(inputsTotal, menorTotal);

    // Exibe a tela de edição
    document.getElementById("cotacoesSalvasContainer").style.display = "none";
    document.getElementById("novaCotacaoContainer").style.display = "block";

    // Exibe o botão de exportar PDF
    const botaoPDF = document.getElementById("botaoExportarPDF");
    botaoPDF.style.display = "inline-block";

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
    inputNomeItem.oninput = () => mostrarSugestoes(inputNomeItem, tdPartnumber, tdEstoque);
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
        let quantidadeAtual = Number(inputQuantidade.value) || 0;

        // Atualizar todos os preços totais relacionados a este item
        dado.fornecedores.forEach((fornecedor, index) => {

            const precoUnitarioInput = document.querySelector(`#precoUnitario-${index + 1}-${dado.numeroItem}`);
            const precoTotalInput = document.querySelector(`#precoTotal-${index + 1}-${dado.numeroItem}`);

            if (precoUnitarioInput && precoTotalInput) {

                const precoUnitarioAtual = Number(precoUnitarioInput.value) || 0;

                let valorEstoque = Number(document.querySelector(`#estoque-${dado.numeroItem}`).value) || 0

                quantidadeAtual -= valorEstoque

                precoTotalInput.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`;

            }

            decidirMelhorOferta(dado.numeroItem);

        });

    });

    tdQuantidade.appendChild(inputQuantidade);

    const tdEstoque = document.createElement("td");
    const inputEstoque = document.createElement("input");

    inputEstoque.setAttribute("value", `${dado.estoque}`);
    inputEstoque.id = `estoque-${dado.numeroItem}`

    inputEstoque.addEventListener("input", () => {
        let quantidadeAtual = Number(inputQuantidade.value) || 0;

        // Atualizar todos os preços totais relacionados a este item
        dado.fornecedores.forEach((fornecedor, index) => {

            const precoUnitarioInput = document.querySelector(`#precoUnitario-${index + 1}-${dado.numeroItem}`);
            const precoTotalInput = document.querySelector(`#precoTotal-${index + 1}-${dado.numeroItem}`);

            if (precoUnitarioInput && precoTotalInput) {

                const precoUnitarioAtual = Number(precoUnitarioInput.value) || 0;

                let valorEstoque = Number(document.querySelector(`#estoque-${dado.numeroItem}`).value) || 0

                quantidadeAtual -= valorEstoque

                precoTotalInput.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`;

            }

            decidirMelhorOferta(dado.numeroItem);

        });

    });

    tdEstoque.appendChild(inputEstoque);

    novaLinha.append(tdRemover, tdNumeroItem, tdPartnumber, tdNomeItem, tdTipoUnitario, tdQuantidade, tdEstoque);

    if (dado.fornecedores.length > 0) {
        adicionarPrecoUnitarioPrecoTotal(dado.fornecedores, novaLinha, dado.numeroItem);
    }

    tabela.appendChild(novaLinha);
}

function adicionarNomeFornecedores(dado) {
    const linhaCountRow = document.querySelector(".count-row");
    const linhaTopicosTabela = document.querySelector("#topicos-tabela");

    const thTitulofornecedor = document.createElement("th");
    thTitulofornecedor.setAttribute("colspan", "2");

    // Criar o container do nome e do ícone de exclusão
    const containerFornecedor = document.createElement("div");
    containerFornecedor.style.display = "flex";
    containerFornecedor.style.alignItems = "center";
    containerFornecedor.style.justifyContent = "center"; // Centraliza o conteúdo
    containerFornecedor.style.gap = "8px"; // Espaçamento entre o nome e o botão de exclusão

    // Nome do fornecedor
    const nomeFornecedor = document.createElement("span");
    nomeFornecedor.textContent = dado.nome;
    nomeFornecedor.style.textAlign = "center"; // Garante o alinhamento do texto
    containerFornecedor.appendChild(nomeFornecedor);

    // Botão de exclusão
    const imgExcluir = document.createElement("img");
    imgExcluir.src = "imagens/excluir.png";
    imgExcluir.alt = "Excluir Fornecedor";
    imgExcluir.style.cursor = "pointer";
    imgExcluir.style.width = "16px"; // Tamanho do ícone
    imgExcluir.style.height = "16px";
    imgExcluir.onclick = () => excluirFornecedor(dado.nome); // Evento de exclusão
    containerFornecedor.appendChild(imgExcluir);

    thTitulofornecedor.appendChild(containerFornecedor);
    linhaCountRow.appendChild(thTitulofornecedor);

    // Adicionar as colunas de preço unitário e preço total
    const thPrecoUnitario = document.createElement("th");
    thPrecoUnitario.textContent = "Preço Unitário";

    const thPrecoTotal = document.createElement("th");
    thPrecoTotal.textContent = "Preço Total";

    linhaTopicosTabela.append(thPrecoUnitario, thPrecoTotal);
}


function excluirFornecedor(nomeFornecedor) {
    const linhaCountRow = document.querySelector(".count-row");
    const linhaTopicosTabela = document.querySelector("#topicos-tabela");
    const linhasTabela = document.querySelectorAll("#cotacaoTable tbody tr");

    // Encontrar o índice do fornecedor
    const headers = Array.from(linhaCountRow.children);
    const indiceFornecedor = headers.findIndex((th) =>
        th.textContent.trim().includes(nomeFornecedor)
    );

    if (indiceFornecedor === -1) {
        console.error("Fornecedor não encontrado:", nomeFornecedor);
        return;
    }

    // Remover o cabeçalho do fornecedor
    linhaCountRow.removeChild(headers[indiceFornecedor]);

    // Remover as colunas de preço unitário e preço total da linha de tópicos
    const thsTopicos = linhaTopicosTabela.querySelectorAll("th");
    linhaTopicosTabela.removeChild(thsTopicos[indiceFornecedor * 2 - 1]); // Preço Unitário
    linhaTopicosTabela.removeChild(thsTopicos[indiceFornecedor * 2]); // Preço Total

    // Remover as células correspondentes em cada linha da tabela de itens
    linhasTabela.forEach((linha) => {
        const celulas = linha.querySelectorAll("td");
        linha.removeChild(celulas[indiceFornecedor * 2 - 1]); // Preço Unitário
        linha.removeChild(celulas[indiceFornecedor * 2]); // Preço Total
    });

    // Remover os valores finais do rodapé
    ["#linhaDesconto", "#linhaSubtotal", "#linhaFrete", "#linhaCondicaoPagar", "#linhaTotal"].forEach((linhaId) => {
        const linhaRodape = document.querySelector(linhaId);
        const celulasRodape = linhaRodape.querySelectorAll("td");
        linhaRodape.removeChild(celulasRodape[indiceFornecedor - 1]);
    });

    // Atualizar a lista de fornecedores no localStorage
    const cotacoes = JSON.parse(localStorage.getItem("dados_cotacao")) || {};
    const idCotacao = localStorage.getItem("cotacaoEditandoID");

    if (cotacoes[idCotacao]) {
        cotacoes[idCotacao].dados.forEach((dado) => {
            dado.fornecedores = dado.fornecedores.filter((f) => f.nome !== nomeFornecedor);
        });
        cotacoes[idCotacao].valorFinal = cotacoes[idCotacao].valorFinal.filter((f) => f.nome !== nomeFornecedor);
        localStorage.setItem("dados_cotacao", JSON.stringify(cotacoes));
    }

    console.log(`Fornecedor "${nomeFornecedor}" excluído com sucesso.`);

    // Verificar se ainda há fornecedores e atualizar o cabeçalho
    verificarFornecedores();
}

function verificarFornecedores() {
    // Seleciona os cabeçalhos de fornecedores
    const headers = document.querySelectorAll(".count-row th");

    // Filtra apenas os fornecedores (ignorando células como "Ações" ou similares)
    const fornecedoresRestantes = Array.from(headers).filter(
        (header) =>
            header.querySelector("div") && // Certifica-se de que é um cabeçalho com fornecedor
            header.querySelector("div").querySelector("span")?.textContent.trim() !== ""
    );

    // Seleciona o elemento com ID fornecedoresHeader
    const fornecedoresHeader = document.getElementById("fornecedoresHeader");

    // Se não houver fornecedores restantes, oculta o cabeçalho
    if (fornecedoresRestantes.length === 0) {
        fornecedoresHeader.style.display = "none";
    } else {
        // Caso contrário, exibe o cabeçalho
        fornecedoresHeader.style.display = "table-cell";
    }
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

            let quantidadeAtual = Number(document.querySelector(`#quantidade-${numeroItem}`).value) || 0;

            const precoUnitarioAtual = Number(inputPrecoUnitario.value) || 0;

            console.log(document.querySelector(`#estoque-${numeroItem}`))

            let valorEstoque = Number(document.querySelector(`#estoque-${numeroItem}`).value) || 0

            quantidadeAtual -= valorEstoque

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
    if (linhaSelector == "#linhaDesconto") {

        input.addEventListener("input", () => calculoTotal(index));

        let selectDesconto = document.createElement("select")

        selectDesconto.id = `selectDesconto-${index}`

        let optionPorcentagem = document.createElement("option")
        optionPorcentagem.value = "porcentagem"
        optionPorcentagem.textContent = "Porcentagem"

        let optionValorFixo = document.createElement("option")
        optionValorFixo.value = "valorFixo"
        optionValorFixo.textContent = "Valor Fixo"

        selectDesconto.append(optionPorcentagem, optionValorFixo)

        td.appendChild(selectDesconto)

    }

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
        'https://script.google.com/macros/s/AKfycbxhsF99yBozPGOHJxsRlf9OEAXO_t8ne3Z2J6o0J58QXvbHhSA67cF3J6nIY7wtgHuN/exec?bloco=cotacoes'
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

async function removerCotacao(elemento) {
    // Adiciona a confirmação antes de prosseguir
    const confirmar = confirm("Tem certeza de que deseja excluir esta cotação?");
    if (!confirmar) {
        return; // Sai da função caso o usuário cancele
    }

    // Encontra a linha associada ao botão clicado
    const linha = elemento.parentElement.parentElement;

    // Obtém o ID da cotação a partir da célula oculta
    const idCotacao = linha.querySelector(".cotacao-id").textContent;

    // Remove a linha da tabela
    linha.remove();

    let status = "excluido";
    let operacao = "excluir";

    const cotacaoParaExcluir = { operacao, status, idCotacao };

    const payload = {
        tabela: "cotacoes",
        cotacao: cotacaoParaExcluir,
    };

    enviar_dados_generico(payload);


    // Remove a cotação do localStorage
    let cotacoes = JSON.parse(localStorage.getItem("dados_cotacao")) || {};

    let cotacaoAtual = cotacoes[idCotacao]

    const idOrcamento = cotacaoAtual.informacoes.idOrcamento || "";
    const chavePedido = cotacaoAtual.informacoes.chavePedido || "";


    if (idOrcamento != "" || chavePedido != "") {

        let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

        if (idCotacao == undefined || idCotacao == 'undefined') {

            delete dados_orcamentos[idOrcamento].status[chavePedido]
            await deletar(`dados_orcamentos/${id_orcam}/status/${chavePedido}`)

        } else {

            delete dados_orcamentos[idOrcamento].status[chavePedido].historico[idCotacao]
            await deletar(`dados_orcamentos/${idOrcamento}/status/${chavePedido}/historico/${idCotacao}`)

        }

        await enviar('PUT', `dados_orcamentos/${idOrcamento}/timestamp`, Date.now())
        await inserirDados(dados_orcamentos, 'dados_orcamentos')

    }

    delete cotacaoAtual;
    localStorage.setItem("dados_cotacao", JSON.stringify(cotacoes));

    // Verifica se ainda existem cotações
    if (Object.keys(cotacoes).length === 0) {
        const tabelaBody = document.getElementById("cotacoesSalvasTable").querySelector("tbody");
        tabelaBody.innerHTML = "";

        // Adiciona a mensagem de que não existem cotações
        const linhaMensagem = document.createElement("tr");
        const celulaMensagem = document.createElement("td");
        celulaMensagem.colSpan = 6; // Número de colunas na tabela
        celulaMensagem.textContent = "Não existem cotações disponíveis.";
        celulaMensagem.style.textAlign = "center"; // Centraliza a mensagem
        celulaMensagem.style.color = "gray"; // Adiciona uma cor para destaque
        linhaMensagem.appendChild(celulaMensagem);
        tabelaBody.appendChild(linhaMensagem);
    }

    console.log(`Cotação removida com ID: ${idCotacao}`);
}


let ordemAtual = {
    coluna: null,
    ordem: 'asc' // 'asc' para crescente, 'desc' para decrescente
};

function ordenarTabela(coluna) {
    const tabelaBody = document.getElementById("cotacoesSalvasTable").querySelector("tbody");
    const cotacoes = JSON.parse(localStorage.getItem("dados_cotacao")) || {};

    // Alterna a ordem de ordenação
    if (ordemAtual.coluna === coluna) {
        ordemAtual.ordem = ordemAtual.ordem === 'asc' ? 'desc' : 'asc';
    } else {
        ordemAtual.coluna = coluna;
        ordemAtual.ordem = 'asc';
    }

    // Converte as cotações para um array e ordena com base na coluna
    const cotacoesOrdenadas = Object.entries(cotacoes).sort((a, b) => {
        const cotacaoA = a[1];
        const cotacaoB = b[1];

        let valorA, valorB;

        switch (coluna) {
            case 'apelido':
                valorA = cotacaoA.informacoes.apelidoCotacao?.toLowerCase() || '';
                valorB = cotacaoB.informacoes.apelidoCotacao?.toLowerCase() || '';
                break;
            case 'data':
                valorA = new Date(
                    cotacaoA.informacoes.data.split('/').reverse().join('-') + 'T' + cotacaoA.informacoes.hora
                );
                valorB = new Date(
                    cotacaoB.informacoes.data.split('/').reverse().join('-') + 'T' + cotacaoB.informacoes.hora
                );
                break;
            case 'criador':
                valorA = cotacaoA.informacoes.criador.toLowerCase();
                valorB = cotacaoB.informacoes.criador.toLowerCase();
                break;
            case 'itens':
                valorA = cotacaoA.dados.length;
                valorB = cotacaoB.dados.length;
                break;
            case 'fornecedor': // Para a coluna de fornecedores
                valorA = cotacaoA.valorFinal.length;
                valorB = cotacaoB.valorFinal.length;
                break;
            default:
                return 0;
        }

        // Realiza a comparação
        const comparacao = valorA > valorB ? 1 : valorA < valorB ? -1 : 0;
        return ordemAtual.ordem === 'asc' ? comparacao : -comparacao;
    });

    // Atualiza a tabela com os dados ordenados
    tabelaBody.innerHTML = "";
    cotacoesOrdenadas.forEach(([id, cotacao]) => {
        const linha = document.createElement("tr");

        linha.innerHTML = `
            <td>${cotacao.informacoes.apelidoCotacao || 'Sem Apelido'}</td>
            <td>${cotacao.informacoes.data}</td>
            <td>${cotacao.informacoes.criador}</td>
            <td>${cotacao.dados.length}</td>
            <td>${cotacao.valorFinal.length}</td>
            <td>
                <img src="imagens/editar.png" alt="Editar" class="img-editar" onclick="editarCotacao('${id}')">
                <img src="imagens/excluir.png" alt="Excluir" class="img-excluir" onclick="removerCotacao(this)">
            </td>
            <td style="display:none;" class="cotacao-id">${id}</td>
        `;

        tabelaBody.appendChild(linha);
    });

    // Atualiza os ícones no cabeçalho
    atualizarIconesOrdenacao(coluna);
}


function atualizarIconesOrdenacao(coluna) {
    // Remove ícones existentes em todos os cabeçalhos
    const headers = document.querySelectorAll("th");
    headers.forEach(header => {
        header.classList.remove("ordenado");
        const iconeExistente = header.querySelector("span.ordem-icone");
        if (iconeExistente) {
            iconeExistente.remove();
        }
    });

    // Adiciona o ícone ao cabeçalho correspondente
    const header = document.getElementById(`${coluna}Header`);
    if (header) {
        header.classList.add("ordenado");

        const icone = document.createElement("span");
        icone.classList.add("ordem-icone");
        icone.textContent = ordemAtual.ordem === 'asc' ? '▲' : '▼';

        header.appendChild(icone);
    }
}




function filtrarTabela(colunaIndex, valorPesquisa) {
    const tabela = document.getElementById("cotacoesSalvasTable");
    const linhas = tabela.querySelectorAll("tbody tr");

    // Normaliza o valor de pesquisa (removendo espaços extras e transformando em minúsculas)
    const valorNormalizado = valorPesquisa.trim().toLowerCase();
    let encontrouResultados = false;

    // Percorre as linhas da tabela e exibe apenas as que correspondem à pesquisa
    linhas.forEach((linha) => {
        const celula = linha.cells[colunaIndex]; // Obtém a célula correspondente à coluna
        if (celula) {
            const textoCelula = celula.textContent.trim().toLowerCase();
            if (textoCelula.includes(valorNormalizado)) {
                linha.style.display = ""; // Exibe a linha se a pesquisa corresponder
                encontrouResultados = true;
            } else {
                linha.style.display = "none"; // Esconde a linha se não houver correspondência
            }
        }
    });

    const tabelaBody = tabela.querySelector("tbody");

    // Remove a mensagem de "não existem cotações disponíveis" se ela já existir
    const mensagemExistente = tabelaBody.querySelector("tr[data-mensagem]");
    if (mensagemExistente) {
        mensagemExistente.remove();
    }

    // Adiciona a mensagem se nenhuma linha corresponde à pesquisa
    if (!encontrouResultados) {
        const linhaMensagem = document.createElement("tr");
        const celulaMensagem = document.createElement("td");

        celulaMensagem.colSpan = tabela.querySelectorAll("thead th").length; // Número de colunas na tabela
        celulaMensagem.textContent = "Não existem cotações disponíveis.";
        celulaMensagem.style.textAlign = "center"; // Centraliza a mensagem
        celulaMensagem.style.color = "gray"; // Adiciona uma cor para destaque
        linhaMensagem.appendChild(celulaMensagem);

        // Adiciona um atributo para identificar a mensagem (facilitando a remoção posterior)
        linhaMensagem.setAttribute("data-mensagem", "true");
        tabelaBody.appendChild(linhaMensagem);
    }
}

function exportarTabelaParaPDF() {
    const idCotacao = localStorage.getItem("cotacaoEditandoID");
    const cotacoes = JSON.parse(localStorage.getItem("dados_cotacao")) || {};
    const cotacao = cotacoes[idCotacao];

    if (!cotacao) {
        console.error("Cotação não encontrada!");
        return;
    }

    const apelido = cotacao.informacoes.apelidoCotacao || "Sem Apelido";
    const dataCriacao = cotacao.informacoes.data || "Sem Data";
    const quantidadeItens = cotacao.dados.length || 0;
    const fornecedores = cotacao.valorFinal;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l', 'mm', 'a4'); // Orientação "landscape"

    const margemEsquerda = 10;
    const larguraMaximaTabela = 277;
    const alturaLinha = 6;
    const limiteAltura = 190;

    let posicaoAtualY = 20;

    // Adicionar título e logo
    pdf.addImage('imagens/LG.png', 'PNG', margemEsquerda, 5, 20, 15);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Mapa de Cotações', margemEsquerda + 25, 12);

    posicaoAtualY += 20;

    // Informações principais
    const linhas = [
        { label: 'Descrição', value: apelido, label2: 'Criação', value2: dataCriacao },
        { label: 'Qtde. de Itens', value: quantidadeItens, label2: 'Qtde. de Fornecedores', value2: fornecedores.length },
    ];

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');

    linhas.forEach((linha) => {
        pdf.rect(margemEsquerda, posicaoAtualY, larguraMaximaTabela / 2, alturaLinha);
        pdf.text(`${linha.label}: ${linha.value}`, margemEsquerda + 2, posicaoAtualY + 4);
        pdf.rect(margemEsquerda + larguraMaximaTabela / 2, posicaoAtualY, larguraMaximaTabela / 2, alturaLinha);
        pdf.text(`${linha.label2}: ${linha.value2}`, margemEsquerda + larguraMaximaTabela / 2 + 2, posicaoAtualY + 4);
        posicaoAtualY += alturaLinha;
    });

    posicaoAtualY += 10;

    // Configurar larguras das colunas
    const larguraColunas = fornecedores.length > 0
        ? {
            item: 60,
            unid: 25,
            qtde: 25,
            fornecedor: (larguraMaximaTabela - 110) / fornecedores.length,
        }
        : {
            item: larguraMaximaTabela * 0.5,
            unid: larguraMaximaTabela * 0.25,
            qtde: larguraMaximaTabela * 0.25,
        };

    pdf.setFontSize(8);

    // Cabeçalhos da tabela
    pdf.rect(margemEsquerda, posicaoAtualY, larguraColunas.item, alturaLinha * 2);
    pdf.text('Item', margemEsquerda + 2, posicaoAtualY + 4);

    pdf.rect(margemEsquerda + larguraColunas.item, posicaoAtualY, larguraColunas.unid, alturaLinha * 2);
    pdf.text('Unid.', margemEsquerda + larguraColunas.item + 2, posicaoAtualY + 4);

    pdf.rect(margemEsquerda + larguraColunas.item + larguraColunas.unid, posicaoAtualY, larguraColunas.qtde, alturaLinha * 2);
    pdf.text('Qtde.', margemEsquerda + larguraColunas.item + larguraColunas.unid + 2, posicaoAtualY + 4);

    let xPos = margemEsquerda + larguraColunas.item + larguraColunas.unid + larguraColunas.qtde;

    if (fornecedores.length > 0) {
        fornecedores.forEach((fornecedor) => {
            pdf.rect(xPos, posicaoAtualY, larguraColunas.fornecedor, alturaLinha);
            pdf.text(fornecedor.nome, xPos + 2, posicaoAtualY + 4);

            // Adicionar subcabeçalhos (Unit. e Total) com borda entre eles
            pdf.rect(xPos, posicaoAtualY + alturaLinha, larguraColunas.fornecedor / 2, alturaLinha);
            pdf.text('Unit.', xPos + 2, posicaoAtualY + alturaLinha + 4);

            pdf.rect(xPos + larguraColunas.fornecedor / 2, posicaoAtualY + alturaLinha, larguraColunas.fornecedor / 2, alturaLinha);
            pdf.text('Total', xPos + larguraColunas.fornecedor / 2 + 2, posicaoAtualY + alturaLinha + 4);

            xPos += larguraColunas.fornecedor;
        });
    }

    posicaoAtualY += alturaLinha * 2;

    // Adicionar itens com quebra de linha para nomes longos
    cotacao.dados.forEach((item, itemIndex) => {
        if (posicaoAtualY + alturaLinha > limiteAltura) {
            adicionarRodape(pdf);
            pdf.addPage();
            posicaoAtualY = 20;
        }

        xPos = margemEsquerda;

        // Nome do item com quebra de linha
        const linhasNomeItem = pdf.splitTextToSize(`${itemIndex + 1}. ${item.nomeItem}`, larguraColunas.item - 4);
        const alturaNomeItem = linhasNomeItem.length * alturaLinha;

        pdf.rect(xPos, posicaoAtualY, larguraColunas.item, alturaNomeItem);
        linhasNomeItem.forEach((linha, i) => {
            pdf.text(linha, xPos + 2, posicaoAtualY + 4 + (i * alturaLinha));
        });
        xPos += larguraColunas.item;

        pdf.rect(xPos, posicaoAtualY, larguraColunas.unid, alturaNomeItem);
        pdf.text(item.tipoUnitario, xPos + 2, posicaoAtualY + 4);
        xPos += larguraColunas.unid;

        pdf.rect(xPos, posicaoAtualY, larguraColunas.qtde, alturaNomeItem);
        pdf.text(item.quantidade.toString(), xPos + 2, posicaoAtualY + 4);
        xPos += larguraColunas.qtde;

        if (fornecedores.length > 0) {
            const precosTotais = item.fornecedores.map(f => parseFloat(f.precoTotal.slice(3).replace(',', '.')));
            const menorPreco = Math.min(...precosTotais);

            item.fornecedores.forEach((fornecedor) => {
                const precoTotal = parseFloat(fornecedor.precoTotal.slice(3).replace(',', '.'));

                // Adicionar borda entre "Unit." e "Total"
                pdf.rect(xPos, posicaoAtualY, larguraColunas.fornecedor / 2, alturaNomeItem);
                pdf.text(formatarParaReal(fornecedor.precoUnitario), xPos + 2, posicaoAtualY + 4);

                // Destacar apenas "Preço Total" com cor verde
                if (precoTotal === menorPreco) {
                    pdf.setFillColor(144, 238, 144); // Verde claro
                    pdf.rect(xPos + larguraColunas.fornecedor / 2, posicaoAtualY, larguraColunas.fornecedor / 2, alturaNomeItem, 'FD');
                } else {
                    pdf.rect(xPos + larguraColunas.fornecedor / 2, posicaoAtualY, larguraColunas.fornecedor / 2, alturaNomeItem);
                }
                pdf.text(formatarParaReal(fornecedor.precoTotal.slice(3)), xPos + larguraColunas.fornecedor / 2 + 2, posicaoAtualY + 4);

                xPos += larguraColunas.fornecedor;
            });
        }

        posicaoAtualY += alturaNomeItem;
    });

    // Adicionar rodapé apenas se houver fornecedores
    if (fornecedores.length > 0) {
        const rodapeLabels = [
            '(-) Desconto %',
            'Subtotal',
            '(+) Frete',
            'Condição de Pagamento',
            'Total',
        ];

        rodapeLabels.forEach((label) => {
            let xRodape = margemEsquerda;
            const colspanLargura = larguraColunas.item + larguraColunas.unid + larguraColunas.qtde;

            pdf.setFillColor(173, 216, 230); // Fundo azul
            pdf.rect(xRodape, posicaoAtualY, colspanLargura, alturaLinha, 'FD');
            pdf.setFont('helvetica', 'bold');
            pdf.text(label, xRodape + 2, posicaoAtualY + 4);

            xRodape += colspanLargura;

            const valores = fornecedores.map((fornecedor) => {
                if (label === 'Subtotal') {
                    return parseFloat(fornecedor.subtotal.slice(3).replace(',', '.')) || Infinity;
                } else if (label === 'Total') {
                    return parseFloat(fornecedor.valorTotal.slice(3).replace(',', '.')) || Infinity;
                }
                return Infinity;
            });

            const menorValor = Math.min(...valores);

            fornecedores.forEach((fornecedor, index) => {
                let texto = '-';
                if (label === '(-) Desconto %') {
                    texto = `${fornecedor.porcentagemDesconto || '0.00'}%`;
                } else if (label === 'Subtotal') {
                    texto = `${formatarParaReal(fornecedor.subtotal.slice(3)) || '0.00'}`;
                } else if (label === '(+) Frete') {
                    texto = `${formatarParaReal(fornecedor.valorFrete) || '0.00'}`;
                } else if (label === 'Condição de Pagamento') {
                    texto = fornecedor.condicaoPagar || 'N/A';
                } else if (label === 'Total') {
                    texto = `${formatarParaReal(fornecedor.valorTotal.slice(3)) || '0.00'}`;
                }

                if ((label === 'Subtotal' || label === 'Total') && valores[index] === menorValor) {
                    pdf.setFillColor(144, 238, 144); // Verde claro
                    pdf.rect(xRodape, posicaoAtualY, larguraColunas.fornecedor, alturaLinha, 'FD');
                } else {
                    pdf.rect(xRodape, posicaoAtualY, larguraColunas.fornecedor, alturaLinha);
                }

                pdf.text(texto, xRodape + 2, posicaoAtualY + 4);

                xRodape += larguraColunas.fornecedor;
            });

            posicaoAtualY += alturaLinha;
        });
    }

    adicionarRodape(pdf); // Adicionar rodapé na última página
    pdf.save(`cotacao-${apelido}.pdf`);
}


function adicionarRodape(pdf) {
    const agora = new Date();
    const data = agora.toLocaleDateString();
    const hora = agora.toLocaleTimeString();

    const larguraPagina = 297; // Largura da página A4 (em mm)
    const alturaRodape = 10; // Altura do rodapé
    const margemRodape = 10;

    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(0, 0, 0); // Texto preto para um tom mais forte

    const textoRodape = `Exportado em ${data} às ${hora}`;
    pdf.text(textoRodape, larguraPagina - margemRodape - pdf.getTextWidth(textoRodape), 210 - alturaRodape);
}

function formatarParaReal(valor) {
    if (!valor || isNaN(valor)) {
        return 'R$ 0,00';
    }
    return `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;
}

function voltarParaTabela() {
    const botaoPDF = document.getElementById("botaoExportarPDF");
    botaoPDF.style.display = "none"; // Oculta o botão
    f5();
}

function abrirModalFinalizar() {
    const modal = document.getElementById("modalConfirmarFinalizacao");
    modal.style.display = "block";
}

function fecharModalFinalizar() {
    const modal = document.getElementById("modalConfirmarFinalizacao");
    modal.style.display = "none";
}

function atualizarBotoesFinalizarReabrir(status) {
    const botaoFinalizar = document.getElementById("botaoFinalizarCotacao");
    const botaoReabrir = document.getElementById("botaoReabrirCotacao");

    if (status === "Finalizada") {
        botaoFinalizar.style.display = "none";
        botaoReabrir.style.display = "inline-block";
    } else {
        botaoFinalizar.style.display = "inline-block";
        botaoReabrir.style.display = "none";
    }

    console.log(`Botões atualizados: Finalizar(${botaoFinalizar.style.display}), Reabrir(${botaoReabrir.style.display})`);
}

function abrirModalReabrir() {
    const modal = document.getElementById("modalConfirmarReabertura");
    modal.style.display = "block";
}

function fecharModalReabrir() {
    const modal = document.getElementById("modalConfirmarReabertura");
    modal.style.display = "none";
}
