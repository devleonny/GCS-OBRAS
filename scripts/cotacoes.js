let contador = 1;
let linhasAtuais = [];
let quantidadeFornecedores = 0;


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
    const tabela = document.getElementById("cotacaoTable");
    const fornecedoresHeaders = document.querySelectorAll(".count-row th");
    const linhas = tabela.querySelectorAll("tbody tr");

    if (linhas.length === 0) {
        alert("Não há itens na tabela para salvar.");
        return;
    }

    const dados = Array.from(linhas).map(linha => {
        const celulas = linha.querySelectorAll("td");
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
            if (index === 0) return;

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

    console.log("Dados da Tabela Salvos:", dados);
    alert("Tabela salva com sucesso!");

    return dados;
}


