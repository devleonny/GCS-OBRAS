var tabela_atual = undefined

var metaforas = [
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

    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    var modalidade = orcamento_v2.lpu_ativa

    if (modalidade !== 'MODALIDADE LIVRE') {
        var atualizando = document.getElementById('atualizando')
        var penumbra = document.getElementById('penumbra')
        penumbra.style.display = 'none'
        atualizando.style.display = 'flex'
        var menu_superior = document.getElementById('menu_superior')

        menu_superior.style.display = 'none'
        document.getElementById('quieto').innerHTML = `
            <img src="loading.gif" style="width: 5vw;">
            <label class="novo_titulo">Aguarde...</label>        
        `
        menu_superior.style.display = 'flex'
        carregar_tabelas()

        await recuperar()

        atualizar_lista_de_lpus()
        carregar_datalist_clientes()

        tabela_produtos()

        atualizando.style.display = 'none'
        penumbra.style.display = 'block'
    } else {
        carregar_layout_modalidade_livre()
    }
}

document.getElementById('campo-pesquisa').addEventListener('input', atraso(function () {
    pesquisar_v2()
}, 200));

document.getElementById('data').textContent = new Date().toLocaleDateString('pt-BR')

function backtop() {
    window.scrollTo(0, 0);
}

function fechar_ir_orcamentos() {
    location.href = 'orcamentos.html'
}

function apagar_orçamento() {
    openPopup_v2('Tem certeza que deseja apagar o Orçamento?', true, 'confirmar_exclusao()')
}

function confirmar_exclusao() {
    localStorage.removeItem('orcamento_v2')

    location.href = 'adicionar.html'
    temp_pop.remove()
}

async function atualizar_lista_de_lpus() {
    var LPUS = [];
    var dados_composicoes = await recuperarDados('dados_composicoes') || {}
    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    var LPUS = [
        ...new Set(
            Object.values(dados_composicoes)
                .flatMap(obj => Object.keys(obj))
                .filter(key => key.toLowerCase().includes('lpu'))
                .map(key => key.toUpperCase())
        )
    ];

    var select_lpu = document.getElementById('lpu');
    select_lpu.innerHTML = ''

    // Adiciona as opções ao select
    LPUS.forEach(function (item) {
        var option = document.createElement('option');
        option.textContent = item;
        select_lpu.appendChild(option);
    });

    if (orcamento_v2.lpu_ativa) {
        select_lpu.value = orcamento_v2.lpu_ativa
    }

    if (select_lpu.value !== '') {
        orcamento_v2.lpu_ativa = select_lpu.value
        localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))
    }

    select_lpu.addEventListener('change', function () {
        var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
        orcamento_v2.lpu_ativa = this.value
        localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))
        tabela_produtos()
        carregar_tabelas()
    });
}

function carregar_tabelas() {

    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {};

    var tabelas = ['serviço', 'venda'];

    tabelas.forEach(tabela => {

        document.getElementById(`linhas_${tabela}`).innerHTML = ''

        var coluna_carrefour = orcamento_v2.lpu_ativa == 'LPU CARREFOUR' ? `<th>Item Original</th>` : '';

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
        var itens = orcamento_v2.dados_composicoes
        for (codigo in itens) {

            incluir_item(codigo, itens[codigo].qtde)

        }
    }

    total()
}

function removerItem(codigo) {

    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    if (orcamento_v2.dados_composicoes[codigo]) {
        delete orcamento_v2.dados_composicoes[codigo]
        localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))
        carregar_tabelas()
    }

}

