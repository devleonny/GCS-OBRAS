
async function modalLPUParceiro(id, chave) {

    const orcamento = await recuperarDado('dados_orcamentos', id)
    const cliente = await recuperarDado('dados_clientes', orcamento.dados_orcam?.omie_cliente) || {}
    const dadosEmpresa = {
        ...orcamento.dados_orcam,
        ...cliente
    }

    const status = orcamento?.status?.historico?.[chave] || {}
    const idTecnico = status?.tecnico || ''
    const tecnico = await recuperarDado('dados_clientes', idTecnico)

    const itens = Object.fromEntries(
        Object.entries(status?.itens || orcamento?.dados_composicoes || {})
            .filter(([, i]) => i?.tipo !== 'VENDA')
    )

    const colunas = {
        'Check': {},
        'Código': { chave: 'codigo' },
        'Descrição': { chave: 'descricao' },
        'Unidade': { chave: 'unidade' },
        'Quantidade': { chave: 'qtde' },
        'Valor Orçamento': { chave: 'custo' },
        'Valor Total Orçado': {},
        'Impostos (20%)': {},
        'Margem Unitária': {},
        'Margem Total': {},
        'Parceiro Unitário': {},
        'Parceiro Total': {},
        'Desvio': {},
    }

    const fSalvar = chave
        ? `salvarLpuParceiro('${id}', '${chave}')`
        : `salvarLpuParceiro('${id}')`

    const btnExtras = `
    <div style="display: flex-wrap: wrap; gap: 2px;">
        <button id="btnRem" onclick="atvRemItensEmMassa(this)">Remover Itens</button>
        <button id="btnVer" data-mostrar="S" onclick="verItensAtvRem(this)">Ver Itens Removidos</button>
        <button onclick="itemAdicional()">Adicionar Serviço</button>
        <button style="background-color: green;" onclick="${fSalvar}">Salvar LPU</button>
    </div>
    `
    const tabela = modTab({
        base: itens,
        btnExtras,
        colunas,
        filtros: { 'removido': { op: '!=', value: 'S' } },
        bloquearPaginacao: true,
        funcaoAdicional: ['calcularLpuParceiro'],
        criarLinha: 'adicionarLinhaParceiro',
        pag: 'lpu_parceiro',
        body: 'bodyParceiros'
    })

    const stringHtml = (titulo, valor) => `
        <div style="${vertical}; gap: 3px;">
            <label><strong>${titulo}</strong>:</label>
            <div style="font-size: 1rem;">${valor}</div>
        </div>`

    const elemento = `
        <div style="${vertical}; padding: 1rem;">

            <div style="${horizontal}; align-items: start; gap: 2rem;">

                <div style="${vertical}">
                    ${stringHtml('Cliente', dadosEmpresa.nome)}
                    ${stringHtml('CNPJ', dadosEmpresa.cnpj)}
                    ${stringHtml('Endereço', dadosEmpresa.bairro)}
                    ${stringHtml('Cidade', dadosEmpresa.cidade)}
                    <br>
                    <div style="${horizontal}; gap: 1rem;">
                        <input type="checkbox" style="width: 2rem; height: 2rem;" onclick="marcarItensLPU(this)">
                        <span>Marcar todos os ITENS<span>
                    </div>
                </div>

                <div style="${vertical}">
                    ${stringHtml('Técnico', `<span ${tecnico ? `id="${status.tecnico}"` : ''} class="opcoes" name="tecnico" onclick="cxOpcoes('tecnico', 'dados_clientes', ['nome', 'cnpj_cpf', 'bairro'])">${tecnico?.nome || 'Selecione'}</span>`)}
                    ${stringHtml('Margem Geral (%)', `<input id="margem_lpu" class="requisicao-campo" style="background-color: white;" value="${status?.margem || '40'}" oninput="calcularLpuParceiro()">`)}
                    ${stringHtml('Comentário', `<textarea id="comentario">${status?.comentario || ''}</textarea>`)}
                </div>
        
                <div style="${vertical}">
                    ${stringHtml('Total do Valor Orçamento', '<label id="total_orcamento"></label>')}
                    ${stringHtml('Total Margem Disponível', '<label id="total_margem"></label>')}
                    ${stringHtml('Total do Valor Parceiro', '<label id="total_parceiro"l></label>')}
                    ${stringHtml('Total Desvio', '<label id="total_desvio"></label>')}
                </div>

            </div>

            <br>
            ${tabela}
        </div>
        `

    popup({ elemento, titulo: 'LPU Parceiro', autoDestruicao: ['lpu_parceiro'] })

    await paginacao()

}

