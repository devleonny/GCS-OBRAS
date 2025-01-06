let tabela_atual = undefined

var filtros_produtos = {}

let metaforas = [
    "Um monitor sem imagens para exibir",
    "Um sistema de vigilância sem olhos",
    "Uma rede sem nós conectados",
    "Uma central de segurança em silêncio",
    "Uma câmera sem ângulos para vigiar",
    "Um gravador sem arquivos para armazenar",
    "Um mapa sem áreas para monitorar",
    "Uma sala de controle sem alertas",
    "Um software sem dados para processar",
    "Uma instalação sem cabos para ligar",
    "Um alarme sem disparo",
    "Um servidor sem logs de acesso",
    "Um banco de dados sem registros",
    "Uma cerca virtual sem perímetro",
    "Um sensor sem movimento detectado",
    "Um sistema de monitoramento sem eventos",
    "Uma interface sem transmissões ao vivo",
    "Uma tela de múltiplas câmeras em branco",
    "Um painel de controle sem notificações",
    "Uma infraestrutura sem dispositivos ativos"

]

atualizar_precos()

async function atualizar_precos() {

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    let modalidade = orcamento_v2.lpu_ativa

    if (modalidade !== 'MODALIDADE LIVRE') {

        let atualizando = document.getElementById('atualizando')
        let penumbra = document.getElementById('penumbra')
        penumbra.style.display = 'none'
        atualizando.style.display = 'flex'
        let menu_superior = document.getElementById('menu_superior')

        menu_superior.style.display = 'none'
        document.getElementById('quieto').innerHTML = `
            <img src="gifs/loading.gif" style="width: 5vw;">
            <label class="novo_titulo">Aguarde...</label>        
        `
        menu_superior.style.display = 'flex'
        carregar_tabelas()

        await recuperar()
        await atualizar_lista_de_lpus() // Esperar carregar a lista de LPUs antes de carregar as tabelas correspondentes;
        tabela_produtos_v2()

        carregar_datalist_clientes()

        atualizando.style.display = 'none'
        penumbra.style.display = 'block'

    } else {

        carregar_layout_modalidade_livre()

    }

}

document.getElementById('data').textContent = new Date().toLocaleDateString('pt-BR')

function backtop() {

    window.scrollTo(0, 0);

}

function fechar_ir_orcamentos() {

    location.href = '/htmls/orcamentos.html'

}

function apagar_orçamento() {

    openPopup_v2('Tem certeza que deseja apagar o Orçamento?', true, 'confirmar_exclusao()')

}

function confirmar_exclusao() {

    localStorage.removeItem('orcamento_v2')

    location.href = '/htmls/adicionar.html'
    temp_pop.remove()

}

async function atualizar_lista_de_lpus() {

    var dados_composicoes = await recuperarDados('dados_composicoes') || {}

    return new Promise((resolve, reject) => {

        var LPUS = [];
        var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
        var div_tabela_de_preco = document.getElementById('div_tabela_de_preco')

        var LPUS = [
            ...new Set(
                Object.values(dados_composicoes)
                    .flatMap(obj => Object.keys(obj))
                    .filter(key => key.toLowerCase().includes('lpu'))
                    .map(key => key.toUpperCase())
            )
        ];

        var opcoes = ''
        LPUS.forEach(lpu => {
            opcoes += `<option>${lpu}</option>`
        })

        var acumulado = `
        <div style="color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 3px; padding: 5px;">
            <label style="font-size: 1em;">Tabela de preço</label>
            <select id="lpu" onchange="alterar_tabela_lpu(this)" class="select_da_lpu">
                ${opcoes}
            </select>
        </div>
        `
        div_tabela_de_preco.innerHTML = acumulado
        if (!orcamento_v2.dados_composicoes || Object.keys(orcamento_v2.dados_composicoes).length == 0) {
            openPopup_v2(`
            <div style="display: flex; gap: 10px; flex-direction: column; align-items: center; justify-content: center;">
                <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                    <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                    <label class="novo_titulo">Escolha a tabela de Preços</label>
                </div>
                ${acumulado}
            </div>
        `)
        }

        var select_lpu = document.getElementById('lpu')

        if (orcamento_v2.lpu_ativa) {
            select_lpu.value = orcamento_v2.lpu_ativa
        }

        if (select_lpu.value !== '') {
            orcamento_v2.lpu_ativa = select_lpu.value
            localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))
        }

        resolve()
    })
}

