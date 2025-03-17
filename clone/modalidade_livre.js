let orcamento_livre = document.getElementById('orcamento_livre');
let menu_inferior = document.getElementById('menu_inferior');
let orcamento_padrao = document.getElementById('orcamento_padrao');

let updateTimeout;

function retornar_ao_orcamento_tradicional() {

    openPopup_v2(`

            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>O orçamento atual será descartado e um novo será aberto na modalidade <strong>tradicional</strong>, tudo bem?</label>
                <div style="display: flex; justify-content: space-evenly; align-items: center;">
                <button onclick="carregar_layout_modalidade_tradicional()" style="background-color: green;">Confirmar</button>
                <button onclick="remover_popup()">Cancelar</button>
                </div>
            </div>   

        `)

}

function carregar_layout_modalidade_tradicional() {

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    delete orcamento_v2.dados_composicoes
    delete orcamento_v2.lpu_ativa

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    location.href = 'adicionar.html'

}

function modalidade_livre_de_orcamento() {

    openPopup_v2(`

        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
            <label>O orçamento atual será descartado e um novo será aberto na modalidade <strong>livre</strong>, tudo bem?</label>
            <div style="display: flex; justify-content: space-evenly; align-items: center;">
            <button onclick="carregar_layout_modalidade_livre()" style="background-color: green;">Confirmar</button>
            <button onclick="remover_popup()">Cancelar</button>
            </div>
        </div>   
        
        `)

}

function carregar_layout_modalidade_livre() {

    remover_popup()

    orcamento_padrao.style.display = 'none';
    menu_inferior.style.display = 'none';
    orcamento_livre.innerHTML = '';
    content.style = 'border: none'

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    orcamento_v2.lpu_ativa = 'MODALIDADE LIVRE'
    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    orcamento_livre.innerHTML = `
        <div id="menu_superior"
            style="position: relative; display: flex; flex-direction: column; justify-content: center; align-items: center; border-radius: 3px; background-color: #d2d2d2; width: 100%; padding: 20px;">


            <div style="display: flex; justify-content: left; align-items: center; gap: 5vw;">

                <div
                    style="display: flex; flex-direction: column; justify-content: center; align-items: start; border-radius: 3px;">

                    <div class="btn_menu" onclick="toggleTabela()">
                        <img src="imagens/gerente.png">
                        <label>Dados Cliente</label>
                    </div>
                    <div class="btn_menu" onclick="enviar_dados()">
                        <img src="imagens/salvo.png">
                        <label>Salvar Orçamento</label>
                    </div>
                    <div class="btn_menu" onclick="apagar_orçamento()">
                        <img src="imagens/remover.png">
                        <label>Apagar Orçamento</label>
                    </div>

                    <div class="btn_menu" onclick="retornar_ao_orcamento_tradicional()">
                        <img src="gifs/alerta.gif" style="width: 25px; cursor: pointer;">
                        <label style="cursor: pointer;">Modalidade Tradicional</label>
                    </div>

                    <div class="btn_menu" onclick="window.location.href='inicial.html'">
                        <img src="imagens/voltar_2.png">
                        <label>Voltar</label>
                    </div>

                </div>

                <div style="display: flex; flex-direction: column; gap: 10px; justify-content: center; align-items: start; color: white; font-size: 1.2em; margin: 10px;">

                    <div style="display: flex; gap: 3px; justify-content: center; align-items: center; color: white; margin: 3px;">

                        <select id="tipo_importar" style="background-color: white; color: #222; height: 6vh;">
                            <option>SERVIÇO</option>
                            <option>VENDA</option>
                        </select>

                        <div onclick="importar()" class="btn_menu">
                            <img src="imagens/baixar.png" style="width: 2vw;">
                            <label style="cursor: pointer;">Importar</label>
                        </div>

                    </div>

                    <label><strong>Ordem:</strong> Descrição, Quantidade e Valor</label>

                    <textarea id="entrada_itens" rows="5" style="width: 100%; background-color: white; color: #222; border: none;"></textarea>
                </div>

                <div
                    style="display: flex; flex-direction: column; justify-content: center; align-items: start; border-radius: 3px; color: white; width: 300px;">
                    <label style="white-space: nowrap; margin-right: 2vw; font-size: 1.0em;">TOTAL
                        GERAL</label>
                    <label style="white-space: nowrap; font-size: 3.0em;" id="tt_geral"></label>
                </div>

            </div>

        </div>

        <br>

        <div>
            <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                <label class="novo_titulo">Serviço</label>
                <button style="background-color: green;" onclick="adicionarLinha_v2('SERVIÇO')">Adicionar 1 Item</button>
                <label style="text-align: right; color: white;">Total de Serviço: </label>
                <label style="text-align: right; color: white;" id="tt_serviço"></label>
            </div>
            <table style="border-collapse: collapse; width: 100%; background-color: green;">
                <thead>
                    <th>Ordem</th>
                    <th>Descrição</th>
                    <th>Quantidade</th>
                    <th>Unidade</th>
                    <th>Valor Unitário</th>
                    <th>Valor Total</th>
                    <th>Tipo</th>
                    <th>Imagem</th>
                    <th>Remover</th>
                </thead>
                <tbody id="tabela_serviço"></tbody>
            </table>

            <br>
            <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                <label class="novo_titulo">Venda</label>
                <button onclick="adicionarLinha_v2('VENDA')">Adicionar 1 Item</button>
                <label style="text-align: right; color: white;">Total de Venda: </label>
                <label style="text-align: right; color: white;" id="tt_venda"></label>
            </div>
            <table style="border-collapse: collapse; width: 100%; background-color: #B12425;">
                <thead>
                    <th>Ordem</th>
                    <th>Descrição</th>
                    <th>Quantidade</th>
                    <th>Unidade</th>
                    <th>Valor Unitário</th>
                    <th>Valor Total</th>
                    <th>Tipo</th>
                    <th>Imagem</th>
                    <th>Remover</th>
                </thead>
                <tbody id="tabela_venda"></tbody>
            </table>
        </div>

    `;

    carregar_tabela();

}