function enviar_dados() {

    salvar_preenchido()

    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}

    if (!orcamento_v2.id) {
        orcamento_v2.id = 'ORCA_' + unicoID()
    }

    if (!orcamento_v2.dados_orcam) {
        return openPopup_v2(`
        < div style = "display: flex; gap: 10px; align-items: center; justify-content: center;" >
            <img src="alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Preencha os dados do Cliente</label>
            </div>
    `)
    }

    var dados_orcam = orcamento_v2.dados_orcam

    if (dados_orcam.cliente_selecionado == '') {
        return openPopup_v2(`
        <div style = "display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Cliente em branco</label>
            </div>
        </div>
    `)
    }

    if (dados_orcam.contrato == '') {
        return openPopup_v2(`
        <div style = "display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Chamado em branco</label>
            </div>
        </div>
    `)
    }

    if (dados_orcam.contrato.slice(0, 1) !== 'D' && dados_orcam.contrato !== 'sequencial' && dados_orcam.contrato.slice(0, 3) !== 'ORC') {
        return openPopup_v2(`
        <div style = "display: flex; gap: 10px; align-items: center; justify-content: center;" >
            <img src="alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Chamado deve começar com D</label>
            </div>
        </div>
    `)
    }

    if (dados_orcam.estado == '') {
        return openPopup_v2(`
        <div style = "display: flex; gap: 10px; align-items: center; justify-content: center;" >
            <img src="alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Estado em branco</label>
            </div>
        </div>
    `)
    }

    if (dados_orcam.cnpj == '') {
        return openPopup_v2(`
        <div style = "display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="alerta.gif" style="width: 3vw; height: 3vw;">
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
        location.href = 'orcamentos.html'
    }, 2000)

}

function pesquisar_v2() {

    var termo = String(document.getElementById('campo-pesquisa').value).toLocaleLowerCase();

    var tabela_itens = document.getElementById('tabela_itens');
    var trs = tabela_itens.querySelectorAll('tr');

    trs.forEach(function (tr) {
        var tds = tr.querySelectorAll('td');
        var ocultar = true;

        tds.forEach(function (td, i) {

            if (td.textContent.toLowerCase().includes(termo) && i !== 6) {
                ocultar = false;
            }

        });

        if (ocultar) {
            tr.style.display = 'none';
        } else {
            tr.style.display = '';
        }
    });

}

function mudar_tabela_pesquisa(tabela) {
    tabela_atual = tabela
    tabela_produtos()
    total()
}

async function tabela_produtos() {

    var tabela_itens = document.getElementById('tabela_itens')
    tabela_itens.innerHTML = '';

    var tabela = document.createElement('table')
    tabela.classList = 'tabela_DD'

    if (tabela_atual == 'SERVIÇO') {
        tabela.style.backgroundColor = 'green'
    } else if (tabela_atual == 'VENDA') {
        tabela.style.backgroundColor = '#B12425'
    } else {
        tabela.style.backgroundColor = 'rgb(179, 116, 0)'
    }

    var cabecalhos = ['Código', 'Descrição', 'Fabricante', 'Modelo', 'Tipo', 'Quantidade', 'Unidade', 'Valor', 'Imagem *Ilustrativa']
    var thead = document.createElement('thead')

    cabecalhos.forEach(function (item) {
        var th = document.createElement('th')

        th.textContent = item

        thead.appendChild(th)
    })

    tabela.appendChild(thead)

    var colunas = ['descricao', 'fabricante', 'modelo', 'tipo', 'qtde', 'unidade', 'valor', 'imagem'];

    var dados_composicoes = await recuperarDados('dados_composicoes') || {}

    Object.keys(dados_composicoes).forEach(composicao => {

        var tr = document.createElement('tr');
        var tdCodigo = document.createElement('td');
        tdCodigo.textContent = composicao;
        tdCodigo.style.whiteSpace = 'nowrap'
        tr.appendChild(tdCodigo);

        var adicionaLinha = true;

        colunas.forEach(function (coluna) {
            var td = document.createElement('td');
            var valor = dados_composicoes[composicao][coluna] || '';
            if (coluna == 'valor') {
                var lpuvis = String(document.getElementById('lpu').value).toUpperCase()
                var valor_da_lpu = ''
                var dados_do_item = dados_composicoes[composicao][lpuvis.toLowerCase()]

                if (dados_do_item && dados_do_item.ativo && dados_do_item.historico) {
                    valor_da_lpu = dados_do_item.historico[dados_do_item.ativo].valor
                }

                td.style.whiteSpace = 'nowrap' // não quebrar o texto dinheiro "R$ 00";

                td.textContent = dinheiro(valor_da_lpu)

                if (dinheiro(valor_da_lpu) == 'R$ 0,00') {
                    adicionaLinha = false; // Se estiver zerado na LPU, o item não aparecerá;
                }
            } else if (coluna === 'qtde') {
                var input = document.createElement('input');
                input.type = 'number';
                input.classList = 'numero-bonito'
                var quantidade_existente = ''
                var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
                if (orcamento_v2.dados_composicoes && orcamento_v2.dados_composicoes[composicao]) {
                    quantidade_existente = conversor(orcamento_v2.dados_composicoes[composicao].qtde)
                }

                input.value = quantidade_existente;
                input.addEventListener('input', atraso(function () {

                    incluir_item(composicao, this.value)

                }, 500));

                td.style.textAlign = 'center'
                td.appendChild(input);

            } else if (coluna === 'imagem') {
                var img = document.createElement('img');

                var imagem = 'https://i.imgur.com/Nb8sPs0.png'

                if (dados_composicoes[composicao] && dados_composicoes[composicao].imagem) {
                    imagem = dados_composicoes[composicao].imagem
                }

                img.src = imagem
                img.style.width = '70px';
                img.style.cursor = 'pointer';
                img.addEventListener('click', function () {
                    ampliar_especial(img, composicao);
                });
                td.style.textAlign = 'center'
                td.appendChild(img);
            } else {
                td.textContent = valor;
            }
            tr.appendChild(td);
        });

        if (adicionaLinha && (!tabela_atual || tabela_atual == dados_composicoes[composicao].tipo)) {
            tabela.appendChild(tr);
        }
    });

    tabela_itens.appendChild(tabela)

    tabela_itens.style.display = 'block'

}

async function total() {

    var tabelas = ['serviço', 'venda']
    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    var dados_composicoes = await recuperarDados('dados_composicoes') || {}

    var totais = {
        serviço: { valor: 0, exibir: 'none' },
        venda: { valor: 0, exibir: 'none' },
        geral: { valor: 0, exibir: 'none' }
    }

    tabelas.forEach(tabela => {
        var trs = document.getElementById(`linhas_${tabela}`).querySelectorAll('tr')

        if (trs.length > 0) {
            totais[tabela].exibir = 'block'
        } else {
            totais[tabela].exibir = 'none'
        }

        trs.forEach(tr => {
            var tds = tr.querySelectorAll('td')
            var codigo = tds[0].textContent
            var lpu = String(orcamento_v2.lpu_ativa).toLowerCase()
            var valor_unitario = 0
            var substituto = ''
            var acrescimo = 0

            if (tds.length == 10) { // quantidade correspondente a mais 1 coluna: CARREFOUR;
                acrescimo = 1
            }

            if (lpu == 'lpu carrefour') {
                if (dados_composicoes[codigo] && dados_composicoes[codigo].substituto !== '') {
                    substituto = dados_composicoes[codigo].substituto
                    tds[1 + acrescimo].querySelector('label').textContent = dados_composicoes[substituto].descricaocarrefour
                }
            }

            var sub_ou_cod = substituto == '' ? codigo : substituto

            if (dados_composicoes[sub_ou_cod] && dados_composicoes[sub_ou_cod][lpu] && dados_composicoes[sub_ou_cod][lpu].ativo !== undefined) {

                var ativo = dados_composicoes[sub_ou_cod][lpu].ativo
                var historico = dados_composicoes[sub_ou_cod][lpu].historico
                valor_unitario = historico[ativo].valor
            }

            var quantidade = tds[3 + acrescimo].querySelector('input').value

            var valor_total = valor_unitario * quantidade
            var label_icms_unitario = ''
            var label_icms_total = ''
            var tipo = tds[6 + acrescimo].textContent
            var estilo = 'input_valor'

            if (tipo == 'VENDA' && orcamento_v2.dados_orcam) {
                var icms = orcamento_v2.dados_orcam.estado == 'BA' ? 0.205 : 0.12;
                if (icms) {
                    var unit_sem_icms = valor_unitario - (valor_unitario * icms)
                    var total_sem_icms = unit_sem_icms * conversor(quantidade);
                    label_icms_unitario += `
                        <label class="label_imposto_porcentagem">SEM ICMS ${dinheiro(unit_sem_icms)}</label>
                    `;

                    label_icms_total = `
                        <label class="label_imposto_porcentagem">SEM ICMS ${dinheiro(total_sem_icms)}</label>
                    `
                }
            }

            totais[tipo.toLowerCase()].valor += valor_total
            totais.geral.valor += valor_total
            estilo = valor_unitario == 0 ? 'label_zerada' : estilo;

            var total_unitario = `
            <div>
                <label class="${estilo}"> ${dinheiro(valor_unitario)}</label>
                ${label_icms_unitario}
            </div>
            `
            var total_geral = `
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

            var item_salvo = orcamento_v2.dados_composicoes[codigo]

            item_salvo.codigo = codigo
            item_salvo.qtde = quantidade
            item_salvo.custo = valor_unitario
            item_salvo.total = valor_total
            item_salvo.tipo = tipo

        })
    })

    var esta_quieto = true
    for (tot in totais) {
        if (tot !== 'geral') {
            document.getElementById(tot).style.display = totais[tot].exibir
            totais[tot].exibir == 'block' ? esta_quieto = false : ''
        }

        document.getElementById(`total_${tot}`).textContent = dinheiro(totais[tot].valor)
    }

    orcamento_v2.total_geral = dinheiro(totais.geral.valor)
    localStorage.setItem('orcamento_v2', JSON.stringify(orcamento_v2))

    var quieto = document.getElementById('quieto')

    esta_quieto ? quieto.style.display = 'flex' : quieto.style.display = 'none'

    var aleatorio = Math.floor(Math.random() * metaforas.length)

    if (esta_quieto) {
        quieto.innerHTML = `
        <label class="novo_titulo">${metaforas[aleatorio]}</label>
        `
    }

}

