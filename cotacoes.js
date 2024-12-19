let contador = 1;

obter_materiais()

function adicionarLinha() {

    const tabela = document.getElementById("cotacaoTable").querySelector("tbody");

    const novaLinha = document.createElement("tr");

    const acao = document.createElement("td");
    const removeImg = document.createElement("img");
    removeImg.src = "imagens/remover.png";
    removeImg.alt = "Remover";
    removeImg.className = "remove-img";
    removeImg.onclick = () => tabela.removeChild(novaLinha);
    acao.appendChild(removeImg);
    novaLinha.appendChild(acao);

    const numeroItem = document.createElement("td");
    numeroItem.textContent = contador++;
    novaLinha.appendChild(numeroItem);

    const partnumber = document.createElement("td");
    const inputPartnumber = document.createElement("input");
    inputPartnumber.type = "text";
    inputPartnumber.placeholder = "Digite o Partnumber";
    partnumber.appendChild(inputPartnumber);
    novaLinha.appendChild(partnumber);

    const nomeItem = document.createElement("td");
    const inputNome = document.createElement("input");
    inputNome.type = "text";
    inputNome.placeholder = "Digite o nome do item";
    nomeItem.appendChild(inputNome);
    novaLinha.appendChild(nomeItem);

    const tipoUnitario = document.createElement("td");
    const inputTipo = document.createElement("input");
    inputTipo.type = "text";
    inputTipo.placeholder = "Digite o tipo unitário";
    tipoUnitario.appendChild(inputTipo);
    novaLinha.appendChild(tipoUnitario);
    const quantidade = document.createElement("td");
    const inputQuantidade = document.createElement("input");
    inputQuantidade.type = "number";
    inputQuantidade.min = "1";
    inputQuantidade.placeholder = "Digite a quantidade";
    quantidade.appendChild(inputQuantidade);
    novaLinha.appendChild(quantidade);

    const estoque = document.createElement("td");
    const inputEstoque = document.createElement("input");
    inputEstoque.type = "text";
    inputEstoque.placeholder = "Digite o estoque";
    estoque.appendChild(inputEstoque);
    novaLinha.appendChild(estoque);

    tabela.appendChild(novaLinha);

}