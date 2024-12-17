// Lógicas de Status
var itens_adicionais = {}
var overlay = document.getElementById('overlay');
var acesso = JSON.parse(localStorage.getItem('acesso')) || {};
var status_tit = ''
var id_orcam = ''
var dataAtual = new Date();
var data_status = dataAtual.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
});
var anexos = {}

function inserir_elemento(elemento) {
    var conteiner_pedido = document.getElementById('conteiner_pedido');
    conteiner_pedido.insertAdjacentHTML('beforeend', elemento);
}

var fluxograma = {
    'AGUARDANDO': { cor: '#4CAF50', modulos: ['PROJETOS'] },
    'PEDIDO DE VENDA ANEXADO': { cor: '#4CAF50', modulos: ['LOGÍSTICA', 'RELATÓRIOS'] },
    'PEDIDO DE SERVIÇO ANEXADO': { cor: '#4CAF50', modulos: ['LOGÍSTICA', 'RELATÓRIOS'] },
    'FATURAMENTO PEDIDO DE VENDA': { cor: '#B12425', modulos: ['FINANCEIRO', 'RELATÓRIOS'] },
    'FATURAMENTO PEDIDO DE SERVIÇO': { cor: '#B12425', modulos: ['FINANCEIRO', 'RELATÓRIOS'] },
    'REMESSA DE VENDA': { cor: '#B12425', modulos: ['FINANCEIRO', 'RELATÓRIOS'] },
    'REMESSA DE SERVIÇO': { cor: '#B12425', modulos: ['FINANCEIRO', 'RELATÓRIOS'] },
    'PEDIDO DE VENDA FATURADO': { cor: '#ff4500', modulos: ['LOGÍSTICA', 'RELATÓRIOS'] },
    'PEDIDO DE SERVIÇO FATURADO': { cor: '#ff4500', modulos: ['LOGÍSTICA', 'RELATÓRIOS'] },
    'FINALIZADO': { cor: 'blue', modulos: ['RELATÓRIOS'] },
    'MATERIAL ENVIADO': { cor: '#B3702D', modulos: ['LOGÍSTICA', 'RELATÓRIOS'] }
}

var adicionar_pedido = `
    <hr style="width: 80%">
        <div style="display: grid; gap: 10px;">
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <p class="novo_titulo" style="cursor: pointer; color: #222">Escolha o tipo do <strong>Pedido</strong> </p> 
            <select id="tipo_v2">
                <option>Selecione</option>
                <option>Serviço</option>
                <option>Venda</option>
            </select>
        </div>

        <div style="display: flex; gap: 10px; align-items: center; justify-content: center; align-items: center;">
            <input type="checkbox" onchange="ocultar_pedido(this)" style="cursor: pointer;">
            <label>Marque aqui caso não tenha o número ainda.</label>
            <img src="interrogacao.gif" onclick="mostrar_um_aviso()" style="width: 2vw; cursor: pointer;">
        </div>

        <div id="conteiner_pedido">
            <div class="conteiner_pedido">
                <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                    <label style="white-space: nowrap;"><strong>Número do Pedido</strong></label>
                    <input type="text" class="pedido" id="num_pedido">
                </div>

                <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                    <label style="white-space: nowrap;"><strong>Valor do Pedido</strong></label>
                    <input type="number" class="pedido" id="valor_pedido">
                </div>
            </div>
        </div>
    </div>
`;

function ocultar_pedido(elemento) {

    var num_pedido = document.getElementById('num_pedido')
    var valor_pedido = document.getElementById('valor_pedido')

    if (elemento.checked) {
        conteiner_pedido.style.display = 'none'
        num_pedido.value = '???'
        valor_pedido.value = 0
    } else {
        conteiner_pedido.style.display = 'block'
        num_pedido.value = ''
        valor_pedido.value = 0
    }
}

function mostrar_um_aviso() {
    openPopup_v2(`
        <p>O número do pedido ficará como provisório e você poderá atualizar depois.</p>
        <p>Um aviso será mostrado eventualmente para te lembrar.</p>
    `)
}

var comentario = `
    <div style="display: flex; flex-direction: column; gap: 3px; align-items: start;">
        <label><strong>Comentário</strong></label>
        <textarea rows="10" id="comentario_status" style="width: 80%;" ></textarea>
    </div>

    <div style="display: flex; flex-direction: column; gap: 3px; align-items: start;">
        <label><strong>Data</strong> </label> <label id="data_status">${data_status}</label>
    </div>

    <div style="display: flex; flex-direction: column; gap: 3px; align-items: start;">
        <label><strong>Executor</strong> </label> <label id="usuario_status">${acesso.usuario}</label>
    </div>
    `

function calcular_requisicao(sincronizar) {

    var tabela_requisicoes = document.getElementById('tabela_requisicoes')

    if (tabela_requisicoes) {
        var tbody = tabela_requisicoes.querySelector('tbody')

        var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}
        var orcamento = dados_orcamentos[id_orcam]

        conversor_composicoes_orcamento(orcamento)

        var itens = orcamento.dados_composicoes
        var estado = orcamento.dados_orcam.estado

        if (tbody) {
            var trs = tbody.querySelectorAll('tr')

            var total_sem_icms = 0
            var total_com_icms = 0

            trs.forEach(tr => {
                var tds = tr.querySelectorAll('td')

                if (tr.style.display !== 'none') {

                    var codigo = tds[0].textContent

                    if (tds[4].querySelector('input') && tds[4].querySelector('input').value > conversor(itens[codigo].qtde)) {
                        tds[4].querySelector('input').value = conversor(itens[codigo].qtde)
                    }

                    var tipo = 'Error 404'

                    if (sincronizar) { // Incicialmente para carregar os tipos;
                        tipo = itens[codigo].tipo
                        tds[3].querySelector('select').value = tipo

                    } else {
                        tipo = tds[3].querySelector('select') ? tds[3].querySelector('select').value : tds[3].querySelector('label').textContent
                    }

                    var infos = ['', '']
                    if (tipo == 'VENDA') {
                        infos = ['<strong>s • ICMS</strong> <br>', '<strong>c • ICMS</strong> <br>']
                    }

                    var icms = 0
                    if (estado == 'BA' && tipo == 'VENDA') {
                        icms = 0.205
                    } else if (estado !== 'BA' && tipo == 'VENDA') {
                        icms = 0.12
                    }

                    var qtde = tds[4].querySelector('input') ? tds[4].querySelector('input').value : tds[4].textContent
                    var custo = conversor(itens[codigo].custo)
                    var unt_sem_icms = custo - (custo * icms)

                    var labels_unitarios = tds[5].querySelectorAll('label')
                    labels_unitarios[0].innerHTML = `${infos[1]} ${dinheiro(custo)}`
                    labels_unitarios[1].innerHTML = (qtde == '' || tipo == 'SERVIÇO') ? '' : `${infos[0]} ${dinheiro(unt_sem_icms)}`


                    var labels_totais = tds[6].querySelectorAll('label')
                    labels_totais[0].innerHTML = `${infos[1]} ${dinheiro(custo * qtde)}`
                    labels_totais[1].innerHTML = (qtde == '' || tipo == 'SERVIÇO') ? '' : `${infos[0]} ${dinheiro(unt_sem_icms * qtde)} `

                    total_sem_icms += unt_sem_icms * qtde
                    total_com_icms += qtde * custo
                }
            })

            var total_c_icms = document.getElementById('total_c_icms')
            var total_s_icms = document.getElementById('total_s_icms')

            if (total_c_icms && total_s_icms) {
                total_c_icms.textContent = dinheiro(total_com_icms)
                total_s_icms.textContent = dinheiro(total_sem_icms)
            }

        }
    }

}

function notas_no_financeiro(chave) {

    return `
    <hr style="width: 80%">
    <div style="display: grid; gap: 10px;">
    <div style="display: flex; flex-direction: column; gap: 10px; align-items: center; justify-content: center;">
        <label class="novo_titulo" style="color: #222">Inclua o número das Notas <strong>Remessa</strong>, <strong>Venda</strong> ou <strong>Serviço</strong></label> 
        <p> Coloque o número da NF e escolha a qual pedido se refere.</p>
        </div>
        <div id="conteiner_pedido">
            <div class="conteiner_pedido">
                <label><strong>Número da Nota</strong></label>
                <input type="number" class="pedido">
                <select>
                <option>Remessa</option>
                <option>Venda</option>
                <option>Serviço</option>
                </select>
                <select id="select_dos_pedidos">
                ${carregar_pedidos(chave)}
                </select>
            </div>
        </div>
    </div>
`
}

var nota_mais = `
    <div class="conteiner_pedido">
        <label><strong>Número da Nota</strong></label>
        <input type="number" class="pedido">
    </div>
`

function alterar_todos(valor_ref) {
    var trs = tabela_requisicoes.querySelectorAll('tr')
    trs.forEach(tr => {
        var tds = tr.querySelectorAll('td');
        if (tds[7]) {
            var select = tds[7].querySelector('select');
            if (select) {
                select.value = valor_ref;
            }
        }
    })
}

function pesquisar_na_requisicao() {

    var pesquisa1 = document.getElementById('pesquisa1');

    if (pesquisa1) {

        var tabela = document.getElementById('tabela_requisicoes');
        var tbody = tabela.querySelector('tbody');
        var trs = tbody.querySelectorAll('tr');

        trs.forEach(tr => {

            var tds = tr.querySelectorAll('td');
            var mostrar_linha = false;

            tds.forEach(td => {

                var select = td.querySelector('select');
                var conteudo = select ? select.value : td.textContent;

                if (String(conteudo).toLowerCase().includes(String(pesquisa1.value).toLowerCase()) || pesquisa1.value == '') {
                    mostrar_linha = true;
                }
            });

            tr.style.display = mostrar_linha ? 'table-row' : 'none';
        });
    }
}