async function atvRemItensEmMassa() {

    const btn2 = document.getElementById('btnVer')
    const op = btn2.dataset.mostrar

    const itens = document.querySelectorAll('[name="itensLPU"]:checked')

    if (itens.length == 0)
        return

    for (const check of itens) {

        const tr = check.closest('tr')
        const codigo = tr.dataset.codigo

        controles.lpu_parceiro.base[codigo].removido = op

        tr.remove()

    }

    calcularLpuParceiro()

}

async function verItensAtvRem(elemento) {

    overlayAguarde()

    const mostrar = elemento.dataset.mostrar == 'S'
    elemento.dataset.mostrar = mostrar
        ? 'N'
        : 'S'

    const btn1 = document.getElementById('btnRem')
    const btn2 = document.getElementById('btnVer')

    btn1.textContent = mostrar
        ? 'Recuperar Itens'
        : 'Remover Itens'

    btn2.textContent = mostrar
        ? 'Ver Itens Ativos'
        : 'Ver Itens Removidos'

    const op = mostrar
        ? '='
        : '!='

    controles.lpu_parceiro.primEx = true
    controles.lpu_parceiro.filtros = {
        'removido': { op, value: 'S' }
    }

    calcularLpuParceiro()
    await paginacao()

    removerOverlay()

}

function marcarItensLPU(input) {

    const itensChecklist = document.querySelectorAll('[name="itensLPU"]')

    for (const check of itensChecklist) {
        const tr = check.closest('tr')
        check.checked = tr.style.display !== 'none' && input.checked
    }

}

async function adicionarLinhaParceiro(composicao) {

    const { codigo, avulso, removido = 'N', descricao, vUnitParc, vTotalParc, unidade, qtde, custo } = composicao || {}

    const tds = `
        <td>
            <input type="checkbox" style="width: 2rem; height: 2rem;" name="itensLPU">
        </td>
        <td>${codigo}</td>
        <td>${descricao || ''}</td>
        <td>${unidade || ''}</td>
        <td>
            <input 
                class="requisicao-campo" 
                name="qtde"
                oninput="calcularLpuParceiro()" 
                type="number" 
                value="${qtde || ''}">
        </td>
        <td name="custo" style="white-space: nowap;">${dinheiro(custo || 0)}</td>
        <td name="vTotalOrcado" style="white-space: nowrap;"></td>
        <td name="tImpostos" style="white-space: nowrap;"></td>
        <td name="mUnit" style="white-space: nowrap;"></td>
        <td name="mTotal" style="white-space: nowrap;"></td>
        <td>
            <input 
            class="requisicao-campo" 
            name="vUnitParc"
            oninput="this.closest('tr').dataset.edicao = 'unitario'; calcularLpuParceiro()" 
            type="number" 
            value="${vUnitParc || ''}">
        </td>
        <td>
            <input 
            class="requisicao-campo" 
            name="vTotalParc"
            oninput="this.closest('tr').dataset.edicao = 'total'; calcularLpuParceiro()" 
            type="number"
            value="${vTotalParc || ''}">
        </td>
        <td name="desvio" style="white-space: nowrap;"></td>`

    return `<tr data-removido="${removido}" data-avulso=${avulso ? 'S' : 'N'} data-codigo="${codigo}">${tds}</tr>`

}

