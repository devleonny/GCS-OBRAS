let filtrosOrcamento = {}
let intervaloCompleto
let intervaloCurto
let filtro;
let arquivados = false
let auxiliarFaturamento = {}
let meses = {
    '01': 'Janeiro',
    '02': 'Fevereiro',
    '03': 'Março',
    '04': 'Abril',
    '05': 'Maio',
    '06': 'Junho',
    '07': 'Julho',
    '08': 'Agosto',
    '09': 'Setembro',
    '10': 'Outubro',
    '11': 'Novembro',
    '12': 'Dezembro'
}

preencherOrcamentos()

async function recuperar_orcamentos() {

    await sincronizarDados('dados_orcamentos')
    await preencherOrcamentos()

}

function filtrar_orcamentos(ultimo_status, col, texto, apenas_toolbar) {

    if (ultimo_status !== undefined) {
        filtro = ultimo_status
    }

    if (col !== undefined) {
        filtrosOrcamento[col] = String(texto).toLowerCase()
    }

    let linhas_orcamento = document.getElementById('linhas_orcamento')
    let contadores = {
        TODOS: 0,
        listas: ['TODOS']
    }

    let trs = linhas_orcamento.querySelectorAll('tr')

    trs.forEach(tr => {
        let tds = tr.querySelectorAll('td')
        let status = tds[1].querySelector('select').value
        let mostrarLinha = true

        for (var col in filtrosOrcamento) {
            var filtroTexto = filtrosOrcamento[col];

            if (filtroTexto && col < tds.length) {
                let element = tds[col].querySelector('input') || tds[col].querySelector('textarea') || tds[col].textContent
                let conteudoCelula = element.value ? element.value : element
                let texto_campo = String(conteudoCelula).toLowerCase()

                if (!texto_campo.includes(filtroTexto)) {
                    mostrarLinha = false;
                    break;
                }
            }
        }

        if (filtro !== undefined) {
            mostrarLinha = mostrarLinha && (status == filtro || filtro == 'TODOS');
        }

        contadores.listas.push(status)
        if (!contadores[status]) {
            contadores[status] = 0
        }

        if (mostrarLinha || status !== filtro) {
            contadores[status]++
        }

        if (filtro !== 'TODOS' || (filtro == 'TODOS' && mostrarLinha)) {
            contadores['TODOS']++
        }

        mostrarLinha == !apenas_toolbar

        mostrarLinha ? tr.style.display = 'table-row' : tr.style.display = 'none'

    })

    let toolbar = document.getElementById('toolbar')
    toolbar.innerHTML = ''
    contadores.listas = [...new Set(contadores.listas)]

    let temp_fluxograma = {
        'TODOS': {},
        ...fluxograma
    }

    for (st in temp_fluxograma) {
        if (contadores.listas.includes(st)) {

            let bg = '#797979'
            let bg2 = '#3d3c3c'
            if ((filtro == st || (filtro == undefined && st == 'TODOS'))) {
                bg = '#d2d2d2'
                bg2 = '#222'
            }

            let label = `
                <div onclick="filtrar_orcamentos('${st}')" 
                    style="background-color:${bg}; 
                    color: #222; 
                    display: flex; 
                    flex-direction: column;
                    justify-content: center; 
                    align-items: center; 
                    margin-left: 3px;
                    cursor: pointer;
                    padding: 10px;
                    font-size: 0.8vw;
                    color: #222;
                    border-top-left-radius: 5px;
                    border-top-right-radius: 5px;
                    ">

                    <label>${inicial_maiuscula(st)}</label>
                    <label style="text-align: center; background-color: ${bg2}; color: #d2d2d2; border-radius: 3px; padding-left: 10px; padding-right: 10px; width: 50%;">${contadores[st]}</label>

                </div>
                `
            toolbar.insertAdjacentHTML('beforeend', label)
        }
    }
}