async function carregar_itens(apenas_visualizar, requisicao) {

    if (!id_orcam) {
        return ''
    }

    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}
    var dados_composicoes = await recuperarDados('dados_composicoes') || {}
    var orcamento = dados_orcamentos[id_orcam]

    var orcamento = conversor_composicoes_orcamento(orcamento)

    var linhas = ''

    console.log(orcamento)

    if (!orcamento.dados_composicoes || Object.keys(orcamento.dados_composicoes).length == 0) {
        return ''
    }

    Object.keys(orcamento.dados_composicoes).forEach(it => {

        var item = orcamento.dados_composicoes[it]

        var codigo = item.codigo
        var qtde = item.qtde
        var qtde_na_requisicao = 0
        var tipo = dados_composicoes[codigo]?.tipo || item.tipo

        var infos = ['descricao', 'descricaoCarrefour', 'modelo', 'fabricante']
        var elements = ''

        infos.forEach(item => {
            if (dados_composicoes[codigo] && dados_composicoes[codigo][item]) {
                elements += `
                <label><strong>${item.toUpperCase()}</strong> <br> ${dados_composicoes[codigo][item]}</label>
            `}
        })

        var part_number = `
            <input value="${dados_composicoes[codigo]?.omie || ''}" class="pedido" style="font-size: 1.2em; width: 100%; height: 40px; padding: 0px; margin: 0px;">
        `

        // Ajustando o select para ter a opção correta selecionada
        var selectTipo = `
            <select onchange="calcular_requisicao()">
                <option value="SERVIÇO" ${tipo === 'SERVIÇO' ? 'selected' : ''}>SERVIÇO</option>
                <option value="VENDA" ${tipo === 'VENDA' ? 'selected' : ''}>VENDA</option>
            </select>
        `;

        if (requisicao) {
            qtde_na_requisicao = requisicao[codigo]?.qtde_enviar || ''
        }

        var botao_itens_adicionais = ''

        if (dados_composicoes[codigo] && dados_composicoes[codigo]['material infra']) {
            botao_itens_adicionais = `<img src="construcao.png" style="width: 30px; cursor: pointer;" onclick="abrir_adicionais('${codigo}')">`
        }

        var quantidade = `
        <div style="display: flex; flex-direction: column; align-items: start; justify-content: space-evenly; gap: 10px;">

            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;">
                <label><strong>Quantidade a enviar</strong></label>
                <input class="pedido" type="number" style="width: 100%; padding: 0px; margin: 0px;" oninput="calcular_requisicao()" value="${qtde_na_requisicao}">
            </div>

            <div style="display: flex; align-items: center; gap: 10px; justify-content: left;">

                <div class="contorno_botoes" style="display: flex; align-items: center; justify-content: center; gap: 5px; background-color: #222; font-size: 1.2em;">
                    <label><strong>Orçamento</strong></label>
                    <label>${qtde}</label>   
                </div>

                ${botao_itens_adicionais}
            </div>

        </div>
        `
        var opcoes = `
        <select>
            <option>--</option>
            <option>All Nations</option>
            <option>Nada a fazer</option>
            <option>Estoque AC</option>
            <option>Comprar</option>
            <option>Enviar do CD</option>
            <option>Fornecido pelo Cliente</option>
        </select>
        `

        if (apenas_visualizar) {
            part_number = `<label style="font-size: 1.2em;">${requisicao[codigo]?.partnumber || ''}</label>`
            selectTipo = `<label style="font-size: 1.2em;">${requisicao[codigo]?.tipo || ''}</label>`
            quantidade = `<label style="font-size: 1.2em;">${requisicao[codigo]?.qtde_enviar || ''}</label>`
            opcoes = `<label style="font-size: 1.2em;">${requisicao[codigo]?.requisicao || ''}</label>`
        }

        var linha = `
            <tr>
            <td style="text-align: center; font-size: 1.2em;">${codigo}</td>
            <td style="text-align: center;">
            ${part_number}
            </td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 5px; align-items: start;">
                ${elements}
                </div>
            </td>
            <td style="text-align: center; padding: 0px; margin: 0px; font-size: 0.8em;">
                ${selectTipo}
            </td>
            <td style="text-align: center;">
                ${quantidade}
            </td>
            <td style="text-align: left; white-space: nowrap; font-size: 1.2em;">
                <label></label>
                <br>
                <br>
                <label style="color: red; font-size: 1.0em;"></label>
            </td>
            <td style="text-align: left; white-space: nowrap; font-size: 1.2em;">
                <label></label>
                <br>
                <br>
                <label style="color: red; font-size: 1.0em;"></label>
            </td>
            <td>
                ${opcoes}
            </td>
        `
        if (apenas_visualizar == undefined || !apenas_visualizar || (apenas_visualizar && requisicao && requisicao[codigo] && requisicao[codigo].qtde_enviar)) {
            linhas += linha
        }

    })

    return linhas
}

function remover_linha_materiais(element) {
    element.closest('tr').remove()
}

function adicionar_linha_materiais(descricao, und, qtde) {

    var painel_cotacoes = document.getElementById('painel_cotacoes');

    if (painel_cotacoes) {

        var tabela = painel_cotacoes.querySelector('table');
        var materiais = JSON.parse(localStorage.getItem('dados_materiais')) || {}
        var tbody = tabela.querySelector('tbody');
        var itens = ''

        for (material in materiais) {
            var item = materiais[material]
            itens += `
        <option>${item.descricao}</option>
        `
        }

        var linha = `
        <tr>
            <td><img src="excluir.png" onclick="remover_linha_materiais(this)" style="cursor: pointer;"></td>
            <td>?</td>
            <td style="width: 300px;">
            <input list="itens" onchange="mostrar_estoque()" placeholder="Digite o nome do material" style="width: 300px;">
            <datalist id="itens">
                ${itens}
            </datalist>
            </td>
            <td><input value="UND"></td>
            <td><input placeholder="0"></td>
            <td></td>
        </tr>
    `;

        tbody.insertAdjacentHTML('beforeend', linha);

        if (descricao !== undefined) {
            var trs = tbody.querySelectorAll('tr')
            var tds = trs[trs.length - 1].querySelectorAll('td')
            tds[2].querySelector('input').value = descricao
            tds[3].querySelector('input').value = und
            tds[4].querySelector('input').value = qtde
        }
    }
}

function mostrar_estoque() {

    var tabela = painel_cotacoes.querySelector('table');
    var materiais = JSON.parse(localStorage.getItem('dados_materiais')) || {}
    var tbody = tabela.querySelector('tbody')
    var trs = tbody.querySelectorAll('tr')

    trs.forEach(tr => {
        var tds = tr.querySelectorAll('td')
        var chave_desc = tds[2].querySelector('input').value

        tds[1].textContent = materiais[chave_desc].partnumber
        tds[5].textContent = materiais[chave_desc].estoque
    })

}

function abrir_adicionais(codigo) {

    var acumulado = `
        <div id="painel_cotacoes" style="background-color: #B12425; border-radius: 5px; font-size: 1.0vw; color: #222;">

            <table style="border-collapse: collapse; ">

                <thead>
                    <th>Remover</th>
                    <th>Partnumber</th>
                    <th>Descrição</th>
                    <th>Unidade</th>
                    <th>Quantidade</th>
                    <th>Estoque</th>
                </thead>
                <tbody>
                </tbody>

            </table>

            <div style="display: flex; gap: 10px; position: absolute; bottom: -50px; left: 0;">
                <label style="border: 1px solid #888;" class="contorno_botoes"
                onclick="adicionar_linha_materiais()">Adicionar 1 item</label>

                <label style="background-color: green; border: 1px solid #888;" class="contorno_botoes"
                onclick="salvar_itens_adicionais('${codigo}')">Salvar</label>
            </div>

        </div>
    `

    openPopup_v2(acumulado)

    for (cd in itens_adicionais) {

        if (cd == codigo) {
            var adicionais = itens_adicionais[cd]

            for (ad in adicionais) {
                var dados = adicionais[ad]
                adicionar_linha_materiais(ad, dados.unidade, dados.qtde)
            }

            mostrar_estoque()

        }
    }

}

function salvar_itens_adicionais(codigo) {

    var tabela = painel_cotacoes.querySelector('table');
    var tbody = tabela.querySelector('tbody')
    var trs = tbody.querySelectorAll('tr')

    if (itens_adicionais[codigo]) {
        delete itens_adicionais[codigo]
    }

    itens_adicionais[codigo] = {}

    var adicionais = itens_adicionais[codigo]

    trs.forEach(tr => {
        var tds = tr.querySelectorAll('td')
        var descricao = tds[2].querySelector('input').value

        if (descricao !== '') {

            if (!adicionais[descricao]) {
                adicionais[descricao] = {}
            }

            adicionais[descricao].partnumber = tds[1].textContent
            adicionais[descricao].descricao = tds[2].querySelector('input').value
            adicionais[descricao].unidade = tds[3].querySelector('input').value
            adicionais[descricao].qtde = Number(tds[4].querySelector('input').value)

        }
    })

    mostrar_itens_adicionais()
    remover_popup()

}

function mostrar_itens_adicionais() {
    var tabela_requisicoes = document.getElementById('tabela_requisicoes')

    if (tabela_requisicoes) {

        var tbody = tabela_requisicoes.querySelector('tbody')
        var trs = tbody.querySelectorAll('tr')

        trs.forEach(tr => {
            var tds = tr.querySelectorAll('td')
            var codigo = tds[0].textContent

            var container = document.getElementById(`container_${codigo}`)
            if (container) {
                container.remove()
            }

            if (itens_adicionais[codigo]) {

                var adicionais = itens_adicionais[codigo]
                var div = ''

                for (ad in adicionais) {

                    var adicional = adicionais[ad]

                    div += `
                    <div style="display: flex; gap: 5px; align-items: center; justify-content: left;">
                        <label>(${adicional.qtde})</label>
                        <label>(${adicional.unidade})</label>
                        <label>(${adicional.partnumber})</label>
                        <label>(${adicional.descricao})</label>
                    </div>
                    `
                }

                var acumulado = `
                <div id="container_${codigo}" class="contorno" style="width: 80%;">
                    <div style="padding: 5px; background-color: #99999940; border-radius: 3px; font-size: 0.6vw;">
                    <label><strong>ITENS ADICIONAIS</strong></label>
                        ${div}
                    </div>
                </div>
                `

                tds[2].querySelector('div').insertAdjacentHTML('beforeend', acumulado)
            }
        })
    }
}

function carregar_pedidos(chave) {
    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}

    if (!id_orcam) {
        return ''
    }

    var elementum = ''

    var orc = dados_orcamentos[id_orcam]
    if (orc && orc.status[chave]) {

        elementum += `
            <option>${orc.status[chave].pedido} - ${orc.status[chave].tipo}</option>
            `
    }

    return elementum
}

function carregar_status_divs(valor, chave, id) { // "valor" é o último status no array de status que vem do script de orçamentos;

    var estrutura = document.getElementById('estrutura')
    if (estrutura) {
        estrutura.remove()
    }

    if (chave == undefined) {
        chave = unicoID()
    }

    overlay.style.display = 'block'

    if (id) {
        id_orcam = id
        dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {};
        orcamento = dados_orcamentos[id_orcam]
    }

    var acumulado = ''

    acumulado += `
    <span class="close" onclick="fechar_status()">&times;</span>
    <div style="display: flex; justify-content: space-evenly; align-items: center;">
    <label class="novo_titulo" style="color: #222" id="nome_cliente"></label>
    `

    if (valor.includes('ANEXADO')) {
        acumulado += `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px; font-size: 2.0em;"> 
            <label>Total <strong>Com ICMS </strong><label id="total_c_icms"></label></label>
            <label>Total <strong>Sem ICMS  </strong><label id="total_s_icms"></label></label>
        </div>
        `
    }

    acumulado += `
    </div>
    <br>
    <div id="container_status"></div>
    `

    if (!valor || valor == 'AGUARDANDO') {
        acumulado += adicionar_pedido

    } else if (String(valor).includes('ANEXADO')) {

        return detalhar_requisicao(chave)

    } else if (String(valor).includes('FATURAMENTO')) {

        acumulado += notas_no_financeiro(chave)

    } else if (String(valor).includes('REMESSA')) {

        acumulado += notas_no_financeiro(chave)

    }

    acumulado += comentario

    acumulado += ` 
        <div id="div_anexos" style="display: flex; flex-direction: column; justify-content: right; align-items: center; gap: 10px;">
        </div>

        <div class="contorno_botoes" style="background-color: #B12425"> 
            <img src="anexo2.png" style="width: 15px;">
            <label for="adicionar_anexo">Anexar arquivos
                <input type="file" id="adicionar_anexo" style="display: none;" onchange="salvar_anexo()"> 
            </label>
        </div>
    `

    var botoes_finais = `
    <hr style="width: 80%">
    <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
        <button onclick="fechar_status()">Cancelar</button>
        <button style="background-color: green" onclick="salvar_status('${chave}')">Salvar</button>
    </div>
`;

    var elementus = `
    <div id="status" class="status" style="display: flex; width: 100%; overflow: auto;">
    ${acumulado}
    ${botoes_finais}
    </div>
    `

    document.body.insertAdjacentHTML('beforeend', elementus)

    calcular_requisicao(true)

    status_tit = valor

    nome_cliente.textContent = orcamento['dados_orcam'].cliente_selecionado

}