async function incluir_item(codigo, nova_quantidade) {

    var composicoes = await recuperarDados('dados_composicoes') || {}
    var orcamento_v2 = JSON.parse(localStorage.getItem('orcamento_v2')) || {}
    var item = composicoes[codigo]

    var colunas_carrefour = '';
    var imagem = composicoes[codigo]?.imagem || 'https://i.imgur.com/Nb8sPs0.png';
    var lpu = String(orcamento_v2.lpu_ativa).toLowerCase()

    if (lpu == 'lpu carrefour') {

        var td_descricao = ''
        if (composicoes[codigo] && composicoes[codigo].substituto !== '') {
            var substituto = composicoes[codigo].substituto;
            td_descricao = composicoes[substituto].descricao

        } else {
            td_descricao = composicoes[codigo]?.descricaocarrefour || '?'
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

    var linha = `
    <tr>
        <td>${item.codigo}</td>
        <td>${composicoes[item.codigo].descricao}</td>
        ${colunas_carrefour}
        <td style="text-align: center;">${composicoes[item.codigo].unidade}</td>
        <td style="text-align: center;"><input oninput="total()" type="number" class="numero-bonito" value="${nova_quantidade}"></td>
        <td></td>
        <td></td>
        <td style="text-align: center;"><label>${item.tipo}</label></td>
        <td style="text-align: center;"><img onclick="ampliar_especial(this, '${item.codigo}')" src="${imagem}" style="width: 50px; cursor: pointer;"></td>
        <td style="text-align: center;"><img src="imagens/excluir.png" onclick="removerItem('${item.codigo}')" style="cursor: pointer;"></td>
    </tr>
    `

    if (item_existente(item.tipo, codigo, nova_quantidade)) {
        document.getElementById(`linhas_${String(item.tipo).toLowerCase()}`).insertAdjacentHTML('beforeend', linha)
    }

    total()

}

function item_existente(tipo, codigo, quantidade) {

    var linhas = document.getElementById(`linhas_${tipo.toLocaleLowerCase()}`)
    var trs = linhas.querySelectorAll('tr')
    var incluir = true
    trs.forEach(tr => {
        var tds = tr.querySelectorAll('td')
        var acrescimo = 0
        tds.length == 10 ? acrescimo = 1 : ''

        if (tds[0].textContent == codigo) {
            incluir = false
            tds[3 + acrescimo].querySelector('input').value = quantidade
        }
    })

    return incluir

}