async function preencherOrcamentos(alternar) {

    let div_orcamentos = document.getElementById('orcamentos')
    if (!div_orcamentos) return
    overlayAguarde()

    document.getElementById('toolbar').innerHTML = ''
    div_orcamentos.innerHTML = ''

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    let desordenado = Object.entries(dados_orcamentos)
    desordenado.sort((a, b) => new Date(b[1]?.dados_orcam?.data || '') - new Date(a[1]?.dados_orcam?.data || ''))
    dados_orcamentos = Object.fromEntries(desordenado)

    let linhas = ''

    if (alternar) arquivados = !arquivados
    document.getElementById('botaoArquivados').querySelector('label').textContent = arquivados ? 'Demais Orçamentos' : 'Orçamentos Arquivados'

    for ([idOrcamento, orcamento] of Object.entries(dados_orcamentos)) {

        if ((arquivados && orcamento.arquivado) || (!arquivados && !orcamento.arquivado)) {

            let dados_orcam = orcamento.dados_orcam
            if (!dados_orcam) {
                deletar(`dados_orcamentos/${idOrcamento}`)
                continue
            }

            let data = new Date(dados_orcam.data).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short'
            })

            let label_pedidos = ''
            let label_notas = ''

            if (orcamento.status && orcamento.status.historico) {

                for ([chave, historico] of Object.entries(orcamento.status.historico)) {

                    if (historico.status == 'PEDIDO') {

                        let num_pedido = historico.pedido
                        let tipo = historico.tipo
                        let valor_pedido = conversor(historico.valor)

                        label_pedidos += `
                        <div class="etiqueta_pedidos"> 
                            <label style="font-size: 0.6vw;">${tipo}</label>
                            <label style="font-size: 0.7vw; margin: 2px;"><strong>${num_pedido}</strong></label>
                            <label style="font-size: 0.8vw; margin: 2px"><strong>${dinheiro(valor_pedido)}</strong></label>
                        </div>
                        `
                    }

                    if (historico.status == 'FATURADO') {

                        if (historico.parcelas && historico.parcelas.length > 0) {

                            if (!auxiliarFaturamento[idOrcamento]) {
                                auxiliarFaturamento[idOrcamento] = []
                            }

                            auxiliarFaturamento[idOrcamento].push(historico)
                        }

                        label_notas += `
                        <div class="etiqueta_pedidos">
                            <label style="font-size: 0.6vw;">${historico.tipo}</label>
                            <label style="font-size: 0.7vw; margin: 2px;"><strong>${historico.nf}</strong></label>
                            <label style="font-size: 0.8vw; margin: 2px;"><strong>${dinheiro(historico.valor)}</strong></label>
                        </div>
                        `
                    }
                }

            }

            let st = orcamento?.status?.atual || ''

            let opcoes = '<option></option>'
            for (fluxo in fluxograma) {
                opcoes += `<option ${st == fluxo ? 'selected' : ''}>${fluxo}</option>`
            }

            let {
                impostos = 0,
                custo_compra = 0,
                frete_venda = 0,
            } = orcamento?.dados_custos || {}

            let lucratividade = orcamento.total_geral - impostos - custo_compra - frete_venda
            let lucratividadePorcentagem = Number(((lucratividade / orcamento.total_geral) * 100).toFixed(0))

            linhas += `
            <tr>
                <td>
                    <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;">
                        <label style="font-size: 0.6vw;">${data}</label>
                        <label>${orcamento.lpu_ativa}</label>
                    </div>
                </td>
                <td>
                    <select class="opcoesSelect" onchange="alterar_status(this, '${idOrcamento}')">
                        ${opcoes}
                    </select>
                </td>
                <td style="text-align: left;">${label_pedidos}</td>
                <td style="text-align: left;">${label_notas}</td>
                <td style="text-align: left;">
                    <div style="display: flex; flex-direction: column; align-items: start; justify-content: center;">
                        <label style="font-size: 0.6vw;"><strong>${dados_orcam.contrato}</strong></label>
                        <label>${dados_orcam.cliente_selecionado}</label>
                    </div>
                </td>
                <td style="text-align: left;">${dados_orcam.cidade}</td>
                <td style="text-align: left;">${dados_orcam.analista}</td>
                <td>${divPorcentagem(lucratividadePorcentagem)}</td>
                <td style="white-space: nowrap;">${dinheiro(orcamento.total_geral)}</td>
                <td style="text-align: center;" onclick="abrirAtalhos('${idOrcamento}')">
                    <img src="imagens/pesquisar2.png" style="width: 2vw; cursor: pointer;">
                </td>
            </tr>
            `
        }
    }

    let cabecs = ['Data <br> LPU', 'Status', 'Pedido', 'Notas', 'Chamado <br> Cliente', 'Cidade', 'Analista', 'Lc %', 'Valor', 'Ações']
    let ths = ''
    let tsh = ''
    cabecs.forEach((cab, i) => {

        ths += `
            <th style="text-align: center;">${cab}</th>
        `
        if (cab !== 'Ações' && cab !== 'Aprovação') {
            tsh += `
                <th style="background-color: white; border-radius: 0px;">
                    <div style="position: relative;">
                        <input placeholder="..." style="text-align: left;" oninput="filtrar_orcamentos(undefined, ${i}, this.value)">
                        <img src="imagens/pesquisar2.png" style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); width: 15px;">
                    </div>
                </th>
            `
        } else {
            tsh += `<th style="background-color: white; border-radius: 0px;"></th>`
        }
    })

    let linhas_orcamento = document.getElementById('linhas_orcamento')

    if (linhas_orcamento) {
        linhas_orcamento.innerHTML = linhas

    } else {

        div_orcamentos.innerHTML = ''
        let tabela = `
                    <table id="orcamentos_" class="tabela">
                        <thead>
                            <tr>${ths}</tr>
                            <tr id="tsh">${tsh}</tr>
                        </thead>
                        <tbody id="linhas_orcamento">
                            ${linhas}
                        </tbody>
                    </table>
                    `
        div_orcamentos.insertAdjacentHTML('beforeend', tabela)
    }

    filtrar_orcamentos('TODOS')

    removerOverlay()

}