function salvar_status(chave, operacao, chave2) {

    // Iniciar o objeto STATUS - PARA TODOS;
    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {};
    var orcamento = dados_orcamentos[id_orcam];
    var st = '';

    if (!orcamento.status) {
        orcamento.status = {};
    }

    if (status_tit == 'AGUARDANDO') {

        var chave_his = unicoID();

        var novo_lancamento = {
            status: '',
            pedido: '',
            tipo: '',
            historico: {}
        };

        novo_lancamento.historico[chave_his] = {
            status: '',
            data: data_status,
            executor: acesso.usuario,
            comentario: comentario_status.value,
            anexos: anexos,
        };

        var num_pedido = document.getElementById('num_pedido')
        var valor_pedido = document.getElementById('valor_pedido')
        var tipo_v2 = document.getElementById('tipo_v2')

        novo_lancamento.pedido = num_pedido.value
        novo_lancamento.tipo = tipo_v2.value
        novo_lancamento.valor = valor_pedido.value

        if (num_pedido.value == '' || valor_pedido.value == '' || tipo_v2.value == 'Selecione') {
            return openPopup_v2('Não deixe campos em branco.')
        }

        st = String(tipo_v2.value).toUpperCase();
        if (tipo_v2.value == 'Serviço') {
            st = 'PEDIDO DE SERVIÇO ANEXADO';
        } else {
            st = 'PEDIDO DE VENDA ANEXADO';
        }

        novo_lancamento.status = st;
        novo_lancamento.historico[chave_his].status = st;

        orcamento.status[chave] = novo_lancamento;

    } else if (operacao == 'requisicao') {

        if (chave2 == undefined) {
            chave2 = gerar_id_5_digitos()
        }

        if (!orcamento.status[chave]) {
            orcamento.status[chave] = { historico: {} };
        }
        var novo_lancamento = orcamento.status[chave];

        calcular_requisicao()

        novo_lancamento.historico[chave2] = {
            status: '',
            data: data_status,
            executor: acesso.usuario,
            comentario: comentario_status.value,
            anexos: anexos,
            requisicoes: [],
            adicionais: itens_adicionais,
            total_sem_icms: total_s_icms.textContent,
            total_com_icms: total_c_icms.textContent
        };

        var tbody = tabela_requisicoes.querySelector('tbody');

        if (tbody) {
            var trs = tbody.querySelectorAll('tr');
            var lista_partnumbers = {};

            trs.forEach(tr => {

                var tds = tr.querySelectorAll('td');

                var codigo = tds[0].textContent
                var partnumber = tds[1].querySelector('input')?.value || '';
                var requisicao = tds[7].querySelector('select')?.value || '';
                var tipo = tds[3].querySelector('select')?.value || '';
                var qtde = tds[4].querySelector('input')?.value || '';

                if (qtde == '' && (partnumber === '' || requisicao === '--')) {
                    return openPopup_v2(`
                            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                                <img src="alerta.gif" style="width: 3vw; height: 3vw;">
                                <label>Se o item tiver quantidade, preencha também o PARTNUMBER e o status de Requisição</label>
                            </div>
                        `);
                }

                if (qtde !== '') {
                    novo_lancamento.historico[chave2].requisicoes.push({
                        codigo: codigo,
                        partnumber: partnumber,
                        tipo: tipo,
                        qtde_enviar: qtde,
                        requisicao: requisicao
                    });
                }

                if (partnumber !== '') {
                    lista_partnumbers[codigo] = partnumber;
                }

            });

            atualizar_partnumber(lista_partnumbers);

        }

        var informacao_no_select = String(pedido_selecionado.value);
        var tipo = '';
        if (informacao_no_select.includes('Serviço')) {
            tipo = 'SERVIÇO';
        } else if (informacao_no_select.includes('Venda')) {
            tipo = 'VENDA';
        }

        if (informacao_no_select == 'Selecione') {
            return openPopup_v2(`
                <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                    <img src="alerta.gif" style="width: 3vw; height: 3vw;">
                    <label>Não deixe o campo de pedido em branco, selecione um pedido.</label>
                </div>
            `);

        } else {
            st = `FATURAMENTO PEDIDO DE ${tipo}`;
        }

        novo_lancamento.status = st;
        novo_lancamento.historico[chave2].status = st;
        novo_lancamento.historico[chave2].pedido_selecionado = informacao_no_select;

    } else if ((status_tit).includes('FATURAMENTO') || (status_tit).includes('REMESSA')) {

        var novo_lancamento = orcamento.status[chave];
        novo_lancamento.notas = [];
        var chave_his = unicoID();

        novo_lancamento.historico[chave_his] = {
            status: '',
            data: data_status,
            executor: acesso.usuario,
            comentario: comentario_status.value,
            anexos: anexos,
            notas: []
        };

        var divs = document.querySelectorAll('.conteiner_pedido');

        divs.forEach(div => {
            var input = div.querySelector('input');
            var selects = div.querySelectorAll('select');

            novo_lancamento.historico[chave_his].notas.push({
                nota: input.value,
                modalidade: selects[0].value,
                pedido: selects[1].value
            });

            if (selects[0].value == 'Venda') {
                st = `PEDIDO DE VENDA FATURADO`;
            } else if (selects[0].value == 'Serviço') {
                st = `PEDIDO DE SERVIÇO FATURADO`;
            } else if (selects[0].value == 'Remessa') {
                st = selects[1].value.includes('Serviço') ? `REMESSA DE SERVIÇO` : `REMESSA DE VENDA`;
            }
        });

        novo_lancamento.status = st;
        novo_lancamento.historico[chave_his].status = st;
    }

    localStorage.setItem('dados_orcamentos', JSON.stringify(dados_orcamentos));

    enviar_status_orcamento(orcamento);

    fechar_status();
    fechar_espelho_ocorrencias();

    var mods = '';
    var concordancia_em_numero = '';
    fluxograma[st].modulos.map(it => mods += `<p><strong>${it}</strong></p>`);

    if (fluxograma[st].modulos.length == 1) {
        concordancia_em_numero = `
        <label>O orçamento foi transferido para o módulo abaixo:</label>
        `;
    } else {
        concordancia_em_numero = `
        <label>O orçamento foi transferido para os módulos abaixo:</label>
        `;
    }

    openPopup_v2(`
        <div style="display: flex; flex-direction: column; gap: 10px;">
            ${concordancia_em_numero}
            ${mods}
            <label>Com status → <strong>${st}</strong></label>
        </div>
    `);

    preencher_dados_orcamentos();

    var estrutura = document.getElementById('estrutura')
    if (estrutura) {
        estrutura.remove()
    }
    abrir_esquema(id_orcam)

    anexos = {}
    itens_adicionais = {}
}

function fechar_status() {
    var status = document.getElementById('status')
    if (status) {
        status.remove()
    }
    abrir_esquema(id_orcam)
    remover_popup()
}

function fechar_espelho_ocorrencias() {
    var espelho_ocorrencias = document.getElementById('espelho_ocorrencias')
    if (espelho_ocorrencias) {
        espelho_ocorrencias.remove()
    }
    remover_popup()
}

function botao_novo_pedido(id) {
    return `
    <div class="contorno_botoes" style="background-color: ${fluxograma['PEDIDO DE VENDA ANEXADO'].cor}" onclick="carregar_status_divs('AGUARDANDO', undefined, '${id}')">
        <label>Novo Pedido de <strong>Serviço</strong> ou <strong>Venda</strong></label>
    </div>
`}

function botao_novo_pagamento(ch_pedido) {
    return `
    <div class="contorno_botoes" style="background-color: #097fe6" onclick="tela_pagamento('${ch_pedido}')">
        <label>Novo <strong>Pagamento</strong></label>
    </div>   
`}

