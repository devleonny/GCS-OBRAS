var orcamento_livre = document.getElementById('orcamento_livre');
var menu_inferior = document.getElementById('menu_inferior');
var orcamento_padrao = document.getElementById('orcamento_padrao');

let updateTimeout; // Variável global para armazenar o timeout

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

    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
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

    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    orcamento_v2.lpu_ativa = 'MODALIDADE LIVRE'
    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    orcamento_livre.innerHTML = `

        <div id="menu_superior"
            style="position: relative; display: flex; flex-direction: column; justify-content: center; align-items: center; border-radius: 3px; background-color: #222222bc; width: 100%; padding: 20px;">

        
            <div style="display: flex; justify-content: left; align-items: center;">

                <div
                    style="position: relative; display: flex; justify-content: center; align-items: center; border-radius: 3px;">
                    <img src="./BG.png" style="height: 200px;">

                </div>

                <div
                    style="display: flex; flex-direction: column; justify-content: space-evenly; align-items: left; gap: 20px;">
                    <div
                        style="display: flex; justify-content: space-between; align-items: center; border-radius: 3px; background-color: #222222bc;">
                        <button onclick="toggleTabela()" style="background-color: rgb(179, 116, 0);">
                            Dados Cliente</button>
                        <button style="background-color: green;" onclick="enviar_dados()">Salvar
                            Orçamento</button>
                        <button style="background-color: #B12425;" onclick="apagar_orçamento()">
                            Apagar Orçamento</button>
                    </div>

                <div style="display: flex; gap: 10px; justify-content: center; align-items: center; color: white; font-size: 1.2em; margin: 10px;">

                <textarea id="entrada_itens" rows="2" cols="30" placeholder="Descrição | Quantidade | Valor"></textarea>

                <div style="display: flex; flex-direction: column; gap: 3px; justify-content: center; align-items: center; color: white; margin: 3px;">
                    

                    <select id="tipo_importar" style="background-color: #222222bc; border-radius: 3px; color: white; width: 100%;">
                    <option>SERVIÇO</option>
                    <option>VENDA</option>
                    </select>

                    <div onclick="importar()" style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: center; border-radius: 5px; background-color: #222222bc; padding: 5px;">
                        <img src="imagens/baixar.png" style="width: 30px; cursor: pointer;"> 
                        <label style="cursor: pointer;">Importar</label>    
                    </div>

                </div>

            </div>

                </div>

                <div onclick="retornar_ao_orcamento_tradicional()"
                    style="position: absolute; right: 10px; top: 3px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 3px; padding: 5px;">
                    <img src="gifs/alerta.gif" style="width: 25px; cursor: pointer;">
                    <label style="cursor: pointer;">Orçamento Tradicional?</label>
                </div>

                <div
                    style="display: flex; flex-direction: column; justify-content: left; align-items: center; border-radius: 3px; color: white; width: 300px;">
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
    var entradaItens = document.getElementById('entrada_itens').value.trim().split('\n');
    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {};

    orcamento_v2.dados_composicoes = orcamento_v2.dados_composicoes || {};

    var tipo = document.getElementById('tipo_importar').value;

    var maxNumeroL = Math.max(
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
    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    if (!orcamento_v2.dados_composicoes) {
        return
    }

    document.getElementById('tabela_serviço').innerHTML = '';
    document.getElementById('tabela_venda').innerHTML = '';

    var composicoes = orcamento_v2.dados_composicoes

    for (codigo in composicoes) {

        var item = composicoes[codigo]

        var imagem = 'https://i.imgur.com/gUcc7iG.png'
        if (item.imagem) {
            imagem = item.imagem
        }

        var linha = `
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
    var tabelas = ['serviço', 'venda']
    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    if (!orcamento_v2.dados_composicoes) {
        orcamento_v2.dados_composicoes = {}
    }

    var totais = {
        SERVIÇO: 0,
        VENDA: 0,
        GERAL: 0
    }

    var composicoes = orcamento_v2.dados_composicoes

    tabelas.forEach(tabela => {

        var trs = document.getElementById(`tabela_${tabela}`).querySelectorAll('tr')

        trs.forEach(tr => {

            var tds = tr.querySelectorAll('td')

            var item = {}
            var codigo = tds[0].textContent

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

            var valorTotal = item.qtde * item.custo
            tds[5].textContent = dinheiro(valorTotal)

            totais[item.tipo] += valorTotal
            totais.GERAL += valorTotal

        })

    })

    for (tot in totais) {
        var termo = String(tot).toLowerCase()
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
    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {};

    var tamanho = 0

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
    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    orcamento_v2.dados_composicoes

    if (orcamento_v2.dados_composicoes[codigo]) {
        delete orcamento_v2.dados_composicoes[codigo]
    }

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2));
    carregar_tabela();
}