function alterar_tabela_lpu(elemento) {
    var select_da_lpu = document.querySelectorAll('.select_da_lpu')
    select_da_lpu.forEach(select => {
        select.value = elemento.value
    })
    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    orcamento_v2.lpu_ativa = elemento.value
    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))
    tabela_produtos_v2()
    carregar_tabelas()
}

function carregar_tabelas() {

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {};

    let tabelas = ['serviço', 'venda'];

    tabelas.forEach(tabela => {

        document.getElementById(`linhas_${tabela}`).innerHTML = ''

        let coluna_carrefour = orcamento_v2.lpu_ativa == 'LPU CARREFOUR' ? `<th>Item Original</th>` : '';

        document.getElementById(`thead_${tabela}`).innerHTML = `

            <th>Código</th>${coluna_carrefour}
            <th>Como aparecerá na ${orcamento_v2.lpu_ativa}</th><th>Medida</th>
            <th>Quantidade</th>
            <th>Custo Unitário</th>
            <th>Valor Total</th>
            <th>Tipo</th>
            <th>Imagem *Ilustrativa</th>
            <th>Remover</th>

        `
    })

    if (orcamento_v2.dados_composicoes) {

        let itens = orcamento_v2.dados_composicoes
        for (codigo in itens) {

            incluir_item(codigo, itens[codigo].qtde)

        }

    }

    total()
}


function removerItem(codigo) {

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    if (orcamento_v2.dados_composicoes[codigo]) {

        delete orcamento_v2.dados_composicoes[codigo]
        localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))
        carregar_tabelas()

    }

}

function enviar_dados() {

    salvar_preenchido()

    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    if (!orcamento_v2.id) {

        orcamento_v2.id = 'ORCA_' + unicoID()

    }

    if (!orcamento_v2.dados_orcam) {

        return openPopup_v2(`

        < div style = "display: flex; gap: 10px; align-items: center; justify-content: center;" >
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Preencha os dados do Cliente</label>
            </div>

    `)

    }

    let dados_orcam = orcamento_v2.dados_orcam

    if (dados_orcam.cliente_selecionado == '') {

        return openPopup_v2(`

        <div style = "display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Cliente em branco</label>
            </div>
        </div>

    `)

    }

    if (dados_orcam.contrato == '') {

        return openPopup_v2(`

        <div style = "display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Chamado em branco</label>
            </div>
        </div>

    `)

    }

    if (dados_orcam.contrato.slice(0, 1) !== 'D' && dados_orcam.contrato !== 'sequencial' && dados_orcam.contrato.slice(0, 3) !== 'ORC') {

        return openPopup_v2(`

        <div style = "display: flex; gap: 10px; align-items: center; justify-content: center;" >
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Chamado deve começar com D</label>
            </div>
        </div>

    `)

    }

    if (dados_orcam.estado == '') {

        return openPopup_v2(`

        <div style = "display: flex; gap: 10px; align-items: center; justify-content: center;" >
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Estado em branco</label>
            </div>
        </div>

    `)

    }

    if (dados_orcam.cnpj == '') {

        return openPopup_v2(`

        <div style = "display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>CNPJ em branco</label>
            </div>
        </div>

    `)

    }

    orcamento_v2.tabela = 'orcamentos'

    if (orcamento_v2.dados_composicoes_orcamento || orcamento_v2.dados_composicoes_orcamento == null) {

        delete orcamento_v2.dados_composicoes_orcamento

    }

    enviar_dados_generico(orcamento_v2)

    openPopup_v2(`

        <div style = "display: flex; gap: 10px; align-items: center; justify-content: center;" >
            <img src="imagens/concluido.png" style="width: 3vw; height: 3vw;">
                <label>Orcamento salvo... redirecionando...</label>
            </div>
        </div>    

        `)

    setTimeout(function () {

        localStorage.removeItem('orcamento_v2')
        location.href = '/htmls/orcamentos.html'

    }, 2000)

}

