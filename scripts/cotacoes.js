let contador = 1;
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

    novaLinha.setAttribute("id",`linha-${contador}`)

    const acao = document.createElement("td");
    const removeImg = document.createElement("img");
    removeImg.src = "/imagens/remover.png";
    removeImg.alt = "Remover";
    removeImg.className = "remove-img";
    removeImg.onclick = () => {

        tabela.removeChild(novaLinha);
        atualizarQuantidadeItens();
        linhasAtuais = linhasAtuais.filter(item => item !== novaLinha)
    };

    acao.appendChild(removeImg);
    novaLinha.appendChild(acao);

    const numeroItem = document.createElement("td");
    numeroItem.textContent = contador++;
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
    inputQuantidade.id = `quantidade-${contador - 1}`
    quantidade.appendChild(inputQuantidade);
    novaLinha.appendChild(quantidade);

    const estoque = document.createElement("td");
    const inputEstoque = document.createElement("input");
    inputEstoque.type = "text";
    inputEstoque.readOnly = true;
    estoque.appendChild(inputEstoque);
    novaLinha.appendChild(estoque);

    linhasAtuais.push(novaLinha)
    
    if(fornecedoresHeader.style.display == "table-cell"){

        let linhaAtualQuantidade = inputQuantidade.id[11]

        for(let i = 1; i <= quantidadeFornecedores; i++){

            let tdPrecoUnitario = document.createElement("td")
            let inputPrecoUnitario = document.createElement("input")
            inputPrecoUnitario.type = "number"
            inputPrecoUnitario.placeholder = "Digite o preço unitário"
            inputPrecoUnitario.id = `precoUnitario-${i}-${linhaAtualQuantidade}`

            let linhaQuantidade = inputPrecoUnitario.id[16]
            let numeroDoFornecedor = inputPrecoUnitario.id[14]
            
            inputQuantidade.addEventListener('input', () =>{
                
                let quantidadeAtual = Number(document.querySelector(`#quantidade-${linhaQuantidade}`).value) || 0
                let precoUnitarioAtual = Number(document.querySelector(`#precoUnitario-${numeroDoFornecedor}-${linhaQuantidade}`).value) || 0
                let precoTotalAtual = document.querySelector(`#precoTotal-${numeroDoFornecedor}-${linhaQuantidade}`)

                precoTotalAtual.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`

            })
            
            tdPrecoUnitario.appendChild(inputPrecoUnitario)
            
            let tdPrecototal = document.createElement("td")
            let inputPrecoTotal = document.createElement("input")
            inputPrecoTotal.type = 'text'
            inputPrecoTotal.readOnly = "true"
            
            inputPrecoTotal.id = `precoTotal-${i}-${linhaAtualQuantidade}`

            inputPrecoTotal.classList.add(`resultadoPrecoTotal-linha-${linhaAtualQuantidade}`)
            inputPrecoTotal.classList.add(`resultadoPrecoTotal-fornecedor-${i}`)
            
            tdPrecototal.appendChild(inputPrecoTotal)
            
            inputPrecoUnitario.addEventListener('input', () =>{
                
                let quantidadeAtual = Number(document.querySelector(`#quantidade-${linhaQuantidade}`).value) || 0
                let precoUnitarioAtual = Number(document.querySelector(`#precoUnitario-${numeroDoFornecedor}-${linhaQuantidade}`).value) || 0
                let precoTotalAtual = document.querySelector(`#precoTotal-${numeroDoFornecedor}-${linhaQuantidade}`)

                precoTotalAtual.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`

                decidirMelhorOferta(linhaQuantidade)

            })

            novaLinha.append(tdPrecoUnitario, tdPrecototal)

        }
        
        
    }

    tabela.appendChild(novaLinha)

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

    quantidadeFornecedores++;

    const input = document.getElementById("pesquisarFornecedor");
    const trNomeFornecedor = document.querySelector(".count-row")
    const thNomeFornecedor = document.createElement("th")
    const trTopicostabela = document.querySelector("#topicos-tabela")
    const thPrecoUnitario = document.createElement("th")
    const thPrecoTotal = document.createElement("th")

    thPrecoUnitario.textContent = "Preço Unitário"
    thPrecoTotal.textContent = "Preço Total"

    thNomeFornecedor.colSpan = "2"

    if (input.value.trim() !== "") {
        nomeFornecedor = input.value.trim();
        alert(`Fornecedor "${nomeFornecedor}" foi adicionado com sucesso!`);

        let linhaAtualQuantidade = 1

        for(linha of linhasAtuais){

            let tdPrecoUnitario = document.createElement("td")
            let inputPrecoUnitario = document.createElement("input")
            inputPrecoUnitario.type = "number"
            inputPrecoUnitario.placeholder = "Digite o preço unitário"
            inputPrecoUnitario.id = `precoUnitario-${quantidadeFornecedores}-${linhaAtualQuantidade}`

            let inputQuantidade = document.querySelector(`#quantidade-${linhaAtualQuantidade}`)

            let linhaQuantidade = inputPrecoUnitario.id[16]
            let numeroDoFornecedor = inputPrecoUnitario.id[14]

            inputQuantidade.addEventListener('input', () =>{
                
                let quantidadeAtual = Number(document.querySelector(`#quantidade-${linhaQuantidade}`).value) || 0
                let precoUnitarioAtual = Number(document.querySelector(`#precoUnitario-${numeroDoFornecedor}-${linhaQuantidade}`).value) || 0
                let precoTotalAtual = document.querySelector(`#precoTotal-${numeroDoFornecedor}-${linhaQuantidade}`)

                precoTotalAtual.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`

            })
            
            inputPrecoUnitario.addEventListener('input', () =>{
                
                let quantidadeAtual = Number(document.querySelector(`#quantidade-${linhaQuantidade}`).value) || 0
                let precoUnitarioAtual = Number(document.querySelector(`#precoUnitario-${numeroDoFornecedor}-${linhaQuantidade}`).value) || 0
                let precoTotalAtual = document.querySelector(`#precoTotal-${numeroDoFornecedor}-${linhaQuantidade}`)

                precoTotalAtual.value = `R$ ${(quantidadeAtual * precoUnitarioAtual).toFixed(2)}`

                decidirMelhorOferta(linhaQuantidade)

            })

            tdPrecoUnitario.appendChild(inputPrecoUnitario)
            
            let tdPrecototal = document.createElement("td")
            let inputPrecoTotal = document.createElement("input")
            inputPrecoTotal.type = 'text'
            inputPrecoTotal.readOnly = "true"
            
            inputPrecoTotal.id = `precoTotal-${quantidadeFornecedores}-${linhaAtualQuantidade}`

            inputPrecoTotal.classList.add(`resultadoPrecoTotal-linha-${linhaAtualQuantidade}`)
            inputPrecoTotal.classList.add(`resultadoPrecoTotal-fornecedor-${quantidadeFornecedores}`)

            linhaAtualQuantidade++;

            tdPrecototal.append(inputPrecoTotal)

            let linhaParaAdicionar = document.querySelector(`#${linha.id}`)

            linhaParaAdicionar.append(tdPrecoUnitario,tdPrecototal)

        }

        adiconarFooter()

        const fornecedoresHeader = document.getElementById("fornecedoresHeader");

        fornecedoresHeader.style.display = "table-cell";

        thNomeFornecedor.textContent = nomeFornecedor


        
        trNomeFornecedor.appendChild(thNomeFornecedor)

        trTopicostabela.append(thPrecoUnitario,thPrecoTotal)

        fecharModal();

        console.log("Fornecedor salvo:", nomeFornecedor);

    } else {

        alert("Por favor, digite um nome válido.");

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

    inputTotal = document.querySelector(`#input-total-${numeroFornecedor}`)

    inputTotal.value = `R$ ${(tdSubtotal + tdFrete).toFixed(2)}`

    menorValor = descobrirMenorValor(inputsTotal)

    estilizarMelhorPreco(inputsTotal, menorValor)

}

function estilizarMelhorPreco(listaValores, menorValor){

    for(valor of listaValores){

        valorReal = valor.value
        
        valorReal = parseFloat(valorReal.slice(3))

        if(menorValor == valorReal){

            valor.style.backgroundColor = "green"

        }else{

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

    const novaCotacao = { informacoes, dados, valorFinal };

    let cotacoes = JSON.parse(localStorage.getItem("dados_cotacao")) || [];
    const indexEditando = localStorage.getItem("cotacaoEditandoIndex");

    if (indexEditando !== null && indexEditando !== undefined && cotacoes[indexEditando]) {
        // Atualiza a cotação existente
        cotacoes[indexEditando] = novaCotacao;
        localStorage.removeItem("cotacaoEditandoIndex"); // Remove o estado de edição
    } else {
        // Adiciona uma nova cotação
        cotacoes.push(novaCotacao);
    }

    let dadosCotacao = {

        tabela: "cotacoes",
        cotacao: novaCotacao

    }

    enviar_dados_generico(dadosCotacao)

    const aviso = document.getElementById("salvarAviso");
    aviso.style.display = "block";
    setTimeout(() => (aviso.style.display = "none"), 3000);

}

// Função para salvar as informações gerais (id, data, hora, criador)
function salvarInformacoes() {
    const now = new Date();
    const dia = String(now.getDate()).padStart(2, "0");
    const mes = String(now.getMonth() + 1).padStart(2, "0");
    const ano = now.getFullYear();
    const horas = String(now.getHours()).padStart(2, "0");
    const minutos = String(now.getMinutes()).padStart(2, "0");
    const segundos = String(now.getSeconds()).padStart(2, "0");

    const dataFormatada = `${dia}/${mes}/${ano}`;
    const horaFormatada = `${horas}:${minutos}:${segundos}`;

    // Obter o criador do localStorage
    const acesso = JSON.parse(localStorage.getItem("acesso"));
    const criador = acesso?.usuario || "Desconhecido";

    // Recuperar cotações existentes
    const cotacoes = JSON.parse(localStorage.getItem("dados_cotacao")) || [];

    // Filtrar cotações do mesmo dia e criador
    const cotacoesDoDia = cotacoes.filter(cotacao => {
        return (
            cotacao.informacoes.data === dataFormatada &&
            cotacao.informacoes.criador === criador
        );
    });

    // Determinar o próximo número para o criador no mesmo dia
    const numero = cotacoesDoDia.length + 1;
    const id = `Cotacao-${dataFormatada}-N${numero}`;

    return {
        id,
        data: dataFormatada,
        hora: horaFormatada,
        criador
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

document.addEventListener("DOMContentLoaded", () => {
    carregarCotacoesSalvas();

    document.getElementById("novaCotacaoButton").addEventListener("click", () => {
        document.getElementById("cotacoesSalvasContainer").style.display = "none";
        document.getElementById("novaCotacaoContainer").style.display = "block";
    });
});

// Função para carregar cotações salvas do localStorage
function carregarCotacoesSalvas() {
    const tabelaBody = document.getElementById("cotacoesSalvasTable").querySelector("tbody");
    tabelaBody.innerHTML = "";

    const cotacoes = JSON.parse(localStorage.getItem("dados_cotacao")) || [];
    cotacoes.forEach((cotacao, index) => {
        const linha = document.createElement("tr");

        linha.innerHTML = `
            <td>${cotacao.informacoes.id}</td>
            <td>${cotacao.informacoes.data}</td>
            <td>${cotacao.informacoes.criador}</td>
            <td>${cotacao.dados.length}</td>
            <td>${cotacao.valorFinal.length}</td>
            <td>
                <img src="/imagens/pesquisar2.png" alt="Editar" class="img-editar" onclick="editarCotacao(${index})">
            </td>
        `;

        tabelaBody.appendChild(linha);
    });
}

function editarCotacao(index) {
    const cotacoes = JSON.parse(localStorage.getItem("dados_cotacao")) || [];
    const cotacao = cotacoes[index];
    localStorage.setItem("cotacaoEditandoIndex", index);

    preencherFormularioCotacao(cotacao);

    document.getElementById("cotacoesSalvasContainer").style.display = "none";
    document.getElementById("novaCotacaoContainer").style.display = "block";
}


function preencherFormularioCotacao(cotacao) {
    const tabela = document.getElementById("cotacaoTable").querySelector("tbody");
    tabela.innerHTML = "";

    cotacao.dados.forEach(dado => adicionarLinhaComDados(dado));

    if(cotacao.dados[0].fornecedores.length > 0){

        const linhaTitleRow = document.querySelector(".title-row")
        const thFornecedores = document.createElement("th")

        thFornecedores.textContent = "Fornecedores"

        thFornecedores.setAttribute("colspan", "999")

        linhaTitleRow.appendChild(thFornecedores)

        cotacao.dados[0].fornecedores.forEach(dado => adicionarNomeFornecedores(dado));

        cotacao.valorFinal.forEach(dado => adicionarValorFinal(dado))

    }

}



// Função para adicionar uma linha com dados no formulário
function adicionarLinhaComDados(dado, fornecedores, linhaIndex) {
    const tabela = document.getElementById("cotacaoTable").querySelector("tbody");
    const novaLinha = document.createElement("tr");

    // Preenche os dados básicos do item
    novaLinha.innerHTML = `
        <td>
            <img src="/imagens/remover.png" alt="Remover" class="remove-img" onclick="removerLinha(this)">
        </td>
        <td>${dado.numeroItem}</td>
        <td><input type="text" value="${dado.partnumber}" readonly></td>
        <td><input type="text" value="${dado.nomeItem}"></td>
        <td><input type="text" value="${dado.tipoUnitario}"></td>
        <td><input type="number" value="${dado.quantidade}" min="1"></td>
        <td><input type="text" value="${dado.estoque}" readonly></td>
    `;

    // Adiciona as colunas para cada fornecedor
    fornecedores.forEach((fornecedor, fornecedorIndex) => {
        const tdPrecoUnitario = document.createElement("td");
        const tdPrecoTotal = document.createElement("td");

        const inputPrecoUnitario = document.createElement("input");
        const inputPrecoTotal = document.createElement("input");

        inputPrecoUnitario.type = "number";
        inputPrecoUnitario.value = fornecedor.itens[linhaIndex]?.precoUnitario || ""; // Preenche o preço unitário
        inputPrecoUnitario.placeholder = "Preço Unitário";

        inputPrecoTotal.type = "text";
        inputPrecoTotal.value = fornecedor.itens[linhaIndex]?.precoTotal || ""; // Preenche o preço total
        inputPrecoTotal.readOnly = true;

        // Atualiza o preço total ao modificar o preço unitário
        inputPrecoUnitario.addEventListener("input", () => {
            const quantidade = parseFloat(dado.quantidade) || 0;
            const precoUnitario = parseFloat(inputPrecoUnitario.value) || 0;
            inputPrecoTotal.value = `R$ ${(quantidade * precoUnitario).toFixed(2)}`;
        });

        tdPrecoUnitario.appendChild(inputPrecoUnitario);
        tdPrecoTotal.appendChild(inputPrecoTotal);

        novaLinha.appendChild(tdPrecoUnitario);
        novaLinha.appendChild(tdPrecoTotal);
    });

    tabela.appendChild(novaLinha);
}

function adicionarColunaFornecedor(nome, indice) {
    const fornecedoresHeader = document.getElementById("fornecedoresHeader");
    fornecedoresHeader.style.display = "table-cell";

    const trTopicostabela = document.getElementById("topicos-tabela");
    const thPrecoUnitario = document.createElement("th");
    const thPrecoTotal = document.createElement("th");

    thPrecoUnitario.textContent = `Preço Unitário - ${nome}`;
    thPrecoTotal.textContent = `Preço Total - ${nome}`;

    trTopicostabela.append(thPrecoUnitario, thPrecoTotal);

    const linhas = document.querySelectorAll("#cotacaoTable tbody tr");
    linhas.forEach((linha, linhaIndex) => {
        const tdPrecoUnitario = document.createElement("td");
        const tdPrecoTotal = document.createElement("td");

        const precoUnitario = document.createElement("input");
        const precoTotal = document.createElement("input");

        precoUnitario.type = "number";
        precoUnitario.value = linhaIndex < nome.length ? nome[linhaIndex].precoUnitario || "" : "";
        precoTotal.type = "text";
        precoTotal.value = linhaIndex < nome.length ? nome[linhaIndex].precoTotal || "" : "";
        precoTotal.readOnly = true;

        tdPrecoUnitario.appendChild(precoUnitario);
        tdPrecoTotal.appendChild(precoTotal);

        linha.append(tdPrecoUnitario, tdPrecoTotal);
    });
}


function adicionarLinhaComDados(dado) {

    const tabela = document.getElementById("cotacaoTable").querySelector("tbody");
    const novaLinha = document.createElement("tr");

    const tdRemover = document.createElement("td")
    const imgRemover = document.createElement("img")

    imgRemover.setAttribute("src", "/imagens/remover.png")
    imgRemover.setAttribute("alt", "Remover")
    imgRemover.classList.add("remove-img")

    tdRemover.appendChild(imgRemover)

    const tdNumeroItem = document.createElement("td")
    tdNumeroItem.textContent = `${dado.numeroItem}`

    const tdPartnumber = document.createElement("td")
    const inputPartnumber = document.createElement("input")

    inputPartnumber.setAttribute("value", `${dado.partnumber}`)
    inputPartnumber.setAttribute("readonly", "true")

    tdPartnumber.appendChild(inputPartnumber)

    const tdNomeItem = document.createElement("td")
    const inputNomeItem = document.createElement("input")

    inputNomeItem.setAttribute("value", `${dado.nomeItem}`)
    inputNomeItem.setAttribute("readonly", "true")

    tdNomeItem.appendChild(inputNomeItem)

    const tdTipoUnitario = document.createElement("td")
    const inputTipoUnitario = document.createElement("input")

    inputTipoUnitario.setAttribute("value", `${dado.tipoUnitario}`)
    inputTipoUnitario.setAttribute("readonly", "true")

    tdTipoUnitario.appendChild(inputTipoUnitario)

    const tdQuantidade = document.createElement("td")
    const inputQuantidade = document.createElement("input")

    inputQuantidade.setAttribute("value", `${dado.quantidade}`)
    inputQuantidade.setAttribute("readonly", "true")

    tdQuantidade.appendChild(inputQuantidade)

    const tdEstoque = document.createElement("td")
    const inputEstoque = document.createElement("input")

    inputEstoque.setAttribute("value", `${dado.estoque}`)
    inputEstoque.setAttribute("readonly", "true")

    tdEstoque.appendChild(inputEstoque)

    novaLinha.append(tdRemover, tdNumeroItem, tdPartnumber, tdNomeItem, tdTipoUnitario, tdQuantidade, tdEstoque)
    
    if(dado.fornecedores.length > 0){
        
        adicionarPrecoUnitarioPrecoTotal(dado.fornecedores, novaLinha)
        
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

function adicionarPrecoUnitarioPrecoTotal(dado, novaLinha){

    for(let i = 0; i < dado.length; i++){

        const tdPrecoUnitarioVisualizar = document.createElement("td")
        const inputPrecoUnitarioVisualizar = document.createElement("input")

        inputPrecoUnitarioVisualizar.setAttribute("value", `${dado[i].precoUnitario}`)
        inputPrecoUnitarioVisualizar.setAttribute("readonly", "true")

        tdPrecoUnitarioVisualizar.appendChild(inputPrecoUnitarioVisualizar)

        const tdPrecoTotalVisualizar = document.createElement("td")
        const inputPrecoTotalVisualizar = document.createElement("input")

        inputPrecoTotalVisualizar.setAttribute("value", `${dado[i].precoTotal}`)
        inputPrecoTotalVisualizar.setAttribute("readonly", "true")

        tdPrecoTotalVisualizar.appendChild(inputPrecoTotalVisualizar)

        novaLinha.append(tdPrecoUnitarioVisualizar, tdPrecoTotalVisualizar)

    }

}

function adicionarValorFinal(dado){

    console.log(dado)

    const linhaDescontoVisualizar = document.querySelector("#linhaDesconto")
    const tdDescontoVisualizar = document.createElement("td")
    const inputDescontoVisualizar = document.createElement("input")

    tdDescontoVisualizar.setAttribute("colspan", "2")

    inputDescontoVisualizar.setAttribute("value", `${dado.porcentagemDesconto}`)
    inputDescontoVisualizar.setAttribute("readonly", "true")

    tdDescontoVisualizar.appendChild(inputDescontoVisualizar)

    linhaDescontoVisualizar.appendChild(tdDescontoVisualizar)

    const linhaSubTotalVisualizar = document.querySelector("#linhaSubtotal")
    const tdSubTotalVisualizar = document.createElement("td")
    const inputSubTotalVisualizar = document.createElement("input")

    tdSubTotalVisualizar.setAttribute("colspan", "2")

    inputSubTotalVisualizar.setAttribute("value", `${dado.subtotal}`)
    inputSubTotalVisualizar.setAttribute("readonly", "true")

    tdSubTotalVisualizar.appendChild(inputSubTotalVisualizar)

    linhaSubTotalVisualizar.appendChild(tdSubTotalVisualizar)

    const linhaFreteVisualizar = document.querySelector("#linhaFrete")
    const tdFreteVisualizar = document.createElement("td")
    const inputFreteVisualizar = document.createElement("input")

    tdFreteVisualizar.setAttribute("colspan", "2")

    inputFreteVisualizar.setAttribute("value", `${dado.valorFrete}`)
    inputFreteVisualizar.setAttribute("readonly", "true")

    tdFreteVisualizar.appendChild(inputFreteVisualizar)

    linhaFreteVisualizar.appendChild(tdFreteVisualizar)

    const linhaCondicaoPagarVisualizar = document.querySelector("#linhaCondicaoPagar")
    const tdCondicaoPagarVisualizar = document.createElement("td")
    const inputCondicaoPagarVisualizar = document.createElement("input")

    tdCondicaoPagarVisualizar.setAttribute("colspan", "2")

    inputCondicaoPagarVisualizar.setAttribute("value", `${dado.condicaoPagar}`)
    inputCondicaoPagarVisualizar.setAttribute("readonly", "true")

    tdCondicaoPagarVisualizar.appendChild(inputCondicaoPagarVisualizar)

    linhaCondicaoPagarVisualizar.appendChild(tdCondicaoPagarVisualizar)

    const linhaValorTotalVisualizar = document.querySelector("#linhaTotal")
    const tdValorTotalVisualizar = document.createElement("td")
    const inputValorTotalVisualizar = document.createElement("input")

    tdValorTotalVisualizar.setAttribute("colspan", "2")

    inputValorTotalVisualizar.setAttribute("value", `${dado.valorTotal}`)
    inputValorTotalVisualizar.setAttribute("readonly", "true")

    tdValorTotalVisualizar.appendChild(inputValorTotalVisualizar)

    linhaValorTotalVisualizar.appendChild(tdValorTotalVisualizar)
    
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

    const resposta = await fetch('https://script.google.com/macros/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec?bloco=cotacoes')

    const dados = await resposta.json()

    localStorage.setItem("dados_cotacao", JSON.stringify(dados));

    console.log(dados)
    
}