function exibir_todos_os_status(id) { //Filtrar apenas a demanda que vem do botão;
    overlay.style.display = 'block'

    var detalhes = document.getElementById('detalhes')
    if (detalhes) {
        detalhes.remove()
    }

    id_orcam = id

    status_tit = ''

    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos'))

    var orcamento = dados_orcamentos[id]

    var acumulado = ''

    acumulado += `
    <span class="close" onclick="fechar_espelho_ocorrencias()">&times;</span>
    <div style="display: flex; gap: 10px">
        <label class="novo_titulo" style="color: #222; margin-right: 10vw;" id="cliente_status">${orcamento.dados_orcam.cliente_selecionado}</label>
    </div>
    `

    var analista = dados_orcamentos[id]['dados_orcam'].analista
    var acumulado_botoes = ''

    if (modulo !== 'PROJETOS' || document.title == 'Projetos' || document.title == 'PAGAMENTOS') {
        acumulado_botoes += `
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="abrir_esquema('${id}')">
            <img src="esquema.png" style="width: 48px; height: 48px; margin: 3px;">
            <label style="cursor: pointer;">Histórico</label>
        </div>           
        `
    }

    acumulado_botoes += `
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="chamar_duplicar('${id}')">
            <img src="duplicar.png">
            <label style="cursor: pointer;">Duplicar Orçamento</label>
        </div>      
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="ir_pdf('${id}')">
            <img src="pdf.png" style="width: 55px;">
            <label style="cursor: pointer;">Abrir Orçamento em PDF</label>
        </div>
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="ir_excel('${id}')">
            <img src="excel.png">
            <label style="cursor: pointer;">Baixar Orçamento em Excel</label>
        </div>
        `

    if (orcamento.lpu_ativa == 'LPU CARREFOUR') {
        acumulado_botoes += `
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="rir('${id}')">
            <img src="carrefour.png" style="width: 48px; height: 48px; margin: 3px;">
            <label style="cursor: pointer;">Itens Reais em Excel</label>
        </div> 
    `}

    if ((modulo == 'PROJETOS' && document.title !== 'Projetos' && analista == acesso.nome_completo) || (acesso.permissao == 'adm' || acesso.permissao == 'fin')) {
        acumulado_botoes += `
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="chamar_excluir('${id}')">
            <img src="apagar.png" style="width: 48px; height: 48px; margin: 3px;">
            <label style="cursor: pointer;">Excluir Orçamento</label>
        </div>    
        <div style="cursor: pointer; display: flex; gap: 10px; align-items: center; justify-content: left;" onclick="chamar_editar('${id}')">
            <img src="editar2.png" style="width: 48px; height: 48px; margin: 3px;">
            <label style="cursor: pointer;">Editar Orçamento</label>
        </div>         
        `
    }

    acumulado += `
    <hr style="width: 80%">
    <div style="display: flex; flex-direction: column; justify-content: center;">
        ${acumulado_botoes}                  
    </div> 
    `

    if (modulo == 'PROJETOS' || modulo == 'RELATÓRIOS' || document.title == 'Projetos') {
        acumulado += botao_novo_pedido(id)
    }

    if (orcamento.status) {

        Object.keys(orcamento.status).forEach(chave_pedido => {

            var pedido_completo = orcamento.status[chave_pedido]
            var st = pedido_completo

            status_tit = st.status

            Object.keys(st.historico).forEach(chave2 => {
                var his = st.historico[chave2]

                var exibir_label = false;
                fluxograma[his.status].modulos.forEach(sst => {
                    if (sst === modulo) {
                        exibir_label = true;
                    }
                });


                if (his.status == status_tit && exibir_label) {

                    var coments = his.comentario.replace(/\n/g, '<br>')
                    var funcao = ''

                    if (String(st.status).includes('REQUISIÇÃO') && (acesso.permissao == 'adm' || acesso.permissao == 'log')) {
                        funcao += `detalhar_requisicao('${chave_pedido}')`

                    } else if (String(st.status).includes('FATURAMENTO')) { // O status irá seguir para o próximo passo sempre... exceto no FATURADO.
                        if (acesso.permissao == 'adm' || acesso.permissao == 'fin') {
                            funcao += `carregar_status_divs('${st.status}', '${chave_pedido}', '${id}', '${chave2}')`
                        }

                    } else if (!String(st.status).includes('FATURADO')) { // O status irá seguir para o próximo passo sempre... exceto no FATURADO.
                        if (acesso.permissao == 'adm' || acesso.permissao == 'log' || acesso.permissao == 'user') {
                            funcao += `carregar_status_divs('${st.status}', '${chave_pedido}', '${id}', '${chave2}')`
                        }

                    }

                    acumulado += `
                    <hr style="width: 80%">
                    <div class="avenida_contorno" style="box-shadow: 3px 3px #222; background-color: #e8e8e8">
                        <label><strong>Status: </strong>${his.status}</label>
                        <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                            <label><strong>Número: </strong>${st.pedido}</label>
                            <img src="alerta.gif" style="width: 2vw; cursor: pointer;" onclick="popup_atualizar_pedido('${chave_pedido}')">
                        </div>
                        <label><strong>Data: </strong> ${his.data}</label>
                        <label><strong>Executor: </strong> ${his.executor}</label>
                        <label><strong>Comentário: </strong> <br>${coments}</label>
                        <div class="contorno_botoes" style="background-color: ${fluxograma[st.status].cor}" onclick="${funcao}">
                            <label>Continuar</label>
                        </div>
                    </div>
                    `
                }

            })

        })
    }

    status_tit == '' ? status_tit = 'AGUARDANDO' : ''

    var elementus = `
    <div id="espelho_ocorrencias" class="status" style="display: flex;">
    ${acumulado}
    </div>
    `
    document.body.insertAdjacentHTML('beforeend', elementus)

}

const { shell } = require('electron');

function abrirArquivo(link) {
    shell.openExternal(link);
}

function popup_atualizar_item(chave1, item) {

    openPopup_v2(`
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: left;">
            <label>Atualize a informação</label>
            <input class="pedido" style="width: 100%" id="elemento_para_atualizado">
            <button style="background-color: green;" onclick="atulizar_item('${chave1}', '${item}')">Salvar</button>
        </div>
    `)
}

function atulizar_item(chave1, item) {

    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos'))
    var orcamento = dados_orcamentos[id_orcam]

    var novo = elemento_para_atualizado.value

    novo == '' ? novo = '???' : ''

    orcamento.status[chave1][item] = novo

    localStorage.setItem('dados_orcamentos', JSON.stringify(dados_orcamentos))

    enviar_status_orcamento(orcamento)

    remover_popup()

    var estrutura = document.getElementById('estrutura')
    if (estrutura) {
        estrutura.remove()
        abrir_esquema(id_orcam)
    } else {
        exibir_todos_os_status(id_orcam)
    }

}

