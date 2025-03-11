document.addEventListener("DOMContentLoaded", () => {
    carregar_dados();
});

// function carregar_dados() {
//     const container = document.getElementById("distribuidor-body");

//     // Limpa antes de adicionar os novos dados
//     container.innerHTML = "";

//     const dadosTeste = [
//         { produto: "Teclado Mecânico", quantidade: 10, preco: 150.00, fornecedor: "Tech Parts" },
//         { produto: "Mouse Gamer", quantidade: 20, preco: 120.00, fornecedor: "Game Zone" },
//         { produto: "Monitor 24''", quantidade: 5, preco: 800.00, fornecedor: "VisionTech" },
//         { produto: "Cadeira Ergonômica", quantidade: 8, preco: 950.00, fornecedor: "OfficePro" }
//     ];

//     const colunas = ["Produto", "Quantidade", "Preço Unitário", "Fornecedor", "Ações"];

//     // 🔹 Criando cabeçalho
//     const cabecalho = document.createElement("div");
//     cabecalho.classList.add("linha", "cabecalho-linha");

//     colunas.forEach(coluna => {
//         const div = document.createElement("div");
//         div.classList.add("cabecalho");
//         div.textContent = coluna;
//         cabecalho.appendChild(div);
//     });

//     container.appendChild(cabecalho);

//     // 🔹 Criando as linhas com os dados
//     dadosTeste.forEach(item => {
//         const linha = document.createElement("div");
//         linha.classList.add("linha");

//         linha.innerHTML = `
//             <div class="celula">${item.produto}</div>
//             <div class="celula">${item.quantidade}</div>
//             <div class="celula">R$ ${item.preco.toFixed(2)}</div>
//             <div class="celula">${item.fornecedor}</div>
//             <div class="celula" style="text-align: center;">
//                 <img src="imagens/lupa.png" class="icone" onclick="alert('Visualizar: ${item.produto}')">
//             </div>
//         `;

//         container.appendChild(linha);
//     });
// }

// // 🔍 Função para filtrar a tabela dinamicamente
// function filtrarTabela(colIndex, valor) {
//     const linhas = document.querySelectorAll("#distribuidor-body tr");

//     linhas.forEach(linha => {
//         const celula = linha.children[colIndex];
//         if (celula) {
//             const texto = celula.textContent.toLowerCase();
//             linha.style.display = texto.includes(valor.toLowerCase()) ? "table-row" : "none";
//         }
//     });
// }

// async function carregar_distribuidor() {
//     document.body.insertAdjacentHTML("beforebegin", overlay_aguarde());

//     // 🔹 Dados de teste
//     let dados_distribuidor = [
//         { produto: "Teclado Mecânico", quantidade: 10, preco: "R$ 150,00", fornecedor: "Tech Parts" },
//         { produto: "Mouse Gamer", quantidade: 20, preco: "R$ 120,00", fornecedor: "Game Zone" },
//         { produto: "Monitor 24''", quantidade: 5, preco: "R$ 800,00", fornecedor: "VisionTech" },
//         { produto: "Cadeira Ergonômica", quantidade: 8, preco: "R$ 950,00", fornecedor: "OfficePro" }
//     ];

//     let linhas = '';

//     for (let item of dados_distribuidor) {
//         linhas += `
//             <div class="linha">
//                 <div class="celula">${item.produto}</div>
//                 <div class="celula">${item.quantidade}</div>
//                 <div class="celula">${item.preco}</div>
//                 <div class="celula">${item.fornecedor}</div>
//                 <div class="celula" style="text-align: center;">
//                     <img onclick="alert('Visualizar: ${item.produto}')" src="imagens/pesquisar2.png" class="icone">
//                 </div>
//             </div>
//         `;
//     }

//     let colunas = ['Produto', 'Quantidade', 'Preço Unitário', 'Fornecedor', 'Ações'];
//     let cabecalho = colunas.map(col => `<div class="cabecalho">${col}</div>`).join('');

//     let estrutura = `
//         <div class="tabela">
//             <div class="linha cabecalho-linha">${cabecalho}</div>
//             ${linhas}
//         </div>
//     `;

//     let div_chamados = document.getElementById('chamados');
//     div_chamados.innerHTML = estrutura;

//     let aguarde = document.getElementById('aguarde');
//     if (aguarde) {
//         aguarde.remove();
//     }
// }

// // 🔥 Chama a função ao carregar a página
// document.addEventListener("DOMContentLoaded", carregar_distribuidor);

function carregar_dados() {

    document.body.insertAdjacentHTML("beforebegin", overlay_aguarde())

    console.log("teste")
    
    let dados_distribuidor = [
        { produto: "Teclado Mecânico", quantidade: 10, preco: "R$ 150,00", fornecedor: "Tech Parts" },
        { produto: "Mouse Gamer", quantidade: 20, preco: "R$ 120,00", fornecedor: "Game Zone" },
        { produto: "Monitor 24''", quantidade: 5, preco: "R$ 800,00", fornecedor: "VisionTech" },
        { produto: "Cadeira Ergonômica", quantidade: 8, preco: "R$ 950,00", fornecedor: "OfficePro" }
    ];

    let linhas = ''

    dados_distribuidor.forEach(item => {

        linhas += `
            <tr>
                <td>${item.produto}</td>
                <td>${item.quantidade}</td>
                <td>${item.preco}</td>
                <td>${item.fornecedor}</td>
            </tr>
            `

    })

    let colunas = ['Produto', 'Quantidade', 'Preço', 'Fornecedor']
    let ths = ''
    let tsh = ''
    colunas.forEach((col, i) => {
        ths += `<th>${col}</th>`

        if (col == 'Ações') {
            tsh += `<th style="background-color: white; border-radius: 0px;"></th>`
        } else {
            tsh += `
            <th style="background-color: white; border-radius: 0px;">
                <div style="position: relative;">
                    <input placeholder="..." style="text-align: left;" oninput="filtrar_manutencoes(undefined, '${i}', this.value)">
                    <img src="imagens/pesquisar2.png" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
                </div>
            </th>      
        `}
    })

    let tabela = `
        <table id="chamados" class="tabela" style="font-size: 0.8vw; width: 100%">
            <thead>
                <tr>${ths}</tr>
                <tr>${tsh}</tr>
            </thead>
            <tbody id="manutencoes">${linhas}</tbody>
        </table>
    `

    let div_chamados = document.getElementById('distribuidores')

    if (linhas !== '') {
        div_chamados.innerHTML = tabela
    }

    let aguarde = document.getElementById('aguarde')
    if (aguarde) {
        aguarde.remove()
    }

}