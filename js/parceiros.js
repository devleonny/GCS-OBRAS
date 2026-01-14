let chaveHistorico = null
let removidos = {}

async function modalLPUParceiro(chave) {

    chaveHistorico = chave || ID5digitos()
    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)
    let cabecalhos = ['<input type="checkbox" onclick="marcarItensLPU(this)">', 'ID', 'Descrição', 'Medida', 'Quantidade', 'Valor Orçamento', 'Valor Total Orçado', 'Impostos (20%)', 'Margem (R$)', 'Valor Parceiro', 'Total Parceiro', 'Desvio'];
    let thSearch = '';
    let thHead = '';
    const cliente = await recuperarDado('dados_clientes', orcamento.dados_orcam?.omie_cliente) || {}
    const dadosEmpresa = {
        ...orcamento.dados_orcam,
        ...cliente
    }

    const status = orcamento?.status?.historico?.[chaveHistorico] || {}
    const idTecnico = status?.tecnico || ''
    const tecnico = await recuperarDado('dados_clientes', idTecnico)

    cabecalhos.forEach((cabecalho, i) => {
        thHead += `<th>${cabecalho}</th>`;
        thSearch +=
            `<th style="background-color: white; text-align: left;" contentEditable="true" oninput="pesquisarGenerico(${i}, this.textContent, 'bodyTabela')"></th>`;
    });

    const tabela = `
        <div style="${vertical};">
            <div class="topo-tabela">
                <button onclick="removerItensEmMassa()">Remover Itens</button>
                <button onclick="verItensRemovidosLPU()">Ver Itens Removidos</button>
                <button onclick="adicionarItemAdicional()">Adicionar Serviço</button>
                <button style="background-color: green;" onclick="salvarLpuParceiro()">Salvar LPU</button>
            </div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <tr>${thHead}</tr>
                        <tr>${thSearch}</tr>
                    </thead>
                    <tbody id="bodyParceiros"></tbody>
                </table>
            </div>
            <div class="rodape-tabela"></div>
        </div>
        `

    const stringHtml = (titulo, valor) => `
        <div style="${vertical}; gap: 3px;">
            <label><strong>${titulo}</strong>:</label>
            <div style="font-size: 1rem;">${valor}</div>
        </div>`

    const acumulado = `
        <div style="background-color: #d2d2d2; padding: 1rem; ${vertical};">

            <div style="${horizontal}; align-items: start; gap: 2rem;">

                <div style="${vertical}">
                    ${stringHtml('Cliente', dadosEmpresa.nome)}
                    ${stringHtml('CNPJ', dadosEmpresa.cnpj)}
                    ${stringHtml('Endereço', dadosEmpresa.bairro)}
                    ${stringHtml('Cidade', dadosEmpresa.cidade)}
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
    const bodyParceiros = document.getElementById('bodyParceiros')
    if (!bodyParceiros) {
        removidos = status?.removidos || {}
        popup(acumulado, 'LPU Parceiro', true)
    }

    const itens = status?.itens || orcamento?.dados_composicoes || {}

    for (const [codigo, composicao] of Object.entries(itens)) {

        if (composicao.tipo == 'VENDA') continue
        if (removidos[codigo]) continue

        await adicionarLinhaParceiro(codigo, composicao)

    }

    calcularLpuParceiro();

}

async function recuperarItemLPU(codigo, img) {

    overlayAguarde()

    await adicionarLinhaParceiro(codigo, removidos[codigo])

    delete removidos[codigo]

    await modalLPUParceiro(chaveHistorico)

    img.closest('div').remove()

    removerOverlay()

}

async function verItensRemovidosLPU() {

    let itens = ''
    for (const [codigo, composicao] of Object.entries(removidos)) {

        itens += `
            <div style="${horizontal}; gap: 10px;">
                <img onclick="recuperarItemLPU('${codigo}', this)" src="imagens/atualizar.png" style="width: 1.2rem;">
                <span>${composicao.descricao}</span> 
            </div>
        `
    }

    const acumulado = `
        <div style="${vertical}; gap: 5px; background-color: #d2d2d2; padding: 2vw; min-width: 30vw;">

            ${itens}

        </div>
    `

    popup(acumulado, 'Itens Removidos', true)

}

function marcarItensLPU(input) {

    const itensChecklist = document.querySelectorAll('[name="itensLPU"]')

    for (const check of itensChecklist) {
        const tr = check.closest('tr')
        check.checked = tr.style.display !== 'none' && input.checked
    }

}

async function adicionarLinhaParceiro(codigo, composicao) {

    new Promise((resolve, reject) => {

        const tds = `
        <td>
            <input type="checkbox" name="itensLPU">
        </td>
        <td>${composicao.avulso ? `<span><b>[Avulso]</b></span>` : codigo}</td>
        <td>${composicao.descricao}</td>
        <td>${composicao.unidade}</td>
        <td>
            <input class="requisicao-campo" oninput="calcularLpuParceiro()" type="number" value="${composicao.qtde}">
        </td>
        <td>${dinheiro(composicao?.custo || composicao?.valor_orcado || 0)}</td>
        <td></td>
        <td></td>
        <td></td>
        <td>
            <input class="requisicao-campo" oninput="calcularLpuParceiro()" type="number" value="${composicao?.valor_parceiro_unitario || ''}">
        </td>
        <td></td>
        <td>
            <label class="labelAprovacao"></label>
        </td>
    `
        const trExistente = document.getElementById(codigo)

        if (trExistente) {
            trExistente.innerHTML = tds
            resolve()
            return
        }

        document.getElementById('bodyParceiros').insertAdjacentHTML('beforeend', `<tr data-avulso="${composicao.avulso ? 'S' : 'N'}" id="${codigo}">${tds}</tr>`)
        calcularLpuParceiro()
        resolve()
    })

}

async function adicionarItemAdicional() {

    const acumulado = `
        <div style="${horizontal}; gap: 10px; background-color: #d2d2d2; padding: 2vw;">
            ${modelo('Descrição', `<span name="descricao" class="opcoes" onclick="cxOpcoes('descricao', 'dados_composicoes', ['descricao'])">Selecione</span>`)}
            ${modelo('Quantidade', `<input name="qtde" type="number" style="padding: 5px; border-radius: 3px;">`)}
            ${modelo('Custo', `<input name="valor_orcado" type="number" style="padding: 5px; border-radius: 3px;">`)}
            ${modelo('Unidade', `<input name="unidade" style="padding: 5px; border-radius: 3px;">`)}
            <img src="imagens/concluido.png" style="width: 2rem;" onclick="salvarAdicional()">
        </div>
    `

    popup(acumulado, 'Incluir Serviço', true)
}

async function salvarAdicional() {

    const qtde = Number(document.querySelector('[name="qtde"]').value)
    const descricao = document.querySelector('[name="descricao"]').textContent
    const valor_orcado = Number(document.querySelector('[name="valor_orcado"]').value)
    const unidade = document.querySelector('[name="unidade"]').value

    if (!qtde || !descricao || !valor_orcado || !unidade) return popup(mensagem('Não deixe campos em Branco'), 'Alerta', true)

    overlayAguarde()
    const codigo = ID5digitos()
    const composicao = {
        descricao,
        qtde,
        valor_orcado,
        unidade,
        avulso: true
    }

    adicionarLinhaParceiro(codigo, composicao)

    removerPopup()
}

async function removerItensEmMassa() {

    const itens = document.querySelectorAll('[name="itensLPU"]:checked')

    if (itens.length == 0) return

    overlayAguarde()

    for (const check of itens) {

        const tr = check.closest('tr')
        const codigo = tr.id

        const tds = tr.querySelectorAll('td')

        removidos[codigo] = {
            descricao: tds[2].textContent,
            unidade: tds[3].textContent,
            qtde: Number(tds[4].querySelector('input').value),
            custo: conversor(tds[5].textContent)
        }

        tr.remove()

    }

    removerOverlay()
    await modalLPUParceiro(chaveHistorico)
}

async function salvarLpuParceiro() {

    overlayAguarde()

    const trs = document.querySelectorAll('#bodyParceiros tr')
    let orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    if (!orcamento.status) orcamento.status = {}
    if (!orcamento.status.historico) orcamento.status.historico = {}
    if (!orcamento.status.historico[chaveHistorico]) orcamento.status.historico[chaveHistorico] = {}

    let status = {
        ...orcamento.status.historico[chaveHistorico],
        removidos,
        status: 'LPU PARCEIRO',
        itens: {},
        margem: Number(document.getElementById('margem_lpu').value),
        executor: acesso.usuario,
        data: new Date().toLocaleString(),
        comentario: document.getElementById('comentario').value,
        tecnico: document.querySelector('[name="tecnico"]')?.id || null
    }

    for (const tr of trs) {
        const codigo = tr.id
        const tds = tr.querySelectorAll('td')
        const avulso = tr.dataset.avulso === 'S'

        status.itens[codigo] = {
            avulso,
            qtde: conversor(tds[4].querySelector('input').value),
            descricao: tds[2].textContent,
            unidade: tds[3].textContent,
            custo: conversor(tds[5].textContent),
            valor_parceiro_unitario: Number(tds[9].querySelector('input').value)
        }
    }

    orcamento.status.historico[chaveHistorico] = status
    enviar(`dados_orcamentos/${id_orcam}/status/historico/${chaveHistorico}`, status)
    await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    removerPopup()
    await abrirEsquema()
}

function calcularLpuParceiro() {
    const margemPercentual = Number(document.getElementById('margem_lpu').value) / 100;

    let totais = {
        orcamento: 0,
        parceiro: 0,
        desvio: 0,
        margem: 0
    };

    const trs = document.querySelectorAll('#bodyParceiros tr')
    const modelo = (texto) => `<span style="white-space: nowrap;">${texto}</span>`

    for (const tr of trs) {

        const avulso = tr.dataset.avulso == 'S'
        const tds = tr.querySelectorAll('td')
        const qtde = Number(tds[4].querySelector('input').value)
        const valorOrcamento = conversor(tds[5].textContent)
        const valParceiro = Number(tds[9].querySelector('input').value)
        const totalLinha = qtde * valorOrcamento
        const totalParceiro = valParceiro * qtde
        const totalMargem = totalLinha * margemPercentual
        const margemPorItem = qtde == 0 ? 0 : totalMargem / qtde
        const desvio = avulso ? - totalParceiro : totalMargem - totalParceiro
        const img = desvio < 0 ? 'offline' : 'online'

        totais.parceiro += totalParceiro
        totais.desvio += desvio
        totais.orcamento += totalLinha

        tds[6].innerHTML = modelo(dinheiro(totalLinha))
        tds[7].innerHTML = modelo(dinheiro(totalLinha * 0.2))
        tds[8].innerHTML = avulso
            ? '--'
            : `
            <div style="${vertical}; gap: 5px;">
                ${modelo(dinheiro(margemPorItem))}
                ${modelo(dinheiro(totalMargem))}
            </div>
        `
        tds[10].innerHTML = modelo(dinheiro(totalParceiro))
        tds[11].innerHTML = `
            <div style="${horizontal}; justify-content: start; gap: 3px;">
                <img src="imagens/${img}.png" style="width: 1.5rem;">
                ${modelo(dinheiro(desvio))}
            </div>
            `
    }

    totais.margem = totais.orcamento * margemPercentual

    for (const [campo, total] of Object.entries(totais)) {
        const el = document.getElementById(`total_${campo}`)
        if (el) el.textContent = dinheiro(total)
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
        popup(mensagem(err), 'Alerta', true)
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

    const acumulado = `
        <div style="padding: 1vw; background-color: #d2d2d2; padding: 1rem;">
            ${cabecalhoInfo}
            ${tabela}
        </div>
        ${botoes}
    `

    popup(acumulado, 'Detalhamento Itens Parceiro', true);

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
        popup(mensagem(err), 'Alerta', true)
    }
}