async function itemAdicional() {

    controlesCxOpcoes.composicao = {
        retornar: ['descricao'],
        base: 'dados_composicoes',
        filtros: {
            'tipo': { op: '!=', value: 'SERVIÇO' }
        },
        colunas: {
            'Código': { chave: 'codigo' },
            'Descrição': { chave: 'descricao' },
            'Tipo': { chave: 'tipo' },
            'Unidade': { chave: 'unidade' }
        }
    }

    const linhas = [
        {
            texto: 'Descrição',
            elemento: `<span name="composicao" class="opcoes" onclick="cxOpcoes('composicao')">Selecione</span>`
        },
        {
            texto: 'Quantidade',
            elemento: `<input name="qtde" type="number">`
        },
        {
            texto: 'Custo',
            elemento: `<input name="custo" type="number">`
        },
        {
            texto: 'Unidade',
            elemento: `<input name="unidade">`
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: 'salvarAdicional()', autoDestruicao: ['composicao'] }
    ]

    popup({ linhas, botoes, titulo: 'Incluir Serviço' })
}

async function salvarAdicional() {

    const obVal = (n) => {
        const painel = document.querySelector('.painel-padrao')
        const el = painel.querySelector(`[name="${n}"]`)
        return el ? el : null
    }

    const composicao = obVal('composicao')

    if (!composicao.id)
        return popup({ mensagem: 'Descrição não pode ficar em branco' })

    controles.lpu_parceiro.base[composicao.id] = {
        avulso: 'S',
        codigo: composicao.id,
        descricao: composicao.textContent,
        qtde: Number(obVal('qtde').value),
        custo: Number(obVal('custo').value),
        unidade: Number(obVal('unidade').value)
    }

    removerPopup()
    controles.lpu_parceiro.primEx = true
    await paginacao()

}

async function salvarLpuParceiro(id, chave = ID5digitos()) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id)

    orcamento.status ??= {}
    orcamento.status.historico ??= {}
    orcamento.status.historico[chave] ??= {}

    orcamento.status.historico[chave] = {
        ...orcamento.status.historico[chave],
        status: 'LPU PARCEIRO',
        itens: controles.lpu_parceiro.base || {},
        totais: controles.lpu_parceiro.totais || {},
        margem: Number(document.getElementById('margem_lpu').value),
        executor: acesso.usuario,
        data: new Date().toLocaleString(),
        comentario: document.getElementById('comentario').value,
        tecnico: document.querySelector('[name="tecnico"]')?.id || null
    }

    enviar(`dados_orcamentos/${id}/status/historico/${chave}`, orcamento.status.historico[chave])
    await inserirDados({ [id]: orcamento }, 'dados_orcamentos')
    removerPopup()
    await abrirEsquema(id)
}