async function verificarParcelas() {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let valores = {}

    for (let [idOrcamento, notas] of Object.entries(auxiliarFaturamento)) {
        let orcamento = dados_orcamentos[idOrcamento]

        notas.forEach(nota => {

            nota.parcelas.forEach(parcela => {

                let [dia, mes, ano] = parcela.dDtVenc.split('/')

                if (!valores[ano]) {
                    valores[ano] = { total: 0, meses: {} }
                }

                if (!valores[ano].meses[mes]) {
                    valores[ano].meses[mes] = { parcelas: [], total: 0 }
                }

                valores[ano].total += parcela.nValorTitulo
                valores[ano].meses[mes].total += parcela.nValorTitulo

                valores[ano].meses[mes].parcelas.push({
                    orcamento: orcamento.dados_orcam.cliente_selecionado,
                    parcela: parcela.nParcela,
                    vencimento: parcela.dDtVenc,
                    valor: parcela.nValorTitulo,
                    idOrcamento
                })

            })
        })

    }

    let elementos = ''
    for ([ano, objeto] of Object.entries(valores)) {

        elementos += `
        <label style="font-size: 1.5vw;">[<strong>${ano}</strong>] ${dinheiro(objeto.total)}</label>
        <hr style="width: 100%;">
        `
        let linhas = ''
        for (mes in objeto.meses) {

            let divParcelas = ''
            objeto.meses[mes].parcelas.forEach(fragPacela => {

                divParcelas += `
                <div class="parcela">
                    <label><strong>Vencimento</strong> ${fragPacela.vencimento}</label>
                    <label><strong>Parcela ${fragPacela.parcela}</strong> ${dinheiro(fragPacela.valor)}</label>
                    <div style="display: flex; justify-content: start; align-items: center; gap: 5px;">
                        <img src="imagens/projeto.png" style="cursor: pointer; width: 2vw;" onclick="abrirEsquema('${fragPacela.idOrcamento}')">
                        <label>${fragPacela.orcamento}</label>
                    </div>
                </div>
                `
            })
            linhas += `
            <div style="display: flex; justify-content: center; align-items: center; gap: 5px;" onclick="mostrarParcelas(this)">
                <img src="imagens/pasta.png" style="width: 2vw; cursor: pointer;">
                <label><strong>${meses[mes]}</strong> ${dinheiro(objeto.meses[mes].total)}</label>
            </div>

            <div style="display: none; flex-direction: column; align-items: start; justify-content: start; gap: 2px;">
                ${divParcelas}
            </div>
            `
        }

        elementos += linhas

    }

    let acumulado = `
        <div style="display: flex; justify-content: start; align-items: start; flex-direction: column; background-color: #d2d2d2; padding: 5px; width: 40vw;">
            ${elementos}
        </div>
    `
    popup(acumulado, 'Faturamento Parcelas')

}

function mostrarParcelas(divSuperior) {

    let divSeguinte = divSuperior.nextElementSibling
    let visibilidade = divSeguinte.style.display

    divSeguinte.style.display = visibilidade == 'none' ? 'flex' : 'none'

}

async function editar(orcam_) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    let orcamento_v2 = dados_orcamentos[orcam_];

    if (orcamento_v2.aprovacao) delete orcamento_v2.aprovacao

    let tipoOrcamento = orcamento_v2.lpu_ativa == 'ALUGUEL' ? 'aluguel' : 'orcamento'

    baseOrcamento(orcamento_v2)

    window.location.href = `criar_${tipoOrcamento}.html`;

}

