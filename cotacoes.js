let contador = 1;
let linhasAtuais = [];
let quantidadeFornecedores = 0;

obter_materiais();

document.addEventListener("DOMContentLoaded", () => {
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
    removeImg.src = "imagens/remover.png";
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

        linhaAtualQuantidade = inputQuantidade.id[11]

        for(let i = 1; i <= quantidadeFornecedores; i++){

            let tdPrecoUnitario = document.createElement("td")
            let inputPrecoUnitario = document.createElement("input")
            inputPrecoUnitario.type = "number"
            inputPrecoUnitario.placeholder = "Digite o preço unitário"
            inputPrecoUnitario.id = `precoUnitario-${quantidadeFornecedores}-${linhaAtualQuantidade}`

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
            
            inputPrecoTotal.id = `precoTotal-${quantidadeFornecedores}-${linhaAtualQuantidade}`
            
            inputPrecoTotal.className = `resultadoPrecoTotal-linha-${linhaAtualQuantidade}`
            
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
            sugestoes.innerHTML = "";
        };

        sugestoes.appendChild(sugestao);
    });
}

let nomeFornecedor = "";

function abrirModal() {

    const modal = document.getElementById("fornecedorModal");
    modal.style.display = "block";

}

function fecharModal() {
    const modal = document.getElementById("fornecedorModal");
    modal.style.display = "none";
}

function salvarFornecedor() {

    quantidadeFornecedores++;

    const input = document.getElementById("fornecedorNome");
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
            inputPrecoTotal.className = `resultadoPrecoTotal-linha-${linhaAtualQuantidade}`

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

    let menorValor = Infinity

    let listaValores = document.querySelectorAll(`input.resultadoPrecoTotal-linha-${linha_quantidade}`)

    for(valor of listaValores){

        valorReal = valor.value
        
        valorReal = parseFloat(valorReal.slice(3))

        if(valorReal < menorValor){

            menorValor = valorReal

        }

    }

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

    tdDesconto.appendChild(inputDesconto)
    linhaDesconto.appendChild(tdDesconto)

    let tdSubtotal = document.createElement("td")
    let inputSubtotal = document.createElement("input")

    inputSubtotal.id = `input-subtotal-${quantidadeFornecedores}`
    tdSubtotal.colSpan = "2"
    inputSubtotal.readOnly = "true"
    
    tdSubtotal.appendChild(inputSubtotal)
    linhaSubtotal.appendChild(tdSubtotal)

    let tdFrete = document.createElement("td")
    let inputFrete = document.createElement("input")

    inputFrete.id = `input-frete-${quantidadeFornecedores}`
    tdFrete.colSpan = "2"
    inputFrete.placeholder = "Digite o Frete"

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
    tdTotal.colSpan = "2"
    inputTotal.readOnly = "true"

    tdTotal.appendChild(inputTotal)
    linhaTotal.appendChild(tdTotal)

}