function abrir_esquema(id) {

    overlay.style.display = 'block'
    var estrutura = document.getElementById('estrutura')
    if (estrutura) {
        estrutura.remove()
    }

    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {};
    var lista_pagamentos = JSON.parse(localStorage.getItem('lista_pagamentos')) || {};
    var dados_categorias = JSON.parse(localStorage.getItem('dados_categorias')) || {};
    var dados_etiquetas = JSON.parse(localStorage.getItem('dados_etiquetas')) || {};

    var categorias = Object.fromEntries(
        Object.entries(dados_categorias).map(([chave, valor]) => [valor, chave])
    );

    console.log(dados_orcamentos[id])

    if (dados_orcamentos[id] && dados_orcamentos[id].status) {
        var todos_os_status = dados_orcamentos[id].status;

        var etiquetas = ''
        if (dados_orcamentos[id].etiqueta) {
            var etiquetas_orcamento = dados_orcamentos[id].etiqueta

            Object.keys(etiquetas_orcamento).forEach(et => {
                var etiqueta = dados_etiquetas[et]
                etiquetas += `
                <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                    <div class="contorno_botoes" style="background-color: ${etiqueta.cor}" onclick="remover_etiqueta('${id_orcam}', '${et}')">
                    ${etiqueta.nome}
                    </div>
                    <label style="font-size: 0.6em;">${etiquetas_orcamento[et]}</label>
                </div>    
                `
            })
        }

        var levantamentos = ''

        if (dados_orcamentos[id].levantamentos) {

            for (chave in dados_orcamentos[id].levantamentos) {

                var levantamento = dados_orcamentos[id].levantamentos[chave]

                var imagem = ''

                if (formato(levantamento.formato) == 'PDF') {
                    imagem = 'pdf'
                } else if (formato(levantamento.formato) == 'IMAGEM') {
                    imagem = 'imagem'
                } else if (formato(levantamento.formato) == 'PLANILHA') {
                    imagem = 'excel2'
                } else {
                    imagem = 'anexo'
                }

                levantamentos += `
                <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                    <div style="align-items: center; width: max-content; font-size: 0.7em; display: flex; justify-content; left; box-shadow: 2px 2px #94a0ab; background-color: #e9e9e9; color: #555; padding: 5px; margin:5px; border-radius: 5px;">
                        <img src="${imagem}.png" style="width: 25px;">
                        <label><strong>${encurtar_texto(levantamento.nome, 10)}</strong></label>
                    </div>
                    <label style="text-decoration: underline; font-size: 0.7em; cursor: pointer;" onclick="excluir_levantamento('${id}', '${chave}')">Excluir</label>
                </div>
                `
            }
        }

        var acumulado = `
        <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
            <div onclick="atualizar_esquema()" style="display: flex; flex-direction: column; justify-content: left; align-items: center; cursor: pointer;">
                <img src="atualizar2.png" style="width: 50px;">
                <label>Atualizar</label>
            </div>
            • 
            <label class="novo_titulo" style="color: #222">${dados_orcamentos[id].dados_orcam.cliente_selecionado}</label>
            • 
            <label class="novo_titulo" style="color: #222">${dados_orcamentos[id].dados_orcam.contrato}</label>
            •
            <div onclick="selecionar_etiqueta()" class="contorno_botoes" style="display: flex; gap: 10px; align-items: center; justify-content: center; background-color: #222;"> 
                <img src="etiqueta.png" style="width: 20px;">
                <label>Etiqueta</label>
            </div>
            •
            <div>${etiquetas}</div>

            <div style="display: flex; flex-direction: column; align-items: start;">
                <div class="contorno_botoes" style="background-color: #222;">
                    <img src="anexo2.png" style="width: 15px;">
                    <label for="adicionar_levantamento">Anexar levantamento
                        <input type="file" id="adicionar_levantamento" style="display: none;"
                            onchange="salvar_levantamento('${id}')">
                    </label>
                </div>
                ${levantamentos}
            </div>

        </div>    
        `;
        var contador = 1;

        Object.keys(todos_os_status).forEach(chave_pedido => {

            var lista_interna = todos_os_status[chave_pedido].historico;
            var blocos = '';
            var links_requisicoes = ''
            var string_pagamentos = ''
            var tem_pagamento = false

            var pagamentos_painel = {}

            Object.keys(lista_pagamentos).forEach(pag => {
                var pagamento = lista_pagamentos[pag]
                var comentario = 'Sem observação'
                if (pagamento.param[0].observacao) {
                    comentario = pagamento.param[0].observacao.replace(/\|/g, '<br>')
                }

                if (pagamento.id_pedido == chave_pedido || pagamento.pedido == todos_os_status[chave_pedido].pedido) {
                    string_pagamentos += `
                    <div style="display: flex; flex-direction: column; border-radius: 5px; border: solid 1px white; padding: 10px; background-color: white; color: #222;">
                            
                        <label style="display: flex; gap: 10px;"><strong>${pagamento.status}</strong></label>
                        <label><strong>Data:</strong> ${pagamento.param[0].data_previsao}</label>
                        <label><strong>Observação:</strong><br>${comentario}</label>
                        `
                    pagamento.param[0].categorias.forEach(cat => {
                        var nome_cat = ''
                        categorias[cat.codigo_categoria] ? nome_cat = categorias[cat.codigo_categoria] : nome_cat = cat.codigo_categoria
                        string_pagamentos += `
                        <label><strong>Categoria:</strong> ${nome_cat} • R$ ${dinheiro(cat.valor)}</label>
                        `

                        if (!pagamentos_painel[pagamento.status]) {
                            pagamentos_painel[pagamento.status] = 0
                        }
                        pagamentos_painel[pagamento.status] += Number(cat.valor)

                    })
                    string_pagamentos += `
                        </div>
                    `
                    tem_pagamento = true
                }
            })

            if (tem_pagamento) {
                blocos += `
                <div class="bloko" style="background-color: #097fe6">
                    <div style="display: flex; gap: 10px; justify-content: center; align-items: center; margin-bottom: 10px;">
                    <img src="pesquisar.png" style="width: 25px; height: 25px;">
                    <input id="${chave_pedido}" style="padding: 10px; border-radius: 5px;" placeholder="Pesquisar pagamento" oninput="pesquisar_pagamentos('${chave_pedido}')">
                    </div>
                    <div id="div_pagamentos_pesquisa_${chave_pedido}" style="display: flex; flex-direction: column; gap: 10px;">
                    ${string_pagamentos}
                    </div>
                </div>
            `}

            Object.keys(lista_interna).forEach(chave2 => {

                var sst = lista_interna[chave2]
                var anxsss = ''
                links_requisicoes = ''

                if (String(sst.status).includes('FATURAMENTO') || String(sst.status).includes('REMESSA')) {

                    links_requisicoes += `
                    <div class="anexos" style="cursor: pointer; display: flex; gap: 10px; justify-content: left; align-items: center;">
                        <img src="anexo.png" style="width: 25px">
                        <label style="cursor: pointer;" onclick="detalhar_requisicao('${chave_pedido}', true, '${chave2}')"><strong>Requisição disponível</strong> <br> ${todos_os_status[chave_pedido].pedido} - ${todos_os_status[chave_pedido].tipo}</label>
                        <div onclick="detalhar_requisicao('${chave_pedido}', false, '${chave2}')" style="cursor: pointer; display: flex; flex-direction: column; justify-content: left; align-items: center;">    
                            <img src="alerta.gif" style="width: 2vw">
                            <label style="text-decoration: underline; cursor: pointer; font-size: 0.8em;">Editar</label>
                        </div>
                    </div>
                    `
                }

                if (sst.anexos) {

                    Object.keys(sst.anexos).forEach(key_anx => {

                        var anx = sst.anexos[key_anx]

                        var imagem = ''

                        if (formato(anx.formato) == 'PDF') {
                            imagem = 'pdf'
                        } else if (formato(anx.formato) == 'IMAGEM') {
                            imagem = 'imagem'
                        } else if (formato(anx.formato) == 'PLANILHA') {
                            imagem = 'excel2'
                        } else {
                            imagem = 'anexo'
                        }

                        var arquivo = `https://drive.google.com/file/d/${anx.link}/view?usp=drivesdk`

                        anxsss += `
                    <div style="display: flex; gap: 5px; align-items: center;">
                    <div onclick="abrirArquivo('${arquivo}')" class="anexos">
                        <img src="${imagem}.png" style="cursor: pointer; width: 30px; height: 30px">
                        <label style="cursor: pointer; font-size: 0.6em"><strong>${anx.nome}</strong></label>
                    </div>
                    <p style="text-decoration: underline; cursor: pointer; padding: 5px;" onclick="chamar_excluir_anexo('${chave_pedido}', '${chave2}', '${key_anx}')">Excluir</p>
                    </div>
                    `
                    })

                }

                var notas = ''

                if (sst.notas) {
                    notas += `
                ${sst.notas[0].nota} - ${sst.notas[0].pedido}
                `
                }

                var totais = ''

                if (sst.requisicoes) {

                    var infos = calcular_quantidades(sst.requisicoes, dados_orcamentos[id].dados_composicoes)

                    totais += `9
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; flex-direction: column;">
                            <label><strong>Total S/ICMS: </strong><br>${sst.total_sem_icms}</label>
                            <label><strong>Total C/ICMS: </strong><br>${sst.total_com_icms}</label>
                        </div>
                        <div class="contorno_botoes" style="border-radius: 3px; padding: 10px; background-color: ${infos.cor};">
                        <label>${infos.label_porcentagem}</label>
                        </div>
                    </div>
                    `
                }

                var dados_de_envio = ''
                if (sst.envio) {

                    function conv_data(data) {

                        if (data !== '') {
                            var split_data = String(data).split('-')
                            data = `${split_data[2]}/${split_data[1]}/${split_data[0]}`
                        }

                        return data
                    }

                    var envio = sst.envio
                    dados_de_envio = `
                    <label><strong>Rastreio:</strong> ${envio.rastreio}</label>
                    <label><strong>Custo do Frete:</strong> ${dinheiro(envio.custo_frete)}</label>
                    <label><strong>NF </strong> ${envio.nf}</label>
                    <label><strong>Requisição:</strong> ${envio.requisicao}</label>
                    <label><strong>Transportadora:</strong> ${envio.transportadora}</label>
                    <label><strong>Volumes:</strong> ${envio.volumes}</label>
                    <label><strong>Data de Saída:</strong> ${conv_data(envio.data_saida)}</label>
                    <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                        <label><strong>Data da Entrega:</strong> ${conv_data(envio.data_entrega)}</label>
                        <img src="alerta.gif" style="width: 30px; cursor: pointer;" onclick="pop_alterar_data_recebimento('${id_orcam}', '${chave_pedido}', '${chave2}')">
                    </div>
                    `
                }

                var coments = sst.comentario.replace(/\n/g, '<br>')

                blocos += `
                <div class="bloko" style="border: 1px solid ${fluxograma[sst.status].cor}">
                    <div style="display: flex; flex-direction: column; background-color: ${fluxograma[sst.status].cor}1f; padding: 3px; border-radius: 3px; padding: 3px; height: 100%;">
                        <span class="close" style="position: absolute; top: 15px; right: 15px;" onclick="deseja_apagar('historico', '${chave_pedido}', '${chave2}')">&times;</span>
                        <label><strong>Status: </strong>${sst.status}</label>
                        <label><strong>Executor: </strong>${sst.executor}</label>
                        <label><strong>Data: </strong>${sst.data}</label>
                        <label><strong>Comentário: </strong> <br> ${coments}</label>
                        ${sst.notas ? `<label><strong>NF</strong>${notas}</label>` : ''}
                        ${totais}
                        ${dados_de_envio}
                        ${links_requisicoes}
                        <div style="display: flex; justify-content: space-evenly; align-items: center;">
                            <div class="contorno_botoes">
                                <img src="anexo2.png" style="width: 15px;">
                                <label for="adicionar_anexo_${chave_pedido}_${chave2}">Anexo
                                    <input type="file" id="adicionar_anexo_${chave_pedido}_${chave2}" style="display: none;" onchange="salvar_anexo('${chave_pedido}', '${chave2}')"> 
                                </label>
                            </div>
                            <div class="contorno_botoes" onclick="toggle_comentario('comentario_${chave2}')">
                                <img src="comentario.png" style="width: 15px;">
                                <label>Comentário</label>
                            </div>
                        </div>
                        <div id="comentario_${chave2}" style="display: none; justify-content: space-evenly; align-items: center;">

                            <textarea placeholder="Comente algo aqui..."></textarea>

                            <label class="contorno_botoes" style="background-color: green;" onclick="salvar_comentario_trello('${chave2}')">Salvar</label>
                            <label class="contorno_botoes" style="background-color: #B12425;" onclick="toggle_comentario('comentario_${chave2}')">&times;</label>

                        </div>
                        <div id="caixa_comentarios_${chave2}" style="display: flex; flex-direction: column;">
                            ${carregar_comentarios(chave2)}
                        </div>
                        ${anxsss}            
                    </div>
                </div>
            `;

            });

            var mod = ''
            fluxograma[todos_os_status[chave_pedido].status].modulos.map(m => mod += ` • ${m}`)

            var pags = ''
            Object.keys(pagamentos_painel).forEach(pg => {
                pags += `
                <label><strong>${pg}</strong> ${dinheiro(pagamentos_painel[pg])}</label>
                `
            })

            var div_pags = `
            <div class="contorno_botoes" style="display: flex; flex-direction: column; padding: 10px; border-radius: 5px; background-color: #222222bf; color: white;">
                <label>Pagamentos neste Pedido</label>
                ${pags}
            </div>            
            `

            var valor_do_pedido = '???'
            if (todos_os_status[chave_pedido].valor) {
                valor_do_pedido = dinheiro(todos_os_status[chave_pedido].valor)
            }

            var linhas = `
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <hr style="width: 80%;">
                    <div style="display: flex; gap: 10px;">
                        <div
                            style="display: flex; align-items: center; font-size: 1.5em; font-weight: bold; background-color: #444; color: #fff; padding: 5px 10px; border-radius: 5px;">
                            ${contador}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
                                <label style="text-align: left; width: 100%;">${mod}</label>
                                <p style="text-decoration: underline; cursor: pointer;"
                                    onclick="deseja_apagar('pedido', '${chave_pedido}')">Excluir este número de Pedido</p>
                            </div>

                            <label style="text-align: left; width: 100%;"><strong>Situação atual:</strong>
                                ${todos_os_status[chave_pedido].status}</label>
                            <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                                <label style="text-align: left;"><strong>Número do pedido:</strong>
                                    ${todos_os_status[chave_pedido].pedido}</label>
                                <img src="alerta.gif" style="width: 2vw; cursor: pointer;"
                                    onclick="popup_atualizar_item('${chave_pedido}', 'pedido')">
                            </div>

                            <div style="display: flex; gap: 10px; justify-content: left; align-items: center;">
                                <label style="text-align: left;"><strong>Valor deste Pedido</strong>
                                    ${valor_do_pedido}</label>
                                <img src="alerta.gif" style="width: 2vw; cursor: pointer;"
                                    onclick="popup_atualizar_item('${chave_pedido}', 'valor')">
                            </div>
                            
                            <div style="display: flex; gap: 10px;">
                                ${botao_novo_pagamento(chave_pedido)}
                                ${botao_novo_pedido(id)}
                                <div class="contorno_botoes" style="background-color: ${fluxograma['FATURAMENTO PEDIDO DE VENDA'].cor}"
                                    onclick="detalhar_requisicao('${chave_pedido}')">
                                    <label>Nova <strong>Requisição</strong></label>
                                </div>
                                <div class="contorno_botoes" style="background-color: ${fluxograma['PEDIDO DE VENDA FATURADO'].cor};"
                                    onclick="carregar_status_divs('FATURAMENTO', '${chave_pedido}', '${id}')">
                                    <label>Nova <strong>Nota Fiscal</strong></label>
                                </div>
                                <div class="contorno_botoes" style="background-color: ${fluxograma['MATERIAL ENVIADO'].cor};"
                                    onclick="envio_de_material('${chave_pedido}', '${id}')">
                                    <label>Envio de <strong>Material</strong></label>
                                </div>
                            </div>
                        </div>

                        ${pags !== '' ? div_pags : ''}

                    </div>
                    <div class="container-blocos">
                        ${blocos}
                    </div>
                </div>
            `;

            acumulado += linhas;
            contador++;

        });

        var estruturaHtml = `
        <div id="estrutura" class="status" style="display: flex; flex-direction: column; gap: 10px; width: 100%; height: 100vh; overflow: auto;">
        <span class="close" onclick="fechar_estrutura()">&times;</span>
        ${acumulado}
        </div>
    `;
        document.body.insertAdjacentHTML('beforeend', estruturaHtml);

        fechar_espelho_ocorrencias();
    } else {
        openPopup_v2('Não existem dados históricos')
    }

}

function pop_alterar_data_recebimento(id_orcam, chave, chave2) {

    openPopup_v2(`
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: left;">
            <label>Atualizar a data de recebimento:</label>
            <input class="pedido" type="date" id="elemento_para_atualizado">
            <button style="background-color: green;" onclick="alterar_data_recebimento('${id_orcam}', '${chave}', '${chave2}')">Salvar</button>
        </div>
        `)

}

function alterar_data_recebimento(id_orcam, chave, chave2) {

    var nova_data = document.getElementById('elemento_para_atualizado')
    if (nova_data) {

        var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}

        dados_orcamentos[id_orcam].status[chave].historico[chave2].envio.data_entrega = nova_data.value

        localStorage.setItem('dados_orcamentos', JSON.stringify(dados_orcamentos))

        remover_popup()
        abrir_esquema(id_orcam)
    }

}