function calcularLpuParceiro() {

    const elMargem = document.getElementById('margem_lpu')
    if (!elMargem)
        return

    const margemPercentual = Number(document.getElementById('margem_lpu').value) / 100;

    let totais = {
        orcamento: 0,
        parceiro: 0,
        desvio: 0,
        margem: 0
    }

    const trs = document.querySelectorAll('#bodyParceiros tr')

    for (const tr of trs) {

        const codigo = tr.dataset.codigo
        const removido = tr.dataset.removido == 'S'

        // Pode encerrar;
        if (!codigo)
            continue

        const avulso = tr.dataset.avulso == 'S'
        const qtde = Number(tr.querySelector('[name="qtde"]').value) || 0
        const valorOrcamento = conversor(tr.querySelector('[name="custo"]').textContent)
        const totalLinha = qtde * valorOrcamento

        const edicao = tr.dataset.edicao
        const vUnitParc = tr.querySelector('[name="vUnitParc"]')
        const vTotalParc = tr.querySelector('[name="vTotalParc"]')

        const totalParceiro = edicao == 'unitario'
            ? Number(vUnitParc.value) * qtde
            : Number(vTotalParc.value)

        if (edicao == 'unitario') {
            vTotalParc.value = totalParceiro
        } else {
            vUnitParc.value = qtde == 0 ? 0 : totalParceiro / qtde
        }

        const totalMargem = totalLinha * margemPercentual
        const margemPorItem = qtde == 0
            ? 0
            : totalMargem / qtde

        const desvio = avulso
            ? - totalParceiro
            : totalMargem - totalParceiro

        const img = desvio < 0
            ? 'offline'
            : 'online'

        if (edicao == 'unitario') {
            vTotalParc.value = (totalParceiro).toFixed(2)
        } else {
            vUnitParc.value = (totalParceiro / qtde).toFixed(2)
        }

        totais.parceiro += removido ? 0 : totalParceiro
        totais.desvio += removido ? 0 : desvio
        totais.orcamento += removido ? 0 : totalLinha

        tr.querySelector('[name="vTotalOrcado"]').textContent = dinheiro(totalLinha)
        tr.querySelector('[name="tImpostos"]').textContent = dinheiro(totalLinha * 0.2)

        // Para itens avulsos não existe margem;
        tr.querySelector('[name="mUnit"]').textContent = !avulso
            ? dinheiro(margemPorItem)
            : ''

        tr.querySelector('[name="mTotal"]').textContent = !avulso
            ? dinheiro(totalMargem)
            : ''

        tr.querySelector('[name="desvio"]').innerHTML = `
            <div style="${horizontal}; gap: 3px;">
                <img src="imagens/${img}.png" style="width: 1.5rem;">
                ${dinheiro(desvio)}
            </div>`

        // Salvamento no objeto;
        controles.lpu_parceiro.base[codigo] = {
            ...controles.lpu_parceiro.base[codigo],
            vUnitParc: Number(vUnitParc.value),
            vTotalParc: Number(vTotalParc.value),
            qtde
        }

    }

    totais.margem = totais.orcamento * margemPercentual

    // Salvamento no objeto;
    controles.lpu_parceiro.totais = totais

    for (const [campo, total] of Object.entries(totais)) {
        const el = document.getElementById(`total_${campo}`)
        if (el)
            el.textContent = dinheiro(total)
    }

}

async function exportarComoExcelHTML(chave) {
    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    const status = orcamento?.status?.historico?.[chave] || {}
    const clienteOmie = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = await recuperarDado('dados_clientes', clienteOmie)
    const dados = {
        ...status,
        ...cliente
    }

    let html = `
    <!DOCTYPE HTML>
    <html xmlns="http://www.w3.org/TR/REC-html40"
          xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <style>
            .numero {
                mso-number-format:"0";
                text-align: right;
            }
            .texto {
                mso-number-format:"\\@";
                text-align: left;
            }
            .moeda {
                mso-number-format:"R$ #,##0.00";
                text-align: right;
            }
            .cabecalho {
                background-color: rgb(0, 138, 0);
                color: white;
                font-weight: bold;
                text-align: center;
            }
            .total {
                font-weight: bold;
                background-color: #e9ecef;
            }
            td, th {
                border: 0.5pt solid #000000;
                padding: 5px;
            }
            table {
                border-collapse: collapse;
            }
        </style>
    </head>
    <body>
        <div style="text-align: center; margin-bottom: 20px">
            <h2>LPU PARCEIRO</h2>
        </div>
        
        <table>
            <tr>
                <td class="texto"><strong>Data:</strong></td>
                <td class="texto">${dados.data}</td>
                <td class="texto"><strong>Analista:</strong></td>
                <td class="texto">${dados.executor}</td>
            </tr>
            <tr>
                <td class="texto"><strong>Cliente:</strong></td>
                <td class="texto">${dados.nome}</td>
                <td class="texto"><strong>CNPJ:</strong></td>
                <td class="texto">${dados.cnpj}</td>
            </tr>
            <tr>
                <td class="texto"><strong>Endereço:</strong></td>
                <td class="texto">${dados.bairro}</td>
                <td class="texto"><strong>Cidade/Estado:</strong></td>
                <td class="texto">${dados.cidade}</td>
            </tr>
        </table>

        <br>

        <table>
            <thead>
                <tr>
                    <th class="cabecalho">Código</th>
                    <th class="cabecalho">Descrição</th>
                    <th class="cabecalho">Unidade</th>
                    <th class="cabecalho">Quantidade</th>
                    <th class="cabecalho">Valor Unitário</th>
                    <th class="cabecalho">Total</th>
                </tr>
            </thead>
            <tbody>`;

    let linha = 9; // começa após o cabeçalho
    for (let [codigo, item] of Object.entries(dados.itens)) {
        html += `
            <tr>
                <td class="texto">${codigo}</td>
                <td class="texto">${item.descricao}</td>
                <td class="texto" style="text-align: center">${item.unidade}</td>
                <td class="numero">${item.qtde}</td>
                <td class="moeda">${item.valor_parceiro_unitario}</td>
                <td class="moeda">=D${linha}*E${linha}</td>
            </tr>`;
        linha++;
    }

    html += `
            <tr><td colspan="6" style="border: none; height: 20px"></td></tr>
            <tr class="total">
                <td colspan="5" style="text-align: right"><strong>TOTAL DO ORÇAMENTO VENDIDO:</strong></td>
                <td class="moeda">=SOMA(F9:F${linha - 1})</td>
            </tr>
        </tbody>
    </table>
    </body>
    </html>`;

    try {
        let blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
        let url = URL.createObjectURL(blob);
        let a = document.createElement("a");
        a.href = url;
        a.download = `LPU Parceiro ${dados.nome}.xls`;
        a.click();
        URL.revokeObjectURL(url);
        removerOverlay()
    } catch (err) {
        popup({ mensagem: err.message || 'Falha ao gerar Excel' })
    }
}