function importar() {

    let entradaItens = document.getElementById('entrada_itens').value.trim().split('\n');

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {};

    orcamento_v2.dados_composicoes = orcamento_v2.dados_composicoes || {};

    let tipo = document.getElementById('tipo_importar').value;

    let maxNumeroL = Math.max(

        0,
        ...Object.keys(orcamento_v2.dados_composicoes)
            .map(chave => parseInt(chave))
            .filter(numero => !isNaN(numero))

    );

    entradaItens.forEach((linha, i) => {

        const [descricao, quantidade, valor] = linha.split(/\t+/).map(item => item.trim());

        if (descricao && quantidade && valor) {

            maxNumeroL++;

            orcamento_v2.dados_composicoes[`${maxNumeroL}L`] = {
                codigo: `${maxNumeroL}L`,
                descricao,
                qtde: conversor(quantidade),
                unidade: 'UND',
                custo: conversor(valor),
                tipo: tipo,
                total: conversor(quantidade) * conversor(valor),
                imagem: 'https://i.imgur.com/gUcc7iG.png'

            };

        }

    });

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2));
    carregar_tabela();

}


function carregar_tabela() {

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    if (!orcamento_v2.dados_composicoes) {

        return

    }

    document.getElementById('tabela_serviço').innerHTML = '';
    document.getElementById('tabela_venda').innerHTML = '';

    let composicoes = orcamento_v2.dados_composicoes

    for (let codigo in composicoes) {

        let item = composicoes[codigo]

        let imagem = 'https://i.imgur.com/gUcc7iG.png'

        if (item.imagem) {

            imagem = item.imagem

        }

        let linha = `

            <tr>
                <td>${codigo}</td>
                <td><textarea oninput="total_v2()" rows="3" style="width: 200px;">${item.descricao}</textarea></td>
                <td><input oninput="total_v2()" type="number" class="numero-bonito" value="${item.qtde}"></td>
                <td><input oninput="total_v2()" type="text" class="numero-bonito" value="${item.unidade}"></td>
                <td><input oninput="total_v2()" type="number" class="numero-bonito" value="${item.custo}"></td>
                <td></td>
                <td>
                    <select onchange="total_v2(true)" style="width: 100%;">
                        <option ${item.tipo === 'SERVIÇO' ? 'selected' : ''}>SERVIÇO</option>
                        <option ${item.tipo === 'VENDA' ? 'selected' : ''}>VENDA</option>
                    </select>
                </td>
                <td><img src="${imagem}" style="width: 50px; cursor: pointer;" onclick="ampliar_especial(this, '${codigo}')"></td>
                <td><img src="imagens/excluir.png" onclick="removerLinha_v2('${codigo}')" style="cursor: pointer;"></td>
            </tr>

        `;

        document.getElementById(`tabela_${String(item.tipo).toLowerCase()}`).insertAdjacentHTML('beforeend', linha);

    }

    total_v2()

}


function total_v2(recarregar) {

    let tabelas = ['serviço', 'venda']
    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    if (!orcamento_v2.dados_composicoes) {

        orcamento_v2.dados_composicoes = {}

    }

    let totais = {

        SERVIÇO: 0,
        VENDA: 0,
        GERAL: 0

    }

    let composicoes = orcamento_v2.dados_composicoes

    tabelas.forEach(tabela => {

        let trs = document.getElementById(`tabela_${tabela}`).querySelectorAll('tr')

        trs.forEach(tr => {

            let tds = tr.querySelectorAll('td')

            let item = {}
            let codigo = tds[0].textContent

            if (!composicoes[codigo]) {

                composicoes[codigo] = {}

            }

            item = composicoes[codigo]

            item.codigo = codigo
            item.descricao = tds[1].querySelector('textarea').value
            item.qtde = Number(tds[2].querySelector('input').value)
            item.unidade = tds[3].querySelector('input').value
            item.custo = Number(tds[4].querySelector('input').value)
            item.tipo = tds[6].querySelector('select').value
            item.imagem = tds[7].querySelector('img').src

            let valorTotal = item.qtde * item.custo
            tds[5].textContent = dinheiro(valorTotal)

            totais[item.tipo] += valorTotal
            totais.GERAL += valorTotal

        })

    })

    for (let tot in totais) {

        let termo = String(tot).toLowerCase()
        document.getElementById(`tt_${termo}`).textContent = `${dinheiro(totais[tot])}`

    }

    orcamento_v2.lpu_ativa = 'MODALIDADE LIVRE'
    orcamento_v2.total_geral = dinheiro(totais.GERAL)
    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    if (recarregar) {

        carregar_tabela()

    }

}

function adicionarLinha_v2(tipo) {

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {};

    let tamanho = 0

    if (orcamento_v2 && orcamento_v2.dados_composicoes) {

        tamanho = Object.keys(orcamento_v2.dados_composicoes).length + 1

    } else {

        orcamento_v2.dados_composicoes = {}

    }

    orcamento_v2.dados_composicoes[`${tamanho}L`] = { descricao: '', qtde: 1, unidade: 'UND', valor: 0, tipo }

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2));

    carregar_tabela();

}

function removerLinha_v2(codigo) {

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    orcamento_v2.dados_composicoes

    if (orcamento_v2.dados_composicoes[codigo]) {

        delete orcamento_v2.dados_composicoes[codigo]
        
    }

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2));
    
    carregar_tabela();

}