function pesquisar_v2(elemento, col) {
    var termo = String(elemento.value).toLowerCase();
    filtros_produtos[col] = termo;

    var tabela_itens = document.getElementById('tabela_itens');
    var tbody = tabela_itens.querySelector('tbody');
    var trs = tbody.querySelectorAll('tr');

    trs.forEach(tr => {
        var tds = tr.querySelectorAll('td');
        var mostrar_linha = true;

        for (let filtro_col in filtros_produtos) {
            var termo_salvo = filtros_produtos[filtro_col];
            var texto_coluna = String(tds[filtro_col]?.textContent || "").toLowerCase();

            if (!texto_coluna.includes(termo_salvo)) {
                mostrar_linha = false;
                break;
            }
        }

        tr.style.display = mostrar_linha ? 'table-row' : 'none';
    });
}

function mudar_tabela_pesquisa(tabela) {

    tabela_atual = tabela
    tabela_produtos_v2()
    total()

}

async function tabela_produtos_v2(tipo_tabela) {

    var tabela_itens = document.getElementById('tabela_itens')

    if (tabela_itens) {
        tabela_itens.innerHTML = '';

        var dados_composicoes = await recuperarDados('dados_composicoes') || {}

        var linhas = ''

        for (pod in dados_composicoes) {
            var produto = dados_composicoes[pod]

            if (tipo_tabela == produto.tipo || tipo_tabela == undefined) {

                var preco = 0
                var ativo = 0
                var historico = 0

                var lpu = String(document.getElementById('lpu').value).toLowerCase()

                if (produto[lpu] && produto[lpu].ativo && produto[lpu].historico) {
                    ativo = produto[lpu].ativo
                    historico = produto[lpu].historico
                    preco = historico[ativo].valor
                }

                if (preco !== 0) {

                    var imagem = 'https://i.imgur.com/Nb8sPs0.png'
                    if (produto.imagem) {
                        imagem = produto.imagem
                    }

                    linhas += `
                        <tr>
                            <td style="white-space: nowrap;">${pod}</td>
                            <td>${produto.descricao}</td>
                            <td>${produto.fabricante}</td>
                            <td>${produto.modelo}</td>
                            <td>${produto.tipo}</td>
                            <td style="text-align: center;"><input type="number" class="numero-bonito" oninput="incluir_item('${pod}', this.value)"></td>
                            <td>${produto.unidade}</td>
                            <td style="white-space: nowrap;">${dinheiro(preco)}</td>
                            <td style="text-align: center;"><img src="${imagem}" style="width: 70px; cursor: pointer;" onclick="ampliar_especial(this, '${pod}')"></td>
                        </tr>
                    `
                }
            }
        }

        var cores = {
            VENDA: '#B12425',
            SERVIÇO: 'green',
            undefined: 'rgb(179, 116, 0)'
        }

        var colunas = ['Código', 'Descrição', 'Fabricante', 'Modelo', 'Tipo', 'Quantidade', 'Unidade', 'Valor', 'Imagem *Ilustrativa']
        var ths = ''
        var tsh = ''
        colunas.forEach((col, i) => {
            ths += `<th>${col}</th>`
            tsh += `
            <th style="background-color: white; border-radius: 0px;">
                <div style="position: relative;">
                    <img src="imagens/pesquisar2.png" style="position: absolute; left: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
                    <input placeholder="${col}" style="margin-left: 25px; text-align: left;" oninput="pesquisar_v2(this, ${i})">
                </div>
            </th>
            `
        })

        var acumulado = `
        <div style="display: flex; justify-content: center; width: 100%; margin-top: 30px; gap: 10px;">
            <label class="menu_top_geral" onclick="tabela_produtos_v2()">Todos</label>
            <label class="menu_top_serviço" onclick="tabela_produtos_v2('SERVIÇO')">Serviço</label>
            <label class="menu_top_venda" onclick="tabela_produtos_v2('VENDA')">Venda</label>
        </div>
        <table class="tabela" style="background-color: ${cores[tipo_tabela]}">
            <thead>
                ${ths}
            </thead>
            <thead>
                ${tsh}
            </thead>
            <tbody>
                ${linhas}
            </tbody>
        </table>
        `

        tabela_itens.innerHTML = acumulado

    }

}