function extrairTextoOuInput(td) {
    if (!td) return ''
    const input = td.querySelector('input');
    return input ? input.value.trim() : td.textContent.trim();
}

async function detalharLpuParceiro(chave) {

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    const dadosLpu = orcamento.status.historico[chave];

    const stringHtml = (titulo, valor) => `
        <div style="display: flex; justifty-content: start; align-items: center; gap: 5px;">
            <label><strong>${titulo}</strong>:</label>
            <label>${valor}</label>
        </div>`

    const clienteOmie = orcamento.dados_orcam?.omie_cliente || ''
    const cliente = await recuperarDado('dados_clientes', clienteOmie)
    const dadosEmpresa = {
        ...orcamento.dados_orcam,
        ...cliente
    }

    const margemLPU = dadosLpu?.margem || '?'
    const tecnicoOmie = dadosLpu?.tecnico || ''
    const tecnicoLPU = await recuperarDado('dados_clientes', tecnicoOmie)
    let linhas = ''
    let totalParceiro = 0
    let totalOrcamento = 0
    for (const [codigo, dados] of Object.entries(dadosLpu.itens)) {
        const totalLinha = dados.qtde * dados.valor_parceiro_unitario
        totalOrcamento += dados.qtde * dados.custo
        totalParceiro += totalLinha
        linhas += `
        <tr>
            <td>${dados.descricao}</td>
            <td>${dados.qtde}</td>
            <td>${dinheiro(dados.valor_parceiro_unitario)}</td>
            <td>${dinheiro(totalLinha)}</td>
        </tr>
        `
    }

    const modeloTotal = (texto, valor) => `
        <tr>
            <td colspan="3" style="text-align: right; font-weight: bold; background-color: #eaeaea">${texto}:</td>
            <td>${valor}</td>
        </tr>
    `
    const totalMargemDisponivel = margemLPU ? totalOrcamento * (margemLPU / 100) : 0
    const porcentagem = ((totalParceiro / totalOrcamento) * 100).toFixed(0)
    const linhasTotais = `
        ${modeloTotal('TOTAL DO ORÇAMENTO', dinheiro(totalOrcamento))}
        ${modeloTotal('TOTAL MARGEM DISPONÍVEL', dinheiro(totalMargemDisponivel))}
        ${modeloTotal('TOTAL LPU PARCEIRO', dinheiro(totalParceiro))}
        ${modeloTotal('% PAGA AO PARCEIRO', `${porcentagem} %`)}
    `

    const tabela = `
        <div style="${vertical};">
            <div class="topo-tabela"></div>
                <div class="div-tabela">
                <table class="tabela" name="tabelaParceiro" data-total="${totalParceiro}">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Quantidade</th>
                            <th>Valor Unitário</th>
                            <th>Total Parceiro</th>
                        </tr>
                    </thead>
                    <tbody>${linhas}</tbody>
                </table>
                <br>
                <table class="tabela">
                    <tbody>${linhasTotais}</tbody>
                </table>
                </div>
            <div class="rodape-tabela"></div>
        </div>
    `

    const cabecalhoInfo = `
        <div name="cabecalhoParceiro" style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px;">
            ${stringHtml('Data', new Date().toLocaleString())}
            ${stringHtml('Analista', acesso?.nome_completo || '')}
            ${stringHtml('Cliente', dadosEmpresa?.nome || '')}
            ${stringHtml('CNPJ', dadosEmpresa?.cnpj || '')}
            ${stringHtml('Endereço', dadosEmpresa?.bairro || '')}
            ${stringHtml('Cidade', dadosEmpresa?.cidade || '')}
            ${stringHtml('Margem', margemLPU)}
            ${stringHtml('Técnico', tecnicoLPU?.nome || '')}
        </div>
    `

    const botoes = `
        <div class="menu_flutuante" id="menu_flutuante">

            <div class="icone" onclick="gerarPdfParceiro('${dadosEmpresa?.nome || ''}')">
                <img src="imagens/pdf.png">
                <label>PDF</label>
            </div>
            
            <div class="icone" onclick="exportarComoExcelHTML('${chave}')">
                <img src="imagens/excel.png">
                <label>Excel</label>
            </div>

        </div>
    `

    const elemento = `
        <div style="${vertical}">
            ${cabecalhoInfo}
            ${tabela}
        </div>
        ${botoes}
    `

    popup({ elemento, titulo: 'Detalhamento Itens Parceiro' })

}