async function duplicar(orcam_) {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento_v2 = dados_orcamentos[orcam_]
    let novoOrcamento = {}

    novoOrcamento.dados_orcam = orcamento_v2.dados_orcam
    novoOrcamento.dados_composicoes = orcamento_v2.dados_composicoes
    novoOrcamento.lpu_ativa = orcamento_v2.lpu_ativa
    novoOrcamento.dados_orcam.contrato = ''
    novoOrcamento.dados_orcam.analista = acesso.nome_completo
    novoOrcamento.dados_orcam.email_analista = acesso.email
    novoOrcamento.dados_orcam.telefone_analista = acesso.telefone

    baseOrcamento(novoOrcamento)

    let tipoOrcamento = novoOrcamento.lpu_ativa == 'ALUGUEL' ? 'aluguel' : 'orcamento'

    window.location.href = `criar_${tipoOrcamento}.html`
}

function salvar_dados_em_excel() {
    var tabela = orcamento_.querySelectorAll('tr');
    var dados = [];

    // Processa o cabeçalho (primeira linha da tabela)
    var cabecalho = tabela[0].querySelectorAll('th');
    var linhaCabecalho = [];
    cabecalho.forEach(th => {
        linhaCabecalho.push(th.textContent);
    });

    dados.push(linhaCabecalho); // Adiciona o cabeçalho ao array 'dados'

    // Processa o restante das linhas (linhas com dados)
    tabela.forEach((tr, index) => {
        if (index === 0) return; // Ignora o cabeçalho

        var tds = tr.querySelectorAll('td');
        var linha = [];
        tds.forEach(td => {
            linha.push(td.textContent);
        });

        dados.push(linha); // Adiciona a linha de dados ao array 'dados'
    });

    // Gera o arquivo Excel com ExcelJS
    var workbook = new ExcelJS.Workbook();
    var worksheet = workbook.addWorksheet('Orcamento');

    // Adiciona os dados ao worksheet
    dados.forEach((linha, index) => {
        worksheet.addRow(linha);
    });

    // Define a largura automática para as colunas
    worksheet.columns.forEach(column => {
        var maxLength = 0;
        column.eachCell({ includeEmpty: true }, function (cell) {
            var columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
                maxLength = columnLength;
            }
        });
        column.width = maxLength < 10 ? 10 : 20;
    });

    workbook.xlsx.writeBuffer().then(function (buffer) {
        var blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, 'dados_orcamento.xlsx');
    });
}

// Função usada para reorganizar os dados_orcamentos; 13-02-2025
async function alteracoes_status() {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    for (id in dados_orcamentos) {
        let orcamento = dados_orcamentos[id]

        if (orcamento.levantamentos) {
            let novo_levantamentos = {};

            for (let lev in orcamento.levantamentos) {
                let adentro = orcamento.levantamentos[lev];

                while (adentro && typeof adentro[lev] === 'object') {
                    adentro = adentro[lev];
                }

                novo_levantamentos[lev] = adentro;
            }

            orcamento.levantamentos = novo_levantamentos;
        }

        if (orcamento.status) {

            let chaves = orcamento.status

            let novas_chaves = {}

            for (chave1 in chaves) {
                let pedido = chaves[chave1]
                let historicos = pedido.historico

                if (!novas_chaves[chave1]) {
                    novas_chaves[chave1] = {}
                }

                if (pedido.status == 'FINALIZADO') {
                    novas_chaves[chave1].finalizado = true
                }

                for (chave2 in historicos) {
                    let his = historicos[chave2]
                    his.status = atualizar_status(his.status)

                    if (his.status == 'PEDIDO') {
                        his.pedido = pedido.pedido
                        his.valor = pedido.valor
                        his.tipo = pedido.tipo
                    }

                    if (!novas_chaves[chave1].historico) {
                        novas_chaves[chave1].historico = {}
                    }

                    novas_chaves[chave1].historico[chave2] = his
                }

            }

            orcamento.status = novas_chaves


        }
    }

    await inserirDados(dados_orcamentos, 'dados_orcamentos')

}

function atualizar_status(st) {

    switch (true) {
        case st.includes('ANEXADO'):
            st = 'PEDIDO'
            break
        case st.includes('FATURAMENTO PEDIDO DE'):
            st = 'REQUISIÇÃO'
            break
        case st.includes('REMESSA DE'):
            st = 'REQUISIÇÃO'
            break
        case st.includes('FATURADO'):
            st = 'FATURADO'
            break
        case st == '':
            st = 'PEDIDO'
            break
        default:
            st = st
    }

    return st
}

async function obterObjeto(base, id) {
    let objeto = await recuperarDados(base) || {}
    return objeto[id]
}