async function total(desativar_especial) {

    let tabelas = ['serviço', 'venda']
    let orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}

    let totais = {
        serviço: { valor: 0, exibir: 'none' },
        venda: { valor: 0, exibir: 'none' },
        geral: { valor: 0, exibir: 'none' }
    }

    var agrupamentos = {}

    tabelas.forEach(tabela => {
        let trs = document.getElementById(`linhas_${tabela}`).querySelectorAll('tr')

        if (trs.length > 0) {
            totais[tabela].exibir = 'block'
        } else {
            totais[tabela].exibir = 'none'
        }

        trs.forEach(tr => {
            let tds = tr.querySelectorAll('td')
            let codigo = tds[0].textContent
            let lpu = String(orcamento_v2.lpu_ativa).toLowerCase()
            let valor_unitario = 0
            let substituto = ''
            let acrescimo = 0

            if (tds.length == 10) { // Quantidade correspondente a mais 1 coluna: CARREFOUR;
                acrescimo = 1

            }

            if (lpu == 'lpu carrefour') {

                if (dados_composicoes[codigo] && dados_composicoes[codigo].substituto !== '') {

                    substituto = dados_composicoes[codigo].substituto
                    tds[1 + acrescimo].querySelector('label').textContent = dados_composicoes[substituto].descricaocarrefour

                }

            }

            let sub_ou_cod = substituto == '' ? codigo : substituto

            if (dados_composicoes[sub_ou_cod] && dados_composicoes[sub_ou_cod][lpu] && dados_composicoes[sub_ou_cod][lpu].ativo !== undefined) {

                let ativo = dados_composicoes[sub_ou_cod][lpu].ativo
                let historico = dados_composicoes[sub_ou_cod][lpu].historico
                valor_unitario = historico[ativo].valor

            }

            var quantidade = Number(tds[3 + acrescimo].querySelector('input').value)

            var inputs_adicionais = tds[3 + acrescimo].querySelectorAll('input.numero')
            var quantidades_adicionais = 0
            inputs_adicionais.forEach(input => {
                let qt = conversor(input.value)
                quantidades_adicionais += qt
            })

            if (quantidades_adicionais !== 0 && quantidade !== 0) {
                quantidade = quantidade - quantidades_adicionais
            }

            if (quantidades_adicionais !== 0) {
                tds[3 + acrescimo].querySelector('img').style.display = 'block'
            } else {
                tds[3 + acrescimo].querySelector('img').style.display = 'none'
            }

            tds[3 + acrescimo].querySelector('input').value = quantidades_adicionais == 0 ? quantidade : quantidades_adicionais

            let valor_total = valor_unitario * quantidade
            let label_icms_unitario = ''
            let label_icms_total = ''
            let tipo = tds[6 + acrescimo].textContent
            let estilo = 'input_valor'

            if (tipo == 'VENDA' && orcamento_v2.dados_orcam) {

                let icms = orcamento_v2.dados_orcam.estado == 'BA' ? 0.205 : 0.12;
                if (icms) {

                    let unit_sem_icms = valor_unitario - (valor_unitario * icms)
                    let total_sem_icms = unit_sem_icms * conversor(quantidade);
                    label_icms_unitario += `
                        <label class="label_imposto_porcentagem">SEM ICMS ${dinheiro(unit_sem_icms)}</label>
                    `
                    label_icms_total = `
                        <label class="label_imposto_porcentagem">SEM ICMS ${dinheiro(total_sem_icms)}</label>
                    `

                }

            }

            totais[tipo.toLowerCase()].valor += valor_total
            totais.geral.valor += valor_total
            estilo = valor_unitario == 0 ? 'label_zerada' : estilo;

            let total_unitario = `

            <div>
                <label class="${estilo}"> ${dinheiro(valor_unitario)}</label>
                ${label_icms_unitario}
            </div>
            `
            let total_geral = `
            <div>
                <label class="${estilo}"> ${dinheiro(quantidade * valor_unitario)}</label>
                ${label_icms_total}
            </div>

            `
            tds[4 + acrescimo].innerHTML = total_unitario
            tds[5 + acrescimo].innerHTML = total_geral

            if (!orcamento_v2.dados_composicoes) {

                orcamento_v2.dados_composicoes = {}

            }

            if (!orcamento_v2.dados_composicoes[codigo]) {

                orcamento_v2.dados_composicoes[codigo] = {}

            }

            let item_salvo = orcamento_v2.dados_composicoes[codigo]

            if (dados_composicoes[codigo].agrupamentos && !item_salvo.agrupamentos) {

                if (!agrupamentos[codigo]) {
                    agrupamentos[codigo] = {}
                }

                agrupamentos[codigo].agrupamento = dados_composicoes[codigo].agrupamentos
                agrupamentos[codigo].quantidade_origem = conversor(quantidade)

                item_salvo.agrupamentos = dados_composicoes[codigo].agrupamentos

            }

            item_salvo.codigo = codigo
            item_salvo.qtde = quantidade
            item_salvo.custo = valor_unitario
            item_salvo.total = valor_total
            item_salvo.tipo = tipo

        })

    })

    let esta_quieto = true

    for (tot in totais) {

        if (tot !== 'geral') {

            document.getElementById(tot).style.display = totais[tot].exibir
            totais[tot].exibir == 'block' ? esta_quieto = false : ''

        }

        document.getElementById(`total_${tot}`).textContent = dinheiro(totais[tot].valor)

    }

    orcamento_v2.total_geral = dinheiro(totais.geral.valor)
    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    let quieto = document.getElementById('quieto')

    esta_quieto ? quieto.style.display = 'flex' : quieto.style.display = 'none'

    let aleatorio = Math.floor(Math.random() * metaforas.length)

    if (esta_quieto) {
        
        quieto.innerHTML = `
        <label class="novo_titulo">${metaforas[aleatorio]}</label>
        `

    }

    // Agrupamentos;
    /*
    if (!desativar_especial) {
        incluir_especial()
    }
    */

}