function envio_de_material(chave1, id_orcam) {

    var dados_orcamento = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}

    var historico = dados_orcamento[id_orcam].status[chave1].historico
    var itens = ''
    var nfs = ''

    for (his in historico) {
        var conteudo = historico[his]
        if (conteudo.requisicoes) {
            itens += `
            <option>${conteudo.executor} - ${conteudo.total_com_icms}</option>
            `
        }
        if (conteudo.notas) {
            conteudo.notas.forEach(nf => {
                nfs += `
                <option>${nf.nota}</option>
                `
            })
        }
    }

    var acumulado = `
    <div style="display: flex; gap: 10px; justify-content: center; align-items: center; margin-bottom: 10px;">
        <img src="logistica.png" style="width: 50px;">
        <label class="novo_titulo">Registrar Envio de Material</label>
    </div>
    <div id="painel_envio_de_material">
        <div class="pergunta">
            <label>Número de rastreio</label>
            <input id="rastreio">
        </div>

        <div class="pergunta">
            <label>Requisição</label>
            <select id="requisicao">
                ${itens}
            </select>
        </div>        

        <div class="pergunta">
            <label>Transportadora</label>
            <select id="transportadora">
                <option>JAMEF</option>
                <option>CORREIOS</option>
                <option>RODOVIÁRIA</option>
                <option>JADLOG</option>
                <option>OUTROS</option>
            </select>
        </div>

        <div class="pergunta">
            <label>Custo do Frete</label>
            <input type="number" id="custo_frete">
        </div>

        <div class="pergunta">
            <label>Nota Fiscal</label>
            <select id="nf">${nfs}
            </select>
        </div>

        <div class="pergunta">
            <label>Comentário</label>
            <textarea id="comentario"></textarea>
        </div>

        <div class="pergunta">
            <label>Quantos volumes?</label>
            <input type="number" id="volumes">
        </div>

        <div class="pergunta">
            <label>Data de Saída</label>
            <input type="date" id="data_saida">
        </div>

        <div class="pergunta">
            <label>Data da entrega</label>
            <input type="date" id="data_entrega">
        </div>
      
    </div>

    <div style="display: flex; gap: 10px; position: absolute; bottom: -50px; left: 0;">
        <label style="background-color: green; border: 1px solid #888;" class="contorno_botoes"
        onclick="registrar_envio_material('${chave1}', '${id_orcam}')">Salvar</label>
    </div>
    `
    openPopup_v2(acumulado)

}

function registrar_envio_material(chave1, id_orcam) {

    var campos = ['rastreio', 'requisicao', 'transportadora', 'custo_frete', 'nf', 'comentario', 'volumes', 'data_saida', 'data_entrega']
    var status = {
        envio: {}
    }

    campos.forEach(campo => {
        var info = document.getElementById(campo)
        var valor = info.value

        if (info.type == 'number') {
            valor = Number(info.value)
        }

        if (campo == 'comentario') {
            status[campo] = valor
        } else {
            status.envio[campo] = valor
        }

    })

    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}
    var historico = dados_orcamentos[id_orcam].status[chave1].historico

    var acesso = JSON.parse(localStorage.getItem('acesso')) || {}

    status.executor = acesso.usuario
    status.data = data_status
    status.status = 'MATERIAL ENVIADO'
    dados_orcamentos[id_orcam].status[chave1].status = 'MATERIAL ENVIADO'

    var id = gerar_id_5_digitos()
    historico[id] = status
    localStorage.setItem('dados_orcamentos', JSON.stringify(dados_orcamentos))

    enviar_status_orcamento(dados_orcamentos[id_orcam])

    remover_popup()
    abrir_esquema(id_orcam)

}

function calcular_quantidades(requisicoes, itens_no_orcamento) {

    if (itens_no_orcamento == undefined) {

        return { cor: '', label_porcentagem: '' }
    }

    var porcentagem = {
        qtde_enviar: 0,
        qtde_orcamento: 0
    }

    if (!dicionario(itens_no_orcamento)) {
        var novo_itens_do_orcamento = {};

        itens_no_orcamento.forEach(it => {
            if (!novo_itens_do_orcamento[it.codigo]) {
                novo_itens_do_orcamento[it.codigo] = it;
            }
        });

        itens_no_orcamento = novo_itens_do_orcamento;
    }

    requisicoes.forEach(req => {

        var qtde_enviar = conversor(req.qtde_enviar)
        var qtde_orcamento = conversor(itens_no_orcamento[req.codigo].qtde)

        porcentagem.qtde_enviar += qtde_enviar
        porcentagem.qtde_orcamento += qtde_orcamento

    })

    var valor_porcentagem = (porcentagem.qtde_enviar / porcentagem.qtde_orcamento) * 100
    var cor = '#B12425'
    var label_porcentagem = `${valor_porcentagem.toFixed(0)}% Preenchido`

    if (!porcentagem.qtde_enviar || !porcentagem.qtde_orcamento) {
        label_porcentagem = 'Em branco'
    }

    if (valor_porcentagem > 90) {
        cor = 'green'
    } else if (valor_porcentagem > 50) {
        cor = 'orangered'
    } else if (valor_porcentagem > 20) {
        cor = 'orange'
    }

    var infos = {
        label_porcentagem: label_porcentagem,
        cor: cor
    }

    return infos

}

function calcular_quantidades_v2(historico, itens_no_orcamento) {

    for (chave2 in historico) {
        if (historico[chave2].requisicoes) {
            var requisicoes = historico[chave2].requisicoes

            requisicoes.forEach(item => {
                if (!quantidades[item.codigo]) {
                    quantidades[item.codigo] = {
                        qtde_enviar: 0,
                        qtde_orcamento: 0,
                        porcentagem: 0
                    };
                }

                var qtde_enviar = conversor(item.qtde_enviar)
                var qtde_orcamento = conversor(itens_no_orcamento[item.codigo].qtde)
                var porcentagem = qtde_enviar / qtde_orcamento

                quantidades[item.codigo].qtde_enviar += qtde_enviar
                quantidades[item.codigo].qtde_orcamento += qtde_orcamento
                quantidades[item.codigo].porcentagem += porcentagem
            })
        }
    }

    return quantidades

}

function confirmar_exclusao_comentario(id_comentario, chave2) {

    openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="alerta.gif" style="width: 3vw; height: 3vw;">
            <label>Excluir o comentário?</label>
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
            <button onclick="excluir_comentario('${id_comentario}', '${chave2}')" style="background-color: green">Confirmar</button>
            <button onclick="remover_popup()">Cancelar</button>
            </div>
        </div>
        `)
}

function excluir_comentario(id_comentario, chave2) {
    var dados_comentarios = JSON.parse(localStorage.getItem('dados_comentarios')) || {}

    if (dados_comentarios[id_comentario]) {
        var comentario = dados_comentarios[id_comentario]

        var dados = {
            tabela: 'data_recebimento',
            operacao: 'excluir',
            comentario
        }

        enviar_dados_generico(dados)

        comentario.operacao = 'excluir'

        localStorage.setItem('dados_comentarios', JSON.stringify(dados_comentarios))

        carregar_comentarios(chave2, `caixa_comentarios_${chave2}`)
        remover_popup()
    }

}

function carregar_comentarios(chave2, div_caixa) {

    var dados_comentarios = JSON.parse(localStorage.getItem('dados_comentarios')) || {}
    var acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    var comentss = ''
    Object.keys(dados_comentarios).forEach(it => {

        var item = dados_comentarios[it]

        var excluir = ''

        if (acesso.usuario == item.usuario || acesso.permissao == 'adm') {
            excluir = ` •<label onclick="confirmar_exclusao_comentario('${it}', '${chave2}')" style="text-decoration: underline; cursor: pointer;"> Excluir</label>`
        }

        if (item.chave2 == chave2 && item.operacao !== 'excluir') {
            comentss += `
            <div class="anexos" style="width: 95%;">
                <label>${item.comentario.replace(/\n/g, '<br>')}
                <br><strong>${item.data} • ${item.usuario}</strong>${excluir}</label>
            </div>
        `
        }
    })

    if (div_caixa == undefined) {
        return comentss
    } else {
        document.getElementById(div_caixa).innerHTML = comentss
    }
}

function salvar_comentario_trello(chave2) {

    var id = `comentario_${chave2}`
    var textarea = document.getElementById(id).querySelector('textarea')

    var dados_comentarios = JSON.parse(localStorage.getItem('dados_comentarios')) || {}
    var acesso = JSON.parse(localStorage.getItem('acesso')) || {}

    var id = unicoID()

    var comentario = {
        id: id,
        chave2: chave2,
        comentario: textarea.value,
        data: data_atual('completa'),
        usuario: acesso.usuario
    }

    dados_comentarios[id] = comentario

    textarea.value = ''

    var dados = {
        tabela: 'comentarios',
        operacao: 'incluir',
        comentario
    }

    enviar_dados_generico(dados)

    localStorage.setItem('dados_comentarios', JSON.stringify(dados_comentarios))

    carregar_comentarios(chave2, `caixa_comentarios_${chave2}`)

    toggle_comentario(`comentario_${chave2}`)

}


function toggle_comentario(id) {
    var elemento = document.getElementById(id)
    if (elemento.style.display == 'none') {
        elemento.style.display = 'flex'
    } else {
        elemento.style.display = 'none'
    }
}

function selecionar_etiqueta() {

    var dados_etiquetas = JSON.parse(localStorage.getItem('dados_etiquetas')) || {}

    var etiquetas = ''
    Object.keys(dados_etiquetas).forEach(et => {

        var etiqueta = dados_etiquetas[et]
        etiquetas += `
        <div class="contorno_botoes" style="background-color: ${etiqueta.cor}; font-size: 0.7em;" onclick="associar_etiqueta('${id_orcam}', '${et}')">
        ${etiqueta.nome}
        </div>
        `
    })

    var acumulado = `
    <label class="novo_titulo">Etiquetas</label>
    <div class="contorno_botoes" style="background-color: white; display; flex; gap: 10px; justify-content: center; align-items: center;">
        <input placeholder="Nova Etiqueta" id="etiqueta_nome">
        <input type="color" id="etiqueta_cor">
        <label style="color: #222;" onclick="nova_etiqueta()">Salvar</label>
    </div>
    <div>
    ${etiquetas}
    </div>
    `

    openPopup_v2(acumulado)

}

function nova_etiqueta() {

    var cor = document.getElementById('etiqueta_cor')
    var nome = document.getElementById('etiqueta_nome')

    if (cor && nome) {

        var id = unicoID()
        var dados_etiquetas = JSON.parse(localStorage.getItem('dados_etiquetas')) || {}

        dados_etiquetas[id] = {
            nome: nome.value,
            cor: cor.value
        }

        nova_etiqueta_api(id, nome.value, cor.value)

        localStorage.setItem('dados_etiquetas', JSON.stringify(dados_etiquetas))

        remover_popup()
        selecionar_etiqueta()

    }
}

function nova_etiqueta_api(id, nome, cor) {

    var dados = {
        'tabela': 'nova_etiqueta',
        'nome': nome,
        'cor': cor,
        'id': id
    }

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dados)
    })

}

function associar_etiqueta(id, id_etiqueta) {
    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}

    if (!dados_orcamentos[id].etiqueta) {
        dados_orcamentos[id].etiqueta = {}
    }
    var dt = data_atual('completa')
    dados_orcamentos[id].etiqueta[id_etiqueta] = dt

    atualizar_etiqueta(id, id_etiqueta, dt)

    localStorage.setItem('dados_orcamentos', JSON.stringify(dados_orcamentos))

    fechar_estrutura()
    abrir_esquema(id)

    inicializar()
}


function remover_etiqueta(id, id_etiqueta) {

    openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="alerta.gif" style="width: 3vw; height: 3vw;">
            <label>Remover a etiqueta?</label>
            <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
            <button onclick="remover_mesmo_a_etiqueta('${id}', '${id_etiqueta}')" style="background-color: green">Confirmar</button>
            <button onclick="remover_popup()">Cancelar</button>
            </div>
        </div>
        `)

}