async function gerarPdfParceiro(nome) {

    overlayAguarde()

    const cabecalhoParceiro = document.querySelector('[name="cabecalhoParceiro"]').innerHTML
    const elTabela = document.querySelector('[name="tabelaParceiro"]')
    const tabela = elTabela.innerHTML
    const totalParceiro = dinheiro(elTabela.dataset.total)

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
            <style>
            @page {
                size: A4;
                margin: 1cm;
            }
            body {
                font-family: 'Poppins', sans-serif;
                margin: 0;
                padding: 20px;
                width: 21cm;
                min-height: 29.7cm;
            }
            .header {
                width: 100%;
                text-align: center;
                margin-bottom: 20px;
                background-color: #151749;
                padding: 10px 0;
                border-radius: 5px;
            }
            .header img {
                height: 70px;
            }
            .tabela {
                width: 100%;
                border-collapse: collapse;
                border-radius: 5px;
                overflow: hidden;
                margin-bottom: 20px;
            }
            .tabela th {
                background-color: rgb(0, 138, 0);
                color: white;
                padding: 10px;
                text-align: left;
                font-weight: bold;
            }
            .tabela th, .tabela td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            .tabela td {
                background-color: #ffffff;
            }
            .tabela tr:nth-child(even) td {
                background-color: #f9f9f9;
            }
            @media print {
                body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .tabela th {
                    background-color: rgb(0, 138, 0) !important;
                    color: white !important;
                }
                .header {
                    background-color: #151749 !important;
                }
            }
            </style>
        </head>
        <body>
            <img src="https://i.imgur.com/5zohUo8.png" style="width: 10rem;">
            ${cabecalhoParceiro}
            <br>
            <table class="tabela">
                ${tabela}
                <tbody>
                    <tr>
                        <td colspan="3" style="background-color: #eaeaea; text-align: right;">TOTAL</td>
                        <td>${totalParceiro}</td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>`

    try {
        await gerarPdfOnline(htmlContent, `LPU PACEIRO ${nome}`);
        removerOverlay()
    } catch (err) {
        popup({ mensagem: err.message || 'Falha ao gerar o PDF' })
    }
}