function mostrar_ocultar_itens(elemento_img) {
    var div = elemento_img.parentElement.parentElement.querySelector('div.agrupados');

    if (div.style.display == 'none' || div.style.display === '') {
        div.style.display = 'flex';
        elemento_img.style.transform = 'rotate(180deg)';
    } else {
        div.style.display = 'none';
        elemento_img.style.transform = 'rotate(0deg)';
    }
}

async function incluir_especial() {

    var dados_composicoes = await recuperarDados('dados_composicoes') || {}
    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    var itens = orcamento_v2.dados_composicoes
    var agrupamentos = {}
    var acrescimo = 0

    for (codigo in itens) {
        if (itens[codigo].agrupamentos) {
            if (!agrupamentos[codigo]) {
                agrupamentos[codigo] = {}
            }
            agrupamentos[codigo].agrupamento = itens[codigo].agrupamentos
            agrupamentos[codigo].quantidade_origem = itens[codigo].qtde
        }
    }

    for (codigo in agrupamentos) {
        var agrupamento = agrupamentos[codigo].agrupamento

        for (sub_item in agrupamento) {
            incluir_item(sub_item, 0, true)
        }
    }

    var tabelas = ['serviço', 'venda']
    var linhas = {}

    tabelas.forEach(tab => {

        var tbody = document.getElementById(`linhas_${tab}`)

        if (tbody) {
            var trs = tbody.querySelectorAll('tr')
            trs.forEach(tr => {

                var tds = tr.querySelectorAll('td')

                if (tds.length == 10) { // Quantidade correspondente a mais 1 coluna: CARREFOUR;
                    acrescimo = 1
                }
                
                var codigo = tds[0].textContent
                tds[3 + acrescimo].querySelector('div.agrupados').innerHTML = ''
                linhas[codigo] = tr

            })
        }
    })

    total(true)

    for (codigo in agrupamentos) {
        var agrupamento = agrupamentos[codigo].agrupamento
        var quantidade_origem = agrupamentos[codigo].quantidade_origem

        for (sub_item in agrupamento) {
            var qtde = agrupamento[sub_item] * quantidade_origem
            var elemento = ''
            var tds = linhas[sub_item].querySelectorAll('td')

            if (linhas[sub_item]) {
                var descricao = dados_composicoes[codigo].descricao

                elemento = `
                <div style="display: flex; gap: 10px; align-items: center; justify-content: left;">
                    <input oninput="atualizar_item_agrupado('${codigo}', '${sub_item}', this)" class="numero" type="number" style="width: 100px; height: max-content; padding: 5px; border-radius: 3px; font-size: 1.2em;" value="${qtde}">
                    <label style="text-align: left;">${descricao}</label>
                </div>
                `
                tds[3 + acrescimo].querySelector('div.agrupados').insertAdjacentHTML('beforeend', elemento)
            }

        }
    }

}