function remover_mesmo_a_etiqueta(id, id_etiqueta) {
    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}
    delete dados_orcamentos[id].etiqueta[id_etiqueta]

    localStorage.setItem('dados_orcamentos', JSON.stringify(dados_orcamentos))

    atualizar_etiqueta(id, id_etiqueta, undefined, 'excluir')

    fechar_estrutura()
    abrir_esquema(id)

    remover_popup()

    var quadro = document.getElementById('quadro')
    if (quadro) {
        inicializar()
    }
}


async function atualizar_esquema() {
    openPopup_v2(`
    <div style="display: flex; width: 100%; align-items: center; justify-content: center; gap: 10px; color: #222;">
        <img src="loading.gif" style="width: 5vw">
        <label style="color: white; font-size: 1.5em;">Aguarde...</label>
    </div>
    `)
    recuperar()
    var estrutura = document.getElementById('estrutura')
    if (estrutura) {
        estrutura.remove()
    }

    await recuperar_orcamentos()
    var orcamentos = document.getElementById('orcamentos')
    if (orcamentos) {
        preencher_dados_orcamentos()
    }

    remover_popup()
    abrir_esquema(id_orcam)
}

function pesquisar_pagamentos(chave) {

    var todos_os_pagamentos = document.getElementById('div_pagamentos_pesquisa_' + chave)
    var pesquisa = String(document.getElementById(chave).value).toLowerCase()

    if (todos_os_pagamentos) {

        var divs = todos_os_pagamentos.querySelectorAll('div')

        divs.forEach(div => {

            var mostrar = false
            var labels = div.querySelectorAll('label')

            labels.forEach(label => {

                if (label.textContent.toLocaleLowerCase().includes(pesquisa) || pesquisa == '') {
                    mostrar = true
                }

            })

            if (mostrar) {
                div.style.display = 'flex'
            } else {
                div.style.display = 'none'
            }
        })

    }

}

function chamar_excluir_anexo(chave_pedido, chave2, key_anx) {

    openPopup_v2("Deseja excluir o anexo?", true, `excluir_anexo('${chave_pedido}', '${chave2}', '${key_anx}')`)

}


function excluir_anexo(chave, chave2, chave_anexo) {


    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos'))

    delete dados_orcamentos[id_orcam].status[chave].historico[chave2].anexos[chave_anexo]

    localStorage.setItem('dados_orcamentos', JSON.stringify(dados_orcamentos))

    excluir_status_na_nuvem(chave, chave2, chave_anexo)

    remover_popup()

    abrir_esquema(id_orcam)

}

function fechar_estrutura() {
    var estrutura = document.getElementById('estrutura')
    if (estrutura) {
        estrutura.remove()
    }
    remover_popup()
}

async function chamar_duplicar(id) {
    fechar_espelho_ocorrencias()
    await recuperar_orcamentos()
    duplicar(id)
}

async function chamar_editar(id) {
    fechar_espelho_ocorrencias()
    await recuperar_orcamentos()
    editar(id)
}

async function chamar_excluir(id) {
    openPopup_v2('Deseja realmente excluir o orçamento?', true, `apagar('${id}')`)
}

async function detalhar_requisicao(chave, apenas_visualizar, chave2) {

    itens_adicionais = {}

    var estrutura = document.getElementById('estrutura')
    if (estrutura) {
        estrutura.remove()
    }

    fechar_espelho_ocorrencias()

    overlay.style.display = 'block'

    dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {};
    orcamento = dados_orcamentos[id_orcam];

    var requisicao = {}
    var menu_flutuante = ''

    if (chave2) {

        menu_flutuante = `
        <div class="menu_flutuante" id="menu_flutuante">
            <div class="icone" onclick="gerarpdf('${orcamento.dados_orcam.cliente_selecionado}', '${orcamento.status[chave].pedido}')">
                <img src="pdf.png">
                <label>PDF</label>
            </div>
            <div class="icone" onclick="excel()">
                <img src="excel.png">
                <label>Excel</label>
            </div>
        </div> 
        `

        if (orcamento.status[chave].historico[chave2].adicionais) {
            itens_adicionais = orcamento.status[chave].historico[chave2].adicionais
        }

        orcamento.status[chave].historico[chave2].requisicoes.forEach(item => {
            requisicao[item.codigo] = {
                partnumber: item.partnumber,
                requisicao: item.requisicao,
                tipo: item.tipo,
                qtde_enviar: item.qtde_enviar
            }
        })

    }

    var nome_cliente = orcamento.dados_orcam.cliente_selecionado
    var campos = ''
    var toolbar = ''

    if (!apenas_visualizar) {
        toolbar += `
        <div style="display: flex; gap: 10px; justify-content: center; align-items: center; background-color: #151749; width: 60vw; margin-left: 2vw; border-top-left-radius: 5px; border-top-right-radius: 5px">
            <img src="pesquisar.png" style="width: 25px; height: 25px; padding: 5px;">
            <input id="pesquisa1" style="padding: 10px; border-radius: 5px; margin: 10px; width: 50%;" placeholder="Pesquisar" oninput="pesquisar_na_requisicao()">
            <label style="color: white;">Marque todos</label>
            <select onchange="alterar_todos(this.value)">
                <option>--</option>
                <option>All Nations</option>
                <option>Nada a fazer</option>
                <option>Estoque AC</option>
                <option>Comprar</option>
                <option>Enviar do CD</option>
                <option>Fornecido pelo Cliente</option>
            </select>
        
        </div>
        `
        var funcao = `salvar_status('${chave}', 'requisicao', '${chave2}')`
        if (chave2 == undefined) {
            funcao = `salvar_status('${chave}', 'requisicao')`
        }

        // Aqui é pra substituir mesmo...
        campos = `
        <div class="contorno">
            <div class="titulo" style="border-bottom-left-radius: 0px; border-bottom-right-radius: 0px; font-size: 1.0em;">Dados da Requisição</div>
            <div style="border-bottom-left-radius: 3px; border-bottom-right-radius: 3px; display: flex; flex-direction: column; background-color: #99999940; padding: 10px;">
                ${comentario}

                <label><strong>Escolha qual pedido vai se basear esta Requisição</strong></label>
                <select id="pedido_selecionado">
                    <option>Selecione</option>
                    ${carregar_pedidos(chave)}
                </select>
        
                <label class="contorno_botoes" style="background-color: green;" onclick="${funcao}">Salvar Requisição</label>
            </div>
        </div>
        `
    }

    var elementus = `   
    <span class="close" onclick="fechar_status()" id="span">&times;</span>

    ${menu_flutuante}

    <div style="display: flex; align-items: center; justify-content: center; width: 100%; background-color: #151749; border-radius: 3px;">
        <img src="https://i.imgur.com/AYa4cNv.png" 
    style="height: 100px;">
    </div>

    <div style="display: flex; align-items: center; justify-content: center; width: 100%;">
        <h1>REQUISIÇÃO DE COMPRA DE MATERIAL</h1>
    </div>

    <div style="display: flex; justify-content: left; align-items: center; margin: 10px;">

        ${campos}
            
        <div class="contorno">
            <div class="titulo" style="border-bottom-left-radius: 0px; border-bottom-right-radius: 0px; font-size: 1.0em;">Dados do Cliente</div>
            <div style="border-bottom-left-radius: 3px; border-bottom-right-radius: 3px; display: flex; flex-direction: column; background-color: #99999940; padding: 10px;">
                <label style="color: #222" id="nome_cliente"><strong>Cliente</strong> ${nome_cliente}</label>
                <label style="display: none" id="id_orcam"></label>
                <label style="color: #222"><strong>CNPJ</strong> ${orcamento.dados_orcam.cnpj}</label>
                <label style="color: #222"><strong>Endereço</strong> ${orcamento.dados_orcam.bairro}</label>
                <label style="color: #222"><strong>Cidade</strong> ${orcamento.dados_orcam.cidade}</label>
                <label style="color: #222"><strong>Estado</strong> ${orcamento.dados_orcam.estado}</label>
                <label style="color: #222"><strong>Chamado</strong> ${orcamento.dados_orcam.contrato}</label>
                <label style="color: #222"><strong>Número do Pedido</strong> ${orcamento.status[chave].pedido}</label>
                <label style="color: #222"><strong>Condições</strong> ${orcamento.dados_orcam.condicoes}</label>
            </div>
        </div>

        <div class="contorno">
            <div class="titulo" style="border-bottom-left-radius: 0px; border-bottom-right-radius: 0px;">Total</div>
            <div style="border-bottom-left-radius: 3px; border-bottom-right-radius: 3px; display: flex; flex-direction: column; background-color: #99999940; padding: 10px;">
                <div style="display: flex; gap: 10px;">
                    <label id="total_s_icms"></label>
                    <label style="font-size: 0.8em;"> <strong>Líquido (s/Icms)</strong> </label> 
                </div>
                <div style="display: flex; gap: 10px; color: red;">
                    <label id="total_c_icms"></label> 
                    <label style="font-size: 0.8em;"><strong>(c/Icms)</strong></label>
                </div>
            </div>
        </div>

    </div>

    <div id="tabela_itens" style="width: 100%; display: flex; flex-direction: column; align-items: left;">

    <div class="contorno">
        ${toolbar}
        <table class="tabela" id="tabela_requisicoes" style="width: 100%; font-size: 0.8em; table-layout: auto;">
            <thead>
                <th style="text-align: center;">Código</th>
                <th style="text-align: center;">PART NUMBER</th>
                <th style="text-align: center;">Informações do Item</th>                        
                <th style="text-align: center;">Tipo</th>         
                <th style="text-align: center;">Quantidade</th>
                <th style="text-align: center;">Valor Unitário</th>     
                <th style="text-align: center;">Valor Total</th>         
                <th style="text-align: center;">Requisição</th>
            </thead>
            <tbody>
            ${await carregar_itens(apenas_visualizar, requisicao)}
            </tbody>
        </table>
    <div>
    `
    var elementus_tus = `
    <div id="status" class="status" style="display: flex; width: 100%; overflow: auto;">
    ${elementus}
    </div>
    `
    document.body.insertAdjacentHTML('beforeend', elementus_tus)

    var comentario_status = document.getElementById('comentario_status')
    if (comentario_status && chave2 !== undefined) {
        comentario_status.value = orcamento.status[chave].historico[chave2].comentario
    }

    calcular_requisicao()
    mostrar_itens_adicionais()

}

