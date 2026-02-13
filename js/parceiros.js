
async function modalLPUParceiro(id, chave) {

    const orcamento = await recuperarDado('dados_orcamentos', id)
    const status = orcamento?.status?.historico?.[chave] || {}

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
            <div>${valor}</div>
        </div>`

    const elemento = `
        <div style="${vertical}; padding: 1rem;">

            <div style="${horizontal}; align-items: start; gap: 2rem;">

                <div class="requisicao-contorno">

                    <div class="requisicao-titulo">
                        Informações Complementares
                    </div>

                    <div class="requisicao-dados">
                        <button onclick="adicionarTecnicoLPU()">Adicionar Técnico</button>
                        <div id="tecnicos" style="${vertical}; gap: 1px;"></div>
                        ${stringHtml('Margem Geral (%)', `<input id="margem_lpu" value="${status?.margem || '40'}" oninput="calcularLpuParceiro()">`)}
                        ${stringHtml('Comentário', `<textarea id="comentario">${status?.comentario || ''}</textarea>`)}


                        <div style="${horizontal}; gap: 1rem;">
                            <input type="checkbox" style="width: 2rem; height: 2rem;" onclick="marcarItensLPU(this)">
                            <span>Marcar todos os ITENS<span>
                        </div>
                    </div>

                </div>
        
                <div class="requisicao-contorno">

                    <div class="requisicao-titulo">
                        Totais
                    </div>

                    <div class="requisicao-dados">
                        ${stringHtml('Total do Valor Orçamento', '<label id="total_orcamento"></label>')}
                        ${stringHtml('Total Margem Disponível', '<label id="total_margem"></label>')}
                        ${stringHtml('Total do Valor Parceiro', '<label id="total_parceiro"l></label>')}
                        ${stringHtml('Total Desvio', '<label id="total_desvio"></label>')}
                    </div>
                </div>

            </div>

            <br>
            ${tabela}
        </div>
        `

    popup({ elemento, cor: 'white', titulo: 'LPU Parceiro', autoDestruicao: ['lpu_parceiro'] })

    await paginacao()

    // Lançar Tecs;
    for (const tec of (status.tecnicos || [])) {
        await adicionarTecnicoLPU(tec)
    }

}

async function adicionarTecnicoLPU(cod = ID5digitos()) {

    controlesCxOpcoes[cod] = {
        retornar: ['nome'],
        base: 'dados_clientes',
        colunas: {
            'Nome': { chave: 'nome' },
            'CPF/CNPJ': { chave: 'cnpj' },
            'Cidade': { chave: 'cidade' },
        }
    }

    const { nome } = await recuperarDado('dados_clientes', cod) || {}

    const span = `
        <span ${cod ? `id="${cod}"` : ''} 
            class="opcoes" 
            name="${cod}" 
            onclick="cxOpcoes('${cod}')">${nome || 'Selecione'}
        </span>`

    const div = document.querySelector('#tecnicos')
    if (div)
        div.insertAdjacentHTML('beforeend', span)

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

    const spanTecs = [...document.querySelector('#tecnicos').querySelectorAll('span')]

    if (spanTecs.length == 0)
        return popup({ mensagem: 'Escolha pelo menos 1 técnico' })

    const tecnicos = spanTecs
        .filter(span => span.id)
        .map(span => Number(span.id))

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
        tecnicos
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

async function gerarPdfParceiro(id, chave) {

    overlayAguarde()

    const { status } = await recuperarDado('dados_orcamentos', id) || {}
    const lpu = status?.historico?.[chave] || {}

    const nTecs = (
        await Promise.all(
            (lpu.tecnicos || []).map(async (cod) => {

                const { nome, cidade, cep, endereco, bairro, cnpj } = await recuperarDado('dados_clientes', cod) || {}

                const dados = Object.entries({
                    nome,
                    cidade,
                    cep,
                    endereco,
                    bairro,
                    cnpj
                })
                    .map(([chave, valor]) => {
                        return `<span><b>${inicialMaiuscula(chave)}:</b> ${valor}</span>`
                    }).join('')

                return `
                <div style="${vertical}; gap: 2px; margin-bottom: 1rem;">
                    ${dados}
                </div>`
            })
        )
    ).join('\n')

    const colunas = [
        'Código',
        'Descrição',
        'Quantidade',
        'Unidade',
        'Valor Unitário',
        'Valor Total'
    ]

    const linhas = Object.entries(lpu?.itens || {})
        .map(([codigo, item]) => {

            const { descricao, qtde, unidade, vUnitParc, vTotalParc } = item || {}
            return `
            <tr>
                <td>${codigo || ''}</td>
                <td>${descricao || ''}</td>
                <td>${qtde || ''}</td>
                <td>${unidade || ''}</td>
                <td>${dinheiro(vUnitParc)}</td>
                <td>${dinheiro(vTotalParc)}</td>
            </tr>
            `
        }).join('')

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
                display: flex;
                align-itens: start;
                justify-content: start;
                flex-direction: column;
                gap: 0.5rem;
            }

            .header {
                width: 100%;
                text-align: center;
                margin-bottom: 20px;
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
                background-color: #dfdede;
                padding: 10px;
                text-align: left;
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
            }

            </style>
        </head>
        <body>
            <img src="https://i.imgur.com/5zohUo8.png" style="width: 10rem;">

            <span><b>TÉCNICOS</b></span>
            ${nTecs}

            <table class="tabela">
                <thead>
                    ${colunas.map(c => `<th>${c}</th>`).join('')}
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>
            <table class="tabela">
                <tbody>
                    <tr>
                        <td colspan="5" style="background-color: #eaeaea; text-align: right;">TOTAL</td>
                        <td>${dinheiro(lpu?.totais?.parceiro)}</td>
                    </tr>
                </tbody>
            </table>

            <div style="${vertical};">
                <span><b>COMENTÁRIO</b></span>
                <div style="white-space: pre-wrap;">${lpu?.comentario || ''}</div>
            </div>
        </body>
        </html>`

    try {
        await gerarPdfOnline(htmlContent, `LPU PACEIRO - ${Date.now()}`)
        removerOverlay()
    } catch (err) {
        popup({ mensagem: err.message || 'Falha ao gerar o PDF' })
    }
}