function atualizar_item_agrupado(codigo, sub_item, elemento) {
    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    var itens = orcamento_v2.dados_composicoes

    if (itens[codigo] && itens[codigo].agrupamentos) {
        itens[codigo].agrupamentos[sub_item] = Number(elemento.value)
    }

    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    setTimeout(function () {
        total()
    }, 1000)
}

async function incluir_item(codigo, nova_quantidade, especial) {

    var dados_composicoes = await recuperarDados('dados_composicoes') || {}
    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    var item = dados_composicoes[codigo]

    var colunas_carrefour = '';
    var imagem = dados_composicoes[codigo]?.imagem || 'https://i.imgur.com/Nb8sPs0.png';
    var lpu = String(orcamento_v2.lpu_ativa).toLowerCase()

    if (lpu == 'lpu carrefour') {

        var td_descricao = ''
        if (dados_composicoes[codigo] && dados_composicoes[codigo].substituto !== '') {
            var substituto = dados_composicoes[codigo].substituto;
            td_descricao = dados_composicoes[substituto].descricao

        } else {
            td_descricao = dados_composicoes[codigo]?.descricaocarrefour || '?'

        }

        colunas_carrefour = `

        <td>
            <div style="display: flex; gap: 10px; align-items: center; justify-content: left;">
                <img src="imagens/carrefour.png" style="width: 3vw;">
                <label>${td_descricao}</label>
            </div>
        </td>

        `
    }

    let linha = `

    <tr>
        <td>${item.codigo}</td>
        <td>${dados_composicoes[item.codigo].descricao}</td>
        ${colunas_carrefour}
        <td style="text-align: center;">${dados_composicoes[item.codigo].unidade}</td>
        <td style="text-align: center;">
            <div style="display: flex; gap: 10px; align-items: center; justify-content: left;">
                <input oninput="total()" type="number" class="numero-bonito" value="${nova_quantidade}">
                <img src="gifs/baixo.gif" style="width: 30px; cursor: pointer;" onclick="mostrar_ocultar_itens(this)">
            </div>
            <div class="agrupados"></div>
        </td>
        <td></td>
        <td></td>
        <td style="text-align: center;"><label>${item.tipo}</label></td>
        <td style="text-align: center;">
            <img onclick="ampliar_especial(this, '${item.codigo}')" src="${imagem}" style="width: 50px; cursor: pointer;">
        </td>
        <td style="text-align: center;"><img src="imagens/excluir.png" onclick="removerItem('${item.codigo}')" style="cursor: pointer;"></td>
    </tr>

    `

    if (item_existente(item.tipo, codigo, nova_quantidade)) {

        document.getElementById(`linhas_${String(item.tipo).toLowerCase()}`).insertAdjacentHTML('beforeend', linha)

    }

    if (!especial || especial == undefined) {
        total()
    }

}

function item_existente(tipo, codigo, quantidade) {

    let linhas = document.getElementById(`linhas_${tipo.toLocaleLowerCase()}`)
    let trs = linhas.querySelectorAll('tr')
    let incluir = true

    trs.forEach(tr => {

        let tds = tr.querySelectorAll('td')
        let acrescimo = 0
        
        tds.length == 10 ? acrescimo = 1 : ''

        if (tds[0].textContent == codigo) {

            incluir = false
            tds[3 + acrescimo].querySelector('input').value = quantidade

        }

    })

    return incluir

}