function atualizar_status_logistico(st, chave, chave2) {

    dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {};
    orcamento = dados_orcamentos[id_orcam];

    var novo_lancamento = orcamento.status[chave].historico[chave2]

    var tbody = tabela_requisicoes.querySelector('tbody');

    if (tbody) { // Caso seja um orçamento em branco, não vai existir esse elemento;
        var trs = tbody.querySelectorAll('tr');

        var interromper_processo = false;

        novo_lancamento.requisicoes = []

        trs.forEach(tr => {

            if (tr.style.display !== 'none') {
                var tds = tr.querySelectorAll('td');

                var tds1Value = tds[1].querySelector('input')?.value || '';
                var tds8Value = tds[8].querySelector('input')?.value || '';
                var tds13Value = tds[13].querySelector('select')?.value || '--';

                if ((tds8Value !== '' || tds13Value !== '--') && (tds1Value === '' || tds8Value === '' || tds13Value === '--')) {
                    interromper_processo = true
                }

                novo_lancamento.requisicoes.push({
                    codigo: tds[0].textContent,
                    partnumber: tds[1].querySelector('input').value,
                    carrefour: tds[2].textContent,
                    descricao: tds[3].textContent,
                    modelo: tds[4].textContent,
                    fabricante: tds[5].textContent,
                    tipo: tds[6].textContent,
                    qtde_orcada: tds[7].textContent,
                    qtde_enviar: tds[8].querySelector('input').value,
                    valor_unit_sICMS: tds[9].textContent,
                    valor_total_sICMS: tds[10].textContent,
                    valor_venda: tds[11].textContent,
                    valor_total: tds[12].textContent,
                    requisicao: tds[13].querySelector('select').value
                });

            }
        });

        if (interromper_processo) {
            return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Se o item tiver quantidade, preencha também o PARTNUMBER e o status de Requisição</label>
            </div>
        `);
        }
    }

    var informacao_no_select = String(pedido_selecionado.value)
    var tipo = ''
    if (informacao_no_select.includes('Serviço')) {
        tipo = 'SERVIÇO'
    } else if (informacao_no_select.includes('Venda')) {
        tipo = 'VENDA'
    }

    if (informacao_no_select == 'Selecione') {
        return openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="alerta.gif" style="width: 3vw">
                <label>Não deixe o campo de pedido em branco, selecione um pedido.</label>
            </div>
            `)

    } else {
        st = `FATURAMENTO PEDIDO DE ${tipo}`
    }

    orcamento.status[chave].status = st //Atualiza fora;
    novo_lancamento.status = st //E dentro;
    novo_lancamento.data = data_status
    novo_lancamento.executor = acesso.usuario
    novo_lancamento.comentario = comentario_status.value
    novo_lancamento.anexos = anexos

    anexos = {} // Voltar a limpar a variável;

    localStorage.setItem('dados_orcamentos', JSON.stringify(dados_orcamentos))

    enviar_status_orcamento(orcamento)

    var mods = '';
    var concordancia_em_numero = '';
    fluxograma[st].modulos.map(it => mods += `<p><strong>${it}</strong></p>`);

    if (fluxograma[st].modulos.length == 1) {
        concordancia_em_numero = `
        <label>O orçamento foi transferido para o módulo abaixo:</label>
        `;
    } else {
        concordancia_em_numero = `
        <label>O orçamento foi transferido para os módulos abaixo:</label>
        `;
    }

    openPopup_v2(`
        <div style="display: flex; flex-direction: column; gap: 10px;">
            ${concordancia_em_numero}
            ${mods}
            <label>Com status → <strong>${st}</strong></label>
        </div>
    `);

    preencher_dados_orcamentos();

    var espelho_ocorrencias = document.getElementById('espelho_ocorrencias')
    if (espelho_ocorrencias) {
        fechar_espelho_ocorrencias()
    }

    abrir_esquema(id_orcam)

}

function close_chave() {
    exibir_todos_os_status(id_orcam)
    document.getElementById('alerta').remove()
}

function salvar_anexo(chave1, chave2) {
    if (chave1 !== undefined) {
        var elemento = document.getElementById(`adicionar_anexo_${chave1}_${chave2}`)
    } else {
        var elemento = document.getElementById(`adicionar_anexo`)
    }
    var file = elemento.files[0];

    openPopup_v2(`
        <div id="carregandhu" style="display: flex; align-items: center; justify-content: center;">
        </div>
        `)
    carregamento('carregandhu')

    if (file) {

        var fileInput = elemento
        var file = fileInput.files[0];
        var fileName = file.name

        if (!file) {
            openPopup_v2('Nenhum arquivo selecionado...');
            return;
        }

        var reader = new FileReader();
        reader.onload = async (e) => {
            var base64 = e.target.result.split(',')[1];
            var mimeType = file.type;

            var response = await fetch('http://localhost:3000/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: fileName,
                    mimeType: mimeType,
                    base64: base64
                })
            });

            var result = await response.json();
            if (response.ok) {

                var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos')) || {}

                if (chave1 == undefined && chave2 == undefined) {

                    anexos[gerar_id_5_digitos()] = {
                        nome: fileName,
                        formato: mimeType,
                        link: result.fileId
                    }

                    var imagem = ''

                    if (formato(mimeType) == 'PDF') {
                        imagem = 'pdf'
                    } else if (formato(mimeType) == 'IMAGEM') {
                        imagem = 'imagem'
                    } else if (formato(mimeType) == 'PLANILHA') {
                        imagem = 'excel2'
                    } else {
                        imagem = 'anexo'
                    }

                    var resposta = `
                    <div style="align-items: center; width: max-content; font-size: 0.7em; display: flex; justify-content; left; box-shadow: 2px 2px #94a0ab; background-color: #e9e9e9; color: #555; padding: 5px; margin:5px; border-radius: 5px;">
                        <img src="${imagem}.png" style="width: 3vw;">
                        <label><strong>${fileName}</strong></label>
                    </div>
                    `
                    div_anexos.style = 'align-items: normal'
                    div_anexos.insertAdjacentHTML('beforeend', resposta)

                } else {

                    if (Array.isArray(dados_orcamentos[id_orcam].status[chave1].historico[chave2].anexos)) {
                        dados_orcamentos[id_orcam].status[chave1].historico[chave2].anexos = {};
                    }

                    dados_orcamentos[id_orcam].status[chave1].historico[chave2].anexos[gerar_id_5_digitos()] = {
                        nome: fileName,
                        formato: mimeType,
                        link: result.fileId
                    };

                    localStorage.setItem('dados_orcamentos', JSON.stringify(dados_orcamentos));

                    var estrutura = document.getElementById('estrutura');
                    if (estrutura) {
                        estrutura.remove()
                    }

                    abrir_esquema(id_orcam);

                }

                enviar_status_orcamento(dados_orcamentos[id_orcam]);

                remover_popup()
            } else {

                openPopup_v2(`Deu erro por aqui... ${result.message}`)

            }


        };

        reader.readAsDataURL(file);
    }
}


// `https://drive.google.com/file/d/${exemplo}/view?usp=drivesdk`

async function excluir_status_na_nuvem(chave1, chave2, chave_anexo) {

    var dados = {
        'id': id_orcam,
        'tabela': 'orcamento_status',
        'operacao': 'excluir_anexo',
        chave1,
        chave2,
        chave_anexo
    }

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dados)
    })

}


async function enviar_status_orcamento(orcamento) {

    var orcamento = {
        'id': orcamento.id,
        'tabela': 'orcamento_status',
        'status': orcamento.status
    }

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(orcamento)
    })

}

function deseja_apagar(campo, chave1, chave2) {

    openPopup_v2(`
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <label>Deseja apagar essa informação?</label>
            <div style="display: flex; justify-content: center; align-items: center; gap: 20px;">
                <button style="background-color: green" onclick="apagar_status_historico('${campo}', '${chave1}', '${chave2}')">Confirmar</button>
                <button onclick="remover_popup()">Cancelar</button>
            </div>
        </div>
        `)
}

function apagar_status_historico(campo, chave1, chave2) {
    var dados_orcamentos = JSON.parse(localStorage.getItem('dados_orcamentos'))

    var orcamento = {
        'id': id_orcam,
        'tabela': 'orcamento_status',
        'operacao': 'excluir_' + campo,
        'chave1': chave1
    }

    if (campo == 'historico') {
        orcamento.chave2 = chave2
        delete dados_orcamentos[id_orcam].status[chave1].historico[chave2]
    } else {
        delete dados_orcamentos[id_orcam].status[chave1]
    }

    fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(orcamento)
    })

    localStorage.setItem('dados_orcamentos', JSON.stringify(dados_orcamentos))

    preencher_dados_orcamentos()

    remover_popup()

    fechar_estrutura()

    abrir_esquema(id_orcam)

}


async function atualizar_partnumber(dicionario) {

    for (codigo in dicionario) {

        var dados_composicoes = await recuperarDados('dados_composicoes') || {}

        if (dados_composicoes && dados_composicoes[codigo]) {
            dados_composicoes[codigo].omie = dicionario[codigo]

            localStorage.setItem('dados_composicoes', JSON.stringify(dados_composicoes))

            var composicao = {
                'tabela': 'composicoes',
                'codigo': codigo,
                'composicao': dados_composicoes[codigo]
            }

            fetch('https://script.google.com/a/macros/hopent.com.br/s/AKfycbx40241Ogk6vqiPxQ3RDjf4XURo3l_yG0x9j9cTNpeKIdnosEEewTnw7epPrc2Ir9EX/exec', {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(composicao)
            });
        }
    }
}

function getComputedStylesAsText(element) {
    const computedStyles = window.getComputedStyle(element);
    let styleText = "";
    for (let property of computedStyles) {
        styleText += `${property}: ${computedStyles.getPropertyValue(property)}; `;
    }
    return styleText;
}

const { ipcRenderer } = require('electron');

ipcRenderer.on('open-save-dialog', (event, { htmlContent, nomeArquivo }) => {
    ipcRenderer.send('save-dialog', { htmlContent, nomeArquivo });
});

async function gerarpdf(cliente, pedido) {

    if (menu_flutuante && span) {
        menu_flutuante.style.display = 'none'
        span.style.display = 'none'
    }

    var status = document.getElementById('status')

    var htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
        <style>
        body {
            font-family: 'Poppins', sans-serif;
        }
        .titulo {
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #151749;
            padding: 10px;
            font-size: 1.5em;
            color: white;
            height: 20px;
        }
        .contorno {
            border-radius: 5px;
            height: max-content;
            border: 1px solid #151749;
            padding: 5px;
            margin: 5px;
        }
            
        .tabela {
            border-collapse: collapse;
            border-radius: 5px;
            overflow: hidden;
        }
        
        .tabela th {
            background-color: #151749;
            color: white;
        }

        .tabela th, .tabela td {
            margin: 5px;
            text-align: left;
        }

        .tabela td {
            background-color: #99999940;
        }

        label {
            margin: 5px;
        }
        </style>
    </head>
    <body>
        ${status.innerHTML}
    </body>
    </html>`;
    
    const formData = {
        htmlContent: htmlContent,
        nomeArquivo: `REQUISICAO_${cliente}_${pedido}`
    };
    try {
        const response = await fetch('http://localhost:3000/generate-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            console.log(response.status, response.statusText)
            throw new Error('Erro ao gerar PDF: ' + response.status + ' ' + response.statusText);
        }
    } catch (err) {
        console.log(err)
    } finally {
        if (menu_flutuante && span) {
            menu_flutuante.style.display = 'flex'
            span.style.display = 'block'
        }
    }

}
